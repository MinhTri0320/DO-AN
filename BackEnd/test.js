require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/database");

connectDB().then(async () => {
  await mongoose.connection.close();
  console.log("Đã đóng kết nối");
});