import Redis from "ioredis";

/**
 * IMPORTANT (ESM): do not read process.env at module evaluation time.
 * These clients are initialized lazily so `.env` loaded in src/index.js is respected.
 */
const getRedisUrl = () => process.env.REDIS_URL || "redis://localhost:6379";
const getRedisOptions = () => ({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 1,
});
const shouldUseRedis = () =>
  process.env.REDIS_ENABLED === "true" ||
  Boolean(
    process.env.REDIS_URL && !process.env.REDIS_URL.includes("localhost")
  );

let _pubClient;
let _subClient;
let _redisClient;
const memoryUserSockets = new Map();
const memoryOnlineUsers = new Set();

export function getRedisAdapterClients() {
  if (!shouldUseRedis()) {
    return null;
  }
  if (_pubClient && _subClient) {
    return { pubClient: _pubClient, subClient: _subClient };
  }

  _pubClient = process.env.REDIS_URL
    ? new Redis(getRedisUrl(), { maxRetriesPerRequest: 1 })
    : new Redis(getRedisOptions());
  _subClient = _pubClient.duplicate();

  _pubClient.on("error", (err) => console.error("Redis pubClient error:", err));
  _subClient.on("error", (err) => console.error("Redis subClient error:", err));

  return { pubClient: _pubClient, subClient: _subClient };
}

export function getRedisClient() {
  if (!shouldUseRedis()) return null;
  if (_redisClient) return _redisClient;

  _redisClient = process.env.REDIS_URL
    ? new Redis(getRedisUrl(), { maxRetriesPerRequest: 1 })
    : new Redis(getRedisOptions());
  _redisClient.on("error", (err) => console.error("Redis client error:", err));

  return _redisClient;
}

const ONLINE_USERS_KEY = "presence:onlineUsers";
const userSocketsKey = (userId) => `presence:user:${userId}:sockets`;

/**
 * Marks a socket connection as online for a given user.
 * Returns true if this transition made the user go from offline -> online.
 */
export async function markSocketOnline(userId, socketId) {
  const redisClient = getRedisClient();
  if (!redisClient) {
    const key = userId.toString();
    const sockets = memoryUserSockets.get(key) || new Set();
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    memoryUserSockets.set(key, sockets);
    memoryOnlineUsers.add(key);
    return wasOffline;
  }

  try {
    const key = userSocketsKey(userId);
    await redisClient.sadd(key, socketId);
    // Keep the socket set from living forever if disconnect cleanup fails.
    await redisClient.expire(key, 60 * 60 * 24);

    const count = await redisClient.scard(key);
    if (count === 1) {
      await redisClient.sadd(ONLINE_USERS_KEY, userId);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Redis error in markSocketOnline:", err);
    const key = userId.toString();
    const sockets = memoryUserSockets.get(key) || new Set();
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    memoryUserSockets.set(key, sockets);
    memoryOnlineUsers.add(key);
    return wasOffline;
  }
}

/**
 * Marks a socket connection as offline for a given user.
 * Returns true if this transition made the user go from online -> offline.
 */
export async function markSocketOffline(userId, socketId) {
  const redisClient = getRedisClient();
  if (!redisClient) {
    const key = userId.toString();
    const sockets = memoryUserSockets.get(key);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      memoryUserSockets.delete(key);
      memoryOnlineUsers.delete(key);
      return true;
    }
    return false;
  }

  try {
    const key = userSocketsKey(userId);
    await redisClient.srem(key, socketId);

    const count = await redisClient.scard(key);
    if (count === 0) {
      await redisClient.srem(ONLINE_USERS_KEY, userId);
      await redisClient.del(key);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Redis error in markSocketOffline:", err);
    const key = userId.toString();
    const sockets = memoryUserSockets.get(key);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      memoryUserSockets.delete(key);
      memoryOnlineUsers.delete(key);
      return true;
    }
    return false;
  }
}

export async function getOnlineUsers() {
  const redisClient = getRedisClient();
  if (!redisClient) return [...memoryOnlineUsers];
  
  try {
    return await redisClient.smembers(ONLINE_USERS_KEY);
  } catch (err) {
    console.error("Redis error in getOnlineUsers:", err);
    return [...memoryOnlineUsers];
  }
}
