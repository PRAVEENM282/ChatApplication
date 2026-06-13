import React, { useState, useMemo } from "react";
import { ChatRoom } from "../../../types";
import { useAuth } from "../../../context/AuthProvider";
import { ChatRoomListItem } from "./ChatRoomListItem";
import { Link } from "react-router-dom";

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

interface ChatListProps {
  chatRooms: ChatRoom[];
  onSelectChat: (chatRoom: ChatRoom) => void;
  selectedChatId?: string;
  loading: boolean;
  error: string | null;
  onNewChat: () => void;
  onDeleteChat?: (room: ChatRoom) => void;
}

const ChatListComponent: React.FC<ChatListProps> = ({
  chatRooms,
  onSelectChat,
  selectedChatId,
  loading,
  error,
  onNewChat,
  onDeleteChat,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const getOtherParticipantName = (room: ChatRoom) => {
    if (room.type === "group") return room.name || "Group chat";
    if (!user) return "Unknown User";
    const other = room.participants.find((p) => p._id !== user._id);
    return other?.username || "Unknown User";
  };

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return chatRooms;
    const q = searchQuery.toLowerCase();
    return chatRooms.filter((room) => {
      const name = getOtherParticipantName(room).toLowerCase();
      return name.includes(q);
    });
  }, [chatRooms, searchQuery, user]);

  return (
    <div className="w-[350px] bg-wa-sidebar flex flex-col h-full border-r border-wa-border/50">
      {/* Header */}
      <div className="px-4 py-3 bg-wa-header flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            title="My Profile"
            className="rounded-full hover:opacity-80 transition-smooth"
          >
            <img
              src={user?.avatarUrl} 
              alt="user"
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_FALLBACK_AVATAR; 
              }}
            />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            title="New chat"
            className="w-10 h-10 flex items-center justify-center text-wa-icon hover:text-wa-text-primary rounded-full hover:bg-wa-sidebar-hover transition-smooth"
          >
            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 8v6M9 11h6" strokeLinecap="round" />
            </svg>
          </button>
          <Link
            to="/profile"
            title="Settings"
            className="w-10 h-10 flex items-center justify-center text-wa-icon hover:text-wa-text-primary rounded-full hover:bg-wa-sidebar-hover transition-smooth"
          >
            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="12" cy="19" r="1" fill="currentColor" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 py-1.5 bg-wa-sidebar flex-shrink-0">
        <div className="flex items-center bg-wa-search-bg rounded-lg px-3">
          <svg className="w-4 h-4 text-wa-text-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start new chat"
            className="flex-1 bg-transparent border-none text-sm text-wa-text-primary placeholder-wa-text-secondary/60 py-2 px-3 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-wa-text-secondary hover:text-wa-text-primary transition-smooth"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-1 p-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-12 h-12 rounded-full wa-skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded wa-skeleton" />
                  <div className="h-3 w-48 rounded wa-skeleton" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <p className="text-wa-danger text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && filteredRooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {searchQuery ? (
              <>
                <svg className="w-16 h-16 text-wa-text-secondary/30 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                <p className="text-wa-text-secondary text-sm">No chats found</p>
              </>
            ) : (
              <>
                <svg className="w-16 h-16 text-wa-text-secondary/30 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-wa-text-secondary text-sm">No chats yet</p>
                <p className="text-wa-text-secondary/60 text-xs mt-1">Start a conversation!</p>
              </>
            )}
          </div>
        )}

        {!loading &&
          !error &&
          filteredRooms.map((room) => {
            if (!user) return null;
            const unreadCountForUser = room.unreadCount?.[user._id] || 0;
            const lastMessagePreview =
              room.lastMessagePreview || "No messages yet";
            const lastMessageTimestamp =
              room.lastMessageTimestamp || room.lastMessage?.createdAt;
            return (
              <ChatRoomListItem
                key={room._id}
                room={room}
                isSelected={room._id === selectedChatId}
                onSelect={onSelectChat}
                onDelete={onDeleteChat}
                unreadCount={unreadCountForUser} 
                lastMessagePreview={lastMessagePreview}
                lastMessageTimestamp={lastMessageTimestamp ?? null}
                otherParticipantName={getOtherParticipantName(room)}
              />
            );
          })}
      </div>
    </div>
  );
};

export const ChatList = React.memo(ChatListComponent);
