const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const resolveId = (value) => String(value && typeof value === 'object' && value._id ? value._id : value);

const calculateEqualSplits = (amount, memberIds) => {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new Error('At least one member is required for splitting');
  }

  const perPerson = roundToTwo(amount / memberIds.length);
  const splits = memberIds.map((userId, index) => ({
    userId,
    amount: index === memberIds.length - 1 ? roundToTwo(amount - perPerson * (memberIds.length - 1)) : perPerson,
    paid: false,
    owed: true,
  }));

  return splits;
};

const calculateExactSplits = (amount, exactSplits) => {
  if (!Array.isArray(exactSplits) || exactSplits.length === 0) {
    throw new Error('Exact splits are required');
  }

  const total = exactSplits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (roundToTwo(total) !== roundToTwo(amount)) {
    throw new Error('Exact split amounts must equal the expense amount');
  }

  return exactSplits.map((item) => ({
    userId: item.userId,
    amount: roundToTwo(Number(item.amount)),
    paid: false,
    owed: true,
  }));
};

const calculatePercentageSplits = (amount, percentageSplits) => {
  if (!Array.isArray(percentageSplits) || percentageSplits.length === 0) {
    throw new Error('Percentage splits are required');
  }

  const totalPercentage = percentageSplits.reduce((sum, item) => sum + Number(item.percentage || 0), 0);
  if (roundToTwo(totalPercentage) !== 100) {
    throw new Error('Percentage splits must total 100');
  }

  const splits = percentageSplits.map((item, index) => ({
    userId: item.userId,
    amount: index === percentageSplits.length - 1
      ? roundToTwo(amount - percentageSplits.slice(0, -1).reduce((sum, split) => sum + roundToTwo(amount * (Number(split.percentage) / 100)), 0))
      : roundToTwo(amount * (Number(item.percentage) / 100)),
    paid: false,
    owed: true,
  }));

  return splits;
};

const calculateNetBalances = (expenses, userIds = []) => {
  const balances = new Map();

  userIds.forEach((userId) => balances.set(resolveId(userId), 0));

  expenses.forEach((expense) => {
    if (expense.paidBy) {
      const payerId = resolveId(expense.paidBy);
      balances.set(payerId, (balances.get(payerId) || 0) + Number(expense.amount || 0));
    }

    const splitItems = Array.isArray(expense.splits) ? expense.splits : [];
    splitItems.forEach((split) => {
      if (!split || !split.userId) {
        return;
      }

      const splitUserId = resolveId(split.userId);
      balances.set(splitUserId, (balances.get(splitUserId) || 0) - Number(split.amount || 0));
    });
  });

  return Array.from(balances.entries()).map(([userId, balance]) => ({
    userId,
    balance: roundToTwo(balance),
  }));
};

const simplifyDebts = (netBalances) => {
  const creditors = [];
  const debtors = [];

  netBalances.forEach((entry) => {
    if (entry.balance > 0) {
      creditors.push({ userId: entry.userId, amount: roundToTwo(entry.balance) });
    } else if (entry.balance < 0) {
      debtors.push({ userId: entry.userId, amount: roundToTwo(Math.abs(entry.balance)) });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundToTwo(Math.min(creditor.amount, debtor.amount));

    transfers.push({
      fromUser: debtor.userId,
      toUser: creditor.userId,
      amount,
    });

    creditor.amount = roundToTwo(creditor.amount - amount);
    debtor.amount = roundToTwo(debtor.amount - amount);

    if (creditor.amount === 0) {
      creditorIndex += 1;
    }

    if (debtor.amount === 0) {
      debtorIndex += 1;
    }
  }

  return transfers;
};

module.exports = {
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentageSplits,
  calculateNetBalances,
  simplifyDebts,
  roundToTwo,
};