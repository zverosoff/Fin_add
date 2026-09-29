<script setup>
import { computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useGoalsStore } from '@/stores/goals';
import { fmt } from '@/composables/useFormat';
import CashModal from '@/components/transactions/CashModal.vue';

const accounts = useAccountsStore();
const goalsStore = useGoalsStore();

const cashModalOpen = ref(false);
const cashModalOwner = ref('');
const cashModalMode = ref('add');

// ✅ Всего наличных
const totalCash = computed(() => accounts.totalCash);

// ✅ Основная цель (одна из goals с флагом primary)
const primaryGoal = computed(() =>
  goalsStore.enrichedGoals.find(g => g.primary) || null
);

// ✅ Прогресс основной цели: сколько уже есть наличных / target
const primaryProgress = computed(() => {
  const g = primaryGoal.value;
  if (!g || !g.target) return 0;
  return Math.min(100, (totalCash.value / g.target) * 100);
});

// ✅ Осталось накопить
const primaryLeft = computed(() => {
  const g = primaryGoal.value;
  if (!g) return 0;
  return Math.max(0, g.target - totalCash.value);
});

// ✅ Второстепенные цели (без основной), максимум 4
const secondaryGoals = computed(() =>
  goalsStore.enrichedGoals
    .filter(g => !g.primary)
    .slice(0, 4)
);

// ✅ Прогресс второстепенной цели — тоже относительно totalCash
function goalProgress(goal) {
  if (!goal.target) return 0;
  return Math.min(100, (totalCash.value / goal.target) * 100);
}

function openModal(owner = '', mode = 'add') {
  cashModalOwner.value = owner;
  cashModalMode.value = mode;
  cashModalOpen.value = true;
}

// Заглушка — открывает модалку целей на странице аналитики
function goToGoals() {
  // ничего не делаем — цель задаётся в разделе «Аналитика → Цели»
  // если хочешь — можно emit и роутить
}
</script>

<template>
  <section class="cash-block">
    <div class="cash-note">
      <div class="cn-pattern"></div>
      <div class="cn-watermark">₽</div>

      <div class="cn-top">
        <div class="cn-nominal">
          <span class="cn-icon">💵</span>
          <span class="cn-label">НАЛИЧНЫЕ</span>
        </div>
        <div class="cn-total">
          <div class="cn-total-value">{{ fmt(totalCash) }} ₽</div>
          <div class="cn-total-label">всего на руках</div>
        </div>
      </div>

      <!-- ✅ ОСНОВНАЯ ЦЕЛЬ -->
      <div class="cn-goal">
        <template v-if="primaryGoal">
          <div class="cn-goal-head">
            <span class="cn-goal-icon">{{ primaryGoal.emoji || '🎯' }}</span>
            <span class="cn-goal-title">Основная цель</span>
          </div>
          <div class="cn-goal-name">{{ primaryGoal.name }}</div>
          <div class="cn-goal-track">
            <div
              class="cn-goal-fill"
              :style="{ width: primaryProgress + '%' }"
            ></div>
          </div>
          <div class="cn-goal-meta">
            <span class="cn-goal-pct">{{ primaryProgress.toFixed(0) }}%</span>
            <span class="cn-goal-hint">
              Вы скоро накопите! Осталось {{ fmt(primaryLeft) }} ₽
            </span>
          </div>
        </template>
        <template v-else>
          <div class="cn-goal-empty">
            <span class="cn-goal-empty-icon">🎯</span>
            <span class="cn-goal-empty-text">Основная цель не задана</span>
          </div>
        </template>
      </div>

      <!-- ✅ ВТОРОСТЕПЕННЫЕ ЦЕЛИ -->
      <div v-if="secondaryGoals.length" class="cn-secondary">
        <div class="cn-secondary-title">Другие цели</div>
        <div
          v-for="g in secondaryGoals"
          :key="g.id"
          class="cn-secondary-item"
        >
          <div class="cn-secondary-head">
            <span class="cn-secondary-icon">{{ g.emoji || '🎯' }}</span>
            <span class="cn-secondary-name">{{ g.name }}</span>
            <span class="cn-secondary-pct">{{ goalProgress(g).toFixed(0) }}%</span>
          </div>
          <div class="cn-secondary-track">
            <div
              class="cn-secondary-fill"
              :style="{ width: goalProgress(g) + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <div class="cn-actions">
        <button class="cn-act cn-act-primary" type="button" @click="openModal('', 'add')">
          <span class="cn-act-icon">＋</span>
          <span>Добавить</span>
        </button>
        <button class="cn-act" type="button" @click="openModal('', 'withdraw')">
          <span class="cn-act-icon">−</span>
          <span>Убрать</span>
        </button>
        <button class="cn-act" type="button" @click="openModal('', 'set')">
          <span class="cn-act-icon">⚖️</span>
          <span>Сверка</span>
        </button>
      </div>
    </div>

    <CashModal
      v-model="cashModalOpen"
      :owner="cashModalOwner"
      :initial-mode="cashModalMode"
    />
  </section>
