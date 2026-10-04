const express = require("express");
const registerCampaign = require("../controllers/campaignsC");

const router = express.Router();

router.post("/campaigns/register", registerCampaign);

module.exports = router;
