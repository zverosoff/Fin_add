<script setup>
import { computed } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { useAccountsStore } from '@/stores/accounts';
import { useGoalsStore } from '@/stores/goals';
import { fmt } from '@/composables/useFormat';

const analytics = useAnalyticsStore();
const accounts = useAccountsStore();
const goals = useGoalsStore();

const metrics = computed(() => analytics.currentMonthMetrics);

// ✅ Генерируем советы на основе метрик
const tips = computed(() => {
  const m = metrics.value;
  const list = [];

  // Расход > доход
  if (m.monthExpense > m.monthIncome && m.monthIncome > 0) {
    const overspend = m.monthExpense - m.monthIncome;
    list.push({
      id: 'overspend',
      type: 'danger',
      icon: '⚠️',
      title: 'Перерасход бюджета',
      text: `Ты потратил на ${fmt(overspend)} ₽ больше, чем заработал. Попробуй сократить необязательные расходы.`,
    });
  }

  // Нет подушки
  if (m.runway < 3 && m.avgExpense > 0) {
    list.push({
      id: 'runway',
      type: 'warning',
      icon: '🛡️',
      title: 'Маленькая подушка',
      text: `Резерв покрывает только ${m.runway.toFixed(1)} мес. Цель — минимум 3–6 месяцев расходов.`,
    });
  }

  // Норма сбережений низкая
  if (m.monthIncome > 0 && m.realFree <= 0) {
    list.push({
      id: 'nosave',
      type: 'warning',
      icon: '💰',
      title: 'Не откладываешь',
      text: `По итогам месяца свободных денег нет. Попробуй правило «сначала заплати себе» — сразу откладывай 10%.`,
    });
  }

  // Хорошая норма
  if (m.realFree > 0 && m.monthIncome > 0) {
    const pct = (m.realFree / m.monthIncome) * 100;
    if (pct >= 20) {
      list.push({
        id: 'goodsave',
        type: 'success',
        icon: '✅',
        title: 'Отличная норма сбережений',
        text: `Свободно ${pct.toFixed(0)}% от дохода. Так держать! Отложи эти деньги в цель или на подушку.`,
      });
    } else if (pct >= 10) {
      list.push({
        id: 'oksave',
        type: 'info',
        icon: '👍',
        title: 'Хороший результат',
        text: `Свободно ${pct.toFixed(0)}% от дохода. Можно увеличить до 20% и ускорить накопления.`,
      });
    }
  }

  // Есть основная цель — прогресс
  const primary = goals.primaryGoal;
  if (primary && !primary.done) {
    const monthsLeft = m.monthSave > 0
      ? Math.ceil(primary.left / m.monthSave)
      : null;
    list.push({
      id: 'goal',
      type: 'info',
      icon: primary.emoji || '🎯',
      title: `Цель «${primary.name}»`,
      text: monthsLeft
        ? `Осталось ${fmt(primary.left)} ₽. При откладывании ${fmt(m.monthSave)} ₽/мес — примерно ${monthsLeft} мес.`
        : `Осталось ${fmt(primary.left)} ₽. Откладывай регулярно, чтобы быстрее достичь.`,
    });
  }

  // Много мелких расходов
  const dayAvg = m.dailyAvg;
  if (dayAvg > 0 && m.monthExpense > 0) {
    const pct = (dayAvg / m.monthExpense) * 100;
    if (pct > 4) {
      list.push({
        id: 'daily',
        type: 'info',
        icon: '🔥',
        title: 'Ежедневные траты',
        text: `Средний расход ${fmt(dayAvg)} ₽/день. Один «лишний» поход в кафе в день — это ${fmt(dayAvg * 30)} ₽/мес.`,
      });
    }
  }

  // Всё хорошо
  if (list.length === 0) {
    list.push({
      id: 'default',
      type: 'info',
      icon: '👋',
      title: 'Привет!',
      text: 'Добавь больше операций, чтобы получить персональные советы по бюджету.',
    });
  }

  return list.slice(0, 5);
});

