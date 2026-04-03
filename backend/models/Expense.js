const mongoose = require('mongoose');

const splitItemSchema = new mongoose.Schema(
  {
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
    _id: false,
  }
);

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    splits: [splitItemSchema],
    splitType: {
      type: String,
      enum: ['equal', 'exact', 'percentage'],
      default: 'equal',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Expense', expenseSchema);