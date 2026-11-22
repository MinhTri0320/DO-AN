const express = require("express");
const boardingsC = require("../controllers/boardingsC");

const router = express.Router();

/* =====================================================================
 *  BOARDING ROUTES - PET CHECK-IN & LƯU CHUỒNG (SPRINT 4)
 * ===================================================================== */

// 1. Check-in thú cưng vào lưu chuồng (POST /api/boardings/check-in & /api/check-in)
router.post("/boardings/check-in", boardingsC.checkIn);
router.post("/check-in", boardingsC.checkIn);

// 2. Lấy danh sách thú cưng đang lưu chuồng (GET /api/boardings/active)
router.get("/boardings/active", boardingsC.getActiveBoardings);

// 3. Lấy danh sách chuồng trống cho Check-in (GET /api/boardings/available-cages)
router.get("/boardings/available-cages", boardingsC.getAvailableCages);

// 4. Kiểm tra thú cưng có đang lưu ở chuồng khác không (GET /api/boardings/check-pet/:petId)
router.get("/boardings/check-pet/:petId", boardingsC.checkPetBoarding);

// 5. Check-out trả thú cưng (POST /api/boardings/:id/check-out & /api/check-out)
router.post("/boardings/:id/check-out", boardingsC.checkOut);
router.post("/boardings/check-out", boardingsC.checkOut);
router.post("/check-out/:id", boardingsC.checkOut);
router.post("/check-out", boardingsC.checkOut);

// 6. Lấy lịch sử lưu chuồng (GET /api/boardings/history & /api/history)
router.get("/boardings/history", boardingsC.getHistory);
router.get("/history", boardingsC.getHistory);

// 7. Lấy chi tiết lượt lưu chuồng theo ID hoặc mã (GET /api/boardings/:id)
router.get("/boardings/:id", boardingsC.getBoardingById);

module.exports = router;