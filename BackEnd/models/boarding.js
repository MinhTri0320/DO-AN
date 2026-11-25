const mongoose = require("mongoose");

/* =====================================================================
 *  BOARDING MODEL (Lưu chuồng & Check-in / Check-out thú cưng)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin Check-in: customerId, petId, cageId, checkInDate,
 *    expectedCheckOutDate, belongings, healthNote, status
 *  - Lưu thông tin Check-out: actualCheckOutDate, checkOutHealthNote,
 *    totalDays, totalAmount, cập nhật status (Trí)
 *  - Truy vấn lịch sử lưu chuồng: theo khách, theo thú cưng, theo khoảng ngày (Trí)
 * ===================================================================== */

const boardingSchema = new mongoose.Schema(
  {
    boardingCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Khách hàng gửi thú cưng
    customerId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User",
      required: [true, "Mã khách hàng (customerId) là bắt buộc"],
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    // Thú cưng được nhận gửi
    petId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Pet",
      required: [true, "Mã thú cưng (petId) là bắt buộc"],
      index: true,
    },
    petName: {
      type: String,
      trim: true,
      default: "Bé cưng",
    },
    petSpecies: {
      type: String,
      trim: true,
      default: "Chó",
    },
    // Chuồng lưu trú
    cageId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Cage",
      required: [true, "Mã chuồng (cageId) là bắt buộc"],
      index: true,
    },
    cageCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    // Ngày giờ nhận thú cưng vào chuồng
    checkInDate: {
      type: Date,
      required: [true, "Ngày nhận (checkInDate) là bắt buộc"],
      default: Date.now,
      index: true,
    },
    // Ngày giờ dự kiến trả thú cưng
    expectedCheckOutDate: {
      type: Date,
      required: [true, "Ngày dự kiến trả (expectedCheckOutDate) là bắt buộc"],
      index: true,
    },
    // Ngày giờ trả thực tế (Check-out)
    actualCheckOutDate: {
      type: Date,
      default: null,
      index: true,
    },
    // Đồ mang theo lúc nhận (ví dụ chăn, đồ chơi, thức ăn, phụ kiện)
    belongings: {
      type: String,
      trim: true,
      default: "Không có đồ đạc mang theo",
    },
    // Tình trạng sức khỏe thú cưng lúc nhận
    healthNote: {
      type: String,
      trim: true,
      default: "Sức khỏe bình thường, lanh lợi, không có vết thương ngoài da",
    },
    // Tình trạng sức khỏe thú cưng lúc trả (Check-out)
    checkOutHealthNote: {
      type: String,
      trim: true,
      default: "",
    },
    // Đơn giá chuồng theo ngày tại thời điểm lưu (VNĐ)
    dailyPrice: {
      type: Number,
      min: 0,
      default: 150000,
    },
    // Tổng số ngày lưu thực tế (tối thiểu 1 ngày)
    totalDays: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Tổng chi phí thực tế dùng cho hóa đơn (totalDays * dailyPrice)
    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Tổng chi phí dự kiến tính lúc check-in
    estimatedTotalCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Trạng thái lượt lưu chuồng: checked_in (đang lưu), checked_out (đã trả), cancelled (đã hủy)
    status: {
      type: String,
      trim: true,
      enum: {
        values: ["checked_in", "checked_out", "cancelled"],
        message: "Trạng thái phải là checked_in, checked_out hoặc cancelled",
      },
      default: "checked_in",
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

// Virtual aliases tương thích với frontend
boardingSchema.virtual("totalFee").get(function () {
  return this.totalAmount;
}).set(function (val) {
  this.totalAmount = val;
});

boardingSchema.virtual("checkoutHealthNote").get(function () {
  return this.checkOutHealthNote;
}).set(function (val) {
  this.checkOutHealthNote = val;
});

boardingSchema.virtual("code").get(function () {
  return this.boardingCode;
}).set(function (val) {
  this.boardingCode = val;
});

boardingSchema.virtual("pricePerDay").get(function () {
  return this.dailyPrice;
}).set(function (val) {
  this.dailyPrice = val;
});

// Tự động sinh mã boardingCode nếu chưa có
boardingSchema.pre("save", function () {
  if (!this.boardingCode) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.boardingCode = `BRD-${new Date().getFullYear()}-${randomNum}`;
  }
  // Ràng buộc nghiệp vụ: Ngày dự kiến trả phải sau ngày nhận
  if (this.checkInDate && this.expectedCheckOutDate) {
    if (new Date(this.expectedCheckOutDate) <= new Date(this.checkInDate)) {
      throw new Error(
        "Ngày dự kiến trả (expectedCheckOutDate) phải sau ngày nhận (checkInDate)!"
      );
    }
  }
});

