const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { Resend } = require('resend');
const User = require('../models/User');
const env = require('../config/env');

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

const createToken = (userId) => {
  return jwt.sign({ id: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

const buildAuthResponse = (user) => {
  const token = createToken(user._id);

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      groups: user.groups || [],
      createdAt: user.createdAt,
    },
  };
};

const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getResetPasswordUrl = (rawToken) => {
  const baseUrl = (env.clientUrl || '').replace(/\/+$/, '');
  const resetPath = (env.resetPasswordPath || '/forgot-password.html').startsWith('/')
    ? env.resetPasswordPath
    : `/${env.resetPasswordPath}`;

  return `${baseUrl}${resetPath}?token=${encodeURIComponent(rawToken)}`;
};

const buildResetEmail = ({ name, resetUrl }) => {
  const appName = env.resendFromName || 'FX Splitwise';

  return {
    subject: `${appName} password reset`,
    text: [
      `Hi ${name || 'there'},`,
      '',
      'We received a request to reset your password.',
      `Use this link to continue: ${resetUrl}`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p style="margin: 0 0 12px;">Hi ${name || 'there'},</p>
        <p style="margin: 0 0 16px;">We received a request to reset your FX Splitwise password.</p>
        <p style="margin: 0 0 20px;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; background: #33d6a6; color: #06261d; text-decoration: none; border-radius: 10px; font-weight: 700;">Reset password</a>
        </p>
        <p style="margin: 0 0 12px; color: #475569;">Or paste this link into your browser:</p>
        <p style="margin: 0 0 16px; word-break: break-all; color: #0f172a;">${resetUrl}</p>
        <p style="margin: 0; color: #64748b;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  };
};

const sendResetEmail = async ({ to, name, resetUrl }) => {
  if (!resend || !env.resendFromEmail) {
    return false;
  }

  const message = buildResetEmail({ name, resetUrl });

  await resend.emails.send({
    from: `${env.resendFromName || 'FX Splitwise'} <${env.resendFromEmail}>`,
    to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return true;
};

const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, username, email, password } = req.body;

  try {
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const normalizedUsername = username.toLowerCase();
    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username: normalizedUsername,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    return res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: 'Signup failed', error: error.message });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.status(200).json(buildAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const logout = async (_req, res) => {
  return res.status(200).json({ message: 'Logged out successfully' });
};

const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const genericResponse = {
    message: 'If an account with that email exists, a password reset link has been generated.',
  };

  try {
    const email = String(req.body.email || '').toLowerCase();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = getResetPasswordUrl(rawToken);
    const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpiresAt');

    if (user) {
      const expiresAt = new Date(Date.now() + env.passwordResetTokenExpiryMinutes * 60 * 1000);

      user.passwordResetToken = hashResetToken(rawToken);
      user.passwordResetExpiresAt = expiresAt;
      await user.save();

      await sendResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    }

    const response = { ...genericResponse };

    if (!env.isProduction) {
      response.resetUrl = resetUrl;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to process forgot password request', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token, password } = req.body;

  try {
    const hashedToken = hashResetToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpiresAt');

    if (!user) {
      return res.status(400).json({ message: 'Reset token is invalid or has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Reset password failed', error: error.message });
  }
};

const getProfile = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

module.exports = {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
};