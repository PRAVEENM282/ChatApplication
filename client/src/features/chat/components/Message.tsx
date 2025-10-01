import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { decryptMessage } from "../../../services/crypto.service";
import { getPrivateKey } from "../../../utils/KeyStorage";
import { fetchUserPublicKey } from "../../../services/user.service";

interface MessageProps {
  encryptedText: string;
  senderId: { username: string; _id: string };
  currentUsername: string;
  createdAt: string;
}

const Message: React.FC<MessageProps> = ({
  encryptedText,
  senderId,
  currentUsername,
  createdAt,
}) => {
  const isOwn = senderId.username === currentUsername;
  const [decryptedText, setDecryptedText] = useState(isOwn ? encryptedText : "...");

  useEffect(() => {
    if (isOwn) {
      return;
    }
    async function decryptReceivedMessage() {
      try {
        const viewerPrivateKey = await getPrivateKey(currentUsername);
        if (!viewerPrivateKey) {
          setDecryptedText("[Key Not Found]");
          return;
        }

        const senderPublicKey = await fetchUserPublicKey(senderId._id);
        if (!senderPublicKey) {
          setDecryptedText("[Sender Key Not Found]");
          return;
        }

        const decrypted = await decryptMessage(
          encryptedText,
          viewerPrivateKey,
          senderPublicKey
        );
        
        setDecryptedText(decrypted);

      } catch (err) {
        setDecryptedText("[Decryption Failed]");
        console.error("Decryption error:", err);
      }
    }

    decryptReceivedMessage();

  }, [encryptedText, senderId._id, currentUsername, isOwn]);

  return (
    <div
      className={`message p-2 mb-2 rounded shadow-sm max-w-[75%] ${
        isOwn
          ? "ml-auto bg-blue-50 border-blue-200"
          : "mr-auto bg-white border"
      }`}
    >
      <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
        <strong>{senderId.username}</strong>
        <span>{dayjs(createdAt).format("HH:mm")}</span>
      </div>
      <div className="text-gray-800">{decryptedText}</div>
    </div>
  );
};

export default Message;