import dotenv from "dotenv";
dotenv.config();
const requiredEnvVars = [
  'MONGODB_URI', 
  'ACCESS_TOKEN_SECRET', 
  'REFRESH_TOKEN_SECRET',
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(envVar => {
    console.error(`   - ${envVar}`);
  });
  console.error('Please check your .env file and restart the server.');
  process.exit(1);
}

console.log('✅ All required environment variables are present');

import express from "express";
import http from "http";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import morgan from "morgan";

import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.route.js";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import { initializeSocketServer } from "./socket/socketHandler.js";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`Request sanitized - Field: ${key}`);
  },
}));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}else{
  app.use(morgan("combined"));
}

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 5 minutes"
});
app.use("/api/", apiLimiter);

app.get("/", (req, res) => {
  res.send("Chat Application Backend");
});

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);

app.all('*', (req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} not found`);
  err.statusCode = 404;
  next(err);
});

app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message: message,
    }
  });
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

initializeSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
