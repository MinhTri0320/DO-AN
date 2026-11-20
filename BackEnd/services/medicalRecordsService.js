const MedicalRecord = require("../models/medicalRecord");
const PetHealthProfile = require("../models/petHealthProfile");

/**
 * Chuẩn hóa object bệnh án trả về, luôn đảm bảo trường id tương thích client
 */
function normalizeRecord(record) {
  if (!record) return null;
  const raw = typeof record.toObject === "function" ? record.toObject() : record;
  const id = raw.recordCode || (raw._id ? String(raw._id) : "");
  return {
    ...raw,
    id,
    recordCode: raw.recordCode || id,
  };
}

/**
 * 1. Lấy danh sách bệnh án (có lọc theo petId nếu có)
 */
async function listRecords(petId = null) {
  const filter = { isDeleted: false };
  if (petId) {
    filter.petId = String(petId).trim();
  }

  const records = await MedicalRecord.find(filter).sort({ createdAt: -1 }).lean();
  return records.map(normalizeRecord);
}

/**
 * 2. Lấy chi tiết bệnh án theo ID hoặc recordCode
 */
async function getRecordById(id) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(cleanId);

  const query = {
    $or: [{ recordCode: cleanId }, ...(isObjectId ? [{ _id: cleanId }] : [])],
    isDeleted: false,
  };

  const record = await MedicalRecord.findOne(query).lean();
  return normalizeRecord(record);
}

/**
 * 3. Tạo mới hoặc cập nhật bệnh án qua recordCode (Upsert)
 */
async function createOrUpsertRecord(data = {}) {
  const recordCode =
    data.recordCode ||
    data.id ||
    `MED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

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

  const updatePayload = {
    recordCode,
    petId: String(data.petId || "").trim(),
    petName: data.petName || "Bé cưng",
    petSpecies: data.petSpecies || "Chó",
    petBreed: data.petBreed || "Chưa rõ",
    date: data.date || new Date().toLocaleDateString("vi-VN"),
    dateISO,
    title: data.title || "Khám sức khỏe",
    category: data.category || "Khám tổng quát",
    status: data.status || "Đang điều trị",
    veterinarian: data.veterinarian || "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch:
      data.clinicBranch || "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: data.reason || "Kiểm tra định kỳ",
    symptoms: Array.isArray(data.symptoms)
      ? data.symptoms
      : [data.symptoms || "Bình thường"],
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
    testResults: Array.isArray(data.testResults) ? data.testResults : [],
    prescription: Array.isArray(data.prescription) ? data.prescription : [],
    doctorAdvice: data.doctorAdvice || "Chăm sóc bé cưng và giữ ấm.",
    nextAppointment: data.nextAppointment || "",
    totalCost: data.totalCost || "250.000đ",
    isDeleted: false,
  };

  const saved = await MedicalRecord.findOneAndUpdate(
    { recordCode },
    { $set: updatePayload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return normalizeRecord(saved);
}

/**
 * 4. Cập nhật bệnh án theo ID hoặc recordCode
 */
async function updateRecord(id, data = {}) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(cleanId);

  const query = {
    $or: [{ recordCode: cleanId }, ...(isObjectId ? [{ _id: cleanId }] : [])],
  };

  const payload = { ...data };
  delete payload._id;

  const updated = await MedicalRecord.findOneAndUpdate(
    query,
    { $set: payload },
    { new: true }
  ).lean();

  return normalizeRecord(updated);
}

/**
 * 5. Xóa mềm bệnh án
 */
async function softDeleteRecord(id) {
  if (!id) return false;
  const cleanId = String(id).trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(cleanId);

  const query = {
    $or: [{ recordCode: cleanId }, ...(isObjectId ? [{ _id: cleanId }] : [])],
  };

  const result = await MedicalRecord.findOneAndUpdate(
    query,
    { $set: { isDeleted: true } },
    { new: true }
  ).lean();

  return Boolean(result);
}

/**
 * 6. Lấy hồ sơ sức khỏe nền
 */
async function getHealthProfile(petId) {
  if (!petId) return null;
  return await PetHealthProfile.findOne({ petId: String(petId).trim() }).lean();
}

/**
 * 7. Lưu hồ sơ sức khỏe nền
 */
async function saveHealthProfile(petId, data = {}) {
  const cleanPetId = String(petId).trim();
  const profile = await PetHealthProfile.findOneAndUpdate(
    { petId: cleanPetId },
    { $set: { ...data, petId: cleanPetId } },
    { upsert: true, new: true }
  ).lean();

  return profile;
}

module.exports = {
  listRecords,
  getRecordById,
  createOrUpsertRecord,
  updateRecord,
  softDeleteRecord,
  getHealthProfile,
  saveHealthProfile,
};
