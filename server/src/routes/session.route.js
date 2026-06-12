import express from "express";
import { getMySessions, revokeSession, revokeAllSessions } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";

const router = express.Router();

// Apply JWT verification middleware to all session routes
router.use(verifyJWT);

/**
 * @route   GET /api/sessions
 * @desc    Get list of active sessions/devices for current user
 * @access  Private
 */
router.get("/", getMySessions);

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Revoke and terminate a specific device session
 * @access  Private
 */
router.delete("/:sessionId", revokeSession);

/**
 * @route   DELETE /api/sessions
 * @desc    Revoke and terminate all device sessions except current one
 * @access  Private
 */
router.delete("/", revokeAllSessions);

export default router;
