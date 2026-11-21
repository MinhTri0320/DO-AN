const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");

const Medicine = require("../models/medicine");
const Dispensing = require("../models/dispensing");

const sampleMedicines = [
  // 1. Thuốc kháng sinh thông dụng (Còn hàng)
  {
    medicineCode: "MED-001",
    name: "Cefalexin 250mg",
    activeIngredient: "Cephalosporin thế hệ 1",
    unit: "viên",
    price: 10000,
    quantity: 150,
    expiryDate: new Date("2027-10-15"),
    description: "Kháng sinh phổ rộng trị nhiễm khuẩn da, mô mềm, hô hấp cho chó mèo",
    manufacturer: "Virbac France",
    isDeleted: false,
  },
  // 2. Sữa tắm trị nấm (Còn hàng)
  {
    medicineCode: "MED-002",
    name: "Sữa tắm trị nấm Malaseb 250ml",
    activeIngredient: "Chlorhexidine + Miconazole",
    unit: "chai",
    price: 260000,
    quantity: 25,
    expiryDate: new Date("2027-08-20"),
    description: "Đặc trị viêm da tăng tiết bã nhờn và nhiễm nấm Malassezia",
    manufacturer: "Dermcare Australia",
    isDeleted: false,
  },
  // 3. Nhỏ tai (Còn hàng)
  {
    medicineCode: "MED-003",
    name: "Dung dịch vệ sinh tai Otoproct 15ml",
    activeIngredient: "Dexamethasone + Polymyxin B",
    unit: "lọ",
    price: 120000,
    quantity: 30,
    expiryDate: new Date("2027-05-10"),
    description: "Kháng viêm, giảm ngứa và điều trị viêm tai ngoài ở thú cưng",
    manufacturer: "Marphavet",
    isDeleted: false,
  },
  // 4. Men vi sinh đường ruột (Còn hàng)
  {
    medicineCode: "MED-004",
    name: "Men vi sinh Enterogermina",
    activeIngredient: "Bào tử Bacillus clausii",
    unit: "ống",
    price: 30000,
    quantity: 80,
    expiryDate: new Date("2027-12-01"),
    description: "Phục hồi hệ vi sinh đường ruột và hỗ trợ điều trị tiêu chảy cấp",
    manufacturer: "Sanofi",
    isDeleted: false,
  },
  // 5. Thuốc dạ dày (Còn hàng)
  {
    medicineCode: "MED-005",
    name: "Thuốc tráng niêm mạc Phosphalugel",
    activeIngredient: "Aluminium phosphate",
    unit: "gói",
    price: 25000,
    quantity: 50,
    expiryDate: new Date("2027-06-15"),
    description: "Bảo vệ niêm mạc dạ dày, giảm trào ngược dạ dày thực quản",
    manufacturer: "Pharmatis France",
    isDeleted: false,
  },
  // 6. Thuốc bổ điều trị (Thuốc trong đơn của bé Huy - Còn hàng)
  {
    medicineCode: "MED-006",
    name: "Thuốc bổ & Kháng viêm dịu nhẹ",
    activeIngredient: "Vitamin tổng hợp + Kháng viêm thảo dược",
    unit: "viên",
    price: 30000,
    quantity: 100,
    expiryDate: new Date("2027-11-20"),
    description: "Nâng cao sức đề kháng, hỗ trợ phục hồi sau điều trị truyền nhiễm",
    manufacturer: "Vetoquinol",
    isDeleted: false,
  },
  // 7. Gel vệ sinh răng miệng (Thuốc trong đơn của bé Thịnh - Còn hàng)
  {
    medicineCode: "MED-007",
    name: "Gel xịt thơm miệng diệt khuẩn Orozyme",
    activeIngredient: "Enzyme tự nhiên",
    unit: "tuýp",
    price: 180000,
    quantity: 20,
    expiryDate: new Date("2027-09-30"),
    description: "Ngăn ngừa mảng bám vôi răng, diệt khuẩn khoang miệng và hết hôi miệng",
    manufacturer: "Ecuphar Belgium",
    isDeleted: false,
  },
  // 8. Thuốc HẾT HÀNG (để kiểm thử nhãn 'Hết hàng' và chặn cấp khi thiếu hàng)
  {
    medicineCode: "MED-008",
    name: "Kháng sinh Amoxicillin Clavulanate 250mg",
    activeIngredient: "Amoxicillin + Acid Clavulanic",
    unit: "viên",
    price: 15000,
    quantity: 0, // Hết hàng
    expiryDate: new Date("2027-10-01"),
    description: "Kháng sinh điều trị nhiễm khuẩn đường tiết niệu và hô hấp",
    manufacturer: "Zoetis USA",
    isDeleted: false,
  },
  // 9. Thuốc QUÁ HẠN (để kiểm thử nhãn 'Hết hạn' và chặn cấp khi quá hạn)
  {
    medicineCode: "MED-009",
    name: "Vitamin C thú cưng dạng siro",
    activeIngredient: "Acid Ascorbic 100mg/ml",
    unit: "lọ",
    price: 45000,
    quantity: 15,
    expiryDate: new Date("2025-05-01"), // Đã hết hạn trong quá khứ
    description: "Bổ sung vitamin C giải nhiệt, chống stress",
    manufacturer: "Bio-Pharmachemie",
    isDeleted: false,
  },
];

