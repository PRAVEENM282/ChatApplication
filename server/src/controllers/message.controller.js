import Chatroom from "../models/Chatroom.js";
import Message from "../models/Message.js";

export const saveMessage = async (messageData) => {
  const { chatRoomId, senderId, encryptedText } = messageData; 
  
  try {
    const newMessage = new Message({
      chatRoomId, 
      senderId,
      encryptedText
    });

    await newMessage.save();
    await Chatroom.findByIdAndUpdate(chatRoomId, { lastMessage: newMessage._id });

    const populatedMessage = await newMessage.populate('senderId', 'username publicKey avatarUrl').exec();
    return populatedMessage;
  } catch (err) {
    console.error('Error saving message:', err);
  }
};


export const getMessages = async (req, res) => {
  const { chatRoomId } = req.params;
  try {
    const messages = await Message.find({ chatRoomId })
      .populate("senderId", "username publicKey avatarUrl")
      .sort({ createdAt: 1 })
      .exec();
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages" });
  }
};

export const markAsRead = async (req, res) => {
  const { messageId } = req.params;
  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    message.status = "read";
    await message.save();
    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ message: "Failed to update status" });
  }
};
