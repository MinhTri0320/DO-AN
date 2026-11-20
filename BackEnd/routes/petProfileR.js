const express = require("express");

const {
  getPets,
  getPetById,
  createPet,
  updatePet,
  deletePet
} = require("../controllers/petProfileC");

const router = express.Router();

router.get("/pets", getPets);

router.get("/pets/:id", getPetById);

router.post("/pets", createPet);

router.put("/pets/:id", updatePet);

router.delete("/pets/:id", deletePet);

module.exports = router;