import Chatroom from "../models/Chatroom.js";
import Message from "../models/Message.js";


export const saveMessage = async (messageData) =>{
    const {chatRoomId,senderId,encryptedText} = messageData;
    try{
        const newMessage = new Message({
            chatRoomId,
            senderId,
            encryptedText
        });
        await newMessage.save();
        await Chatroom.findByIdAndUpdate(chatRoomId,{lastMessage:newMessage._id});
        const populatedMessage = await newMessage.populate('senderId','username publicKey avatarUrl').exec();
        return populatedMessage;
    }catch(err){
        console.error('Error saving message:', err);
    }

}