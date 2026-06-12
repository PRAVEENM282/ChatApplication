import mongoose from "mongoose";

/**
 * Session schema to support multi-login on different devices/places
 */
const sessionSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
  },
  deviceInfo: {
    type: String,
    default: "Unknown Device",
  },
  ipAddress: {
    type: String,
    default: "Unknown IP",
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

/**
 * Key vault schema for automatic multi-device private key restore.
 *
 * The server stores ONLY ciphertext + KDF parameters.
 * The client encrypts/decrypts the E2EE private key using a password-derived key.
 */
const keyVaultSchema = new mongoose.Schema(
  {
    encryptedPrivateKey: { type: String, required: true },
    nonce: { type: String, required: true },
    salt: { type: String, required: true },
    opslimit: { type: Number, required: true },
    memlimit: { type: Number, required: true },
    alg: { type: String, default: "argon2id" },
    version: { type: Number, default: 1 },
  },
  { _id: false }
);

/**
 * User schema containing registration data, end-to-end encryption keys (publicKey),
 * user profile information, and multiple active session tracking (multi-device support).
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // Prevents exposing hash automatically in queries
    },
    publicKey: {
      type: String,
      required: true, // Used for E2EE (X25519) key agreement
    },
    /**
     * Encrypted vault used to restore the private key on any device after login.
     * Hidden by default; explicitly selected in auth flows only.
     */
    keyVault: {
      type: keyVaultSchema,
      select: false,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: "https://api.dicebear.com/8.x/adventurer/svg?seed=User",
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // Supports multi-device logins by storing a list of active refresh token sessions
    sessions: {
      type: [sessionSchema],
      select: false, // Kept hidden by default for security
      default: [],
    },
    settings: {
      notificationsEnabled: { type: Boolean, default: true },
      readReceiptsEnabled: { type: Boolean, default: true },
      encryptedFilePreviewsEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Indexes to speed up queries and guarantee unique constraints
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

// Transform output to clean up sensitive data before sending payload to the client
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.sessions;
    delete ret.keyVault;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
