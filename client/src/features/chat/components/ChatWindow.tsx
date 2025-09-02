import React, { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import Message from "./Message";
import MessageInput from "./MessageInput";
import { useChatStore } from "../../../store/chatStore";
import { useSocket } from "../../../context/SocketProvider";
import { usePresenceStore } from "../../../store/presenceStore";

const ChatWindow: React.FC = () => {
  const socket = useSocket();
  const { selectedChat, selectedChatUser } = useChatStore();
  const { onlineUsers } = usePresenceStore();
  const { messages } = useChat(selectedChat?._id || "");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUsername = localStorage.getItem("username") || "";

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!socket || !selectedChatUser) return;

    const handleUserTyping = ({ userId, chatRoomId }: { userId: string, chatRoomId: string }) => {
      if (chatRoomId === selectedChat?._id && userId === selectedChatUser._id) {
        setTypingUser(selectedChatUser.username);
      }
    };

    const handleUserStoppedTyping = ({ chatRoomId }: { chatRoomId: string }) => {
      if (chatRoomId === selectedChat?._id) {
        setTypingUser(null);
      }
    };

    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
    };
  }, [socket, selectedChat, selectedChatUser]);

  if (!selectedChat || !selectedChatUser) {
    return (
        <div className="h-full flex items-center justify-center text-gray-400">
            <p>Search or select a chat from the left panel to start messaging</p>
        </div>
    );
  }

  const isRecipientOnline = onlineUsers.has(selectedChatUser._id);

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
        <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-gray-600">
                {selectedChatUser.username.charAt(0).toUpperCase()}
            </div>
            {isRecipientOnline && (
                <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
            )}
        </div>
        <div>
            <h2 className="font-semibold text-lg text-gray-800">{selectedChatUser.username}</h2>
            <p className="text-xs text-gray-500">{isRecipientOnline ? 'Online' : 'Offline'}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((msg) => (
          <Message
            key={msg._id}
            encryptedText={msg.encryptedText}
            senderId={msg.senderId}
            currentUsername={currentUsername}
            createdAt={msg.createdAt}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="h-6 px-4 text-sm text-gray-500 italic">
        {typingUser && `${typingUser} is typing...`}
      </div>

      <MessageInput
        chatRoomId={selectedChat._id}
        recipientId={selectedChatUser._id}
        senderUsername={currentUsername}
      />
    </div>
  );
};

export default ChatWindow;
