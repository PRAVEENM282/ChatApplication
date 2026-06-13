import React, { useEffect, useState, useCallback, useRef } from "react";
import { ChatRoom, Message } from "../../../types";
import { getMyChatRooms, markChatAsRead, deleteChatRoom } from "../../../services/chat.service";
import { ChatList } from "../components/ChatList";
import { ChatWindow } from "../components/ChatWindow";
import { UserSearchModal } from "../components/UserSearchModal";
import { DeleteChatModal } from "../components/DeleteChatModal";
import { useSocket } from "../../../context/SocketProvider";
import { decryptMessage } from "../../../services/crypto.service";
import { useAuth } from "../../../context/AuthProvider";
import { useNotifications } from "../../../hooks/useNotifications";

const processRoomForPreview = async (
  room: ChatRoom,
  userId: string,
  privateKey: string
): Promise<ChatRoom> => {
  const newRoom = { ...room };
  if (!newRoom.lastMessage) {
    newRoom.lastMessagePreview = "No messages yet";
    newRoom.lastMessageTimestamp = newRoom.createdAt;
    return newRoom;
  }

  const {
    sender,
    encryptedTextForSender,
    encryptedTextForRecipient,
    createdAt,
    type,
    fileMetadata,
  } = newRoom.lastMessage;

  const isMyMessage = sender._id === userId;
  const prefix = isMyMessage ? "You: " : "";

  try {
    if (type !== "text" && fileMetadata) {
      newRoom.lastMessagePreview = `${prefix}[${type === "image" ? "📷 Photo" : "📎 File"}: ${fileMetadata.filename}]`;
      newRoom.lastMessageTimestamp = createdAt;
      return newRoom;
    }

  const encryptedStr = isMyMessage
      ? encryptedTextForSender
      : encryptedTextForRecipient;
    const envelopeStr =
      newRoom.lastMessage.encryptedPayloads?.[userId]
        ? JSON.stringify(newRoom.lastMessage.encryptedPayloads[userId])
        : encryptedStr;

    if (!envelopeStr) throw new Error("Missing encrypted text for preview");

    const { ciphertextBase64, nonceBase64 } = JSON.parse(envelopeStr);

    const decryptedText = await decryptMessage(
      ciphertextBase64.trim(),
      nonceBase64.trim(),
      sender.publicKey.trim(),
      privateKey.trim()
    );

    newRoom.lastMessagePreview = `${prefix}${decryptedText}`;
    newRoom.lastMessageTimestamp = createdAt;
  } catch (e) {
    newRoom.lastMessagePreview = `[${isMyMessage ? "Your" : "Encrypted"} ${type || "Message"}]`;
    newRoom.lastMessageTimestamp = newRoom.lastMessage.createdAt;
  }
  return newRoom;
};

