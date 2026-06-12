import Message from "../models/Message.js";
import ChatRoom from "../models/Chatroom.js";
import { getRedisClient } from "../config/redis.js";

/**
 * Updates the associated chatroom's lastMessage reference and increments
 * the unread message count for all other participants in the room.
 * @param {Object} message - The newly created Message document
 */
const updateChatRoom = async (message) => {
  const chatRoom = await ChatRoom.findById(message.chatroomId);
  if (chatRoom) {
    // Set last message pointer
    chatRoom.lastMessage = message._id;
    const sender = message.sender.toString();

    // Increment unread counts for all participants except the sender
    chatRoom.participants.forEach((participantId) => {
      const id = participantId.toString();
      if (id !== sender) {
        const currentCount = chatRoom.unreadCount.get(id) || 0;
        chatRoom.unreadCount.set(id, currentCount + 1);
      }
    });
    await chatRoom.save();
  }
};

/**
 * Populates sender and related details for a message by message ID.
 * @param {string} messageId - The ID of the message to populate
 * @returns {Promise<Object>} Populated Message document
 */
const populateMessage = (messageId) => {
  return Message.findById(messageId)
    .populate("sender", "username publicKey avatarUrl")
    .exec();
};

async function cacheMessageInRedis(message) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient) return;
    const key = `chat:${message.chatroomId}:recent`;
    const payload = JSON.stringify({
      _id: message._id,
      chatroomId: message.chatroomId,
      sender: message.sender,
      type: message.type,
      fileMetadata: message.fileMetadata || null,
      createdAt: message.createdAt,
    });
    await redisClient.lpush(key, payload);
    await redisClient.ltrim(key, 0, 49); // keep latest 50
  } catch (err) {
    console.error("Redis cache error (cacheMessageInRedis):", err);
  }
}

/**
 * Persists a text message in the database, updates the room preview metadata,
 * and returns the fully populated message object.
 * @param {Object} messageData - The fields of the text message to save
 */
export const saveMessage = async (messageData) => {
  const {
    chatroomId,
    sender,
    encryptedTextForSender,
    encryptedTextForRecipient,
    encryptedPayloads,
  } = messageData;

  try {
    const newMessage = await Message.create({
      chatroomId,
      sender,
      encryptedTextForSender,
      encryptedTextForRecipient,
      encryptedPayloads: encryptedPayloads || {},
      type: "text",
    });

    // Update unread count and latest message for the chatroom
    await updateChatRoom(newMessage);
    const populated = await populateMessage(newMessage._id);
    // Cache in Redis for fast retrieval on login
    cacheMessageInRedis(populated).catch(() => {});
    return populated;
  } catch (err) {
    console.error("Error saving message:", err);
    throw err;
  }
};

/**
 * Persists an encrypted file/attachment message (image or general file) in the database,
 * updates the room preview metadata, and returns the fully populated message object.
 * @param {Object} messageData - The fields of the file message to save
 */
export const saveFileMessage = async (messageData) => {
  const {
    chatroomId,
    sender,
    type,
    fileMetadata,
  } = messageData;

  try {
    const newMessage = await Message.create({
      chatroomId,
      sender,
      type,
      fileMetadata: fileMetadata,
    });

    // Update unread count and latest message for the chatroom
    await updateChatRoom(newMessage);
    return await populateMessage(newMessage._id);
  } catch (err) {
    console.error("Error saving file message:", err);
    throw err;
  }
};

/**
 * Updates the status of a specific message (e.g., from 'sent' to 'delivered' or 'read').
 * @param {string} messageId - The ID of the message to update
 * @param {string} status - The target status enum value
 */
export const updateMessageStatus = async (messageId, status) => {
  try {
    await Message.findByIdAndUpdate(messageId, { status });
  } catch (err) {
    console.error("Error updating message status:", err);
  }
};
