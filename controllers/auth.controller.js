import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

/**
 * 🧩 REGISTER - Create user or admin
 */
export const register = async (req, res) => {
  try {
    const { name, username, email, password, role, allowedBranches } = req.body;

    // Check if username or email already exists
    const existUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existUser)
      return res.status(400).json({ message: "Username or Email already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role,
      allowedBranches
    });

    await user.save();
    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 🔑 LOGIN
 */
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;   // identifier = email OR username

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier and password are required" });
    }

    // Find user by **email** OR **username**
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role, allowedBranches: user.allowedBranches },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
      username: user.username,
      name: user.name,
      allowedBranches: user.allowedBranches   // <-- send to frontend
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 🔐 CHANGE PASSWORD (old password required)
 */
export const changePassword = async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect old password" });

    const hashedNew = await bcrypt.hash(newPassword, 10);
    user.password = hashedNew;
    await user.save();

    res.json({ message: "Password updated successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 📧 FORGOT PASSWORD - Send Email with Reset Code
 */
export const sendResetEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No user found with this email" });

    // Generate random 6-digit code
    const resetCode = crypto.randomInt(100000, 999999).toString();
    user.resetCode = resetCode;
    await user.save();

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email content
    const mailOptions = {
      from: `"DailyProfit System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h3>Hello ${user.name},</h3>
        <p>You requested to reset your password.</p>
        <p>Your reset code is:</p>
        <h2 style="color:#2e86de;">${resetCode}</h2>
        <p>This code will expire soon. If you didn’t request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Reset code sent to your email ✅" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 🔄 RESET PASSWORD (using email + code)
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    const user = await User.findOne({ email, resetCode });
    if (!user)
      return res.status(400).json({ message: "Invalid reset code or email" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.resetCode = null; // clear code
    await user.save();

    res.json({ message: "Password reset successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
