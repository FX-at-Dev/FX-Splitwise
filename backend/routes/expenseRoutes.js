const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const {
  addExpense,
  getGroupExpenses,
  getPersonalExpenses,
  getExpenseSummary,
} = require('../controllers/expenseController');

const router = express.Router();

router.post(
  '/expense/add',
  protect,
  [
    body('title').trim().notEmpty().withMessage('Expense title is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('paidBy').notEmpty().withMessage('Paid by is required'),
    body('splitType').optional().isIn(['equal', 'exact', 'percentage']).withMessage('Invalid split type'),
  ],
  addExpense
);

router.get('/expenses/group/:id', protect, [param('id').notEmpty().withMessage('Group ID is required')], getGroupExpenses);

router.get('/expenses/personal', protect, getPersonalExpenses);

router.get('/group/:groupId/summary', protect, [param('groupId').notEmpty().withMessage('Group ID is required')], getExpenseSummary);

module.exports = router;