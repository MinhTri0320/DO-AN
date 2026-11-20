const Diagnosis = require("../models/diagnosis");
const MedicalRecord = require("../models/medicalRecord");

/**
 * Chuẩn hóa object chẩn đoán trả về client, đảm bảo có trường id nhất quán
 */
function formatDiagnosis(item) {
  if (!item) return null;
  const raw = typeof item.toObject === "function" ? item.toObject() : item;
  const id = raw.diagnosisCode || (raw._id ? String(raw._id) : "");
  return {
    ...raw,
    id,
    diagnosisCode: raw.diagnosisCode || id,
  };
}

/**
 * Chuẩn hóa ngày sang định dạng YYYY-MM-DD phục vụ sắp xếp thời gian
 */
function parseDateISO(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split("/");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime())
    ? parsed.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
}

/**
 * Tự động đồng bộ thông tin chẩn đoán sang MedicalRecord nếu có liên kết recordId
 */
async function syncWithMedicalRecord(diagnosisData) {
  try {
    const recordCode = diagnosisData.recordId;
    if (!recordCode) return;

    const updateFields = {};
    if (diagnosisData.preliminaryDiagnosis) {
      updateFields.preliminaryDiagnosis = diagnosisData.preliminaryDiagnosis;
    }
    if (diagnosisData.confirmedDiagnosis) {
      updateFields.confirmedDiagnosis = diagnosisData.confirmedDiagnosis;
    }
    if (Array.isArray(diagnosisData.testResults) && diagnosisData.testResults.length > 0) {
      updateFields.testResults = diagnosisData.testResults;
    }
    if (Array.isArray(diagnosisData.prescription) && diagnosisData.prescription.length > 0) {
      updateFields.prescription = diagnosisData.prescription;
    }
    if (diagnosisData.vitalSigns) {
      updateFields.vitalSigns = diagnosisData.vitalSigns;
    }
    if (diagnosisData.doctorAdvice) {
      updateFields.doctorAdvice = diagnosisData.doctorAdvice;
    }
    if (diagnosisData.nextAppointment) {
      updateFields.nextAppointment = diagnosisData.nextAppointment;
    }
    if (diagnosisData.status) {
      updateFields.status = diagnosisData.status;
    }

    await MedicalRecord.findOneAndUpdate(
      {
        $or: [
          { recordCode: recordCode },
          { _id: recordCode.match(/^[0-9a-fA-F]{24}$/) ? recordCode : null },
        ],
      },
      { $set: updateFields }
    );
  } catch (err) {
    console.warn("[DiagnosisService] Không thể đồng bộ sang MedicalRecord:", err.message);
  }
}

/**
 * Phân tích dữ liệu diễn tiến sức khỏe của thú cưng qua các lần chẩn đoán
 */
function analyzePetHealthEvolution(diagnoses = []) {
  const total = diagnoses.length;
  if (total === 0) {
    return {
      totalDiagnoses: 0,
      recoveryRate: 100,
      statusCounts: { treating: 0, completed: 0, followup: 0 },
      abnormalTestAlerts: [],
      diseaseHistory: [],
      weightTrend: [],
      latestDiagnosis: null,
    };
  }

  const completed = diagnoses.filter((d) => d.status === "Đã hoàn thành").length;
  const treating = diagnoses.filter((d) => d.status === "Đang điều trị").length;
  const followup = diagnoses.filter((d) => d.status === "Cần tái khám").length;
  const recoveryRate = Math.round((completed / total) * 100);

  // Thu thập các xét nghiệm bất thường
  const abnormalTestAlerts = [];
  diagnoses.forEach((d) => {
    (d.testResults || []).forEach((t) => {
      if (t.status === "Bất thường") {
        abnormalTestAlerts.push({
          diagnosisCode: d.diagnosisCode,
          date: d.date,
          testName: t.name,
          result: t.result,
        });
      }
    });
  });

  // Danh mục các bệnh từng được chẩn đoán
  const diseaseHistory = diagnoses.map((d) => ({
    date: d.date,
    category: d.category,
    diagnosis: d.confirmedDiagnosis,
    severity: d.severity || "Nhẹ",
    status: d.status,
    doctor: d.veterinarian,
  }));

  // Diễn tiến cân nặng ghi nhận qua các lần khám
  const weightTrend = diagnoses
    .filter((d) => d.vitalSigns && d.vitalSigns.weight)
    .map((d) => ({
      date: d.date,
      weight: parseFloat(d.vitalSigns.weight),
    }))
    .reverse();

  return {
    totalDiagnoses: total,
    recoveryRate,
    statusCounts: { treating, completed, followup },
    abnormalTestAlerts,
    diseaseHistory,
    weightTrend,
    latestDiagnosis: diagnoses[0] || null,
  };
}

module.exports = {
  formatDiagnosis,
  parseDateISO,
  syncWithMedicalRecord,
  analyzePetHealthEvolution,
};