</template>

<style scoped lang="scss">
.cash-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ============================================================
   КУПЮРА
   ============================================================ */
.cash-note {
  position: relative;
  border-radius: 18px;
  padding: 18px 20px 16px;
  overflow: hidden;

  background:
    radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.35), transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(255, 255, 255, 0.25), transparent 45%),
    linear-gradient(135deg, #059669 0%, #10b981 40%, #34d399 70%, #059669 100%);
  background-size: 100% 100%, 100% 100%, 300% 300%;
  animation: cashShift 14s ease-in-out infinite;

  color: #ffffff;
  box-shadow:
    0 20px 40px -18px rgba(16, 185, 129, 0.6),
    0 10px 20px -10px rgba(5, 150, 105, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.15);
}

@keyframes cashShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

.cash-note::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 14px;
  border: 1.5px dashed rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.cn-watermark {
  position: absolute;
  right: -10px;
  bottom: -30px;
  font-size: 140px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.08);
  line-height: 1;
  pointer-events: none;
  user-select: none;
  font-family: var(--mono);
}

.cn-pattern {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg,
      rgba(255, 255, 255, 0.04) 0 2px,
      transparent 2px 8px);
  pointer-events: none;
}

.cn-top {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.cn-nominal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.cn-icon { font-size: 16px; }

.cn-label {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cn-total { text-align: right; }

.cn-total-value {
  font-family: var(--mono);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.cn-total-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.85;
  margin-top: 2px;
}

/* ============================================================
   ОСНОВНАЯ ЦЕЛЬ
   ============================================================ */
.cn-goal {
  position: relative;
  margin: 4px 0 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cn-goal-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cn-goal-icon {
  font-size: 14px;
  line-height: 1;
}

.cn-goal-title {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.8;
}

.cn-goal-name {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cn-goal-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  overflow: hidden;
}

.cn-goal-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #fbbf24, #fde68a);
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
  transition: width 0.5s cubic-bezier(.22,.61,.36,1);
}

.cn-goal-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  flex-wrap: wrap;
}

.cn-goal-pct {
  font-family: var(--mono);
  font-weight: 800;
  font-size: 11.5px;
  color: #fde68a;
}

.cn-goal-hint {
  font-weight: 600;
  opacity: 0.85;
}

.cn-goal-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.8;
}

.cn-goal-empty-icon { font-size: 14px; }
.cn-goal-empty-text { font-style: italic; }

/* ============================================================
   ДРУГИЕ ЦЕЛИ (компактно)
   ============================================================ */
.cn-secondary {
  position: relative;
  margin-bottom: 12px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.25);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cn-secondary-title {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.7;
}

.cn-secondary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cn-secondary-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
}

.cn-secondary-icon { font-size: 12px; }

.cn-secondary-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.92;
}

.cn-secondary-pct {
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 800;
  color: #fde68a;
  flex-shrink: 0;
}

.cn-secondary-track {
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

.cn-secondary-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #6ee7b7, #a7f3d0);
  transition: width 0.5s cubic-bezier(.22,.61,.36,1);
}

/* ============================================================
   КНОПКИ
   ============================================================ */
.cn-actions {
  position: relative;
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 6px;
  margin-top: 12px;
}

.cn-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -6px rgba(0, 0, 0, 0.35);
  }
  &:active { transform: scale(0.96); }

  &.cn-act-primary {
    background: rgba(255, 255, 255, 0.95);
    color: #047857;
    border-color: transparent;
    font-weight: 800;

    &:hover {
      background: #ffffff;
      color: #065f46;
    }
  }
}

.cn-act-icon {
  font-size: 13px;
  line-height: 1;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .cash-note {
    padding: 14px 16px 12px;
    border-radius: 16px;
  }

  .cn-total-value { font-size: 22px; }
  .cn-total-label { font-size: 9px; }
  .cn-label { font-size: 9.5px; letter-spacing: 0.1em; }
  .cn-icon { font-size: 14px; }

  .cn-goal { padding: 10px 12px; margin: 4px 0 10px; }
  .cn-goal-name { font-size: 12.5px; }
  .cn-goal-title { font-size: 9px; }
  .cn-goal-meta { font-size: 10px; }
  .cn-goal-pct { font-size: 11px; }

  .cn-secondary-item { gap: 3px; }
  .cn-secondary-head { font-size: 11px; }
  .cn-secondary-pct { font-size: 10px; }

  .cn-actions { gap: 5px; margin-top: 10px; }
  .cn-act { padding: 7px 4px; font-size: 10.5px; gap: 4px; }
  .cn-act-icon { font-size: 12px; }

  .cn-watermark { font-size: 110px; bottom: -24px; right: -8px; }
}

@media (max-width: 380px) {
  .cn-total-value { font-size: 19px; }
  .cn-act { font-size: 10px; }
  .cn-goal-name { font-size: 11.5px; }
}
</style>