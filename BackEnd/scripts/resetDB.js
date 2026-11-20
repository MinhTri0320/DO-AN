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
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`Đang tiến hành làm sạch dữ liệu trong database: ${dbName}...`);
    
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("system.")) continue;
      try {
        await db.collection(col.name).drop();
        console.log(`✓ Đã xóa collection: ${col.name}`);
      } catch (dropErr) {
        // Fallback: Xóa toàn bộ documents nếu không có quyền drop collection
        const res = await db.collection(col.name).deleteMany({});
        console.log(`✓ Đã xóa toàn bộ (${res.deletedCount}) documents trong collection: ${col.name}`);
      }
    }
    
    console.log(`\nĐã làm sạch toàn bộ dữ liệu trong database "${dbName}" thành công!`);
    console.log(`Bây giờ bạn có thể khởi động server (npm start) và đăng ký tài khoản đầu tiên.`);
    console.log(`Tài khoản đầu tiên đăng ký sẽ tự động nhận quyền "admin" với mật khẩu bcrypt.`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi reset database:", error);
    process.exit(1);
  }
})();
