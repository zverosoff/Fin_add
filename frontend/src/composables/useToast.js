import { ref } from 'vue';

const toasts = ref([]);
let nextId = 0;

// ✅ Дефолтные длительности
const DEFAULT_DURATION = 3500;         // обычный тост
const ACTION_DURATION  = 8000;         // тост с кнопкой действия — висит дольше
const MAX_TOASTS       = 3;            // не даём заспамить экран

export function useToast() {
  function show(message, type = 'info', opts = {}) {
    const id = ++nextId;
    const hasAction = !!opts.action;

    const toast = {
      id,
      message,
      type,
      duration: opts.duration ?? (hasAction ? ACTION_DURATION : DEFAULT_DURATION),
      action: opts.action ?? null,
      startedAt: Date.now(),
    };

    toasts.value.push(toast);

    // ✅ Авто-скрытие работает ВСЕГДА — и с action, и без
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, toast.duration);

    // ✅ Ограничиваем количество одновременно видимых
    if (toasts.value.length > MAX_TOASTS) {
      toasts.value = toasts.value.slice(-MAX_TOASTS);
    }

    return id;
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  function runAction(id) {
    const toast = toasts.value.find(t => t.id === id);
    if (toast?.action?.onClick) {
      try { toast.action.onClick(); }
      catch (e) { console.error('[toast] action error', e); }
    }
    dismiss(id);
  }

  function dismissAll() {
    toasts.value = [];
  }

  return {
    toasts,
    show,
    dismiss,
    dismissAll,
    runAction,
    success: (m, o) => show(m, 'success', o),
    error:   (m, o) => show(m, 'error', o),
    info:    (m, o) => show(m, 'info', o),
  };
}