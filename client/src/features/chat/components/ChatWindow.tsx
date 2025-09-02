import React, { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import Message from "./Message";
import MessageInput from "./MessageInput";

interface ChatWindowProps {
  chatRoomId: string;
  recipientUserId: string;
  currentUsername: string;
  recipientUsername: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  chatRoomId,
  recipientUserId,
  currentUsername,
  recipientUsername,
}) => {
  const { messages } = useChat(chatRoomId);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // When chatRoomId changes or messages update, manage loading and scroll
  useEffect(() => {
    setLoading(true);
    // Simulate or coordinate with useChat fetching completion
    // Here we assume fetch is done and loading ends when messages length updated
    if (messages.length > 0 || !loading) {
      setLoading(false);
    }
  }, [messages, loading, chatRoomId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="chat-window border rounded p-4 max-w-2xl mx-auto flex flex-col h-[600px]">
      <h2 className="font-bold mb-4 text-xl text-center">Chat with {recipientUsername}</h2>

      <div className="messages flex-grow overflow-y-auto mb-4 border p-2 rounded bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-500 mt-20">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">No messages yet</div>
        ) : (
          messages.map((msg) => (
            <Message
              key={msg._id}
              encryptedText={msg.encryptedText}
              senderId={msg.senderId}
              recipientUsername={recipientUsername}
              currentUsername={currentUsername}
              createdAt={msg.createdAt}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        chatRoomId={chatRoomId}
        recipientId={recipientUserId}
        senderUsername={currentUsername}
      />
    </div>
  );
};

export default ChatWindow;
