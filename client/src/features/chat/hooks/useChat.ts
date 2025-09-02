import { useState, useEffect } from "react";
import { useSocket } from "../../../context/SocketProvider";
import { fetchChatMessages } from "../../../services/chat.service";

interface Message {
  _id: string;
  encryptedText: string;
  senderId: { username: string; _id: string };
  createdAt: string;
}

export const useChat = (chatRoomId: string) => {
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket || !chatRoomId) return;

    setLoading(true);

    // Load chat history on mount or chatRoomId change
    async function loadHistory() {
      try {
        const history = await fetchChatMessages(chatRoomId);
        setMessages(history);
      } catch (err) {
        setMessages([]);
        console.error("Failed to load chat messages:", err);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();

    // Join chat room for real-time updates
    socket.emit("join_room", chatRoomId);

    // Listen for new messages via socket
    const handleNewMessage = (message: Message) => {
      setMessages((msgs) => [...msgs, message]);
    };

    socket.on("receive_message", handleNewMessage);

    // Cleanup on unmount or chatRoomId/socket change
    return () => {
      socket.off("receive_message", handleNewMessage);
    };
  }, [socket, chatRoomId]);

  return { messages, setMessages, loading };
};
