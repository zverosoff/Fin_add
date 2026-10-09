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

  box-shadow: var(--shadow-lg);

  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  pointer-events: auto;

  transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;

  &.success { border-color: var(--accent-2, #16a34a); }
  &.error   { border-color: var(--danger, #dc2626); }

  &.has-action {
    padding-right: 12px;
  }
}

:global(:root[data-app-theme="dark"]) .toast {
  background: rgba(30, 16, 48, 0.95);
  border-color: rgba(168, 85, 247, 0.6);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.6),
    0 16px 40px -12px rgba(139, 92, 246, 0.5),
    0 0 0 1px rgba(168, 85, 247, 0.3);

  &.success {
    border-color: rgba(74, 222, 128, 0.7);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.6),
      0 16px 40px -12px rgba(34, 197, 94, 0.4),
      0 0 0 1px rgba(74, 222, 128, 0.3);
  }
  &.error {
    border-color: rgba(244, 63, 94, 0.7);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.6),
      0 16px 40px -12px rgba(244, 63, 94, 0.4),
      0 0 0 1px rgba(244, 63, 94, 0.3);
  }
}

.toast-msg {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.toast-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.toast-action {
  padding: 7px 14px;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent);

  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;

  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1) inset;

  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: var(--accent);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 4px 10px -2px rgba(139, 92, 246, 0.5);
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
  color: var(--muted);

  font-family: inherit;
  font-size: 13px;
  cursor: pointer;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  transition: all 0.15s;

  &:hover {
    background: rgba(244, 63, 94, 0.15);
    color: var(--danger);
  }
  &:active { transform: scale(0.92); }
}

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