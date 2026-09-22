/**
 * Расчёт ожидаемого баланса счёта по операциям.
 * Операции с fromReconcile=true НЕ учитываются (это корректировки).
 */

/**
 * Ожидаемый баланс счёта
 * @param {Object} account — объект счёта с openingBalance
 * @param {Array} transactions — все операции
 */
export function computeExpectedBalance(account, transactions) {
  if (!account) return 0;
  const opening = Number(account.openingBalance) || 0;
  let delta = 0;

  for (const t of transactions) {
    if (!t) continue;
    if (t.accountId !== account.id) continue;
    if (t.fixed === true) continue;
    if (t.fromReconcile === true) continue;

    if (t.type === 'income') delta += Number(t.amount) || 0;
    else if (t.type === 'expense') delta -= Number(t.amount) || 0;
  }

  return opening + delta;
}

/**
 * Расхождение счёта: { expected, actual, diff, hasDiff }
 */
export function computeDiff(account, transactions) {
  const expected = computeExpectedBalance(account, transactions);
  const actual = Number(account?.value) || 0;
  const diff = actual - expected;
  return {
    expected,
    actual,
    diff,
    hasDiff: Math.abs(diff) > 0.01,
  };
}

/**
 * Расхождения по всем счетам пользователя
 */
export function computeUserDiff(userName, accounts, transactions) {
  const userAccounts = accounts.filter(a => (a.owner || 'Сергей') === userName);

  let totalExpected = 0;
  let totalActual = 0;
  let hasDiff = false;

  for (const acc of userAccounts) {
    const { expected, actual, diff, hasDiff: d } = computeDiff(acc, transactions);
    totalExpected += expected;
    totalActual += actual;
    if (d) hasDiff = true;
  }

  return {
    userName,
    accounts: userAccounts,
    expected: totalExpected,
    actual: totalActual,
    diff: totalActual - totalExpected,
    hasDiff,
  };
}