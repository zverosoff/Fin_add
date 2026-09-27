// src/db/migrate.js
import db from './index.js';

export function runMigrations() {
  console.log('[migrate] проверка схемы…');

  // ============================================================
  // ✅ messages — с новыми полями
  // ============================================================
  const hasMessages = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='messages'
  `).get();

  if (!hasMessages) {
    console.log('[migrate] создаю таблицу messages…');
    db.exec(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read_at TEXT,
        edited_at TEXT,
        deleted_at TEXT,
        pinned_at TEXT,
        reply_to TEXT,
        payload TEXT
      );
      CREATE INDEX idx_msg_from ON messages(from_user);
      CREATE INDEX idx_msg_to ON messages(to_user);
      CREATE INDEX idx_msg_created ON messages(created_at);
      CREATE INDEX idx_msg_pinned ON messages(pinned_at);
    `);
    console.log('[migrate] ✅ таблица messages создана');
  } else {
    // ✅ Добавляем недостающие колонки (soft migration)
    const cols = db.prepare(`PRAGMA table_info(messages)`).all();
    const colNames = new Set(cols.map(c => c.name));

    const addColumn = (name, def) => {
      if (colNames.has(name)) return;
      db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${def}`);
      console.log(`[migrate]   + колонка messages.${name}`);
    };

    addColumn('edited_at', 'TEXT');
    addColumn('deleted_at', 'TEXT');
    addColumn('pinned_at', 'TEXT');
    addColumn('reply_to', 'TEXT');

    console.log('[migrate] таблица messages обновлена');
  }

  // ============================================================
  // ✅ user_presence — последний визит пользователя
  // ============================================================
  const hasPresence = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='user_presence'
  `).get();

  if (!hasPresence) {
    console.log('[migrate] создаю таблицу user_presence…');
    db.exec(`
      CREATE TABLE user_presence (
        user TEXT PRIMARY KEY,
        last_seen TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    console.log('[migrate] ✅ таблица user_presence создана');
  } else {
    console.log('[migrate] таблица user_presence уже есть');
  }

  console.log('[migrate] ✅ все миграции применены');
}