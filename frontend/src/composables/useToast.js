import { ref } from 'vue';

const toasts = ref([]);
let nextId = 0;

export function useToast() {
  function show(message, type = 'info', opts = {}) {
    const id = ++nextId;
    const toast = {
      id,
      message,
      type,
      duration: opts.duration ?? 3500,
      action: opts.action ?? null,   // { label, onClick }
    };
    toasts.value.push(toast);

    // Авто-скрытие (если action не задан)
    if (!toast.action) {
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
      }, toast.duration);
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

  return {
    toasts,
    show,
    dismiss,
    runAction,
    success: (m, o) => show(m, 'success', o),
    error:   (m, o) => show(m, 'error', o),
    info:    (m, o) => show(m, 'info', o),
  };
}