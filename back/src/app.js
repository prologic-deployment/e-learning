const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const config = require("./config/env");
const app = express();

const authRoutes = require("./routes/auth.routes");
const fileRoutes = require("./routes/file.routes");
const userRoutes = require("./routes/user.routes");
const courseRoutes = require("./routes/course.routes");
const enrollmentRoutes = require("./routes/enrollment.routes");
const lessonRoutes = require("./routes/lesson.routes");
const managerRoutes = require("./routes/manager.routes");
const purchaseRoutes = require("./routes/purchase.routes");
const profileRoutes = require("./routes/profile.routes");
const adminRoutes = require("./routes/admin.routes");
const cartRoutes = require("./routes/cart.routes");
const quizRoutes = require("./routes/quiz.routes");
const badgeRoutes = require("./routes/badge.routes");
const cvRoutes = require("./routes/cv.routes");
const certificateRoutes = require("./routes/certificate.routes");
const notificationRoutes = require("./routes/notification.routes");
const statsRoutes = require("./routes/stats.routes");
const reviewRoutes = require("./routes/review.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const nlpRoutes = require("./routes/nlp.routes");
const recommendationRoutes = require("./routes/recommendation.routes");

// ✅ SECURITY HEADERS (XSS protection, no-sniff, frameguard, HSTS in prod…)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // allow media from the API origin
  })
);

// ✅ CORS allowlist — no more wildcard
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server calls with no Origin header
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  })
);

// ✅ Body size limits (DoS protection)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ❌ PUBLIC /uploads STATIC REMOVED — course content is now delivered through the
// authenticated, access-controlled streaming route (file.routes.js).
// Only avatars remain public (they are meant to be visible).
app.use(
  "/uploads/avatars",
  express.static(path.join(__dirname, "../uploads/avatars"), {
    maxAge: "7d",
    index: false
  })
);

app.use("/api/stats", statsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/cv", cvRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/nlp", nlpRoutes);
app.use("/api/recommendations", recommendationRoutes);

app.get("/", async (req, res) => {
  const mongoose = require("mongoose");
  const mongoHealth = mongoose.connection.readyState === 1;

  res.json({
    success: true,
    message: " Backend E-learning API is running",
    services: {
      api: " Online",
      mongodb: mongoHealth ? " Connected" : " Disconnected"
    },
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} introuvable`
  });
});

// ✅ Central error handler — never leaks internals to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer file-type errors and CORS rejections get clear messages
  const safeMessage =
    err.message === "File type not allowed"
      ? "File type not allowed"
      : err.message === "Not allowed by CORS"
        ? "Origin not allowed"
        : config.prodLike
          ? "Server error"
          : err.message;

  if (!config.prodLike) {
    console.error(" Erreur:", err.message);
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: safeMessage
  });
});

module.exports = app;
