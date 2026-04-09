const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env')
});

/* Required variables */

const requiredKeys = [
  'MONGODB_URI',
  'JWT_SECRET'
];

const missingKeys = requiredKeys.filter((key) => {
  const value = process.env[key];
  return !value || value.trim() === '';
});

if (missingKeys.length) {
  console.error(
    `❌ Missing environment variables: ${missingKeys.join(', ')}`
  );

  process.exit(1);
}

/* Helper parsers */

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

const toBool = (value) => {
  return value === 'true';
};

/* Environment config */

const env = Object.freeze({

  nodeEnv:
    process.env.NODE_ENV || 'development',

  isProduction:
    process.env.NODE_ENV === 'production',

  port:
    toNumber(process.env.PORT, 5000),

  mongodbUri:
    process.env.MONGODB_URI,

  jwtSecret:
    process.env.JWT_SECRET,

  jwtExpiresIn:
    process.env.JWT_EXPIRES_IN || '7d',

  clientUrl:
    process.env.CLIENT_URL || 'http://localhost:5500',

  jsonLimit:
    process.env.EXPRESS_JSON_LIMIT || '1mb',

  rateLimitWindowMs:
    toNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000),

  rateLimitMaxRequests:
    toNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 200),

  authRateLimitWindowMs:
    toNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 900000),

  authRateLimitMaxRequests:
    toNumber(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 20),

  resendApiKey:
    process.env.RESEND_API_KEY || '',

  resendFromEmail:
    process.env.RESEND_FROM_EMAIL || '',

  resendFromName:
    process.env.RESEND_FROM_NAME || 'FX Splitwise',

  passwordResetTokenExpiryMinutes:
    toNumber(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES, 30),

  resetPasswordPath:
    process.env.RESET_PASSWORD_PATH || '/forgot-password.html',

});

module.exports = env;