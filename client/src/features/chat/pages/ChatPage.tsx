import React from "react";
import UserSearch from "../../user/components/UserSearch";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import { useChatStore } from "../../../store/chatStore";

const ChatsPage = () => {
  const { selectedChat, selectedChatUser } = useChatStore();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Pane */}
      <aside className="w-full md:w-[380px] lg:w-[420px] border-r bg-white flex flex-col">
        <div className="p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Chats</h2>
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
            <ChatWindow />
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