const mongoose = require("mongoose");

/* =====================================================================
 *  ROLE MODEL (Bảng danh mục định nghĩa vai trò người dùng trong MongoDB)
 *  1: Quản trị viên (Admin)
 *  2: Bác sĩ thú y (Doctor)
 *  3: Nhân viên lễ tân (Receptionist)
 *  4: Chủ thú cưng / Khách hàng (Pet Owner)
 * ===================================================================== */

const roleSchema = new mongoose.Schema(
  {
    role_id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

/**
 * Danh mục vai trò mặc định
 */
roleSchema.statics.DEFAULT_ROLES = [
  {
    role_id: 1,
    code: "admin",
    name: "Quản trị viên",
    description: "Toàn quyền quản lý phân quyền người dùng trong hệ thống",
  },
  {
    role_id: 2,
    code: "doctor",
    name: "Bác sĩ thú y",
    description: "Quản lý lịch hẹn cá nhân, phiếu khám cá nhân và tra cứu hồ sơ bệnh án thú cưng",
  },
  {
    role_id: 3,
    code: "receptionist",
    name: "Nhân viên lễ tân",
    description: "Quản lý lịch khám toàn viện, thu ngân hóa đơn, cấp thuốc và kho dược",
  },
  {
    role_id: 4,
    code: "pet_owner",
    name: "Khách hàng",
    description: "Xem hồ sơ thú cưng, đặt lịch và quản lý hóa đơn cá nhân",
  },
];

/**
 * Đảm bảo các vai trò mặc định luôn tồn tại trong MongoDB
 */
roleSchema.statics.seedDefaultRoles = async function () {
  for (const r of this.DEFAULT_ROLES) {
    await this.findOneAndUpdate(
      { role_id: r.role_id },
      { $setOnInsert: r },
      { upsert: true, returnDocument: "after" }
    );
  }
};

module.exports = mongoose.model("Role", roleSchema);
