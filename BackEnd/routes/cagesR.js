const express = require("express");
const cagesC = require("../controllers/cagesC");

const router = express.Router();

/* =====================================================================
 *  CAGE ROUTES - QUẢN LÝ DANH SÁCH & TRẠNG THÁI CHUỒNG (SPRINT 4)
 * ===================================================================== */

// 1. Thống kê KPI chuồng (Tổng số, Trống, Đang dùng, Bảo trì)
router.get("/cages/kpi", cagesC.getCageKPIs);

// 2. Lấy danh sách chuồng (hỗ trợ lọc status, size, search, minPrice, maxPrice)
router.get("/cages", cagesC.getCages);

// 3. Lấy chi tiết chuồng theo ID hoặc mã chuồng
router.get("/cages/:id", cagesC.getCageById);

// 4. Thêm chuồng mới (mã chuồng, kích cỡ, giá/ngày, trạng thái ban đầu)
router.post("/cages", cagesC.createCage);

// 5. Chỉnh sửa thông tin chuồng (tên, kích cỡ, giá, mô tả, chuyển trạng thái maintenance)
router.put("/cages/:id", cagesC.updateCage);

// 6. Xóa chuồng (Ràng buộc: Chuồng đang occupied NGHIÊM CẤM XÓA!)
router.delete("/cages/:id", cagesC.deleteCage);

// 7. Chuyển đổi trạng thái Bảo trì / Hoạt động (chỉnh tay)
router.patch("/cages/:id/maintenance", cagesC.toggleMaintenance);

// 8. Tự động cập nhật chuồng sang occupied khi Check-in thú cưng
router.post("/cages/:id/check-in", cagesC.checkIn);

// 9. Tự động cập nhật chuồng sang available khi Check-out thú cưng
router.post("/cages/:id/check-out", cagesC.checkOut);

module.exports = router;