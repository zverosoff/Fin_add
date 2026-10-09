// src/db/migrate.js
import db from './index.js';

export function runMigrations() {
  console.log('[migrate] проверка схемы…');

  // ============================================================
  // push_subscriptions — остаётся (нужен для напоминаний)
  // ============================================================
  const hasPush = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='push_subscriptions'
  `).get();

  if (!hasPush) {
    console.log('[migrate] создаю таблицу push_subscriptions…');
    db.exec(`
      CREATE TABLE push_subscriptions (
        user TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user, endpoint)
      );
      CREATE INDEX idx_push_user ON push_subscriptions(user);
    `);
    console.log('[migrate] ✅ таблица push_subscriptions создана');
  }

  // ============================================================
  // user_profiles — остаётся (профили для UI)
  // ============================================================
  const hasProfiles = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='user_profiles'
  `).get();

  if (!hasProfiles) {
    console.log('[migrate] создаю таблицу user_profiles…');
    db.exec(`
      CREATE TABLE user_profiles (
        user TEXT PRIMARY KEY,
        display_name TEXT,
        avatar TEXT,
        created_at TEXT,
        updated_at TEXT NOT NULL
      );
    `);
    console.log('[migrate] ✅ таблица user_profiles создана');
  } else {
    const cols = db.prepare(`PRAGMA table_info(user_profiles)`).all();
    const hasCreatedAt = cols.some(c => c.name === 'created_at');
    if (!hasCreatedAt) {
      console.log('[migrate] + колонка user_profiles.created_at');
      db.exec(`ALTER TABLE user_profiles ADD COLUMN created_at TEXT`);
    }
  }

  // ============================================================
  // 🧹 Удаляем таблицы мессенджера, если они остались
  // ============================================================
  const legacyTables = ['messages', 'message_reactions', 'user_presence'];
  for (const t of legacyTables) {
    const exists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(t);
    if (exists) {
      console.log(`[migrate] 🗑 удаляю legacy-таблицу ${t}`);
      db.exec(`DROP TABLE IF EXISTS ${t}`);
    }
  }

  console.log('[migrate] ✅ все миграции применены');
}