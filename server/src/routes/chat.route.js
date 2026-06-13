import express from "express";
import {
  createChatRoom,
  createGroupChat,
  getChatRooms,
  getChatMessages,
  markChatAsRead,
  handleFileUpload,
  updateGroupChat,
  addGroupMembers,
  removeGroupMember,
  leaveGroupChat,
  updateChatPreference,
  deleteChatRoom,
} from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { uploadMessageFiles, uploadAvatar } from "../middlewares/multer.middleware.js";
import { multerErrorHandler } from "../middlewares/errorHandler.middleware.js";

const router = express.Router();

// Enforce authentication on all chat operations
router.use(verifyJWT);

/**
 * @route   POST /api/chats
 * @desc    Establish or fetch a conversation room with another user
 * @access  Private
 */
router.post("/", createChatRoom);

/**
 * @route   POST /api/chats/groups
 * @desc    Create a group conversation
 * @access  Private
 */
router.post("/groups", createGroupChat);

/**
 * @route   GET /api/chats
 * @desc    Get list of active conversation rooms for current user
 * @access  Private
 */
router.get("/", getChatRooms);

/**
 * @route   GET /api/chats/:chatroomId/messages
 * @desc    Retrieve historical encrypted messages inside a chatroom
 * @access  Private
 */
router.get("/:chatroomId/messages", getChatMessages);

/**
 * @route   PUT /api/chats/:chatroomId/read
 * @desc    Reset unread message count for the current user in this chatroom
 * @access  Private
 */
router.put("/:chatroomId/read", markChatAsRead);

/**
 * @route   DELETE /api/chats/:chatroomId
 * @desc    Delete a chatroom and all its messages
 * @access  Private
 */
router.delete("/:chatroomId", deleteChatRoom);

/**
 * @route   PATCH /api/chats/:chatroomId/preferences
 * @desc    Update current user's per-chat preferences
 * @access  Private
 */
router.patch("/:chatroomId/preferences", updateChatPreference);

/**
 * @route   PATCH /api/chats/:chatroomId/group
 * @desc    Update group metadata
 * @access  Private
 */
router.patch("/:chatroomId/group", updateGroupChat);

/**
 * @route   POST /api/chats/:chatroomId/group/members
 * @desc    Add members to a group
 * @access  Private
 */
router.post("/:chatroomId/group/members", addGroupMembers);

/**
 * @route   DELETE /api/chats/:chatroomId/group/members/:userId
 * @desc    Remove a member from a group
 * @access  Private
 */
router.delete("/:chatroomId/group/members/:userId", removeGroupMember);

/**
 * @route   POST /api/chats/:chatroomId/group/leave
 * @desc    Leave a group
 * @access  Private
 */
router.post("/:chatroomId/group/leave", leaveGroupChat);

/**
 * @route   PUT /api/chats/:chatroomId/group/avatar
 * @desc    Upload group avatar image (S3)
 * @access  Private (admin only)
 */
router.put("/:chatroomId/group/avatar", uploadAvatar, async (req, res) => {
  const { chatroomId } = req.params;
  try {
    const ChatRoom = (await import("../models/Chatroom.js")).default;
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
    if (chatRoom.type !== "group") return res.status(400).json({ message: "Not a group chat" });

    const isAdmin = (chatRoom.admins || []).some(
      (p) => p.toString() === req.userId.toString()
    );
    if (!isAdmin) return res.status(403).json({ message: "Only admins can update group avatar" });
    if (!req.file?.location) return res.status(400).json({ message: "No image uploaded" });

    chatRoom.avatarUrl = req.file.location;
    await chatRoom.save();

    const populated = await chatRoom.populate("participants", "username publicKey avatarUrl email");
    res.status(200).json(populated);
  } catch (err) {
    console.error("group avatar upload error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route   POST /api/chats/:chatroomId/upload
 * @desc    Upload encrypted attachment file chunks to S3
 * @access  Private
 */
router.post(
  "/:chatroomId/upload",
  uploadMessageFiles,
  multerErrorHandler,
  handleFileUpload
);

export default router;
