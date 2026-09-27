// frontend/src/composables/usePushNotifications.js
/**
 * PWA-уведомления о новых сообщениях.
 * Использует Notification API (работает на Android/iOS 16.4+ в установленном PWA).
 *
 * Также обновляет бейдж на иконке приложения через Badging API.
 */

const ICON_URL = '/img/favicon.png';

export function isNotificationSupported() {
  return 'Notification' in window;
}

export function getPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;   // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (!isNotificationSupported()) {
    console.warn('[push] Notification API не поддерживается');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const result = await Notification.requestPermission();
    console.log('[push] разрешение:', result);
    return result;
  } catch (e) {
    console.error('[push] ошибка запроса:', e);
    return 'error';
  }
}

/**
 * Показать уведомление о новом сообщении.
 * @param {{id:string, from:string, text:string, createdAt:string}} msg
 */
export async function notifyIncomingMessage(msg) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  const emoji = msg.from === 'Сергей' ? '👨' : '👩';
  const title = `${emoji} ${msg.from}`;
  const body = (msg.text || '').slice(0, 200);

  // Пытаемся через SW (лучше работает в PWA)
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: ICON_URL,
        badge: ICON_URL,
        tag: 'msg-' + msg.id,
        renotify: false,
        data: { url: '/', messageId: msg.id, from: msg.from },
        vibrate: [80, 40, 80],
        silent: false,
      });
      updateBadge();
      return true;
    }
  } catch (e) {
    console.warn('[push] SW-notification не сработал, fallback:', e);
  }

  // Fallback: обычное Notification
  try {
    const n = new Notification(title, {
      body,
      icon: ICON_URL,
      badge: ICON_URL,
      tag: 'msg-' + msg.id,
      data: { url: '/', messageId: msg.id, from: msg.from },
    });

    n.onclick = () => {
      window.focus();
      n.close();
    };

    updateBadge();
    return true;
  } catch (e) {
    console.error('[push] ошибка показа уведомления:', e);
    return null;
  }
}

/**
 * Обновить бейдж (число) на иконке приложения.
 * Работает на Android + Windows. iOS не поддерживает.
 */
export async function updateBadge(count) {
  if (!('setAppBadge' in navigator)) return;

  try {
    if (typeof count === 'number' && count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (e) {
    // тихо игнорим
  }
}

/**
 * Инициализация: если SW есть — слушаем сообщения от него.
 */
export function initPushHandlers() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (data?.type === 'notification-click') {
      console.log('[push] клик по уведомлению:', data);
      // Можно перейти в чат
      // router.push('/finance') и открыть ChatWidget
    }
  });
}