// src/controllers/report.controller.js
import Report from "../models/report.model.js";
import BranchTotal from "../models/branchTotal.model.js";
import Branch from "../models/branch.model.js";
import mongoose from "mongoose";

import { recalcBranchTotal, resetBranchTotal } from "../utils/branchTotal.utils.js";

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import jwt from "jsonwebtoken";

// ---------- Cloudinary & Multer ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "daily-reports",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 800, height: 600, crop: "fill" },
      { quality: "auto", fetch_format: "auto" }
    ],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"), false);
  },
});

// ---------- Middleware ----------
const calculateTotalCash = (req, res, next) => {
  const { cash, expenses } = req.body;
  if (cash && expenses?.amount) {
    req.body.totalCashCurrent = parseFloat(cash) - parseFloat(expenses.amount);
  }
  next();
};

// ---------- Helper: Get Branch Details by ID ----------
const getBranchDetails = async (branchId) => {
  console.log('getBranchDetails called with:', branchId); // للتتبع
  
  if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
    throw new Error("Invalid branch ID format");
  }
  
  const branch = await Branch.findById(branchId).select("name code status");
  
  if (!branch) {
    throw new Error("Branch not found");
  }
  
  if (branch.status !== "active") {
    throw new Error("Branch is not active");
  }
  
  console.log('Branch found:', { name: branch.name, code: branch.code }); // للتتبع
  return { name: branch.name, code: branch.code };
};

// ---------- CREATE REPORT ----------
export const submitReport = [
  upload.single("balanceImage"),
  calculateTotalCash,
  async (req, res) => {
    try {
      console.log('submitReport - req.body:', req.body); // للتتبع
      
      const { branchId, cash, network, deliveryApps, expenses } = req.body;
      const submittedBy = req.user.id;

      if (!req.file) {
        return res.status(400).json({ message: "Balance image is required" });
      }

      if (!branchId) {
        return res.status(400).json({ message: "Branch ID is required" });
      }

      // التأكد من أن branchId صالح
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({ message: "Invalid Branch ID format" });
      }

      // جلب تفاصيل الفرع من branchId
      const branchDetails = await getBranchDetails(branchId);
      const branchName = branchDetails.name;

      console.log('Using branch name:', branchName); // للتتبع

      const imageUrl = req.file.path;
      const imagePublicId = req.file.filename;

      const deliveryTotal =
        (parseFloat(deliveryApps?.hangry) || 0) +
        (parseFloat(deliveryApps?.marsol) || 0);

      const report = new Report({
        branchName,
        cash: parseFloat(cash) || 0,
        network: parseFloat(network) || 0,
        deliveryApps: {
          hangry: parseFloat(deliveryApps?.hangry) || 0,
          marsol: parseFloat(deliveryApps?.marsol) || 0,
          total: deliveryTotal,
        },
        expenses: {
          amount: parseFloat(expenses?.amount) || 0,
          description: expenses?.description?.trim() || "",
        },
        balanceImage: imageUrl,
        balanceImageId: imagePublicId,
        totalCashCurrent: parseFloat(cash) - parseFloat(expenses?.amount || 0),
        submittedBy,
        branchAdmin: branchName,
      });

      await report.save();
      console.log('Report saved with branchName:', report.branchName); // للتتبع
      
      await recalcBranchTotal(branchName);

      res.status(201).json({
        message: "Report submitted successfully",
        report,
        imageUrl,
      });
    } catch (error) {
      console.error("Submit Report Error:", error);
      res.status(500).json({ message: error.message });
    }
  },
];

