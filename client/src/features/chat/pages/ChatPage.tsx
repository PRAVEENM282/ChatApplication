import React from "react";
import UserSearch from "../../user/components/UserSearch";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import { useChatStore } from "../../../store/chatStore";
import { useAuth } from "../../../context/AuthProvider";

const ChatsPage = () => {
  const { selectedChat, selectedChatUser } = useChatStore();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Pane */}
      <aside className="w-full md:w-[380px] lg:w-[420px] border-r bg-white flex flex-col">
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Chats</h2>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Logout
          </button>
        </div>
        <div className="p-3 border-b">
          <UserSearch />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChatList />
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
            <ChatWindow key={selectedChat._id} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Search or select a chat from the left</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ChatsPage;