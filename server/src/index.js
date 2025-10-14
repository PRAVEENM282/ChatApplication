import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import { initializeSocketServer } from "./socket/socketHandler.js";

dotenv.config();

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(
  cors({
    origin: ["http://localhost:5173", "https://ct3g3zx8-5173.inc1.devtunnels.ms"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
connectDB();
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);

const server = http.createServer(app);
initializeSocketServer(server);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});