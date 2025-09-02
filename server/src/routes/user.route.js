import express from "express";
import { searchUsers,getUser,updateUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { validateSearch } from "../validators/userValidators.js";
const router = express.Router();


router.get("/search", verifyJWT, validateSearch, searchUsers);
router.get("/:id", verifyJWT, getUser);
router.put("/:id", verifyJWT, updateUser);

export default router;