const { validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const { calculateNetBalances } = require('../utils/splitCalculator');

const createGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name } = req.body;

  try {
    const group = await Group.create({
      name,
      members: [req.user._id],
      createdBy: req.user._id,
    });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { groups: group._id },
    });

    await ActivityLog.create({
      actor: req.user._id,
      action: 'group_created',
      entityType: 'Group',
      entityId: group._id,
      metadata: { name: group.name },
    });

    return res.status(201).json({ group });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create group', error: error.message });
  }
};

const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'name username')
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 });

    return res.status(200).json({ groups });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch groups', error: error.message });
  }
};

const addMemberToGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { groupId, username } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const member = await User.findOne({ username: String(username).toLowerCase() });
    if (!member) {
      return res.status(404).json({ message: 'User with this username does not exist' });
    }

    if (group.members.some((memberId) => String(memberId) === String(member._id))) {
      return res.status(409).json({ message: 'User is already a member of the group' });
    }

    group.members.push(member._id);
    await group.save();

    await User.findByIdAndUpdate(member._id, {
      $addToSet: { groups: group._id },
    });

    await Notification.create({
      userId: member._id,
      message: `You were added to group ${group.name}`,
    });

    await ActivityLog.create({
      actor: req.user._id,
      action: 'member_added',
      entityType: 'Group',
      entityId: group._id,
      metadata: { memberId: member._id, username: member.username },
    });

    return res.status(200).json({ group });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add member', error: error.message });
  }
};

const removeMemberFromGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { groupId, memberId } = req.body;

  try {
    const group = await Group.findById(groupId).select('name members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const requesterId = String(req.user._id);
    const isRequesterMember = group.members.some((id) => String(id) === requesterId);
    if (!isRequesterMember) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    const targetMemberId = String(memberId || '');
    const isTargetMember = group.members.some((id) => String(id) === targetMemberId);
    if (!isTargetMember) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }

    if (group.members.length <= 1) {
      return res.status(400).json({ message: 'Cannot remove the last remaining member from a group' });
    }

    const existingGroupUsers = await User.find({ _id: { $in: group.members || [] } }).select('_id');
    const validMemberIds = new Set(existingGroupUsers.map((user) => String(user._id)));

    const expenses = await Expense.find({ groupId: group._id }).select('amount paidBy splits');
    const normalizedExpenses = expenses
      .map((expense) => ({
        ...expense.toObject(),
        splits: (expense.splits || []).filter((split) => validMemberIds.has(String(split.userId || ''))),
      }))
      .filter((expense) => validMemberIds.has(String(expense.paidBy || '')));

    const balances = calculateNetBalances(normalizedExpenses, Array.from(validMemberIds));

    const completedSettlements = await Settlement.find({
      status: 'completed',
      $or: [{ groupId: group._id }, { groupId: null }],
    }).select('fromUser toUser amount groupId');

    completedSettlements.forEach((settlement) => {
      const fromUserId = String(settlement.fromUser || '');
      const toUserId = String(settlement.toUser || '');
      if (!validMemberIds.has(fromUserId) || !validMemberIds.has(toUserId)) {
        return;
      }

      const belongsToGroup = String(settlement.groupId || '') === String(group._id);
      const isLegacyUngrouped = !settlement.groupId;
      if (!belongsToGroup && !isLegacyUngrouped) {
        return;
      }

      const amount = Number(settlement.amount || 0);

      const fromBalance = balances.find((entry) => String(entry.userId) === fromUserId);
      if (fromBalance) {
        fromBalance.balance = Number((fromBalance.balance + amount).toFixed(2));
      } else {
        balances.push({ userId: fromUserId, balance: amount });
      }

      const toBalance = balances.find((entry) => String(entry.userId) === toUserId);
      if (toBalance) {
        toBalance.balance = Number((toBalance.balance - amount).toFixed(2));
      } else {
        balances.push({ userId: toUserId, balance: -amount });
      }
    });

    const memberBalance = balances.find((entry) => String(entry.userId) === targetMemberId)?.balance || 0;
    if (Math.abs(Number(memberBalance)) > 0.009) {
      return res.status(400).json({ message: 'Member cannot be removed until their group balance is zero' });
    }

    await Group.findByIdAndUpdate(group._id, {
      $pull: { members: targetMemberId },
    });

    await User.findByIdAndUpdate(targetMemberId, {
      $pull: { groups: group._id },
    });

    await ActivityLog.create({
      actor: req.user._id,
      action: 'member_removed',
      entityType: 'Group',
      entityId: group._id,
      metadata: { memberId: targetMemberId },
    });

    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove member', error: error.message });
  }
};

const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name username')
      .populate('createdBy', 'name username')
      .populate({
        path: 'expenses',
        populate: [
          { path: 'paidBy', select: 'name username' },
          { path: 'splits.userId', select: 'name username' },
        ],
      });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    return res.status(200).json({ group });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch group', error: error.message });
  }
};

module.exports = {
  createGroup,
  getGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  getGroupById,
};
