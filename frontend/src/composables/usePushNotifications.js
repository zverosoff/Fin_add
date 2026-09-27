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
  console.log('[push] notifyIncomingMessage вызван', { msg, perm: Notification.permission });

  if (!isNotificationSupported()) {
    console.warn('[push] Notification не поддерживается');
    return null;
  }
  if (Notification.permission !== 'granted') {
    console.warn('[push] нет разрешения:', Notification.permission);
    return null;
  }

  const emoji = msg.from === 'Сергей' ? '👨' : '👩';
  const title = `${emoji} ${msg.from}`;
  const body = (msg.text || '').slice(0, 200) || '📷 Изображение';

  // Пытаемся через SW
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    console.log('[push] SW registration:', reg);

    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: ICON_URL,
        badge: ICON_URL,
        tag: 'msg-' + msg.id,
        renotify: true,           // ✅ чтобы перезаписывалось с новым телом
        requireInteraction: false,
        data: { url: '/', messageId: msg.id, from: msg.from },
        vibrate: [80, 40, 80],
        silent: false,
      });
      console.log('[push] ✅ показано через SW');
      updateBadge();
      return true;
    } else {
      console.warn('[push] SW reg.showNotification недоступен, fallback');
    }
  } catch (e) {
    console.warn('[push] SW-notification не сработал, fallback:', e);
  }

  // Fallback
  try {
    const n = new Notification(title, {
      body,
      icon: ICON_URL,
      badge: ICON_URL,
      tag: 'msg-' + msg.id,
      data: { url: '/', messageId: msg.id, from: msg.from },
    });
    console.log('[push] ✅ показано через Notification fallback');
    n.onclick = () => { window.focus(); n.close(); };
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