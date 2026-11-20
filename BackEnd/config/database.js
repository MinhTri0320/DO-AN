const mongoose = require("mongoose");
const dns = require("dns");

// Khắc phục lỗi "querySrv ECONNREFUSED" trên Windows khi dùng mongodb+srv://
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Bỏ qua nếu môi trường không cho phép cấu hình DNS
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pawncare";
  const options = process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};

  await mongoose.connect(uri, options);
  console.log("Đã kết nối MongoDB");
};

module.exports = connectDB;
