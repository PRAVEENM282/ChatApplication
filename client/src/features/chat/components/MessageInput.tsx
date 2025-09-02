import React, { useState } from "react";
import { useSocket } from "../../../context/SocketProvider";
import { encryptMessage } from "../../../services/crypto.service";
import { fetchUserPublicKey } from "../../../services/user.service";
import { getPrivateKey} from "../../../utils/KeyStorage";

interface MessageInputProps {
  chatRoomId: string;
  recipientId: string; // backend recipient user ID to fetch public key
  senderUsername: string; // current sender username in IndexedDB keys
}

const MessageInput: React.FC<MessageInputProps> = ({ chatRoomId, recipientId, senderUsername }) => {
  const socket = useSocket();
  const [text, setText] = useState("");

  const handleSend = async () => {
    if (!text.trim() || !socket) return;

    try {
      // Fetch recipient's public key from backend API
      const recipientPublicKey = await fetchUserPublicKey(recipientId);

      // Get sender's keys from IndexedDB
      const senderPrivateKey = await getPrivateKey(senderUsername);
      if (!senderPrivateKey) {
        alert("Your keys are missing. Please log in again.");
        return;
      }

      // Encrypt message with recipient public key and sender private key
      const encrypted = await encryptMessage(text, recipientPublicKey, senderPrivateKey);

      // Emit encrypted message plus sender's public key for decryption
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
    <div className="message-input flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type your message..."
        className="flex-grow border rounded px-3 py-2"
        aria-label="Message input"
      />
      <button onClick={handleSend} disabled={!text.trim()} className="bg-blue-600 disabled:bg-blue-300 text-white px-4 rounded hover:bg-blue-700">
        Send
      </button>
    </div>
  );
};

export default MessageInput;
