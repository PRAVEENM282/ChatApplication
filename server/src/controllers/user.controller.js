import User from "../models/User.js";
import ChatRoom from "../models/Chatroom.js";
import Message from "../models/Message.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

// Helper to escape regex special characters for safe search matching
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Searches users database matching q parameter in username or email.
 * Excludes the requester and paginates items.
 */
export const searchUsers = async (req, res) => {
  const { q = "", limit = 20, page = 1 } = req.query;
  const term = String(q).trim();

  if (!term)
    return res.status(400).json({ message: "A search query is required" });

  try {
    const currentUserId = req.userId;
    const perPage = Math.min(parseInt(limit, 10) || 20, 50);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * perPage;

    const rx = new RegExp(escapeRegex(term), "i");

    const filter = {
      _id: { $ne: currentUserId },
      $or: [{ username: rx }, { email: rx }],
    };

    const projection = "_id username publicKey email avatarUrl";

    const [items, total] = await Promise.all([
      User.find(filter)
        .select(projection)
        .sort({ username: 1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      items,
      page: pageNum,
      limit: perPage,
      total,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error("searchUsers error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Returns currently logged-in user profile details.
 */
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("_id username email publicKey avatarUrl settings createdAt updatedAt")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (err) {
    console.error("getMyProfile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMySettings = async (req, res) => {
  const allowed = [
    "notificationsEnabled",
    "readReceiptsEnabled",
    "encryptedFilePreviewsEnabled",
  ];

  const settings = {};
  allowed.forEach((key) => {
    if (typeof req.body?.[key] === "boolean") {
      settings[`settings.${key}`] = req.body[key];
    }
  });

  if (!Object.keys(settings).length) {
    return res.status(400).json({ message: "No valid settings provided" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: settings },
      { new: true }
    ).select("_id username email publicKey avatarUrl settings createdAt updatedAt");

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(user);
  } catch (err) {
    console.error("updateMySettings error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Updates public profile fields (username).
 */
export const updateUserProfile = async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: "username is required" });
  }
  try {
    const user = await User.findById(req.userId).exec();
    if (!user) {
      return res.sendStatus(404);
    }
    user.username = username;
    await user.save();

    const userToReturn = user.toObject();
    delete userToReturn.password;
    delete userToReturn.sessions;

    return res.status(200).json(userToReturn);
  } catch (err) {
    console.error("updateUserProfile error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "username is already taken" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Updates user password securely using bcrypt hashes.
 */
export const updateUserPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "missing password fields" });
  }

  try {
    const user = await User.findById(req.userId).select("+password").exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password" });
    }
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.password = newPasswordHash;
    await user.save();

    const userToReturn = user.toObject();
    delete userToReturn.password;
    delete userToReturn.sessions;

    return res.status(200).json(userToReturn);
  } catch (err) {
    console.error("updateUserPassword error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Updates avatar image. S3 file location has precedence if uploaded.
 */
export const updateUserAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file was uploaded." });
  }

  try {
    // Require S3 upload URL (no local fallback)
    if (!req.file.location) {
      return res.status(500).json({ message: "Upload failed: no S3 URL returned for avatar." });
    }
    const avatarUrl = req.file.location;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatarUrl: avatarUrl },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Error updating avatar:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Deletes user account, associated chatrooms, messages, and clears authentication session.
 */
export const getMyKeyVault = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+keyVault").lean().exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.keyVault) {
      return res.status(404).json({ message: "Key vault not found" });
    }

    return res.status(200).json(user.keyVault);
  } catch (err) {
    console.error("getMyKeyVault error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMyKeyVault = async (req, res) => {
  const { keyVault } = req.body;

  const requiredVaultFields = [
    "encryptedPrivateKey",
    "nonce",
    "salt",
    "opslimit",
    "memlimit",
  ];

  const missing = requiredVaultFields.filter((k) => !keyVault?.[k]);
  if (missing.length) {
    return res.status(400).json({
      message: `Invalid keyVault payload. Missing: ${missing.join(", ")}`,
    });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { keyVault },
      { new: true }
    )
      .select("+keyVault")
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Key vault updated" });
  } catch (err) {
    console.error("updateMyKeyVault error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Deletes user account, associated chatrooms, messages, and clears authentication session.
 */
export const deleteAccount = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const userId = req.userId;

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found." });
    }

    // Delete user record from database
    await User.findByIdAndDelete(userId).session(session);

    // Remove user references from any chatrooms they were participating in
    await ChatRoom.updateMany(
      { participants: userId },
      { $pull: { participants: userId } }
    ).session(session);

    // Delete any chatrooms that now have zero active participants
    await ChatRoom.deleteMany({ participants: { $size: 0 } }).session(session);

    // For high security, we delete user's message documents:
    await Message.deleteMany({ sender: userId }).session(session);

    await session.commitTransaction();
    session.endSession();

    // Clear client httpOnly refresh token cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: process.env.COOKIE_SAME_SITE || "Lax",
    });

    res.status(200).json({ message: "Account and associated data deleted successfully." });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteAccount error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
