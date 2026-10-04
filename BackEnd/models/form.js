const mongoose = require("mongoose");

const formSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    topic: {
      type: String,
      required: true,
      enum: ["tuvan", "dichvu", "lichhen", "gopy", "khac"],
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    userId: { type: String, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: ["pending", "answered", "closed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Form", formSchema, "forms");
