import Chatroom from '../models/Chatroom.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const createChatRoom = async (req, res) => {
    const { recipientId } = req.body;
    const userId = req.userId;
    
    if (!recipientId) {
        return res.status(400).json({ message: "Recipient ID is required" });
    }

    if (userId === recipientId) {
        return res.status(400).json({ message: "Cannot create chat room with yourself" });
    }

    try {
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: "Recipient not found" });
        }

        const participants = [userId, recipientId]
            .sort((a, b) => a.toString().localeCompare(b.toString()))
            .map(id => new mongoose.Types.ObjectId(id));

        const participantPair = participants.map(p => p.toString()).join('-');

        let chatRoom = await Chatroom.findOne({
            participantPair: participantPair
        }).populate('participants', '-password -refreshToken');

        if (!chatRoom) {
            try {
                chatRoom = new Chatroom({
                    participants: participants,
                    type: 'one_to_one',

                });
                await chatRoom.save();
                chatRoom = await chatRoom.populate('participants', '-password -refreshToken');
            } catch (saveError) {
                if (saveError.code === 11000) {
                    chatRoom = await Chatroom.findOne({
                        participantPair: participantPair
                    }).populate('participants', '-password -refreshToken');
                    
                    if (chatRoom) {
                        return res.status(200).json(chatRoom);
                    }
                }
                console.error('Error saving chat room:', saveError);
                throw saveError;
            }
        }

        res.status(200).json(chatRoom);
    } catch (err) {
        console.error('Error creating chat room:', err);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getChatRooms = async (req,res) =>{
    const currentUserId = req.userId;

    try{
        const chatRooms = await Chatroom.find({participants: currentUserId}).sort({updatedAt: -1}).populate('participants', '-password -refreshToken').populate('lastMessage').exec();
        res.status(200).json(chatRooms);

    }catch(err){
        console.error('Error fetching chat rooms:', err);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const createGroupChat = async (req, res) => {
  const { groupname, groupicon, members } = req.body; 
  if (!groupname || !Array.isArray(members) || members.length < 2)
    return res.status(400).json({ message: "Group name and at least 2 members required" });
  try {
    const participantIds = members.map(id => new mongoose.Types.ObjectId(id));
    const chatRoom = new Chatroom({
      participants: participantIds,
      type: "group",
      groupname,
      groupicon
    });
    await chatRoom.save();
    res.status(201).json(chatRoom);
  } catch (err) {
    res.status(500).json({ message: "Group chat creation error" });
  }
};

export const addGroupMember = async (req, res) => {
  const { chatRoomId } = req.params;
  const { userId } = req.body;
  try {
    const chatRoom = await Chatroom.findById(chatRoomId);
    if (!chatRoom) return res.status(404).json({ message: "Group not found" });
    if (chatRoom.type !== "group") return res.status(400).json({ message: "Not a group chat" });
    if (!chatRoom.participants.includes(userId)) {
      chatRoom.participants.push(userId);
      await chatRoom.save();
    }
    res.status(200).json(chatRoom);
  } catch (err) {
    res.status(500).json({ message: "Failed to add member" });
  }
};

export const removeGroupMember = async (req, res) => {
  const { chatRoomId } = req.params;
  const { userId } = req.body;
  try {
    const chatRoom = await Chatroom.findById(chatRoomId);
    if (!chatRoom) return res.status(404).json({ message: "Group not found" });
    chatRoom.participants = chatRoom.participants.filter(
      id => id.toString() !== userId
    );
    await chatRoom.save();
    res.status(200).json(chatRoom);
  } catch (err) {
    res.status(500).json({ message: "Failed to remove member" });
  }
};

export const muteChat = async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.userId;
  try {
    const room = await Chatroom.findById(chatRoomId);
    if (!room) return res.status(404).json({ message: "Chat not found" });
    room.mutedBy.addToSet(userId); // ensure no duplicates
    await room.save();
    res.status(200).json(room);
  } catch (err) {
    res.status(500).json({ message: "Failed to mute chat" });
  }
};
