const mongoose = require("mongoose");

/* =====================================================================
 *  PRESCRIPTION MODEL (Đơn thuốc thú cưng)
 *  Phục vụ Quản lý thông tin đơn thuốc & API Prescription (Nam)
 * ===================================================================== */

const medicineItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },       // Tên biệt dược / thuốc
    active: { type: String, trim: true },                     // Hoạt chất
    dosage: { type: String, trim: true },                     // Liều dùng (vd: 1 viên x 2 lần/ngày)
    duration: { type: String, trim: true },                   // Liệu trình (vd: 7 ngày)
    instructions: { type: String, trim: true },               // Hướng dẫn sử dụng / lưu ý
    quantity: { type: String, trim: true },                   // Số lượng (vd: 14 viên, 1 lọ)
    price: { type: String, trim: true },                      // Đơn giá / thành tiền nếu có
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionCode: {
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
    recordCode: { type: String, trim: true, index: true },    // Liên kết mã bệnh án (nếu có)
    medicalRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
    },
    date: { type: String, required: true, trim: true },        // Định dạng DD/MM/YYYY
    dateISO: { type: String, trim: true, index: true },        // Định dạng YYYY-MM-DD
    title: { type: String, trim: true, default: "Đơn thuốc điều trị" },
    diagnosis: { type: String, trim: true },                   // Chẩn đoán bệnh
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
    status: {
      type: String,
      trim: true,
      enum: ["Đang sử dụng", "Đã hoàn thành", "Đã ngưng"],
      default: "Đang sử dụng",
      index: true,
    },
    medicines: [medicineItemSchema],                          // Danh mục các loại thuốc
    doctorAdvice: { type: String, trim: true },               // Lời dặn dò của bác sĩ
    totalCost: { type: String, trim: true, default: "0đ" },
    notes: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Indexes tối ưu truy vấn
prescriptionSchema.index({ petId: 1, dateISO: -1 });
prescriptionSchema.index({ recordCode: 1, status: 1 });

prescriptionSchema.statics.listByPet = function (petId) {
  return this.find({ petId, isDeleted: false }).sort({ dateISO: -1, createdAt: -1 }).lean();
};

module.exports =
  mongoose.models.Prescription ||
  mongoose.model("Prescription", prescriptionSchema, "prescriptions");
