const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

require('../config/env');
const connectDatabase = require('../config/database');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const { calculateEqualSplits } = require('../utils/splitCalculator');

const parseArgs = (argv) => {
  const args = { file: '', sheet: '', dryRun: false };

  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (value === '--file') {
      args.file = argv[i + 1] || '';
      i += 1;
      continue;
    }

    if (value === '--sheet') {
      args.sheet = argv[i + 1] || '';
      i += 1;
    }
  }

  return args;
};

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();

const parseUsernames = (value) => String(value || '')
  .split(',')
  .map((item) => normalizeUsername(item))
  .filter(Boolean);

const parseDateValue = (value) => {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number') {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H,
          parsed.M,
          Math.floor(parsed.S)
        )
      );
    }
  }

  const fromString = new Date(value);
  if (!Number.isNaN(fromString.getTime())) {
    return fromString;
  }

  throw new Error(`Invalid date value: ${value}`);
};

const requiredColumns = [
  'title',
  'amount',
  'paidByUsername',
];

const run = async () => {
  const args = parseArgs(process.argv);
  if (!args.file) {
    throw new Error('Missing --file argument. Example: npm run import:expenses -- --file ../expenses.xlsx --sheet Expenses');
  }

  const workbookPath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook file not found: ${workbookPath}`);
  }

  await connectDatabase();

  const workbook = xlsx.readFile(workbookPath, { cellDates: true });
  const sheetName = args.sheet || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) {
    console.log('No data rows found in sheet.');
    return;
  }

  const firstRow = rows[0];
  const missingColumns = requiredColumns.filter((column) => !(column in firstRow));
  if (missingColumns.length) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  const users = await User.find({}).select('_id username');
  const groups = await Group.find({}).select('_id name members');

  const userByUsername = new Map(users.map((user) => [normalizeUsername(user.username), user]));
  const groupByName = new Map(groups.map((group) => [String(group.name || '').trim().toLowerCase(), group]));

  const stats = {
    created: 0,
    skipped: 0,
    failed: 0,
  };

  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;

    try {
      const title = String(row.title || '').trim();
      const amount = Number(row.amount);
      const paidByUsername = normalizeUsername(row.paidByUsername);
      const notes = String(row.notes || '').trim();
      const groupName = String(row.groupName || '').trim();
      const date = parseDateValue(row.date);

      if (!title) {
        throw new Error('title is required');
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('amount must be a positive number');
      }

      const payer = userByUsername.get(paidByUsername);
      if (!payer) {
        throw new Error(`payer not found for username: ${paidByUsername}`);
      }

      const group = groupName ? groupByName.get(groupName.toLowerCase()) : null;
      if (groupName && !group) {
        throw new Error(`group not found: ${groupName}`);
      }

      let splitUsernames = parseUsernames(row.memberUsernames || row.members || '');
      if (!splitUsernames.length) {
        if (group) {
          const memberIdSet = new Set((group.members || []).map((memberId) => String(memberId)));
          splitUsernames = users
            .filter((user) => memberIdSet.has(String(user._id)))
            .map((user) => normalizeUsername(user.username));
        } else {
          splitUsernames = [paidByUsername];
        }
      }

      const splitUsers = splitUsernames.map((username) => {
        const user = userByUsername.get(username);
        if (!user) {
          throw new Error(`split member not found: ${username}`);
        }

        return user;
      });

      if (group) {
        const memberIdSet = new Set((group.members || []).map((memberId) => String(memberId)));
        const invalidMember = splitUsers.find((user) => !memberIdSet.has(String(user._id)));
        if (invalidMember) {
          throw new Error(`split member @${invalidMember.username} is not in group ${group.name}`);
        }

        if (!memberIdSet.has(String(payer._id))) {
          throw new Error(`payer @${payer.username} is not in group ${group.name}`);
        }
      }

      const memberIds = splitUsers.map((user) => String(user._id));
      const splits = calculateEqualSplits(amount, memberIds);

      if (args.dryRun) {
        stats.skipped += 1;
        continue;
      }

      const expense = await Expense.create({
        title,
        amount,
        groupId: group ? group._id : null,
        paidBy: payer._id,
        splits,
        splitType: 'equal',
        notes,
        date,
      });

      if (group) {
        await Group.findByIdAndUpdate(group._id, {
          $addToSet: { expenses: expense._id },
        });
      }

      stats.created += 1;
    } catch (error) {
      stats.failed += 1;
      errors.push(`Row ${rowNumber}: ${error.message}`);
    }
  }

  if (args.dryRun) {
    console.log(`Dry run complete. Rows checked: ${rows.length}. Potential imports: ${stats.skipped}. Errors: ${stats.failed}`);
  } else {
    console.log(`Import complete. Created: ${stats.created}. Failed: ${stats.failed}.`);
  }

  if (errors.length) {
    console.log('--- Errors ---');
    errors.slice(0, 50).forEach((message) => console.log(message));
    if (errors.length > 50) {
      console.log(`...and ${errors.length - 50} more errors`);
    }
  }
};

run()
  .catch((error) => {
    console.error('Workbook import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
