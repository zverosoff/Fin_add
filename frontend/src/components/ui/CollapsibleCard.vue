<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  storageKey: { type: String, required: true },  // ключ для localStorage
  defaultCollapsed: { type: Boolean, default: false },
});

const collapsed = ref(props.defaultCollapsed);

onMounted(() => {
  try {
    const saved = localStorage.getItem(props.storageKey);
    if (saved !== null) collapsed.value = saved === '1';
  } catch (e) {}
});

function toggle() {
  collapsed.value = !collapsed.value;
  try {
    localStorage.setItem(props.storageKey, collapsed.value ? '1' : '0');
  } catch (e) {}
}

watch(collapsed, () => {
  // Для реактивности
});
</script>

<template>
  <section class="collapsible-card" :class="{ collapsed }">
    <header class="cc-head" @click="toggle">
      <div class="cc-title">
        <span v-if="icon" class="cc-icon">{{ icon }}</span>
        <h2>{{ title }}</h2>
      </div>
      <button class="cc-toggle" type="button" :aria-label="collapsed ? 'Развернуть' : 'Свернуть'">
        <svg viewBox="0 0 24 24" class="chev"><path d="M7 10l5 5 5-5z"/></svg>
      </button>
    </header>

    <div class="cc-body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.collapsible-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  padding: 16px 18px;
  transition: padding 0.25s ease, box-shadow 0.25s;

  &.collapsed {
    padding: 12px 18px;
  }

  &:hover {
    box-shadow: var(--shadow-lg);
  }
}

.cc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
}

.cc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  .cc-icon {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  h2 {
    font-size: 12px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
  }
}

.cc-toggle {
  background: #f1f5f9;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
}

.cc-toggle .chev {
  width: 14px;
  height: 14px;
  fill: currentColor;
  transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);
}

.collapsible-card:not(.collapsed) .cc-toggle .chev {
  transform: rotate(180deg);
}

.cc-body {
  max-height: 3000px;
  overflow: hidden;
  opacity: 1;
  margin-top: 12px;
  transition:
    max-height 0.35s cubic-bezier(.22,.61,.36,1),
    opacity 0.25s ease,
    margin 0.3s ease;
}

.collapsible-card.collapsed .cc-body {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}
</style>