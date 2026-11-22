const User = require("../models/user");
const bcrypt = require("bcryptjs");

const login = async (req, res) => {
  try {
    const {
      phone,
      password
    } = req.body;
    console.log("BODY LOGIN:", req.body);

    if (!phone || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập số điện thoại và mật khẩu"
      });
    }

    const user = await User.findOne({ phone: phone });

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

    res.status(200).json({
      message: "Đăng nhập thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        role_id: role_id,
        id_bac_sy: id_bac_sy
      }
    });

  } catch (error) {
    console.log("Lỗi đăng nhập:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};

module.exports = {
  login
};
