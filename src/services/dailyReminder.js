// backend/src/services/dailyReminder.js
import cron from 'node-cron';
import { sendPushToUser } from './push.js';

const USERS = ['Сергей', 'Саша'];

// ✅ Время напоминания (по умолчанию 21:00 МСК)
const REMINDER_TIME = process.env.REMINDER_TIME || '21:00';
const REMINDER_TZ   = process.env.REMINDER_TZ   || 'Europe/Moscow';

// ✅ Текст напоминания
const REMINDER_TITLE = 'Финансы PRO+';
const REMINDER_TEXT  = '📝 Напоминание: не забудь внести расходы и доходы за сегодня.';

async function sendDailyReminder() {
  const now = new Date().toISOString();
  console.log(`[reminder] рассылка в ${now}`);

  for (const to of USERS) {
    try {
      await sendPushToUser(to, {
        title: REMINDER_TITLE,
        body: REMINDER_TEXT,
        url: '/',
        tag: 'daily-reminder',
      });
      console.log(`[reminder] ✓ push отправлен для ${to}`);
    } catch (e) {
      console.warn(`[reminder] ✗ ошибка для ${to}:`, e.message);
    }
  }
}

export function startDailyReminderCron() {
  const [h, m] = String(REMINDER_TIME).split(':').map(n => parseInt(n, 10));
  const H = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 21;
  const M = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;

  // cron: "минуты часы * * *"
  const expr = `${M} ${H} * * *`;
  console.log(`[reminder] cron: "${expr}" (${REMINDER_TZ})`);

  cron.schedule(expr, () => {
    sendDailyReminder();
  }, {
    timezone: REMINDER_TZ,
  });
}

// ✅ Ручной запуск — для теста
export { sendDailyReminder };