// ---------- ADMIN PASSWORD ----------
export const verifyAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
    }
    const tempToken = jwt.sign({ adminVerified: true }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "تم التحقق بنجاح", tempToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET ALL REPORTS ----------
export const getAllReports = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") {
      return res.status(403).json({ message: "Access denied. mainAdmin only." });
    }
    const reports = await Report.find()
      .populate("submittedBy", "name email")
      .sort({ createdAt: -1 })
      .select("-__v");
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET MY BRANCH REPORTS ----------
export const getMyBranchReports = async (req, res) => {
  try {
    const userBranchName = req.user.branchName;
    
    if (!userBranchName) {
      return res.status(400).json({ message: "User branch not found" });
    }
    
    const reports = await Report.find({ branchName: userBranchName })
      .populate("submittedBy", "name")
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json(reports);
  } catch (error) {
    console.error("Get My Branch Reports Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET ONE REPORT ----------
export const getReportById = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") {
      return res.status(403).json({ message: "Access denied." });
    }
    const report = await Report.findById(req.params.id).populate("submittedBy", "name email");
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------- EDIT REPORT ----------
export const editReport = [
  upload.single("balanceImage"),
  calculateTotalCash,
  async (req, res) => {
    try {
      const reportId = req.params.id;
      const updates = req.body;
      const user = req.user;

      console.log('editReport - updates:', updates); // للتتبع

      const report = await Report.findById(reportId);
      if (!report) return res.status(404).json({ message: "Report not found" });

      if (user.role !== "mainAdmin" && report.submittedBy.toString() !== user.id) {
        return res.status(403).json({ message: "غير مسموح لك بتعديل هذا التقرير" });
      }

      // إذا أرسل branchId جديد (للـ mainAdmin)
      if (updates.branchId && user.role === "mainAdmin") {
        const branchDetails = await getBranchDetails(updates.branchId);
        report.branchName = branchDetails.name;
        console.log('Updated branch name to:', report.branchName); // للتتبع
      }

      if (updates.cash) report.cash = parseFloat(updates.cash) || 0;
      if (updates.network) report.network = parseFloat(updates.network) || 0;
      
      if (updates.expenses && updates.expenses.amount !== undefined) {
        report.expenses.amount = parseFloat(updates.expenses.amount) || 0;
      }
      if (updates.expenses && updates.expenses.description !== undefined) {
        report.expenses.description = updates.expenses.description?.trim() || "";
      }

      if (updates.deliveryApps) {
        const hangry = parseFloat(updates.deliveryApps.hangry) || 0;
        const marsol = parseFloat(updates.deliveryApps.marsol) || 0;
        report.deliveryApps.hangry = hangry;
        report.deliveryApps.marsol = marsol;
        report.deliveryApps.total = hangry + marsol;
      }

      if (req.file) {
        if (report.balanceImageId) await cloudinary.uploader.destroy(report.balanceImageId);
        report.balanceImage = req.file.path;
        report.balanceImageId = req.file.filename;
      }

      report.totalCashCurrent = report.cash - report.expenses.amount;
      await report.save();
      await recalcBranchTotal(report.branchName);

      res.json({ message: "تم تعديل التقرير بنجاح", report });
    } catch (error) {
      console.error("Edit Report Error:", error);
      res.status(500).json({ message: error.message });
    }
  },
];

// ---------- DELETE REPORT ----------
export const deleteReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const user = req.user;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (user.role !== "mainAdmin" && report.submittedBy.toString() !== user.id) {
      return res.status(403).json({ message: "غير مسموح لك بحذف هذا التقرير" });
    }

    if (report.balanceImageId) await cloudinary.uploader.destroy(report.balanceImageId);
    const branchName = report.branchName;
    await Report.findByIdAndDelete(reportId);
    await recalcBranchTotal(branchName);

    res.json({ message: "تم حذف التقرير بنجاح" });
  } catch (error) {
    console.error("Delete Report Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET CUMULATIVE TOTALS ----------
export const getBranchTotals = async (req, res) => {
  try {
    const branches = await Branch.find({ status: "active" }).select("name").lean();
    const branchNames = branches.map(b => b.name);

    const results = await Promise.all(
      branchNames.map(async (branchName) => {
        let totalDoc = await BranchTotal.findOne({ branchName }).lean();
        if (!totalDoc) {
          totalDoc = { branchName, cumulativeTotal: 0, lastResetAt: null };
        }
        await recalcBranchTotal(branchName);
        const updated = await BranchTotal.findOne({ branchName }).lean();
        return {
          branchName: updated.branchName,
          cumulativeTotal: updated.cumulativeTotal || 0,
          lastResetAt: updated.lastResetAt || null,
          lastReportDate: updated.lastReportDate || null,
        };
      })
    );

    const grandTotal = results.reduce((sum, b) => sum + b.cumulativeTotal, 0);

    res.json({
      branches: results,
      grandTotal: req.user.role === "mainAdmin" ? grandTotal : null,
    });
  } catch (error) {
    console.error("Get Branch Totals Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- RESET CUMULATIVE ----------
export const resetCumulative = async (req, res) => {
  try {
    const allowedRoles = ['mainAdmin', 'branchAdmin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let branchToReset;
    if (req.user.role === 'mainAdmin') {
      const { branchName } = req.body;
      if (!branchName) return res.status(400).json({ message: "Branch name required for mainAdmin" });
      branchToReset = branchName;
    } else {
      branchToReset = req.user.branchName;
      if (!branchToReset) {
        return res.status(400).json({ message: "User branch not found" });
      }
    }

    await resetBranchTotal(branchToReset);
    await recalcBranchTotal(branchToReset);

    const updated = await BranchTotal.findOne({ branchName: branchToReset }).lean();

    res.json({
      message: 'تم إعادة تعيين الإجمالي بنجاح',
      cumulative: updated?.cumulativeTotal || 0,
      lastResetAt: updated?.lastResetAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reset Cumulative Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- REBUILD ALL TOTALS ----------
export const rebuildAllTotals = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") return res.status(403).json({ message: "mainAdmin only" });
    
    const branches = await Branch.find({ status: "active" }).select("name").lean();
    await Promise.all(branches.map(b => recalcBranchTotal(b.name)));
    
    res.json({ message: "All cumulative totals rebuilt successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET MY BRANCH SUMMARY ----------
export const getMyBranchSummary = async (req, res) => {
  try {
    const userBranchName = req.user.branchName;
    
    if (!userBranchName) {
      return res.status(400).json({ message: "User branch not found" });
    }
    
    const reports = await Report.find({ branchName: userBranchName })
      .populate("submittedBy", "name")
      .sort({ createdAt: -1 })
      .select("-__v -balanceImageId")
      .lean();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const daily = { cash: 0, network: 0, deliveryApps: { hangry: 0, marsol: 0, total: 0 }, expenses: 0, totalCashCurrent: 0 };
    const month = { cash: 0, network: 0, deliveryApps: { hangry: 0, marsol: 0, total: 0 }, expenses: 0, totalCashCurrent: 0 };

    reports.forEach(r => {
      const createdAt = new Date(r.createdAt);
      if (createdAt >= todayStart) {
        daily.cash += r.cash;
        daily.network += r.network;
        daily.deliveryApps.hangry += r.deliveryApps.hangry;
        daily.deliveryApps.marsol += r.deliveryApps.marsol;
        daily.deliveryApps.total += r.deliveryApps.total;
        daily.expenses += r.expenses.amount;
        daily.totalCashCurrent += r.totalCashCurrent;
      }
      if (createdAt >= monthStart) {
        month.cash += r.cash;
        month.network += r.network;
        month.deliveryApps.hangry += r.deliveryApps.hangry;
        month.deliveryApps.marsol += r.deliveryApps.marsol;
        month.deliveryApps.total += r.deliveryApps.total;
        month.expenses += r.expenses.amount;
        month.totalCashCurrent += r.totalCashCurrent;
      }
    });

    await recalcBranchTotal(userBranchName);
    const cumulativeDoc = await BranchTotal.findOne({ branchName: userBranchName })
      .select("cumulativeTotal lastResetAt").lean();

    const cumulative = cumulativeDoc?.cumulativeTotal ?? 0;
    const lastResetAt = cumulativeDoc?.lastResetAt ?? null;

    res.json({
      branch: userBranchName,
      reports,
      daily,
      month,
      cumulative,
      lastResetAt,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get My Branch Summary Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET ALL BRANCHES ----------
export const getAllBranches = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") {
      return res.status(403).json({ message: "mainAdmin only" });
    }
    const branches = await Branch.find({ status: "active" }).select("name code").sort("name");
    res.json({ branches: branches.map(b => ({ _id: b._id, name: b.name, code: b.code })) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};