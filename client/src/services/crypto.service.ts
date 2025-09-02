import sodium from "libsodium-wrappers";
import { getPrivateKey } from "../utils/KeyStorage";
import { send } from "process";

/**
 * Initialize libsodium - must be awaited once before using crypto functions
 */
export const initializeSodium = async () => {
  await sodium.ready;
};

/**
 * Generate a new public/private keypair in Base64 encoding
 */
export const generateKeys = async () => {
  await sodium.ready;
  const keypair = sodium.crypto_box_keypair();
  return {
    publicKeyBase64: sodium.to_base64(keypair.publicKey),
    privateKeyBase64: sodium.to_base64(keypair.privateKey),
  };
};

/**
 * Encrypt a UTF-8 message string with recipient's public key (Base64)
 * Returns encrypted Base64 string
 */
export const encryptMessage = async (message: string, recipientPublicKeyBase64: string,senderUsername: string) => {
  await sodium.ready;
  const publicKey = sodium.from_base64(recipientPublicKeyBase64);
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const messageBytes = sodium.from_string(message);
  // Encrypt message with nonce and public key, using ephemeral sender keypair
  const senderPrivateKeyBase64 = await getPrivateKey(senderUsername);
  if (!senderPrivateKeyBase64) {
    throw new Error("Sender private key not found");
  }
  const senderPrivateKey = sodium.from_base64(senderPrivateKeyBase64);
  const encrypted = sodium.crypto_box_easy(messageBytes, nonce, publicKey, senderPrivateKey);

  // Return nonce + encrypted combined as Base64 string
  const fullMessage = new Uint8Array(nonce.length + encrypted.length);
  fullMessage.set(nonce);
  fullMessage.set(encrypted, nonce.length);

  return sodium.to_base64(fullMessage);
};

/**
 * Decrypt encrypted message (Base64) with own private key (Base64) and sender's public key (Base64)
 * Returns decrypted UTF-8 string
 */
export const decryptMessage = async (
  encryptedBase64: string,
  privateKeyBase64: string,
  senderPublicKeyBase64: string
) => {
  await sodium.ready;

  const encryptedMessage = sodium.from_base64(encryptedBase64);

  // Split nonce and ciphertext
  const nonce = encryptedMessage.slice(0, sodium.crypto_box_NONCEBYTES);
  const ciphertext = encryptedMessage.slice(sodium.crypto_box_NONCEBYTES);

  const privateKey = sodium.from_base64(privateKeyBase64);
  const senderPublicKey = sodium.from_base64(senderPublicKeyBase64);

  // Decrypt message
  const decrypted = sodium.crypto_box_open_easy(ciphertext, nonce, senderPublicKey, privateKey);

  if (!decrypted) {
    throw new Error("Failed to decrypt message");
  }

  return sodium.to_string(decrypted);
};
