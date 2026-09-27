// src/db/migrate.js
import db from './index.js';

export function runMigrations() {
  console.log('[migrate] проверка схемы…');

  // ✅ Таблица messages — для чата
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
        payload TEXT
      );
      CREATE INDEX idx_msg_from ON messages(from_user);
      CREATE INDEX idx_msg_to ON messages(to_user);
      CREATE INDEX idx_msg_created ON messages(created_at);
    `);
    console.log('[migrate] ✅ таблица messages создана');
  } else {
    console.log('[migrate] таблица messages уже есть');
  }

  // Сюда можно добавлять другие миграции в будущем
}