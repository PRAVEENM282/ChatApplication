import ChatRoom from "../models/Chatroom.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import { saveFileMessage } from "./message.controller.js";
import { getIo } from "../socket/socketHandler.js";

const participantSelect = "username publicKey avatarUrl email";

const isRoomParticipant = (chatRoom, userId) =>
  chatRoom.participants.some((p) => p.toString() === userId.toString());

const isRoomAdmin = (chatRoom, userId) =>
  (chatRoom.admins || []).some((p) => p.toString() === userId.toString());

const parseJsonObject = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Creates or retrieves a one-to-one chatroom between two users.
 * Guarantees a single unique chatroom per user pair by sorting IDs.
 */
export const createChatRoom = async (req, res) => {
  const { recipientId } = req.body;
  const userId = req.userId;

  if (!recipientId) {
    return res.status(400).json({ message: "Recipient ID is required" });
  }

  // Prevent user from chatting with themselves
  if (userId === recipientId) {
    return res
      .status(400)
      .json({ message: "Cannot create chat room with yourself" });
  }

  try {
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    // Sort participant ObjectIds lexicographically to form a predictable composite key (participantPair)
    const participants = [userId, recipientId]
      .sort((a, b) => a.toString().localeCompare(b.toString()))
      .map((id) => new mongoose.Types.ObjectId(id));

    const participantPair = participants.map((p) => p.toString()).join("-");
    
    // Check if the chatroom already exists
    let chatRoom = await ChatRoom.findOne({
      participantPair: participantPair,
    }).populate("participants", "-password");

    if (!chatRoom) {
      try {
        chatRoom = new ChatRoom({
          participants: participants,
          type: "one_to_one",
        });
        await chatRoom.save();
        chatRoom = await chatRoom.populate(
          "participants",
          "-password"
        );
      } catch (saveError) {
        // Handle race conditions where two clients attempt creation simultaneously
        if (saveError.code === 11000) {
          chatRoom = await ChatRoom.findOne({
            participantPair: participantPair,
          }).populate("participants", "-password");

          if (chatRoom) {
            return res.status(200).json(chatRoom);
          }
        }
        console.error("Error saving chat room:", saveError);
        throw saveError;
      }
    }

    res.status(200).json(chatRoom);
  } catch (err) {
    console.error("Error creating chat room:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Creates a group chat. The requester is always included and made an admin.
 */
export const createGroupChat = async (req, res) => {
  const { name, participantIds = [] } = req.body;
  const userId = req.userId;

  const uniqueIds = [
    ...new Set([userId, ...participantIds].map((id) => id?.toString()).filter(Boolean)),
  ];

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Group name is required" });
  }
  if (uniqueIds.length < 3) {
    return res.status(400).json({ message: "A group needs at least 3 members including you" });
  }

  try {
    const users = await User.find({ _id: { $in: uniqueIds } }).select("_id").lean();
    if (users.length !== uniqueIds.length) {
      return res.status(400).json({ message: "One or more participants were not found" });
    }

    let chatRoom = await ChatRoom.create({
      participants: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
      type: "group",
      name: String(name).trim(),
      createdBy: userId,
      admins: [userId],
      readReceiptsEnabledBy: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
    });

    chatRoom = await chatRoom.populate("participants", participantSelect);
    res.status(201).json(chatRoom);
  } catch (err) {
    console.error("Error creating group chat:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Retrieves all chatrooms the authenticated user is participating in.
 * Populates participant details and the last exchanged message.
 */
export const getChatRooms = async (req, res) => {
  try {
    const currentUserId = req.userId;

    const chatRooms = await ChatRoom.find({ participants: currentUserId })
      .populate("participants", participantSelect)
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "username publicKey",
        },
      })
      .sort({ updatedAt: -1 })
      .exec();

    res.status(200).json(chatRooms);
  } catch (err) {
    console.error("Error fetching chat rooms:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Fetches historical messages of a specific chat room.
 * Authorizes that the requester is a participant.
 */
export const getChatMessages = async (req, res) => {
  const { chatroomId } = req.params;
  const currentUserId = req.userId;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);

    if (!chatRoom) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    // Authorization check
    const isParticipant = chatRoom.participants.some(
      (participantId) => participantId.toString() === currentUserId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "Access denied. You are not a participant in this chat room.",
      });
    }

    const messages = await Message.find({ chatroomId })
      .sort({ createdAt: 1 })
      .populate("sender", "username publicKey")
      .exec();

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching chat messages:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Zeroes the unread message count of a user in a specific chat room.
 */
export const markChatAsRead = async (req, res) => {
  const { chatroomId } = req.params;
  const { userId } = req;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    if (chatRoom.unreadCount.has(userId)) {
      chatRoom.unreadCount.set(userId, 0);
      await chatRoom.save();
    }

    res.status(200).json({ message: "Chat marked as read." });
  } catch (err) {
    console.error("Error marking chat as read:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateGroupChat = async (req, res) => {
  const { chatroomId } = req.params;
  const { name, avatarUrl } = req.body;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
    if (chatRoom.type !== "group") {
      return res.status(400).json({ message: "Only group chats can be updated here" });
    }
    if (!isRoomAdmin(chatRoom, req.userId)) {
      return res.status(403).json({ message: "Only group admins can update this group" });
    }

    if (typeof name === "string" && name.trim()) chatRoom.name = name.trim();
    if (typeof avatarUrl === "string") chatRoom.avatarUrl = avatarUrl.trim();
    await chatRoom.save();

    const populated = await chatRoom.populate("participants", participantSelect);
    res.status(200).json(populated);
  } catch (err) {
    console.error("updateGroupChat error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addGroupMembers = async (req, res) => {
  const { chatroomId } = req.params;
  const { participantIds = [] } = req.body;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
    if (chatRoom.type !== "group") return res.status(400).json({ message: "Not a group chat" });
    if (!isRoomAdmin(chatRoom, req.userId)) {
      return res.status(403).json({ message: "Only group admins can add members" });
    }

    const existing = new Set(chatRoom.participants.map((p) => p.toString()));
    const newIds = [...new Set(participantIds.map((id) => id?.toString()).filter(Boolean))]
      .filter((id) => !existing.has(id));

    if (newIds.length) {
      const users = await User.find({ _id: { $in: newIds } }).select("_id").lean();
      if (users.length !== newIds.length) {
        return res.status(400).json({ message: "One or more users were not found" });
      }
      chatRoom.participants.push(...newIds.map((id) => new mongoose.Types.ObjectId(id)));
      chatRoom.readReceiptsEnabledBy.push(...newIds.map((id) => new mongoose.Types.ObjectId(id)));
      await chatRoom.save();
    }

    const populated = await chatRoom.populate("participants", participantSelect);
    res.status(200).json(populated);
  } catch (err) {
    console.error("addGroupMembers error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const removeGroupMember = async (req, res) => {
  const { chatroomId, userId } = req.params;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
    if (chatRoom.type !== "group") return res.status(400).json({ message: "Not a group chat" });
    if (!isRoomAdmin(chatRoom, req.userId) && req.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not allowed to remove this member" });
    }

    chatRoom.participants = chatRoom.participants.filter((p) => p.toString() !== userId);
    chatRoom.admins = chatRoom.admins.filter((p) => p.toString() !== userId);
    chatRoom.mutedBy = chatRoom.mutedBy.filter((p) => p.toString() !== userId);
    chatRoom.archivedBy = chatRoom.archivedBy.filter((p) => p.toString() !== userId);
    chatRoom.readReceiptsEnabledBy = chatRoom.readReceiptsEnabledBy.filter((p) => p.toString() !== userId);
    chatRoom.unreadCount.delete(userId);

    if (chatRoom.participants.length === 0) {
      await ChatRoom.findByIdAndDelete(chatroomId);
      return res.status(200).json({ message: "Group deleted" });
    }

    if (!chatRoom.admins.length) chatRoom.admins = [chatRoom.participants[0]];
    await chatRoom.save();

    const populated = await chatRoom.populate("participants", participantSelect);
    res.status(200).json(populated);
  } catch (err) {
    console.error("removeGroupMember error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveGroupChat = async (req, res) => {
  req.params.userId = req.userId;
  return removeGroupMember(req, res);
};

export const updateChatPreference = async (req, res) => {
  const { chatroomId } = req.params;
  const { muted, archived, readReceipts } = req.body;
  const userId = req.userId.toString();

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
    if (!isRoomParticipant(chatRoom, userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const applyListPreference = (field, enabled) => {
      if (enabled === undefined) return;
      const current = new Set((chatRoom[field] || []).map((id) => id.toString()));
      if (enabled) current.add(userId);
      else current.delete(userId);
      chatRoom[field] = [...current].map((id) => new mongoose.Types.ObjectId(id));
    };

    applyListPreference("mutedBy", muted);
    applyListPreference("archivedBy", archived);
    applyListPreference("readReceiptsEnabledBy", readReceipts);
    await chatRoom.save();

    const populated = await chatRoom.populate("participants", participantSelect);
    res.status(200).json(populated);
  } catch (err) {
    console.error("updateChatPreference error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Handle multipart upload of encrypted file chunks to S3 and save the message.
 * Emits real-time socket events for recipient notification.
 */
export const handleFileUpload = async (req, res) => {
  if (
    !req.files ||
    req.files.length === 0 ||
    !req.body ||
    !req.params.chatroomId
  ) {
    return res
      .status(400)
      .json({ message: "No file was uploaded or missing message data." });
  }

  const firstChunk = req.files[0];

  const {
    header,
    keyNonce,
    encryptedKeyForRecipient,
    encryptedKeyForSelf,
    keyId,
    originalFilename,
    totalChunks,
    encryptedFileKeys,
  } = req.body;

  const encryptedFileKeysMap = parseJsonObject(encryptedFileKeys, {});

  if (!header || !keyNonce || !keyId) {
    return res.status(400).json({
      message: "Missing required encryption metadata in request body.",
    });
  }

  const chatroomId = req.params.chatroomId;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);
    if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
    if (!isRoomParticipant(chatRoom, req.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const expectedChunks = parseInt(totalChunks, 10) || req.files.length;
    if (req.files.length !== expectedChunks) {
      return res.status(400).json({ message: "Uploaded chunk count does not match metadata" });
    }

    const participantIds = chatRoom.participants.map((p) => p.toString());
    const hasNewKeyEnvelope = participantIds.every((id) => encryptedFileKeysMap[id]);
    const hasLegacyKeyEnvelope = encryptedKeyForRecipient && encryptedKeyForSelf;
    if (!hasNewKeyEnvelope && !hasLegacyKeyEnvelope) {
      return res.status(400).json({ message: "Missing encrypted file key envelopes" });
    }

    // Require S3 locations for uploaded chunks
    const chunkUrls = req.files.map((file) => {
      if (!file.location) throw new Error("Missing S3 URL for uploaded chunk");
      return file.location;
    });
    const storageKeys = req.files.map((file) => file.key || file.filename).filter(Boolean);
    const fileUrl = chunkUrls[0];

    const messageData = {
      chatroomId,
      sender: req.userId,
      type: firstChunk.mimetype.startsWith("image/") ? "image" : "file",
      fileMetadata: {
        filename: originalFilename,
        fileUrl,
        mimetype: firstChunk.mimetype,
        size: parseInt(req.body.size) || firstChunk.size,
        header,
        keyNonce,
        encryptedFileKeyForRecipient: encryptedKeyForRecipient || encryptedFileKeysMap[participantIds.find((id) => id !== req.userId.toString())],
        encryptedFileKeyForSender: encryptedKeyForSelf || encryptedFileKeysMap[req.userId.toString()],
        encryptedFileKeys: encryptedFileKeysMap,
        keyId,
        fileUrl,
        chunkUrls,
        storageKeys,
        totalChunks: expectedChunks,
      },
    };

    // Save message via message controller
    const savedMessage = await saveFileMessage(messageData);

    if (!savedMessage) {
      throw new Error("Failed to save message to database.");
    }

    const io = getIo();

    // Confirm transmission back to sender
    io.to(req.userId.toString()).emit(
      "message_sent_confirmation",
      savedMessage
    );

    // Broadcast message to active room participants
    io.to(chatroomId).emit("receive_message", savedMessage);
    
    // Broadcast notification to offline or background participants
    if (chatRoom) {
      const recipients = chatRoom.participants.filter(
        (p) => p.toString() !== req.userId.toString()
      );

      recipients.forEach((recipientId) => {
        io.to(recipientId.toString()).emit("new_message_notification", {
          chatroomId: savedMessage.chatroomId,
          message: savedMessage,
        });
      });
    }

    res.status(200).json({
      message: "File uploaded successfully.",
      _id: savedMessage._id,
      createdAt: savedMessage.createdAt,
      type: savedMessage.type,
      fileMetadata: savedMessage.fileMetadata,
    });
  } catch (err) {
    console.error("Error saving file message:", err);
    return res
      .status(500)
      .json({ message: "Internal server error during message saving." });
  }
};
