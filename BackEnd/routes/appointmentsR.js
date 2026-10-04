const express = require("express");
const appointments = require("../controllers/appointmentsC");

const router = express.Router();

router.get("/appointments/slots", appointments.listBookedSlots);
router.post("/appointments", appointments.create);
router.patch("/appointments/:bookingCode/cancel", appointments.cancel);

module.exports = router;
