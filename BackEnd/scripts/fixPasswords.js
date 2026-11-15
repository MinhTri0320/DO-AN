require("dotenv").config();
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/database");

(async () => {
  try {
    await connectDB();
    const usersCol = mongoose.connection.collection("users");
    const users = await usersCol.find({}).toArray();
    let updated = 0;
    
    console.log(`Tìm thấy ${users.length} tài khoản trong database.`);
    for (const u of users) {
      if (typeof u.password === "string" && !u.password.startsWith("$2")) {
        const hashed = await bcrypt.hash(u.password, 10);
        await usersCol.updateOne({ _id: u._id }, { $set: { password: hashed } });
        console.log(`✓ Đã băm bcrypt cho [${u.phone}] - ${u.name} (role: ${u.role})`);
        updated++;
      } else {
        console.log(`- [${u.phone}] - ${u.name} đã là bcrypt, bỏ qua.`);
      }
    }
    
    console.log(`\nHoàn tất! Đã cập nhật ${updated} tài khoản sang định dạng bcrypt.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Lỗi cập nhật mật khẩu:", error);
    process.exit(1);
  }
})();
