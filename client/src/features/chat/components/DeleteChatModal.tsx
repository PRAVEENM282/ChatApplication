import React from "react";

interface DeleteChatModalProps {
  chatName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteChatModal: React.FC<DeleteChatModalProps> = ({
  chatName,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-wa-header rounded-lg shadow-2xl w-full max-w-sm wa-context-menu overflow-hidden">
        <div className="p-6">
          <h3 className="text-wa-text-primary text-lg font-medium mb-2">
            Delete chat?
          </h3>
          <p className="text-wa-text-secondary text-sm leading-relaxed">
            Delete chat with <span className="text-wa-text-primary font-medium">{chatName}</span>?
            All messages will be permanently removed. This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-5 py-2 text-sm font-medium text-wa-text-secondary hover:text-wa-text-primary rounded-full transition-smooth disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2 text-sm font-medium text-wa-danger hover:bg-wa-danger/10 rounded-full transition-smooth disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};
