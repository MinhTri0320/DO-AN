const mongoose = require("mongoose");

/* =====================================================================
 *  RE-EXAMINATION MODEL (Lịch sử tái khám thú cưng)
 *  Phục vụ Xử lý lịch sử tái khám & API Re-examination History (Nam)
 * ===================================================================== */

const vitalSignsSchema = new mongoose.Schema(
  {
    temperature: { type: mongoose.Schema.Types.Mixed, default: 38.5 }, // Thân nhiệt (°C)
    weight: { type: mongoose.Schema.Types.Mixed, default: 5.0 },       // Cân nặng (kg)
    heartRate: { type: mongoose.Schema.Types.Mixed, default: 110 },    // Nhịp tim (bpm)
    respiratoryRate: { type: mongoose.Schema.Types.Mixed, default: 24 },// Nhịp thở (lần/phút)
    mucousMembranes: { type: String, trim: true, default: "Hồng hào" },
    hydration: { type: String, trim: true, default: "Bình thường" },
  },
  { _id: false }
);

const reExaminationSchema = new mongoose.Schema(
  {
    reExamCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    petId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    petName: { type: String, trim: true, default: "Bé cưng" },
    petSpecies: { type: String, trim: true, default: "Chó" },
    recordCode: { type: String, trim: true, index: true },             // Mã hồ sơ bệnh án gốc cần tái khám
    medicalRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
    },
    appointmentId: { type: String, trim: true },                       // Mã lịch hẹn nếu có
    reExamDate: { type: String, required: true, trim: true },          // Định dạng DD/MM/YYYY
    dateISO: { type: String, trim: true, index: true },                // Định dạng YYYY-MM-DD
    title: { type: String, trim: true, default: "Tái khám theo dõi điều trị" },
    veterinarian: {
      type: String,
      trim: true,
      default: "BS. CKI. Nguyễn Văn Hùng",
    },
    clinicBranch: {
      type: String,
      trim: true,
      default: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    },
    // Đánh giá mức độ phục hồi
    recoveryStatus: {
      type: String,
      trim: true,
      enum: [
        "Hồi phục hoàn toàn",
        "Tiến triển tốt",
        "Cần tiếp tục theo dõi",
        "Tái phát / Chuyển biến xấu",
      ],
      default: "Tiến triển tốt",
      index: true,
    },
    vitalSigns: { type: vitalSignsSchema, default: () => ({}) },
    examinationNotes: { type: String, trim: true },                    // Thông tin & triệu chứng khi tái khám
    treatmentResult: { type: String, trim: true },                     // Kết quả đánh giá điều trị
    doctorAdvice: { type: String, trim: true },                        // Lời dặn dò bác sĩ
    prescriptionCode: { type: String, trim: true },                    // Đơn thuốc mới kê thêm (nếu có)
    nextAppointment: { type: String, trim: true },                     // Lịch hẹn tái khám lần kế tiếp (nếu có)
    status: {
      type: String,
      trim: true,
      enum: ["Đã khám", "Chờ khám", "Đã hủy"],
      default: "Đã khám",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Indexes tối ưu truy vấn
reExaminationSchema.index({ petId: 1, dateISO: -1 });
reExaminationSchema.index({ recordCode: 1, dateISO: -1 });
reExaminationSchema.index({ recoveryStatus: 1 });

reExaminationSchema.statics.listByPet = function (petId) {
  return this.find({ petId, isDeleted: false }).sort({ dateISO: -1, createdAt: -1 }).lean();
};

module.exports =
  mongoose.models.ReExamination ||
  mongoose.model("ReExamination", reExaminationSchema, "reExaminations");
