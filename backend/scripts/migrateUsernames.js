const mongoose = require('mongoose');
require('../config/env');
const connectDatabase = require('../config/database');
const User = require('../models/User');

const toBaseUsername = (source) => {
  const normalized = String(source || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const fallback = normalized || 'user';
  return fallback.slice(0, 20);
};

const createUniqueUsername = async (baseUsername) => {
  let candidate = baseUsername;
  let counter = 1;

  while (await User.exists({ username: candidate })) {
    const suffix = `_${counter}`;
    const maxBaseLength = 20 - suffix.length;
    candidate = `${baseUsername.slice(0, maxBaseLength)}${suffix}`;
    counter += 1;
  }

  return candidate;
};

const runMigration = async () => {
  await connectDatabase();

  const usersWithoutUsername = await User.find({
    $or: [
      { username: { $exists: false } },
      { username: null },
      { username: '' },
    ],
  }).select('name email');

  if (!usersWithoutUsername.length) {
    console.log('No users require username migration.');
    return;
  }

  for (const user of usersWithoutUsername) {
    const emailBase = user.email ? user.email.split('@')[0] : 'user';
    const baseUsername = toBaseUsername(user.name || emailBase);
    const uniqueUsername = await createUniqueUsername(baseUsername);

    await User.updateOne(
      { _id: user._id },
      { $set: { username: uniqueUsername } }
    );

    console.log(`Assigned username ${uniqueUsername} to user ${user._id}`);
  }

  console.log(`Migration complete. Updated ${usersWithoutUsername.length} users.`);
};

runMigration()
  .catch((error) => {
    console.error('Username migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });