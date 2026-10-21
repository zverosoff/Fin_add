<script setup>
import { useToast } from '@/composables/useToast';
const { toasts, runAction, dismiss } = useToast();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="[t.type, { 'has-action': !!t.action }]"
      >
        <div class="toast-icon" v-if="t.type === 'success'">✅</div>
        <div class="toast-icon" v-else-if="t.type === 'error'">❌</div>
        <div class="toast-icon" v-else>ℹ️</div>

        <span class="toast-msg">{{ t.message }}</span>

        <button
          v-if="t.action"
          class="toast-action"
          @click="runAction(t.id)"
        >
          {{ t.action.label }}
        </button>

        <button
          class="toast-close"
          @click="dismiss(t.id)"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top, 0));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100000;
  pointer-events: none;
  align-items: center;
  padding: 0 16px;
  box-sizing: border-box;
  width: 100%;
  max-width: 500px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.05);
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 
    0 10px 40px -10px rgba(15, 23, 42, 0.25),
    0 2px 8px rgba(15, 23, 42, 0.08);
  pointer-events: auto;
  width: 100%;
}

.toast.success { border-color: rgba(34, 197, 94, 0.3); }
.toast.error { border-color: rgba(239, 68, 68, 0.3); }

.toast-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.toast-msg {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-action {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #6366f1;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.toast-action:hover {
  background: #6366f1;
  color: #fff;
}

.toast-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

@media (max-width: 700px) {
  .toast-container {
    top: calc(8px + env(safe-area-inset-top, 0));
    padding: 0 12px;
  }
  .toast {
    padding: 12px 14px;
    font-size: 13px;
    width: 100%;
  }
  .toast-msg {
    white-space: normal;
    word-break: break-word;
    line-height: 1.3;
  }
}
</style>