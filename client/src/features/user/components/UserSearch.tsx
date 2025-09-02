import React, { useState } from "react";
import { searchUsers } from "../../../services/user.service";
import { User } from "../../../types/user.types";

interface UserSearchProps {
  onSelectUser: (user: User) => void;
}

const UserSearch: React.FC<UserSearchProps> = ({ onSelectUser }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (query.trim() === "") return;
    setLoading(true);
    setError(null);
    try {
      const users = await searchUsers(query);
      setResults(users);
    } catch (e: any) {
      const message = e?.response?.status === 401 || e?.response?.status === 403
        ? "Your session expired. Re-authenticating..."
        : (e?.response?.data?.message || "Failed to search users");
      setError(message);
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search users"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-grow border rounded px-3 py-2"
        />
        <button onClick={handleSearch} disabled={loading || !query.trim()} className="bg-gray-800 text-white px-4 rounded disabled:bg-gray-400">
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {error && <div className="text-sm text-red-600 p-2">{error}</div>}
      <ul className="divide-y">
        {results.length === 0 && query && !loading && !error ? (
          <li className="text-sm text-gray-500 p-2">No users found</li>
        ) : (
          results.map((user) => (
            <li key={user._id}>
              <button className="w-full text-left p-2 hover:bg-gray-100 rounded" onClick={() => onSelectUser(user)}>{user.username}</button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default UserSearch;
