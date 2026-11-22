const express = require("express");
const doctorFeatures = require("../controllers/doctorFeaturesC");

const router = express.Router();

/* ============================================================
   DOCTOR FEATURES ROUTES (3 Mục nghiệp vụ dành cho Bác sĩ)
   ============================================================ */

// 1. Lịch đặt trước của riêng từng bác sĩ (dựa trên id_bac_sy / SĐT, kèm thông tin hóa đơn)
router.get("/doctor/appointments", doctorFeatures.getDoctorAppointments);

// Xác nhận hoàn thành ca hẹn (chuyển từ lịch hẹn cá nhân -> Hồ sơ khám)
router.post("/doctor/appointments/:id/complete", doctorFeatures.completeAppointment);
router.patch("/doctor/appointments/:id/complete", doctorFeatures.completeAppointment);

// 2. Phiếu khám của thú cưng (dùng chẩn đoán, của riêng từng bác sĩ theo id_bac_sy)
router.get("/doctor/diagnoses", doctorFeatures.getDoctorDiagnoses);

// 3. Hồ sơ khám thú cưng (mục dùng chung cho tất cả ai có role_id = 2)
router.get("/doctor/medical-records", doctorFeatures.getPetMedicalRecords);

// 4. Tra cứu thông tin toàn diện dành cho Bác sĩ
router.get("/doctor/lookup", doctorFeatures.lookupDoctorInfo);

module.exports = router;
