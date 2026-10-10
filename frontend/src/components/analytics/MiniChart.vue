<!-- frontend/src/components/analytics/MiniChart.vue -->
<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, default: () => [] },
  width: { type: Number, default: 200 },
  height: { type: Number, default: 40 },
  color: { type: String, default: 'rgba(255,255,255,0.85)' },
  trackColor: { type: String, default: 'rgba(255,255,255,0.12)' },
});

const hasData = computed(() => Array.isArray(props.data) && props.data.length > 0);

const maxVal = computed(() => {
  if (!hasData.value) return 1;
  return Math.max(...props.data, 1);
});

const bars = computed(() => {
  if (!hasData.value) return [];
  const count = props.data.length;
  const gap = 2;
  const barWidth = (props.width - gap * (count - 1)) / count;
  return props.data.map((v, i) => {
    const h = Math.max(2, (v / maxVal.value) * props.height);
    return {
      x: i * (barWidth + gap),
      y: props.height - h,
      w: barWidth,
      h,
      key: i,
    };
  });
});
</script>

<template>
  <div class="mini-chart__wrap">
    <svg
      v-if="hasData"
      class="mini-chart"
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g v-for="b in bars" :key="b.key">
        <rect
          :x="b.x" y="0"
          :width="b.w" :height="height"
          :fill="trackColor"
          rx="1"
        />
        <rect
          :x="b.x" :y="b.y"
          :width="b.w" :height="b.h"
          :fill="color"
          rx="1"
          class="mini-chart__bar"
        />
      </g>
    </svg>

    <div v-else class="mini-chart__empty">
      Нет данных за этот период
    </div>
  </div>
</template>

<style scoped lang="scss">
.mini-chart__wrap {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-chart {
  display: block;
  overflow: visible;
}

.mini-chart__bar {
  transition: y 0.4s ease, height 0.4s ease;
}

.mini-chart__empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 600;
  text-align: center;
  padding: 10px 0;
}

@media (prefers-reduced-motion: reduce) {
  .mini-chart__bar { transition: none; }
}
</style>