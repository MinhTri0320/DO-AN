const Diagnosis = require("../models/diagnosis");
const MedicalRecord = require("../models/medicalRecord");
const {
  formatDiagnosis,
  parseDateISO,
  syncWithMedicalRecord,
  analyzePetHealthEvolution,
} = require("../services/diagnosisService");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 1. Lấy danh sách kết quả chẩn đoán bệnh
 * GET /api/diagnoses?petId=...&category=...&status=...&search=...
 */
const getDiagnoses = async (req, res) => {
  try {
    const { petId, recordId, category, status, search } = req.query;
    const filter = { isDeleted: false };

    if (petId) {
      filter.petId = String(petId).trim();
    }
    if (recordId) {
      filter.recordId = String(recordId).trim();
    }
    if (category && category !== "all") {
      filter.category = String(category).trim();
    }
    if (status && status !== "all") {
      filter.status = String(status).trim();
    }
    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");
      filter.$or = [
        { diagnosisCode: regex },
        { confirmedDiagnosis: regex },
        { preliminaryDiagnosis: regex },
        { veterinarian: regex },
        { reason: regex },
      ];
    }

    let items = await Diagnosis.find(filter)
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    // Nếu bảng diagnoses chưa có dữ liệu cho petId này, lấy từ MedicalRecord làm fallback
    if (items.length === 0 && petId) {
      const medFilter = { petId: String(petId).trim(), isDeleted: false };
      const records = await MedicalRecord.find(medFilter)
        .sort({ dateISO: -1, createdAt: -1 })
        .lean();

      if (records.length > 0) {
        items = records.map((r) => ({
          _id: r._id,
          diagnosisCode: `DIAG-${r.recordCode || r._id}`,
          recordId: r.recordCode || String(r._id),
          petId: r.petId,
          petName: r.petName,
          petSpecies: r.petSpecies,
          petBreed: r.petBreed,
          date: r.date,
          dateISO: r.dateISO,
          category: r.category,
          status: r.status,
          veterinarian: r.veterinarian,
          clinicBranch: r.clinicBranch,
          reason: r.reason,
          symptoms: r.symptoms,
          vitalSigns: r.vitalSigns,
          preliminaryDiagnosis: r.preliminaryDiagnosis,
          confirmedDiagnosis: r.confirmedDiagnosis || r.title,
          testResults: r.testResults || [],
          prescription: r.prescription || [],
          doctorAdvice: r.doctorAdvice,
          nextAppointment: r.nextAppointment,
          totalCost: r.totalCost,
        }));
      }
    }

    return res.status(200).json({
      success: true,
      count: items.length,
      diagnoses: items.map(formatDiagnosis),
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách chẩn đoán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách chẩn đoán.",
    });
  }
};

/**
 * 2. Lấy chi tiết một kết quả chẩn đoán theo ID, diagnosisCode hoặc recordId
 * GET /api/diagnoses/:id
 */
const getDiagnosisById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const query = {
      $or: [
        { diagnosisCode: id },
        { recordId: id },
        ...(isObjectId ? [{ _id: id }] : []),
      ],
      isDeleted: false,
    };

    let item = await Diagnosis.findOne(query).lean();

    // Fallback sang MedicalRecord nếu chưa có trong collection Diagnosis
    if (!item) {
      const medRecord = await MedicalRecord.findOne({
        $or: [{ recordCode: id }, ...(isObjectId ? [{ _id: id }] : [])],
        isDeleted: false,
      }).lean();

      if (medRecord) {
        item = {
          _id: medRecord._id,
          diagnosisCode: `DIAG-${medRecord.recordCode || medRecord._id}`,
          recordId: medRecord.recordCode || String(medRecord._id),
          petId: medRecord.petId,
          petName: medRecord.petName,
          petSpecies: medRecord.petSpecies,
          petBreed: medRecord.petBreed,
          date: medRecord.date,
          dateISO: medRecord.dateISO,
          category: medRecord.category,
          status: medRecord.status,
          veterinarian: medRecord.veterinarian,
          clinicBranch: medRecord.clinicBranch,
          reason: medRecord.reason,
          symptoms: medRecord.symptoms,
          vitalSigns: medRecord.vitalSigns,
          preliminaryDiagnosis: medRecord.preliminaryDiagnosis,
          confirmedDiagnosis: medRecord.confirmedDiagnosis || medRecord.title,
          testResults: medRecord.testResults || [],
          prescription: medRecord.prescription || [],
          doctorAdvice: medRecord.doctorAdvice,
          nextAppointment: medRecord.nextAppointment,
          totalCost: medRecord.totalCost,
        };
      }
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ kết quả chẩn đoán.",
      });
    }

    return res.status(200).json({
      success: true,
      diagnosis: formatDiagnosis(item),
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết chẩn đoán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết chẩn đoán.",
    });
  }
};

