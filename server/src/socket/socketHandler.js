import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  getAllowedOrigins,
  isOriginAllowed,
} from "../config/env.js";
import {
  getRedisAdapterClients,
  getOnlineUsers,
  markSocketOnline,
  markSocketOffline,
} from "../config/redis.js";
import { saveMessage, updateMessageStatus } from "../controllers/message.controller.js";
import ChatRoom from "../models/Chatroom.js";
import Message from "../models/Message.js";

let ioInstance;

export const initializeSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Redis adapter enables broadcasting across multiple server instances.
  const redisClients = getRedisAdapterClients();
  if (redisClients) {
    const { pubClient, subClient } = redisClients;
    io.adapter(createAdapter(pubClient, subClient));
  }

  ioInstance = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: Token not provided"));
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
    console.log(`✅ User connected: ${socket.id} with user ID: ${socket.userId}`);

    // Join a per-user room so we can emit to a user across all their devices.
    socket.join(socket.userId.toString());

    // Redis-backed presence (works across multiple instances).
    markSocketOnline(socket.userId.toString(), socket.id)
      .then((becameOnline) => {
        if (becameOnline) {
          socket.broadcast.emit("user_online", socket.userId);
        }
      })
      .catch((err) => console.error("presence online error:", err));

    getOnlineUsers()
      .then((users) => socket.emit("online_users", users))
      .catch((err) => console.error("presence list error:", err));

    socket.on("join_room", async (chatroomId) => {
      const room = await ChatRoom.findById(chatroomId).select("participants").lean();
      const canJoin = room?.participants?.some((p) => p.toString() === socket.userId.toString());
      if (!canJoin) return;
      socket.join(chatroomId);
      console.log(`➡ User ${socket.userId} joined room: ${chatroomId}`);
    });

    socket.on("leave_room", (chatroomId) => {
      socket.leave(chatroomId);
      console.log(`⬅ User ${socket.userId} left room: ${chatroomId}`);
    });

    socket.on("start_typing", ({ chatroomId }) => {
      socket.to(chatroomId).emit("user_typing", {
        userId: socket.userId,
        chatroomId: chatroomId,
      });
    });

    socket.on("stop_typing", ({ chatroomId }) => {
      socket.to(chatroomId).emit("user_stopped_typing", {
        userId: socket.userId,
        chatroomId: chatroomId,
      });
    });

    socket.on("message_delivered", async ({ messageId, senderId }) => {
      const msg = await Message.findById(messageId).select("chatroomId");
      const room = msg ? await ChatRoom.findById(msg.chatroomId).select("type") : null;
      const update = { $set: { [`deliveredTo.${socket.userId}`]: new Date() } };
      if (room?.type === "one_to_one") {
        update.$set.status = "delivered";
      }
      await Message.findByIdAndUpdate(messageId, update);
      // Emit to sender's user room (all devices) — works across instances with Redis adapter.
      io.to(senderId.toString()).emit("message_status_updated", {
        messageId,
        status: "delivered",
      });
    });

    socket.on("messages_read", async ({ chatroomId, readerId }) => {
      const chatRoom = await ChatRoom.findById(chatroomId);
      if (!chatRoom) return;
      const canRead = chatRoom.participants.some(
        (p) => p.toString() === readerId?.toString()
      );
      if (!canRead || readerId?.toString() !== socket.userId.toString()) return;

      const messagesToUpdate = await Message.find({
        chatroomId,
        sender: { $ne: readerId },
      });

      if (messagesToUpdate.length > 0) {
        const senderId = messagesToUpdate[0].sender.toString();
        const update = {
          $set: {
            [`readBy.${readerId}`]: new Date(),
          },
        };
        if (chatRoom.type === "one_to_one") {
          update.$set.status = "read";
        }

        await Message.updateMany(
          { _id: { $in: messagesToUpdate.map((m) => m._id) } },
          update
        );

        if (chatRoom.unreadCount && chatRoom.unreadCount.has(readerId)) {
          chatRoom.unreadCount.set(readerId, 0);
          await chatRoom.save();
          console.log(`Chatroom ${chatroomId} count zeroed for ${readerId} via socket.`);
        }

        chatRoom.participants.forEach((p) => {
          const participantId = p.toString();
          if (participantId !== readerId.toString()) {
            io.to(participantId).emit("messages_read_by_recipient", { chatroomId });
          }
        });
      }
    });

    socket.on("send_message", async (message) => {
      try {
        const room = await ChatRoom.findById(message.chatroomId);
        if (!room) return;
        const isParticipant = room.participants.some(
          (p) => p.toString() === socket.userId.toString()
        );
        if (!isParticipant) return;

        const participantIds = room.participants.map((p) => p.toString());
        if (message.encryptedPayloads) {
          const hasAllEnvelopes = participantIds.every(
            (id) => message.encryptedPayloads[id]?.ciphertextBase64 && message.encryptedPayloads[id]?.nonceBase64
          );
          if (!hasAllEnvelopes) return;
        }

        const messageData = {
          chatroomId: message.chatroomId,
          sender: socket.userId,
          encryptedTextForRecipient: message.encryptedTextForRecipient,
          encryptedTextForSender: message.encryptedTextForSender,
          encryptedPayloads: message.encryptedPayloads,
        };

        const savedMessage = await saveMessage(messageData);
        if (!savedMessage) return;

        // Confirm to the sender (all their devices)
        io.to(socket.userId.toString()).emit("message_sent_confirmation", savedMessage);

        // Deliver to each recipient's personal user room — guarantees delivery
        // even if they haven't joined the chatroom socket room (viewing different chat).
        const recipients = room.participants.filter(
          (p) => p.toString() !== socket.userId.toString()
        );

        recipients.forEach((recipientId) => {
          io.to(recipientId.toString()).emit("receive_message", savedMessage);
          io.to(recipientId.toString()).emit("new_message_notification", {
            chatroomId: savedMessage.chatroomId,
            message: savedMessage,
          });
        });
      } catch (err) {
        console.error("🔥 Error handling message:", err);
      }
    });

    socket.on("send_file_message", async (fileMetaData) => {});

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      markSocketOffline(socket.userId.toString(), socket.id)
        .then((becameOffline) => {
          if (becameOffline) {
            io.emit("user_offline", socket.userId);
          }
        })
        .catch((err) => console.error("presence offline error:", err));
    });
  });

  return io;
};

export const getIo = () => ioInstance;

// NOTE: With Redis adapter + per-user rooms, you generally don't need socketId lookup.
// Keeping this export removed to avoid encouraging in-memory presence.
