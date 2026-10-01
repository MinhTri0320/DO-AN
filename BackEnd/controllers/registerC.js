const bcrypt = require("bcryptjs");
const User = require("../models/User");

const register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập đầy đủ thông tin."
            });
        }

        const userExists = await User.findOne({ email: email });

        if (userExists) {
            return res.status(400).json({
                message: "Email đã được đăng ký."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name: name,
            email: email,
            phone: phone,
            password: hashedPassword
        });

        res.status(201).json({
            message: "Đăng ký thành công.",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone
            }
        });

    } catch (error) {
        console.log("Lỗi đăng ký:", error);

        res.status(500).json({
            message: "Lỗi server khi đăng ký."
        });
    }
};

module.exports = register;