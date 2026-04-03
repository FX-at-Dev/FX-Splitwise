const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const buildLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });
};

const apiLimiter = buildLimiter(
  env.rateLimitWindowMs,
  env.rateLimitMaxRequests,
  'Too many requests. Please try again later.'
);

const authLimiter = buildLimiter(
  env.authRateLimitWindowMs,
  env.authRateLimitMaxRequests,
  'Too many authentication attempts. Please try again later.'
);

module.exports = {
  apiLimiter,
  authLimiter,
};