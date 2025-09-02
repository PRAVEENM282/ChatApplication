import React, { useState } from "react";
import UserSearch from "../../user/components/UserSearch";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import { createOrGetChatRoom } from "../../../services/chat.service";
interface User {
  _id: string;
  username: string;
}

interface ChatRoom {
  _id: string;
  participants: User[];
  lastMessage?: any;
}

const ChatsPage = () => {
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<User | null>(null);

  // Assuming you store current user info in localStorage or context
  const currentUsername = localStorage.getItem("username") || "";
  const currentUserId = localStorage.getItem("userId") || "";

  // Called when a user is selected from search to start new chat
  const handleUserSelect = async (user: User) => {
    try {
      const chatRoom = await createOrGetChatRoom(user._id);
      setSelectedChat(chatRoom);
      setSelectedChatUser(user);
    } catch (error) {
      console.error("Failed to create or get chat room", error);
    }
  };

  // Called when a chat room is selected from chat list
  const handleChatSelect = (chatRoom: ChatRoom) => {
    setSelectedChat(chatRoom);
    // Determine other participant user from chat room
    const other = chatRoom.participants.find((p) => p._id !== currentUserId) || null;
    setSelectedChatUser(other);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Pane */}
      <aside className="w-full md:w-[380px] lg:w-[420px] border-r bg-white flex flex-col">
        <div className="p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Chats</h2>
        </div>
        <div className="p-3 border-b">
          <UserSearch onSelectUser={handleUserSelect} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChatList onSelectChat={handleChatSelect} currentUserId={currentUserId} />
        </div>
      </aside>

      {/* Right Pane */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 border-b bg-white sticky top-0 z-10">
          {selectedChatUser ? (
            <div className="font-medium">{selectedChatUser.username}</div>
          ) : (
            <div className="text-gray-500">Select a chat to start messaging</div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {selectedChat && selectedChatUser ? (
            <ChatWindow
              chatRoomId={selectedChat._id}
              recipientUserId={selectedChatUser._id}
              recipientUsername={selectedChatUser.username}
              currentUsername={currentUsername}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              {selectedChatUser ? (
                <p>Creating chat with {selectedChatUser.username}…</p>
              ) : (
                <p>Search or select a chat from the left</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ChatsPage;
