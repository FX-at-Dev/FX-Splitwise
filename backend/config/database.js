const mongoose = require('mongoose');
const env = require('./env');

const connectDatabase = async () => {
  try {

    const connection = await mongoose.connect(env.mongodbUri);

    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);

  } catch (error) {

    console.error('❌ Database connection failed:', error.message);

    // Exit process if DB fails (production standard)
    process.exit(1);
  }
};

/* Production stability improvements */

// Handle DB errors after connection
mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err);
});

// Handle disconnection
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = connectDatabase;