// =====================================================================
//  CÁC PHƯƠNG THỨC LƯU & XỬ LÝ CHECK-IN (PET CHECK-IN - TRÍ)
// =====================================================================

/**
 * Hàm nghiệp vụ Check-in: Tiếp nhận thú cưng vào chuồng
 * Kiểm tra các ràng buộc nghiệp vụ:
 * 1. Thú cưng phải thuộc về khách hàng đã chọn
 * 2. Chuồng phải có trạng thái "available"
 * 3. Thú cưng không được đang lưu ở chuồng khác
 * 4. Ngày dự kiến trả phải sau ngày nhận
 * 5. Check-in thành công: tạo Boarding "checked_in" và tự động chuyển chuồng sang "occupied"
 */
boardingSchema.statics.performCheckIn = async function ({
  customerId,
  petId,
  cageId,
  checkInDate = new Date(),
  expectedCheckOutDate,
  belongings = "",
  healthNote = "",
  notes = "",
}) {
  const Pet = mongoose.model("Pet");
  const Cage = mongoose.model("Cage");
  const User = mongoose.model("User");

  // 1. Kiểm tra ngày dự kiến trả
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(expectedCheckOutDate);
  if (isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    throw new Error("Ngày dự kiến trả phải sau ngày nhận!");
  }

  // 2. Kiểm tra thú cưng tồn tại & có thuộc khách hàng đã chọn không
  const isPetObjectId = mongoose.Types.ObjectId.isValid(petId);
  const pet = await Pet.findOne({
    $or: [
      { _id: isPetObjectId ? petId : null },
      { name: String(petId).trim() },
    ],
  }).lean();
  if (!pet) {
    throw new Error("Không tìm thấy thông tin thú cưng!");
  }

  // Lấy thông tin khách hàng
  const isUserObjectId = mongoose.Types.ObjectId.isValid(customerId);
  const user = await User.findOne({
    $or: [
      { _id: isUserObjectId ? customerId : null },
      { phone: String(customerId).trim() },
    ],
  }).lean();

  const userIdentifier = user ? String(user._id) : String(customerId);
  if (String(pet.ownerId) !== userIdentifier && String(pet.ownerId) !== String(customerId)) {
    throw new Error("Thú cưng không thuộc về khách hàng đã chọn!");
  }

  const customerName = user ? (user.fullName || user.name || "Khách hàng") : "Khách hàng";
  const customerPhone = user ? (user.phone || "") : "";

  // 3. Kiểm tra thú cưng có đang lưu ở chuồng khác không
  const existingActive = await this.findOne({
    $or: [
      { petId: pet._id },
      { petId: String(pet._id) },
      { petId: String(petId) },
    ],
    status: "checked_in",
    isDeleted: false,
  }).lean();
  if (existingActive) {
    throw new Error(
      `Thú cưng "${pet.name}" hiện đang lưu ở chuồng khác (Mã lượt lưu: ${existingActive.boardingCode}), không thể tiếp tục check-in!`
    );
  }

  // 4. Kiểm tra chuồng có trạng thái "available" không
  const isCageObjectId = mongoose.Types.ObjectId.isValid(cageId);
  const cage = await Cage.findOne({
    $or: [
      { _id: isCageObjectId ? cageId : null },
      { cageCode: String(cageId).trim().toUpperCase() },
    ],
    isDeleted: false,
  });
  if (!cage) {
    throw new Error("Không tìm thấy chuồng lưu trú được chọn!");
  }
  if (cage.status !== "available") {
    throw new Error(
      `Chuồng [${cage.cageCode}] hiện không khả dụng (Trạng thái hiện tại: ${cage.status}). Vui lòng chọn chuồng trống (available)!`
    );
  }

  // 5. Tính số ngày & chi phí ước tính
  const diffDays = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
  const dailyPrice = cage.pricePerDay || 150000;
  const estimatedTotalCost = diffDays * dailyPrice;

  const randomNum = Math.floor(100 + Math.random() * 900);
  const boardingCode = `BRD-${new Date().getFullYear()}-${randomNum}`;

  // 6. Tạo lượt lưu chuồng Boarding mới
  const newBoarding = await this.create({
    boardingCode,
    customerId: user ? user._id : customerId,
    customerName,
    customerPhone,
    petId: pet._id,
    petName: pet.name,
    petSpecies: pet.species || "Chó",
    cageId: cage._id,
    cageCode: cage.cageCode,
    checkInDate: checkIn,
    expectedCheckOutDate: checkOut,
    belongings: belongings || "Không có đồ đạc mang theo",
    healthNote: healthNote || "Sức khỏe ổn định, lanh lợi",
    status: "checked_in",
    dailyPrice,
    estimatedTotalCost,
    notes,
  });

  // 7. Tự động cập nhật chuồng sang "occupied"
  await cage.checkIn(pet._id, pet.name, checkOut);

  return newBoarding;
};

