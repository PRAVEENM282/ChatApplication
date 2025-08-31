import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { saveMessage } from "../controllers/message.controller";


export const initializeSocketServer = (server) =>{
    const io = new Server(server, {
        cors:{
            origin: "http://localhost:5173",
            credentials: true,
            methods: ["GET", "POST"]
        },
    });

    io.use((socket,next)=>{
        const token = socket.handshake.auth.token;
        if(!token){
            return next(new Error("Authentication error: No token provided"));
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
            return next(new Error("Authentication error: Invalid token"));
        }
        socket.userId = decoded.userId;
        next();
    });
    });

    io.on("connection" ,(socket)=>{
        console.log(`socket connected: ${socket.id} with userId: ${socket.userId}`);
        socket.on("join_room",(chatRoomId)=>{
            socket.join(chatRoomId);
            console.log(`User ${socket.userId} joined room: ${chatRoomId}`);
        });
        socket.on("send_message", async (data)=>{
            const {chatRoomId,encryptedText} = data;
            const senderId = socket.userId;

            const savedMessage = await saveMessage({chatRoomId, encryptedText, senderId});
            if(savedMessage){
                socket.to(chatRoomId).emit("receive_message", savedMessage);
            }
        });
        socket.on("disconnect",()=>{
            console.log(`socket disconnected: ${socket.id} with userId: ${socket.userId}`);
        });
    });

    return io;
};

