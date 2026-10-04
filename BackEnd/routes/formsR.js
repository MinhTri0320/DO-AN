const express = require("express");
const createForm = require("../controllers/formsC");

const router = express.Router();

router.post("/forms", createForm);

module.exports = router;
