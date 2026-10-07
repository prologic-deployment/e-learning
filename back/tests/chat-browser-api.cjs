// Disposable test data only. Never connects to an operator's database or AI provider.
const crypto = require("crypto");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.CACHE_ENABLED = "false";
process.env.CORS_ORIGINS = "http://localhost:4200,http://127.0.0.1:4200";
delete process.env.GEMINI_API_KEY;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await require("../src/models/Course").create({
    title: "TEST ONLY Python foundations",
    description: "Isolated browser test record",
    price: 0,
    isApproved: true,
    trainer: new mongoose.Types.ObjectId(),
  });
  const server = require("../src/app").listen(5000, "0.0.0.0", () =>
    console.log("Disposable chatbot test API ready"),
  );
  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
})().catch(() => {
  console.error("Test API startup failed");
  process.exit(1);
});
