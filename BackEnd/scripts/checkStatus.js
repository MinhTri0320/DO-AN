const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const connectDB = require("../config/database");

const User = require("../models/user");
const Pet = require("../models/pet");
const Doctor = require("../models/doctor");
const Grooming = require("../models/grooming");

async function check() {
  await connectDB();
  const doctors = await Doctor.find({ isActive: true }).lean();
  console.log("Active Doctors:", doctors.length, doctors.map(d => ({ id_bac_sy: d.id_bac_sy, name: d.name })));

  const customers = await User.find({ role_id: 4 }).lean();
  console.log("Customers (role_id=4):", customers.length);

  const pets = await Pet.find({}).lean();
  console.log("Pets total:", pets.length);

  const groomings = await Grooming.find({ isDeleted: false }).lean();
  console.log("Groomings total:", groomings.length);
  groomings.forEach(g => {
    console.log(`- [${g.groomingCode}] ${g.dateISO} ${g.startTime}-${g.endTime} | Pet: ${g.petName} (${g.customerName}) | Status: ${g.status}`);
  });

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
