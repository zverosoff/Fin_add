<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { drawLineChart } from '@/composables/useChart';

const props = defineProps({
  data: { type: Array, required: true },
});

const canvas = ref(null);

function render() {
  if (canvas.value) drawLineChart(canvas.value, props.data);
}

onMounted(() => {
  render();
  window.addEventListener('resize', render);
});

onUnmounted(() => {
  window.removeEventListener('resize', render);
});

watch(() => props.data, render, { deep: true });
</script>

<template>
  <div class="chart-wrap">
    <canvas ref="canvas" class="chart-canvas"></canvas>
  </div>
</template>

<style scoped lang="scss">
.chart-wrap {
  width: 100%;
  height: 220px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  box-shadow: var(--shadow-md);
  box-sizing: border-box;
}

.chart-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 700px) {
  .chart-wrap {
    height: 180px;
    padding: 8px;
    border-radius: 12px;
  }
}

@media (max-width: 380px) {
  .chart-wrap {
    height: 160px;
  }
}
</style>