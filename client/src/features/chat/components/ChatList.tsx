import React, { useEffect, useState } from "react";
import { fetchChatRooms } from "../../../services/chat.service";
import { useChatStore } from "../../../store/chatStore";
import { usePresenceStore } from "../../../store/presenceStore";

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

const ChatList: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const { setSelectedChat, setSelectedChatUser } = useChatStore();
  const { onlineUsers } = usePresenceStore();
  const currentUserId = localStorage.getItem("userId") || "";

  useEffect(() => {
    async function loadChatRooms() {
      const rooms = await fetchChatRooms();
      setChatRooms(rooms);
    }
    loadChatRooms();
  }, []);

  const handleChatSelect = (chatRoom: ChatRoom) => {
    setSelectedChat(chatRoom);
    const other =
      chatRoom.participants.find((p) => p._id !== currentUserId) || null;
    setSelectedChatUser(other);
  };

  return (
    <ul className="space-y-1 p-2">
      {chatRooms.map((room) => {
        const otherParticipant = room.participants.find(
          (p) => p._id !== currentUserId
        );
        if (!otherParticipant) return null;

        const isOnline = onlineUsers.has(otherParticipant._id);

        return (
          <li key={room._id}>
            <button
              className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => handleChatSelect(room)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  {/* Basic Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-gray-600">
                    {otherParticipant.username.charAt(0).toUpperCase()}
                  </div>
                  {/* Online Indicator */}
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{otherParticipant.username}</div>
                  <p className="text-xs text-gray-500 truncate">
                    {room.lastMessage
                      ? `${room.lastMessage.senderId.username}: [encrypted message]`
                      : "No messages yet"}
                  </p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ChatList;
