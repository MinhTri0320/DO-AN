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

const login = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      phone,
      phoneOrEmail,
      email,
      password
    } = body;

    const rawIdentifier =
      typeof phone === "string" && phone.trim()
        ? phone.trim()
        : typeof phoneOrEmail === "string" && phoneOrEmail.trim()
          ? phoneOrEmail.trim()
          : typeof email === "string" && email.trim()
            ? email.trim()
            : "";

    if (!rawIdentifier || !password || typeof password !== "string") {
      return res.status(400).json({
        message: "Vui lòng nhập số điện thoại (hoặc email) và mật khẩu"
      });
    }

    let user = null;
    if (rawIdentifier.includes("@")) {
      user = await User.findOne({
        email: rawIdentifier.toLowerCase(),
        isDeleted: { $ne: true }
      });
    } else {
      const normPhone = normalizePhone(rawIdentifier);
      if (normPhone) {
        user = await User.findOne({
          phone: normPhone,
          isDeleted: { $ne: true }
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        message: "Số điện thoại hoặc mật khẩu không đúng"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Số điện thoại hoặc mật khẩu không đúng"
      });
    }

    const roleMap = { admin: 1, doctor: 2, receptionist: 3, pet_owner: 4 };
    let role_id = user.role_id || roleMap[user.role] || 4;

    // Tự động gán role_id vào MongoDB nếu tài khoản cũ chưa có
    if (!user.role_id) {
      user.role_id = role_id;
      try {
        await user.save();
      } catch (saveErr) {
        console.warn("Không thể tự động lưu role_id cho user:", saveErr.message);
      }
    }

    let id_bac_sy = undefined;
    if (role_id === 2) {
      const Doctor = require("../models/doctor");
      const doc = await Doctor.findOne({ userId: user._id, isActive: true }).lean();
      if (doc) id_bac_sy = doc.id_bac_sy;
    }

    const addr = user.address || {};

    return res.status(200).json({
      message: "Đăng nhập thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        dob: user.dob || "",
        gender: user.gender || "other",
        address: {
          houseNumber: addr.houseNumber || "",
          street: addr.street || "",
          ward: addr.ward || "",
          district: addr.district || "",
          city: addr.city || "TP. Đà Nẵng",
        },
        role: user.role,
        role_id: role_id,
        id_bac_sy: id_bac_sy
      }
    });

  } catch (error) {
    console.log("Lỗi đăng nhập:", error);

    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};

module.exports = {
  login
};
