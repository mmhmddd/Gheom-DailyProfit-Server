// routes/branchRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  addBranch,
  getAllBranches,
  getBranchById,
  editBranch,
  deleteBranch,
  getMyBranches
} from "../controllers/branch.controller.js";

const router = express.Router();

// Protect all routes
router.use(verifyToken);

router.post("/", addBranch);
router.get("/", getAllBranches);
router.get("/my", getMyBranches);
router.get("/:id", getBranchById);
router.put("/:id", editBranch);
router.delete("/:id", deleteBranch);

export default router;