// src/utils/branchTotal.utils.js
import BranchTotal from '../models/branchTotal.model.js';
import Report from '../models/report.model.js';

/**
 * Recalculate cumulative total for a branch from scratch.
 */
export const recalcBranchTotal = async (branchName) => {
  if (!branchName || typeof branchName !== 'string') {
    console.error("Invalid branchName in recalc:", branchName);
    return 0;
  }

  const reports = await Report.find({ branchName })
    .select('cash network expenses.amount')
    .lean();

  const total = reports.reduce((sum, r) => {
    return sum + r.cash + r.network - (r.expenses?.amount || 0);
  }, 0);

  await BranchTotal.findOneAndUpdate(
    { branchName },
    { cumulativeTotal: total, lastResetAt: null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return total;
};

/**
 * Reset cumulative total for a branch (or all).
 */
export const resetBranchTotal = async (branchName = null) => {
  if (branchName) {
    await BranchTotal.findOneAndUpdate(
      { branchName },
      { cumulativeTotal: 0, lastResetAt: new Date() },
      { upsert: true }
    );
  } else {
    await BranchTotal.updateMany(
      {},
      { cumulativeTotal: 0, lastResetAt: new Date() }
    );
  }
};