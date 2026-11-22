const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectDB = require("../config/database");
const User = require("../models/user");

async function check() {
  await connectDB();
  const users = await User.find({}).lean();
  users.forEach(u => console.log(u._id, u.name, 'role_id:', u.role_id, 'role:', u.role));
  process.exit(0);
}
check();
