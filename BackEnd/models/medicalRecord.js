const mongoose = require("mongoose");

/* =====================================================================
 *  MEDICAL RECORD MODEL (Hồ sơ bệnh án điện tử thú cưng)
 *  Phục vụ Sprint 3 - Task: Medical Record (Trần Minh Trí phụ trách DataBase)
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

const testResultSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    sample: { type: String, trim: true },
    result: { type: String, trim: true },
    status: {
      type: String,
      default: "Bình thường",
    },
  },
  { _id: false }
);

const prescriptionItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    active: { type: String, trim: true },
    dosage: { type: String, trim: true },
    duration: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
  {
    recordCode: {
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
    petBreed: { type: String, trim: true },
    date: { type: String, required: true, trim: true },      // Định dạng DD/MM/YYYY hoặc chuỗi ngày
    dateISO: { type: String, trim: true, index: true },      // Định dạng YYYY-MM-DD
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      trim: true,
      default: "Khám tổng quát",
    },
    status: {
      type: String,
      trim: true,
      default: "Đang điều trị",
      index: true,
    },
    veterinarian: { type: String, trim: true, default: "BS. CKI. Nguyễn Văn Hùng" },
    clinicBranch: {
      type: String,
      trim: true,
      default: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    },
    reason: { type: String, trim: true },
    vitalSigns: { type: vitalSignsSchema, default: () => ({}) },
    symptoms: [{ type: String, trim: true }],
    preliminaryDiagnosis: { type: String, trim: true },
    confirmedDiagnosis: { type: String, trim: true },
    testResults: [testResultSchema],
    prescription: [prescriptionItemSchema],
    doctorAdvice: { type: String, trim: true },
    nextAppointment: { type: String, trim: true },
    totalCost: { type: String, trim: true, default: "250.000đ" },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Indexes
medicalRecordSchema.index({ petId: 1, dateISO: -1 });
medicalRecordSchema.index({ category: 1, status: 1 });

// Statics / Helpers
medicalRecordSchema.statics.listByPet = function (petId) {
  return this.find({ petId, isDeleted: false }).sort({ createdAt: -1 }).lean();
};

module.exports =
  mongoose.models.MedicalRecord ||
  mongoose.model("MedicalRecord", medicalRecordSchema, "medicalRecords");
