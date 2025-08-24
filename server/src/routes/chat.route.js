import express from "express";
import { createChatRoom } from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
const router = express.Router();
router.post("/create", verifyJWT, createChatRoom);

export default router;