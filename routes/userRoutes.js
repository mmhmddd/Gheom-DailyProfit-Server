import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from "../controllers/user.controller.js";

const router = express.Router();

// Protect all routes
router.use(verifyToken);

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;