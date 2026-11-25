const mongoose = require("mongoose");

/* =====================================================================
 *  PAYMENT MODEL (Quản lý thanh toán hóa đơn - Invoice & Payment)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin Payment: invoiceId, amount, paymentMethod, paidAt
 *  - Nghiệp vụ: số tiền phải bằng tổng tiền hóa đơn (chưa hỗ trợ trả góp)
 *  - Chặn thanh toán lại khi hóa đơn đã paid
 *  - Chuyển hóa đơn sang paid khi thanh toán thành công
 *  - Truy vấn Payment theo hóa đơn (Trí)
 * ===================================================================== */

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Hóa đơn được thanh toán
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: [true, "Mã hóa đơn (invoiceId) là bắt buộc"],
      index: true,
    },
    invoiceCode: {
      type: String,
      trim: true,
      index: true,
    },
    // Khách hàng thanh toán
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Mã khách hàng (customerId) là bắt buộc"],
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: "Khách hàng",
    },
    // Số tiền thanh toán (bắt buộc bằng tổng tiền hóa đơn)
    amount: {
      type: Number,
      required: [true, "Số tiền thanh toán là bắt buộc"],
      min: [1, "Số tiền thanh toán phải lớn hơn 0"],
    },
    // Phương thức thanh toán: cash (tiền mặt), transfer (chuyển khoản)
    paymentMethod: {
      type: String,
      required: [true, "Phương thức thanh toán là bắt buộc"],
      enum: {
        values: ["cash", "transfer"],
        message: "Phương thức thanh toán phải là cash (tiền mặt) hoặc transfer (chuyển khoản)",
      },
      index: true,
    },
    // Thời điểm thanh toán
    paidAt: {
      type: Date,
      required: [true, "Thời điểm thanh toán (paidAt) là bắt buộc"],
      default: Date.now,
      index: true,
    },
    // Thu ngân / nhân viên xác nhận thanh toán
    cashier: {
      type: String,
      trim: true,
      default: "Thu ngân PawnCare",
    },
    // Mã giao dịch ngân hàng (nếu là transfer)
    transactionRef: {
      type: String,
      trim: true,
      default: "",
    },
    // Trạng thái giao dịch: success (thành công), refunded (hoàn tiền)
    status: {
      type: String,
      trim: true,
      enum: ["success", "refunded"],
      default: "success",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Tự động sinh mã paymentCode nếu chưa có
paymentSchema.pre("save", function () {
  if (!this.paymentCode) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.paymentCode = `PAY-${new Date().getFullYear()}-${randomNum}`;
  }
});

// =====================================================================
//  CÁC PHƯƠNG THỨC XỬ LÝ THANH TOÁN (DATABASE BUSINESS LOGIC - TRÍ)
// =====================================================================

/**
 * Hàm nghiệp vụ cốt lõi: Thực hiện thanh toán cho hóa đơn (Trí)
 * Đáp ứng các quy tắc:
 * 1. Chỉ hóa đơn "unpaid" mới thanh toán được, chặn thanh toán lặp nếu đã paid
 * 2. Số tiền thanh toán phải bằng chính xác tổng tiền hóa đơn (chưa hỗ trợ trả góp)
 * 3. Phương thức thanh toán phải là cash hoặc transfer
 * 4. Thanh toán thành công: lưu mã hóa đơn, số tiền, phương thức, thời điểm trả và chuyển hóa đơn sang paid
 */
