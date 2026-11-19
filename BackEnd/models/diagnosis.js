const mongoose = require("mongoose");

/* =====================================================================
 *  DIAGNOSIS MODEL (Quản lý thông tin chẩn đoán bệnh thú cưng)
 *  Phục vụ lưu trữ và theo dõi tình trạng sức khỏe thú cưng qua từng lần khám
 * ===================================================================== */

const vitalSignsSchema = new mongoose.Schema(
  {
    temperature: { type: mongoose.Schema.Types.Mixed, default: 38.5 }, // Thân nhiệt (°C)
    weight: { type: mongoose.Schema.Types.Mixed, default: 5.0 },       // Cân nặng (kg)
    heartRate: { type: mongoose.Schema.Types.Mixed, default: 110 },    // Nhịp tim (bpm)
    respiratoryRate: { type: mongoose.Schema.Types.Mixed, default: 24 },// Nhịp thở (lần/phút)
    mucousMembranes: { type: String, trim: true, default: "Hồng tươi" },
    hydration: { type: String, trim: true, default: "Bình thường" },
  },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },       // Tên xét nghiệm (vd: Soi tươi biểu bì da)
    sample: { type: String, trim: true, default: "Lâm sàng" }, // Mẫu bệnh phẩm (vd: Máu, Biểu bì da)
    result: { type: String, required: true, trim: true },     // Kết quả phân tích y khoa
    status: {
      type: String,
      enum: ["Bình thường", "Bất thường"],
      default: "Bình thường",
    },
    testedAt: { type: String, trim: true },                   // Thời điểm xét nghiệm
    notes: { type: String, trim: true },                      // Ghi chú kỹ thuật viên
  },
  { _id: false }
);

const prescriptionItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },       // Tên thuốc
    active: { type: String, trim: true },                     // Hoạt chất
    dosage: { type: String, trim: true },                     // Liều dùng
    duration: { type: String, trim: true },                   // Thời gian dùng thuốc
    notes: { type: String, trim: true },                      // Hướng dẫn / lưu ý
  },
  { _id: false }
);

const diagnosisSchema = new mongoose.Schema(
  {
    diagnosisCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    recordId: {
      type: String,
      trim: true,
      default: "", // Mã đợt khám / bệnh án liên kết (nếu có)
    },
    petId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    petName: { type: String, trim: true, default: "Bé cưng" },
    petSpecies: { type: String, trim: true, default: "Chó" },
    petBreed: { type: String, trim: true, default: "Chưa rõ" },
    date: { type: String, required: true, trim: true },         // Ngày khám (DD/MM/YYYY)
    dateISO: { type: String, trim: true, index: true },         // YYYY-MM-DD phục vụ sắp xếp thời gian
    category: {
      type: String,
      trim: true,
      default: "Khám tổng quát",
      index: true,
    },
    status: {
      type: String,
      trim: true,
      default: "Đang điều trị",
      enum: ["Đang điều trị", "Đã hoàn thành", "Cần tái khám"],
      index: true,
    },
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
    reason: {
      type: String,
      trim: true,
      default: "Khám định kỳ & kiểm tra sức khỏe",
    },
    symptoms: [{ type: String, trim: true }],                   // Triệu chứng lâm sàng
    vitalSigns: { type: vitalSignsSchema, default: () => ({}) }, // Chỉ số sinh hiệu
    preliminaryDiagnosis: {
      type: String,
      trim: true,
      default: "Chẩn đoán lâm sàng ban đầu",
    },                                                          // Chẩn đoán sơ bộ
    confirmedDiagnosis: {
      type: String,
      required: true,
      trim: true,
    },                                                          // Chẩn đoán xác định từ bác sĩ
    diagnosticSummary: {
      type: String,
      trim: true,
      default: "",
    },                                                          // Tóm tắt kết luận bệnh học
    severity: {
      type: String,
      enum: ["Nhẹ", "Trung bình", "Nặng", "Nguy kịch", "Đang hồi phục"],
      default: "Nhẹ",
    },                                                          // Mức độ nghiêm trọng của bệnh
    testResults: [testResultSchema],                            // Kết quả xét nghiệm & cận lâm sàng
    prescription: [prescriptionItemSchema],                     // Đơn thuốc điều trị chỉ định
    treatmentPlan: {
      type: String,
      trim: true,
      default: "",
    },                                                          // Phác đồ điều trị chi tiết
    doctorAdvice: {
      type: String,
      trim: true,
      default: "Chăm sóc bé cưng và giữ ấm.",
    },                                                          // Lời dặn theo dõi
    nextAppointment: { type: String, trim: true, default: "" }, // Lịch hẹn tái khám
    totalCost: { type: String, trim: true, default: "250.000đ" },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Virtual id tương thích client
diagnosisSchema.virtual("id").get(function () {
  return this.diagnosisCode || (this._id ? this._id.toString() : "");
});
diagnosisSchema.set("toJSON", { virtuals: true });
diagnosisSchema.set("toObject", { virtuals: true });

// Indexes hỗ trợ truy vấn nhanh theo thú cưng và dòng thời gian khám
diagnosisSchema.index({ petId: 1, dateISO: -1 });
diagnosisSchema.index({ recordId: 1 });
diagnosisSchema.index({ category: 1, status: 1 });

module.exports =
  mongoose.models.Diagnosis ||
  mongoose.model("Diagnosis", diagnosisSchema, "diagnoses");
