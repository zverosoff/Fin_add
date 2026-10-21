<script setup>
import { useToast } from '@/composables/useToast';
const { toasts, dismiss } = useToast();
</script>

<template>
  <div class="toast-container">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="t.type"
    >
      <span class="toast-msg">{{ t.message }}</span>
      <button class="toast-close" @click="dismiss(t.id)">✕</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 90%;
  max-width: 400px;
}
.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  border: 1px solid #e2e8f0;
}
.toast.success { border-color: #22c55e; }
.toast.error { border-color: #ef4444; }
.toast-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #94a3b8;
  margin-left: 10px;
}
</style>