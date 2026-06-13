import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Load DB connection logic, routes, and socket server initializer
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import sessionRoutes from "./routes/session.route.js";
import { initializeSocketServer } from "./socket/socketHandler.js";
import { getAllowedOrigins, loadEnv, validateEnv } from "./config/env.js";
import mongoose from "mongoose";
import { getRedisClient } from "./config/redis.js";

loadEnv();
validateEnv();

const app = express();
// Default to port 3000 if not specified in environment
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable Cross-Origin Resource Sharing (CORS) with support for credentials/cookies
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
  })
);

// Middleware to parse incoming JSON payloads (50mb limit for large file metadata)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware to parse cookies (necessary for HttpOnly refresh tokens)
app.use(cookieParser());

// Serve static assets from the public directory (retained for backward compatibility or local backups)
// Static serving of local uploads is removed: all assets are served from S3 in production.
app.use(express.static("public"));

// Establish connection to the MongoDB database
connectDB();

// Attach API routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/sessions", sessionRoutes);

// Health endpoint for Docker/ops checks
app.get("/api/health", async (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongo = mongoState === 1 ? "connected" : "disconnected";

  let redis = "disconnected";
  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.ping();
      redis = "connected";
    } else {
      redis = "memory";
    }
  } catch {
    redis = "disconnected";
  }

  res.status(200).json({ status: "ok", mongo, redis });
});

// Catch-all route handler for unknown API requests (404)
app.use((req, res, next) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Global central error handler middleware
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Create HTTP server wrapping the Express app (required for Socket.IO coexistence)
const server = http.createServer(app);

// Setup Socket.IO real-time servers
initializeSocketServer(server);

// Start listening for requests on the specified port
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
