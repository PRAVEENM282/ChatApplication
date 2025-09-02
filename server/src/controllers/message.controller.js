import Chatroom from "../models/Chatroom.js";
import Message from "../models/Message.js";
import { catchAsync, AppError } from "../middlewares/errorHandler.js";

// Note: saveMessage is called by the socket handler, not an Express route,
// so it doesn't use catchAsync. It should have its own error handling.
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
    // Depending on your socket setup, you might want to emit an error back to the user
    return null; 
  }
};


export const getMessages = catchAsync(async (req, res, next) => {
  const { chatRoomId } = req.params;
  const messages = await Message.find({ chatRoomId })
    .populate("senderId", "username publicKey avatarUrl")
    .sort({ createdAt: 1 })
    .exec();
  res.status(200).json(messages);
});

export const markAsRead = catchAsync(async (req, res, next) => {
  const { messageId } = req.params;
  const message = await Message.findById(messageId);
  if (!message) return next(new AppError("Message not found", 404));
  
  message.status = "read";
  await message.save();
  
  res.status(200).json(message);
});