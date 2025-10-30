// models/user.model.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'admin', 'mainAdmin', 'viewAdmin', 'branchAdmin'], 
    default: 'user' 
  },
  allowedBranches: { type: [String], default: [] },
  phone: { type: String },           // optional
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;