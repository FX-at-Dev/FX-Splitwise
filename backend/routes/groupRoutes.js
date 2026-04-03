const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const {
  createGroup,
  getGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  getGroupById,
} = require('../controllers/groupController');

const router = express.Router();

router.post(
  '/group/create',
  protect,
  [body('name').trim().notEmpty().withMessage('Group name is required')],
  createGroup
);

router.get('/groups', protect, getGroups);

router.post(
  '/group/add-member',
  protect,
  [
    body('groupId').notEmpty().withMessage('Group ID is required'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscore')
      .customSanitizer((value) => value.toLowerCase()),
  ],
  addMemberToGroup
);

router.post(
  '/group/remove-member',
  protect,
  [
    body('groupId').notEmpty().withMessage('Group ID is required'),
    body('memberId').notEmpty().withMessage('Member ID is required'),
  ],
  removeMemberFromGroup
);

router.get('/group/:id', protect, [param('id').notEmpty().withMessage('Group ID is required')], getGroupById);

module.exports = router;