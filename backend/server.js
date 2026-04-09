const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const connectDatabase = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimitMiddleware');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();

connectDatabase();

const defaultAllowedOrigins = [
  env.clientUrl,
  'http://127.0.0.1:5500',
  'http://localhost:5500',
];

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...(env.corsAllowedOrigins || []),
].filter(Boolean));

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: env.jsonLimit }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.status(200).json({ message: 'API is running' });
});

app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', groupRoutes);
app.use('/', expenseRoutes);
app.use('/', settlementRoutes);
app.use('/', notificationRoutes);
app.use('/', activityRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, _req, res, _next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: error.message || 'Server error',
  });
});

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});