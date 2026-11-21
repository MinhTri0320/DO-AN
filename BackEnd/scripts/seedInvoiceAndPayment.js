const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");

const User = require("../models/user");
const Pet = require("../models/pet");
const Dispensing = require("../models/dispensing");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");

async function seedInvoiceAndPayment() {
  try {
    await connectDB();
    console.log("-> Đang đồng bộ Invoice & Payment vào MongoDB...\n");

    await Invoice.init();
    await Payment.init();
    console.log("✓ Đã khởi tạo Indexes cho Invoice và Payment");

    // Lấy thông tin thực tế từ database
    const petHuy = await Pet.findOne({ name: "Huy" }).lean();
    const petThinh = await Pet.findOne({ name: "Thịnh" }).lean();
    const dispHuy = await Dispensing.findOne({ prescriptionId: "RX-2026-693" }).lean();

    if (!petHuy) {
      console.warn("Chưa tìm thấy dữ liệu thú cưng.");
      process.exit(0);
    }

    // 1. Lập hóa đơn từ thuốc đã cấp cho bé Huy (RX-2026-693)
    console.log("1. Lập hóa đơn từ thuốc đã cấp (Bé Huy - RX-2026-693):");
    const invHuy = await Invoice.findOneAndUpdate(
      { prescriptionCode: "RX-2026-693" },
      {
        $set: {
          invoiceCode: "INV-2026-693",
          customerId: petHuy.ownerId,
          customerName: "Nguyễn Văn Chủ Bé Huy",
          customerPhone: "0364938914",
          petId: petHuy._id,
          petName: petHuy.name,
          dispensingId: dispHuy ? dispHuy._id : null,
          prescriptionCode: "RX-2026-693",
          items: [
            {
              name: "Thuốc bổ & Kháng viêm dịu nhẹ (viên)",
              quantity: 5,
              unitPrice: 30000,
              amount: 150000, // Tự động tính
            },
          ],
          totalAmount: 150000, // Backend tự tính từ các mục
          status: "unpaid", // Ban đầu chưa thanh toán
          notes: "Hóa đơn tiền thuốc điều trị ngoại trú",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✓ Tạo thành công hóa đơn [${invHuy.invoiceCode}] - Tổng tiền: ${invHuy.totalAmount.toLocaleString()}đ - Trạng thái: ${invHuy.status}`);

    // 2. Kiểm thử nghiệp vụ thanh toán (Payment) cho hóa đơn của Bé Huy
    console.log("\n--- THỰC THI NGHIỆP VỤ THANH TOÁN (TRÍ) ---");

    // 2.1. Thử thanh toán sai số tiền (trả 100.000đ thay vì 150.000đ)
    try {
      await Payment.processPayment({
        invoiceId: invHuy._id,
        amount: 100000,
        paymentMethod: "cash",
      });
      console.log("X LỖI: Lẽ ra phải chặn sai số tiền!");
    } catch (err) {
      console.log(`✓ Chặn sai số tiền thành công: "${err.message}"`);
    }

    // 2.2. Thanh toán đúng số tiền 150.000đ bằng hình thức chuyển khoản (transfer)
    const { payment: payHuy, invoice: paidInvHuy } = await Payment.processPayment({
      invoiceId: invHuy._id,
      amount: 150000,
      paymentMethod: "transfer",
      cashier: "Thu ngân Trần Minh Trí",
      transactionRef: "MB-VCB-88392019",
      notes: "Khách quét mã QR VietQR chuyển khoản thành công",
    });

    console.log(`✓ Thanh toán thành công: Giao dịch [${payHuy.paymentCode}]`);
    console.log(`  + Hóa đơn: ${payHuy.invoiceCode}`);
    console.log(`  + Số tiền: ${payHuy.amount.toLocaleString()}đ`);
    console.log(`  + Phương thức: ${payHuy.paymentMethod} (Mã GD: ${payHuy.transactionRef})`);
    console.log(`  + Hóa đơn chuyển trạng thái sang: "${paidInvHuy.status}"`);

    // 2.3. Thử thanh toán lại lần nữa (chặn thanh toán lặp)
    try {
      await Payment.processPayment({
        invoiceId: invHuy._id,
        amount: 150000,
        paymentMethod: "cash",
      });
      console.log("X LỖI: Lẽ ra phải chặn thanh toán lặp!");
    } catch (err) {
      console.log(`✓ Chặn thanh toán lại thành công: "${err.message}"`);
    }

    // 3. Nạp thêm các hóa đơn mẫu khác
    console.log("\n--- NẠP THÊM HÓA ĐƠN MẪU ĐA DẠNG ---");

    // Hóa đơn 2: Đã thanh toán bằng tiền mặt (cash) cho Bé Bơ
    const invBo = await Invoice.findOneAndUpdate(
      { invoiceCode: "INV-2026-001" },
      {
        $set: {
          invoiceCode: "INV-2026-001",
          customerId: petHuy.ownerId,
          customerName: "Nguyễn Văn Chủ Bé Bơ",
          customerPhone: "0364938914",
          petId: petHuy._id,
          petName: "Bé Bơ",
          prescriptionCode: "RX-2026-001",
          items: [
            { name: "Cefalexin 250mg (viên)", quantity: 14, unitPrice: 10000, amount: 140000 },
            { name: "Sữa tắm trị nấm Malaseb 250ml (chai)", quantity: 1, unitPrice: 260000, amount: 260000 },
            { name: "Dung dịch vệ sinh tai Otoproct 15ml (lọ)", quantity: 1, unitPrice: 120000, amount: 120000 },
          ],
          totalAmount: 520000,
          status: "paid",
          paymentMethod: "cash",
          paidAt: new Date("2026-10-15T11:00:00Z"),
          notes: "Đã thu tiền mặt tại quầy thu ngân",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Payment.findOneAndUpdate(
      { invoiceCode: "INV-2026-001" },
      {
        $set: {
          paymentCode: "PAY-2026-001",
          invoiceId: invBo._id,
          invoiceCode: invBo.invoiceCode,
          customerId: invBo.customerId,
          customerName: invBo.customerName,
          amount: 520000,
          paymentMethod: "cash",
          paidAt: new Date("2026-10-15T11:00:00Z"),
          cashier: "Thu ngân Trần Minh Trí",
          notes: "Khách thanh toán tiền mặt",
          status: "success",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✓ [INV-2026-001] Đã thanh toán tiền mặt (cash): ${invBo.totalAmount.toLocaleString()}đ`);

    // Hóa đơn 3: Đang CHỜ THANH TOÁN (unpaid) cho bé Thịnh
    const invThinh = await Invoice.findOneAndUpdate(
      { invoiceCode: "INV-2026-702" },
      {
        $set: {
          invoiceCode: "INV-2026-702",
          customerId: petThinh ? petThinh.ownerId : petHuy.ownerId,
          customerName: "Khách hàng Thịnh",
          customerPhone: "0961009332",
          petId: petThinh ? petThinh._id : null,
          petName: petThinh ? petThinh.name : "Thịnh",
          prescriptionCode: "RX-2026-702",
          items: [
            { name: "Gel xịt thơm miệng diệt khuẩn Orozyme (tuýp)", quantity: 1, unitPrice: 180000, amount: 180000 },
            { name: "Dịch vụ Tắm dưỡng mượt & Vắt tuyến hôi", quantity: 1, unitPrice: 180000, amount: 180000 },
          ],
          totalAmount: 360000,
          status: "unpaid",
          notes: "Hóa đơn chờ khách hàng thanh toán tại quầy",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✓ [INV-2026-702] Hóa đơn CHỜ THANH TOÁN (unpaid): ${invThinh.totalAmount.toLocaleString()}đ`);

    // 4. Kiểm tra các hàm truy vấn của Trí
    console.log("\n--- KIỂM TRA TRUY VẤN DATABASE (TRÍ) ---");

    // Truy vấn hóa đơn theo khách hàng
    const custInvoices = await Invoice.findByCustomer(petHuy.ownerId);
    console.log(`1. Truy vấn hóa đơn theo khách hàng: ${custInvoices.length} hóa đơn`);
    custInvoices.forEach((inv) => {
      console.log(`   + [${inv.invoiceCode}] Bé: ${inv.petName || "N/A"} | Tổng: ${inv.totalAmount.toLocaleString()}đ | Trạng thái: ${inv.status}`);
    });

    // Truy vấn hóa đơn theo trạng thái unpaid
    const unpaidList = await Invoice.findByStatus("unpaid");
    console.log(`2. Danh sách hóa đơn chưa thanh toán (unpaid): ${unpaidList.length} hóa đơn`);
    unpaidList.forEach((inv) => {
      console.log(`   + [${inv.invoiceCode}] Khách: ${inv.customerName} | Tổng: ${inv.totalAmount.toLocaleString()}đ`);
    });

    // Truy vấn Payment theo hóa đơn
    const payByInvoice = await Payment.findByInvoice(invHuy._id);
    console.log(`3. Truy vấn Payment theo hóa đơn [${invHuy.invoiceCode}]: ${payByInvoice.length} giao dịch`);
    payByInvoice.forEach((p) => {
      console.log(`   + [${p.paymentCode}] Số tiền: ${p.amount.toLocaleString()}đ | Phương thức: ${p.paymentMethod}`);
    });

    console.log("\n================ KẾT QUẢ TRÊN MONGODB ================");
    const totalInvoices = await Invoice.countDocuments({ isDeleted: false });
    const paidInvoices = await Invoice.countDocuments({ status: "paid", isDeleted: false });
    const unpaidInvoices = await Invoice.countDocuments({ status: "unpaid", isDeleted: false });
    const totalPayments = await Payment.countDocuments({ isDeleted: false });
    console.log(`Collection: invoices - ${totalInvoices} hóa đơn (Đã thanh toán: ${paidInvoices}, Chưa thanh toán: ${unpaidInvoices})`);
    console.log(`Collection: payments - ${totalPayments} giao dịch thanh toán`);
    console.log("======================================================");

    await mongoose.connection.close();
    console.log("=> HOÀN TẤT NẠP DỮ LIỆU VÀ KIỂM THỬ INVOICE & PAYMENT THÀNH CÔNG TRÊN MONGODB!");
    process.exit(0);
  } catch (err) {
    console.error("X Lỗi:", err);
    process.exit(1);
  }
}

seedInvoiceAndPayment();
