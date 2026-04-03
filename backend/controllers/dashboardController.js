const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { calculateNetBalances } = require('../utils/splitCalculator');

const getDashboardSummary = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'name username')
      .sort({ createdAt: -1 });

    const groupIds = groups.map((group) => group._id);
    const expenses = await Expense.find({
      $or: [{ groupId: { $in: groupIds } }, { groupId: null, paidBy: req.user._id }],
    })
      .populate('paidBy', 'name username')
      .populate('splits.userId', 'name username')
      .sort({ date: -1 });

    const userIds = new Set([String(req.user._id)]);
    expenses.forEach((expense) => {
      if (expense.paidBy) {
        userIds.add(String(expense.paidBy._id || expense.paidBy));
      }

      const splitItems = Array.isArray(expense.splits) ? expense.splits : [];
      splitItems.forEach((split) => {
        if (split && split.userId) {
          userIds.add(String(split.userId._id || split.userId));
        }
      });
    });

    const balances = calculateNetBalances(expenses, Array.from(userIds));
    const expenseOnlyBalance = balances.find((entry) => String(entry.userId) === String(req.user._id))?.balance || 0;

    const completedSettlements = await Settlement.find({
      status: 'completed',
      $or: [{ fromUser: req.user._id }, { toUser: req.user._id }],
    }).select('fromUser toUser amount');

    const settlementAdjustment = completedSettlements.reduce((sum, settlement) => {
      const amount = Number(settlement.amount || 0);
      if (String(settlement.fromUser) === String(req.user._id)) {
        return sum + amount;
      }

      if (String(settlement.toUser) === String(req.user._id)) {
        return sum - amount;
      }

      return sum;
    }, 0);

    const userBalance = expenseOnlyBalance + settlementAdjustment;

    const notifications = await Notification.find({ userId: req.user._id }).sort({ date: -1 }).limit(5);
    const recentActivity = await ActivityLog.find({ actor: req.user._id }).sort({ createdAt: -1 }).limit(5);
    const recentSettlements = await Settlement.find({
      $or: [{ fromUser: req.user._id }, { toUser: req.user._id }],
    })
      .populate('fromUser', 'name username')
      .populate('toUser', 'name username')
      .populate('groupId', 'name')
      .sort({ date: -1 })
      .limit(5);

    const personalExpenses = expenses.filter((expense) => !expense.groupId);
    const recentExpenses = expenses.slice(0, 5);

    return res.status(200).json({
      totalBalance: userBalance,
      youOwe: userBalance < 0 ? Math.abs(userBalance) : 0,
      youAreOwed: userBalance > 0 ? userBalance : 0,
      groups,
      personalExpenses,
      recentExpenses,
      recentActivity,
      notifications,
      recentSettlements,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load dashboard summary', error: error.message });
  }
};

module.exports = {
  getDashboardSummary,
};