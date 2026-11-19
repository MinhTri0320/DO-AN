const express = require("express");
const prescriptions = require("../controllers/prescriptionsC");

const router = express.Router();

/* ============================================================
   PRESCRIPTION ROUTES (API Quản lý đơn thuốc thú cưng)
   ============================================================ */

// 1. Danh sách đơn thuốc (hỗ trợ lọc ?petId=...&recordCode=...&status=...&search=...)
router.get("/prescriptions", prescriptions.getPrescriptions);

// 2. Chi tiết một đơn thuốc theo ID hoặc prescriptionCode
router.get("/prescriptions/:id", prescriptions.getPrescriptionById);

// 3. Tạo mới đơn thuốc
router.post("/prescriptions", prescriptions.createPrescription);

// 4. Cập nhật đơn thuốc
router.put("/prescriptions/:id", prescriptions.updatePrescription);

// 5. Xóa mềm đơn thuốc
router.delete("/prescriptions/:id", prescriptions.deletePrescription);

// 6. Danh sách đơn thuốc của một thú cưng cụ thể
router.get("/pets/:petId/prescriptions", prescriptions.getPrescriptionsByPet);

module.exports = router;
