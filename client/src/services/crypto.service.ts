import sodium from "libsodium-wrappers-sumo";
import { decodeKey } from "../utils/keyUtils";

/**
 * Utility to asynchronously read a blob as an ArrayBuffer.
 */
function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// --- Encryption ---

/**
 * Encrypts a text message using Curve25519 (ECDH) public-key authenticated encryption.
 * Under the hood, sodium.crypto_box_easy performs an ECDH key exchange using Curve25519
 * to derive a shared symmetric secret, and encrypts the payload using XSalsa20-Poly1305.
 * 
 * @param {string} message - The plaintext string to encrypt
 * @param {string} recipientPublicKeyBase64 - Base64 public key of the recipient
 * @param {string} myPrivateKeyBase64 - Base64 private key of the sender
 */
export const encryptMessage = async (
  message: string,
  recipientPublicKeyBase64: string,
  myPrivateKeyBase64: string
) => {
  await sodium.ready;

  let recipientPublicKey, myPrivateKey;

  try {
    recipientPublicKey = decodeKey(recipientPublicKeyBase64);
  } catch (e) {
    throw new Error("Invalid recipient public key format.");
  }
  if (recipientPublicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new Error("Recipient public key must be 32 bytes.");
  }

  try {
    myPrivateKey = decodeKey(myPrivateKeyBase64);
  } catch (e) {
    throw new Error("Invalid private key format.");
  }

  if (myPrivateKey.length !== sodium.crypto_box_SECRETKEYBYTES) {
    throw new Error("Private key must be 32 bytes.");
  }

  // Generate a random unique nonce for security
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

  // Perform authenticated encryption (Curve25519 ECDH + XSalsa20-Poly1305)
  const ciphertext = sodium.crypto_box_easy(
    sodium.from_string(message),
    nonce,
    recipientPublicKey,
    myPrivateKey
  );

  return {
    ciphertextBase64: sodium.to_base64(ciphertext),
    nonceBase64: sodium.to_base64(nonce),
  };
};

export type EncryptedPayload = {
  ciphertextBase64: string;
  nonceBase64: string;
};

export type ParticipantPublicKey = {
  userId: string;
  publicKey: string;
};

export const encryptMessageForParticipants = async (
  message: string,
  participants: ParticipantPublicKey[],
  myPrivateKeyBase64: string
): Promise<Record<string, EncryptedPayload>> => {
  const entries = await Promise.all(
    participants.map(async (participant) => {
      const encrypted = await encryptMessage(
        message,
        participant.publicKey,
        myPrivateKeyBase64
      );
      return [participant.userId, encrypted] as const;
    })
  );

  return Object.fromEntries(entries);
};

// --- Decryption ---

/**
 * Decrypts a text message using Curve25519 (ECDH) public-key authenticated decryption.
 * Uses the sender's public key and the receiver's private key to re-derive the shared secret.
 * 
 * @param {string} ciphertextBase64 - Base64 encrypted payload
 * @param {string} nonceBase64 - Base64 nonce used in encryption
 * @param {string} senderPublicKeyBase64 - Base64 public key of the sender
 * @param {string} myPrivateKeyBase64 - Base64 private key of the receiver
 */
export const decryptMessage = async (
  ciphertextBase64: string,
  nonceBase64: string,
  senderPublicKeyBase64: string,
  myPrivateKeyBase64: string
) => {
  await sodium.ready;

  const ciphertext = sodium.from_base64(ciphertextBase64);
  const nonce = sodium.from_base64(nonceBase64);
  const senderPublicKey = decodeKey(senderPublicKeyBase64);
  const myPrivateKey = decodeKey(myPrivateKeyBase64);

  if (senderPublicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new Error("Sender public key must be 32 bytes.");
  }
  if (myPrivateKey.length !== sodium.crypto_box_SECRETKEYBYTES) {
    throw new Error("Private key must be 32 bytes.");
  }

  try {
    // Open the encrypted box using public-key cryptography
    const decryptedBytes = sodium.crypto_box_open_easy(
      ciphertext,
      nonce,
      senderPublicKey,
      myPrivateKey
    );
    return sodium.to_string(decryptedBytes);
  } catch (err) {
    throw new Error("Failed to decrypt message. Keys or data may be invalid.");
  }
};

/**
 * Encrypts a file using high-performance symmetric chunk encryption (XChaCha20-Poly1305 stream)
 * and wraps the symmetric key using Curve25519 (ECDH) for both the recipient and sender.
 * 
 * @param {File} file - The file to encrypt
 * @param {string} recipientPublicKeyBase64 - Recipient's E2EE public key
 * @param {string} myPrivateKeyBase64 - Sender's E2EE private key
 * @param {string} myPublicKeyBase64 - Sender's E2EE public key
 */
