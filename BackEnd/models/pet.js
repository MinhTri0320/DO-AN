const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true },
    breed: { type: String, trim: true },
    gender: { type: String, enum: ["male", "female"] },
    birthDate: { type: Date },
    weight: { type: Number, min: 0 }, // kg
    vaccinated: { type: Boolean, default: false },
    sterilized: { type: Boolean, default: false },
    avatar: { type: String, trim: true }, // đường dẫn ảnh
    notes: { type: String, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

petSchema.virtual("age").get(function () {
  if (!this.birthDate) return null;
  return Math.floor((Date.now() - this.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
});
petSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Pet", petSchema, "pets");