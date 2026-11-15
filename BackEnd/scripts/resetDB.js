require("dotenv").config();
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");

(async () => {
  try {
    await connectDB();
    const dbName = mongoose.connection.db.databaseName;
    console.log(`Đang tiến hành xóa database: ${dbName}...`);
    
    await mongoose.connection.db.dropDatabase();
    console.log(`Đã xóa hoàn toàn database "${dbName}" thành công!`);
    console.log(`Tài khoản đầu tiên đăng ký tiếp theo sẽ tự động nhận quyền "admin" với mật khẩu bcrypt.`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi xóa database:", error);
    process.exit(1);
  }
})();
