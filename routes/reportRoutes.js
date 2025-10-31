// src/routes/report.routes.js
import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  submitReport,
  verifyAdminPassword,
  getAllReports,
  getMyBranchReports,
  getReportById,
  editReport,
  deleteReport,
  getBranchTotals,
  resetCumulative,
  rebuildAllTotals,
  getMyBranchSummary,
  getAllBranches
} from "../controllers/report.controller.js";

const router = express.Router();

// Public
router.post("/verify-admin", verifyAdminPassword);

// Auth Required
router.use(verifyToken);

// === [1] STATIC ROUTES FIRST (يجب أن تكون قبل أي :id) ===

// Reports
router.post("/submit", submitReport);

// My Branch
router.get("/my", getMyBranchReports);
router.get("/my/summary", getMyBranchSummary);

// Totals
router.get("/totals", getBranchTotals);
router.post("/totals/reset", resetCumulative);
router.post("/totals/rebuild", rebuildAllTotals);

// Branches
router.get("/branches", getAllBranches);

// Admin-only
router.get("/", getAllReports); // mainAdmin only

// === [2] DYNAMIC ROUTES LAST (بعد كل الثابتة) ===
router.get("/:id", getReportById);     // mainAdmin
router.put("/:id", editReport);
router.delete("/:id", deleteReport);

export default router;