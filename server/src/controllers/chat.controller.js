import ChatRoom from "../models/Chatroom.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import { saveFileMessage } from "./message.controller.js";
import { getIo } from "../socket/socketHandler.js";

export const createChatRoom = async (req, res) => {
  const { recipientId } = req.body;
  const userId = req.userId;

  if (!recipientId) {
    return res.status(400).json({ message: "Recipient ID is required" });
  }

  // Prevent creating chat room with self
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

    const participants = [userId, recipientId]
      .sort((a, b) => a.toString().localeCompare(b.toString()))
      .map((id) => new mongoose.Types.ObjectId(id));

    const participantPair = participants.map((p) => p.toString()).join("-");
    let chatRoom = await ChatRoom.findOne({
      participantPair: participantPair,
    }).populate("participants", "-password -refreshToken");

    if (!chatRoom) {
      try {
        chatRoom = new ChatRoom({
          participants: participants,
          type: "one_to_one",
        });
        await chatRoom.save();
        chatRoom = await chatRoom.populate(
          "participants",
          "-password -refreshToken"
        );
      } catch (saveError) {
        if (saveError.code === 11000) {
          chatRoom = await ChatRoom.findOne({
            participantPair: participantPair,
          }).populate("participants", "-password -refreshToken");

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

export const getChatRooms = async (req, res) => {
  try {
    const currentUserId = req.userId;

    const chatRooms = await ChatRoom.find({ participants: currentUserId })
      .populate("participants", "username publicKey avatarUrl")
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

export const getChatMessages = async (req, res) => {
  const { chatroomId } = req.params;
  const currentUserId = req.userId;

  try {
    const chatRoom = await ChatRoom.findById(chatroomId);

    if (!chatRoom) {
      return res.status(404).json({ message: "Chat room not found" });
    }
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
  } = req.body;

  if (
    !header ||
    !keyNonce ||
    !encryptedKeyForRecipient ||
    !encryptedKeyForSelf ||
    !keyId
  ) {
    return res.status(400).json({
      message: "Missing required encryption metadata in request body.",
    });
  }

  const chatroomId = req.params.chatroomId;
  const safeKeyId = keyId.replace(/\+/g, "-").replace(/\//g, "_");
  const clientFileName = `${safeKeyId}.chunk0.enc`;

  try {
    console.log(req.files);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${baseUrl}/uploads/messages/${clientFileName}`;

    const messageData = {
      chatroomId,
      sender: req.userId,
      type: firstChunk.mimetype.startsWith("image/") ? "image" : "file",
      fileMetadata: {
        filename: originalFilename,
        fileUrl,
        mimetype: firstChunk.mimetype,
        size: firstChunk.size,
        header,
        keyNonce,
        encryptedFileKeyForRecipient: encryptedKeyForRecipient,
        encryptedFileKeyForSender: encryptedKeyForSelf,
        keyId,
      },
    };

    const savedMessage = await saveFileMessage(messageData);

    if (!savedMessage) {
      throw new Error("Failed to save message to database.");
    }

    const io = getIo();

    io.to(req.userId.toString()).emit(
      "message_sent_confirmation",
      savedMessage
    );

    io.to(chatroomId).emit("receive_message", savedMessage);
    const room = await ChatRoom.findById(chatroomId);
    if (room) {
      const recipients = room.participants.filter(
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