import sodium from "libsodium-wrappers-sumo";

/**
 * Initialize libsodium assembly modules. Required before calling any cryptographic functions.
 */
export const initializeSodium = async () => {
  await sodium.ready;
};

// --- Key Management ---

/**
 * Generates an asymmetric Curve25519 keypair for E2EE key agreement (ECDH).
 * Returns base64 encoded strings of public and private keys.
 * Note: Never log private keys to console/logs for security reasons.
 */
export const generateKeys = async () => {
  await sodium.ready;
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  
  const publicKeyBase64 = sodium.to_base64(publicKey);
  const privateKeyBase64 = sodium.to_base64(privateKey);
  
  return {
    publicKeyBase64,
    privateKeyBase64,
  };
};

/**
 * Decodes a base64 encoded cryptographic key string into its raw binary representation.
 */
export const decodeKey = (keyBase64: string): Uint8Array => {
  if (!keyBase64 || typeof keyBase64 !== "string" || keyBase64.trim() === "") {
    throw new Error("Missing key in localStorage / invalid key string.");
  }
  try {
    return sodium.from_base64(keyBase64);
  } catch {
    console.error("Invalid Base64 key structure");
    throw new Error("Invalid Base64 key.");
  }
};

/**
 * Encodes a raw binary key array into a transportation-safe Base64 string.
 */
export const encodeKey = (keyBytes: Uint8Array): string => {
  return sodium.to_base64(keyBytes);
};