export const ChatPage: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const chatRoomsRef = useRef<ChatRoom[]>([]);
  useEffect(() => {
    chatRoomsRef.current = chatRooms;
  }, [chatRooms]);

  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatRoom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const socket = useSocket();
  const { user } = useAuth();
  useNotifications(); // Enable browser push notifications

  const loadRooms = useCallback(async () => {
    if (!user) return;
    const privateKey = localStorage.getItem("privateKey");
    if (!privateKey) return setError("Private key not found.");

    setLoading(true);
    try {
      const rooms = await getMyChatRooms();
      const processedRooms = await Promise.all(
        rooms.map((room) => processRoomForPreview(room, user._id, privateKey))
      );
      processedRooms.sort(
        (a, b) =>
          new Date(b.lastMessageTimestamp || 0).getTime() -
          new Date(a.lastMessageTimestamp || 0).getTime()
      );
      setChatRooms(processedRooms);
    } catch (err) {
      setError("Failed to fetch chat rooms.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Listen for chat_deleted and group_updated events from server
  useEffect(() => {
    if (!socket || !user) return;
    const handleChatDeleted = ({ chatroomId }: { chatroomId: string }) => {
      setChatRooms((prev) => prev.filter((r) => r._id !== chatroomId));
      setSelectedChat((prev) => (prev?._id === chatroomId ? null : prev));
    };
    const handleGroupUpdated = (updatedRoom: Partial<ChatRoom> & { _id: string }) => {
      setChatRooms((prev) => prev.map((r) => 
        r._id === updatedRoom._id 
          ? { 
              ...r, 
              ...updatedRoom, 
              lastMessage: r.lastMessage, 
              lastMessagePreview: r.lastMessagePreview, 
              lastMessageTimestamp: r.lastMessageTimestamp 
            } 
          : r
      ));
      setSelectedChat((prev) => 
        prev?._id === updatedRoom._id 
          ? { 
              ...prev, 
              ...updatedRoom, 
              lastMessage: prev.lastMessage, 
              lastMessagePreview: prev.lastMessagePreview, 
              lastMessageTimestamp: prev.lastMessageTimestamp 
            } 
          : prev
      );
    };

    socket.on("chat_deleted", handleChatDeleted);
    socket.on("group_updated", handleGroupUpdated);
    return () => { 
      socket.off("chat_deleted", handleChatDeleted); 
      socket.off("group_updated", handleGroupUpdated);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleNotification = async (data: {
      chatroomId: string;
      message: Message;
    }) => {
      const { message } = data;
      const privateKey = localStorage.getItem("privateKey");
      if (!privateKey) return;

      const roomExists = chatRoomsRef.current.some(r => r._id === message.chatroomId);
      if (!roomExists) {
        loadRooms();
        return;
      }

      const isActiveRoom =
        selectedChat && selectedChat._id === message.chatroomId;

      setChatRooms((prevRooms) => {
        const roomIndex = prevRooms.findIndex(
          (r) => r._id === message.chatroomId
        );
        if (roomIndex === -1) return prevRooms;
        const roomToUpdate = { ...prevRooms[roomIndex] };

        const currentCount = roomToUpdate.unreadCount?.[user._id] || 0;
        const unreadCountUpdate = {
          ...roomToUpdate.unreadCount,
          [user._id]: isActiveRoom ? 0 : currentCount + 1,
        };

        if (message.type !== "text") {
          const fileType = message.type === "image" ? "📷 Photo" : "📎 File";
          const filename = message.fileMetadata?.filename || "Encrypted File";

          const updatedRoom = {
            ...roomToUpdate,
            lastMessage: message,
            lastMessagePreview: `${message.sender.username}: [${fileType}: ${filename}]`,
            lastMessageTimestamp: message.createdAt,
            unreadCount: unreadCountUpdate,
          };
          const otherRooms = prevRooms.filter(
            (r) => r._id !== message.chatroomId
          );
          const newSortedRooms = [updatedRoom, ...otherRooms];
          newSortedRooms.sort(
            (a, b) =>
              new Date(b.lastMessageTimestamp || 0).getTime() -
              new Date(a.lastMessageTimestamp || 0).getTime()
          );
          return newSortedRooms;
        } else {
          const encryptedText =
            message.encryptedPayloads?.[user._id]
              ? JSON.stringify(message.encryptedPayloads[user._id])
              : message.encryptedTextForRecipient;
          const { sender } = message;
          if (!encryptedText) {
            console.error(
              "Missing encrypted payload in message notification"
            );
            return prevRooms;
          }
          const { ciphertextBase64, nonceBase64 } = JSON.parse(encryptedText);

          decryptMessage(
            ciphertextBase64,
            nonceBase64,
            sender.publicKey,
            privateKey
          )
            .then((decryptedText) => {
              setChatRooms((currentRooms) => {
                const updatedRoom = {
                  ...roomToUpdate,
                  lastMessage: message,
                  lastMessagePreview: `${message.sender.username}: ${decryptedText}`,
                  lastMessageTimestamp: message.createdAt,
                  unreadCount: unreadCountUpdate,
                };
                const otherRooms = currentRooms.filter(
                  (r) => r._id !== message.chatroomId
                );
                const newSortedRooms = [updatedRoom, ...otherRooms];
                newSortedRooms.sort(
                  (a, b) =>
                    new Date(b.lastMessageTimestamp || 0).getTime() -
                    new Date(a.lastMessageTimestamp || 0).getTime()
                );
                return newSortedRooms;
              });
            })
            .catch((e) =>
              console.error("Failed to decrypt notification snippet", e)
            );

          return prevRooms;
        }
      });
    };

    socket.on("new_message_notification", handleNotification);
    return () => {
      socket.off("new_message_notification", handleNotification);
    };
  }, [socket, user, selectedChat]);

  const handleOptimisticUpdate = useCallback((chatRoomId: string, message: Message) => {
    setChatRooms((prevRooms) => {
      const roomIndex = prevRooms.findIndex((r) => r._id === chatRoomId);
      if (roomIndex === -1) return prevRooms;
      const roomToUpdate = { ...prevRooms[roomIndex] };

      let previewText = "";
      if (message.type === "text") {
        previewText = `You: ${message.text}`;
      } else {
        const fileType = message.type === "image" ? "📷 Photo" : "📎 File";
        const filename = message.fileMetadata?.filename || "Encrypted File";
        previewText = `You: [${fileType}: ${filename}]`;
      }

      const updatedRoom = {
        ...roomToUpdate,
        lastMessage: message,
        lastMessagePreview: previewText,
        lastMessageTimestamp: message.createdAt,
      };
      const otherRooms = prevRooms.filter((r) => r._id !== chatRoomId);
      const newSortedRooms = [updatedRoom, ...otherRooms];
      newSortedRooms.sort(
        (a, b) =>
          new Date(b.lastMessageTimestamp || 0).getTime() -
          new Date(a.lastMessageTimestamp || 0).getTime()
      );
      return newSortedRooms;
    });
  }, []);

  const handleSelectChat = useCallback((room: ChatRoom) => {
    setSelectedChat(room);
    if (!user) return;

    const currentUnreadCount =
      chatRooms.find((r) => r._id === room._id)?.unreadCount?.[user._id] || 0;

    if (currentUnreadCount > 0) {
      const originalRooms = chatRooms;

      setChatRooms((prev) =>
        prev.map((r) =>
          r._id === room._id
            ? { ...r, unreadCount: { ...r.unreadCount, [user._id]: 0 } }
            : r
        )
      );

      markChatAsRead(room._id).catch((err) => {
        console.error("Failed to mark chat as read on server:", err);
        setChatRooms(originalRooms);
      });
    }

    setChatRooms((prevRooms) => {
      const roomIndex = prevRooms.findIndex((r) => r._id === room._id);
      if (roomIndex === -1) return prevRooms;

      const roomToUpdate = { ...prevRooms[roomIndex] };
      const updatedRoom = {
        ...roomToUpdate,
        unreadCount: { ...roomToUpdate.unreadCount, [user._id]: 0 },
      };

      const otherRooms = prevRooms.filter((r) => r._id !== room._id);
      return [updatedRoom, ...otherRooms].sort(
        (a, b) =>
          new Date(b.lastMessageTimestamp || 0).getTime() -
          new Date(a.lastMessageTimestamp || 0).getTime()
      );
    });
  }, [user, chatRooms]);

  const handleDeleteChat = useCallback((room: ChatRoom) => {
    setDeleteTarget(room);
  }, []);

  const confirmDeleteChat = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteChatRoom(deleteTarget._id);
      setChatRooms((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      if (selectedChat?._id === deleteTarget._id) {
        setSelectedChat(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete chat:", err);
      alert("Failed to delete chat. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, selectedChat]);

  const getDeleteTargetName = () => {
    if (!deleteTarget || !user) return "";
    if (deleteTarget.type === "group") return deleteTarget.name || "Group chat";
    const other = deleteTarget.participants.find((p) => p._id !== user._id);
    return other?.username || "this chat";
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-wa-dark">
      <ChatList
        chatRooms={chatRooms}
        onSelectChat={handleSelectChat}
        selectedChatId={selectedChat?._id}
        loading={loading}
        error={error}
        onNewChat={() => setIsSearchOpen(true)}
        onDeleteChat={handleDeleteChat}
      />
      <div className="flex-1 flex flex-col h-full">
        {selectedChat ? (
          <ChatWindow
            key={selectedChat._id}
            chatRoom={selectedChat}
            onOptimisticUpdate={handleOptimisticUpdate}
            onDeleteChat={handleDeleteChat}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-wa-panel border-l border-wa-border/30">
            <div className="text-center max-w-md px-6">
              <div className="w-[260px] h-[260px] mx-auto mb-6 flex items-center justify-center">
                <svg className="w-40 h-40 text-wa-text-secondary/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-[32px] font-light text-wa-text-primary mb-3">
                Secure Chat Web
              </h2>
              <p className="text-sm text-wa-text-secondary leading-relaxed mb-8">
                Send and receive messages with end-to-end encryption.
                Select a chat from the sidebar or start a new conversation.
              </p>
              <div className="flex items-center justify-center gap-2 text-wa-text-secondary/50 text-xs">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
                <span>End-to-end encrypted</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {isSearchOpen && (
        <UserSearchModal
          onClose={() => setIsSearchOpen(false)}
          onChatCreated={loadRooms}
        />
      )}
      {deleteTarget && (
        <DeleteChatModal
          chatName={getDeleteTargetName()}
          onConfirm={confirmDeleteChat}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
