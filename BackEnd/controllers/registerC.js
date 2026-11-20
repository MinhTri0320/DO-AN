const User = require("../models/user");
const bcrypt = require("bcryptjs");

const register = async (req, res) => {
  try {
    const {
      name,
      phone,
      password
    } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ họ tên, số điện thoại và mật khẩu"
      });
    }

    const existingUser = await User.findOne({ phone: phone });

    if (existingUser) {
      return res.status(400).json({
        message: "Số điện thoại đã được đăng ký"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Người đăng ký tài khoản đầu tiên sẽ là admin, các tài khoản sau mặc định là pet_owner
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? "admin" : "pet_owner";

    const user = await User.create({
      name: name,
      phone: phone,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.log("Lỗi đăng ký:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};

module.exports = {
  register
};
