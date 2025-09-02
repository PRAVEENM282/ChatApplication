import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../../../context/SocketProvider";
import { encryptMessage } from "../../../services/crypto.service";
import { fetchUserPublicKey } from "../../../services/user.service";
import { getPrivateKey } from "../../../utils/KeyStorage";

interface MessageInputProps {
  chatRoomId: string;
  recipientId: string;
  senderUsername: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ chatRoomId, recipientId, senderUsername }) => {
  const socket = useSocket();
  const [text, setText] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to handle typing indicators
  useEffect(() => {
    if (!socket) return;
    
    // Clear timeout on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (!socket) return;

    // Emit 'typing' event
    socket.emit('typing', { chatRoomId });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set a new timeout to emit 'stop_typing'
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { chatRoomId });
    }, 2000); // 2 seconds delay
  };

  const handleSend = async () => {
    if (!text.trim() || !socket) return;

    // Stop typing indicator on send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('stop_typing', { chatRoomId });

    try {
      const recipientPublicKey = await fetchUserPublicKey(recipientId);
      const senderPrivateKey = await getPrivateKey(senderUsername);
      if (!senderPrivateKey) {
        alert("Your keys are missing. Please log in again.");
        return;
      }
      const encrypted = await encryptMessage(text, recipientPublicKey, senderPrivateKey);
      socket.emit("send_message", {
        chatRoomId,
        encryptedText: encrypted,
      });
      setText("");
    } catch (error) {
      console.error("Failed to encrypt or send message", error);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-input flex gap-2 p-4 bg-gray-50 border-t">
      <input
        type="text"
        value={text}
        onChange={handleTyping}
        onKeyDown={onKeyDown}
        placeholder="Type your message..."
        className="flex-grow border rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Message input"
      />
      <button onClick={handleSend} disabled={!text.trim()} className="bg-blue-600 disabled:bg-blue-300 text-white font-bold px-4 py-2 rounded-full hover:bg-blue-700 transition-colors">
        Send
      </button>
    </div>
  );
};

export default MessageInput;