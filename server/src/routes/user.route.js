import express from "express";
import {
  searchUsers,
  getMyProfile,
  updateUserProfile,
  updateUserPassword,
  updateUserAvatar,
  deleteAccount,
  getMyKeyVault,
  updateMyKeyVault,
  updateMySettings,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { uploadAvatar } from "../middlewares/multer.middleware.js";

const router = express.Router();

// Enforce authentication on all user settings/profile operations
router.use(verifyJWT);

/**
 * @route   GET /api/users/search
 * @desc    Find users by username or email for starting chats
 * @access  Private
 */
router.get("/search", searchUsers);

/**
 * @route   GET /api/users/me
 * @desc    Get authenticated user's own profile detail
 * @access  Private
 */
router.get("/me", getMyProfile);

/**
 * @route   GET /api/users/me/key-vault
 * @desc    Fetch encrypted private key vault for automatic multi-device restore
 * @access  Private
 */
router.get("/me/key-vault", getMyKeyVault);

/**
 * @route   PATCH /api/users/me/settings
 * @desc    Update account-level security/chat settings
 * @access  Private
 */
router.patch("/me/settings", updateMySettings);

/**
 * @route   PUT /api/users/me/key-vault
 * @desc    Update encrypted private key vault (used after password change / migration)
 * @access  Private
 */
router.put("/me/key-vault", updateMyKeyVault);

/**
 * @route   PUT /api/users/profile
 * @desc    Update username
 * @access  Private
 */
router.put("/profile", updateUserProfile);

/**
 * @route   PUT /api/users/password
 * @desc    Update login password securely
 * @access  Private
 */
router.put("/password", updateUserPassword);

/**
 * @route   PUT /api/users/avatar
 * @desc    Upload avatar picture (S3 upload pipeline)
 * @access  Private
 */
router.put("/avatar", uploadAvatar, updateUserAvatar);

/**
 * @route   DELETE /api/users/me
 * @desc    Delete user account and all matching chat session data
 * @access  Private
 */
router.delete("/me", deleteAccount);

export default router;
