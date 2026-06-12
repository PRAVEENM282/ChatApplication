import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChatRoom, Message as MessageType } from "../../../types";
import { useSocket } from "../../../context/SocketProvider";
import { useAuth } from "../../../context/AuthProvider";
import { usePresence } from "../../../context/PresenceProvider";
import { Message } from "./Message";
import { decryptMessage } from "../../../services/crypto.service";
import { MessageInput } from "./MessageInput";
import {
  getChatMessages,
  updateChatPreferences,
} from "../../../services/chat.service";
import { decryptSymmetricKey } from "../../../services/crypto.service";

interface ChatWindowProps {
  chatRoom: ChatRoom;
  onOptimisticUpdate: (chatroomId: string, message: MessageType) => void;
}

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatRoom,
  onOptimisticUpdate,
}) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [decryptedFileKeys, setDecryptedFileKeys] = useState<
    Map<string, Uint8Array>
  >(new Map());
  const socket = useSocket();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { onlineUsers } = usePresence();
  const [roomPreferences, setRoomPreferences] = useState({
    muted: chatRoom.mutedBy?.includes(user?._id || "") || false,
    archived: chatRoom.archivedBy?.includes(user?._id || "") || false,
    readReceipts:
      chatRoom.readReceiptsEnabledBy?.includes(user?._id || "") !== false,
  });

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  useEffect(() => {
    setMessages([]);
    setDecryptedFileKeys(new Map());
    setRoomPreferences({
      muted: chatRoom.mutedBy?.includes(user?._id || "") || false,
      archived: chatRoom.archivedBy?.includes(user?._id || "") || false,
      readReceipts:
        chatRoom.readReceiptsEnabledBy?.includes(user?._id || "") !== false,
    });
  }, [
    chatRoom._id,
    chatRoom.mutedBy,
    chatRoom.archivedBy,
    chatRoom.readReceiptsEnabledBy,
    user?._id,
  ]);

  const handleKeyDecryption = useCallback(
    async (
      msg: any,
      _isHistorical: boolean
    ): Promise<Uint8Array | undefined> => {
      if (msg.type === "text") return;

      const rawPrivateKey = localStorage.getItem("privateKey");
      if (!rawPrivateKey) {
        return;
      }

      const encryptedKeyBase64 =
        msg.fileMetadata.encryptedFileKeys?.[user?._id || ""] ||
        (msg.sender._id === user?._id
          ? msg.fileMetadata.encryptedFileKeyForSender
          : msg.fileMetadata.encryptedFileKeyForRecipient);

      const keyNonceBase64 = msg.fileMetadata.keyNonce;

      try {
        const trimmedEncryptedKeyBase64 = String(encryptedKeyBase64).trim();
        const trimmedKeyNonceBase64 = String(keyNonceBase64).trim();
        const trimmedSenderPublicKey = String(msg.sender.publicKey).trim();
        const trimmedMyPrivateKey = String(rawPrivateKey).trim();

        const symmetricKey = await decryptSymmetricKey(
          trimmedEncryptedKeyBase64,
          trimmedKeyNonceBase64,
          trimmedSenderPublicKey,
          trimmedMyPrivateKey
        );

        setDecryptedFileKeys((prev) => {
          const newMap = new Map(prev);
          const msgId = msg._id || `temp-${Date.now()}`;
          newMap.set(msgId, symmetricKey);
          return newMap;
        });

        return symmetricKey;
      } catch (e) {
        return undefined;
      }
    },
    [user]
  );

  const getEncryptedTextForCurrentUser = useCallback(
    (msg: any) => {
      if (user?._id && msg.encryptedPayloads?.[user._id]) {
        return JSON.stringify(msg.encryptedPayloads[user._id]);
      }
      return msg.sender._id === user?._id
        ? msg.encryptedTextForSender
        : msg.encryptedTextForRecipient;
    },
    [user?._id]
  );
  useEffect(() => {
    const fetchHistoricalMessages = async () => {
      if (!chatRoom._id || !user) return;

      setIsLoadingMessages(true);
      try {
        const historicalMessages = await getChatMessages(chatRoom._id);

        const decryptedMessages: MessageType[] = [];

        for (const msg of historicalMessages) {
          try {
            let decryptedText = "";
            let status = msg.status || "sent";

            if (msg.type === "text") {
              const myPrivateKey = localStorage.getItem("privateKey");
              if (myPrivateKey) {
                const encryptedText = getEncryptedTextForCurrentUser(msg);

                if (encryptedText && typeof encryptedText === "string") {
                  const { ciphertextBase64, nonceBase64 } =
                    JSON.parse(encryptedText);

                  decryptedText = await decryptMessage(
                    ciphertextBase64.trim(),
                    nonceBase64.trim(),
                    msg.sender.publicKey.trim(),
                    myPrivateKey.trim()
                  );
                } else {
                  decryptedText = "[Missing encrypted payload]";
                  status = "sent";
                }
              }
            }
            else if (msg.type === "file" || msg.type === "image") {
              const key = await handleKeyDecryption(msg, true);
              if (!key) {
                decryptedText =
                  msg.fileMetadata?.filename ?? "[Encrypted File Key Invalid]";
                status = "sent";
              } else {
                decryptedText =
                  msg.fileMetadata?.filename ?? "[Missing filename]";
              }
            }

            decryptedMessages.push({
              _id: msg._id,
              chatroomId: msg.chatroomId,
              sender: msg.sender,
              encryptedTextForSender: msg.encryptedTextForSender,
              encryptedPayloads: msg.encryptedPayloads,
              text: decryptedText,
              createdAt: msg.createdAt,
              status: status,
              type: msg.type,
              fileMetadata: msg.fileMetadata,
            });
          } catch (decryptError) {
            decryptedMessages.push({
              _id: msg._id,
              chatroomId: msg.chatroomId,
              sender: msg.sender,
              encryptedTextForRecipient: msg.encryptedTextForRecipient,
              encryptedTextForSender: msg.encryptedTextForSender,
              encryptedPayloads: msg.encryptedPayloads,
              text: "[Failed to decrypt]",
              createdAt: msg.createdAt,
              status: msg.status || "sent",
              type: msg.type || "text",
              fileMetadata: msg.fileMetadata,
            });
          }
        }

        setMessages(decryptedMessages);
      } catch (error) {
        // Handle error silently
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchHistoricalMessages();
  }, [chatRoom._id, user, handleKeyDecryption, getEncryptedTextForCurrentUser]);

  useEffect(() => {
    if (chatRoom._id && socket) {
      socket.emit("join_room", chatRoom._id);
    }

    return () => {
      if (chatRoom._id && socket) {
        socket.emit("leave_room", chatRoom._id);
      }
    };
  }, [chatRoom._id, socket]);


  useEffect(() => {
    if (!socket || !user) return;
    const handleReceiveMessage = async (savedMessage: any) => {
      if (savedMessage.sender._id === user?._id) {
        return;
      }

      let plaintext = "";
      let status = savedMessage.status || "sent";

      if (savedMessage.type === "text") {
        try {
          const myPrivateKey = localStorage.getItem("privateKey");
          if (!myPrivateKey) return;

          const encryptedText = getEncryptedTextForCurrentUser(savedMessage);
          if (!encryptedText) throw new Error("Missing encrypted payload");
          const { ciphertextBase64, nonceBase64 } = JSON.parse(encryptedText);

          plaintext = await decryptMessage(
            ciphertextBase64,
            nonceBase64,
            savedMessage.sender.publicKey,
            myPrivateKey
          );
        } catch (e) {
          plaintext = "[Decryption Failed]";
        }
      }
      else if (savedMessage.type === "file" || savedMessage.type === "image") {
        const key = await handleKeyDecryption(savedMessage, false);
        plaintext = savedMessage.fileMetadata.filename;
        if (!key) {
          status = "sent";
        }
      }

      const newMessage: MessageType = {
        _id: savedMessage._id,
        chatroomId: savedMessage.chatroomId,
        sender: savedMessage.sender,
        encryptedTextForRecipient: savedMessage.encryptedTextForRecipient,
        encryptedTextForSender: savedMessage.encryptedTextForSender,
        encryptedPayloads: savedMessage.encryptedPayloads,
        text: plaintext,
        createdAt: savedMessage.createdAt,
        status: status,
        type: savedMessage.type,
        fileMetadata: savedMessage.fileMetadata,
      };

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === newMessage._id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    };
    const handleSentConfirmation = async (serverMessage: MessageType) => {
      if (serverMessage.type !== "text" && serverMessage.fileMetadata) {
        await handleKeyDecryption(serverMessage, false);
      }
      setMessages((prev) => {
        const finalServerId = serverMessage._id;
        const tempMsgIndex = prev.findIndex(
          (msg) => msg._id.startsWith("temp-") && msg.sender._id === user?._id
        );
        const finalMsgExists = prev.some((msg) => msg._id === finalServerId);

        if (finalMsgExists) {
          if (tempMsgIndex !== -1) {
            return prev.filter((_, index) => index !== tempMsgIndex);
          }
          return prev;
        }
        if (tempMsgIndex !== -1) {
          const newMessages = [...prev];
          const originalText = newMessages[tempMsgIndex].text;
          newMessages[tempMsgIndex] = {
            ...serverMessage,
            text: serverMessage.text || originalText,
            status: "sent",
          };
          return newMessages;
        }
        return [...prev, { ...serverMessage, status: "sent" }];
      });
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_sent_confirmation", handleSentConfirmation);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_sent_confirmation", handleSentConfirmation);
    };
  }, [socket, user, chatRoom._id, handleKeyDecryption, getEncryptedTextForCurrentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = (data: { userId: string; chatroomId: string }) => {
      if (data.chatroomId === chatRoom._id) {
        setTypingUsers((prev) => [...new Set([...prev, data.userId])]);
      }
    };

    const handleUserStoppedTyping = (data: {
      userId: string;
      chatroomId: string;
    }) => {
      if (data.chatroomId === chatRoom._id) {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
      }
    };

    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    return () => {
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
    };
  }, [socket, chatRoom._id]);

  const otherParticipant = chatRoom.participants.find(
    (p) => p._id !== user?._id
  );
  const chatTitle =
    chatRoom.type === "group"
      ? chatRoom.name || "Group chat"
      : otherParticipant?.username || "Chat";
  const chatAvatar =
    chatRoom.type === "group"
      ? chatRoom.avatarUrl || DEFAULT_FALLBACK_AVATAR
      : otherParticipant?.avatarUrl;
  const isOnline = otherParticipant
    ? onlineUsers.has(otherParticipant._id)
    : false;

  const typingIndicatorText = () => {
    const typingParticipant = chatRoom.participants.find(
      (p) => p._id === typingUsers[0]
    );
    if (typingParticipant) {
      return `•••`;
    }
    return null;
  };

  const handleNewMessage = (msg: MessageType) => {
    if (
      msg.sender._id === user?._id &&
      msg.type !== "text" &&
      msg.fileMetadata
    ) {
      handleKeyDecryption(msg, false);
    }

    setMessages((prev) => [...prev, msg]);
  };

  const toggleRoomPreference = async (
    key: "muted" | "archived" | "readReceipts"
  ) => {
    const prev = roomPreferences;
    const next = { ...prev, [key]: !prev[key] };
    setRoomPreferences(next);
    try {
      await updateChatPreferences(chatRoom._id, { [key]: next[key] });
    } catch {
      setRoomPreferences(prev);
    }
  };

  useEffect(() => {
    if (!socket || !user) return;
    if (!roomPreferences.readReceipts || user.settings?.readReceiptsEnabled === false) return;

    const handleStatusUpdate = ({
      messageId,
      status,
    }: {
      messageId: string;
      status: "delivered" | "read";
    }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, status } : msg))
      );
    };

    const handleMessagesRead = ({ chatroomId }: { chatroomId: string }) => {
      if (chatroomId === chatRoom._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender._id === user._id ? { ...msg, status: "read" } : msg
          )
        );
      }
    };

    socket.on("message_status_updated", handleStatusUpdate);
    socket.on("messages_read_by_recipient", handleMessagesRead);

    return () => {
      socket.off("message_status_updated", handleStatusUpdate);
      socket.off("messages_read_by_recipient", handleMessagesRead);
    };
  }, [socket, user, chatRoom._id, roomPreferences.readReceipts]);
  useEffect(() => {
    if (!socket || !user) return;
    messages.forEach((msg) => {
      if (
        msg.sender._id !== user._id &&
        msg.status !== "delivered" &&
        msg.status !== "read"
      ) {
        socket.emit("message_delivered", {
          messageId: msg._id,
          senderId: msg.sender._id,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m._id === msg._id ? { ...m, status: "delivered" } : m
          )
        );
      }
    });
    const otherParticipant = chatRoom.participants.find(
      (p) => p._id !== user._id
    );
    if (otherParticipant) {
      const unreadMessagesExist = messages.some(
        (m) => m.sender._id !== user._id && m.status !== "read"
      );
      if (unreadMessagesExist) {
        socket.emit("messages_read", {
          chatroomId: chatRoom._id,
          readerId: user._id,
        });
      }
    }
  }, [messages, socket, user, chatRoom.participants, chatRoom._id, roomPreferences.readReceipts]);

  return (
    <div className="flex-1 flex flex-col h-full">
      
      <div className="p-4 border-b border-gray-300 bg-gray-100 flex items-center gap-4 flex-shrink-0">
        <img
          src={chatAvatar}
          alt="user avatar"
          className="w-12 h-12 rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_FALLBACK_AVATAR;
          }}
        />
        <div>
          <h2 className="text-xl font-bold">
            {chatTitle}
          </h2>
          {chatRoom.type === "group" ? (
            <p className="text-xs text-gray-500">
              {chatRoom.participants.length} members
            </p>
          ) : (
            isOnline && <p className="text-xs text-green-600">Online</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => toggleRoomPreference("muted")}
            className="px-3 py-1 rounded-md bg-white border border-gray-300 text-xs"
          >
            {roomPreferences.muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => toggleRoomPreference("archived")}
            className="px-3 py-1 rounded-md bg-white border border-gray-300 text-xs"
          >
            {roomPreferences.archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-200 min-h-0">
        <div className="p-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <Message
                key={msg._id}
                message={msg}
                decryptedFileKey={decryptedFileKeys.get(msg._id)}
              />
            ))
          )}
          
          {typingUsers.length > 0 && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded-xl rounded-bl-none animate-pulse">
                {typingIndicatorText()}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
     
      <div className="flex-shrink-0">
        <MessageInput
          chatRoom={chatRoom}
          onNewMessage={handleNewMessage}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </div>
    </div>
  );
};
