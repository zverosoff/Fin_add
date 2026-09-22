<script setup>
import { useToast } from '@/composables/useToast';
const { toasts } = useToast();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
        {{ t.message }}
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
}

.toast {
  padding: 12px 22px;
  border-radius: 12px;
  background: var(--overlay-bg);
  border: 1px solid var(--accent);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(20px);
  white-space: nowrap;
  pointer-events: auto;

  &.success { border-color: var(--accent-2); }
  &.error   { border-color: var(--danger); }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(.34, 1.56, .64, 1);
}
.toast-enter-from { opacity: 0; transform: translateY(20px) scale(0.95); }
.toast-leave-to   { opacity: 0; transform: translateY(-10px); }
</style>