/**
 * 3. Lấy toàn bộ lịch sử chẩn đoán của một thú cưng theo thời gian
 * GET /api/pets/:petId/diagnoses
 */
const getDiagnosesByPetId = async (req, res) => {
  try {
    const { petId } = req.params;
    const items = await Diagnosis.find({ petId, isDeleted: false })
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      petId,
      count: items.length,
      diagnoses: items.map(formatDiagnosis),
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử chẩn đoán của thú cưng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy lịch sử chẩn đoán.",
    });
  }
};

/**
 * 4. Lấy kết quả chẩn đoán mới nhất của thú cưng
 * GET /api/pets/:petId/diagnoses/latest
 */
const getLatestDiagnosisByPetId = async (req, res) => {
  try {
    const { petId } = req.params;
    const item = await Diagnosis.findOne({ petId, isDeleted: false })
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Chưa có kết quả chẩn đoán nào cho thú cưng này.",
      });
    }

    return res.status(200).json({
      success: true,
      diagnosis: formatDiagnosis(item),
    });
  } catch (error) {
    console.error("Lỗi lấy chẩn đoán mới nhất:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chẩn đoán mới nhất.",
    });
  }
};

/**
 * 5. Theo dõi diễn tiến sức khỏe thú cưng qua các lần chẩn đoán
 * GET /api/pets/:petId/diagnoses/tracking
 */
const getDiagnosisHealthTracking = async (req, res) => {
  try {
    const { petId } = req.params;
    const items = await Diagnosis.find({ petId, isDeleted: false })
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    const analysis = analyzePetHealthEvolution(items);

    return res.status(200).json({
      success: true,
      petId,
      healthTracking: analysis,
    });
  } catch (error) {
    console.error("Lỗi theo dõi sức khỏe thú cưng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi phân tích diễn tiến sức khỏe.",
    });
  }
};

/**
 * 6. Tạo mới hoặc cập nhật kết quả chẩn đoán (POST /api/diagnoses)
 */
