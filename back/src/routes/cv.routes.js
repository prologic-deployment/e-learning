const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const {
  saveCV, getMyCV, getCVByUser,
  addExperience, deleteExperience,
  addFormation, deleteFormation,
  addCompetence, deleteCompetence,
  addLangue, deleteLangue,
  addHobby, deleteHobby
} = require("../controllers/cv.controller");

const { downloadCV } = require("../controllers/cv.controller");
const fs = require("fs");
const upload = require("../config/multer");




router.get("/download", protect, downloadCV);

// Infos personnelles
router.post("/", protect, upload.image.single("photo"), saveCV);
router.get("/me", protect, getMyCV);
router.get("/user/:userId", protect, authorize("admin", "manager"), getCVByUser);

// Expériences
router.post("/experience", protect, addExperience);
router.delete("/experience/:id", protect, deleteExperience);

// Formations
router.post("/formation", protect, addFormation);
router.delete("/formation/:id", protect, deleteFormation);

// Compétences
router.post("/competence", protect, addCompetence);
router.delete("/competence/:id", protect, deleteCompetence);

// Langues
router.post("/langue", protect, addLangue);
router.delete("/langue/:id", protect, deleteLangue);

// Hobbies
router.post("/hobby", protect, addHobby);
router.delete("/hobby/:id", protect, deleteHobby);

module.exports = router;