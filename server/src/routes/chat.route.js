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
} from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { uploadMessageFiles } from "../middlewares/multer.middleware.js";
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
