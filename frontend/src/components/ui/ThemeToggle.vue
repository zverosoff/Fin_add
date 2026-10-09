<script setup>
import { useAppTheme } from '@/composables/useAppTheme';

const { theme, setTheme, resolvedTheme } = useAppTheme();

const OPTIONS = [
  { id: 'light', icon: '☀️', label: 'Светлая' },
  { id: 'auto',  icon: '🌗', label: 'Система' },
  { id: 'dark',  icon: '🌙', label: 'Тёмная' },
];
</script>

<template>
  <div class="theme-toggle" :class="{ 'is-dark': resolvedTheme === 'dark' }">
    <div class="tt-header">
      <span class="tt-icon">🎨</span>
      <span class="tt-title">Тема оформления</span>
    </div>

    <div class="tt-options">
      <button
        v-for="opt in OPTIONS"
        :key="opt.id"
        type="button"
        class="tt-btn"
        :class="{ active: theme === opt.id }"
        @click="setTheme(opt.id)"
      >
        <span class="tt-btn-icon">{{ opt.icon }}</span>
        <span class="tt-btn-label">{{ opt.label }}</span>
      </button>
    </div>

    <Transition name="tt-hint-fade">
      <div v-if="theme === 'auto'" class="tt-hint">
        Тема меняется автоматически по настройкам системы
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.theme-toggle {
  padding: 16px 18px;
  border-radius: 16px;

  background: var(--grad-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);

  transition: background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
}

.tt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.tt-icon { font-size: 16px; }

.tt-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.tt-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.tt-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;

  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--panel-2, #f8fafc);
  color: var(--muted);

  font-family: inherit;
  cursor: pointer;

  transition:
    transform 0.18s cubic-bezier(.34,1.56,.64,1),
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.25s ease;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }

  &:active { transform: scale(0.97); }

  &.active {
    background: var(--grad-primary);
    border-color: transparent;
    color: #ffffff;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 6px 16px -4px rgba(139, 92, 246, 0.5);
  }
}

.tt-btn-icon { font-size: 20px; line-height: 1; }

.tt-btn-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.tt-hint {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--muted);
  text-align: center;
  line-height: 1.4;
}

.tt-hint-fade-enter-active,
.tt-hint-fade-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
}
.tt-hint-fade-enter-from,
.tt-hint-fade-leave-to {
  opacity: 0;
  max-height: 0;
}
.tt-hint-fade-enter-to,
.tt-hint-fade-leave-from {
  opacity: 1;
  max-height: 60px;
}

.theme-toggle.is-dark .tt-btn.active {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.15) inset,
    0 -2px 0 rgba(0, 0, 0, 0.3) inset,
    0 8px 24px -4px rgba(168, 85, 247, 0.65),
    0 0 0 1px rgba(168, 85, 247, 0.3);
}

@media (max-width: 700px) {
  .theme-toggle { padding: 14px; border-radius: 14px; }
  .tt-btn { padding: 10px 6px; }
  .tt-btn-icon { font-size: 18px; }
  .tt-btn-label { font-size: 10px; }
}
</style>