const express = require('express');
const { body } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimitMiddleware');
const { signup, login, logout, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

router.post(
  '/signup',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be 3 to 20 characters long')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscore')
      .customSanitizer((value) => value.toLowerCase()),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  signup
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post('/logout', logout);

router.post(
  '/password/forgot',
  authLimiter,
  [body('email').isEmail().withMessage('Valid email is required').normalizeEmail()],
  forgotPassword
);

router.post(
  '/password/reset',
  authLimiter,
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  resetPassword
);

module.exports = router;