const createDiagnosis = async (req, res) => {
  try {
    const data = req.body || {};
    const diagnosisCode =
      data.diagnosisCode ||
      data.id ||
      `DIAG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const dateISO = parseDateISO(data.dateISO || data.date);
    const dateFormatted = data.date || new Date().toLocaleDateString("vi-VN");

    const payload = {
      diagnosisCode,
      recordId: data.recordId || "",
      petId: String(data.petId || "").trim(),
      petName: data.petName || "Bé cưng",
      petSpecies: data.petSpecies || "Chó",
      petBreed: data.petBreed || "Chưa rõ",
      date: dateFormatted,
      dateISO,
      category: data.category || "Khám tổng quát",
      status: data.status || "Đang điều trị",
      veterinarian: data.veterinarian || "BS. CKI. Nguyễn Văn Hùng",
      ...(data.doctorName !== undefined ? { doctorName: String(data.doctorName).trim() } : {}),
      ...(data.id_bac_sy !== undefined ? { id_bac_sy: String(data.id_bac_sy).trim() } : {}),
      ...(data.doctorPhone !== undefined ? { doctorPhone: String(data.doctorPhone).trim() } : {}),
      ...(data.customerName !== undefined ? { customerName: String(data.customerName).trim() } : {}),
      ...(data.customerPhone !== undefined ? { customerPhone: String(data.customerPhone).trim() } : {}),
      clinicBranch:
        data.clinicBranch || "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
      reason: data.reason || "Khám định kỳ & kiểm tra sức khỏe",
      symptoms: Array.isArray(data.symptoms)
        ? data.symptoms
        : [data.symptoms || "Bình thường"],
      vitalSigns: data.vitalSigns || {
        temperature: 38.5,
        weight: 5.0,
        heartRate: 110,
        respiratoryRate: 24,
        mucousMembranes: "Hồng tươi",
        hydration: "Bình thường",
      },
      preliminaryDiagnosis:
        data.preliminaryDiagnosis || "Chẩn đoán lâm sàng ban đầu",
      confirmedDiagnosis:
        data.confirmedDiagnosis || data.title || "Khỏe mạnh",
      diagnosticSummary: data.diagnosticSummary || "",
      severity: data.severity || "Nhẹ",
      testResults: Array.isArray(data.testResults) ? data.testResults : [],
      prescription: Array.isArray(data.prescription) ? data.prescription : [],
      treatmentPlan: data.treatmentPlan || "",
      doctorAdvice:
        data.doctorAdvice || "Chăm sóc bé cưng và cho uống thuốc đúng giờ.",
      nextAppointment: data.nextAppointment || "",
      totalCost: data.totalCost || "250.000đ",
      isDeleted: false,
    };

    const newDiagnosis = await Diagnosis.findOneAndUpdate(
      { diagnosisCode },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Tự động đồng bộ với MedicalRecord liên kết nếu có
    if (payload.recordId) {
      await syncWithMedicalRecord(payload);
    }

    console.log(`✓ Đã lưu hồ sơ chẩn đoán [${diagnosisCode}] thành công!`);

    return res.status(201).json({
      success: true,
      message: "Lưu kết quả chẩn đoán thành công.",
      diagnosis: formatDiagnosis(newDiagnosis),
    });
  } catch (error) {
    console.error("Lỗi tạo mới chẩn đoán:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lưu kết quả chẩn đoán.",
    });
  }
};

/**
 * 7. Cập nhật kết quả chẩn đoán (PUT /api/diagnoses/:id)
 */
const updateDiagnosis = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (data.date && !data.dateISO) {
      data.dateISO = parseDateISO(data.date);
    }

    const updated = await Diagnosis.findOneAndUpdate(
      {
        $or: [
          { diagnosisCode: id },
          { recordId: id },
          ...(isObjectId ? [{ _id: id }] : []),
        ],
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ chẩn đoán để cập nhật.",
      });
    }

    // Tự động đồng bộ với MedicalRecord nếu có liên kết
    if (updated.recordId) {
      await syncWithMedicalRecord(updated);
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật kết quả chẩn đoán thành công.",
      diagnosis: formatDiagnosis(updated),
    });
  } catch (error) {
    console.error("Lỗi cập nhật chẩn đoán:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật kết quả chẩn đoán.",
    });
  }
};

/**
 * 8. Xóa kết quả chẩn đoán (DELETE /api/diagnoses/:id)
 */
const deleteDiagnosis = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    await Diagnosis.findOneAndUpdate(
      {
        $or: [
          { diagnosisCode: id },
          { recordId: id },
          ...(isObjectId ? [{ _id: id }] : []),
        ],
      },
      { $set: { isDeleted: true } }
    );

    return res.status(200).json({
      success: true,
      message: "Đã xóa kết quả chẩn đoán thành công.",
    });
  } catch (error) {
    console.error("Lỗi xóa chẩn đoán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa kết quả chẩn đoán.",
    });
  }
};

/**
 * 9. Thống kê tổng quan tình trạng chẩn đoán (GET /api/diagnoses/stats/overview)
 */
const getDiagnosisStats = async (req, res) => {
  try {
    const total = await Diagnosis.countDocuments({ isDeleted: false });
    const treating = await Diagnosis.countDocuments({
      status: "Đang điều trị",
      isDeleted: false,
    });
    const completed = await Diagnosis.countDocuments({
      status: "Đã hoàn thành",
      isDeleted: false,
    });
    const followup = await Diagnosis.countDocuments({
      status: "Cần tái khám",
      isDeleted: false,
    });

    const categoryStats = await Diagnosis.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      overview: {
        total,
        status: { treating, completed, followup },
        categories: categoryStats.map((c) => ({
          category: c._id || "Khác",
          count: c.count,
        })),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thống kê chẩn đoán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy thống kê chẩn đoán.",
    });
  }
};

module.exports = {
  getDiagnoses,
  getDiagnosisById,
  getDiagnosesByPetId,
  getLatestDiagnosisByPetId,
  getDiagnosisHealthTracking,
  createDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
  getDiagnosisStats,
};
