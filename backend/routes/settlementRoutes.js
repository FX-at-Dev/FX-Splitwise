const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { settleExpense, getSettlements, markSettlementSettled } = require('../controllers/settlementController');

const router = express.Router();

router.post(
  '/settle',
  protect,
  [
    body('fromUser').optional({ values: 'falsy' }).trim().notEmpty().withMessage('From user cannot be empty'),
    body('toUser').optional({ values: 'falsy' }).trim().notEmpty().withMessage('To user cannot be empty'),
    body('toUsername')
      .optional({ values: 'falsy' })
      .trim()
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('toUsername can only contain letters, numbers, and underscore')
      .customSanitizer((value) => value.toLowerCase()),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0').toFloat(),
    body('paymentMethod').optional().isIn(['upi', 'cash']).withMessage('paymentMethod must be upi or cash'),
    body('referenceId').optional().trim(),
    body().custom((value) => {
      if (!value.toUser && !value.toUsername) {
        throw new Error('Provide toUser or toUsername');
      }

      return true;
    }),
  ],
  settleExpense
);

router.get('/settlements', protect, getSettlements);

router.patch('/settlements/:id/mark-settled', protect, markSettlementSettled);

module.exports = router;