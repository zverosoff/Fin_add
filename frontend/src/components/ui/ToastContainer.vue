<script setup>
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';

const { toasts, runAction, dismiss } = useToast();
const auth = useAuthStore();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="ios-toast"
        :class="[t.type, { 'has-action': !!t.action }]"
        @click="t.action ? runAction(t.id) : null"
      >
        <!-- Аватарка -->
        <div class="toast-avatar">
          <img v-if="auth.avatar" :src="auth.avatar" alt="Avatar" />
          <div v-else class="avatar-placeholder">
            {{ auth.user === 'Сергей' ? '👨' : '👩' }}
          </div>
          <!-- Иконка приложения поверх аватарки -->
          <div class="app-icon">
            <img src="/img/favicon.png" alt="App" />
          </div>
        </div>

        <!-- Контент -->
        <div class="toast-content">
          <div class="toast-header">
            <span class="toast-app-name">Финансы PRO+</span>
            <span class="toast-time">сейчас</span>
          </div>
          <div class="toast-title">{{ t.title || auth.displayName || auth.user }}</div>
          <div class="toast-msg">{{ t.message }}</div>
        </div>

        <!-- Кнопка закрытия -->
        <button class="toast-close" @click.stop="dismiss(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  padding: 0 16px;
  pointer-events: none;
  box-sizing: border-box;
}

/* ✅ Стиль iOS-уведомления */
.ios-toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 20px;
  
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  
  box-shadow: 
    0 10px 40px -10px rgba(15, 23, 42, 0.2),
    0 2px 10px rgba(15, 23, 42, 0.05);
  
  pointer-events: auto;
  width: 100%;
  box-sizing: border-box;
  cursor: default;
}

.ios-toast.has-action {
  cursor: pointer;
}
.ios-toast.has-action:active {
  transform: scale(0.98);
}

/* Аватарка */
.toast-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #e2e8f0;
}
.toast-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #f1f5f9;
  border-radius: 50%;
}

/* Иконка приложения поверх аватарки */
.app-icon {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.app-icon img {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  object-fit: contain;
}

/* Контент */
.toast-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}
.toast-app-name {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.toast-time {
  font-size: 11px;
  color: #94a3b8;
}
.toast-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}
.toast-msg {
  font-size: 13px;
  color: #334155;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Кнопка закрытия */
.toast-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: #94a3b8;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
.ios-toast:hover .toast-close {
  opacity: 1;
}

/* Анимация падения сверху (iOS style) */
.toast-enter-active {
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 1, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
</style>