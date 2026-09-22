<script setup>
defineProps({
  icon: { type: String, default: '📊' },
  label: { type: String, required: true },
  value: { type: String, required: true },
  hint: { type: String, default: '' },
  accent: { type: Boolean, default: false },
  size: { type: String, default: 'normal' }, // normal | big
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
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  &.accent {
    background:
      linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(139, 92, 246, 0.08)),
      rgba(255, 255, 255, 0.9);
  }
}

.metric-icon {
  font-size: 18px;
  line-height: 1;
  margin-bottom: 2px;
}

.metric-label {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  line-height: 1.2;
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
}

.metric-card.big .metric-value {
  font-size: 24px;
}

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
}
</style>