// src/routes/push.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  saveSubscription,
  removeSubscription,
  getVapidPublicKey,
  isPushEnabled,
} from '../services/push.js';

const router = Router();

router.get('/vapid-public', (req, res) => {
  res.json({ ok: true, key: getVapidPublicKey(), enabled: isPushEnabled() });
});

router.post('/subscribe', requireAuth, (req, res) => {
  try {
    const user = req.user;
    const { subscription } = req.body ?? {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ ok: false, error: 'subscription обязателен' });
    }
    saveSubscription(user, subscription);
    console.log('[push] подписка сохранена для', user, subscription.endpoint.slice(0, 40));
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] subscribe error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/unsubscribe', requireAuth, (req, res) => {
  try {
    const { endpoint } = req.body ?? {};
    if (endpoint) removeSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;