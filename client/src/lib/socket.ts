import { io } from "socket.io-client";

// Get backend URL from client environment variables
const URL = (import.meta as any).env.VITE_SOCKET_URL || window.location.origin;

/**
 * Socket.IO client instance. Handles low-latency real-time duplex communications.
 * Configured to connect on-demand rather than automatically on page load.
 */
export const socket = io(URL, {
  autoConnect: false, // Must be triggered manually via SocketProvider
  transports: ["websocket"], // Disables HTTP polling fallback for higher performance
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});
