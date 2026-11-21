const mongoose = require("mongoose");

/* =====================================================================
 *  MEDICINE MODEL (Quản lý danh mục thuốc & kho thuốc)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin Medicine: tên, đơn vị, giá, quantity (tồn kho),
 *    expiryDate (hạn dùng), description (mô tả)
 *  - Ràng buộc: quantity >= 0, giá > 0
 *  - Tự động gắn nhãn "Hết hàng", "Hết hạn"
 *  - Truy vấn Medicine theo tên, trạng thái kho (Trí)
 * ===================================================================== */

const medicineSchema = new mongoose.Schema(
  {
    medicineCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Tên thuốc / biệt dược
    name: {
      type: String,
      required: [true, "Tên thuốc là bắt buộc"],
      trim: true,
      index: true,
    },
    // Hoạt chất chính
    activeIngredient: {
      type: String,
      trim: true,
      default: "",
    },
    // Đơn vị tính: viên, chai, ống, tuýp, gói, lọ...
    unit: {
      type: String,
      required: [true, "Đơn vị tính là bắt buộc"],
      trim: true,
      default: "viên",
    },
    // Giá bán đơn vị (VNĐ) - Ràng buộc: giá phải lớn hơn 0
    price: {
      type: Number,
      required: [true, "Giá thuốc là bắt buộc"],
      min: [1, "Giá thuốc phải lớn hơn 0"],
      default: 10000,
    },
    // Số lượng tồn kho - Ràng buộc: không được âm
    quantity: {
      type: Number,
      required: [true, "Số lượng tồn kho là bắt buộc"],
      min: [0, "Số lượng tồn không được âm"],
      default: 0,
      index: true,
    },
    // Hạn dùng (expiryDate)
    expiryDate: {
      type: Date,
      required: [true, "Hạn dùng của thuốc là bắt buộc"],
      index: true,
    },
    // Mô tả công dụng, liều dùng, bảo quản
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Nhà sản xuất / xuất xứ
    manufacturer: {
      type: String,
      trim: true,
      default: "Dược phẩm thú y",
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

// Virtual trạng thái thuốc: "Hết hàng", "Hết hạn", "Còn hàng"
medicineSchema.virtual("stockStatus").get(function () {
  const now = new Date();
  if (this.expiryDate && new Date(this.expiryDate) < now) {
    return "Hết hạn";
  }
  if (this.quantity <= 0) {
    return "Hết hàng";
  }
  return "Còn hàng";
});

// Tự động sinh mã medicineCode nếu chưa có
medicineSchema.pre("save", function () {
  if (!this.medicineCode) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.medicineCode = `MED-${new Date().getFullYear()}-${randomNum}`;
  }
});

// =====================================================================
//  CÁC PHƯƠNG THỨC KIỂM TRA & TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn thuốc theo tên (tìm kiếm gần đúng không phân biệt hoa thường)
 */
medicineSchema.statics.findByName = function (keyword) {
  if (!keyword || !keyword.trim()) {
    return this.find({ isDeleted: false }).sort({ name: 1 });
  }
  const regex = new RegExp(keyword.trim(), "i");
  return this.find({
    isDeleted: false,
    $or: [{ name: regex }, { activeIngredient: regex }, { medicineCode: regex }],
  }).sort({ name: 1 });
};

/**
 * 2. Truy vấn danh sách thuốc hết hàng (quantity === 0)
 */
medicineSchema.statics.findOutOfStock = function () {
  return this.find({ quantity: { $lte: 0 }, isDeleted: false }).sort({ name: 1 });
};

/**
 * 3. Truy vấn danh sách thuốc đã quá hạn sử dụng (expiryDate < now)
 */
medicineSchema.statics.findExpired = function () {
  return this.find({ expiryDate: { $lt: new Date() }, isDeleted: false }).sort({ expiryDate: 1 });
};

/**
 * 4. Truy vấn danh sách thuốc sẵn sàng sử dụng (còn hàng và chưa hết hạn)
 */
medicineSchema.statics.findAvailable = function () {
  return this.find({
    quantity: { $gt: 0 },
    expiryDate: { $gte: new Date() },
    isDeleted: false,
  }).sort({ name: 1 });
};

// Indexes tối ưu hiệu năng
medicineSchema.index({ name: 1, quantity: 1 });
medicineSchema.index({ expiryDate: 1, quantity: 1 });

module.exports = mongoose.models.Medicine || mongoose.model("Medicine", medicineSchema, "medicines");
