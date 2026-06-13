import React, { useState, useEffect } from "react";
import { User } from "../../../types";
import { searchUsers } from "../../../services/user.service";
import { createChatRoom, createGroupChat, addGroupMembers } from "../../../services/chat.service";

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

interface UserSearchModalProps {
  onClose: () => void;
  onChatCreated?: () => void; 
  mode?: "direct" | "group" | "add_to_group";
  existingParticipantIds?: string[];
  chatRoomId?: string;
}

export const UserSearchModal = ({
  onClose,
  onChatCreated,
  mode: initialMode = "direct",
  existingParticipantIds = [],
  chatRoomId,
}: UserSearchModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"direct" | "group" | "add_to_group">(initialMode);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setResults([]);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const response = await searchUsers(searchTerm);
        const filteredUsers = response.items?.filter((u: User) => !existingParticipantIds.includes(u._id)) || [];
        setResults(filteredUsers);
        setError(null);
      } catch (err) {
        setError("Failed to search for users.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const handleStartChat = async (recipientId: string) => {
    try {
      await createChatRoom(recipientId);
      if (onChatCreated) onChatCreated();
      onClose();
    } catch (err) {
      setError("Failed to start chat. Maybe one already exists?");
    }
  };

  const toggleSelectedUser = (nextUser: User) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u._id === nextUser._id)
        ? prev.filter((u) => u._id !== nextUser._id)
        : [...prev, nextUser]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 1) {
      setError("Add a group name and at least one member.");
      return;
    }
    try {
      await createGroupChat(
        groupName.trim(),
        selectedUsers.map((u) => u._id)
      );
      if (onChatCreated) onChatCreated();
      onClose();
    } catch (err) {
      setError("Failed to create group chat.");
    }
  };

  const handleAddToGroup = async () => {
    if (selectedUsers.length < 1 || !chatRoomId) {
      setError("Add at least one member.");
      return;
    }
    try {
      await addGroupMembers(
        chatRoomId,
        selectedUsers.map((u) => u._id)
      );
      if (onChatCreated) onChatCreated();
      onClose();
    } catch (err) {
      setError("Failed to add members to the group.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-wa-header rounded-lg shadow-2xl w-full max-w-md overflow-hidden wa-context-menu">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-wa-green">
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-smooth"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-lg font-normal text-white">
            {mode === "add_to_group" ? "Add to Group" : "New Chat"}
          </h2>
        </div>

        <div className="p-4">
          {/* Mode tabs */}
          {mode !== "add_to_group" && (
          <div className="flex gap-1 mb-4 bg-wa-dark rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-smooth
                ${mode === "direct" ? "bg-wa-unread text-white" : "text-wa-text-secondary hover:text-wa-text-primary"}`}
            >
              Direct
            </button>
            <button
              type="button"
              onClick={() => setMode("group")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-smooth
                ${mode === "group" ? "bg-wa-unread text-white" : "text-wa-text-secondary hover:text-wa-text-primary"}`}
            >
              Group
            </button>
          </div>
          )}

          {/* Group name input */}
          {mode === "group" && (
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2.5 bg-wa-dark border border-wa-border rounded-lg text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread mb-3 text-sm"
            />
          )}

          {/* Selected users chips */}
          {(mode === "group" || mode === "add_to_group") && selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedUsers.map((u) => (
                <span
                  key={u._id}
                  className="inline-flex items-center gap-1 bg-wa-unread/20 text-wa-unread text-xs px-2.5 py-1 rounded-full"
                >
                  {u.username}
                  <button
                    onClick={() => toggleSelectedUser(u)}
                    className="hover:text-white transition-smooth"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="flex items-center bg-wa-dark rounded-lg px-3 mb-3">
            <svg className="w-4 h-4 text-wa-text-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-wa-text-primary placeholder-wa-text-secondary/50 py-2.5 px-3 focus:outline-none"
            />
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-6">
                <span className="w-5 h-5 border-2 border-wa-text-secondary/30 border-t-wa-unread rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div className="text-center py-3">
                <p className="text-wa-danger text-sm">{error}</p>
              </div>
            )}
            {results.length > 0 &&
              results.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center gap-3 p-2.5 hover:bg-wa-sidebar-hover rounded-lg transition-smooth"
                >
                  <img
                    src={user.avatarUrl || DEFAULT_FALLBACK_AVATAR}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_FALLBACK_AVATAR;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wa-text-primary truncate">{user.username}</p>
                    <p className="text-xs text-wa-text-secondary truncate">{user.email}</p>
                  </div>
                  {mode === "direct" ? (
                    <button
                      onClick={() => handleStartChat(user._id)}
                      className="px-3 py-1.5 bg-wa-unread text-white text-xs font-medium rounded-full hover:bg-wa-unread/90 transition-smooth"
                    >
                      Chat
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleSelectedUser(user)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-smooth ${
                        selectedUsers.some((u) => u._id === user._id)
                          ? "bg-wa-unread border-wa-unread"
                          : "border-wa-text-secondary/40"
                      }`}
                    >
                      {selectedUsers.some((u) => u._id === user._id) && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              ))}
            {!loading && searchTerm && results.length === 0 && (
              <p className="text-center text-wa-text-secondary text-sm py-6">No users found</p>
            )}
          </div>

          {/* Create group button */}
          {mode === "group" && (
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length < 1}
              className="mt-4 w-full py-2.5 bg-wa-unread text-white text-sm font-medium rounded-lg hover:bg-wa-unread/90 disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
            >
              Create Group ({selectedUsers.length})
            </button>
          )}

          {mode === "add_to_group" && (
            <button
              onClick={handleAddToGroup}
              disabled={selectedUsers.length < 1}
              className="mt-4 w-full py-2.5 bg-wa-unread text-white text-sm font-medium rounded-lg hover:bg-wa-unread/90 disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
            >
              Add Members ({selectedUsers.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
