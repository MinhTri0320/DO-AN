const MedicalRecord = require("../models/medicalRecord");
const PetHealthProfile = require("../models/petHealthProfile");

// Hàm chuẩn hóa hồ sơ bệnh án trả về, luôn có trường id
const formatRecord = (record) => {
  if (!record) return null;
  const raw = typeof record.toObject === "function" ? record.toObject() : record;
  const id = raw.recordCode || (raw._id ? String(raw._id) : "");
  return {
    ...raw,
    id,
    recordCode: raw.recordCode || id,
  };
};

// 1. Lấy danh sách bệnh án (có thể lọc theo petId)
const getMedicalRecords = async (req, res) => {
  try {
    const { petId } = req.query;
    const filter = { isDeleted: false };
    if (petId) {
      filter.petId = petId;
    }

    const records = await MedicalRecord.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      records: records.map(formatRecord),
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh án:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách bệnh án." });
  }
};

// 2. Lấy chi tiết một bệnh án theo ID hoặc recordCode
const getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await MedicalRecord.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { recordCode: id }],
      isDeleted: false,
    }).lean();

    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    return res.status(200).json({ success: true, record: formatRecord(record) });
  } catch (error) {
    console.error("Lỗi lấy chi tiết bệnh án:", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

// 3. Tạo mới bệnh án (POST /api/medical-records)
const createMedicalRecord = async (req, res) => {
  try {
    const data = req.body || {};
    const recordCode = data.recordCode || data.id || `MED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    let dateISO = data.dateISO;
    if (!dateISO && data.date) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(data.date)) {
        dateISO = data.date.split("/").reverse().join("-");
      } else {
        dateISO = new Date().toISOString().slice(0, 10);
      }
    } else if (!dateISO) {
      dateISO = new Date().toISOString().slice(0, 10);
    }

    const newRecord = await MedicalRecord.findOneAndUpdate(
      { recordCode },
      {
        $set: {
          recordCode,
          petId: String(data.petId || "").trim(),
          petName: data.petName || "Bé cưng",
          petSpecies: data.petSpecies || "Chó",
          petBreed: data.petBreed || "Chưa rõ",
          date: data.date || new Date().toLocaleDateString("vi-VN"),
          dateISO: dateISO,
          title: data.title || "Khám sức khỏe",
          category: data.category || "Khám tổng quát",
          status: data.status || "Đang điều trị",
          veterinarian: data.veterinarian || "BS. CKI. Nguyễn Văn Hùng",
          clinicBranch: data.clinicBranch || "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
          reason: data.reason || "Kiểm tra định kỳ",
          symptoms: Array.isArray(data.symptoms) ? data.symptoms : [data.symptoms || "Bình thường"],
          preliminaryDiagnosis: data.preliminaryDiagnosis || "Chẩn đoán lâm sàng",
          confirmedDiagnosis: data.confirmedDiagnosis || "Khỏe mạnh",
          vitalSigns: data.vitalSigns || {
            temperature: 38.5,
            weight: 5.0,
            heartRate: 110,
            respiratoryRate: 24,
            mucousMembranes: "Hồng hào",
            hydration: "Bình thường",
          },
          testResults: data.testResults || [],
          prescription: data.prescription || [],
          doctorAdvice: data.doctorAdvice || "Chăm sóc bé cưng và giữ ấm.",
          nextAppointment: data.nextAppointment || "",
          totalCost: data.totalCost || "250.000đ",
          isDeleted: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✓ Đã lưu bệnh án [${recordCode}] thành công vào MongoDB!`);
    return res.status(201).json({ success: true, record: formatRecord(newRecord) });
  } catch (error) {
    console.error("Lỗi tạo bệnh án:", error);
    return res.status(500).json({ message: "Không thể lưu hồ sơ bệnh án." });
  }
};

// 4. Cập nhật bệnh án (PUT /api/medical-records/:id)
const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};

    const updated = await MedicalRecord.findOneAndUpdate(
      {
        $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { recordCode: id }],
      },
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy bệnh án để cập nhật." });
    }

    return res.status(200).json({ success: true, record: formatRecord(updated) });
  } catch (error) {
    console.error("Lỗi cập nhật bệnh án:", error);
    return res.status(500).json({ message: "Không thể cập nhật bệnh án." });
  }
};

// 5. Xóa bệnh án (DELETE /api/medical-records/:id)
const deleteMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await MedicalRecord.findOneAndUpdate(
      {
        $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { recordCode: id }],
      },
      { $set: { isDeleted: true } }
    );
    return res.status(200).json({ success: true, message: "Đã xóa bệnh án thành công." });
  } catch (error) {
    console.error("Lỗi xóa bệnh án:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi xóa bệnh án." });
  }
};

// 6. Lấy hồ sơ sức khỏe nền (GET /api/pets/:id/health-profile)
const getPetHealthProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await PetHealthProfile.findOne({ petId: id }).lean();
    return res.status(200).json({ success: true, healthProfile: profile });
  } catch (error) {
    console.error("Lỗi lấy hồ sơ sức khỏe nền:", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

// 7. Cập nhật hồ sơ sức khỏe nền (PUT /api/pets/:id/health-profile)
const savePetHealthProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};

    const profile = await PetHealthProfile.findOneAndUpdate(
      { petId: id },
      { $set: { ...data, petId: id } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, healthProfile: profile });
  } catch (error) {
    console.error("Lỗi lưu hồ sơ sức khỏe nền:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lưu hồ sơ sức khỏe nền." });
  }
};

module.exports = {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
  getPetHealthProfile,
  savePetHealthProfile,
};
