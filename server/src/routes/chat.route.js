import express from "express";
import { createChatRoom,getChatRooms } from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
const router = express.Router();
router.post("/", verifyJWT, createChatRoom);
router.get("/", verifyJWT, getChatRooms);

export default router;