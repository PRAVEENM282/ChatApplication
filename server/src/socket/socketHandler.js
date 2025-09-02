import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { saveMessage } from "../controllers/message.controller.js";

// Map to store online users: { userId -> socketId }
const userSocketMap = new Map();

export const initializeSocketServer = (server) => {
    const io = new Server(server, {
        cors:{
            origin: "http://localhost:5173",
            credentials: true,
            methods: ["GET", "POST"]
        },
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return next(new Error("Authentication error: Invalid token"));
            }
            socket.userId = decoded.userId;
            next();
        });
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id} with userId: ${socket.userId}`);
        
        // --- PRESENCE HANDLING ---
        userSocketMap.set(socket.userId, socket.id);
        
        // Send the list of currently online users to the newly connected client
        socket.emit('online_users', Array.from(userSocketMap.keys()));

        // Inform all other clients that this user is now online
        socket.broadcast.emit('user_online', socket.userId);

        socket.on("join_room", (chatRoomId) => {
            socket.join(chatRoomId);
            console.log(`User ${socket.userId} joined room: ${chatRoomId}`);
        });

        socket.on("send_message", async (data) => {
            const { chatRoomId, encryptedText } = data;
            const senderId = socket.userId;

            const savedMessage = await saveMessage({ chatRoomId, encryptedText, senderId });
            if (savedMessage) {
                io.to(chatRoomId).emit("receive_message", savedMessage);
            }
        });

        // --- TYPING INDICATOR HANDLING ---
        socket.on('typing', ({ chatRoomId }) => {
            socket.to(chatRoomId).emit('user_typing', { userId: socket.userId, chatRoomId });
        });

        socket.on('stop_typing', ({ chatRoomId }) => {
            socket.to(chatRoomId).emit('user_stopped_typing', { userId: socket.userId, chatRoomId });
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id} with userId: ${socket.userId}`);
            userSocketMap.delete(socket.userId);
            // Inform all other clients that this user is now offline
            socket.broadcast.emit('user_offline', socket.userId);
        });
    });

    return io;
};
