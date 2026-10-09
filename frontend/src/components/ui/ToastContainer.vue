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

        <div class="toast-actions">
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
          >✕</button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   КОНТЕЙНЕР — фиксирован внизу, ограничен по ширине
   ============================================================ */
.toast-container {
  position: fixed;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;

  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;

  width: 100%;
  max-width: 460px;
  padding: 0 12px;
  box-sizing: border-box;
  pointer-events: none;
}

/* ============================================================
   ТОСТ — растянут по ширине контейнера
   ============================================================ */
.toast {
  display: flex;
  align-items: center;
  gap: 12px;

  width: 100%;
  box-sizing: border-box;

  padding: 12px 14px 12px 18px;
  border-radius: 14px;

  background: var(--overlay-bg, #ffffff);
  border: 1.5px solid var(--accent);
  color: var(--text);

  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.35;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 4px 12px -4px rgba(15, 23, 42, 0.12),
    0 12px 32px -8px rgba(15, 23, 42, 0.18),
    0 24px 48px -20px rgba(15, 23, 42, 0.12);

  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  pointer-events: auto;

  &.success { border-color: var(--accent-2, #16a34a); }
  &.error   { border-color: var(--danger, #dc2626); }

  &.has-action {
    padding-right: 12px;
  }
}

/* ============================================================
   ТЕКСТ — занимает всё место, аккуратно переносится
   ============================================================ */
.toast-msg {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* ============================================================
   КНОПКИ — справа, не сжимаются
   ============================================================ */
.toast-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.toast-action {
  padding: 7px 14px;
  border-radius: 10px;
  border: 1px solid var(--accent, #0284c7);
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0.06));
  color: var(--accent, #0284c7);

  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 1px 2px rgba(15, 23, 42, 0.04);

  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: var(--accent, #0284c7);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 4px 10px -2px rgba(2, 132, 199, 0.4);
  }
  &:active { transform: scale(0.96); }
}

.toast-close {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;

  border-radius: 50%;
  border: none;
  background: rgba(148, 163, 184, 0.15);
  color: var(--muted, #64748b);

  font-family: inherit;
  font-size: 13px;
  cursor: pointer;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  transition: all 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #dc2626;
  }
  &:active { transform: scale(0.92); }
}

/* ============================================================
   АНИМАЦИИ
   ============================================================ */
.toast-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.35s cubic-bezier(.34,1.56,.64,1);
}
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.94);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.94);
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .toast-container {
    bottom: calc(84px + env(safe-area-inset-bottom, 0));
    max-width: 100%;
    padding: 0 10px;
    gap: 6px;
  }

  .toast {
    padding: 12px 12px 12px 16px;
    font-size: 13px;
    gap: 10px;
    border-radius: 13px;
  }

  .toast-msg {
    font-size: 13px;
    line-height: 1.3;
  }

  .toast-action {
    padding: 7px 12px;
    font-size: 12px;
  }

  .toast-close {
    width: 24px;
    height: 24px;
    min-width: 24px;
    min-height: 24px;
    font-size: 12px;
  }
}

@media (max-width: 380px) {
  .toast {
    font-size: 12.5px;
    padding: 11px 10px 11px 14px;
    gap: 8px;
  }
  .toast-action {
    padding: 6px 10px;
    font-size: 11.5px;
  }
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-action,
  .toast-close {
    transition: none !important;
    transform: none !important;
  }
}
</style>