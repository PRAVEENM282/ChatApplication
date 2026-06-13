import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  updateGroupChat,
  uploadGroupAvatar,
} from "../../../services/chat.service";
import { decryptSymmetricKey } from "../../../services/crypto.service";
import { GroupSettingsModal } from "./GroupSettingsModal";

interface ChatWindowProps {
  chatRoom: ChatRoom;
  onOptimisticUpdate: (chatroomId: string, message: MessageType) => void;
  onDeleteChat?: (room: ChatRoom) => void;
  onBack?: () => void;
}

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

const getBetterStatus = (
  statusA: string | undefined,
  statusB: string | undefined
): "sending" | "sent" | "delivered" | "read" | "failed" => {
  const ranks: Record<string, number> = {
    failed: -1,
    sending: 0,
    sent: 1,
    delivered: 2,
    read: 3,
  };
  const rankA = ranks[statusA || "sent"] !== undefined ? ranks[statusA || "sent"] : 1;
  const rankB = ranks[statusB || "sent"] !== undefined ? ranks[statusB || "sent"] : 1;
  return rankA >= rankB ? (statusA as any || "sent") : (statusB as any || "sent");
};

const ChatWindowComponent: React.FC<ChatWindowProps> = ({
  chatRoom,
  onOptimisticUpdate,
  onDeleteChat,
  onBack,
}) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [decryptedFileKeys, setDecryptedFileKeys] = useState<
    Map<string, Uint8Array>
  >(new Map());
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const socket = useSocket();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { onlineUsers } = usePresence();
  const [roomPreferences, setRoomPreferences] = useState(() => {
    const rreList = chatRoom.readReceiptsEnabledBy;
    const readReceipts =
      !rreList || rreList.length === 0
        ? true
        : rreList.includes(user?._id || "");
    return {
      muted: chatRoom.mutedBy?.includes(user?._id || "") || false,
      archived: chatRoom.archivedBy?.includes(user?._id || "") || false,
      readReceipts,
    };
  });

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const pendingStatusUpdates = useRef<Map<string, "delivered" | "read" | "sending" | "sent" | "failed">>(new Map());

  const [showGroupSettings, setShowGroupSettings] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  useEffect(() => {
    setMessages([]);
    setDecryptedFileKeys(new Map());
    pendingStatusUpdates.current.clear();
    const rreList = chatRoom.readReceiptsEnabledBy;
    const readReceipts =
      !rreList || rreList.length === 0
        ? true
        : rreList.includes(user?._id || "");
    setRoomPreferences({
      muted: chatRoom.mutedBy?.includes(user?._id || "") || false,
      archived: chatRoom.archivedBy?.includes(user?._id || "") || false,
      readReceipts,
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
      if (!rawPrivateKey) return;

      const encryptedKeyBase64 =
        msg.fileMetadata.encryptedFileKeys?.[user?._id || ""] ||
        (msg.sender._id === user?._id
          ? msg.fileMetadata.encryptedFileKeyForSender
          : msg.fileMetadata.encryptedFileKeyForRecipient);

      const keyNonceBase64 = msg.fileMetadata.keyNonce;

      try {
        const symmetricKey = await decryptSymmetricKey(
          String(encryptedKeyBase64).trim(),
          String(keyNonceBase64).trim(),
          String(msg.sender.publicKey).trim(),
          String(rawPrivateKey).trim()
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
                  const { ciphertextBase64, nonceBase64 } = JSON.parse(encryptedText);
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
            } else if (msg.type === "file" || msg.type === "image") {
              const key = await handleKeyDecryption(msg, true);
              if (!key) {
                decryptedText = msg.fileMetadata?.filename ?? "[Encrypted File Key Invalid]";
                status = "sent";
              } else {
                decryptedText = msg.fileMetadata?.filename ?? "[Missing filename]";
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
      if (savedMessage.chatroomId !== chatRoom._id) return;
      if (savedMessage.sender._id === user?._id) return;

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
      } else if (savedMessage.type === "file" || savedMessage.type === "image") {
        const key = await handleKeyDecryption(savedMessage, false);
        plaintext = savedMessage.fileMetadata.filename;
        if (!key) status = "sent";
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
        if (prev.some((msg) => msg._id === newMessage._id)) return prev;
        return [...prev, newMessage];
      });

      socket.emit("message_delivered", {
        messageId: savedMessage._id,
        senderId: savedMessage.sender._id,
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
        const pendingStatus = pendingStatusUpdates.current.get(finalServerId);
        if (pendingStatus) pendingStatusUpdates.current.delete(finalServerId);

        const existingMsg = tempMsgIndex !== -1 ? prev[tempMsgIndex] : prev.find((m) => m._id === finalServerId);
        const currentStatus = existingMsg ? existingMsg.status : undefined;
        const resolvedStatus = getBetterStatus(
          getBetterStatus(currentStatus, pendingStatus),
          serverMessage.status
        );

        if (finalMsgExists) {
          if (tempMsgIndex !== -1) return prev.filter((_, index) => index !== tempMsgIndex);
          return prev;
        }
        if (tempMsgIndex !== -1) {
          const newMessages = [...prev];
          const originalText = newMessages[tempMsgIndex].text;
          newMessages[tempMsgIndex] = {
            ...serverMessage,
            text: serverMessage.text || originalText,
            status: resolvedStatus,
          };
          return newMessages;
        }
        return [...prev, { ...serverMessage, status: resolvedStatus }];
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
    const handleUserStoppedTyping = (data: { userId: string; chatroomId: string }) => {
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

  const otherParticipant = chatRoom.participants.find((p) => p._id !== user?._id);
  const chatTitle =
    chatRoom.type === "group"
      ? chatRoom.name || "Group chat"
      : otherParticipant?.username || "Chat";
  const chatAvatar =
    chatRoom.type === "group"
      ? chatRoom.avatarUrl || DEFAULT_FALLBACK_AVATAR
      : otherParticipant?.avatarUrl;
  const isOnline = otherParticipant ? onlineUsers.has(otherParticipant._id) : false;

  const handleNewMessage = useCallback((msg: MessageType) => {
    if (msg.sender._id === user?._id && msg.type !== "text" && msg.fileMetadata) {
      handleKeyDecryption(msg, false);
    }
    setMessages((prev) => [...prev, msg]);
  }, [user, handleKeyDecryption]);

  const toggleRoomPreference = useCallback(async (key: "muted" | "archived" | "readReceipts") => {
    const prev = roomPreferences;
    const next = { ...prev, [key]: !prev[key] };
    setRoomPreferences(next);
    try {
      await updateChatPreferences(chatRoom._id, { [key]: next[key] });
    } catch {
      setRoomPreferences(prev);
    }
  }, [roomPreferences, chatRoom._id]);

  // Delivery status listener
  useEffect(() => {
    if (!socket || !user) return;
    const handleStatusUpdate = ({
      messageId,
      status,
    }: {
      messageId: string;
      status: "delivered" | "read";
    }) => {
      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === messageId);
        if (!exists) {
          pendingStatusUpdates.current.set(messageId, status);
          return prev;
        }
        return prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, status: getBetterStatus(msg.status, status) }
            : msg
        );
      });
    };
    socket.on("message_status_updated", handleStatusUpdate);
    return () => { socket.off("message_status_updated", handleStatusUpdate); };
  }, [socket, user, chatRoom._id]);

  // Read receipt listener
  useEffect(() => {
    if (!socket || !user) return;
    if (!roomPreferences.readReceipts || user.settings?.readReceiptsEnabled === false) return;
    const handleMessagesRead = ({ chatroomId }: { chatroomId: string }) => {
      if (chatroomId === chatRoom._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender._id === user._id ? { ...msg, status: "read" } : msg
          )
        );
      }
    };
    socket.on("messages_read_by_recipient", handleMessagesRead);
    return () => { socket.off("messages_read_by_recipient", handleMessagesRead); };
  }, [socket, user, chatRoom._id, roomPreferences.readReceipts]);

  const deliveredMsgIds = useRef<Set<string>>(new Set());
  const lastReadMsgId = useRef<string | null>(null);

  useEffect(() => {
    deliveredMsgIds.current = new Set();
    lastReadMsgId.current = null;
  }, [chatRoom._id]);

  useEffect(() => {
    if (!socket || !user || messages.length === 0) return;
    const undelivered = messages.filter(
      (msg) =>
        msg.sender._id !== user._id &&
        msg.status !== "delivered" &&
        msg.status !== "read" &&
        !msg._id.startsWith("temp-") &&
        !deliveredMsgIds.current.has(msg._id)
    );
    if (undelivered.length > 0) {
      undelivered.forEach((msg) => {
        socket.emit("message_delivered", {
          messageId: msg._id,
          senderId: msg.sender._id,
        });
        deliveredMsgIds.current.add(msg._id);
      });
      setMessages((prev) =>
        prev.map((m) =>
          undelivered.some((u) => u._id === m._id)
            ? { ...m, status: "delivered" }
            : m
        )
      );
    }
    const incomingMessages = messages.filter(
      (m) => m.sender._id !== user._id && !m._id.startsWith("temp-")
    );
    if (incomingMessages.length > 0) {
      const lastIncomingMsg = incomingMessages[incomingMessages.length - 1];
      if (
        lastIncomingMsg.status !== "read" &&
        lastReadMsgId.current !== lastIncomingMsg._id
      ) {
        socket.emit("messages_read", {
          chatroomId: chatRoom._id,
          readerId: user._id,
        });
        lastReadMsgId.current = lastIncomingMsg._id;
      }
    }
  }, [messages, socket, user, chatRoom._id]);

  // Compute which messages should show a tail (first message or different sender from previous)
  const messagesWithTails = useMemo(() => {
    return messages.map((msg, idx) => {
      const prev = idx > 0 ? messages[idx - 1] : null;
      const showTail = !prev || prev.sender._id !== msg.sender._id;
      return { ...msg, showTail };
    });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-wa-chat-bg">
      {/* Header */}
      <div className="px-4 py-[10px] bg-wa-header flex items-center gap-3 flex-shrink-0 border-l border-wa-border/30">
        {/* Back button (mobile) */}
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center text-wa-icon hover:text-wa-text-primary transition-smooth md:hidden"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Avatar */}
        <div className="relative group">
          <img
            src={chatAvatar}
            alt="user avatar"
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FALLBACK_AVATAR;
            }}
          />
          {chatRoom.type !== "group" && isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-wa-unread rounded-full border-[1.5px] border-wa-header" />
          )}
          {chatRoom.type === "group" && chatRoom.admins?.includes(user?._id || "") && (
            <>
              <input
                type="file"
                id="group-avatar-upload"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const formData = new FormData();
                    formData.append("avatar", file);
                    await uploadGroupAvatar(chatRoom._id, formData);
                  } catch (err) {
                    console.error("Failed to update group avatar", err);
                  }
                }}
              />
              <label
                htmlFor="group-avatar-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-full cursor-pointer transition-smooth"
              >
                <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-smooth">📷</span>
              </label>
            </>
          )}
        </div>

        {/* Title & Status */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-normal text-wa-text-primary truncate">
            {chatTitle}
          </h2>
          {chatRoom.type === "group" ? (
            <p className="text-xs text-wa-text-secondary truncate">
              {chatRoom.participants.map(p => p.username).join(", ")}
            </p>
          ) : typingUsers.length > 0 ? (
            <p className="text-xs text-wa-unread">typing...</p>
          ) : isOnline ? (
            <p className="text-xs text-wa-text-secondary">online</p>
          ) : null}
        </div>

        {/* Menu button */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 flex items-center justify-center text-wa-icon hover:text-wa-text-primary rounded-full hover:bg-wa-sidebar-hover transition-smooth"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 wa-dropdown-enter">
              <div className="bg-wa-header border border-wa-border rounded-lg shadow-2xl overflow-hidden min-w-[200px] py-1">
                {chatRoom.type === "group" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowGroupSettings(true);
                    }}
                    className="w-full text-left px-6 py-2.5 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover transition-smooth font-medium"
                  >
                    Group settings
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    toggleRoomPreference("muted");
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-6 py-2.5 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover transition-smooth"
                >
                  {roomPreferences.muted ? "Unmute notifications" : "Mute notifications"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleRoomPreference("archived");
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-6 py-2.5 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover transition-smooth"
                >
                  {roomPreferences.archived ? "Unarchive chat" : "Archive chat"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleRoomPreference("readReceipts");
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-6 py-2.5 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover transition-smooth"
                >
                  {roomPreferences.readReceipts ? "Disable read receipts" : "Enable read receipts"}
                </button>
                {onDeleteChat && (
                  <>
                    <div className="border-t border-wa-border/50 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteChat(chatRoom);
                      }}
                      className="w-full text-left px-6 py-2.5 text-sm text-wa-danger hover:bg-wa-sidebar-hover transition-smooth"
                    >
                      Delete chat
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto wa-chat-wallpaper min-h-0">
        <div className="py-2">
          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="w-8 h-8 border-3 border-wa-text-secondary/20 border-t-wa-unread rounded-full animate-spin" />
              <p className="text-wa-text-secondary text-sm mt-3">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="bg-wa-bubble-in/80 rounded-lg px-4 py-2 text-center">
                <p className="text-wa-text-secondary text-xs">
                  🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
                </p>
              </div>
            </div>
          ) : (
            messagesWithTails.map((msg) => (
              <Message
                key={msg._id}
                message={msg}
                decryptedFileKey={decryptedFileKeys.get(msg._id)}
                showTail={msg.showTail}
              />
            ))
          )}
          
          {typingUsers.length > 0 && (
            <div className="flex justify-start px-[6%] mb-2">
              <div className="bg-wa-bubble-in px-4 py-3 rounded-lg rounded-tl-none wa-bubble-tail-in">
                <div className="flex gap-1">
                  <span className="wa-typing-dot" />
                  <span className="wa-typing-dot" />
                  <span className="wa-typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
     
      <MessageInput
        chatRoom={chatRoom}
        onNewMessage={handleNewMessage}
        onOptimisticUpdate={onOptimisticUpdate}
      />

      {showGroupSettings && (
        <GroupSettingsModal
          chatRoom={chatRoom}
          onClose={() => setShowGroupSettings(false)}
        />
      )}
    </div>
  );
};

export const ChatWindow = React.memo(ChatWindowComponent);
