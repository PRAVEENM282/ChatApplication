import { openDB } from "idb";

const DB_NAME = "SecureChatDB";
const STORE_NAME = "Keys";

// Open or create the IndexedDB database and object store
async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

/**
 * Save the private key bound by a userId (string unique identifier).
 * @param userId Unique user identifier (e.g., user ID or username)
 * @param privateKey Private key string to store
 */
export async function savePrivateKey(userId: string, privateKey: string): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, privateKey, `privateKey-${userId}`);
}

/**
 * Retrieve the private key for the given userId.
 * @param userId Unique user identifier
 * @returns private key string or undefined if not found
 */
export async function getPrivateKey(userId: string): Promise<string | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, `privateKey-${userId}`);
}

/**
 * Delete the private key for the given userId.
 * @param userId Unique user identifier
 */
export async function deletePrivateKey(userId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, `privateKey-${userId}`);
}
