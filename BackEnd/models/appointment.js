const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    userId: { type: String, trim: true, maxlength: 100 },
    userEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    serviceId: { type: String, required: true, trim: true, maxlength: 50 },
    serviceName: { type: String, required: true, trim: true, maxlength: 120 },
    serviceIcon: { type: String, trim: true, maxlength: 20 },
    petName: { type: String, required: true, trim: true, maxlength: 100 },
    petSpecies: { type: String, trim: true, maxlength: 60 },
    petBreed: { type: String, trim: true, maxlength: 100 },
    petAvatar: { type: String, trim: true, maxlength: 500 },
    date: { type: String, required: true, trim: true, maxlength: 10 },
    dateISO: { type: String, required: true, trim: true, maxlength: 10 },
    time: { type: String, required: true, trim: true, maxlength: 5 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerPhone: { type: String, required: true, trim: true, maxlength: 20 },
    notes: { type: String, trim: true, maxlength: 1000 },
    location: { type: String, trim: true, maxlength: 250 },
    status: {
      type: String,
      enum: ["Chờ xác nhận", "Đã xác nhận", "Đã hủy"],
      default: "Chờ xác nhận",
    },
    feeDisplay: { type: String, trim: true, maxlength: 60 },
    slotReserved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

appointmentSchema.index(
  { dateISO: 1, time: 1 },
  { unique: true, partialFilterExpression: { slotReserved: true } }
);

module.exports = mongoose.model("Appointment", appointmentSchema, "appointments");
