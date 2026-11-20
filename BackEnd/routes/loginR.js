const express = require("express");
<<<<<<< HEAD
const { login } = require("../controllers/loginC");
=======
const {login} = require("../controllers/loginC");
>>>>>>> 9761cedb486af4719012142af29dfcfead412ddb

const router = express.Router();

router.post("/login", login);

module.exports = router;