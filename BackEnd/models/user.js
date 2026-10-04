const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^0\d{9}$/, "Số điện thoại không hợp lệ"],
    },

    password: {
      type: String,
      required: true,
    },

    address: {
      houseNumber: { type: String, trim: true },
      street: { type: String, trim: true },
      ward: { type: String, trim: true },
      city: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema, "users");