// =====================================================================
//  CÁC PHƯƠNG THỨC LƯU & XỬ LÝ CHECK-OUT (PET CHECK-OUT - TRÍ)
// =====================================================================

/**
 * Hàm nghiệp vụ Check-out: Trả thú cưng cho khách khi kết thúc lưu chuồng
 * Nghiệp vụ đáp ứng:
 * 1. Chỉ lượt đang checked_in mới check-out được, từ chối nếu check-out lặp
 * 2. Lưu actualCheckOutDate, checkOutHealthNote
 * 3. Tự tính số ngày lưu: totalDays (số ngày thực tế, tối thiểu 1 ngày)
 * 4. Tự tính tổng tiền: totalAmount = totalDays * dailyPrice (dùng cho hóa đơn)
 * 5. Cập nhật status sang "checked_out"
 * 6. Chuồng tự chuyển về "available"
 */
boardingSchema.methods.performCheckOut = async function ({
  actualCheckOutDate = new Date(),
  checkOutHealthNote = "",
  notes = "",
} = {}) {
  // Chỉ lượt đang checked_in mới check-out được và không check-out hai lần
  if (this.status !== "checked_in") {
    throw new Error(
      `Không thể check-out: Lượt lưu chuồng [${this.boardingCode}] hiện ở trạng thái "${this.status}" (không phải "checked_in") hoặc đã được check-out trước đó!`
    );
  }

  const checkIn = new Date(this.checkInDate);
  const checkOut = new Date(actualCheckOutDate);

  // Tự tính số ngày lưu: tối thiểu 1 ngày
  const diffTime = checkOut.getTime() - checkIn.getTime();
  const rawDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const totalDays = Math.max(1, rawDays);

  // Tự tính tổng tiền: số ngày x giá chuồng
  const pricePerDay = this.dailyPrice || 150000;
  const totalAmount = totalDays * pricePerDay;

  // Cập nhật thông tin Check-out
  this.actualCheckOutDate = checkOut;
  this.checkOutHealthNote =
    checkOutHealthNote || "Sức khỏe tốt, tinh thần lanh lợi khi bàn giao lại cho khách";
  this.totalDays = totalDays;
  this.totalAmount = totalAmount;
  this.status = "checked_out";

  if (notes) {
    this.notes = (this.notes ? this.notes + "\n" : "") + `[Ghi chú trả thú cưng]: ${notes}`;
  }

  await this.save();

  // Chuồng tự chuyển về "available"
  const Cage = mongoose.model("Cage");
  const isCageObjectId = mongoose.Types.ObjectId.isValid(this.cageId);
  const cage = await Cage.findOne({
    $or: [
      { _id: isCageObjectId ? this.cageId : null },
      { cageCode: String(this.cageCode || this.cageId).trim().toUpperCase() },
    ],
  });
  if (cage) {
    await cage.checkOut();
  }

  return this;
};

/**
 * Static Helper: Check-out theo ID hoặc mã boardingCode
 */
