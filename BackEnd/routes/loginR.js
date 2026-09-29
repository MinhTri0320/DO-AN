const express = require("express");
const login = require("../controllers/loginC");

const router = express.Router();

router.post("/login", login);

module.exports = router;