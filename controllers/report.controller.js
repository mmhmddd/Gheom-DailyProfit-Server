// src/controllers/report.controller.js
import Report from "../models/report.model.js";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import jwt from "jsonwebtoken";

// إعداد Cloudinary من الـ .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// إعداد Multer مع Cloudinary (بدون أي حفظ محلي)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "daily-reports", // مجلد في Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 800, height: 600, crop: "fill" }, // تحجيم تلقائي
      { quality: "auto", fetch_format: "auto" }  // ضغط ذكي
    ],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 ميجا
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"), false);
  },
});

// حساب إجمالي الكاش بعد المصروفات
const calculateTotalCash = (req, res, next) => {
  const { cash, expenses } = req.body;
  if (cash && expenses?.amount) {
    req.body.totalCashCurrent = parseFloat(cash) - parseFloat(expenses.amount);
  }
  next();
};

// رفع تقرير جديد
export const submitReport = [
  upload.single("balanceImage"),
  calculateTotalCash,
  async (req, res) => {
    try {
      const { branchName, cash, network, deliveryApps, expenses } = req.body;
      const submittedBy = req.user.id;

      if (!req.file) {
        return res.status(400).json({ message: "Balance image is required" });
      }

      const imageUrl = req.file.path; // رابط الصورة من Cloudinary
      const imagePublicId = req.file.filename; // للحذف لاحقاً

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

// التحقق من كلمة مرور الأدمن
export const verifyAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (password !== adminPass) {
      return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
    }

    const tempToken = jwt.sign(
      { adminVerified: true },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "تم التحقق بنجاح", tempToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// جلب كل التقارير (للـ mainAdmin فقط)
export const getAllReports = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") {
      return res.status(403).json({ message: "Access denied. mainAdmin only." });
    }

    const reports = await Report.find()
      .populate("submittedBy", "name email")
      .sort({ shiftDate: -1 })
      .select("-__v");

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// جلب تقرير واحد بالـ ID
export const getReportById = async (req, res) => {
  try {
    if (req.user.role !== "mainAdmin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const report = await Report.findById(req.params.id).populate(
      "submittedBy",
      "name email"
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// تعديل التقرير
export const editReport = [
  upload.single("balanceImage"),
  calculateTotalCash,
  async (req, res) => {
    try {
      const reportId = req.params.id;
      const updates = req.body;
      const user = req.user;

      const report = await Report.findById(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // تحقق من الصلاحيات
      if (
        user.role !== "mainAdmin" &&
        report.submittedBy.toString() !== user.id
      ) {
        return res
          .status(403)
          .json({ message: "غير مسموح لك بتعديل هذا التقرير" });
      }

      // تحديث الحقول
      if (updates.branchName) report.branchName = updates.branchName;
      if (updates.cash) report.cash = parseFloat(updates.cash);
      if (updates.network) report.network = parseFloat(updates.network);

      if (updates.expenses?.amount !== undefined)
        report.expenses.amount = parseFloat(updates.expenses.amount);
      if (updates.expenses?.description !== undefined)
        report.expenses.description = updates.expenses.description;

      if (updates.deliveryApps) {
        const hangry = parseFloat(updates.deliveryApps.hangry) || 0;
        const marsol = parseFloat(updates.deliveryApps.marsol) || 0;
        report.deliveryApps.hangry = hangry;
        report.deliveryApps.marsol = marsol;
        report.deliveryApps.total = hangry + marsol;
      }

      // تحديث الصورة في Cloudinary
      if (req.file) {
        // حذف الصورة القديمة
        if (report.balanceImageId) {
          await cloudinary.uploader.destroy(report.balanceImageId);
        }
        report.balanceImage = req.file.path;
        report.balanceImageId = req.file.filename;
      }

      report.totalCashCurrent = report.cash - report.expenses.amount;
      await report.save();

      res.json({ message: "تم تعديل التقرير بنجاح", report });
    } catch (error) {
      console.error("Edit Report Error:", error);
      res.status(500).json({ message: error.message });
    }
  },
];

// حذف التقرير
export const deleteReport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const user = req.user;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // تحقق من الصلاحيات
    if (
      user.role !== "mainAdmin" &&
      report.submittedBy.toString() !== user.id
    ) {
      return res
        .status(403)
        .json({ message: "غير مسموح لك بحذف هذا التقرير" });
    }

    // حذف الصورة من Cloudinary
    if (report.balanceImageId) {
      await cloudinary.uploader.destroy(report.balanceImageId);
    }

    await Report.findByIdAndDelete(reportId);
    res.json({ message: "تم حذف التقرير بنجاح" });
  } catch (error) {
    console.error("Delete Report Error:", error);
    res.status(500).json({ message: error.message });
  }
};