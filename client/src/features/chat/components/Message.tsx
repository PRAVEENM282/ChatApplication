import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { decryptMessage } from "../../../services/crypto.service";
import { getPrivateKey } from "../../../utils/KeyStorage";
import { fetchUserPublicKey } from "../../../services/user.service";

interface MessageProps {
  encryptedText: string;
  senderId: { username: string; _id: string };
  recipientUsername: string;
  currentUsername: string;
  createdAt: string;
}

const Message: React.FC<MessageProps> = ({
  encryptedText,
  senderId,
  recipientUsername,
  currentUsername,
  createdAt
}) => {
  const [decryptedText, setDecryptedText] = useState("Decrypting...");

  useEffect(() => {
    async function decrypt() {
      try {
        // Load own private key from IndexedDB
        const privateKey = await getPrivateKey(currentUsername);
        if (!privateKey) {
          setDecryptedText("[Private key missing]");
          return;
        }

        // Fetch sender's public key from backend
        const senderPublicKey = await fetchUserPublicKey(senderId._id);
        if (!senderPublicKey) {
          setDecryptedText("[Sender public key missing]");
          return;
        }

        const decrypted = await decryptMessage(encryptedText, privateKey, senderPublicKey);
        setDecryptedText(decrypted);
      } catch (err) {
        setDecryptedText("[Decryption failed]");
        console.error("Decryption error:", err);
      }
    }
    decrypt();
  }, [encryptedText, senderUsername, currentUsername]);

  const isOwn = senderId.username === currentUsername;
  return (
  <div className={`message p-2 mb-2 rounded shadow-sm max-w-[75%] ${isOwn ? "ml-auto bg-blue-50 border-blue-200" : "mr-auto bg-white border"}`}>
    <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
      <strong>{senderId.username}</strong>
      <span>{dayjs(createdAt).format("HH:mm")}</span>
    </div>
    <div className="text-gray-800">{decryptedText}</div>
  </div>
);
};

export default Message;
