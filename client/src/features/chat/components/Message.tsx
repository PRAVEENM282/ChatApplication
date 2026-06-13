import React, { useState } from "react";
import { Message as MessageType } from "../../../types/chat.types";
import { useAuth } from "../../../context/AuthProvider";
import { MessageStatus } from "./MessageStatus";
import axios from "axios"; 
import { decryptFileSymmetrically } from "../../../services/crypto.service"; 

interface MessageProps {
  message: MessageType;
  decryptedFileKey?: Uint8Array;
  showTail?: boolean;
}

const FileRenderer: React.FC<{
  message: MessageType;
  decryptedFileKey?: Uint8Array;
  isMe: boolean;
}> = ({ message, decryptedFileKey, isMe }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const isImage = message.type === "image";

  if (!message.fileMetadata) {
    return <p className="text-wa-danger text-sm">Error: Missing file metadata.</p>;
  }

  const { fileUrl, chunkUrls, header, filename, mimetype, size } =
    message.fileMetadata;
  const totalChunks = message.fileMetadata?.totalChunks || 1;

  const handleDownload = async () => {
    if (!decryptedFileKey) {
      setDownloadError("File key not available. Cannot decrypt.");
      return;
    }
    if (isImage && blobUrl) return;

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress(0);

    try {
      const encryptedChunks: Uint8Array[] = [];
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunkUrl =
          chunkUrls?.[chunkIndex] ||
          fileUrl.replace(/\.chunk0\.enc$/, `.chunk${chunkIndex}.enc`);
        try {
          const response = await axios.get(chunkUrl, {
            responseType: "arraybuffer",
          });
          if (!response.data || response.data.byteLength === 0) {
            throw new Error(`Chunk ${chunkIndex} returned empty data.`);
          }
          const chunkBytes = new Uint8Array(response.data);
          encryptedChunks.push(chunkBytes);
          setDownloadProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
        } catch (fetchErr: any) {
          throw new Error(`Failed to fetch required file chunk ${chunkIndex}.`);
        }
      }

      if (encryptedChunks.length !== totalChunks) {
        throw new Error(
          `Downloaded ${encryptedChunks.length} chunks, expected ${totalChunks}.`
        );
      }

      if (encryptedChunks.length === 0) {
        throw new Error("Could not retrieve file chunks.");
      }

      const decryptedBytes = await decryptFileSymmetrically(
        encryptedChunks,
        header,
        decryptedFileKey
      );
      const uint8Copy = new Uint8Array(decryptedBytes as Uint8Array);
      const blob = new Blob([uint8Copy], { type: mimetype });
      const newBlobUrl = URL.createObjectURL(blob);

      if (isImage) {
        setBlobUrl(newBlobUrl);
      } else {
        const a = document.createElement("a");
        a.href = newBlobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(newBlobUrl);
      }
    } catch (e) {
      setDownloadError("Decryption/Download failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  const fileSizeFormatted = size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${(size / 1024).toFixed(0)} KB`;

  if (isImage && blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={filename}
        className="max-w-[280px] max-h-[300px] rounded-lg object-cover cursor-pointer"
        onClick={() => window.open(blobUrl, "_blank")}
      />
    );
  }

  if (isDownloading) {
    return (
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-10 h-10 rounded-full border-2 border-wa-text-secondary/30 flex items-center justify-center flex-shrink-0 relative">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-wa-text-secondary/20" strokeWidth="2" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-wa-unread" strokeWidth="2"
              strokeDasharray={`${downloadProgress * 0.94} 100`} strokeLinecap="round" />
          </svg>
          <span className="text-[10px] text-wa-text-secondary">{downloadProgress}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{filename}</p>
          <p className="text-xs text-wa-text-secondary mt-0.5">Downloading...</p>
        </div>
      </div>
    );
  }

  if (decryptedFileKey) {
    return (
      <button
        onClick={handleDownload}
        className="flex items-center gap-3 min-w-[200px] group"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isMe ? 'bg-wa-teal/30' : 'bg-wa-border'
        }`}>
          {isImage ? (
            <svg className="w-5 h-5 text-wa-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-wa-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium truncate group-hover:underline">{filename}</p>
          <p className="text-xs text-wa-text-secondary mt-0.5">
            {fileSizeFormatted} • {isImage ? 'Tap to view' : 'Tap to download'}
          </p>
        </div>
        {downloadError && (
          <p className="text-xs text-wa-danger mt-1">{downloadError}</p>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isMe ? 'bg-wa-teal/30' : 'bg-wa-border'
      }`}>
        <svg className="w-5 h-5 text-wa-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-wa-text-secondary mt-0.5">
          {message.status === "sending" ? (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-wa-text-secondary/30 border-t-wa-text-secondary rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            `${fileSizeFormatted} • Key pending`
          )}
        </p>
      </div>
    </div>
  );
};

const MessageComponent = ({ message, decryptedFileKey, showTail = false }: MessageProps) => {
  const { user } = useAuth();
  const isMe = message.sender._id === user?._id;
  const isFileMessage = message.type === "file" || message.type === "image";

  const messageContent = isFileMessage ? (
    <FileRenderer message={message} decryptedFileKey={decryptedFileKey} isMe={isMe} />
  ) : (
    <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{message.text}</p>
  );

  return (
    <div className={`flex mb-[2px] px-[6%] ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[65%] px-[9px] pt-[6px] pb-[8px] rounded-lg
          ${isMe
            ? `bg-wa-bubble-out text-wa-text-primary ${showTail ? 'wa-bubble-tail-out rounded-tr-none' : ''}`
            : `bg-wa-bubble-in text-wa-text-primary ${showTail ? 'wa-bubble-tail-in rounded-tl-none' : ''}`
          }`}
      >
        {!isMe && (
          <p className="text-xs font-medium text-wa-unread mb-0.5">
            {message.sender.username}
          </p>
        )}

        {messageContent}

        {/* Time + Status inline footer */}
        <div className={`flex items-center justify-end gap-1 mt-0.5 -mb-1 ${
          isFileMessage ? 'mt-1.5' : ''
        }`}>
          <span className="text-[11px] text-wa-text-secondary/70 leading-none">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <MessageStatus status={message.status} isMe={isMe} />
        </div>
      </div>
    </div>
  );
};

export const Message = React.memo(MessageComponent, (prev, next) => {
  return (
    prev.message._id === next.message._id &&
    prev.message.status === next.message.status &&
    prev.decryptedFileKey === next.decryptedFileKey &&
    prev.showTail === next.showTail
  );
});
