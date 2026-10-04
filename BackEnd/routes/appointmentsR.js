const express = require("express");

const appointments = require("../controllers/appointmentsC");

const router = express.Router();


/* ============================================================
   LIST - Lấy danh sách lịch hẹn của người dùng
   GET /api/appointments
   ============================================================ */
router.get("/appointments", appointments.list);


/* ============================================================
   LIST BOOKED SLOTS - Lấy các giờ đã được đặt
   GET /api/appointments/slots?date=YYYY-MM-DD
   ============================================================ */
router.get(
  "/appointments/slots",
  appointments.listBookedSlots
);


/* ============================================================
   BOOKING - Đặt lịch
   POST /api/appointments
   ============================================================ */
router.post(
  "/appointments",
  appointments.create
);


/* ============================================================
   CANCEL - Hủy lịch
   PATCH /api/appointments/:bookingCode/cancel
   ============================================================ */
router.patch(
  "/appointments/:bookingCode/cancel",
  appointments.cancel
);


module.exports = router;