const mongoose = require("mongoose");

/* =====================================================================
 *  PET HEALTH PROFILE MODEL (Hồ sơ sức khỏe nền của thú cưng)
 *  Phục vụ Sprint 3 - Task: Medical Record (Trần Minh Trí phụ trách DataBase)
 * ===================================================================== */

const petHealthProfileSchema = new mongoose.Schema(
  {
    petId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    bloodType: {
      type: String,
      required: true,
      trim: true,
    },
    microchip: {
      type: String,
      trim: true,
      sparse: true,
    },
    allergies: {
      type: String,
      trim: true,
      default: "Chưa ghi nhận dị ứng",
    },
    chronicConditions: {
      type: String,
      trim: true,
      default: "Không có bệnh mãn tính",
    },
    sterilized: {
      type: String,
      enum: ["Đã triệt sản", "Chưa triệt sản", "Không rõ"],
      default: "Chưa triệt sản",
    },
    vaccinationStatus: {
      type: String,
      trim: true,
    },
    dewormingStatus: {
      type: String,
      trim: true,
    },
    overallStatus: {
      type: String,
      enum: [
        "Khỏe mạnh",
        "Cần theo dõi",
        "Đang điều trị đặc biệt",
        "Hồi phục sau phẫu thuật",
      ],
      default: "Khỏe mạnh",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PetHealthProfile ||
  mongoose.model(
    "PetHealthProfile",
    petHealthProfileSchema,
    "petHealthProfiles"
  );
