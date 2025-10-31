// src/routes/reportRoutes.js
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

router.post("/admin/verify-password", verifyAdminPassword);
router.use(verifyToken);

router.post("/", submitReport);
router.put("/:id", editReport);
router.delete("/:id", deleteReport);

router.get("/admin/reports", getAllReports);
router.get("/my/reports", getMyBranchReports);
router.get("/admin/reports/:id", getReportById);
router.get("/my/branch-summary", getMyBranchSummary);

router.get("/branches", getAllBranches); // دائمًا يرجع ["branche 1"]

router.get("/totals", getBranchTotals);
router.post("/totals/reset", resetCumulative);
router.post("/rebuild-totals", rebuildAllTotals);

export default router;