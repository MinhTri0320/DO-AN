const Notification = require("../models/notification");

async function createNotification(notification) {
  return Notification.create(notification);
}

module.exports = { createNotification };
