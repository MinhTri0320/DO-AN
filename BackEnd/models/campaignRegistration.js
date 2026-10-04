const mongoose = require("mongoose");

const campaignRegistrationSchema = new mongoose.Schema(
  {
    campaignId: { type: String, required: true, trim: true, maxlength: 100 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    userId: { type: String, trim: true, maxlength: 100 },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

campaignRegistrationSchema.index({ campaignId: 1, email: 1 }, { unique: true });
campaignRegistrationSchema.index(
  { campaignId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "string" } } }
);

module.exports = mongoose.model(
  "CampaignRegistration",
  campaignRegistrationSchema,
  "campaignRegistrations"
);
