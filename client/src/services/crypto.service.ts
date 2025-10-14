import sodium from "libsodium-wrappers";
import { decodeKey } from "../utils/keyUtils";

function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// --- Encryption ---

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

  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

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

// --- Decryption ---

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

export const encryptFile = async (
  file: File,
  recipientPublicKeyBase64: string,
  myPrivateKeyBase64: string,
  myPublicKeyBase64: string
) => {
  await sodium.ready;

  const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
  const chunkSize = 64 * 1024; // 64 KB
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

  const encryptedKeyForRecipient = sodium.crypto_box_easy(
    key, // symmetric key is the message
    keyNonce,
    recipientPublicKey,
    myPrivateKey
  );

  const encryptedKeyForSelf = sodium.crypto_box_easy(
    key, // symmetric key is the message
    keyNonce,
    myPublicKey,
    myPrivateKey
  );

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


export const decryptFileSymmetrically = async (
  encryptedFileChunks: Uint8Array[], // All chunks
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

  const totalLength = decryptedChunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of decryptedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};