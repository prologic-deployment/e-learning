const crypto = require("crypto");
const Voucher = require("../models/Voucher");
const Course = require("../models/Course");

const EDITABLE = ["description", "course", "type", "value", "maxUses", "perUserLimit", "emailDomain", "startsAt", "expiresAt", "active"];

/** Normalise admin input: empty strings → null, numbers parsed */
function clean(body) {
  const out = {};
  for (const k of EDITABLE) {
    if (body[k] === undefined) continue;
    let v = body[k];
    if (v === "" || v === null) v = null;
    if (["value", "maxUses", "perUserLimit"].includes(k) && v !== null) v = Number(v);
    if (k === "emailDomain" && v) v = String(v).trim().toLowerCase().replace(/^@/, "");
    if (k === "active") v = v !== false && v !== "false";
    out[k] = v;
  }
  return out;
}

async function checkCourse(courseId) {
  if (!courseId) return null;
  const course = await Course.findById(courseId).select("title price");
  if (!course) return "Course not found";
  if (!(course.price > 0)) return "This course is already free";
  return null;
}

function generateCode() {
  return "PA-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

const view = (v) => {
  const o = v.toObject ? v.toObject() : v;
  return {
    ...o,
    redemptions: (o.redemptions || []).slice(-50).reverse(),
    remaining: o.maxUses ? Math.max(0, o.maxUses - o.usedCount) : null,
    status: !o.active ? "inactive"
      : o.expiresAt && new Date(o.expiresAt) <= new Date() ? "expired"
      : o.startsAt && new Date(o.startsAt) > new Date() ? "scheduled"
      : o.maxUses && o.usedCount >= o.maxUses ? "used up"
      : "active"
  };
};

// GET /api/vouchers
exports.list = async (req, res) => {
  try {
    const vouchers = await Voucher.find()
      .populate("course", "title price salePrice saleEndsAt")
      .populate("redemptions.user", "firstname lastname email")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, vouchers: vouchers.map(view) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/vouchers
exports.create = async (req, res) => {
  try {
    const data = clean(req.body || {});
    const code = String(req.body?.code || "").trim().toUpperCase() || generateCode();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Code: 3–32 letters, digits, - or _" });
    }
    if (!data.type || data.value == null) {
      return res.status(400).json({ success: false, message: "Choose a discount type and value" });
    }
    const courseErr = await checkCourse(data.course);
    if (courseErr) return res.status(400).json({ success: false, message: courseErr });
    if (await Voucher.exists({ code })) {
      return res.status(409).json({ success: false, message: "This code already exists" });
    }
    const voucher = await Voucher.create({ ...data, code, createdBy: req.user._id });
    await voucher.populate("course", "title price salePrice saleEndsAt");
    res.status(201).json({ success: true, voucher: view(voucher) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/vouchers/:id
exports.update = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" });
    const data = clean(req.body || {});
    if (data.course !== undefined) {
      const courseErr = await checkCourse(data.course);
      if (courseErr) return res.status(400).json({ success: false, message: courseErr });
    }
    Object.assign(voucher, data);
    await voucher.save();
    await voucher.populate("course", "title price salePrice saleEndsAt");
    res.status(200).json({ success: true, voucher: view(voucher) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/vouchers/:id — used vouchers are kept (deactivated) for the order history
exports.remove = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" });
    if (voucher.usedCount > 0) {
      voucher.active = false;
      await voucher.save();
      return res.status(200).json({ success: true, deactivated: true, message: "Voucher already used — deactivated instead of deleted" });
    }
    await voucher.deleteOne();
    res.status(200).json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
