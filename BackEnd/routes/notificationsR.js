const express = require("express");
const notifications = require("../controllers/notificationsC");

const router = express.Router();

router.get("/notifications", notifications.list);
router.post("/notifications", notifications.create);
router.patch("/notifications/read-all", notifications.markAllRead);
router.patch("/notifications/:id/read", notifications.markRead);

module.exports = router;
