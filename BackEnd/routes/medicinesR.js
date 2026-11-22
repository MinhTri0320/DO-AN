const express = require("express");
const medicines = require("../controllers/medicinesC");

const router = express.Router();

/* ============================================================
   MEDICINE ROUTES (API Quản lý danh mục thuốc)
   ============================================================ */

// 1. Danh sách thuốc (hỗ trợ tìm kiếm theo tên, lọc stockStatus: Hết hàng, Hết hạn, Còn hàng)
router.get("/medicines", medicines.getMedicines);

// 2. Chi tiết thuốc theo ID hoặc mã thuốc
router.get("/medicines/:id", medicines.getMedicineById);

// 3. Thêm mới thuốc
router.post("/medicines", medicines.createMedicine);

// 4. Sửa thông tin thuốc
router.put("/medicines/:id", medicines.updateMedicine);

// 5. Xóa thuốc (xóa mềm có xác nhận)
router.delete("/medicines/:id", medicines.deleteMedicine);

module.exports = router;
