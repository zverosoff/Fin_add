// backend/src/services/dailyReminder.js
import cron from 'node-cron';
import db from '../db/index.js';
import { sendPushToUser } from './push.js';

const USERS = ['Сергей', 'Саша'];
const SYSTEM_USER = 'Приложение';

// ✅ Время напоминания (по умолчанию 21:00 МСК)
const REMINDER_TIME = process.env.REMINDER_TIME || '21:00';
const REMINDER_TZ   = process.env.REMINDER_TZ   || 'Europe/Moscow';

// ✅ Текст напоминания
const REMINDER_TEXT = '📝 Напоминание: не забудь внести расходы и доходы за сегодня.';

const insertMsg = db.prepare(`
  INSERT INTO messages
    (id, from_user, to_user, text, image, created_at, read_at, edited_at, deleted_at, pinned_at, reply_to, payload)
  VALUES
    (@id, @from, @to, @text, NULL, @createdAt, NULL, NULL, NULL, NULL, NULL, @payload)
`);

const getMsgStmt = db.prepare('SELECT * FROM messages WHERE id = ?');

const touchPresenceStmt = db.prepare(`
  INSERT INTO user_presence (user, last_seen, updated_at)
  VALUES (@user, @now, @now)
  ON CONFLICT(user) DO UPDATE SET last_seen = @now, updated_at = @now
`);

function makeId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function rowToMessage(row) {
  return {
    id: row.id,
    from: row.from_user,
    to: row.to_user,
    text: row.text,
    image: row.image || null,
    createdAt: row.created_at,
    readAt: row.read_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    pinnedAt: row.pinned_at,
    replyTo: row.reply_to,
    payload: row.payload ? JSON.parse(row.payload) : null,
    reactions: [],
    system: true,
  };
}

async function sendDailyReminder(io) {
  const now = new Date().toISOString();
  console.log(`[reminder] рассылка в ${now}`);

  for (const to of USERS) {
    const id = makeId();
    const msg = {
      id,
      from: SYSTEM_USER,
      to,
      text: REMINDER_TEXT,
      createdAt: now,
      payload: JSON.stringify({ fromUser: SYSTEM_USER, system: true }),
    };

    try {
      insertMsg.run(msg);
      touchPresenceStmt.run({ user: SYSTEM_USER, now });

      const saved = rowToMessage(getMsgStmt.get(id));

      if (io) {
        io.emit('message:new', saved);
      }

      // ✅ Push — придёт как обычное новое сообщение
      await sendPushToUser(to, {
        title: 'Финансы PRO+',
        body: REMINDER_TEXT,
        url: '/',
        messageId: id,
      });

      console.log(`[reminder] ✓ отправлено для ${to}`);
    } catch (e) {
      console.warn(`[reminder] ✗ ошибка для ${to}:`, e.message);
    }
  }
}

export function startDailyReminderCron(io) {
  const [h, m] = String(REMINDER_TIME).split(':').map(n => parseInt(n, 10));
  const H = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 21;
  const M = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;

  // cron: "минуты часы * * *"
  const expr = `${M} ${H} * * *`;
  console.log(`[reminder] cron: "${expr}" (${REMINDER_TZ})`);

  cron.schedule(expr, () => {
    sendDailyReminder(io);
  }, {
    timezone: REMINDER_TZ,
  });
}

// ✅ Ручной запуск — для теста
export { sendDailyReminder };