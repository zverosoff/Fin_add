<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const tabs = [
  { to: '/finance',   icon: '⭐', label: 'Финансы',      short: 'Финансы' },
  { to: '/deposits',  icon: '💎', label: 'Вклады',       short: 'Вклады' },
  { to: '/analytics', icon: '📊', label: 'Аналитика',    short: 'Анализ' },
];
</script>

<template>
  <nav class="app-tabs">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="app-tab"
      :class="{ active: route.path === tab.to }"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label-full">{{ tab.label }}</span>
      <span class="tab-label-short">{{ tab.short }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
.app-tabs {
  display: flex;
  gap: 8px;
  justify-content: center;
  max-width: 900px;
  margin: 0 auto 16px;
  flex-wrap: wrap;
}

.app-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  color: #475569;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.18s;
  white-space: nowrap;

  &:hover {
    border-color: #2563eb;
    color: #2563eb;
    background: rgba(37, 99, 235, 0.08);
    transform: translateY(-1px);
  }

  &.active {
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 12px 28px -10px rgba(37, 99, 235, 0.75);
    cursor: default;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}

.tab-icon { font-size: 16px; }

.tab-label-short { display: none; }

@media (max-width: 700px) {
  .app-tabs {
    gap: 6px;
    padding: 0 8px;
    margin-bottom: 12px;
  }

  .app-tab {
    flex: 1;
    padding: 8px 10px;
    font-size: 12px;
    gap: 5px;
    min-width: 0;
    justify-content: center;
  }

  .tab-icon { font-size: 14px; }

  .tab-label-full { display: none; }
  .tab-label-short { display: inline; }
}
</style>