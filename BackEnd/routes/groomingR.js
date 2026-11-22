const express = require("express");
const grooming = require("../controllers/groomingC");

const router = express.Router();

/* ============================================================
   GROOMING ROUTES (API Quản lý lịch chăm sóc thú cưng)
   ============================================================ */

// 1. Tạo mới lịch chăm sóc
router.post("/grooming", grooming.createGrooming);

// 2. Lấy danh sách lịch theo ngày / khoảng ngày (sắp xếp giờ tăng dần, báo "Chưa có lịch hẹn" nếu trống)
router.get("/grooming", grooming.getGroomings);

// 3. Chi tiết lịch chăm sóc
router.get("/grooming/:id", grooming.getGroomingById);

// 4. Đổi trạng thái theo thứ tự pending -> in_progress -> completed, hoặc cancelled
router.patch("/grooming/:id/status", grooming.changeStatus);
router.put("/grooming/:id/status", grooming.changeStatus);

// 5. Hủy lịch hẹn
router.patch("/grooming/:id/cancel", grooming.cancelGrooming);

module.exports = router;