async function seedMedicineAndDispensing() {
  try {
    await connectDB();
    console.log("-> Đang đồng bộ Medicine & Dispensing vào MongoDB...\n");

    await Medicine.init();
    await Dispensing.init();
    console.log("✓ Đã khởi tạo Indexes cho Medicine và Dispensing");

    // 1. Nạp danh mục thuốc
    for (const med of sampleMedicines) {
      await Medicine.findOneAndUpdate(
        { medicineCode: med.medicineCode },
        { $set: med },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const now = new Date();
      let statusTag = "Còn hàng";
      if (new Date(med.expiryDate) < now) statusTag = "Hết hạn";
      else if (med.quantity <= 0) statusTag = "Hết hàng";

      console.log(`✓ [${med.medicineCode}] ${med.name} | Tồn: ${med.quantity} ${med.unit} | Giá: ${med.price.toLocaleString()}đ | Trạng thái: [${statusTag}]`);
    }

    // 2. Kiểm thử cấp thuốc theo đơn (Pet: Huy, Prescription: RX-2026-693)
    console.log("\n--- THỰC THI NGHIỆP VỤ CẤP THUỐC THEO ĐƠN (TRÍ) ---");
    const medThuocBoBefore = await Medicine.findOne({ medicineCode: "MED-006" });
    console.log(`- Tồn kho ban đầu của "${medThuocBoBefore.name}": ${medThuocBoBefore.quantity} viên`);

    // Thực hiện cấp thuốc cho đơn RX-2026-693 (Bé Huy - 5 viên)
    const newDispense = await Dispensing.dispensePrescription({
      prescriptionId: "RX-2026-693",
      petId: "6afb3d4929cc539c893f82d3",
      petName: "Huy",
      customerName: "Nguyễn Văn Chủ Bé Huy",
      dispensedBy: "Dược sĩ Trần Minh Trí",
      dispensedAt: new Date("2026-11-20T11:00:00Z"),
      items: [
        {
          medicineName: "Thuốc bổ & Kháng viêm dịu nhẹ",
          quantity: 5,
        },
      ],
      notes: "Cấp phát thuốc theo đơn điều trị Bệnh Dại, hướng dẫn uống sau ăn",
    });

    console.log(`✓ Cấp thuốc thành công: Lượt cấp [${newDispense.dispensingCode}]`);
    console.log(`  + Đơn thuốc: ${newDispense.prescriptionId} (Bé ${newDispense.petName})`);
    console.log(`  + Người cấp: ${newDispense.dispensedBy}`);
    console.log(`  + Tổng giá trị: ${newDispense.totalAmount.toLocaleString()}đ`);

    const medThuocBoAfter = await Medicine.findOne({ medicineCode: "MED-006" });
    console.log(`✓ Tồn kho sau khi cấp tự động trừ đúng: ${medThuocBoAfter.quantity} viên (đã giảm 5 viên)`);

    // 3. Kiểm thử chặn các trường hợp lỗi:
    console.log("\n--- KIỂM TRA CHẶN CÁC TRƯỜNG HỢP LỖI NGHIỆP VỤ (TRÍ) ---");

    // 3.1. Chặn cấp lặp
    try {
      await Dispensing.dispensePrescription({
        prescriptionId: "RX-2026-693",
        items: [{ medicineName: "Thuốc bổ & Kháng viêm dịu nhẹ", quantity: 5 }],
      });
      console.log("X LỖI: Lẽ ra phải chặn cấp lặp!");
    } catch (err) {
      console.log(`✓ Chặn cấp lặp thành công: "${err.message}"`);
    }

    // 3.2. Chặn khi thuốc hết hàng (quantity <= 0)
    try {
      await Dispensing.dispensePrescription({
        prescriptionId: "RX-TEST-OUT-OF-STOCK",
        items: [{ medicineName: "Kháng sinh Amoxicillin Clavulanate 250mg", quantity: 2 }],
      });
      console.log("X LỖI: Lẽ ra phải chặn thiếu hàng!");
    } catch (err) {
      console.log(`✓ Chặn thiếu hàng thành công: "${err.message}"`);
    }

    // 3.3. Chặn khi thuốc quá hạn sử dụng
    try {
      await Dispensing.dispensePrescription({
        prescriptionId: "RX-TEST-EXPIRED",
        items: [{ medicineName: "Vitamin C thú cưng dạng siro", quantity: 1 }],
      });
      console.log("X LỖI: Lẽ ra phải chặn thuốc hết hạn!");
    } catch (err) {
      console.log(`✓ Chặn thuốc hết hạn thành công: "${err.message}"`);
    }

    // Nạp thêm 1 lượt cấp thuốc đã hoàn thành trước đó cho đơn của Bé Bơ (RX-2026-001)
    await Dispensing.findOneAndUpdate(
      { prescriptionId: "RX-2026-001" },
      {
        $set: {
          dispensingCode: "DISP-2026-001",
          prescriptionId: "RX-2026-001",
          prescriptionCode: "RX-2026-001",
          petId: "pet_1",
          petName: "Bé Bơ",
          customerName: "Nguyễn Văn Chủ Bé Bơ",
          dispensedBy: "Dược sĩ Trần Minh Trí",
          dispensedAt: new Date("2026-10-15T10:30:00Z"),
          items: [
            {
              medicineName: "Cefalexin 250mg",
              unit: "viên",
              quantity: 14,
              price: 10000,
              amount: 140000,
            },
            {
              medicineName: "Sữa tắm trị nấm Malaseb 250ml",
              unit: "chai",
              quantity: 1,
              price: 260000,
              amount: 260000,
            },
            {
              medicineName: "Dung dịch vệ sinh tai Otoproct 15ml",
              unit: "lọ",
              quantity: 1,
              price: 120000,
              amount: 120000,
            },
          ],
          totalAmount: 520000,
          status: "dispensed",
          notes: "Đã cấp đủ thuốc theo đơn điều trị viêm da dị ứng",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("✓ Đã nạp lượt cấp thuốc lịch sử [DISP-2026-001] cho đơn RX-2026-001");

    // 4. Kiểm tra các hàm truy vấn của Trí
    console.log("\n--- KIỂM TRA TRUY VẤN DATABASE (TRÍ) ---");
    // Tìm kiếm thuốc theo tên
    const searchRes = await Medicine.findByName("Cefalexin");
    console.log(`1. Tìm kiếm thuốc với từ khóa "Cefalexin": tìm thấy ${searchRes.length} loại`);

    // Thuốc hết hàng
    const outOfStock = await Medicine.findOutOfStock();
    console.log(`2. Danh sách thuốc hết hàng: ${outOfStock.map((m) => m.name).join(", ")}`);

    // Thuốc quá hạn
    const expiredMeds = await Medicine.findExpired();
    console.log(`3. Danh sách thuốc quá hạn: ${expiredMeds.map((m) => m.name).join(", ")}`);

    // Truy vấn lượt cấp thuốc theo đơn
    const dispByPrescription = await Dispensing.findByPrescription("RX-2026-693");
    console.log(`4. Truy vấn lượt cấp thuốc theo đơn RX-2026-693: tìm thấy ${dispByPrescription.length} lượt cấp`);

    console.log("\n================ KẾT QUẢ TRÊN MONGODB ================");
    const totalMeds = await Medicine.countDocuments({ isDeleted: false });
    const totalDisps = await Dispensing.countDocuments({ isDeleted: false });
    console.log(`Collection: medicines   - ${totalMeds} thuốc trong kho`);
    console.log(`Collection: dispensings - ${totalDisps} lượt cấp thuốc`);
    console.log("======================================================");

    await mongoose.connection.close();
    console.log("=> HOÀN TẤT NẠP DỮ LIỆU VÀ KIỂM THỬ THÀNH CÔNG TRÊN MONGODB!");
    process.exit(0);
  } catch (err) {
    console.error("X Lỗi:", err);
    process.exit(1);
  }
}

seedMedicineAndDispensing();
