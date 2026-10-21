/**
 * События статуса данных.
 * Используется в PageHero.vue для отображения статуса сервера.
 */

const EVENT_NAME = 'finance-data-updated';

/**
 * Отправить событие статуса
 * @param {'saved'|'dirty'|'error'} type
 * @param {string} [message]
 */
export function notifyDataStatus(type, message = '') {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { type, message },
  }));
}

/** Успешно обновлено */
export function notifySaved(message = '') {
  notifyDataStatus('saved', message);
}

/** Есть несохранённые изменения */
export function notifyDirty(message = '') {
  notifyDataStatus('dirty', message);
}

/** Ошибка */
export function notifyError(message = '') {
  notifyDataStatus('error', message);
}

/** Подписка на события (для PageHero) */
export function onDataStatus(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}