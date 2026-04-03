const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    referenceId: {
      type: String,
      trim: true,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'cash'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
    settledAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Settlement', settlementSchema);