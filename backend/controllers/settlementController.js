const { validationResult } = require('express-validator');
const Settlement = require('../models/Settlement');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const settleExpense = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    fromUser,
    toUser,
    toUsername,
    amount,
    paymentMethod = 'cash',
    groupId = null,
    referenceId = '',
  } = req.body;

  try {
    const fromUserId = fromUser || req.user._id;
    let toUserId = toUser;

    if (!toUserId && toUsername) {
      const payee = await User.findOne({ username: String(toUsername).toLowerCase() }).select('_id');
      if (!payee) {
        return res.status(404).json({ message: 'Recipient user not found for the provided username' });
      }

      toUserId = payee._id;
    }

    if (!toUserId) {
      return res.status(400).json({ message: 'To user or toUsername is required' });
    }

    const settlement = await Settlement.create({
      fromUser: fromUserId,
      toUser: toUserId,
      amount,
      paymentMethod,
      groupId,
      referenceId,
      status: 'pending',
    });

    await ActivityLog.create({
      actor: req.user._id,
      action: 'settlement_made',
      entityType: 'Settlement',
      entityId: settlement._id,
      metadata: {
        fromUser: fromUserId,
        toUser: toUserId,
        amount,
        paymentMethod,
        groupId,
        referenceId,
      },
    });

    return res.status(201).json({ settlement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create settlement', error: error.message });
  }
};

const getSettlements = async (req, res) => {
  try {
    const filter = req.query.groupId ? { groupId: req.query.groupId } : {};
    const settlements = await Settlement.find(filter)
      .populate('fromUser', 'name username')
      .populate('toUser', 'name username')
      .populate('groupId', 'name')
      .sort({ date: -1 });

    return res.status(200).json({ settlements });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch settlements', error: error.message });
  }
};

const markSettlementSettled = async (req, res) => {
  try {
    const existingSettlement = await Settlement.findById(req.params.id).select('fromUser toUser status');

    if (!existingSettlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    const requesterId = String(req.user._id);
    const fromUserId = String(existingSettlement.fromUser || '');
    const toUserId = String(existingSettlement.toUser || '');

    if (requesterId === fromUserId) {
      return res.status(403).json({ message: 'The user who created the settlement cannot mark it as completed.' });
    }

    if (requesterId !== toUserId) {
      return res.status(403).json({ message: 'Only the recipient can mark this settlement as completed.' });
    }

    if (existingSettlement.status === 'completed') {
      return res.status(400).json({ message: 'Settlement is already completed.' });
    }

    const settlement = await Settlement.findByIdAndUpdate(
      req.params.id,
      {
        status: 'completed',
        settledAt: new Date(),
      },
      { new: true }
    )
      .populate('fromUser', 'name username')
      .populate('toUser', 'name username')
      .populate('groupId', 'name');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    await ActivityLog.create({
      actor: req.user._id,
      action: 'settlement_completed',
      entityType: 'Settlement',
      entityId: settlement._id,
      metadata: { amount: settlement.amount, groupId: settlement.groupId?._id || null },
    });

    return res.status(200).json({ settlement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark settlement as completed', error: error.message });
  }
};

module.exports = {
  settleExpense,
  getSettlements,
  markSettlementSettled,
};