const bcrypt = require("bcryptjs");
const User = require("../models/User");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập email và mật khẩu."
            });
        }

        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không đúng."
            });
        }

        const checkPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!checkPassword) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không đúng."
            });
        }

        res.status(200).json({
            message: "Đăng nhập thành công.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        console.log("Lỗi đăng nhập:", error);

        res.status(500).json({
            message: "Lỗi server khi đăng nhập."
        });
    }
};

module.exports = login;