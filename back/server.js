const dotenv = require("dotenv");
dotenv.config();

const { createServer } = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./src/app");
const config = require("./src/config/env");
const connectDB = require("./src/config/db");
const redisClient = require("./src/config/redis.config");
const startDeadlineReminderJob = require("./src/jobs/deadlineReminder.job");
const { initBadges } = require("./src/services/badge.service");

// ✅ Fail fast on missing/invalid configuration
config.validateEnv();

// ✅ Create the HTTP server with Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"]
  }
});

// ✅ Map userId → socketId
const userSockets = new Map();

// ✅ SOCKET AUTH: the handshake must carry a valid JWT — anonymous sockets are
// rejected immediately instead of being able to register as any userId.
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || "").replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const user = await require('./src/services/session.service').authenticate(token);
    socket.data.userId = String(user._id);
    socket.data.sessionToken = token;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const tokenUserId = socket.data.userId;
  socket.join(`account:${tokenUserId}`);
  // Revalidate incoming events, not just the initial handshake.
  socket.use(async (_packet, next) => {
    try { await require('./src/services/session.service').authenticate(socket.data.sessionToken); next(); }
    catch { socket.disconnect(true); }
  });
  const expires = jwt.decode(socket.data.sessionToken).exp * 1000 - Date.now();
  const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(expires, 2147483647)));
  socket.on('disconnect', () => clearTimeout(expiryTimer));

  socket.on("register", (userId) => {
    // ✅ The registered userId MUST match the authenticated token subject
    if (!userId || userId.toString() !== tokenUserId) {
      socket.emit("auth_error", { message: "userId does not match authenticated user" });
      return;
    }

    userSockets.set(userId.toString(), socket.id);
  });

  socket.on("disconnect", () => {
    userSockets.forEach((socketId, userId) => {
      if (socketId === socket.id) userSockets.delete(userId);
    });
  });
});

// ✅ Expose io and userSockets globally (used by notification.service)
global.io = io;
global.userSockets = userSockets;

const startServer = async () => {
  try {
    // 1. MongoDB
    console.log("📦 Connecting to MongoDB...");
    await connectDB();

    // 2. Badges
    console.log("🏅 Initializing badges...");
    await initBadges();

    // 3. Redis (optional — cache degrades gracefully)
    console.log("✅ Connecting to Redis...");
    await redisClient.connect();

    // 4. Cron job
    startDeadlineReminderJob();

    // 5. HTTP server
    const PORT = config.port;
    httpServer.listen(PORT, () => {
      console.log("\n" + "=".repeat(50));
      console.log(`🚀 Server started on port ${PORT}`);
      console.log(`📍 Environment: ${config.nodeEnv}`);
      console.log(`🌐 URL: ${config.backendUrl}`);
      console.log(`🔌 Socket.io enabled (JWT-authenticated)`);
      console.log("=".repeat(50) + "\n");
    });
  } catch (error) {
    console.error("❌ Startup error:", error.message);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  console.log("\n⏹️ Shutting down...");
  await redisClient.disconnect();
  const mongoose = require("mongoose");
  await mongoose.connection.close();
  console.log("✅ Shutdown complete");
  process.exit(0);
});

startServer();
