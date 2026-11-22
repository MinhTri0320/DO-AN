const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const connectDB = require("../config/database");

async function run() {
  await connectDB();
  const Appointment = require("../models/appointment");
  const appts = await Appointment.find({}).lean();
  console.log("Appointments count:", appts.length);
  appts.forEach((a) => {
    console.log(`- ${a.bookingCode} | Pet: ${a.petName} | Owner: ${a.ownerName} (${a.ownerPhone}) | Status: ${a.status} | Dr: ${a.id_bac_sy}`);
  });
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
