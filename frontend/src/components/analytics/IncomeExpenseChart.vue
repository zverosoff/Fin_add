<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { categoryIcon, categoryEmoji } from '@/composables/useFormat';
import IconOrEmoji from '@/components/ui/IconOrEmoji.vue';

const accounts = useAccountsStore();

const mode = ref('expense'); // 'income' | 'expense'
const canvas = ref(null);
let ro = null;

// ✅ 3 последних месяца (включая текущий)
const months = computed(() => {
  const now = new Date();
  const res = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][d.getMonth()],
      key: `${d.getFullYear()}-${d.getMonth()}`,
    });
  }
  return res;
});

// ✅ Категории, использованные за эти 3 месяца, с суммами по каждому месяцу
const categories = computed(() => {
  const monthKeys = new Set(months.value.map(m => m.key));
  const map = new Map(); // category -> { total, byMonth: { key: amount } }

  for (const t of accounts.transactions) {
    if (t.fromReconcile) continue;
    if (t.type !== mode.value) continue;
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthKeys.has(key)) continue;

    const cat = t.category || 'Прочее';
    if (!map.has(cat)) {
      map.set(cat, { category: cat, total: 0, byMonth: {} });
    }
    const entry = map.get(cat);
    const amt = Number(t.amount) || 0;
    entry.total += amt;
    entry.byMonth[key] = (entry.byMonth[key] || 0) + amt;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
});

// ✅ Высота графика и максимальное значение
const maxValue = computed(() => {
  let max = 1;
  for (const c of categories.value) {
    for (const m of months.value) {
      const v = c.byMonth[m.key] || 0;
      if (v > max) max = v;
    }
  }
  return max;
});

// ✅ Палитра для категорий
const PALETTE = [
  '#a855f7', '#ec4899', '#06b6d4', '#10b981',
  '#f59e0b', '#f43f5e', '#8b5cf6', '#22d3ee',
  '#84cc16', '#fb923c', '#e11d48', '#14b8a6',
  '#fbbf24', '#3b82f6', '#d946ef', '#0ea5e9',
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

  const padL = 48, padR = 16, padT = 20, padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Сетка и Y
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

  // ✅ Группы по месяцам
  const groupCount = months.value.length;
  const groupW = chartW / groupCount;
  const catCount = categories.value.length;

  if (catCount === 0) return;

  // Ширина столбиков внутри месяца
  const gapBetweenGroups = 16;
  const usableGroupW = groupW - gapBetweenGroups;
  const barW = Math.max(4, Math.min(28, usableGroupW / catCount - 2));
  const totalBarsW = barW * catCount + (catCount - 1) * 2;
  const startX = padL + (groupW - totalBarsW) / 2 + gapBetweenGroups / 2;

  // ✅ Рисуем столбики
  months.value.forEach((m, mi) => {
    const groupStartX = padL + groupW * mi + (groupW - totalBarsW) / 2;

    categories.value.forEach((c, ci) => {
      const value = c.byMonth[m.key] || 0;
      if (value <= 0) return;

      const barH = (value / maxValue.value) * chartH;
      const x = groupStartX + ci * (barW + 2);
      const y = padT + chartH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
      const col = colorFor(ci);
      grad.addColorStop(0, col);
      grad.addColorStop(1, col + '80');

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(4, barW / 2, barH / 2);
      // roundRect с fallback
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, barH, r);
      } else {
        ctx.rect(x, y, barW, barH);
      }
      ctx.fill();
    });

    // ✅ Подпись месяца под группой
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelX = padL + groupW * mi + groupW / 2;
    ctx.fillText(m.label, labelX, padT + chartH + 10);
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

watch([categories, mode, months], () => {
  nextTick(draw);
}, { deep: true });
</script>

<template>
  <section class="ie-chart">
    <header class="ie-head">
      <h2 class="ie-title">📈 Анализ за 3 месяца</h2>

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

    <!-- ✅ Легенда категорий с горизонтальным скроллом -->
    <div v-if="categories.length > 0" class="ie-legend">
      <div
        v-for="(c, i) in categories"
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
      </div>
    </div>

    <div v-else class="ie-empty">
      Нет данных за последние 3 месяца
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

.ie-empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  margin-bottom: 8px;
}

.ie-canvas-wrap {
  height: 240px;
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
  .ie-canvas-wrap { height: 200px; }
  .ie-legend-item { font-size: 10px; padding: 3px 6px; }
}
</style>