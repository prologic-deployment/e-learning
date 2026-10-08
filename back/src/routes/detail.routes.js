const router = require("express").Router();
const { protect } = require("../middlewares/auth.middleware");
router.get(
  "/:kind/:id",
  protect,
  require("../controllers/detail.controller").getDetail,
);
module.exports = router;
