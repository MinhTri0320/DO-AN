const ReExamination = require("../models/reExamination");
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

// 1. Lấy danh sách lịch sử tái khám (GET /api/re-examinations)
const getReExaminations = async (req, res) => {
  try {
    const { petId, recordCode, recoveryStatus, status, search } = req.query;
    const filter = { isDeleted: false };

    if (petId) filter.petId = String(petId).trim();
    if (recordCode) filter.recordCode = String(recordCode).trim();
    if (recoveryStatus) filter.recoveryStatus = String(recoveryStatus).trim();
    if (status) filter.status = String(status).trim();

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { reExamCode: searchRegex },
        { petName: searchRegex },
        { examinationNotes: searchRegex },
        { treatmentResult: searchRegex },
        { veterinarian: searchRegex },
      ];
    }

    const reExaminations = await ReExamination.find(filter)
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: reExaminations.length,
      reExaminations,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách lịch sử tái khám:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách tái khám." });
  }
};

// 2. Lấy chi tiết một lần tái khám theo ID hoặc reExamCode (GET /api/re-examinations/:id)
const getReExaminationById = async (req, res) => {
  try {
    const { id } = req.params;
    const reExam = await ReExamination.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { reExamCode: id },
      ],
      isDeleted: false,
    }).lean();

    if (!reExam) {
      return res.status(404).json({ message: "Không tìm thấy thông tin lịch sử tái khám." });
    }

    return res.status(200).json({
      success: true,
      reExamination: reExam,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết tái khám:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy thông tin tái khám." });
  }
};

// 3. Tạo mới ghi nhận tái khám (POST /api/re-examinations)
const createReExamination = async (req, res) => {
  try {
    const data = req.body || {};

    if (!data.petId) {
      return res.status(400).json({ message: "Thiếu mã thú cưng (petId)." });
    }

    const reExamCode =
      data.reExamCode ||
      data.id ||
      `RE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const dateISO = normalizeDateISO(data.reExamDate || data.date, data.dateISO);
    const dateFormatted =
      data.reExamDate || data.date || new Date().toLocaleDateString("vi-VN");

    let petName = data.petName || "Bé cưng";
    let petSpecies = data.petSpecies || "Chó";

    // Nếu có recordCode, đồng bộ thông tin từ MedicalRecord gốc nếu chưa có
    if (data.recordCode && (!data.petName || data.petName === "Bé cưng")) {
      const rec = await MedicalRecord.findOne({ recordCode: data.recordCode }).lean();
      if (rec) {
        petName = rec.petName || petName;
        petSpecies = rec.petSpecies || petSpecies;
      }
    }

    const vitalSigns = {
      temperature: data.vitalSigns?.temperature ?? 38.5,
      weight: data.vitalSigns?.weight ?? 5.0,
      heartRate: data.vitalSigns?.heartRate ?? 110,
      respiratoryRate: data.vitalSigns?.respiratoryRate ?? 24,
      mucousMembranes: data.vitalSigns?.mucousMembranes || "Hồng hào",
      hydration: data.vitalSigns?.hydration || "Bình thường",
    };

    const newReExam = await ReExamination.findOneAndUpdate(
      { reExamCode },
      {
        $set: {
          reExamCode,
          petId: String(data.petId).trim(),
          petName,
          petSpecies,
          recordCode: data.recordCode ? String(data.recordCode).trim() : undefined,
          medicalRecordId: data.medicalRecordId || undefined,
          appointmentId: data.appointmentId || undefined,
          reExamDate: dateFormatted,
          dateISO,
          title: data.title || "Tái khám theo dõi điều trị",
          veterinarian: data.veterinarian || "BS. CKI. Nguyễn Văn Hùng",
          clinicBranch: data.clinicBranch || "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
          recoveryStatus: data.recoveryStatus || "Tiến triển tốt",
          vitalSigns,
          examinationNotes:
            data.examinationNotes || "Bé tỉnh táo, triệu chứng ban đầu thuyên giảm rõ rệt.",
          treatmentResult:
            data.treatmentResult || "Đáp ứng tốt với phác đồ điều trị hiện tại.",
          doctorAdvice: data.doctorAdvice || "Tiếp tục chế độ chăm sóc và theo dõi tại nhà.",
          prescriptionCode: data.prescriptionCode || undefined,
          nextAppointment: data.nextAppointment || "",
          status: data.status || "Đã khám",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Cập nhật trạng thái của MedicalRecord gốc nếu hồi phục hoàn toàn
    if (
      data.recordCode &&
      data.recoveryStatus === "Hồi phục hoàn toàn"
    ) {
      await MedicalRecord.findOneAndUpdate(
        { recordCode: data.recordCode },
        { $set: { status: "Đã hoàn thành" } }
      ).catch((err) => console.warn("Lưu ý: Không thể cập nhật trạng thái bệnh án gốc:", err.message));
    }

    console.log(`✓ Đã lưu lịch sử tái khám [${reExamCode}] thành công vào MongoDB!`);
    return res.status(201).json({
      success: true,
      message: "Tạo lịch sử tái khám thành công.",
      reExamination: newReExam,
    });
  } catch (error) {
    console.error("Lỗi tạo lịch sử tái khám:", error);
    return res.status(500).json({ message: "Không thể lưu thông tin tái khám." });
  }
};

// 4. Cập nhật thông tin tái khám (PUT /api/re-examinations/:id)
const updateReExamination = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};

    if (data.reExamDate || data.date || data.dateISO) {
      data.dateISO = normalizeDateISO(data.reExamDate || data.date, data.dateISO);
    }

    const updated = await ReExamination.findOneAndUpdate(
      {
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
          { reExamCode: id },
        ],
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy thông tin tái khám để cập nhật." });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin tái khám thành công.",
      reExamination: updated,
    });
  } catch (error) {
    console.error("Lỗi cập nhật tái khám:", error);
    return res.status(500).json({ message: "Không thể cập nhật thông tin tái khám." });
  }
};

// 5. Xóa mềm bản ghi tái khám (DELETE /api/re-examinations/:id)
const deleteReExamination = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ReExamination.findOneAndUpdate(
      {
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
          { reExamCode: id },
        ],
      },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy thông tin tái khám để xóa." });
    }

    return res.status(200).json({
      success: true,
      message: "Đã xóa lịch sử tái khám thành công.",
    });
  } catch (error) {
    console.error("Lỗi xóa tái khám:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi xóa thông tin tái khám." });
  }
};

// 6. Lấy toàn bộ dòng thời gian tái khám theo petId (GET /api/pets/:petId/re-examinations)
const getReExaminationsByPet = async (req, res) => {
  try {
    const { petId } = req.params;
    const list = await ReExamination.find({
      petId,
      isDeleted: false,
    })
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    const latest = list.length > 0 ? list[0] : null;

    return res.status(200).json({
      success: true,
      petId,
      totalCount: list.length,
      latestStatus: latest ? latest.recoveryStatus : "Chưa có dữ liệu",
      reExaminations: list,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử tái khám thú cưng:", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

module.exports = {
  getReExaminations,
  getReExaminationById,
  createReExamination,
  updateReExamination,
  deleteReExamination,
  getReExaminationsByPet,
};
