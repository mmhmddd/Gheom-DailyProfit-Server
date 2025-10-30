// models/branch.model.js
import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },  // e.g., "HQ", "Cairo"
  code: { type: String, required: true, unique: true },  // e.g., "HQ001"
  address: { type: String, required: true },
  phone: { type: String, required: true },
  manager: { type: String, required: true },  // Manager name
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  description: { type: String }
}, { timestamps: true });

const Branch = mongoose.model('Branch', branchSchema);
export default Branch;