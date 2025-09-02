import express from "express";
import { 
  createChatRoom, 
  getChatRooms, 
  createGroupChat, 
  addGroupMember, 
  removeGroupMember,
  muteChat 
} from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { getMessages, markAsRead } from "../controllers/message.controller.js";
import { validateCreateChat, validateCreateGroupChat } from "../validators/chatValidators.js";

const router = express.Router();

router.post("/", verifyJWT, validateCreateChat, createChatRoom);
router.get("/", verifyJWT, getChatRooms);
router.post("/group", verifyJWT, validateCreateGroupChat, createGroupChat);
router.post("/group/:chatRoomId/add", verifyJWT, addGroupMember);
router.post("/group/:chatRoomId/remove", verifyJWT, removeGroupMember);
router.get("/:chatRoomId/messages", verifyJWT, getMessages);
router.put("/messages/:messageId/read", verifyJWT, markAsRead);
router.put("/:chatRoomId/mute", verifyJWT, muteChat);

export default router;
