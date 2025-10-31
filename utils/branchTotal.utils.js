// src/utils/branchTotal.utils.js
import BranchTotal from '../models/branchTotal.model.js';
import Report from '../models/report.model.js';

/**
 * إعادة حساب الإجمالي من التقارير الجديدة فقط (بعد lastResetAt)
 */
export const recalcBranchTotal = async (branchName) => {
  if (!branchName || typeof branchName !== 'string') {
    console.error("Invalid branchName in recalc:", branchName);
    return 0;
  }

  // جلب الـ BranchTotal لمعرفة lastResetAt
  const branchTotal = await BranchTotal.findOne({ branchName }).lean();
  const lastResetAt = branchTotal?.lastResetAt || new Date(0); 

  const reports = await Report.find({
    branchName,
    createdAt: { $gte: lastResetAt }
  }).select('cash network deliveryApps expenses.amount').lean();

  const total = reports.reduce((sum, r) => {
    const delivery = (r.deliveryApps?.hangry || 0) + (r.deliveryApps?.marsol || 0);
    return sum + (r.cash || 0) + (r.network || 0) + delivery;
  }, 0);

  // تحديث الإجمالي + الاحتفاظ بـ lastResetAt
  await BranchTotal.findOneAndUpdate(
    { branchName },
    { 
      cumulativeTotal: total,
      lastResetAt: branchTotal?.lastResetAt || null // لا تغيّر lastResetAt
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`[RECALC] ${branchName} = ${total} (منذ ${lastResetAt.toISOString()})`);
  return total;
};

/**
 * إعادة تعيين الإجمالي إلى 0 + تحديد lastResetAt
 */
export const resetBranchTotal = async (branchName = null) => {
  const now = new Date();

  if (branchName) {
    await BranchTotal.findOneAndUpdate(
      { branchName },
      { cumulativeTotal: 0, lastResetAt: now },
      { upsert: true }
    );
    console.log(`[RESET] ${branchName} → 0 at ${now}`);
  } else {
    await BranchTotal.updateMany(
      {},
      { cumulativeTotal: 0, lastResetAt: now }
    );
    console.log(`[RESET] All branches → 0 at ${now}`);
  }
};