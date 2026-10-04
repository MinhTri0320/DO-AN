const mongoose = require("mongoose");
const campaignRegistrationSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    petId: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", default: null },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ["registered", "cancelled"],
      default: "registered",
    },
  },
  { timestamps: true }
);
campaignRegistrationSchema.index({ campaignId: 1, userId: 1, petId: 1 }, { unique: true });
module.exports = mongoose.model(
  "CampaignRegistration",
  campaignRegistrationSchema,
  "campaignregistrations"
);