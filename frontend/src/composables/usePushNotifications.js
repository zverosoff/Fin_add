// frontend/src/composables/usePushNotifications.js
const ICON_URL = '/img/favicon.png';
const VAPID_URL = '/api/push/vapid-public';

export function isNotificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    console.error('[push] requestPermission error:', e);
    return 'error';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Подписаться на Web Push и сохранить подписку на бэкенде.
 * Вызывать после логина (когда есть cookie авторизации).
 */
export async function subscribeToPush() {
  if (!isNotificationSupported()) {
    console.warn('[push] Push API не поддерживается');
    return null;
  }

  const reg = await navigator.serviceWorker.ready;
  if (!reg.pushManager) {
    console.warn('[push] pushManager недоступен');
    return null;
  }

  // Разрешение
  if (Notification.permission !== 'granted') {
    const res = await requestPermission();
    if (res !== 'granted') {
      console.warn('[push] разрешение не получено:', res);
      return null;
    }
  }

  // VAPID-ключ с бэкенда
  let key = null;
  try {
    const r = await fetch(VAPID_URL, { credentials: 'include' });
    const j = await r.json();
    key = j.key;
  } catch (e) {
    console.warn('[push] не удалось получить VAPID-ключ:', e);
  }

  if (!key) {
    console.warn('[push] VAPID-ключ отсутствует на бэкенде');
    return null;
  }

  // Подписка
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    } catch (e) {
      console.error('[push] pushManager.subscribe error:', e);
      return null;
    }
  }

  // Отправляем на бэкенд
  try {
    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subscription }),
    });
    const j = await r.json();
    if (!j.ok) console.warn('[push] subscribe ответ:', j);
    else console.log('[push] ✅ подписка сохранена на бэкенде');
  } catch (e) {
    console.warn('[push] не удалось сохранить подписку:', e);
  }

  return subscription;
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint }),
    });
  } catch (e) {
    console.warn('[push] unsubscribe error:', e);
  }
}

export async function updateBadge(count) {
  if (!('setAppBadge' in navigator)) return;
  try {
    if (typeof count === 'number' && count > 0) await navigator.setAppBadge(count);
    else await navigator.clearAppBadge();
  } catch (e) {}
}

export function initPushHandlers() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (data?.type === 'notification-click') {
      console.log('[push] клик по уведомлению:', data);
    }
  });
}