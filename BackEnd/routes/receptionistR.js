const express = require("express");
const receptionistC = require("../controllers/receptionistC");

const router = express.Router();

/* ============================================================
   RECEPTIONIST ROUTES (Dành riêng cho Lễ tân role_id = 3)
   ============================================================ */

// 1. Danh sách lịch khám tất cả khách hàng kèm thông tin hóa đơn
router.get("/receptionist/appointments", receptionistC.getAllAppointmentsWithInvoices);

// 2. Danh sách đơn thuốc sau khám kèm tình trạng cấp thuốc & hóa đơn thuốc
router.get("/receptionist/prescriptions", receptionistC.getPrescriptionsWithDispensings);

module.exports = router;
