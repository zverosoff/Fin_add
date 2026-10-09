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

const tips = computed(() => {
  const m = metrics.value;
  const list = [];

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

  if (m.runway < 3 && m.avgExpense > 0) {
    list.push({
      id: 'runway',
      type: 'warning',
      icon: '🛡️',
      title: 'Маленькая подушка',
      text: `Резерв покрывает только ${m.runway.toFixed(1)} мес. Цель — минимум 3–6 месяцев расходов.`,
    });
  }

  if (m.monthIncome > 0 && m.realFree <= 0) {
    list.push({
      id: 'nosave',
      type: 'warning',
      icon: '💰',
      title: 'Не откладываешь',
      text: `По итогам месяца свободных денег нет. Попробуй правило «сначала заплати себе» — сразу откладывай 10%.`,
    });
  }

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
.assistant-card {
  padding: 16px 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.06), transparent 60%),
    var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  animation: cardEnter 0.55s cubic-bezier(.34,1.56,.64,1) both;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
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
  background: var(--grad-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.2) inset,
    0 6px 16px -6px rgba(139, 92, 246, 0.7);
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

.ac-forecast {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;

  &.warn {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.3);
  }
  &.ok {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
}

.acf-icon { font-size: 20px; flex-shrink: 0; }

.acf-body { min-width: 0; flex: 1; }
.acf-title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 3px;

  .ac-forecast.warn & { color: var(--danger, #dc2626); }
  .ac-forecast.ok & { color: var(--accent-2, #16a34a); }
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
  background: var(--panel-2);
  transition: transform 0.15s, background 0.3s, border-color 0.3s;

  &:hover { transform: translateX(2px); }

  &.danger {
    border-color: rgba(244, 63, 94, 0.35);
    background: rgba(244, 63, 94, 0.05);
  }
  &.warning {
    border-color: rgba(251, 191, 36, 0.35);
    background: rgba(251, 191, 36, 0.05);
  }
  &.success {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.05);
  }
  &.info {
    border-color: rgba(139, 92, 246, 0.25);
    background: rgba(139, 92, 246, 0.04);
  }
}

.tip-icon { font-size: 20px; flex-shrink: 0; line-height: 1.2; }
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

/* Тёмная тема */
:global(:root[data-app-theme="dark"]) {
  .assistant-card {
    background:
      radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.15), transparent 60%),
      linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.35),
      0 12px 28px -8px rgba(139, 92, 246, 0.25),
      0 0 0 1px rgba(139, 92, 246, 0.08) inset;
  }

  .ac-forecast {
    &.warn {
      background: rgba(244, 63, 94, 0.12);
      border-color: rgba(244, 63, 94, 0.4);
      box-shadow: 0 0 20px -6px rgba(244, 63, 94, 0.3);
    }
    &.ok {
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(74, 222, 128, 0.4);
      box-shadow: 0 0 20px -6px rgba(74, 222, 128, 0.3);
    }
  }

  .acf-title {
    .ac-forecast.warn & { color: #f43f5e; text-shadow: 0 0 10px rgba(244, 63, 94, 0.4); }
    .ac-forecast.ok & { color: #4ade80; text-shadow: 0 0 10px rgba(74, 222, 128, 0.4); }
  }

  .ac-tip {
    background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
    border-color: rgba(139, 92, 246, 0.15);

    &.danger {
      border-color: rgba(244, 63, 94, 0.4);
      background: rgba(244, 63, 94, 0.08);
    }
    &.warning {
      border-color: rgba(251, 191, 36, 0.4);
      background: rgba(251, 191, 36, 0.08);
    }
    &.success {
      border-color: rgba(74, 222, 128, 0.4);
      background: rgba(34, 197, 94, 0.08);
    }
    &.info {
      border-color: rgba(168, 85, 247, 0.3);
      background: rgba(139, 92, 246, 0.08);
    }
  }
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