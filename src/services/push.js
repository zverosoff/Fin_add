// src/services/push.js
import webpush from 'web-push';
import db from '../db/index.js';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('[push] VAPID настроен, public:', VAPID_PUBLIC.slice(0, 20) + '...');
} else {
  console.warn('[push] VAPID-ключи не заданы, push отключён');
}

// ✅ Ленивая инициализация стейтментов — БЕЗ выполнения prepare на верхнем уровне
let stmts = null;

function ensureTable() {
  // На случай, если миграции не успели
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      user TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user, endpoint)
    );
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user);
  `);
}

function getStmts() {
  if (stmts) return stmts;
  ensureTable();
  stmts = {
    save: db.prepare(`
      INSERT INTO push_subscriptions (user, endpoint, p256dh, auth, created_at)
      VALUES (@user, @endpoint, @p256dh, @auth, @createdAt)
      ON CONFLICT(user, endpoint) DO UPDATE SET
        p256dh = @p256dh,
        auth = @auth
    `),
    del: db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`),
    list: db.prepare(`SELECT * FROM push_subscriptions WHERE user = ?`),
  };
  return stmts;
}

export function isPushEnabled() {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC || null;
}

export function saveSubscription(user, subscription) {
  getStmts().save.run({
    user,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    createdAt: new Date().toISOString(),
  });
}

export function removeSubscription(endpoint) {
  getStmts().del.run(endpoint);
}

export async function sendPushToUser(user, payload) {
  if (!isPushEnabled()) return;

  const subs = getStmts().list.all(user);
  if (!subs.length) return;

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 }
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log('[push] удаляю протухшую подписку', s.endpoint.slice(0, 40));
          removeSubscription(s.endpoint);
        } else {
          console.error('[push] send error:', err.statusCode, err.body || err.message);
        }
      }
    })
  );
}