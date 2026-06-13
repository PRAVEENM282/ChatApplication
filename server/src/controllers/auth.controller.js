import User from "../models/User.js";
import ChatRoom from "../models/Chatroom.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { getRedisClient } from "../config/redis.js";

// Max active sessions per user to avoid database pollution
const MAX_SESSIONS = 5;

/**
 * Register a new user, generate ECDH-ready keypairs, and create initial session.
 */
export const register = async (req, res) => {
  const { username, email, password, publicKey, keyVault } = req.body;

  // Automatic multi-device key restore requires a server-side encrypted vault.
  // We keep it optional for backward compatibility, but new clients should always send it.

  try {
    // Check if username or email already exists
    const duplicate = await User.findOne({
      $or: [{ email: email }, { username: username }],
    })
      .lean()
      .exec();

    if (duplicate) {
      return res
        .status(409)
        .json({ message: "Username or email is already taken" });
    }

    // Hash the password with 10 salt rounds
    const hashPwd = await bcrypt.hash(password, 10);
    const newUserId = new mongoose.Types.ObjectId();

    // Create JWT Access Token (15m validity) and Refresh Token (7d validity)
    const accessToken = jwt.sign(
      { userId: newUserId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: newUserId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Extract device/client metadata from request headers
    const deviceInfo = req.headers["user-agent"] || "Unknown Device";
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";

    // Create user with the initial session details
    await User.create({
      _id: newUserId,
      username,
      email,
      password: hashPwd,
      publicKey,
      keyVault: keyVault || null,
      sessions: [{ token: refreshToken, deviceInfo, ipAddress }],
    });

    // Set refresh token in HttpOnly cookie
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: `New user ${username} created`,
      accessToken: accessToken,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Log in an existing user, check credentials, push new session, and rotate out old sessions if limit is exceeded.
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Explicitly query password and sessions since they are omitted by default
    const foundUser = await User.findOne({ email: email })
      .select("+password +sessions +keyVault")
      .exec();

    if (!foundUser || !foundUser.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password hash
    const match = await bcrypt.compare(password, foundUser.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create tokens
    const accessToken = jwt.sign(
      { userId: foundUser._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { userId: foundUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Get client request properties
    const deviceInfo = req.headers["user-agent"] || "Unknown Device";
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";

    // Enforce active session limits (evict oldest first)
    if (foundUser.sessions.length >= MAX_SESSIONS) {
      foundUser.sessions.shift(); // Evict oldest session
    }

    // Append current login session details
    foundUser.sessions.push({ token: refreshToken, deviceInfo, ipAddress });
    await foundUser.save();

    // Set refresh token in HttpOnly cookie
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Attempt to fetch cached recent messages from Redis for each chatroom
    const redisClient = getRedisClient();
    let recentMessagesByChat = {};
    try {
      if (redisClient) {
        const rooms = await ChatRoom.find({ participants: foundUser._id }).select("_id").lean();
        for (const r of rooms) {
          try {
            const key = `chat:${r._id}:recent`;
            const items = await redisClient.lrange(key, 0, -1);
            recentMessagesByChat[r._id] = items.map((i) => JSON.parse(i)).reverse();
          } catch (e) {
            recentMessagesByChat[r._id] = [];
          }
        }
      }
    } catch (err) {
      console.error("Error fetching recent messages from Redis on login:", err);
    }

    res.status(200).json({
      message: `${foundUser.username} welcome back`,
      accessToken: accessToken,
      // Encrypted key vault enables automatic private key restore on any device.
      keyVault: foundUser.keyVault || null,
      recentMessagesByChat,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Logs out user by revoking current active refresh token session and clearing cookie.
 */
export const logout = async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(204); // No content
  }
  const refreshToken = cookies.jwt;

  // Clear cookie from the client browser
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAME_SITE || "Lax",
  });

  try {
    const foundUser = await User.findOne({ "sessions.token": refreshToken })
      .select("+sessions")
      .exec();

    if (!foundUser) {
      return res.sendStatus(204);
    }

    // Remove the current session token from db
    foundUser.sessions = foundUser.sessions.filter(
      (s) => s.token !== refreshToken
    );
    await foundUser.save();

    return res.sendStatus(204);
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Verify current refresh token, issue a rotated new refresh token + access token (Token Rotation protection).
 */
export const refresh = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) {
    return res.sendStatus(401); // Unauthorized
  }
  const refreshToken = cookies.jwt;

  try {
    // Find the user owning this specific active session token
    const foundUser = await User.findOne({ "sessions.token": refreshToken })
      .select("+sessions")
      .exec();

    if (!foundUser) {
      return res.status(403).json({ message: "Unauthorized or invalid session" });
    }

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      async (err, decoded) => {
        if (err || foundUser._id.toString() !== decoded.userId) {
          // Token expired or tampered with
          return res.sendStatus(403);
        }

        // Generate rotated credentials
        const accessToken = jwt.sign(
          { userId: foundUser._id },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        const newRefreshToken = jwt.sign(
          { userId: foundUser._id },
          process.env.REFRESH_TOKEN_SECRET,
          { expiresIn: "7d" }
        );

        // Find and update current session inside the user document
        const sessionIndex = foundUser.sessions.findIndex(
          (s) => s.token === refreshToken
        );

        if (sessionIndex !== -1) {
          foundUser.sessions[sessionIndex].token = newRefreshToken;
          foundUser.sessions[sessionIndex].lastActive = new Date();
        } else {
          // Fallback if session wasn't located: push new session
          const deviceInfo = req.headers["user-agent"] || "Unknown Device";
          const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";
          foundUser.sessions.push({ token: newRefreshToken, deviceInfo, ipAddress });
        }

        await foundUser.save();

        // Refresh client HttpOnly cookie
        res.cookie("jwt", newRefreshToken, {
          httpOnly: true,
          secure: process.env.COOKIE_SECURE === "true",
          sameSite: process.env.COOKIE_SAME_SITE || "Lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ accessToken });
      }
    );
  } catch (err) {
    console.error("Session refresh error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET active sessions list of authenticated user (tokens stripped out for security).
 */
export const getMySessions = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("+sessions")
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Map sessions to remove secret tokens before passing to client UI
    const safeSessions = (user.sessions || []).map((s) => ({
      _id: s._id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      lastActive: s.lastActive,
      createdAt: s.createdAt,
      isCurrent: req.cookies?.jwt === s.token,
    }));

    res.status(200).json(safeSessions);
  } catch (err) {
    console.error("Error retrieving sessions:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Revoke specific session by session ID.
 */
export const revokeSession = async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required" });
  }

  try {
    const user = await User.findById(req.userId).select("+sessions").exec();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the session to revoke
    const sessionToRevoke = user.sessions.id(sessionId);
    if (!sessionToRevoke) {
      return res.status(404).json({ message: "Session not found" });
    }

    // If it's the current session, instruct client to log out fully by clearing cookie
    if (req.cookies?.jwt === sessionToRevoke.token) {
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: process.env.COOKIE_SAME_SITE || "Lax",
      });
    }

    // Delete session from DB
    user.sessions.pull(sessionId);
    await user.save();

    res.status(200).json({ message: "Session revoked successfully" });
  } catch (err) {
    console.error("Revoke session error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Revoke all sessions (except option for current session).
 */
export const revokeAllSessions = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+sessions").exec();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentToken = req.cookies?.jwt;

    // Retain only the current active browser session
    user.sessions = user.sessions.filter((s) => s.token === currentToken);
    await user.save();

    res.status(200).json({ message: "Logged out from all other devices successfully" });
  } catch (err) {
    console.error("Revoke all sessions error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};