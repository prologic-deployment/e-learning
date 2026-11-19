const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const { list, create, update, remove } = require("../controllers/voucher.controller");

// ✅ Admin only — vouchers can make courses free
router.use(protect, authorize("admin"));
router.get("/", list);
router.post("/", create);
router.patch("/:id", update);
router.delete("/:id", remove);

module.exports = router;
