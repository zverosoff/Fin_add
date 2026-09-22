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
        <span class="toast-msg">{{ t.message }}</span>

        <button
          v-if="t.action"
          class="toast-action"
          @click="runAction(t.id)"
        >
          {{ t.action.label }}
        </button>

        <button
          v-if="t.action"
          class="toast-close"
          @click="dismiss(t.id)"
          aria-label="Закрыть"
        >✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  pointer-events: none;
  align-items: center;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--overlay-bg);
  border: 1px solid var(--accent);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(20px);
  pointer-events: auto;
  max-width: calc(100vw - 40px);

  &.success { border-color: var(--accent-2); }
  &.error   { border-color: var(--danger); }
  &.has-action { padding-right: 12px; }
}

.toast-msg {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-action {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
}

.toast-close {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;

  &:hover { color: var(--danger); }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.28s cubic-bezier(.34, 1.56, .64, 1);
}
.toast-enter-from { opacity: 0; transform: translateY(20px) scale(0.95); }
.toast-leave-to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
</style>