// controllers/branch.controller.js
import Branch from "../models/branch.model.js";

/**
 * ADD BRANCH (mainAdmin only)
 */
export const addBranch = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied. mainAdmin only." });
    }

    const { name, code, address, phone, manager, status, description } = req.body;

    const existingBranch = await Branch.findOne({ $or: [{ name }, { code }] });
    if (existingBranch) {
      return res.status(400).json({ message: "Branch name or code already exists" });
    }

    const branch = new Branch({
      name, code, address, phone, manager, status, description
    });

    await branch.save();
    res.status(201).json({ message: "Branch created successfully", branch });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ALL BRANCHES (mainAdmin only)
 */
export const getAllBranches = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied. mainAdmin only." });
    }

    const branches = await Branch.find().sort({ name: 1 });
    res.json(branches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ONE BRANCH (mainAdmin only)
 */
export const getBranchById = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied." });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ message: "Branch not found" });

    res.json(branch);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * EDIT BRANCH (mainAdmin only)
 */
export const editBranch = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied." });
    }

    const { name, code, address, phone, manager, status, description } = req.body;

    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ message: "Branch not found" });

    const existingBranch = await Branch.findOne({
      $and: [
        { _id: { $ne: branch._id } },
        { $or: [{ name }, { code }] }
      ]
    });
    if (existingBranch) {
      return res.status(400).json({ message: "Branch name or code already exists" });
    }

    branch.name = name || branch.name;
    branch.code = code || branch.code;
    branch.address = address || branch.address;
    branch.phone = phone || branch.phone;
    branch.manager = manager || branch.manager;
    branch.status = status || branch.status;
    branch.description = description || branch.description;

    await branch.save();
    res.json({ message: "Branch updated successfully", branch });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE BRANCH (mainAdmin only)
 */
export const deleteBranch = async (req, res) => {
  try {
    if (req.user.role !== 'mainAdmin') {
      return res.status(403).json({ message: "Access denied." });
    }

    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) return res.status(404).json({ message: "Branch not found" });

    res.json({ message: "Branch deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getMyBranches = async (req, res) => {
  try {
    const user = req.user;

    let branches;
    if (user.role === 'mainAdmin') {
      branches = await Branch.find({ status: 'active' }).sort({ name: 1 });
    } else if (user.role === 'branchAdmin' || user.role === 'cashier'|| user.role === 'branchAdmin') {
      if (!user.allowedBranches || user.allowedBranches.length === 0) {
        return res.status(200).json([]); // No branches assigned
      }
      branches = await Branch.find({
        _id: { $in: user.allowedBranches },
        status: 'active'
      }).sort({ name: 1 });
    } else {
      return res.status(403).json({ message: "Access denied." });
    }

    res.json(branches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
