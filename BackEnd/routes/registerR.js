const express = require("express");
<<<<<<< HEAD
const { register } = require("../controllers/registerC");
=======

const { register } = require("../controllers/registerC");

>>>>>>> 9761cedb486af4719012142af29dfcfead412ddb
const router = express.Router();

router.post("/register", register);

module.exports = router;