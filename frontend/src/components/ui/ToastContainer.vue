<!-- frontend/src/components/ui/ToastContainer.vue -->
<script setup>
import { useToast } from '@/composables/useToast';
const { toasts, runAction, dismiss } = useToast();

function iconFor(type) {
  if (type === 'success') return '✓';
  if (type === 'error') return '!';
  return 'i';
}
</script>

<template>
  <div class="ios-toast-container">
    <TransitionGroup name="ios-toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="ios-toast"
        :class="t.type"
        @click="dismiss(t.id)"
      >
        <div class="ios-toast-icon" :class="t.type">
          {{ iconFor(t.type) }}
        </div>

        <div class="ios-toast-body">
          <div class="ios-toast-title">
            {{ t.type === 'success' ? 'Готово' : t.type === 'error' ? 'Ошибка' : 'Уведомление' }}
          </div>
          <div class="ios-toast-msg">{{ t.message }}</div>
        </div>

        <button
          v-if="t.action"
          class="ios-toast-action"
          @click.stop="runAction(t.id)"
        >
          {{ t.action.label }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.ios-toast-container {
  position: fixed;
  top: calc(8px + env(safe-area-inset-top, 0));
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;

  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;

  width: 100%;
  max-width: 420px;
  padding: 0 12px;
  box-sizing: border-box;
  pointer-events: none;
}

.ios-toast {
  display: flex;
  align-items: center;
  gap: 10px;

  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 16px;

  background: rgba(28, 28, 30, 0.92);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);

  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;

  box-shadow:
    0 8px 24px -6px rgba(0, 0, 0, 0.5),
    0 0 0 0.5px rgba(255, 255, 255, 0.05) inset;

  pointer-events: auto;
  cursor: pointer;
}

.ios-toast-icon {
  width: 22px;
  height: 22px;
  min-width: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  flex-shrink: 0;

  &.success { background: #22c55e; color: #fff; }
  &.error   { background: #ef4444; color: #fff; }
  &.info    { background: #3b82f6; color: #fff; }
}

.ios-toast-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ios-toast-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.01em;
}

.ios-toast-msg {
  font-size: 12.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ios-toast-action {
  padding: 6px 12px;
  border-radius: 10px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #0a84ff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Анимация как в iOS — сверху */
.ios-toast-enter-active {
  transition: opacity 0.3s ease, transform 0.4s cubic-bezier(.34,1.56,.64,1);
}
.ios-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.3s ease;
}
.ios-toast-enter-from {
  opacity: 0;
  transform: translateY(-40px) scale(0.94);
}
.ios-toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.96);
}

.ios-toast-move {
  transition: transform 0.3s ease;
}
</style>