// models/branch.model.js
import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },  
  code: { type: String, required: true, unique: true }, 
  address: { type: String, required: true },
  phone: { type: String, required: true },
  manager: { type: String, required: true },  
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  description: { type: String }
}, { timestamps: true });

const Branch = mongoose.model('Branch', branchSchema);
export default Branch;