// ✅ Прогноз
const forecast = computed(() => {
  const m = metrics.value;
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();

  if (dayOfMonth < 3 || m.monthExpense === 0) return null;

  const projected = (m.monthExpense / dayOfMonth) * daysInMonth;
  const diff = projected - m.monthIncome;
  return {
    projected,
    diff,
    daysLeft: daysInMonth - dayOfMonth,
  };
});
</script>

<template>
  <section class="assistant-card">
    <header class="ac-head">
      <div class="ac-head-icon">🧠</div>
      <div class="ac-head-text">
        <div class="ac-title">Финансовый помощник</div>
        <div class="ac-sub">Персональные советы</div>
      </div>
    </header>

    <!-- Прогноз месяца -->
    <div v-if="forecast" class="ac-forecast" :class="forecast.diff > 0 ? 'warn' : 'ok'">
      <div class="acf-icon">{{ forecast.diff > 0 ? '📉' : '📈' }}</div>
      <div class="acf-body">
        <div class="acf-title">
          {{ forecast.diff > 0 ? 'Риск перерасхода' : 'Прогноз в норме' }}
        </div>
        <div class="acf-text">
          К концу месяца расходы составят ≈ <strong>{{ fmt(forecast.projected) }} ₽</strong>
          <template v-if="forecast.diff > 0">
            , это на <strong>{{ fmt(forecast.diff) }} ₽</strong> больше дохода.
          </template>
          <template v-else>
            — укладываешься в доход.
          </template>
        </div>
      </div>
    </div>

    <!-- Советы -->
    <div class="ac-tips">
      <article
        v-for="tip in tips"
        :key="tip.id"
        class="ac-tip"
        :class="tip.type"
      >
        <div class="tip-icon">{{ tip.icon }}</div>
        <div class="tip-body">
          <div class="tip-title">{{ tip.title }}</div>
          <div class="tip-text">{{ tip.text }}</div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
.assistant-card {
  padding: 16px 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.06), transparent 60%),
    rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  animation: cardEnter 0.55s cubic-bezier(.34,1.56,.64,1) both;
}

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(16px) scale(0.95); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.ac-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.ac-head-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: 0 6px 16px -8px rgba(99, 102, 241, 0.7);
}

.ac-head-text { min-width: 0; }
.ac-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.02em;
}
.ac-sub {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  margin-top: 1px;
}

/* Прогноз */
.ac-forecast {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;

  &.warn {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  &.ok {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
}

.acf-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.acf-body { min-width: 0; flex: 1; }
.acf-title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 3px;

  .ac-forecast.warn & { color: #dc2626; }
  .ac-forecast.ok & { color: #16a34a; }
}
.acf-text {
  font-size: 11.5px;
  color: var(--text);
  line-height: 1.4;

  strong {
    font-family: var(--mono);
    font-weight: 800;
  }
}

/* Советы */
.ac-tips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ac-tip {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #ffffff;
  transition: transform 0.15s;

  &:hover { transform: translateX(2px); }

  &.danger {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.05);
  }
  &.warning {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.05);
  }
  &.success {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.05);
  }
  &.info {
    border-color: rgba(59, 130, 246, 0.25);
    background: rgba(59, 130, 246, 0.04);
  }
}

.tip-icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1.2;
}

.tip-body { min-width: 0; flex: 1; }
.tip-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 3px;
}
.tip-text {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.45;
}

@media (max-width: 700px) {
  .assistant-card { padding: 12px 14px; border-radius: 14px; }
  .ac-head-icon { width: 32px; height: 32px; font-size: 16px; }
  .ac-title { font-size: 12px; }
  .ac-sub { font-size: 10.5px; }
  .tip-title { font-size: 11.5px; }
  .tip-text { font-size: 11px; }
}
</style>