boardingSchema.statics.checkOutById = async function (idOrCode, options = {}) {
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrCode);
  const boarding = await this.findOne({
    $or: [
      { _id: isObjectId ? new mongoose.Types.ObjectId(idOrCode) : null },
      { boardingCode: String(idOrCode).trim().toUpperCase() },
    ],
    isDeleted: false,
  });

  if (!boarding) {
    throw new Error(`Không tìm thấy lượt lưu chuồng với mã hoặc ID: ${idOrCode}`);
  }

  return boarding.performCheckOut(options);
};

function buildMixedIdMatch(id) {
  const idStr = String(id);
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    return { $in: [idStr, new mongoose.Types.ObjectId(idStr)] };
  }
  return idStr;
}

function parseEndDate(dateVal) {
  if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    const d = new Date(dateVal.trim());
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }
  return new Date(dateVal);
}

// =====================================================================
//  CÁC PHƯƠNG THỨC TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE QUERY METHODS - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn danh sách thú cưng ĐANG LƯU CHUỒNG (status: "checked_in")
 */
boardingSchema.statics.findActiveBoardings = function () {
  return this.find({ status: "checked_in", isDeleted: false })
    .populate("customerId", "name phone")
    .populate("petId", "name species breed weight avatar")
    .populate("cageId", "cageCode size pricePerDay status")
    .sort({ checkInDate: -1 });
};

/**
 * 2. Truy vấn lịch sử lưu chuồng (các lượt đã checked_out)
 * Có thể lọc theo khách, theo thú cưng, theo khoảng ngày (fromDate -> toDate)
 */
boardingSchema.statics.findHistory = function ({
  customerId,
  petId,
  fromDate,
  toDate,
} = {}) {
  const query = { status: "checked_out", isDeleted: false };

  if (customerId) query.customerId = buildMixedIdMatch(customerId);
  if (petId) query.petId = buildMixedIdMatch(petId);

  if (fromDate || toDate) {
    query.actualCheckOutDate = {};
    if (fromDate) query.actualCheckOutDate.$gte = new Date(fromDate);
    if (toDate) query.actualCheckOutDate.$lte = parseEndDate(toDate);
  }

  return this.find(query)
    .populate("customerId", "name phone")
    .populate("petId", "name species breed weight avatar")
    .populate("cageId", "cageCode size pricePerDay")
    .sort({ actualCheckOutDate: -1, checkInDate: -1 });
};

/**
 * 3. Truy vấn danh sách lưu chuồng THEO KHÁCH HÀNG (customerId)
 */
boardingSchema.statics.findByCustomer = function (customerId, status = null) {
  const query = { customerId: buildMixedIdMatch(customerId), isDeleted: false };
  if (status) query.status = status;

  return this.find(query)
    .populate("petId", "name species breed")
    .populate("cageId", "cageCode size pricePerDay")
    .sort({ checkInDate: -1 });
};

/**
 * 4. Truy vấn danh sách lưu chuồng THEO THÚ CƯNG (petId)
 */
boardingSchema.statics.findByPet = function (petId, status = null) {
  const query = { petId: buildMixedIdMatch(petId), isDeleted: false };
  if (status) query.status = status;

  return this.find(query)
    .populate("customerId", "name phone")
    .populate("cageId", "cageCode size pricePerDay")
    .sort({ checkInDate: -1 });
};

/**
 * 5. Truy vấn lịch sử lưu chuồng theo khoảng ngày nhận hoặc ngày trả
 */
boardingSchema.statics.findByDateRange = function (fromDate, toDate) {
  const query = { isDeleted: false };
  if (fromDate || toDate) {
    query.checkInDate = {};
    if (fromDate) query.checkInDate.$gte = new Date(fromDate);
    if (toDate) query.checkInDate.$lte = parseEndDate(toDate);
  }
  return this.find(query)
    .populate("customerId", "name phone")
    .populate("petId", "name species")
    .populate("cageId", "cageCode size")
    .sort({ checkInDate: -1 });
};

// Indexes tối ưu truy vấn
boardingSchema.index({ status: 1, checkInDate: -1 });
boardingSchema.index({ status: 1, actualCheckOutDate: -1 });
boardingSchema.index({ customerId: 1, status: 1 });
boardingSchema.index({ petId: 1, status: 1 });
boardingSchema.index({ cageId: 1, status: 1 });

module.exports = mongoose.models.Boarding || mongoose.model("Boarding", boardingSchema, "boardings");
