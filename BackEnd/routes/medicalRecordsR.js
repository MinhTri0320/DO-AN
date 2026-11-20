const express = require("express");
const medical = require("../controllers/medicalRecordsC");

const router = express.Router();

// Bệnh án (Medical Records)
router.get("/medical-records", medical.getMedicalRecords);
router.get("/medical-records/:id", medical.getMedicalRecordById);
router.post("/medical-records", medical.createMedicalRecord);
router.put("/medical-records/:id", medical.updateMedicalRecord);
router.delete("/medical-records/:id", medical.deleteMedicalRecord);

// Hồ sơ sức khỏe nền của thú cưng (Pet Health Profile)
router.get("/pets/:id/health-profile", medical.getPetHealthProfile);
router.put("/pets/:id/health-profile", medical.savePetHealthProfile);

module.exports = router;
