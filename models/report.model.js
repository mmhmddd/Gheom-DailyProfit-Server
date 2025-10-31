// src/models/report.model.js
import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  branchName: { type: String, required: true },
  shiftDate: { type: Date, default: Date.now },
  cash: { type: Number, required: true, min: 0 },
  network: { type: Number, required: true, min: 0 },
  deliveryApps: {
    type: {
      hangry: { type: Number, min: 0 },
      marsol: { type: Number, min: 0 },
      total: { type: Number, min: 0 }
    },
    required: true
  },
  expenses: {
    type: {
      amount: { type: Number, required: true, min: 0 },
      description: { type: String }
    },
    default: { amount: 0, description: '' }
  },
  balanceImage: { type: String, required: true },
  balanceImageId: { type: String, required: true },
  totalCashCurrent: { type: Number, min: 0 },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  branchAdmin: { type: String, required: true }
}, { timestamps: true });

// ---- NEW VIRTUAL (optional, for readability) ----
reportSchema.virtual('dailyNet').get(function () {
  return this.cash + this.network - this.expenses.amount;
});

const Report = mongoose.model('Report', reportSchema);
export default Report;