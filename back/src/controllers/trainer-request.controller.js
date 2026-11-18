const User = require("../models/User");
const { sendEmail } = require("../services/email.service");
const config = require("../config/env");
const { decryptAES } = require("../services/encryption.service");

function safeDecrypt(value) {
  if (!value) return "";
  try { return decryptAES(value) || ""; } catch { return ""; }
}

const PUBLIC_FIELDS = "firstname lastname email phone createdAt approvalStatus approvalDecidedAt trainerProfile";

// GET /api/admin/trainer-requests?status=pending|rejected|all  (default: pending)
exports.listTrainerRequests = async (req, res) => {
  try {
    const status = ["pending", "rejected", "all"].includes(req.query.status) ? req.query.status : "pending";
    const filter = { role: "trainer" };
    filter.approvalStatus = status === "all" ? { $in: ["pending", "rejected"] } : status;

    const docs = await User.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).lean();
    // phone is stored encrypted at rest — decrypt for the admin view
    const requests = docs.map(u => ({ ...u, phone: safeDecrypt(u.phone) }));
    const pendingCount = await User.countDocuments({ role: "trainer", approvalStatus: "pending" });
    res.status(200).json({ requests, pendingCount });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

async function decide(req, res, decision) {
  try {
    const user = await User.findOne({ _id: req.params.id, role: "trainer" });
    if (!user) return res.status(404).json({ message: "Trainer request not found" });
    if (user.approvalStatus === decision) {
      return res.status(400).json({ message: `This trainer is already ${decision}` });
    }

    user.approvalStatus = decision;
    user.approvalDecidedAt = new Date();
    await user.save();

    // Best-effort email — the decision is saved even if SMTP is unavailable
    const approved = decision === "approved";
    sendEmail({
      to: user.email,
      subject: approved
        ? "Your Prologic Academy trainer account is approved"
        : "Your Prologic Academy trainer application",
      html: approved
        ? `<p>Hello ${user.firstname},</p>
           <p>Your trainer account has been approved. You can now sign in and create your first course:</p>
           <p><a href="${config.frontendUrl}/profile-authentication">Sign in to Prologic Academy</a></p>`
        : `<p>Hello ${user.firstname},</p>
           <p>Your trainer application was not approved at this time.
           Please contact the Prologic Academy team if you have any questions.</p>`
    }).catch(() => {});

    res.status(200).json({
      message: approved ? "Trainer approved — the account is now active" : "Trainer request rejected",
      user: { _id: user._id, email: user.email, approvalStatus: user.approvalStatus }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/admin/trainer-requests/:id/approve
exports.approveTrainer = (req, res) => decide(req, res, "approved");

// PATCH /api/admin/trainer-requests/:id/reject
exports.rejectTrainer = (req, res) => decide(req, res, "rejected");
