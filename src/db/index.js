import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR =
  (fs.existsSync('/data') && '/data') || 
  process.env.DATA_DIR ||
  (fs.existsSync('/data') ? '/data' : path.resolve(__dirname, '../../data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[db] создана папка ${DATA_DIR}`);
}

const DB_PATH = path.join(DATA_DIR, 'finance.db');
console.log(`[db] файл базы: ${DB_PATH}`);

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');     // ← добавить
db.pragma('synchronous = NORMAL');  

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
  ],
  expenses: [
    { id: 'expMortgage', name: 'Ипотека', value: 36820, auto: false },
  ],
  users: ['Сергей', 'Саша'],
  // ✅ Т-Банк первым
  accounts: [
    { id: 'tbank_sergey', name: 'Т-Банк',   owner: 'Сергей', value: 0, openingBalance: 0 },
    { id: 'sber_sergey',  name: 'СберБанк', owner: 'Сергей', value: 0, openingBalance: 0 },
    { id: 'tbank_sasha',  name: 'Т-Банк',   owner: 'Саша',   value: 0, openingBalance: 0 },
    { id: 'sber_sasha',   name: 'СберБанк', owner: 'Саша',   value: 0, openingBalance: 0 },
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