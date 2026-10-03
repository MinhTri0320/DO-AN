const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    location: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    maxParticipants: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["upcoming", "open", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema, "campaigns");