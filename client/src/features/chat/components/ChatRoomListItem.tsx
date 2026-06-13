import React, { useState, useRef, useEffect } from "react";
import { ChatRoom } from "../../../types";
import { usePresence } from "../../../context/PresenceProvider";
import { useAuth } from "../../../context/AuthProvider";

function formatChatTime(date: string | Date | null): string {
  if (!date) return "";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return then.toLocaleDateString([], { weekday: "short" });
  }
  return then.toLocaleDateString([], { month: "short", day: "numeric" });
}

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

interface ChatRoomListItemProps {
  room: ChatRoom;
  isSelected: boolean;
  onSelect: (room: ChatRoom) => void;
  onDelete?: (room: ChatRoom) => void;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageTimestamp: string | Date | null;
  otherParticipantName: string;
}

const ChatRoomListItemComponent: React.FC<ChatRoomListItemProps> = ({
  room,
  isSelected,
  onSelect,
  onDelete,
  unreadCount,
  lastMessagePreview,
  lastMessageTimestamp,
  otherParticipantName,
}) => {
  const { user } = useAuth();
  const { onlineUsers } = usePresence();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const contextRef = useRef<HTMLDivElement>(null);

  const otherParticipant = room.participants.find((p) => p._id !== user?._id);
  const isOnline = otherParticipant
    ? onlineUsers.has(otherParticipant._id)
    : false;
  const avatarSrc =
    room.type === "group"
      ? room.avatarUrl || DEFAULT_FALLBACK_AVATAR
      : otherParticipant?.avatarUrl;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  useEffect(() => {
    if (!showContextMenu) return;
    const close = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showContextMenu]);

  return (
    <>
      <div
        onClick={() => onSelect(room)}
        onContextMenu={handleContextMenu}
        className={`flex items-center px-3 py-[10px] cursor-pointer transition-smooth border-b border-wa-border/30
          ${isSelected ? "bg-wa-sidebar-hover" : "hover:bg-wa-sidebar-hover/50"}`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0 mr-3">
          <img
            src={avatarSrc}
            alt={otherParticipantName || "User Avatar"}
            className="w-[49px] h-[49px] rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FALLBACK_AVATAR;
            }}
          />
          {room.type !== "group" && isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-unread rounded-full border-2 border-wa-sidebar" />
          )}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-center">
            <h3 className="font-normal text-[17px] text-wa-text-primary truncate">
              {otherParticipantName}
            </h3>
            {lastMessageTimestamp && (
              <span className={`ml-2 text-xs flex-shrink-0 ${
                unreadCount > 0 ? 'text-wa-unread' : 'text-wa-text-secondary'
              }`}>
                {formatChatTime(lastMessageTimestamp)}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <p className="text-sm text-wa-text-secondary truncate pr-2">
              {lastMessagePreview}
            </p>
            {unreadCount > 0 && (
              <span className="ml-1 bg-wa-unread text-wa-dark text-[11px] font-bold min-w-[20px] h-[20px] px-[5px] rounded-full flex items-center justify-center flex-shrink-0">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 wa-context-menu"
          style={{ top: contextPos.y, left: contextPos.x }}
        >
          <div className="bg-wa-header border border-wa-border rounded-lg shadow-2xl overflow-hidden min-w-[180px] py-1">
            <button
              onClick={() => {
                setShowContextMenu(false);
                onSelect(room);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover transition-smooth"
            >
              Open chat
            </button>
            {onDelete && (
              <button
                onClick={() => {
                  setShowContextMenu(false);
                  onDelete(room);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-wa-danger hover:bg-wa-sidebar-hover transition-smooth"
              >
                Delete chat
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const ChatRoomListItem = React.memo(ChatRoomListItemComponent, (prev, next) => {
  return (
    prev.room._id === next.room._id &&
    prev.isSelected === next.isSelected &&
    prev.unreadCount === next.unreadCount &&
    prev.lastMessagePreview === next.lastMessagePreview &&
    prev.lastMessageTimestamp === next.lastMessageTimestamp &&
    prev.otherParticipantName === next.otherParticipantName
  );
});
