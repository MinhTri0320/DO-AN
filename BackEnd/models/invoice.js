const mongoose = require("mongoose");

/* =====================================================================
 *  INVOICE MODEL (Quản lý hóa đơn - Invoice & Payment)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin Invoice: khách hàng, danh sách mục (tên, số lượng,
 *    đơn giá, thành tiền), tổng tiền (tự tính từ backend), trạng thái (unpaid, paid)
 *  - Đơn giá lưu cố định tại thời điểm lập
 *  - Truy vấn Invoice: theo khách, theo trạng thái (Trí)
 * ===================================================================== */

const invoiceItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên mục thanh toán là bắt buộc"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Số lượng là bắt buộc"],
      min: [1, "Số lượng tối thiểu là 1"],
      default: 1,
    },
    // Đơn giá lưu cố định tại thời điểm lập hóa đơn
    unitPrice: {
      type: Number,
      required: [true, "Đơn giá là bắt buộc"],
      min: [0, "Đơn giá không được âm"],
      default: 0,
    },
    // Thành tiền = quantity * unitPrice (backend tự tính)
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Khách hàng nhận hóa đơn
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
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    // Thú cưng liên quan (nếu có)
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      default: null,
    },
    petName: {
      type: String,
      trim: true,
      default: "",
    },
    // Liên kết lượt cấp thuốc (Dispensing) hoặc đợt khám/lưu chuồng
    dispensingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispensing",
      default: null,
    },
    prescriptionCode: {
      type: String,
      trim: true,
      default: "",
    },
    // Danh sách các mục thanh toán (thuốc, dịch vụ, ngày lưu chuồng)
    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Hóa đơn phải có ít nhất một mục thanh toán!",
      },
    },
    // Tổng tiền do backend tự tính từ các mục, không nhận từ client
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Tổng tiền không được âm"],
      default: 0,
    },
    // Trạng thái hóa đơn: unpaid (mặc định), paid (đã thanh toán), cancelled (đã hủy)
    status: {
      type: String,
      trim: true,
      enum: {
        values: ["unpaid", "paid", "cancelled"],
        message: "Trạng thái hóa đơn phải là unpaid, paid hoặc cancelled",
      },
      default: "unpaid",
      index: true,
    },
    // Phương thức thanh toán khi đã thanh toán (cash hoặc transfer)
    paymentMethod: {
      type: String,
      trim: true,
      enum: ["cash", "transfer", null],
      default: null,
    },
    // Thời điểm thanh toán thực tế
    paidAt: {
      type: Date,
      default: null,
    },
    // Liên kết với bản ghi Payment
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
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

// Middleware tiền xử lý dữ liệu trước khi lưu:
// 1. Tự động sinh mã invoiceCode
// 2. Tự tính thành tiền từng mục và tổng tiền hóa đơn (đảm bảo không bị client thao túng)
invoiceSchema.pre("save", function () {
  if (!this.invoiceCode) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.invoiceCode = `INV-${new Date().getFullYear()}-${randomNum}`;
  }

  if (Array.isArray(this.items) && this.items.length > 0) {
    let sum = 0;
    this.items.forEach((item) => {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unitPrice) || 0;
      item.amount = q * p;
      sum += item.amount;
    });
    this.totalAmount = sum;
  }
});

// =====================================================================
//  CÁC PHƯƠNG THỨC LẬP HÓA ĐƠN & THANH TOÁN (DATABASE LOGIC - TRÍ)
// =====================================================================

/**
 * Hàm tạo mới hóa đơn an toàn (Trí)
 * Đảm bảo: Đơn giá lưu cố định tại thời điểm lập, tổng tiền backend tự tính
 */
invoiceSchema.statics.createInvoice = async function ({
  customerId,
  petId = null,
  dispensingId = null,
  prescriptionCode = "",
  items = [],
  notes = "",
}) {
  const User = mongoose.model("User");
  const Pet = mongoose.model("Pet");

  const user = await User.findById(customerId).lean();
  const customerName = user ? (user.fullName || user.username) : "Khách hàng";
  const customerPhone = user ? (user.phone || "") : "";

  let petName = "";
  if (petId) {
    const pet = await Pet.findById(petId).lean();
    if (pet) petName = pet.name;
  }

  // Chuẩn hóa và tự tính tổng tiền từ items
  let totalAmount = 0;
  const normalizedItems = items.map((it) => {
    const q = Number(it.quantity) || 1;
    const p = Number(it.unitPrice || it.price) || 0;
    const amount = q * p;
    totalAmount += amount;
    return {
      name: it.name || it.medicineName || "Dịch vụ",
      quantity: q,
      unitPrice: p,
      amount,
    };
  });

  const randomNum = Math.floor(100 + Math.random() * 900);
  const invoiceCode = `INV-${new Date().getFullYear()}-${randomNum}`;

  const newInvoice = await this.create({
    invoiceCode,
    customerId,
    customerName,
    customerPhone,
    petId,
    petName,
    dispensingId,
    prescriptionCode,
    items: normalizedItems,
    totalAmount,
    status: "unpaid",
    notes,
  });

  return newInvoice;
};

/**
 * Hàm tạo hóa đơn tự động từ lượt cấp thuốc (Dispensing)
 */
invoiceSchema.statics.createFromDispensing = async function (dispensingId) {
  const Dispensing = mongoose.model("Dispensing");
  const dispensing = await Dispensing.findById(dispensingId).lean();

  if (!dispensing) {
    throw new Error(`Không tìm thấy lượt cấp thuốc với ID: ${dispensingId}`);
  }

  const items = (dispensing.items || []).map((it) => ({
    name: `${it.medicineName} (${it.unit})`,
    quantity: it.quantity,
    unitPrice: it.price,
    amount: it.amount || it.quantity * it.price,
  }));

  return this.createInvoice({
    customerId: dispensing.customerId,
    petId: dispensing.petId,
    dispensingId: dispensing._id,
    prescriptionCode: dispensing.prescriptionCode || dispensing.prescriptionId,
    items,
    notes: `Lập từ lượt cấp thuốc [${dispensing.dispensingCode}]`,
  });
};

// =====================================================================
//  CÁC PHƯƠNG THỨC TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE QUERY - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn hóa đơn theo khách hàng (Khách hàng chỉ xem được hóa đơn của mình)
 */
invoiceSchema.statics.findByCustomer = function (customerId, status = null) {
  const query = { customerId, isDeleted: false };
  if (status) query.status = status;
  return this.find(query)
    .populate("petId", "name species")
    .sort({ createdAt: -1 });
};

/**
 * 2. Truy vấn hóa đơn theo trạng thái (unpaid, paid)
 */
invoiceSchema.statics.findByStatus = function (status) {
  return this.find({ status, isDeleted: false })
    .populate("customerId", "fullName username phone email")
    .populate("petId", "name species")
    .sort({ createdAt: -1 });
};

// Indexes tối ưu hiệu năng
invoiceSchema.index({ customerId: 1, status: 1 });
invoiceSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema, "invoices");
