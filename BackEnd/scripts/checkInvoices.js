const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const connectDB = require("../config/database");

async function run() {
  await connectDB();

  const Invoice = require("../models/invoice");
  const User = require("../models/user");

  const invoices = await Invoice.find({}).lean();
  console.log("Total Invoices in DB:", invoices.length);
  invoices.forEach((inv) => {
    console.log(`- Code: ${inv.invoiceCode} | Customer: ${inv.customerName} (${inv.customerPhone}) | Status: ${inv.status} | Total: ${inv.totalAmount} | customerId: ${inv.customerId}`);
  });

  const recep = await User.find({ role_id: 3 }).lean();
  console.log("Receptionists:", recep.map(r => ({ id: r._id, name: r.name, phone: r.phone })));

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
