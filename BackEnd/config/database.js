const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pawncare";
  const options = process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};

  await mongoose.connect(uri, options);
  console.log("Đã kết nối MongoDB");
};

module.exports = connectDB;