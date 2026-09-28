const express = require("express");
const cors = require("cors");

const connectDB = require("./config/database");

const registerR = require("./routes/registerR");
const loginR = require("./routes/loginR");

const app = express();


// Kết nối Database
connectDB();


// Middleware
app.use(cors());
app.use(express.json());


// Route đăng ký
app.use("/api", registerR);


// Route đăng nhập
app.use("/api", loginR);


// Kiểm tra server
app.get("/", (req, res) => {
    res.send("PawnCare Backend đang chạy");
});


// Chạy server
app.listen(3000, () => {
    console.log("SERVER DANG CHAY TAI http://localhost:3000");
});