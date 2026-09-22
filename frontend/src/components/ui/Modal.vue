<script setup>
import { watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

function close() {
  emit('update:modelValue', false);
}

// Блокировка скролла body
watch(() => props.modelValue, (val) => {
  document.body.style.overflow = val ? 'hidden' : '';
});

function onKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) close();
}

watch(() => props.modelValue, (val) => {
  if (val) document.addEventListener('keydown', onKeydown);
  else document.removeEventListener('keydown', onKeydown);
}, { immediate: true });
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        @click.self="close"
      >
        <div class="modal-box">
          <!-- Ручка-индикатор для мобильных -->
          <div class="modal-handle"></div>

          <header class="modal-head">
            <h3>{{ title }}</h3>
            <button class="modal-close" @click="close" aria-label="Закрыть">✕</button>
          </header>

          <div class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-box {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: 92vh;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Ручка-индикатор (только на мобильных) */
.modal-handle {
  display: none;
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(148, 163, 184, 0.5);
  margin: 8px auto 0;
  flex-shrink: 0;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
}

.modal-close {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.08);
  }
}

.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.modal-foot {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  background: #ffffff;
}

/* ============================================================
   Анимация
   ============================================================ */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-box,
.modal-leave-active .modal-box {
  transition: transform 0.28s cubic-bezier(.34,1.56,.64,1), opacity 0.22s;
}
.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}

/* ============================================================
   МОБИЛЬНАЯ — fullscreen снизу
   ============================================================ */
@media (max-width: 700px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .modal-box {
    max-width: 100%;
    width: 100%;
    max-height: 92vh;
    border-radius: 20px 20px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  /* Показываем ручку */
  .modal-handle {
    display: block;
  }

  .modal-head {
    padding: 12px 18px 10px;
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 5;
  }

  .modal-head h3 {
    font-size: 15px;
  }

  .modal-body {
    padding: 14px 16px;
  }

  .modal-foot {
    padding: 12px 16px 16px;
    flex-direction: column-reverse;
    gap: 8px;

    button {
      width: 100%;
      min-height: 48px;
      font-size: 14px;
    }
  }

  /* Анимация снизу */
  .modal-enter-active .modal-box,
  .modal-leave-active .modal-box {
    transition: transform 0.3s cubic-bezier(.22,.61,.36,1);
  }
  .modal-enter-from .modal-box,
  .modal-leave-to .modal-box {
    transform: translateY(100%);
    opacity: 1;
  }
}
</style>