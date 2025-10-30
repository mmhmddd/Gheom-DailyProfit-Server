import User from "../models/user.model.js";
import bcrypt from "bcrypt";

/**
 * GET ALL USERS - Only mainAdmin
 */
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied. mainAdmin only." });
    }

    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ONE USER
 */
export const getUserById = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied." });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * UPDATE USER
 */
export const updateUser = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied." });
    }

    const { name, username, email, role, allowedBranches, phone, status, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent email/username conflict
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ message: "Email already in use" });
    }
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) return res.status(400).json({ message: "Username already in use" });
    }

    // Update fields
    user.name = name || user.name;
    user.username = username || user.username;
    user.email = email || user.email;
    user.role = role || user.role;
    user.allowedBranches = allowedBranches || user.allowedBranches;
    user.phone = phone || user.phone;
    user.status = status || user.status;

    // Update password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    const { password: _, ...safeUser } = user.toObject();

    res.json({ message: "User updated successfully", user: safeUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE USER
 */
export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied." });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};