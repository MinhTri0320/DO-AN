const mongoose = require("mongoose");

/* =====================================================================
 *  CAGE MODEL (Quản lý chuồng lưu trú thú cưng - Cage List & Status)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin Cage: mã chuồng, kích cỡ, giá/ngày, trạng thái
 *  - Truy vấn Cage: theo trạng thái, theo kích cỡ, chuồng trống
 * ===================================================================== */

const cageSchema = new mongoose.Schema(
  {
    cageCode: {
      type: String,
      required: [true, "Mã chuồng là bắt buộc"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Loại / kích cỡ chuồng: nhỏ, vừa, lớn
    size: {
      type: String,
      required: [true, "Kích cỡ chuồng là bắt buộc"],
      trim: true,
      enum: {
        values: ["nhỏ", "vừa", "lớn", "Small", "Medium", "Large"],
        message: "Kích cỡ chuồng phải là nhỏ, vừa hoặc lớn",
      },
      default: "vừa",
      index: true,
    },
    // Giá theo ngày (VNĐ)
    pricePerDay: {
      type: Number,
      required: [true, "Giá theo ngày là bắt buộc"],
      min: [0, "Giá theo ngày không được âm"],
      default: 150000,
    },
    // Trạng thái chuồng: available (trống), occupied (đang dùng), maintenance (bảo trì)
    status: {
      type: String,
      trim: true,
      enum: {
        values: ["available", "occupied", "maintenance"],
        message: "Trạng thái chuồng phải là available, occupied hoặc maintenance",
      },
      default: "available",
      index: true,
    },
    // Thông tin thú cưng lưu trú hiện tại (khi occupied)
    currentPetId: {
      type: String,
      trim: true,
      default: null,
    },
    currentPetName: {
      type: String,
      trim: true,
      default: null,
    },
    checkInDate: {
      type: Date,
      default: null,
    },
    checkOutDate: {
      type: Date,
      default: null,
    },
    // Ghi chú cơ sở vật chất / tình trạng chuồng
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    // Cờ xóa mềm (soft delete)
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

// Virtual alias cho dailyPrice tương thích
cageSchema.virtual("dailyPrice").get(function () {
  return this.pricePerDay;
}).set(function (val) {
  this.pricePerDay = val;
});

// Middleware: Ngăn xóa chuồng đang occupied (đang dùng) theo nghiệp vụ Sprint 4
cageSchema.pre("deleteOne", { document: true, query: false }, function (next) {
  if (this.status === "occupied") {
    return next(new Error("Chuồng đang có thú cưng lưu trú (occupied), không được phép xóa!"));
  }
  next();
});

cageSchema.pre("findOneAndDelete", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc && doc.status === "occupied") {
    return next(new Error("Chuồng đang có thú cưng lưu trú (occupied), không được phép xóa!"));
  }
  next();
});

// =====================================================================
//  CÁC PHƯƠNG THỨC TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE QUERY METHODS - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn danh sách chuồng theo trạng thái (available, occupied, maintenance)
 */
cageSchema.statics.findByStatus = function (status) {
  const filter = { isDeleted: false };
  if (status) filter.status = status;
  return this.find(filter).sort({ cageCode: 1 });
};

/**
 * 2. Truy vấn danh sách chuồng theo kích cỡ (nhỏ, vừa, lớn)
 */
cageSchema.statics.findBySize = function (size) {
  const filter = { isDeleted: false };
  if (size) filter.size = size;
  return this.find(filter).sort({ cageCode: 1 });
};

/**
 * 3. Truy vấn danh sách chuồng TRỐNG (available) để sẵn sàng nhận Check-in
 */
cageSchema.statics.findAvailable = function (size = null) {
  const filter = { status: "available", isDeleted: false };
  if (size) filter.size = size;
  return this.find(filter).sort({ pricePerDay: 1, cageCode: 1 });
};

/**
 * 4. Truy vấn bộ lọc kết hợp (theo trạng thái, kích cỡ, khoảng giá)
 */
cageSchema.statics.filterCages = function ({ status, size, minPrice, maxPrice }) {
  const filter = { isDeleted: false };
  if (status) filter.status = status;
  if (size) filter.size = size;
  if (minPrice != null || maxPrice != null) {
    filter.pricePerDay = {};
    if (minPrice != null) filter.pricePerDay.$gte = Number(minPrice);
    if (maxPrice != null) filter.pricePerDay.$lte = Number(maxPrice);
  }
  return this.find(filter).sort({ cageCode: 1 });
};

// =====================================================================
//  CÁC PHƯƠNG THỨC LƯU & CẬP NHẬT TRẠNG THÁI (DATABASE UPDATE METHODS - TRÍ)
// =====================================================================

/**
 * Check-in thú cưng vào chuồng: tự động chuyển sang "occupied"
 */
cageSchema.methods.checkIn = function (petId, petName, checkOutDate = null) {
  if (this.status !== "available") {
    throw new Error(`Chuồng ${this.cageCode} hiện không trống (trạng thái: ${this.status})`);
  }
  this.status = "occupied";
  this.currentPetId = String(petId);
  this.currentPetName = petName || "Thú cưng";
  this.checkInDate = new Date();
  this.checkOutDate = checkOutDate ? new Date(checkOutDate) : null;
  return this.save();
};

/**
 * Check-out thú cưng khỏi chuồng: tự động chuyển sang "available"
 */
cageSchema.methods.checkOut = function () {
  this.status = "available";
  this.currentPetId = null;
  this.currentPetName = null;
  this.checkInDate = null;
  this.checkOutDate = null;
  return this.save();
};

/**
 * Đặt chuồng sang trạng thái bảo trì hoặc kết thúc bảo trì
 */
cageSchema.methods.setMaintenance = function (isMaintenance = true, notes = "") {
  if (this.status === "occupied") {
    throw new Error(`Chuồng ${this.cageCode} đang có thú cưng, không thể chuyển sang bảo trì`);
  }
  this.status = isMaintenance ? "maintenance" : "available";
  if (notes) this.notes = notes;
  return this.save();
};

// Indexes tối ưu truy vấn theo kích cỡ, trạng thái và giá
cageSchema.index({ status: 1, size: 1 });
cageSchema.index({ size: 1, pricePerDay: 1 });

module.exports = mongoose.models.Cage || mongoose.model("Cage", cageSchema, "cages");
