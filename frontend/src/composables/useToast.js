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
      duration: opts.duration ?? 3000,
    };
    toasts.value.push(toast);

    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, toast.duration);

    return id;
  }

  return {
    toasts,
    show,
    success: (m, o) => show(m, 'success', o),
    error:   (m, o) => show(m, 'error', o),
    info:    (m, o) => show(m, 'info', o),
  };
}