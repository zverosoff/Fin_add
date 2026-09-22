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

// Блокируем скролл body, когда открыто
watch(() => props.modelValue, (val) => {
  document.body.style.overflow = val ? 'hidden' : '';
});

function onKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) {
    close();
  }
}

// Подписываемся на клавишу Escape
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-box {
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

/* Анимация */
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
</style>