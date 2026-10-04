const mongoose = require("mongoose");
const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    birthDate: { type: Date },
    gender: { type: String, enum: ["female", "male", "other"] },
    email: { type: String, trim: true, lowercase: true },
    address: {
      houseNumber: { type: String, trim: true },
      street: { type: String, trim: true },
      ward: { type: String, trim: true },
      district: { type: String, trim: true },
      city: { type: String, trim: true, default: "TP. Đà Nẵng" },
    },
    membership: {
      type: String,
      enum: ["Thành viên", "Khách hàng Thân thiết"],
      default: "Thành viên",
    },
  },
  { timestamps: true }
);
module.exports = mongoose.models.Customer || mongoose.model("Customer", customerSchema, "customers");