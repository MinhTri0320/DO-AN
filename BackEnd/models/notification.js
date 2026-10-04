const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, maxlength: 100, index: true },
    type: {
      type: String,
      enum: [
        "appointment",
        "appointment_completed",
        "campaign",
        "invoice",
        "form_reply",
        "general",
      ],
      default: "general",
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    icon: { type: String, trim: true, maxlength: 20, default: "🔔" },
    link: { type: String, trim: true, maxlength: 500 },
    eventKey: { type: String, trim: true, maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index(
  { eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } }
);

module.exports = mongoose.model("Notification", notificationSchema, "notifications");
