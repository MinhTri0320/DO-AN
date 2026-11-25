const User = require("../models/user");
const bcrypt = require("bcryptjs");

const normalizePhone = (raw) => {
  if (typeof raw !== "string") return "";
  let cleaned = raw.replace(/[\s\-().]+/g, "").trim();
  if (cleaned.startsWith("+84")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("84") && cleaned.length === 11) {
    cleaned = "0" + cleaned.slice(2);
  }
  return cleaned;
};

const register = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      phone,
      password,
      email,
      address
    } = body;

    if (
      !name ||
      !phone ||
      !password ||
      typeof name !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ họ tên, số điện thoại và mật khẩu"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu phải có ít nhất 6 ký tự"
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!/^0\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ (phải gồm 10 chữ số và bắt đầu bằng số 0)"
      });
    }

    const existingUser = await User.findOne({ phone: normalizedPhone });

    if (existingUser) {
      return res.status(400).json({
        message: "Số điện thoại đã được đăng ký"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Người đăng ký tài khoản đầu tiên sẽ là admin, các tài khoản sau mặc định là pet_owner
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? "admin" : "pet_owner";
    const role_id = userCount === 0 ? 1 : 4;

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const createPayload = {
      name: name.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      role_id
    };

    if (address && typeof address === "object") {
      createPayload.address = {
        houseNumber: typeof address.houseNumber === "string" ? address.houseNumber.trim() : "",
        street: typeof address.street === "string" ? address.street.trim() : "",
        ward: typeof address.ward === "string" ? address.ward.trim() : "",
        district: typeof address.district === "string" ? address.district.trim() : "",
        city:
          typeof address.city === "string" && address.city.trim() !== ""
            ? address.city.trim()
            : "TP. Đà Nẵng",
      };
    }

    const user = await User.create(createPayload);
    const addr = user.address || {};

    return res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        address: {
          houseNumber: addr.houseNumber || "",
          street: addr.street || "",
          ward: addr.ward || "",
          district: addr.district || "",
          city: addr.city || "TP. Đà Nẵng",
        },
        role: user.role,
        role_id: user.role_id || role_id
      }
    });

  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(400).json({
        message: "Số điện thoại đã được đăng ký"
      });
    }

    console.log("Lỗi đăng ký:", error);

    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};

module.exports = {
  register
};
