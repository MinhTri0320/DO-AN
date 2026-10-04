const User = require("../models/user");

// Xem hồ sơ khách hàng
const getProfile = async (req, res) => {
  try {
    const phone = req.query.phone;

    if (!phone) {
      return res.status(400).json({
        message: "Thiếu số điện thoại người dùng"
      });
    }

    const user = await User.findOne({ phone: phone });

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản"
      });
    }

    res.status(200).json({
      message: "Lấy hồ sơ thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone
      }
    });

  } catch (error) {
    console.log("Lỗi lấy hồ sơ:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};


// Cập nhật hồ sơ khách hàng
const updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        message: "Thiếu số điện thoại người dùng"
      });
    }

    const user = await User.findOne({ phone: phone });

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản"
      });
    }

    if (name) {
      user.name = name;
    }

    await user.save();

    res.status(200).json({
      message: "Cập nhật hồ sơ thành công",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone
      }
    });

  } catch (error) {
    console.log("Lỗi cập nhật hồ sơ:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
