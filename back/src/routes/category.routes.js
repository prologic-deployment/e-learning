const express = require("express");
const router = express.Router();
const { getCategories } = require("../controllers/category.controller");

// Public — the storefront needs categories before anyone signs in
router.get("/", getCategories);

module.exports = router;
