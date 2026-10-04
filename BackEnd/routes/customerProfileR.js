const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile
} = require("../controllers/customerProfileC");

router.get("/profile", getProfile);


router.put("/users/profile", updateProfile);

module.exports = router;