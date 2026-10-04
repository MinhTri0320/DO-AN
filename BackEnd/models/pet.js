const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true },
    breed: { type: String, trim: true },
    birthDate: { type: Date },
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