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
import cookieParser from "cookie-parser";
import csurf from 'csurf'; // Import csurf

import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import { initializeSocketServer } from "./socket/socketHandler.js";
import { AppError, globalErrorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// --- CSRF Protection Setup ---
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Endpoint for the frontend to get a fresh CSRF token
// It needs to run the middleware itself to generate the token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
// --- End CSRF Setup ---

app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`Request sanitized - Field: ${key}`);
  },
}));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
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

// --- Apply Routes with Selective Middleware ---

// Auth routes DO NOT get CSRF protection as they handle session creation/refresh
app.use("/api/auth", authRoutes);

// All other API routes that modify state should be protected
app.use("/api/users", csrfProtection, userRoutes);
app.use("/api/chats", csrfProtection, chatRoutes);

// Catch-all for undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Global error handler
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

initializeSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

