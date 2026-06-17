import React, { useRef, useState } from "react";
import { useSocket } from "../../../context/SocketProvider";
import { useAuth } from "../../../context/AuthProvider";
import { ChatRoom, Message } from "../../../types/chat.types";
import {
  encryptFileForParticipants,
  encryptMessageForParticipants,
} from "../../../services/crypto.service";
import { sendEncryptedFile } from "../../../services/chat.service";

interface MessageInputProps {
  chatRoom: ChatRoom;
  onNewMessage: (msg: Message) => void;
  onOptimisticUpdate: (chatroomId: string, message: Message) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const MessageInput: React.FC<MessageInputProps> = ({
  chatRoom,
  onNewMessage,
  onOptimisticUpdate,
}) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const socket = useSocket();
  const { user } = useAuth();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTyping = () => {
    if (!socket) return;

    if (!typingTimeoutRef.current) {
      socket.emit("start_typing", {
        userId: user?._id,
        chatroomId: chatRoom._id,
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { chatroomId: chatRoom._id });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE) {
      alert(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    setFile(selectedFile);
    setText("");
    setShowAttachMenu(false);
  };

  const fileSizeFormatted = (size: number) => {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024).toFixed(0)} KB`;
  };

  const handleFileSend = async (file: File) => {
    if (!file || !user) return;
    setIsSending(true);

    let optimisticMessage: Message | undefined;

    try {
      const myPrivateKey = localStorage.getItem("privateKey");
      if (!myPrivateKey) throw new Error("Private key not found!");

      const participants = chatRoom.participants.map((p) => ({
        userId: p._id,
        publicKey: p.publicKey,
      }));

      const cryptoData = await encryptFileForParticipants(
        file,
        participants,
        myPrivateKey
      );
      const recipient = chatRoom.participants.find((p) => p._id !== user._id);

      const totalChunks = cryptoData.encryptedChunks.length;

      const tempId = `temp-${Date.now()}`;
      const createdAt = new Date().toISOString();
      optimisticMessage = {
        _id: tempId,
        chatroomId: chatRoom._id,
        sender: user,
        type: file.type.startsWith("image/") ? "image" : "file",
        text: file.name,
        createdAt: createdAt,
        status: "sending",
        fileMetadata: {
          filename: file.name,
          fileUrl: "",
          mimetype: file.type,
          size: file.size,
          header: cryptoData.header,
          keyNonce: cryptoData.keyNonce,
          encryptedFileKeyForRecipient:
            (recipient && cryptoData.encryptedFileKeys[recipient._id]) || "",
          encryptedFileKeyForSender: cryptoData.encryptedFileKeys[user._id],
          encryptedFileKeys: cryptoData.encryptedFileKeys,
          keyId: cryptoData.keyId,
          totalChunks: totalChunks,
        },
      };

      onNewMessage(optimisticMessage);
      onOptimisticUpdate(chatRoom._id, optimisticMessage);
      const uniqueFileId = cryptoData.keyId;
      const originalFileExtension = file.name.substring(
        file.name.lastIndexOf(".")
      );

      const formData = new FormData();
      formData.append("originalFilename", file.name);

      cryptoData.encryptedChunks.forEach((chunk: string, idx: number) => {
        const binaryData = Uint8Array.from(atob(chunk), (c) => c.charCodeAt(0));
        const blob = new Blob([binaryData], {
          type: "application/octet-stream",
        });
        const filenameForDisk = `${uniqueFileId}.chunk${idx}.enc`;
        formData.append("files", blob, filenameForDisk);
      });

      formData.append("header", cryptoData.header);
      formData.append("keyNonce", cryptoData.keyNonce);
      formData.append("encryptedFileKeys", JSON.stringify(cryptoData.encryptedFileKeys));
      if (recipient && cryptoData.encryptedFileKeys[recipient._id]) {
        formData.append(
          "encryptedKeyForRecipient",
          cryptoData.encryptedFileKeys[recipient._id]
        );
      }
      formData.append("encryptedKeyForSelf", cryptoData.encryptedFileKeys[user._id]);
      formData.append("keyId", cryptoData.keyId);
      formData.append("originalExtension", originalFileExtension);
      formData.append("totalChunks", totalChunks.toString());

      const uploadResult = await sendEncryptedFile(formData, chatRoom._id);

      if (!uploadResult) throw new Error("File upload failed");

      setFile(null); 
    } catch (e:any) {
      alert(`Failed to send file. Please try again.`);

      if (optimisticMessage) {
        onOptimisticUpdate(chatRoom._id, {
          ...optimisticMessage,
          text: `[Failed to Send: ${file.name}]`,
          status: "failed",
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleMessageSend = async (text: string) => {
    if (!user) return;
    setIsSending(true);

    try {
      const myPrivateKey = localStorage.getItem("privateKey");
      if (!myPrivateKey) throw new Error("Private key not found!");

      const createdAt = new Date().toISOString();
      const participants = chatRoom.participants.map((p) => ({
        userId: p._id,
        publicKey: p.publicKey,
      }));

      const encryptedPayloads = await encryptMessageForParticipants(
        text,
        participants,
        myPrivateKey
      );
      const recipient = chatRoom.participants.find((p) => p._id !== user._id);

      const messagePayload = {
        chatroomId: chatRoom._id,
        encryptedPayloads,
        encryptedTextForRecipient:
          recipient && encryptedPayloads[recipient._id]
            ? JSON.stringify(encryptedPayloads[recipient._id])
            : undefined,
        encryptedTextForSender: JSON.stringify(encryptedPayloads[user._id]),
      };

      const localMessage: Message = {
        _id: `temp-${Date.now()}`,
        chatroomId: chatRoom._id,
        sender: user,
        text: text,
        createdAt: createdAt,
        encryptedTextForRecipient: messagePayload.encryptedTextForRecipient,
        encryptedTextForSender: messagePayload.encryptedTextForSender,
        encryptedPayloads,
        status: "sent",
        type: "text",
      };

      onNewMessage(localMessage);
      onOptimisticUpdate(chatRoom._id, localMessage);
      socket?.emit("send_message", messagePayload);

      setText("");
    } catch (e) {
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSending || (!text.trim() && !file)) return;
    if (file) {
      await handleFileSend(file);
    }
    if (text.trim()) {
      await handleMessageSend(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="bg-wa-header border-t border-wa-border/30 px-4 py-2.5 flex-shrink-0">
      {/* File preview bar */}
      {file && (
        <div className="flex items-center gap-3 mb-2 p-2.5 bg-wa-dark rounded-lg">
          <div className="w-8 h-8 rounded-md bg-wa-teal/20 flex items-center justify-center flex-shrink-0">
            {file.type.startsWith("image/") ? (
              <svg className="w-4 h-4 text-wa-unread" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-wa-unread" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-wa-text-primary truncate">{file.name}</p>
            <p className="text-xs text-wa-text-secondary">{fileSizeFormatted(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-wa-text-secondary hover:text-wa-text-primary p-1 transition-smooth"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Attachment button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="w-10 h-10 flex items-center justify-center text-wa-icon hover:text-wa-text-primary transition-smooth rounded-full"
          >
            <svg className={`w-6 h-6 transition-transform duration-200 ${showAttachMenu ? 'rotate-45' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" />
            </svg>
          </button>

          {/* Attachment menu popup */}
          {showAttachMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowAttachMenu(false)} />
              <div className="absolute bottom-12 left-0 z-40 wa-dropdown-enter">
                <div className="bg-wa-header border border-wa-border rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-wa-sidebar-hover cursor-pointer transition-smooth">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <span className="text-wa-text-primary text-sm">Document</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-wa-sidebar-hover cursor-pointer transition-smooth">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <span className="text-wa-text-primary text-sm">Photos & Videos</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Text input */}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            disabled={isSending || !!file}
            className="w-full px-4 py-2.5 bg-wa-input-bg border-none rounded-lg text-wa-text-primary text-sm placeholder-wa-text-secondary/60 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={
              isSending
                ? "Sending..."
                : file
                  ? `Ready to send ${file.name}`
                  : "Type a message"
            }
          />
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={isSending || (!text.trim() && !file)}
          className="w-10 h-10 flex items-center justify-center bg-wa-unread hover:bg-wa-unread/90 text-white rounded-full transition-smooth disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isSending ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};
