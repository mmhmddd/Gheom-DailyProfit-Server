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

// ---------- HELPER: Convert branch ID to name ----------
const resolveBranchName = async (branchInput) => {
  if (!branchInput) return null;
  if (mongoose.Types.ObjectId.isValid(branchInput)) {
    const branch = await Branch.findById(branchInput).select("name");
    return branch ? branch.name : null;
  }
  return branchInput;
};

// ---------- CREATE REPORT ----------
export const submitReport = [
  upload.single("balanceImage"),
  calculateTotalCash,
  async (req, res) => {
    try {
      const { branchName: inputBranch, cash, network, deliveryApps, expenses } = req.body;
      const submittedBy = req.user.id;

      if (!req.file) {
        return res.status(400).json({ message: "Balance image is required" });
      }

      const branchName = await resolveBranchName(inputBranch);
      if (!branchName) {
        return res.status(400).json({ message: "Invalid or missing branch" });
      }

      const imageUrl = req.file.path;
      const imagePublicId = req.file.filename;

      const deliveryTotal =
        (parseFloat(deliveryApps?.hangry) || 0) +
        (parseFloat(deliveryApps?.marsol) || 0);

      const report = new Report({
        branchName,
        cash: parseFloat(cash),
        network: parseFloat(network),
        deliveryApps: {
          hangry: parseFloat(deliveryApps?.hangry) || 0,
          marsol: parseFloat(deliveryApps?.marsol) || 0,
          total: deliveryTotal,
        },
        expenses: {
          amount: parseFloat(expenses?.amount) || 0,
          description: expenses?.description || "",
        },
        balanceImage: imageUrl,
        balanceImageId: imagePublicId,
        totalCashCurrent: parseFloat(cash) - parseFloat(expenses?.amount || 0),
        submittedBy,
        branchAdmin: req.user.allowedBranches[0] || branchName,
      });

      await report.save();
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

// ---------- GET ALL REPORTS (mainAdmin) ----------
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

// ---------- GET MY BRANCH REPORTS (branchAdmin & cashier) ----------
export const getMyBranchReports = async (req, res) => {
  try {
    const user = req.user;
    if (!['branchAdmin', 'cashier'].includes(user.role)) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (!user.allowedBranches?.length) {
      return res.status(400).json({ message: "No branch assigned" });
    }

    const branchId = user.allowedBranches[0];
    const branch = await Branch.findById(branchId).select("name");
    if (!branch) {
      return res.status(400).json({ message: "Branch not found" });
    }

    const reports = await Report.find({ branchName: branch.name })
      .populate("submittedBy", "name")
      .sort({ createdAt: -1 })
      .select("-__v");

    res.json(reports);
  } catch (error) {
    console.error("Get My Branch Reports Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- GET ONE REPORT (mainAdmin) ----------
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

      const report = await Report.findById(reportId);
      if (!report) return res.status(404).json({ message: "Report not found" });

      if (user.role !== "mainAdmin" && report.submittedBy.toString() !== user.id) {
        return res.status(403).json({ message: "غير مسموح لك بتعديل هذا التقرير" });
      }

      let branchName = report.branchName;
      if (updates.branchName) {
        const newBranchName = await resolveBranchName(updates.branchName);
        if (!newBranchName) return res.status(400).json({ message: "Invalid branch" });
        branchName = newBranchName;
        report.branchName = branchName;
      }

      if (updates.cash) report.cash = parseFloat(updates.cash);
      if (updates.network) report.network = parseFloat(updates.network);
      if (updates.expenses?.amount !== undefined) report.expenses.amount = parseFloat(updates.expenses.amount);
      if (updates.expenses?.description !== undefined) report.expenses.description = updates.expenses.description;

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
      await recalcBranchTotal(branchName);

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
    const user = req.user;
    let branchNames = [];

    if (user.role === "mainAdmin") {
      const allBranches = await Branch.find().select("name");
      branchNames = allBranches.map(b => b.name);
    } else if (user.role === "branchAdmin" || user.role === "admin") {
      if (!user.allowedBranches?.length) return res.status(200).json({ branches: [], grandTotal: null });
      const myBranchId = user.allowedBranches[0];
      const myBranch = await Branch.findById(myBranchId).select("name");
      if (!myBranch) return res.status(200).json({ branches: [], grandTotal: null });
      branchNames = [myBranch.name];
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const totals = await BranchTotal.find({ branchName: { $in: branchNames } }).select("branchName cumulativeTotal lastResetAt");
    const result = branchNames.map(name => {
      const found = totals.find(t => t.branchName === name);
      return found || { branchName: name, cumulativeTotal: 0, lastResetAt: null };
    });

    const grandTotal = result.reduce((sum, t) => sum + t.cumulativeTotal, 0);

    res.json({
      branches: result,
      grandTotal: user.role === "mainAdmin" ? grandTotal : null,
    });
  } catch (error) {
    console.error("Get Branch Totals Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- RESET CUMULATIVE ----------
export const resetCumulative = async (req, res) => {
  try {
    const user = req.user;
    let { branchName: inputBranch } = req.body;
    let branchName = null;

    if (inputBranch) {
      branchName = await resolveBranchName(inputBranch);
      if (!branchName) return res.status(400).json({ message: "Invalid branch" });
    }

    if (user.role === "mainAdmin") {
      // يمكنه إعادة تعيين أي فرع
    } else if (user.role === "branchAdmin" || user.role === "admin") {
      if (!branchName) return res.status(403).json({ message: "branchName required" });
      const allowedNames = (await Branch.find({ _id: { $in: user.allowedBranches } })).map(b => b.name);
      if (!allowedNames.includes(branchName)) return res.status(403).json({ message: "غير مسموح لك" });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    await resetBranchTotal(branchName || null);
    res.json({ message: "تم إعادة تعيين الإجمالي بنجاح" });
  } catch (error) {
    console.error("Reset Cumulative Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- [TEMP] REBUILD ALL TOTALS ----------
export const rebuildAllTotals = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") return res.status(403).json({ message: "mainAdmin only" });
    const branches = await Branch.find().select("name");
    for (const { name } of branches) await recalcBranchTotal(name);
    res.json({ message: "All cumulative totals rebuilt successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// NEW: GET MY BRANCH SUMMARY (ALL DETAILS + DAILY + MONTH + CUMULATIVE)
// =============================================================================
export const getMyBranchSummary = async (req, res) => {
  try {
    const user = req.user;

    // 1. Permission Check
    if (!["branchAdmin", "cashier"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied." });
    }
    if (!user.allowedBranches?.length) {
      return res.status(400).json({ message: "No branch assigned." });
    }

    const branchId = user.allowedBranches[0];
    const branch = await Branch.findById(branchId).select("name");
    if (!branch) return res.status(400).json({ message: "Branch not found." });
    const branchName = branch.name;

    // 2. Fetch all reports for this branch
    const reports = await Report.find({ branchName })
      .populate("submittedBy", "name")
      .sort({ createdAt: -1 })
      .select("-__v -balanceImageId")
      .lean();

    // 3. Date boundaries (native Date)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 4. Calculate Daily Totals
    const daily = {
      cash: 0,
      network: 0,
      deliveryApps: { hangry: 0, marsol: 0, total: 0 },
      expenses: 0,
      totalCashCurrent: 0,
    };

    // 5. Calculate Monthly Totals
    const month = {
      cash: 0,
      network: 0,
      deliveryApps: { hangry: 0, marsol: 0, total: 0 },
      expenses: 0,
      totalCashCurrent: 0,
    };

    reports.forEach(r => {
      const createdAt = new Date(r.createdAt);

      // Daily
      if (createdAt >= todayStart) {
        daily.cash += r.cash;
        daily.network += r.network;
        daily.deliveryApps.hangry += r.deliveryApps.hangry;
        daily.deliveryApps.marsol += r.deliveryApps.marsol;
        daily.deliveryApps.total += r.deliveryApps.total;
        daily.expenses += r.expenses.amount;
        daily.totalCashCurrent += r.totalCashCurrent;
      }

      // Monthly
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

    // 6. Cumulative from BranchTotal
    const cumulativeDoc = await BranchTotal.findOne({ branchName }).select("cumulativeTotal lastResetAt").lean();
    const cumulative = cumulativeDoc?.cumulativeTotal ?? 0;
    const lastResetAt = cumulativeDoc?.lastResetAt ?? null;

    // 7. Final Response
    res.json({
      branch: branchName,
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