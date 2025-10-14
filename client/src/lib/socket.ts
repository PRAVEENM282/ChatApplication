import { io } from "socket.io-client";

const URL = "http://localhost:3000";

export const socket = io(URL, {
  autoConnect: false,
  transports: ["websocket"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});