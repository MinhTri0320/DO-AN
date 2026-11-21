const mongoose = require("mongoose");

/* =====================================================================
 *  DISPENSING MODEL (Quản lý lượt cấp thuốc theo đơn - Medicine Dispensing)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin lượt cấp thuốc: prescriptionId, danh sách thuốc,
 *    người cấp, thời điểm cấp
 *  - Tự động trừ tồn kho (quantity) thuốc trong kho (Medicine)
 *  - Chặn cấp lặp: Mỗi đơn chỉ được cấp một lần để tránh trừ kho hai lần
 *  - Chặn khi thiếu hàng hoặc thuốc hết hạn (báo rõ tên thuốc)
 *  - Truy vấn lượt cấp thuốc theo đơn (Trí)
 * ===================================================================== */

const dispensingItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      trim: true,
      default: "viên",
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Số lượng cấp tối thiểu là 1"],
    },
    price: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const dispensingSchema = new mongoose.Schema(
  {
    dispensingCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Mã đơn thuốc (prescriptionId) hoặc mã tham chiếu đơn
    prescriptionId: {
      type: String,
      required: [true, "Mã đơn thuốc (prescriptionId) là bắt buộc"],
      trim: true,
      index: true,
    },
    prescriptionCode: {
      type: String,
      trim: true,
      index: true,
    },
    // Thông tin thú cưng & chủ nuôi nhận thuốc
    petId: { type: String, trim: true },
    petName: { type: String, trim: true, default: "Bé cưng" },
    customerId: { type: String, trim: true },
    customerName: { type: String, trim: true, default: "Khách hàng" },
    // Danh sách các loại thuốc được cấp
    items: [dispensingItemSchema],
    // Người thực hiện cấp thuốc (dược sĩ / nhân viên phòng khám)
    dispensedBy: {
      type: String,
      required: [true, "Người cấp thuốc (dispensedBy) là bắt buộc"],
      trim: true,
      default: "Dược sĩ PawnCare",
    },
    // Thời điểm cấp thuốc
    dispensedAt: {
      type: Date,
      required: [true, "Thời điểm cấp thuốc (dispensedAt) là bắt buộc"],
      default: Date.now,
      index: true,
    },
    // Tổng giá trị thuốc cấp
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Trạng thái: dispensed (đã cấp), cancelled (đã hủy)
    status: {
      type: String,
      trim: true,
      enum: ["dispensed", "cancelled"],
      default: "dispensed",
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

// Tự động sinh mã dispensingCode nếu chưa có
dispensingSchema.pre("save", function () {
  if (!this.dispensingCode) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.dispensingCode = `DISP-${new Date().getFullYear()}-${randomNum}`;
  }
});

// =====================================================================
//  CÁC PHƯƠNG THỨC NGHIỆP VỤ CẤP THUỐC (DATABASE BUSINESS LOGIC - TRÍ)
// =====================================================================

/**
 * Hàm nghiệp vụ cốt lõi: Cấp thuốc theo đơn
 * Đáp ứng các quy tắc:
 * 1. Chặn cấp lặp: Mỗi đơn chỉ được cấp một lần để tránh trừ kho hai lần
 * 2. Kiểm tra thuốc còn hạn dùng: nếu quá hạn thì từ chối và báo rõ tên thuốc
 * 3. Kiểm tra số lượng tồn kho: nếu thiếu hàng thì từ chối và báo rõ tên thuốc
 * 4. Cấp thành công: tự động trừ quantity trong kho Medicine và lưu bản ghi Dispensing
 */
dispensingSchema.statics.dispensePrescription = async function ({
  prescriptionId,
  items,
  dispensedBy = "Dược sĩ PawnCare",
  dispensedAt = new Date(),
  petId = "",
  petName = "Bé cưng",
  customerId = "",
  customerName = "",
  notes = "",
}) {
  const Medicine = mongoose.model("Medicine");

  // 1. Kiểm tra chặn cấp lặp
  const existing = await this.findOne({
    $or: [{ prescriptionId }, { prescriptionCode: prescriptionId }],
    status: "dispensed",
    isDeleted: false,
  });

  if (existing) {
    throw new Error(
      `Đơn thuốc [${prescriptionId}] đã được cấp trước đó (Mã lượt cấp: ${existing.dispensingCode}) vào lúc ${new Date(existing.dispensedAt).toLocaleString("vi-VN")}. Mỗi đơn chỉ được cấp một lần để tránh trừ kho hai lần!`
    );
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Danh sách thuốc cấp không được để trống!");
  }

  // 2. Kiểm tra tồn kho & hạn dùng của từng thuốc trong đơn
  const now = new Date();
  const checkedMedicines = [];
  let calculatedTotal = 0;

  for (const item of items) {
    const reqQty = Number(item.quantity) || 1;
    const medQuery = { isDeleted: false };

    if (item.medicineId && String(item.medicineId).match(/^[0-9a-fA-F]{24}$/)) {
      medQuery._id = item.medicineId;
    } else {
      medQuery.name = new RegExp(`^${item.medicineName ? item.medicineName.trim() : ""}$`, "i");
    }

    const medicine = await Medicine.findOne(medQuery);

    if (!medicine) {
      throw new Error(`Không tìm thấy thuốc "${item.medicineName || "chưa rõ"}" trong kho dược!`);
    }

    // Kiểm tra hạn sử dụng
    if (medicine.expiryDate && new Date(medicine.expiryDate) < now) {
      const expStr = new Date(medicine.expiryDate).toLocaleDateString("vi-VN");
      throw new Error(`Thuốc "${medicine.name}" đã hết hạn sử dụng (${expStr}), không thể cấp phát!`);
    }

    // Kiểm tra số lượng tồn kho
    if (medicine.quantity < reqQty) {
      throw new Error(
        `Thuốc "${medicine.name}" không đủ số lượng tồn kho (hiện còn ${medicine.quantity} ${medicine.unit}, đơn yêu cầu ${reqQty} ${medicine.unit})!`
      );
    }

    const itemPrice = medicine.price || item.price || 0;
    const itemAmount = reqQty * itemPrice;
    calculatedTotal += itemAmount;

    checkedMedicines.push({
      medicineDoc: medicine,
      itemData: {
        medicineId: medicine._id,
        medicineName: medicine.name,
        unit: medicine.unit,
        quantity: reqQty,
        price: itemPrice,
        amount: itemAmount,
        notes: item.notes || "",
      },
    });
  }

  // 3. Tự động trừ tồn kho (quantity) của từng thuốc
  for (const check of checkedMedicines) {
    await Medicine.updateOne(
      { _id: check.medicineDoc._id },
      { $inc: { quantity: -check.itemData.quantity } }
    );
  }

  // 4. Lưu bản ghi lượt cấp thuốc (Dispensing)
  const randomNum = Math.floor(100 + Math.random() * 900);
  const dispensingCode = `DISP-${new Date().getFullYear()}-${randomNum}`;

  const newDispensing = await this.create({
    dispensingCode,
    prescriptionId,
    prescriptionCode: prescriptionId,
    petId,
    petName,
    customerId,
    customerName,
    items: checkedMedicines.map((c) => c.itemData),
    dispensedBy,
    dispensedAt: new Date(dispensedAt),
    totalAmount: calculatedTotal,
    status: "dispensed",
    notes,
  });

  return newDispensing;
};

// =====================================================================
//  CÁC PHƯƠNG THỨC TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE QUERY - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn danh sách lượt cấp thuốc theo đơn (prescriptionId hoặc prescriptionCode)
 */
dispensingSchema.statics.findByPrescription = function (prescriptionIdOrCode) {
  return this.find({
    $or: [{ prescriptionId: prescriptionIdOrCode }, { prescriptionCode: prescriptionIdOrCode }],
    isDeleted: false,
  })
    .populate("items.medicineId", "name unit price expiryDate")
    .sort({ dispensedAt: -1 });
};

/**
 * 2. Truy vấn danh sách toàn bộ các lượt cấp thuốc (sắp xếp mới nhất)
 */
dispensingSchema.statics.listAll = function () {
  return this.find({ isDeleted: false })
    .populate("items.medicineId", "name unit")
    .sort({ dispensedAt: -1 });
};

/**
 * 3. Truy vấn lượt cấp thuốc theo thú cưng
 */
dispensingSchema.statics.findByPet = function (petId) {
  return this.find({ petId, isDeleted: false }).sort({ dispensedAt: -1 });
};

// Indexes tối ưu hiệu năng
dispensingSchema.index({ prescriptionId: 1, status: 1 });
dispensingSchema.index({ dispensedAt: -1 });

module.exports = mongoose.models.Dispensing || mongoose.model("Dispensing", dispensingSchema, "dispensings");
