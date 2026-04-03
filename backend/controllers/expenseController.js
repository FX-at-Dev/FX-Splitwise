const { validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const {
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentageSplits,
  calculateNetBalances,
  simplifyDebts,
} = require('../utils/splitCalculator');

const parseListValue = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_error) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return fallback;
};

const buildSplits = (splitType, amount, splitPayload) => {
  if (splitType === 'exact') {
    return calculateExactSplits(amount, splitPayload.exactSplits);
  }

  if (splitType === 'percentage') {
    return calculatePercentageSplits(amount, splitPayload.percentageSplits);
  }

  return calculateEqualSplits(amount, splitPayload.memberIds);
};

const addExpense = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    title,
    amount,
    groupId = null,
    paidBy = req.user._id,
    splitType = 'equal',
    notes = '',
    memberIds = [],
    exactSplits = [],
    percentageSplits = [],
  } = req.body;

  try {
    const numericAmount = Number(amount);
    let resolvedMemberIds = parseListValue(memberIds);
    const resolvedExactSplits = parseListValue(exactSplits);
    const resolvedPercentageSplits = parseListValue(percentageSplits);

    if (!resolvedMemberIds.length && splitType === 'equal') {
      if (groupId) {
        const group = await Group.findById(groupId).select('members');
        if (!group) {
          return res.status(404).json({ message: 'Group not found' });
        }

        resolvedMemberIds = group.members.map((memberId) => String(memberId));
      } else {
        resolvedMemberIds = [String(paidBy)];
      }
    }

    const splits = buildSplits(splitType, numericAmount, {
      memberIds: resolvedMemberIds,
      exactSplits: resolvedExactSplits,
      percentageSplits: resolvedPercentageSplits,
    });

    const expense = await Expense.create({
      title,
      amount: numericAmount,
      groupId,
      paidBy,
      splits,
      splitType,
      notes,
    });

    if (groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $addToSet: { expenses: expense._id },
      });

      const group = await Group.findById(groupId).select('members name');
      if (group) {
        await Notification.insertMany(
          group.members
            .filter((memberId) => String(memberId) !== String(req.user._id))
            .map((memberId) => ({
              userId: memberId,
              message: `New expense ${title} was added to group ${group.name}`,
            }))
        );
      }
    }

    await ActivityLog.create({
      actor: req.user._id,
      action: 'expense_added',
      entityType: 'Expense',
      entityId: expense._id,
      metadata: { groupId, title, amount: numericAmount, splitType },
    });

    return res.status(201).json({ expense });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add expense', error: error.message });
  }
};

const getGroupExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ groupId: req.params.id })
      .populate('paidBy', 'name username')
      .populate('splits.userId', 'name username')
      .sort({ date: -1 });

    return res.status(200).json({ expenses });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch group expenses', error: error.message });
  }
};

const getPersonalExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ groupId: null, paidBy: req.user._id })
      .populate('paidBy', 'name username')
      .populate('splits.userId', 'name username')
      .sort({ date: -1 });

    return res.status(200).json({ expenses });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch personal expenses', error: error.message });
  }
};

const getExpenseSummary = async (req, res) => {
  try {
    const buildFallbackUser = (idValue) => {
      const rawId = String(idValue || '').trim();
      const suffix = rawId ? rawId.slice(-6).toLowerCase() : 'member';

      return {
        _id: rawId || null,
        name: `Member ${suffix}`,
        username: `member_${suffix}`,
      };
    };

    const group = await Group.findById(req.params.groupId).select('members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const existingGroupUsers = await User.find({ _id: { $in: group.members || [] } }).select('_id');
    const validMemberIds = new Set(existingGroupUsers.map((user) => String(user._id)));

    const expenses = await Expense.find({ groupId: req.params.groupId });
    const userIds = new Set();

    expenses.forEach((expense) => {
      const payerId = String(expense.paidBy || '');
      if (payerId && validMemberIds.has(payerId)) {
        userIds.add(payerId);
      }

      expense.splits.forEach((split) => {
        const splitUserId = String(split.userId || '');
        if (splitUserId && validMemberIds.has(splitUserId)) {
          userIds.add(splitUserId);
        }
      });
    });

    const normalizedExpenses = expenses.map((expense) => ({
      ...expense.toObject(),
      splits: (expense.splits || []).filter((split) => validMemberIds.has(String(split.userId || ''))),
    })).filter((expense) => validMemberIds.has(String(expense.paidBy || '')));

    const completedSettlements = await Settlement.find({
      status: 'completed',
      $or: [{ groupId: req.params.groupId }, { groupId: null }],
    }).select('fromUser toUser amount groupId');

    completedSettlements.forEach((settlement) => {
      const fromUserId = String(settlement.fromUser || '');
      const toUserId = String(settlement.toUser || '');

      if (fromUserId && validMemberIds.has(fromUserId)) {
        userIds.add(fromUserId);
      }

      if (toUserId && validMemberIds.has(toUserId)) {
        userIds.add(toUserId);
      }
    });

    const balances = calculateNetBalances(normalizedExpenses, Array.from(userIds));
    completedSettlements.forEach((settlement) => {
      const amount = Number(settlement.amount || 0);
      const fromUserId = String(settlement.fromUser || '');
      const toUserId = String(settlement.toUser || '');

      if (!validMemberIds.has(fromUserId) || !validMemberIds.has(toUserId)) {
        return;
      }

      // Backward compatibility for older settlements saved without groupId.
      const belongsToGroup = String(settlement.groupId || '') === String(req.params.groupId);
      const isLegacyUngrouped = !settlement.groupId;
      if (!belongsToGroup && !isLegacyUngrouped) {
        return;
      }

      if (fromUserId) {
        const fromBalance = balances.find((entry) => String(entry.userId) === fromUserId);
        if (fromBalance) {
          fromBalance.balance = Number((fromBalance.balance + amount).toFixed(2));
        } else {
          balances.push({ userId: fromUserId, balance: amount });
        }
      }

      if (toUserId) {
        const toBalance = balances.find((entry) => String(entry.userId) === toUserId);
        if (toBalance) {
          toBalance.balance = Number((toBalance.balance - amount).toFixed(2));
        } else {
          balances.push({ userId: toUserId, balance: -amount });
        }
      }
    });

    const settlements = simplifyDebts(balances);
    const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name username');
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const enrichedBalances = balances.map((entry) => ({
      ...entry,
      user: userMap.get(String(entry.userId)) || null,
    }));

    const enrichedSettlements = settlements.map((entry) => ({
      ...entry,
      fromUser: userMap.get(String(entry.fromUser)) || buildFallbackUser(entry.fromUser),
      toUser: userMap.get(String(entry.toUser)) || buildFallbackUser(entry.toUser),
    }));

    return res.status(200).json({ balances: enrichedBalances, settlements: enrichedSettlements });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to build expense summary', error: error.message });
  }
};

module.exports = {
  addExpense,
  getGroupExpenses,
  getPersonalExpenses,
  getExpenseSummary,
};