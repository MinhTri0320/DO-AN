const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectDB = require("../config/database");
const Pet = require("../models/pet");
const User = require("../models/user");

async function checkPets() {
  await connectDB();
  const pets = await Pet.find({}).lean();
  for (const p of pets) {
    const owner = await User.findById(p.ownerId).lean();
    console.log(`Pet: ${p.name} (id: ${p._id}) | Owner: ${owner ? owner.name : 'Unknown'} (id: ${p.ownerId}, phone: ${owner ? owner.phone : 'N/A'})`);
  }
  process.exit(0);
}

checkPets().catch(console.error);
