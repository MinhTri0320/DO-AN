const mongoose = require("mongoose");
const Notification = require("../models/notification");
const { createNotification } = require("../services/notifications");

function getUserFilter(query) {
  const identifiers = [query.userId, query.email].filter(
    (value) => typeof value === "string" && value.trim() && value.length <= 254
  );
  if (identifiers.length === 0) return null;
  return { $or: [...new Set(identifiers.map((value) => value.trim()))].map((userId) => ({ userId })) };
}

const create = async (req, res) => {
  const { userId, type = "general", title, message, icon, link } = req.body || {};
  const allowedTypes = [
    "appointment",
    "appointment_completed",
    "campaign",
    "invoice",
    "form_reply",
    "general",
  ];

  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    userId.length > 100 ||
    !allowedTypes.includes(type) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 120 ||
    typeof message !== "string" ||
    !message.trim() ||
    message.trim().length > 1000 ||
    (icon !== undefined && (typeof icon !== "string" || icon.length > 20)) ||
    (link !== undefined && (typeof link !== "string" || link.length > 500))
  ) {
    return res.status(400).json({ message: "Thông tin thông báo không hợp lệ." });
  }

  try {
    const notification = await createNotification({
      userId: userId.trim(),
      type,
      title,
      message,
      icon,
      link,
    });
    return res.status(201).json({ notification });
  } catch (error) {
    console.error("Lỗi lưu thông báo:", error);
    return res.status(500).json({ message: "Không thể lưu thông báo lúc này." });
  }
};

const list = async (req, res) => {
  const userFilter = getUserFilter(req.query);
  if (!userFilter) {
    return res.status(400).json({ message: "Thiếu mã người dùng." });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(userFilter)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Notification.countDocuments({ ...userFilter, read: false }),
    ]);
    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Lỗi tải thông báo:", error);
    return res.status(500).json({ message: "Không thể tải thông báo lúc này." });
  }
};

const markRead = async (req, res) => {
  const userFilter = getUserFilter(req.query);
  if (
    !userFilter ||
    !mongoose.isValidObjectId(req.params.id)
  ) {
    return res.status(400).json({ message: "Thông tin cập nhật thông báo không hợp lệ." });
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...userFilter },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo." });
    }
    return res.json({ notification });
  } catch (error) {
    console.error("Lỗi cập nhật thông báo:", error);
    return res.status(500).json({ message: "Không thể cập nhật thông báo lúc này." });
  }
};

const markAllRead = async (req, res) => {
  const userFilter = getUserFilter(req.query);
  if (!userFilter) {
    return res.status(400).json({ message: "Thiếu mã người dùng." });
  }

  try {
    await Notification.updateMany({ ...userFilter, read: false }, { read: true });
    return res.json({ message: "Đã đánh dấu tất cả thông báo là đã đọc." });
  } catch (error) {
    console.error("Lỗi cập nhật thông báo:", error);
    return res.status(500).json({ message: "Không thể cập nhật thông báo lúc này." });
  }
};

module.exports = { create, list, markRead, markAllRead };