paymentSchema.statics.processPayment = async function ({
  invoiceId,
  amount,
  paymentMethod,
  cashier = "Thu ngân PawnCare",
  transactionRef = "",
  notes = "",
  paidAt = new Date(),
}) {
  const Invoice = mongoose.model("Invoice");

  // 1. Kiểm tra hóa đơn tồn tại
  const invoice = await Invoice.findOne({
    $or: [
      { _id: String(invoiceId).match(/^[0-9a-fA-F]{24}$/) ? invoiceId : null },
      { invoiceCode: invoiceId },
    ],
    isDeleted: false,
  });

  if (!invoice) {
    throw new Error(`Không tìm thấy hóa đơn với ID/Mã: ${invoiceId}`);
  }

  // 2. Chặn thanh toán lại: Chỉ hóa đơn unpaid mới được thanh toán
  if (invoice.status === "paid") {
    const paidTime = invoice.paidAt ? new Date(invoice.paidAt).toLocaleString("vi-VN") : "trước đó";
    throw new Error(
      `Hóa đơn [${invoice.invoiceCode}] đã được thanh toán vào lúc ${paidTime}, không thể thanh toán lại!`
    );
  }

  if (invoice.status === "cancelled") {
    throw new Error(`Hóa đơn [${invoice.invoiceCode}] đã bị hủy, không thể thanh toán!`);
  }

  // 3. Kiểm tra số tiền: Phải bằng đúng tổng tiền hóa đơn (chưa hỗ trợ trả góp)
  const payAmount = Number(amount);
  if (isNaN(payAmount) || payAmount !== invoice.totalAmount) {
    throw new Error(
      `Số tiền thanh toán (${payAmount.toLocaleString()}đ) không bằng tổng tiền hóa đơn (${invoice.totalAmount.toLocaleString()}đ). Hệ thống chưa hỗ trợ trả góp hoặc thanh toán sai số tiền!`
    );
  }

  // 4. Kiểm tra phương thức thanh toán
  if (!["cash", "transfer"].includes(paymentMethod)) {
    throw new Error(
      `Phương thức thanh toán "${paymentMethod}" không hợp lệ! Chỉ chấp nhận "cash" (tiền mặt) hoặc "transfer" (chuyển khoản).`
    );
  }

  // 5. Tạo bản ghi Payment thành công
  const randomNum = Math.floor(100 + Math.random() * 900);
  const paymentCode = `PAY-${new Date().getFullYear()}-${randomNum}`;

  const payment = await this.create({
    paymentCode,
    invoiceId: invoice._id,
    invoiceCode: invoice.invoiceCode,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    amount: payAmount,
    paymentMethod,
    paidAt: new Date(paidAt),
    cashier,
    transactionRef,
    notes,
    status: "success",
  });

  // 6. Cập nhật hóa đơn chuyển sang "paid"
  invoice.status = "paid";
  invoice.paidAt = payment.paidAt;
  invoice.paymentMethod = paymentMethod;
  invoice.paymentId = payment._id;
  await invoice.save();

  return { payment, invoice };
};

// =====================================================================
//  CÁC PHƯƠNG THỨC TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE QUERY - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn lịch sử Payment theo hóa đơn (invoiceId hoặc invoiceCode)
 */
paymentSchema.statics.findByInvoice = function (invoiceIdOrCode) {
  const query = mongoose.Types.ObjectId.isValid(invoiceIdOrCode)
    ? {
        $or: [{ invoiceId: invoiceIdOrCode }, { invoiceCode: invoiceIdOrCode }],
        isDeleted: false,
      }
    : {
        invoiceCode: invoiceIdOrCode,
        isDeleted: false,
      };

  return this.findOne(query)
    .populate("customerId", "name phone")
    .sort({ paidAt: -1 });
};

/**
 * 2. Truy vấn lịch sử Payment theo khách hàng
 */
paymentSchema.statics.findByCustomer = function (customerId) {
  return this.find({ customerId, isDeleted: false })
    .populate("invoiceId", "invoiceCode totalAmount items")
    .sort({ paidAt: -1 });
};

/**
 * 3. Truy vấn Payment theo khoảng ngày
 */
paymentSchema.statics.findByDateRange = function (fromDate, toDate) {
  const query = { isDeleted: false };
  if (fromDate || toDate) {
    query.paidAt = {};
    if (fromDate) query.paidAt.$gte = new Date(fromDate);
    if (toDate) query.paidAt.$lte = new Date(toDate);
  }
  return this.find(query).sort({ paidAt: -1 });
};

// Indexes tối ưu hiệu năng
paymentSchema.index({ invoiceId: 1, status: 1 });
paymentSchema.index({ customerId: 1, paidAt: -1 });
paymentSchema.index({ paidAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema, "payments");
