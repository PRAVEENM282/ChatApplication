import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import crypto from "crypto";
import { getS3BucketName, getS3Client, isS3Configured } from "../config/s3.js";

function generateRandomHex(bytes = 8) {
  return crypto.randomBytes(bytes).toString("hex");
}

// Local disk filename generator (unique, avoids user-controlled names)
function generateDiskFilename(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const random = generateRandomHex(8);
  const userId = req.userId || "anon";
  cb(null, `${userId}-${Date.now()}-${random}${ext}`);
}

function encryptedChunkName(originalName = "") {
  const ext = path.extname(originalName).toLowerCase() || ".enc";
  return `${Date.now()}-${generateRandomHex(16)}${ext}`;
}

let _avatarUploader;
let _messageUploader;

function getAvatarUploader() {
  if (_avatarUploader) return _avatarUploader;
  if (!isS3Configured()) {
    throw new Error("S3 is not configured. This server requires S3 for uploads.");
  }

  const storage = multerS3({
    s3: getS3Client(),
    bucket: getS3BucketName(),
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const userId = req.userId || "anon";
      cb(null, `avatars/${userId}/${Date.now()}-${generateRandomHex(8)}${ext}`);
    },
  });

  _avatarUploader = multer({
    storage,
    fileFilter: avatarFilter,
    limits: { fileSize: 2 * 1024 * 1024 },
  }).single("avatar");

  return _avatarUploader;
}

function getMessageUploader() {
  if (_messageUploader) return _messageUploader;
  if (!isS3Configured()) {
    throw new Error("S3 is not configured. This server requires S3 for uploads.");
  }

  const storage = multerS3({
    s3: getS3Client(),
    bucket: getS3BucketName(),
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const chatroomId = req.params?.chatroomId || "unknown";
      cb(null, `messages/${chatroomId}/${encryptedChunkName(file.originalname)}`);
    },
  });

  _messageUploader = multer({
    storage,
    fileFilter: messageFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  }).array("files", 5);

  return _messageUploader;
}

// ✅ Avatar filter: allow only images
function avatarFilter(req, file, cb) {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed for avatars"), false);
}

// ✅ Message filter: allow multiple safe file types
function messageFileFilter(req, file, cb) {
  const allowed = [
    // ... (existing image and document types) ...
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream", // ✅ FIX: ALLOW ENCRYPTED BINARY DATA
  ];

  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Unsupported file type: " + file.mimetype), false); // Added mimetype to error for easier debugging
}

// ✅ Export lazy upload middlewares (ensures env is loaded before deciding S3 vs disk)
export const uploadAvatar = (req, res, next) => {
  return getAvatarUploader()(req, res, next);
};

export const uploadMessageFiles = (req, res, next) => {
  return getMessageUploader()(req, res, next);
};
