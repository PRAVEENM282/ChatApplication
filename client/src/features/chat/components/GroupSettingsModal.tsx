import React, { useState } from "react";
import { ChatRoom, User } from "../../../types";
import { useAuth } from "../../../context/AuthProvider";
import {
  removeGroupMember,
  addGroupAdmin,
  removeGroupAdmin,
  leaveGroupChat,
} from "../../../services/chat.service";
import { UserSearchModal } from "./UserSearchModal";

interface GroupSettingsModalProps {
  chatRoom: ChatRoom;
  onClose: () => void;
}

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=Group";

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  chatRoom,
  onClose,
}) => {
  const { user } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const isAdmin = chatRoom.admins?.includes(user?._id || "");
  const isOnlyAdmin =
    chatRoom.admins?.length === 1 && chatRoom.admins[0] === user?._id;

  const handleAction = async (actionId: string, actionFn: () => Promise<any>) => {
    try {
      setLoadingAction(actionId);
      await actionFn();
    } catch (error) {
      console.error(`Failed action: ${actionId}`, error);
      alert("Action failed. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const onRemoveMember = (memberId: string) => {
    handleAction(`remove-${memberId}`, () =>
      removeGroupMember(chatRoom._id, memberId)
    );
  };

  const onMakeAdmin = (memberId: string) => {
    handleAction(`make-admin-${memberId}`, () =>
      addGroupAdmin(chatRoom._id, memberId)
    );
  };

  const onDismissAdmin = (memberId: string) => {
    handleAction(`dismiss-admin-${memberId}`, () =>
      removeGroupAdmin(chatRoom._id, memberId)
    );
  };

  const onLeaveGroup = () => {
    if (isOnlyAdmin && chatRoom.participants.length > 1) {
      alert("You must assign another admin before leaving the group.");
      return;
    }
    if (window.confirm("Are you sure you want to leave this group?")) {
      handleAction("leave", async () => {
        await leaveGroupChat(chatRoom._id);
        onClose(); // Ideally, the UI will redirect away after the socket event.
      });
    }
  };

  if (showAddMembers) {
    return (
      <UserSearchModal
        onClose={() => setShowAddMembers(false)}
        mode="add_to_group"
        existingParticipantIds={chatRoom.participants.map((p) => p._id)}
        chatRoomId={chatRoom._id}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-wa-dark w-full max-w-md rounded-2xl shadow-2xl border border-wa-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-wa-border/50 flex items-center justify-between bg-wa-header">
          <h2 className="text-lg font-semibold text-wa-text-primary">
            Group Info
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-wa-icon hover:text-wa-text-primary rounded-full hover:bg-wa-sidebar-hover transition-smooth"
          >
            ✕
          </button>
        </div>

        {/* Group Info Profile */}
        <div className="p-6 flex flex-col items-center border-b border-wa-border/50 bg-wa-dark/50">
          <img
            src={chatRoom.avatarUrl || DEFAULT_FALLBACK_AVATAR}
            alt="group avatar"
            className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-wa-border/50"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FALLBACK_AVATAR;
            }}
          />
          <h3 className="mt-4 text-xl font-medium text-wa-text-primary text-center break-all">
            {chatRoom.name || "Unnamed Group"}
          </h3>
          <p className="text-sm text-wa-text-secondary mt-1">
            Group • {chatRoom.participants.length} participants
          </p>
        </div>

        {/* Participants List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isAdmin && (
            <button
              onClick={() => setShowAddMembers(true)}
              className="w-full flex items-center gap-4 p-3 hover:bg-wa-sidebar-hover transition-smooth rounded-lg text-wa-unread font-medium"
            >
              <div className="w-10 h-10 rounded-full bg-wa-unread/20 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-wa-unread"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              Add Members
            </button>
          )}

          <div className="mt-2 mb-1 px-3 text-xs font-semibold text-wa-text-secondary uppercase tracking-wider">
            Participants
          </div>

          {chatRoom.participants.map((p) => {
            const isParticipantAdmin = chatRoom.admins?.includes(p._id);
            const isMe = p._id === user?._id;

            return (
              <div
                key={p._id}
                className="flex items-center justify-between p-3 hover:bg-wa-sidebar-hover transition-smooth rounded-lg group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={p.avatarUrl || DEFAULT_FALLBACK_AVATAR}
                    alt={p.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-wa-text-primary">
                      {isMe ? "You" : p.username}
                    </p>
                    {isParticipantAdmin && (
                      <p className="text-xs text-wa-unread mt-0.5">
                        Group Admin
                      </p>
                    )}
                  </div>
                </div>

                {!isMe && isAdmin && (
                  <div className="relative">
                    <button
                      className="text-wa-icon hover:text-wa-text-primary p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      disabled={loadingAction !== null}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {/* Action Dropdown (Hover based for simplicity, could be click-based) */}
                    <div className="absolute right-0 top-full mt-1 w-40 bg-wa-header border border-wa-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      {isParticipantAdmin ? (
                        <button
                          onClick={() => onDismissAdmin(p._id)}
                          className="w-full text-left px-4 py-2 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover first:rounded-t-lg"
                        >
                          Dismiss as admin
                        </button>
                      ) : (
                        <button
                          onClick={() => onMakeAdmin(p._id)}
                          className="w-full text-left px-4 py-2 text-sm text-wa-text-primary hover:bg-wa-sidebar-hover first:rounded-t-lg"
                        >
                          Make group admin
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveMember(p._id)}
                        className="w-full text-left px-4 py-2 text-sm text-wa-danger hover:bg-wa-sidebar-hover last:rounded-b-lg"
                      >
                        Remove from group
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-2 border-t border-wa-border/50 bg-wa-header">
          <button
            onClick={onLeaveGroup}
            disabled={loadingAction === "leave"}
            className="w-full flex items-center gap-4 p-3 hover:bg-wa-sidebar-hover transition-smooth rounded-lg text-wa-danger font-medium disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-wa-danger/10 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            {loadingAction === "leave" ? "Leaving..." : "Leave Group"}
          </button>
        </div>
      </div>
    </div>
  );
};
