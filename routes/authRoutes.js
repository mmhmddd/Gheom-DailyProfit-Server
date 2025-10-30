import express from "express";
import { register, login, changePassword, resetPassword, sendResetEmail } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/change-password", changePassword);
router.put("/reset-password", resetPassword);
router.post("/forgot-password", sendResetEmail); 

export default router;
