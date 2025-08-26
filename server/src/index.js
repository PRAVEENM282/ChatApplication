import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import nacl from "tweetnacl";

import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.route.js";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import { saveMessage } from "./controllers/message.controller.js";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
app.use(cookieParser());
dotenv.config();
app.use(
  cors({
    origin: "http://localhost:5173", // allow frontend origin
    credentials: true, // allow cookies/auth headers if needed
  })
);

app.get("/", (req, res) => {
  res.send("Chat Application Backend");
});
connectDB();

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/chats", chatRoutes);

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log("Server listening on port 3000");
});