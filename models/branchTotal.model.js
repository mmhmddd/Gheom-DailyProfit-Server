// src/models/branchTotal.model.js
import mongoose from 'mongoose';

const branchTotalSchema = new mongoose.Schema({
  branchName: { type: String, required: true, unique: true },
  cumulativeTotal: { type: Number, default: 0, min: 0 },
  lastResetAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('BranchTotal', branchTotalSchema);