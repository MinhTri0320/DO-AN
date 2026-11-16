const mongoose = require("mongoose");

/* =====================================================================
 *  MEDICAL RECORD MODEL (Hồ sơ bệnh án điện tử thú cưng)
 *  Phục vụ Sprint 3 - Task: Medical Record (Trần Minh Trí phụ trách DataBase)
 * ===================================================================== */

const vitalSignsSchema = new mongoose.Schema(
  {
    temperature: { type: Number, required: true }, // Thân nhiệt (°C)
    weight: { type: Number, required: true },      // Cân nặng (kg)
    heartRate: { type: Number },                   // Nhịp tim (bpm)
    respiratoryRate: { type: Number },             // Nhịp thở (lần/phút)
    mucousMembranes: { type: String, trim: true, default: "Hồng hào" },
    hydration: { type: String, trim: true, default: "Bình thường" },
  },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sample: { type: String, trim: true },
    result: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Bình thường", "Bất thường", "Cần theo dõi", "Nghi ngờ"],
      default: "Bình thường",
    },
  },
  { _id: false }
);

const prescriptionItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: String, trim: true },
    dosage: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
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
      match: [/^MED-\d{4}-\d{3,}$/, "Mã bệnh án không đúng định dạng (vd: MED-2026-001)"],
    },
    petId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    petName: { type: String, required: true, trim: true },
    petSpecies: { type: String, trim: true, default: "Chó" },
    petBreed: { type: String, trim: true },
    date: { type: String, required: true, trim: true },      // Định dạng DD/MM/YYYY
    dateISO: { type: String, required: true, trim: true },   // Định dạng YYYY-MM-DD
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "Da liễu",
        "Tiêu hóa",
        "Tiêm chủng",
        "Tiết niệu",
        "Hô hấp",
        "Ngoại khoa",
        "Cơ xương khớp",
        "Mắt - Tai - Mũi",
        "Nội khoa tổng quát",
        "Khác",
      ],
      default: "Nội khoa tổng quát",
    },
    status: {
      type: String,
      enum: ["Đang điều trị", "Đã hoàn thành", "Chờ tái khám", "Đã hủy"],
      default: "Đang điều trị",
      index: true,
    },
    veterinarian: { type: String, required: true, trim: true },
    clinicBranch: {
      type: String,
      trim: true,
      default: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    },
    reason: { type: String, trim: true },
    vitalSigns: { type: vitalSignsSchema, required: true },
    symptoms: [{ type: String, trim: true }],
    preliminaryDiagnosis: { type: String, trim: true },
    confirmedDiagnosis: { type: String, required: true, trim: true },
    testResults: [testResultSchema],
    prescription: [prescriptionItemSchema],
    doctorAdvice: { type: String, trim: true },
    nextAppointment: { type: String, trim: true },
    totalCost: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/* =====================================================================
 *  INDEXES (Tối ưu hiệu năng truy vấn)
 * ===================================================================== */
// Tra cứu lịch sử khám bệnh theo thú cưng từ mới nhất đến cũ nhất
medicalRecordSchema.index({ petId: 1, dateISO: -1 });

// Lọc theo chuyên khoa và trạng thái điều trị
medicalRecordSchema.index({ category: 1, status: 1 });

// Tìm kiếm toàn văn (Full-Text Search) trên tiêu đề, chẩn đoán và triệu chứng
medicalRecordSchema.index(
  {
    title: "text",
    confirmedDiagnosis: "text",
    preliminaryDiagnosis: "text",
    symptoms: "text",
  },
  { default_language: "none" }
);

/* =====================================================================
 *  STATICS METHODS (Hàm nghiệp vụ hỗ trợ truy vấn nhanh)
 * ===================================================================== */

// 1. Lấy danh sách bệnh án của một thú cưng
medicalRecordSchema.statics.listByPet = function (petId) {
  return this.find({ petId, isDeleted: false }).sort({ dateISO: -1 }).lean();
};

// 2. Lấy dữ liệu biến thiên cân nặng (phục vụ biểu đồ thể trạng)
medicalRecordSchema.statics.getWeightTrend = function (petId) {
  return this.aggregate([
    { $match: { petId, isDeleted: false, "vitalSigns.weight": { $exists: true } } },
    { $sort: { dateISO: 1 } },
    {
      $project: {
        _id: 0,
        date: "$date",
        dateISO: "$dateISO",
        weightKg: "$vitalSigns.weight",
        temperature: "$vitalSigns.temperature",
        title: "$title",
      },
    },
  ]);
};

// 3. Thống kê theo chuyên khoa và tỷ lệ điều trị khỏi
medicalRecordSchema.statics.getCategoryStats = function () {
  return this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "Đã hoàn thành"] }, 1, 0] },
        },
        ongoing: {
          $sum: { $cond: [{ $eq: ["$status", "Đang điều trị"] }, 1, 0] },
        },
      },
    },
    { $sort: { total: -1 } },
  ]);
};

module.exports =
  mongoose.models.MedicalRecord ||
  mongoose.model("MedicalRecord", medicalRecordSchema, "medicalRecords");
