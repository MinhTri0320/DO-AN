const express = require("express");
const reExaminations = require("../controllers/reExaminationsC");

const router = express.Router();

/* ============================================================
   RE-EXAMINATION ROUTES (API Quản lý lịch sử tái khám)
   ============================================================ */

// 1. Danh sách các lần tái khám (hỗ trợ lọc ?petId=...&recordCode=...&recoveryStatus=...&status=...&search=...)
router.get("/re-examinations", reExaminations.getReExaminations);

// 2. Chi tiết một lần tái khám theo ID hoặc reExamCode
router.get("/re-examinations/:id", reExaminations.getReExaminationById);

// 3. Tạo mới ghi nhận tái khám
router.post("/re-examinations", reExaminations.createReExamination);

// 4. Cập nhật thông tin/kết quả tái khám
router.put("/re-examinations/:id", reExaminations.updateReExamination);

// 5. Xóa mềm bản ghi tái khám
router.delete("/re-examinations/:id", reExaminations.deleteReExamination);

// 6. Toàn bộ tiến trình lịch sử tái khám của thú cưng
router.get("/pets/:petId/re-examinations", reExaminations.getReExaminationsByPet);

module.exports = router;
