<!-- frontend/src/components/analytics/MiniChart.vue -->
<script setup>
import { computed } from 'vue';

const props = defineProps({
  /** Массив значений, например [3, 5, 8, 6, 9, 7, 10] */
  data: { type: Array, default: () => [] },
  /** Ширина SVG */
  width: { type: Number, default: 200 },
  /** Высота SVG */
  height: { type: Number, default: 40 },
  /** Цвет столбцов */
  color: { type: String, default: 'rgba(255,255,255,0.85)' },
  /** Цвет фона столбцов (трек) */
  trackColor: { type: String, default: 'rgba(255,255,255,0.12)' },
});

const maxVal = computed(() => {
  if (!props.data.length) return 1;
  return Math.max(...props.data, 1);
});

const bars = computed(() => {
  if (!props.data.length) return [];
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
  <svg
    v-if="data.length"
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
</template>

<style scoped lang="scss">
.mini-chart {
  display: block;
  overflow: visible;
}

.mini-chart__bar {
  transition: y 0.4s ease, height 0.4s ease;
}

@media (prefers-reduced-motion: reduce) {
  .mini-chart__bar { transition: none; }
}
</style>