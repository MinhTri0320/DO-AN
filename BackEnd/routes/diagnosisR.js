const express = require("express");
const diagnosis = require("../controllers/diagnosisC");

const router = express.Router();

// 1. Quản lý danh sách và chi tiết chẩn đoán bệnh
router.get("/diagnoses", diagnosis.getDiagnoses);
router.get("/diagnoses/stats/overview", diagnosis.getDiagnosisStats);
router.get("/diagnoses/:id", diagnosis.getDiagnosisById);
router.post("/diagnoses", diagnosis.createDiagnosis);
router.put("/diagnoses/:id", diagnosis.updateDiagnosis);
router.delete("/diagnoses/:id", diagnosis.deleteDiagnosis);

// 2. Theo dõi sức khỏe và lịch sử chẩn đoán của từng thú cưng
router.get("/pets/:petId/diagnoses", diagnosis.getDiagnosesByPetId);
router.get("/pets/:petId/diagnoses/latest", diagnosis.getLatestDiagnosisByPetId);
router.get("/pets/:petId/diagnoses/tracking", diagnosis.getDiagnosisHealthTracking);

module.exports = router;
