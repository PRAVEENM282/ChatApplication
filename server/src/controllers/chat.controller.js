import Chatroom from '../models/Chatroom.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { catchAsync, AppError } from "../middlewares/errorHandler.js";

export const createChatRoom = catchAsync(async (req, res, next) => {
  const { recipientId } = req.body;
  const userId = req.userId;

  if (userId === recipientId) {
    return next(new AppError("Cannot create chat room with yourself", 400));
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    return next(new AppError("Recipient not found", 404));
  }

  const participants = [userId, recipientId]
    .sort()
    .map(id => new mongoose.Types.ObjectId(id));
  
  const participantPair = participants.map(p => p.toString()).join('-');

  let chatRoom = await Chatroom.findOne({ participantPair: participantPair })
    .populate('participants', '-password -refreshToken');

  if (!chatRoom) {
    // A race condition check
    try {
      chatRoom = new Chatroom({
        participants: participants,
        type: 'one_to_one',
      });
      await chatRoom.save();
      chatRoom = await chatRoom.populate('participants', '-password -refreshToken');
    } catch (saveError) {
      if (saveError.code === 11000) { // Duplicate key error
        chatRoom = await Chatroom.findOne({ participantPair: participantPair })
          .populate('participants', '-password -refreshToken');
      } else {
        throw saveError;
      }
    }
  }

  res.status(200).json(chatRoom);
});

export const getChatRooms = catchAsync(async (req, res, next) => {
  const currentUserId = req.userId;
  const chatRooms = await Chatroom.find({ participants: currentUserId })
    .sort({ updatedAt: -1 })
    .populate('participants', '-password -refreshToken')
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'senderId',
        select: 'username'
      }
    })
    .exec();
    
  res.status(200).json(chatRooms);
});

export const createGroupChat = catchAsync(async (req, res, next) => {
  const { groupname, groupicon, members } = req.body;
  
  const participantIds = [...new Set([req.userId, ...members])].map(id => new mongoose.Types.ObjectId(id));
  
  if (participantIds.length < 2) {
    return next(new AppError("Group must have at least 2 members", 400));
  }

  const chatRoom = new Chatroom({
    participants: participantIds,
    type: "group",
    groupname,
    groupicon
  });
  await chatRoom.save();
  
  res.status(201).json(chatRoom);
});

export const addGroupMember = catchAsync(async (req, res, next) => {
  const { chatRoomId } = req.params;
  const { userId } = req.body;
  
  const chatRoom = await Chatroom.findById(chatRoomId);
  if (!chatRoom) return next(new AppError("Group not found", 404));
  if (chatRoom.type !== "group") return next(new AppError("Not a group chat", 400));
  
  if (!chatRoom.participants.includes(userId)) {
    chatRoom.participants.push(userId);
    await chatRoom.save();
  }
  
  res.status(200).json(chatRoom);
});

export const removeGroupMember = catchAsync(async (req, res, next) => {
  const { chatRoomId } = req.params;
  const { userId } = req.body;
  
  const chatRoom = await Chatroom.findById(chatRoomId);
  if (!chatRoom) return next(new AppError("Group not found", 404));
  
  chatRoom.participants = chatRoom.participants.filter(
    id => id.toString() !== userId
  );
  await chatRoom.save();
  
  res.status(200).json(chatRoom);
});

export const muteChat = catchAsync(async (req, res, next) => {
  const { chatRoomId } = req.params;
  const userId = req.userId;
  
  const room = await Chatroom.findById(chatRoomId);
  if (!room) return next(new AppError("Chat not found", 404));
  
  room.mutedBy.addToSet(userId);
  await room.save();
  
  res.status(200).json(room);
});