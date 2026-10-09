<script setup>
defineProps({
  icon: { type: String, default: '📊' },
  label: { type: String, required: true },
  value: { type: String, required: true },
  hint: { type: String, default: '' },
  accent: { type: Boolean, default: false },
  size: { type: String, default: 'normal' },
});
</script>

<template>
  <div class="metric-card" :class="{ accent, big: size === 'big' }">
    <div class="metric-icon">{{ icon }}</div>
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">{{ value }}</div>
    <div v-if="hint" class="metric-hint">{{ hint }}</div>
  </div>
</template>

<style scoped lang="scss">
.metric-card {
  position: relative;
  padding: 14px 16px;
  background: var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  transition:
    transform 0.18s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.25s ease,
    background 0.3s ease,
    border-color 0.3s ease;
  min-width: 0;

  animation: cardEnter 0.55s cubic-bezier(.34,1.56,.64,1) both;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  &.accent {
    background:
      linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(34, 211, 238, 0.06)),
      var(--grad-card);
  }
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.95);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.metric-icon { font-size: 18px; line-height: 1; margin-bottom: 2px; }

.metric-label {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-value {
  font-family: var(--mono);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.metric-card.big .metric-value { font-size: 24px; }

.metric-card.accent .metric-value {
  background: linear-gradient(135deg, #4ade80, #22c55e);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.metric-hint {
  font-size: 10.5px;
  color: var(--muted);
  margin-top: 2px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

/* Тёмная тема — свечение для accent */
:global(:root[data-app-theme="dark"]) {
  .metric-card.accent {
    background:
      radial-gradient(circle at 100% 0%, rgba(74, 222, 128, 0.12), transparent 60%),
      radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.08), transparent 60%),
      linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%);
    border-color: rgba(74, 222, 128, 0.2);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 12px 28px -8px rgba(34, 197, 94, 0.3),
      0 0 0 1px rgba(74, 222, 128, 0.1) inset;
  }

  .metric-card.accent .metric-value {
    background: linear-gradient(135deg, #4ade80, #22d3ee);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 8px rgba(74, 222, 128, 0.4));
  }

  .metric-value {
    text-shadow: 0 0 10px rgba(168, 85, 247, 0.15);
  }
}

@media (max-width: 700px) {
  .metric-card { padding: 10px 12px; border-radius: 12px; gap: 1px; }
  .metric-icon { font-size: 16px; margin-bottom: 1px; }
  .metric-label { font-size: 9px; letter-spacing: 0.05em; }
  .metric-value { font-size: 16px; }
  .metric-card.big .metric-value { font-size: 20px; }
  .metric-hint { font-size: 9.5px; }
}

@media (max-width: 380px) {
  .metric-value { font-size: 15px; }
  .metric-card.big .metric-value { font-size: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .metric-card { animation: none !important; }
}
</style>