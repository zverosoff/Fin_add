import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Куда сохранять БД
const DATA_DIR = path.resolve(__dirname, '../../', process.env.DATA_DIR || './data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[db] создана папка ${DATA_DIR}`);
}

const DB_PATH = path.join(DATA_DIR, 'finance.db');
console.log(`[db] файл базы: ${DB_PATH}`);

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    category TEXT,
    date TEXT NOT NULL,
    user TEXT,
    account_id TEXT,
    from_reconcile INTEGER NOT NULL DEFAULT 0,
    fixed INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user);
`);

console.log('[db] таблицы готовы');

const INITIAL_STATE = {
  version: 1,
  accountStart: 10_900_000,
  rate: 11.7,
  incomes: [
    { id: 'depositIncome', name: 'Вклад',    value: 0,     auto: true  },
    { id: 'salary',        name: 'Зарплата', value: 78989, auto: false },
    { id: 'incomeSasha',   name: 'Доход Саша', value: 30000, auto: false },
  ],
  expenses: [
    { id: 'expCar',      name: 'Автокредит', value: 0,     auto: false },
    { id: 'expGarage',   name: 'Гараж',      value: 5000,  auto: false },
    { id: 'expGarden',   name: 'Сад',        value: 20000, auto: false },
    { id: 'expMortgage', name: 'Ипотека',    value: 36820, auto: false },
  ],
  users: ['Сергей', 'Саша'],
  accounts: [
    { id: 'sber_sergey',  name: 'СберБанк', owner: 'Сергей', value: 0, openingBalance: 0 },
    { id: 'tbank_sergey', name: 'Т-Банк',   owner: 'Сергей', value: 0, openingBalance: 0 },
    { id: 'sber_sasha',   name: 'СберБанк', owner: 'Саша',   value: 0, openingBalance: 0 },
    { id: 'tbank_sasha',  name: 'Т-Банк',   owner: 'Саша',   value: 0, openingBalance: 0 },
  ],
  goals: [],
  flat: {},
};

const row = db.prepare('SELECT id FROM app_state WHERE id = 1').get();
if (!row) {
  db.prepare('INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?)')
    .run(JSON.stringify(INITIAL_STATE), new Date().toISOString());
  console.log('[db] создано начальное состояние');
} else {
  console.log('[db] состояние найдено');
}

export default db;