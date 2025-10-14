import Message from "../models/Message.js";
import ChatRoom from "../models/Chatroom.js";

const updateChatRoom = async (message) => {
  const chatRoom = await ChatRoom.findById(message.chatroomId);
  if (chatRoom) {
    chatRoom.lastMessage = message._id;
    const sender = message.sender.toString();

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

const populateMessage = (messageId) => {
  return Message.findById(messageId)
    .populate("sender", "username publicKey avatarUrl")
    .exec();
};

export const saveMessage = async (messageData) => {
  const {
    chatroomId,
    sender,
    encryptedTextForSender,
    encryptedTextForRecipient,
  } = messageData;

  try {
    const newMessage = await Message.create({
      chatroomId,
      sender,
      encryptedTextForSender,
      encryptedTextForRecipient,
      type: "text",
    });

    await updateChatRoom(newMessage);
    return await populateMessage(newMessage._id);
  } catch (err) {
    console.error("Error saving message:", err);
    throw err;
  }
};

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

    await updateChatRoom(newMessage);
    return await populateMessage(newMessage._id);
  } catch (err) {
    console.error("Error saving file message:", err);
    throw err;
  }
};

export const updateMessageStatus = async (messageId, status) => {
  try {
    await Message.findByIdAndUpdate(messageId, { status });
  } catch (err) {
    console.error("Error updating message status:", err);
  }
};