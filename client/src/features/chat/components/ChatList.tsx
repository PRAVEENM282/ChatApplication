import React, { useEffect, useState } from "react";
import { fetchChatRooms } from "../../../services/chat.service";

interface Participant {
  _id: string;
  username: string;
}

interface ChatRoom {
  _id: string;
  participants: Participant[];
  lastMessage?: {
    encryptedText: string;
    senderId: Participant;
  };
}

interface ChatListProps {
  onSelectChat: (chatRoom: ChatRoom) => void;
  currentUserId: string;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, currentUserId }) => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);

  useEffect(() => {
    async function loadChatRooms() {
      const rooms = await fetchChatRooms();
      setChatRooms(rooms);
    }
    loadChatRooms();
  }, []);

  return (
    <ul className="space-y-1">
      {chatRooms.map((room) => {
        const otherParticipant = room.participants.find((p) => p._id !== currentUserId);

        return (
          <li key={room._id}>
            <button className="w-full text-left p-3 rounded hover:bg-gray-100 border" onClick={() => onSelectChat(room)}>
              <div className="font-medium">{otherParticipant?.username}</div>
              <div className="text-xs text-gray-500">
                {room.lastMessage
                  ? `${room.lastMessage.senderId.username}: [encrypted message]`
                  : "No messages"}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ChatList;
