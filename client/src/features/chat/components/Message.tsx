import React, { useState } from "react";
import { Message as MessageType } from "../../../types/chat.types";
import { useAuth } from "../../../context/AuthProvider";
import { MessageStatus } from "./MessageStatus";
import axios from "axios"; 
import { decryptFileSymmetrically } from "../../../services/crypto.service"; 
interface MessageProps {
  message: MessageType;
  decryptedFileKey?: Uint8Array;
}

const FileRenderer: React.FC<{
  message: MessageType;
  decryptedFileKey?: Uint8Array;
}> = ({ message, decryptedFileKey }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const isImage = message.type === "image";

  if (!message.fileMetadata) {
    return <p className="text-red-500">Error: Missing file metadata.</p>;
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
      const blob = new Blob([uint8Copy], {
        type: mimetype,
      });
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

  if (isImage && blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={filename}
        className="max-w-xs max-h-64 rounded-lg object-contain cursor-pointer"
        onClick={() => window.open(blobUrl, "_blank")}
      />
    );
  }

  if (isDownloading) {
    return (
      <div className="flex flex-col items-start space-y-2">
        <p className="text-sm font-semibold">{filename}</p>
        <p className="text-xs text-yellow-100">Downloading and decrypting...</p>
      </div>
    );
  }

  if (decryptedFileKey) {
    return (
      <div className="flex flex-col items-start space-y-2">
        <p className="text-sm font-semibold text-white">{filename}</p>
        <button
          onClick={handleDownload}
          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300"
        >
          {isImage && !blobUrl
            ? `View Image`
            : `Download File (${(size / 1024 / 1024).toFixed(2)} MB)`}
        </button>
        {downloadError && (
          <p className="text-xs text-red-500">{downloadError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start space-y-2">
      <p className="text-sm font-semibold">{filename}</p>
      {message.status === "sending" ? (
        <p className="text-xs text-yellow-400">⏳ Sending file...</p>
      ) : (
        <p className="text-xs text-red-400">File key pending/unavailable.</p>
      )}
      {downloadError && <p className="text-xs text-red-500">{downloadError}</p>}
    </div>
  );
};

export const Message = ({ message, decryptedFileKey }: MessageProps) => {
  const { user } = useAuth();
  const isMe = message.sender._id === user?._id;

  const isFileMessage = message.type === "file" || message.type === "image";

  // Set the container color based on message type
  const containerClass = isFileMessage
    ? isMe
      ? "bg-blue-600"
      : "bg-gray-100"
    : isMe
      ? "bg-blue-500"
      : "bg-gray-100";

  // Determine message content rendering
  const messageContent = isFileMessage ? (
    <FileRenderer message={message} decryptedFileKey={decryptedFileKey} />
  ) : (
    <p className="text-sm">{message.text}</p>
  );

  return (
    <div className={`flex mb-3 ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-lg px-4 py-2 break-words
        ${containerClass} ${isMe ? "text-white rounded-xl rounded-br-none" : "text-gray-800 rounded-xl rounded-bl-none"}`}
      >
        {!isMe && (
          <p className="text-xs font-semibold text-gray-600 mb-1">
            {message.sender.username}
          </p>
        )}
        {messageContent}
        <p
          className={`text-xs mt-1 ${isMe ? "text-blue-100" : "text-gray-400"} text-right`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <MessageStatus status={message.status} isMe={isMe} />
        <span
          className={`absolute w-0 h-0 bottom-0
            ${
              isMe
                ? `-right-2 border-l-8 border-l-${isFileMessage ? "blue-600" : "blue-500"} border-t-8 border-t-transparent border-b-8 border-b-transparent`
                : `-left-2 border-r-8 border-r-${isFileMessage ? "gray-100" : "gray-100"} border-t-8 border-t-transparent border-b-8 border-b-transparent`
            }`}
        />
      </div>
    </div>
  );
};
