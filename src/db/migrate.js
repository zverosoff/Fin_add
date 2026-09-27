// src/db/migrate.js
import db from './index.js';

export function runMigrations() {
  console.log('[migrate] проверка схемы…');

  // ============================================================
  // messages
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
        image TEXT,
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
    addColumn('image', 'TEXT'); // ✅ base64 или URL

    console.log('[migrate] таблица messages обновлена');
  }

  // ============================================================
  // user_presence
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
  }

  // ============================================================
  // message_reactions
  // ============================================================
  const hasReactions = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='message_reactions'
  `).get();

  if (!hasReactions) {
    console.log('[migrate] создаю таблицу message_reactions…');
    db.exec(`
      CREATE TABLE message_reactions (
        message_id TEXT NOT NULL,
        user TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (message_id, user, emoji)
      );
      CREATE INDEX idx_react_msg ON message_reactions(message_id);
      CREATE INDEX idx_react_user ON message_reactions(user);
    `);
    console.log('[migrate] ✅ таблица message_reactions создана');
  }

  console.log('[migrate] ✅ все миграции применены');
}