<!-- frontend/src/components/analytics/FinancialAssistant.vue -->
<script setup>
import { computed } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { useGoalsStore } from '@/stores/goals';
import { fmt } from '@/composables/useFormat';

const analytics = useAnalyticsStore();
const goals = useGoalsStore();
const metrics = computed(() => analytics.currentMonthMetrics);

const tips = computed(() => {
  const m = metrics.value;
  const list = [];

  if (m.monthExpense > m.monthIncome && m.monthIncome > 0) {
    const overspend = m.monthExpense - m.monthIncome;
    list.push({
      id: 'overspend', type: 'danger', icon: '⚠️',
      title: 'Перерасход бюджета',
      text: `Ты потратил на ${fmt(overspend)} ₽ больше, чем заработал. Попробуй сократить необязательные расходы.`,
    });
  }

  if (m.runway < 3 && m.avgExpense > 0) {
    list.push({
      id: 'runway', type: 'warning', icon: '🛡️',
      title: 'Маленькая подушка',
      text: `Резерв покрывает только ${m.runway.toFixed(1)} мес. Цель — минимум 3–6 месяцев расходов.`,
    });
  }

  if (m.monthIncome > 0 && m.realFree <= 0) {
    list.push({
      id: 'nosave', type: 'warning', icon: '💰',
      title: 'Не откладываешь',
      text: `По итогам месяца свободных денег нет. Попробуй правило «сначала заплати себе» — сразу откладывай 10%.`,
    });
  }

  if (m.realFree > 0 && m.monthIncome > 0) {
    const pct = (m.realFree / m.monthIncome) * 100;
    if (pct >= 20) {
      list.push({
        id: 'goodsave', type: 'success', icon: '✅',
        title: 'Отличная норма сбережений',
        text: `Свободно ${pct.toFixed(0)}% от дохода. Так держать! Отложи эти деньги в цель или на подушку.`,
      });
    } else if (pct >= 10) {
      list.push({
        id: 'oksave', type: 'info', icon: '👍',
        title: 'Хороший результат',
        text: `Свободно ${pct.toFixed(0)}% от дохода. Можно увеличить до 20% и ускорить накопления.`,
      });
    }
  }

  const primary = goals.primaryGoal;
  if (primary && !primary.done) {
    const monthsLeft = m.monthSave > 0
      ? Math.ceil(primary.left / m.monthSave)
      : null;
    list.push({
      id: 'goal', type: 'info', icon: primary.emoji || '🎯',
      title: `Цель «${primary.name}»`,
      text: monthsLeft
        ? `Осталось ${fmt(primary.left)} ₽. При откладывании ${fmt(m.monthSave)} ₽/мес — примерно ${monthsLeft} мес.`
        : `Осталось ${fmt(primary.left)} ₽. Откладывай регулярно, чтобы быстрее достичь.`,
    });
  }

  const dayAvg = m.dailyAvg;
  if (dayAvg > 0 && m.monthExpense > 0) {
    const pct = (dayAvg / m.monthExpense) * 100;
    if (pct > 4) {
      list.push({
        id: 'daily', type: 'info', icon: '🔥',
        title: 'Ежедневные траты',
        text: `Средний расход ${fmt(dayAvg)} ₽/день. Один «лишний» поход в кафе в день — это ${fmt(dayAvg * 30)} ₽/мес.`,
      });
    }
  }

  if (list.length === 0) {
    list.push({
      id: 'default', type: 'info', icon: '👋',
      title: 'Привет!',
      text: 'Добавь больше операций, чтобы получить персональные советы по бюджету.',
    });
  }

  return list.slice(0, 5);
});

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
/* ✅ ХАРДКОД ТЁМНОЙ ТЕМЫ — не зависит от глобальной */
.assistant-card {
  padding: 16px 18px;
  border-radius: 18px;
  /* жёсткий тёмный фон */
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
  color: #ffffff !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 12px 32px -10px rgba(139, 92, 246, 0.35);
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
  color: #ffffff;
  letter-spacing: 0.02em;
}
.ac-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
  margin-top: 1px;
}

.ac-forecast {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;

  &.warn {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  &.ok {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.35);
  }
}

.acf-icon { font-size: 20px; flex-shrink: 0; }
.acf-body { min-width: 0; flex: 1; }
.acf-title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 3px;
  color: #ffffff;

  .ac-forecast.warn & { color: #fca5a5; }
  .ac-forecast.ok & { color: #86efac; }
}
.acf-text {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;

  strong {
    font-family: var(--mono);
    font-weight: 800;
    color: #ffffff;
  }
}

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
  /* тёмные полупрозрачные */
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform 0.15s;

  &:hover { transform: translateX(2px); }

  &.danger {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
  }
  &.warning {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
  }
  &.success {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.3);
  }
  &.info {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.25);
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
  color: #ffffff;
  margin-bottom: 3px;
}
.tip-text {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.45;
}

@media (max-width: 700px) {
  .assistant-card { padding: 14px 16px; border-radius: 14px; }
  .ac-head-icon { width: 32px; height: 32px; font-size: 16px; }
  .ac-title { font-size: 12px; }
  .ac-sub { font-size: 10.5px; }
  .tip-title { font-size: 11.5px; }
  .tip-text { font-size: 11px; }
}
</style>