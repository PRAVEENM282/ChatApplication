import express from "express";
import { register, login, logout, refresh } from "../controllers/auth.controller.js";

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with X25519 public key
 * @access  Public
 */
router.post("/register", register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user, push session, and return access token
 * @access  Public
 */
router.post("/login", login);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke current refresh token and clear cookies
 * @access  Public (Uses client cookie)
 */
router.post("/logout", logout);

/**
 * @route   GET /api/auth/refresh
 * @desc    Rotate expired access and refresh tokens
 * @access  Public (Cookie authentication)
 */
router.get("/refresh", refresh);

export default router;