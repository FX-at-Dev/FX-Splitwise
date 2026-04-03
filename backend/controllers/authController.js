const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const env = require('../config/env');

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

const getProfile = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

module.exports = {
  signup,
  login,
  logout,
  getProfile,
};