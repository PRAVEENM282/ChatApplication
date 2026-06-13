import sodium from "libsodium-wrappers-sumo";

export type KeyVaultPayload = {
  encryptedPrivateKey: string;
  nonce: string;
  salt: string;
  opslimit: number;
  memlimit: number;
  alg?: string;
  version?: number;
};

/**
 * Derives a symmetric key from a user password using libsodium's crypto_pwhash.
 * This key is used ONLY to encrypt/decrypt the E2EE private key vault.
 */
async function deriveVaultKey(
  password: string,
  saltB64: string,
  opslimit: number,
  memlimit: number
): Promise<Uint8Array> {
  await sodium.ready;

  const salt = sodium.from_base64(saltB64);

  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    opslimit,
    memlimit,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
}

/**
 * Encrypts a base64-encoded private key into an opaque server-storable vault.
 * The server never receives plaintext private keys.
 */
export async function encryptPrivateKeyToVault(
  privateKeyBase64: string,
  password: string
): Promise<KeyVaultPayload> {
  await sodium.ready;

  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const opslimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE;
  const memlimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE;

  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    opslimit,
    memlimit,
    sodium.crypto_pwhash_ALG_DEFAULT
  );

  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const privateKeyBytes = sodium.from_base64(privateKeyBase64);

  const ciphertext = sodium.crypto_secretbox_easy(privateKeyBytes, nonce, key);

  return {
    encryptedPrivateKey: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce),
    salt: sodium.to_base64(salt),
    opslimit,
    memlimit,
    alg: "argon2id",
    version: 1,
  };
}

/**
 * Decrypts a server-provided vault back into a base64-encoded private key.
 */
export async function decryptPrivateKeyFromVault(
  vault: KeyVaultPayload,
  password: string
): Promise<string> {
  await sodium.ready;

  const key = await deriveVaultKey(
    password,
    vault.salt,
    vault.opslimit,
    vault.memlimit
  );

  const nonce = sodium.from_base64(vault.nonce);
  const ciphertext = sodium.from_base64(vault.encryptedPrivateKey);

  const privateKeyBytes = sodium.crypto_secretbox_open_easy(
    ciphertext,
    nonce,
    key
  );

  return sodium.to_base64(privateKeyBytes);
}
