<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { fmt, categoryIcon, categoryEmoji } from '@/composables/useFormat';
import IconOrEmoji from '@/components/ui/IconOrEmoji.vue';

const accounts = useAccountsStore();
const txStore = useTransactionsStore();

const mode = ref('expense'); // 'income' | 'expense'
const canvas = ref(null);
let ro = null;

// ✅ Берем текущий месяц из глобального стора транзакций (он меняется через MonthNav)
const currentMonthDate = computed(() => txStore.currentMonth);

const monthLabel = computed(() => {
  const d = currentMonthDate.value;
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
});

// ✅ Фильтруем транзакции за выбранный месяц и нужный тип
const monthTransactions = computed(() => {
  const d = currentMonthDate.value;
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  return accounts.transactions.filter(t => {
    if (t.type !== mode.value) return false;
    if (t.fromReconcile) return false;
    if (t.category === 'Внутренний перевод') return false; // ✅ Игнорируем технические
    const td = new Date(t.date);
    return td >= start && td <= end;
  });
});

// ✅ Группируем по категориям
const chartData = computed(() => {
  const map = new Map();
  for (const t of monthTransactions.value) {
    const cat = t.category || 'Прочее';
    map.set(cat, (map.get(cat) || 0) + (Number(t.amount) || 0));
  }

  // Сортируем по убыванию суммы
  const sorted = Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Берем топ-10 для графика, чтобы не было каши
  return sorted.slice(0, 10);
});

const totalAmount = computed(() => 
  chartData.value.reduce((s, item) => s + item.amount, 0)
);

const maxValue = computed(() => {
  if (chartData.value.length === 0) return 1;
  return Math.max(...chartData.value.map(d => d.amount));
});

// ✅ Палитра для столбиков
const PALETTE = [
  '#a855f7', '#ec4899', '#06b6d4', '#10b981',
  '#f59e0b', '#f43f5e', '#8b5cf6', '#22d3ee',
  '#84cc16', '#fb923c',
];

function colorFor(i) {
  return PALETTE[i % PALETTE.length];
}

// ✅ Отрисовка Canvas
function draw() {
  if (!canvas.value) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.value.getBoundingClientRect();
  const w = rect.width || 300;
  const h = rect.height || 240;

  canvas.value.width = w * dpr;
  canvas.value.height = h * dpr;

  const ctx = canvas.value.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padL = 48, padR = 16, padT = 20, padB = 40;
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

  if (chartData.value.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Нет данных за этот месяц', w / 2, padT + chartH / 2);
    return;
  }

  // ✅ Рисуем столбики
  const count = chartData.value.length;
  const gap = 12;
  const barW = Math.min(40, (chartW - gap * (count - 1)) / count);
  const totalBarsW = barW * count + gap * (count - 1);
  const startX = padL + (chartW - totalBarsW) / 2;

  chartData.value.forEach((d, i) => {
    const barH = (d.amount / maxValue.value) * chartH;
    const x = startX + i * (barW + gap);
    const y = padT + chartH - barH;

    // Градиент для столбика
    const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
    const col = colorFor(i);
    grad.addColorStop(0, col);
    grad.addColorStop(1, col + '80');

    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = Math.min(6, barW / 2, barH / 2);
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barW, barH, r);
    } else {
      ctx.rect(x, y, barW, barH);
    }
    ctx.fill();
  });
}

onMounted(() => {
  draw();
  ro = new ResizeObserver(draw);
  if (canvas.value) ro.observe(canvas.value);
});

onUnmounted(() => {
  if (ro) ro.disconnect();
});

// Перерисовываем при изменении месяца, режима или данных
watch([chartData, mode, currentMonthDate], () => {
  nextTick(draw);
}, { deep: true });
</script>

<template>
  <section class="ie-chart">
    <header class="ie-head">
      <div>
        <h2 class="ie-title">📈 Анализ за месяц</h2>
        <div class="ie-subtitle">{{ monthLabel }}</div>
      </div>

      <div class="ie-switch">
        <button
          type="button"
          :class="{ active: mode === 'income' }"
          @click="mode = 'income'"
        >Доходы</button>
        <button
          type="button"
          :class="{ active: mode === 'expense' }"
          @click="mode = 'expense'"
        >Расходы</button>
      </div>
    </header>

    <!-- ✅ Легенда (топ категорий) с горизонтальным скроллом -->
    <div v-if="chartData.length > 0" class="ie-legend">
      <div
        v-for="(c, i) in chartData"
        :key="c.category"
        class="ie-legend-item"
      >
        <span class="ie-legend-dot" :style="{ background: colorFor(i) }"></span>
        <IconOrEmoji
          :src="categoryIcon(c.category)"
          :emoji="categoryEmoji(c.category)"
          :size="14"
          :alt="c.category"
        />
        <span class="ie-legend-name">{{ c.category }}</span>
        <span class="ie-legend-amount">{{ fmt(c.amount) }} ₽</span>
      </div>
    </div>

    <div class="ie-canvas-wrap">
      <canvas ref="canvas" class="ie-canvas"></canvas>
    </div>
    
    <!-- ✅ Итоговая сумма за месяц -->
    <div v-if="chartData.length > 0" class="ie-total">
      <span class="ie-total-label">Всего {{ mode === 'income' ? 'доходов' : 'расходов' }}:</span>
      <span class="ie-total-value">{{ fmt(totalAmount) }} ₽</span>
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

.ie-subtitle {
  font-size: 11px;
  opacity: 0.6;
  font-weight: 600;
  margin-top: 2px;
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

/* ✅ Легенда */
.ie-legend {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
}

.ie-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.ie-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ie-legend-name {
  color: rgba(255, 255, 255, 0.85);
}

.ie-legend-amount {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 2px;
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

/* ✅ Итоговая сумма */
.ie-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
}

.ie-total-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}

.ie-total-value {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 800;
  color: #fff;
}

@media (max-width: 700px) {
  .ie-chart { padding: 14px; border-radius: 14px; }
  .ie-title { font-size: 12px; }
  .ie-subtitle { font-size: 10px; }
  .ie-switch button { padding: 5px 12px; font-size: 11px; }
  .ie-canvas-wrap { height: 180px; }
  .ie-legend-item { font-size: 10px; padding: 3px 6px; }
  .ie-total-value { font-size: 14px; }
}
</style>