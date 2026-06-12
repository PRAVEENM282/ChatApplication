import mongoose from "mongoose";

/**
 * FileMetadata sub-schema containing encrypted headers, nonce values, and recipient-specific keys
 * to allow secure decryption of multi-chunk attachments on different devices.
 */
const fileMetadataSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    chunkUrls: {
      type: [String],
      default: [],
    },
    storageKeys: {
      type: [String],
      default: [],
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    // Symmetric encryption header block
    header: {
      type: String,
      required: true,
    },
    // Random nonce used in encrypting the file's primary key
    keyNonce: {
      type: String,
      required: true,
    },
    // Encrypted file symmetric key matching the recipient's public key
    encryptedFileKeyForRecipient: {
      type: String,
      required: true,
    },
    // Encrypted file symmetric key matching the sender's public key (allows history decryption)
    encryptedFileKeyForSender: {
      type: String,
      required: true,
    },
    encryptedFileKeys: {
      type: Map,
      of: String,
      default: {},
    },
    // Cryptographic identifier of the keypair used
    keyId: {
      type: String,
      required: true,
    },
    // Total count of encrypted chunks stored on S3
    totalChunks: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

/**
 * Message schema. Implements double-ciphertext pattern (encryptedTextForSender & encryptedTextForRecipient)
 * so that both participants can decrypt and display historical text transcripts.
 */
const messageSchema = new mongoose.Schema(
  {
    chatroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    // Encrypted text matching the sender's key (saved for self-history)
    encryptedTextForSender: {
      type: String,
    },
    // Encrypted text matching the recipient's key
    encryptedTextForRecipient: {
      type: String,
    },
    // New envelope model: userId -> encrypted payload for that participant.
    encryptedPayloads: {
      type: Map,
      of: new mongoose.Schema(
        {
          ciphertextBase64: { type: String, required: true },
          nonceBase64: { type: String, required: true },
        },
        { _id: false }
      ),
      default: {},
    },
    // Attachment specifications (if type is image or file)
    fileMetadata: {
      type: fileMetadataSchema,
      required: false,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readBy: {
      type: Map,
      of: Date,
      default: {},
    },
    deliveredTo: {
      type: Map,
      of: Date,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
