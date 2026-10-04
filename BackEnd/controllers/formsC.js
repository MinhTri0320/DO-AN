const Form = require("../models/form");

const isPhone = (value) =>
  typeof value === "string" &&
  /^[+()\d\s.-]{7,20}$/.test(value.trim()) &&
  (value.match(/\d/g) || []).length >= 7;

const createForm = async (req, res) => {
  const { name, phone, email = "", topic, message, userId } = req.body || {};

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 120 ||
    !isPhone(phone) ||
    typeof email !== "string" ||
    email.length > 254 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ||
    !["tuvan", "dichvu", "lichhen", "gopy", "khac"].includes(topic) ||
    typeof message !== "string" ||
    message.trim().length < 5 ||
    message.trim().length > 2000 ||
    (userId !== undefined && (typeof userId !== "string" || userId.length > 100))
  ) {
    return res.status(400).json({ message: "Thông tin biểu mẫu không hợp lệ." });
  }

  try {
    const form = await Form.create({
      name,
      phone,
      email,
      topic,
      message,
      userId,
    });

    return res.status(201).json({
      message: "Đã gửi biểu mẫu thành công.",
      form: {
        id: form.id,
        name: form.name,
        topic: form.topic,
        status: form.status,
        createdAt: form.createdAt,
      },
    });
  } catch (error) {
    console.error("Lỗi lưu biểu mẫu:", error);
    return res.status(500).json({ message: "Không thể lưu biểu mẫu lúc này." });
  }
};

module.exports = createForm;
