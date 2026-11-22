const mongoose = require("mongoose");

/* =====================================================================
 *  DOCTOR MODEL (Quản lý danh sách bác sĩ thú y)
 *  Phục vụ phân bổ ca khám, phân quyền phiếu khám và lịch hẹn
 * ===================================================================== */

const doctorSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
      index: true,
    },
    role_id: {
      type: Number,
      default: 2, // 2: Bác sĩ thú y
      index: true,
    },
    id_bac_sy: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true, // Format: bs0xxxx (vd: bs00001, bs00002...)
    },
    name: {
      type: String,
      required: [true, "Họ tên bác sĩ là bắt buộc"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Số điện thoại bác sĩ là bắt buộc"],
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    specialty: {
      type: String,
      trim: true,
      default: "Bác sĩ Thú y Đa khoa",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * Hàm sinh id_bac_sy tiếp theo dạng bs0xxxx tăng dần
 */
doctorSchema.statics.getNextDoctorId = async function () {
  const lastDoc = await this.findOne().sort({ order: -1 }).lean();
  const nextOrder = lastDoc ? lastDoc.order + 1 : 1;
  const idStr = String(nextOrder).padStart(4, "0");
  const id_bac_sy = `bs0${idStr}`;
  return { nextOrder, id_bac_sy };
};

/**
 * Hàm đồng bộ thông tin Bác sĩ từ User khi Admin phân quyền role_id = 2
 */
doctorSchema.statics.syncDoctorFromUser = async function (user) {
  let doc = await this.findOne({ userId: user._id });
  if (doc) {
    doc.name = user.name;
    doc.phone = user.phone;
    doc.isActive = true;
    await doc.save();
    return doc;
  }

  const { nextOrder, id_bac_sy } = await this.getNextDoctorId();
  doc = await this.create({
    order: nextOrder,
    role_id: 2,
    id_bac_sy,
    name: user.name,
    phone: user.phone,
    userId: user._id,
    isActive: true,
  });

  return doc;
};

module.exports = mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema, "doctors");