export const encryptFile = async (
  file: File,
  recipientPublicKeyBase64: string,
  myPrivateKeyBase64: string,
  myPublicKeyBase64: string
) => {
  await sodium.ready;

  // Generate a random one-time symmetric key for the file stream
  const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
  const chunkSize = 64 * 1024; // 64 KB chunks
  let offset = 0;
  const encryptedChunks: Uint8Array[] = [];

  // Initialize the secretstream generator push state
  const { state, header } =
    sodium.crypto_secretstream_xchacha20poly1305_init_push(key);

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await readFileAsArrayBuffer(chunk);
    const uint8 = new Uint8Array(arrayBuffer);
    offset += chunkSize;

    const tag =
      offset < file.size
        ? sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
        : sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL;

    // Encrypt individual stream chunk
    const encryptedChunk = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      uint8,
      null,
      tag
    );

    encryptedChunks.push(encryptedChunk);
  }

  const recipientPublicKey = decodeKey(recipientPublicKeyBase64);
  const myPrivateKey = decodeKey(myPrivateKeyBase64);
  const myPublicKey = decodeKey(myPublicKeyBase64);

  const keyNonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

  // Wrap symmetric file key using recipient's Curve25519 public key (ECDH exchange)
  const encryptedKeyForRecipient = sodium.crypto_box_easy(
    key,
    keyNonce,
    recipientPublicKey,
    myPrivateKey
  );

  // Wrap symmetric file key using sender's own public key (allows self-decryption from history)
  const encryptedKeyForSelf = sodium.crypto_box_easy(
    key,
    keyNonce,
    myPublicKey,
    myPrivateKey
  );

  // Generate key ID hash based on stream header
  const keyId = sodium.to_base64(
    sodium.crypto_generichash(16, header),
    sodium.base64_variants.URLSAFE_NO_PADDING
  );

  return {
    keyId,
    header: sodium.to_base64(header, sodium.base64_variants.ORIGINAL),
    keyNonce: sodium.to_base64(keyNonce, sodium.base64_variants.ORIGINAL),
    encryptedKeyForRecipient: sodium.to_base64(
      encryptedKeyForRecipient,
      sodium.base64_variants.ORIGINAL
    ),
    encryptedKeyForSelf: sodium.to_base64(
      encryptedKeyForSelf,
      sodium.base64_variants.ORIGINAL
    ),
    encryptedChunks: encryptedChunks.map((chunk) =>
      sodium.to_base64(chunk, sodium.base64_variants.ORIGINAL)
    ),
  };
};

export const encryptFileForParticipants = async (
  file: File,
  participants: ParticipantPublicKey[],
  myPrivateKeyBase64: string
) => {
  await sodium.ready;

  const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
  const chunkSize = 64 * 1024;
  let offset = 0;
  const encryptedChunks: Uint8Array[] = [];
  const { state, header } =
    sodium.crypto_secretstream_xchacha20poly1305_init_push(key);

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await readFileAsArrayBuffer(chunk);
    const uint8 = new Uint8Array(arrayBuffer);
    offset += chunkSize;

    const tag =
      offset < file.size
        ? sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
        : sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL;

    encryptedChunks.push(
      sodium.crypto_secretstream_xchacha20poly1305_push(state, uint8, null, tag)
    );
  }

  const keyNonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const myPrivateKey = decodeKey(myPrivateKeyBase64);
  const encryptedFileKeysEntries = await Promise.all(
    participants.map(async (participant) => {
      const publicKey = decodeKey(participant.publicKey);
      const encryptedKey = sodium.crypto_box_easy(
        key,
        keyNonce,
        publicKey,
        myPrivateKey
      );
      return [
        participant.userId,
        sodium.to_base64(encryptedKey, sodium.base64_variants.ORIGINAL),
      ] as const;
    })
  );

  const keyId = sodium.to_base64(
    sodium.crypto_generichash(16, header),
    sodium.base64_variants.URLSAFE_NO_PADDING
  );

  return {
    keyId,
    header: sodium.to_base64(header, sodium.base64_variants.ORIGINAL),
    keyNonce: sodium.to_base64(keyNonce, sodium.base64_variants.ORIGINAL),
    encryptedFileKeys: Object.fromEntries(encryptedFileKeysEntries),
    encryptedChunks: encryptedChunks.map((chunk) =>
      sodium.to_base64(chunk, sodium.base64_variants.ORIGINAL)
    ),
  };
};

/**
 * Unwraps (decrypts) the symmetric file key using Curve25519 (ECDH) box opening.
 */
export const decryptSymmetricKey = async (
  encryptedKeyBase64: string,
  keyNonceBase64: string,
  senderPublicKeyBase64: string,
  myPrivateKeyBase64: string
): Promise<Uint8Array> => {
  await sodium.ready;

  const encryptedKey = sodium.from_base64(
    encryptedKeyBase64.trim(),
    sodium.base64_variants.ORIGINAL
  );
  const keyNonce = sodium.from_base64(
    keyNonceBase64.trim(),
    sodium.base64_variants.ORIGINAL
  );

  const senderPublicKey = decodeKey(senderPublicKeyBase64);
  const myPrivateKey = decodeKey(myPrivateKeyBase64);

  try {
    const decryptedKeyBytes = sodium.crypto_box_open_easy(
      encryptedKey,
      keyNonce,
      senderPublicKey,
      myPrivateKey
    );

    if (!decryptedKeyBytes) {
      throw new Error(
        "Invalid box data, keys, or nonce (Decryption failed cryptographically)."
      );
    }

    return decryptedKeyBytes;
  } catch (err) {
    throw new Error(
      "Failed to decrypt file key. Keys are mismatched or invalid."
    );
  }
};

/**
 * Decrypts file chunks symmetrically using XChaCha20-Poly1305 secretstream.
 */
export const decryptFileSymmetrically = async (
  encryptedFileChunks: Uint8Array[],
  headerBase64: string,
  symmetricKey: Uint8Array
): Promise<Uint8Array> => {
  await sodium.ready;

  const header = sodium.from_base64(
    headerBase64.trim(),
    sodium.base64_variants.ORIGINAL
  );
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(
    header,
    symmetricKey
  );

  const decryptedChunks: Uint8Array[] = [];

  for (const encryptedChunk of encryptedFileChunks) {
    const { message, tag } = sodium.crypto_secretstream_xchacha20poly1305_pull(
      state,
      encryptedChunk
    );

    decryptedChunks.push(message);

    if (tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      break;
    }
  }

  // Combine chunks into a single binary array
  const totalLength = decryptedChunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of decryptedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};
