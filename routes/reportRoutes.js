// routes/reportRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  submitReport,
  verifyAdminPassword,
  getAllReports,
  getReportById,
  editReport,
  deleteReport
} from "../controllers/report.controller.js";

const router = express.Router();

router.post("/admin/verify-password", verifyAdminPassword);

router.post("/reports", verifyToken, submitReport);

router.get("/admin/reports", verifyToken, getAllReports);
router.get("/admin/reports/:id", verifyToken, getReportById);

router.put("/reports/:id", verifyToken, editReport);
router.delete("/reports/:id", verifyToken, deleteReport);

export default router;