const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    owed: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Split', splitSchema);