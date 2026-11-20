const Prescription = require("../models/prescription");
const MedicalRecord = require("../models/medicalRecord");

/**
 * Helper chuẩn hóa ngày ISO (YYYY-MM-DD)
 */
function normalizeDateISO(dateStr, dateISOStr) {
  if (dateISOStr && /^\d{4}-\d{2}-\d{2}$/.test(dateISOStr)) {
    return dateISOStr;
  }
  if (dateStr) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return dateStr.split("/").reverse().join("-");
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

// 1. Lấy danh sách đơn thuốc (GET /api/prescriptions)
const getPrescriptions = async (req, res) => {
  try {
    const { petId, recordCode, status, search } = req.query;
    const filter = { isDeleted: false };

    if (petId) filter.petId = String(petId).trim();
    if (recordCode) filter.recordCode = String(recordCode).trim();
    if (status) filter.status = String(status).trim();

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { prescriptionCode: searchRegex },
        { diagnosis: searchRegex },
        { petName: searchRegex },
        { "medicines.name": searchRegex },
        { "medicines.active": searchRegex },
      ];
    }

    const prescriptions = await Prescription.find(filter)
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn thuốc:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách đơn thuốc." });
  }
};

// 2. Lấy chi tiết đơn thuốc theo ID hoặc mã prescriptionCode (GET /api/prescriptions/:id)
const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { prescriptionCode: id },
      ],
      isDeleted: false,
    }).lean();

    if (!prescription) {
      return res.status(404).json({ message: "Không tìm thấy thông tin đơn thuốc." });
    }

    return res.status(200).json({
      success: true,
      prescription,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết đơn thuốc:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy đơn thuốc." });
  }
};

// 3. Tạo mới đơn thuốc (POST /api/prescriptions)
const createPrescription = async (req, res) => {
  try {
    const data = req.body || {};

    if (!data.petId) {
      return res.status(400).json({ message: "Thiếu mã thú cưng (petId)." });
    }

    const prescriptionCode =
      data.prescriptionCode ||
      data.id ||
      `RX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const dateISO = normalizeDateISO(data.date, data.dateISO);
    const dateFormatted = data.date || new Date().toLocaleDateString("vi-VN");

    // Nếu có recordCode nhưng chưa truyền thông tin thú cưng, tự động lấy từ MedicalRecord
    let petName = data.petName || "Bé cưng";
    let petSpecies = data.petSpecies || "Chó";

    if (data.recordCode && (!data.petName || data.petName === "Bé cưng")) {
      const rec = await MedicalRecord.findOne({ recordCode: data.recordCode }).lean();
      if (rec) {
        petName = rec.petName || petName;
        petSpecies = rec.petSpecies || petSpecies;
      }
    }

    // Chuẩn hóa danh sách thuốc (medicines hoặc prescription)
    const rawMeds = Array.isArray(data.medicines)
      ? data.medicines
      : Array.isArray(data.prescription)
      ? data.prescription
      : [];

    const medicines = rawMeds.map((m) => ({
      name: m.name || "Thuốc điều trị",
      active: m.active || "",
      dosage: m.dosage || "",
      duration: m.duration || "",
      instructions: m.instructions || m.notes || "",
      quantity: m.quantity || "1",
      price: m.price || "",
    }));

    const newPrescription = await Prescription.findOneAndUpdate(
      { prescriptionCode },
      {
        $set: {
          prescriptionCode,
          petId: String(data.petId).trim(),
          petName,
          petSpecies,
          recordCode: data.recordCode ? String(data.recordCode).trim() : undefined,
          medicalRecordId: data.medicalRecordId || undefined,
          date: dateFormatted,
          dateISO,
          title: data.title || "Đơn thuốc điều trị",
          diagnosis: data.diagnosis || data.confirmedDiagnosis || "Theo chỉ định bác sĩ",
          veterinarian: data.veterinarian || "BS. CKI. Nguyễn Văn Hùng",
          clinicBranch: data.clinicBranch || "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
          status: data.status || "Đang sử dụng",
          medicines,
          doctorAdvice: data.doctorAdvice || "Cho bé uống thuốc đúng giờ theo chỉ định.",
          totalCost: data.totalCost || "0đ",
          notes: data.notes || "",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✓ Đã lưu đơn thuốc [${prescriptionCode}] thành công vào MongoDB!`);
    return res.status(201).json({
      success: true,
      message: "Tạo đơn thuốc thành công.",
      prescription: newPrescription,
    });
  } catch (error) {
    console.error("Lỗi tạo đơn thuốc:", error);
    return res.status(500).json({ message: "Không thể lưu thông tin đơn thuốc." });
  }
};

// 4. Cập nhật đơn thuốc (PUT /api/prescriptions/:id)
const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};

    if (data.date || data.dateISO) {
      data.dateISO = normalizeDateISO(data.date, data.dateISO);
    }

    const updated = await Prescription.findOneAndUpdate(
      {
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
          { prescriptionCode: id },
        ],
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy đơn thuốc để cập nhật." });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật đơn thuốc thành công.",
      prescription: updated,
    });
  } catch (error) {
    console.error("Lỗi cập nhật đơn thuốc:", error);
    return res.status(500).json({ message: "Không thể cập nhật đơn thuốc." });
  }
};

// 5. Xóa mềm đơn thuốc (DELETE /api/prescriptions/:id)
const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Prescription.findOneAndUpdate(
      {
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
          { prescriptionCode: id },
        ],
      },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy đơn thuốc để xóa." });
    }

    return res.status(200).json({
      success: true,
      message: "Đã xóa đơn thuốc thành công.",
    });
  } catch (error) {
    console.error("Lỗi xóa đơn thuốc:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi xóa đơn thuốc." });
  }
};

// 6. Lấy toàn bộ đơn thuốc theo petId (GET /api/pets/:petId/prescriptions)
const getPrescriptionsByPet = async (req, res) => {
  try {
    const { petId } = req.params;
    const prescriptions = await Prescription.find({
      petId,
      isDeleted: false,
    })
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions,
    });
  } catch (error) {
    console.error("Lỗi lấy đơn thuốc của thú cưng:", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

module.exports = {
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  deletePrescription,
  getPrescriptionsByPet,
};
