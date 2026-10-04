const User = require("../models/user");
const bcrypt = require("bcryptjs");

const login = async (req, res) => {
  try {
    const {
      phone,
      password
    } = req.body;

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

    res.status(200).json({
      message: "Đăng nhập thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone
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
