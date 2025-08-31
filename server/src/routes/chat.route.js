import express from "express";
import { createChatRoom,getChatRooms, createGroupChat, addGroupMember, removeGroupMember ,muteChat } from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { getMessages,markAsRead } from "../controllers/message.controller.js";

const router = express.Router();
router.post("/", verifyJWT, createChatRoom);
router.get("/", verifyJWT, getChatRooms);
router.post("/group", verifyJWT, createGroupChat);
router.post("/group/:chatRoomId/add", verifyJWT, addGroupMember);
router.post("/group/:chatRoomId/remove", verifyJWT, removeGroupMember);
router.get("/:chatRoomId/messages", verifyJWT, getMessages);
router.put("/messages/:messageId/read", verifyJWT, markAsRead);
router.put("/:chatRoomId/mute", verifyJWT, muteChat);

export default router;