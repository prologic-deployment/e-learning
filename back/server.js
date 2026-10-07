const dotenv = require("dotenv");
// Also silence repeated dotenv banners from transitive dependencies.
process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ quiet: true });

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

let reminderJob;
let shuttingDown = false;

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
    void redisClient.connect(); // Optional cache must never gate HTTP startup.

    // 4. Cron job
    reminderJob = startDeadlineReminderJob();

    // 5. HTTP server
    const PORT = config.port;
    httpServer.listen(PORT, "0.0.0.0", () => {
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

// SIGINT normally comes from Ctrl+C/terminal interruption. Never silently ignore it.
// SIGTERM is also used by supervisors and configured nodemon restarts.
async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nStopping backend: received ${signal}. Port ${config.port} will become unavailable.`);
  const deadline = setTimeout(() => {
    console.error('Shutdown exceeded 10 seconds; forcing exit.');
    process.exit(1);
  }, 10000);
  try {
    await reminderJob?.stop();
    await reminderJob?.destroy();
    await new Promise(resolve => {
      io.close(resolve);
      httpServer.closeAllConnections?.();
    });
    await redisClient.disconnect();
    await require('mongoose').connection.close();
    clearTimeout(deadline);
    console.log('Shutdown complete. Restart the backend before using the frontend.');
    process.exit(exitCode);
  } catch {
    clearTimeout(deadline);
    console.error('Backend shutdown failed.');
    process.exit(1);
  }
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
httpServer.on('error', error => {
  if (error.code === 'EADDRINUSE') console.error(`Cannot start: port ${config.port} is already in use. Stop the other listener or align PORT and the frontend proxy.`);
  else console.error(`HTTP server failed (${error.code || 'unknown error'}).`);
  void shutdown('HTTP server error', 1);
});

startServer();
