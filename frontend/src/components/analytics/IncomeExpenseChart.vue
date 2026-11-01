<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAccountsStore } from '@/stores/accounts';

const accounts = useAccountsStore();

const mode = ref('expense');   // 'income' | 'expense'
const period = ref(6);         // месяцев: 3, 6, 12
const selectedCategory = ref('all');

const canvas = ref(null);
let ro = null;

// ✅ Список месяцев для оси X
const months = computed(() => {
  const now = new Date();
  const result = [];
  for (let i = period.value - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][d.getMonth()],
      income: 0,
      expense: 0,
    });
  }
  return result;
});

// ✅ Список категорий (только те, что были в текущем месяце)
const categories = computed(() => {
  const set = new Set();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  for (const t of accounts.transactions) {
    if (t.type !== mode.value) continue;
    if (t.fromReconcile) continue;
    const d = new Date(t.date);
    if (d < start || d > end) continue;
    if (t.category) set.add(t.category);
  }
  return ['all', ...Array.from(set).sort()];
});

// ✅ Данные для графика
const chartData = computed(() => {
  const data = months.value.map(m => ({ ...m, value: 0 }));
  const map = new Map();
  
  for (const m of data) {
    map.set(`${m.year}-${m.month}`, m);
  }
  
  for (const t of accounts.transactions) {
    if (t.type !== mode.value) continue;
    if (t.fromReconcile) continue;
    if (selectedCategory.value !== 'all' && t.category !== selectedCategory.value) continue;
    
    const d = new Date(t.date);
    const bucket = map.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.value += Number(t.amount) || 0;
  }
  
  return data;
});

const maxValue = computed(() =>
  Math.max(1, ...chartData.value.map(d => d.value))
);

// ✅ Отрисовка Canvas
function draw() {
  if (!canvas.value) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.value.getBoundingClientRect();
  const w = rect.width || 300;
  const h = rect.height || 200;
  
  canvas.value.width = w * dpr;
  canvas.value.height = h * dpr;
  
  const ctx = canvas.value.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padL = 48, padR = 12, padT = 20, padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Сетка и подписи Y
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = padT + chartH * (1 - i / steps);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    
    const val = maxValue.value * (i / steps);
    const label = val >= 1000 ? (val / 1000).toFixed(0) + 'K' : val.toFixed(0);
    ctx.fillText(label, padL - 8, y);
  }

  // Точки графика
  const pts = chartData.value.map((d, i) => ({
    x: padL + (chartW / Math.max(1, chartData.value.length - 1)) * i,
    y: padT + chartH * (1 - d.value / maxValue.value),
    value: d.value,
    label: d.label,
  }));

  // Цвета в зависимости от режима
  const isIncome = mode.value === 'income';
  const lineColor = isIncome ? '#4ade80' : '#f43f5e';
  const gradTop = isIncome ? 'rgba(74, 222, 128, 0.4)' : 'rgba(244, 63, 94, 0.4)';
  const gradBottom = isIncome ? 'rgba(74, 222, 128, 0)' : 'rgba(244, 63, 94, 0)';

  // Градиент под линией
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, gradTop);
  grad.addColorStop(1, gradBottom);

  ctx.beginPath();
  ctx.moveTo(pts[0].x, padT + chartH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Линия
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Точки на линии
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.strokeStyle = '#1e1b4b'; // темный контур (как фон карточки)
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Подписи X
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  pts.forEach(p => ctx.fillText(p.label, p.x, padT + chartH + 8));
}

// ✅ Ресайз и реактивность
onMounted(() => {
  draw();
  ro = new ResizeObserver(draw);
  if (canvas.value) ro.observe(canvas.value);
});

onUnmounted(() => {
  if (ro) ro.disconnect();
});

watch([chartData, mode], () => {
  // Ждем обновления DOM при смене периода/категории
  nextTick(draw);
}, { deep: true });
</script>

<template>
  <section class="ie-chart">
    <header class="ie-head">
      <h2 class="ie-title">📈 Анализ</h2>

      <div class="ie-switch">
        <button
          type="button"
          :class="{ active: mode === 'income' }"
          @click="mode = 'income'; selectedCategory = 'all'"
        >Доходы</button>
        <button
          type="button"
          :class="{ active: mode === 'expense' }"
          @click="mode = 'expense'; selectedCategory = 'all'"
        >Расходы</button>
      </div>
    </header>

    <div class="ie-filters">
      <select v-model="period" class="ie-select">
        <option :value="3">3 мес</option>
        <option :value="6">6 мес</option>
        <option :value="12">12 мес</option>
      </select>

      <select v-model="selectedCategory" class="ie-select">
        <option value="all">Все категории</option>
        <option v-for="c in categories.filter(x => x !== 'all')" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div class="ie-canvas-wrap">
      <canvas ref="canvas" class="ie-canvas"></canvas>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ie-chart {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-radius: 18px;
  padding: 16px 18px;
  color: #fff;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
}

.ie-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ie-title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.ie-switch {
  display: inline-flex;
  padding: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  gap: 2px;

  button {
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.15s;

    &.active {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }
  }
}

.ie-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ie-select {
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  outline: none;
  cursor: pointer;

  option { 
    background: #1e1b4b; 
    color: #fff; 
  }
}

.ie-canvas-wrap {
  height: 220px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  padding: 8px;
  box-sizing: border-box;
}

.ie-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 700px) {
  .ie-chart { padding: 14px; border-radius: 14px; }
  .ie-title { font-size: 12px; }
  .ie-switch button { padding: 5px 12px; font-size: 11px; }
  .ie-canvas-wrap { height: 180px; }
}
</style>