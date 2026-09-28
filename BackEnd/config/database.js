   const mongoose = require("mongoose");

   const connectDB = async () => {
     try {
       await mongoose.connect(process.env.MONGODB_URI, {
         dbName: process.env.DB_NAME,
       });
       console.log("Đã kết nối MongoDB");
     } catch (err) {
       console.error("Lỗi kết nối:", err.message);
       process.exit(1);
     }
   };

   module.exports = connectDB;