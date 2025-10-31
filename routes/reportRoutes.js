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
  getMyBranchSummary // ✅ add this line
} from "../controllers/report.controller.js";


const router = express.Router();

// Public
router.post("/admin/verify-password", verifyAdminPassword);

// Protected Routes (يتطلب تسجيل دخول)
router.use(verifyToken); // <-- استخدم verifyToken هنا

// Submit / Edit / Delete
router.post("/", submitReport);
router.put("/:id", editReport);
router.delete("/:id", deleteReport);

// Reports
router.get("/admin/reports", getAllReports);         
router.get("/my/reports", getMyBranchReports);        
router.get("/admin/reports/:id", getReportById);    
router.get("/my/branch-summary", getMyBranchSummary);  
// Totals
router.get("/totals", getBranchTotals);
router.post("/totals/reset", resetCumulative);

// [TEMP] Rebuild
router.post("/rebuild-totals", rebuildAllTotals);

export default router;