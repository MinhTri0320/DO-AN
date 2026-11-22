const express = require("express");
const dispensing = require("../controllers/dispensingC");

const router = express.Router();

/* ============================================================
   DISPENSING ROUTES (API Cấp thuốc theo đơn)
   ============================================================ */

// 1. Cấp thuốc theo đơn (kiểm tra tồn kho, hạn dùng, chặn cấp lặp, tự động trừ quantity)
router.post("/dispensing", dispensing.dispensePrescription);

// 2. Danh sách các lượt cấp thuốc (hỗ trợ lọc theo ?prescriptionId=... hoặc ?petId=...)
router.get("/dispensing", dispensing.getDispensings);

// 3. Chi tiết một lượt cấp thuốc theo ID hoặc mã dispensingCode
router.get("/dispensing/:id", dispensing.getDispensingById);

module.exports = router;
