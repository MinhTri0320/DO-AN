const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^0\d{9}$/, "Số điện thoại không hợp lệ"],
    },
    email: { type: String, trim: true, lowercase: true, default: "" },
    dob: { type: String, trim: true, default: "" },
    gender: { type: String, trim: true, default: "other" },
    address: {
      houseNumber: { type: String, trim: true, default: "" },
      street: { type: String, trim: true, default: "" },
      ward: { type: String, trim: true, default: "" },
      district: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "TP. Đà Nẵng" },
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["pet_owner", "doctor", "receptionist", "admin"],
      default: "pet_owner",
    },
    role_id: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 4,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Tự động đồng bộ 2 chiều giữa role và role_id
userSchema.pre("save", function () {
  const roleToId = {
    admin: 1,
    doctor: 2,
    receptionist: 3,
    pet_owner: 4,
  };
  const idToRole = {
    1: "admin",
    2: "doctor",
    3: "receptionist",
    4: "pet_owner",
  };

  if (this.role && (!this.role_id || this.isModified("role"))) {
    this.role_id = roleToId[this.role] || 4;
  } else if (this.role_id && (!this.role || this.isModified("role_id"))) {
    this.role = idToRole[this.role_id] || "pet_owner";
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema, "users");
