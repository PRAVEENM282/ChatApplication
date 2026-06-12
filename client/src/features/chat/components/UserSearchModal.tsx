import React, { useState, useEffect } from "react";
import { User } from "../../../types";
import { searchUsers } from "../../../services/user.service";
import { createChatRoom, createGroupChat } from "../../../services/chat.service";

interface UserSearchModalProps {
  onClose: () => void;
  onChatCreated: () => void; 
}

export const UserSearchModal = ({
  onClose,
  onChatCreated,
}: UserSearchModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"direct" | "group">("direct");
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
        setResults(response.items || []);
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
      onChatCreated();
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
    if (!groupName.trim() || selectedUsers.length < 2) {
      setError("Add a group name and at least two members.");
      return;
    }
    try {
      await createGroupChat(
        groupName.trim(),
        selectedUsers.map((u) => u._id)
      );
      onChatCreated();
      onClose();
    } catch (err) {
      setError("Failed to create group chat.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Start a New Chat</h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={`p-2 rounded-md text-sm font-semibold ${
              mode === "direct" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setMode("group")}
            className={`p-2 rounded-md text-sm font-semibold ${
              mode === "group" ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            Group
          </button>
        </div>
        {mode === "group" && (
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md mb-3"
          />
        )}
        <input
          type="text"
          placeholder="Search for users by username or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md mb-4"
        />
        <div className="max-h-60 overflow-y-auto">
          {loading && <p className="text-center text-gray-500">Loading...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}
          {results.length > 0 &&
            results.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-md"
              >
                <p className="font-semibold">{user.username}</p>
                {mode === "direct" ? (
                  <button
                    onClick={() => handleStartChat(user._id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600"
                  >
                    Chat
                  </button>
                ) : (
                  <button
                    onClick={() => toggleSelectedUser(user)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      selectedUsers.some((u) => u._id === user._id)
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {selectedUsers.some((u) => u._id === user._id)
                      ? "Added"
                      : "Add"}
                  </button>
                )}
              </div>
            ))}
          {!loading && searchTerm && results.length === 0 && (
            <p className="text-center text-gray-500">No users found.</p>
          )}
        </div>
        {mode === "group" && (
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length < 2}
            className="mt-4 w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Create Group ({selectedUsers.length})
          </button>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-200 p-2 rounded-md hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
};
