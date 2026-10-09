<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useGoalsStore } from '@/stores/goals';
import { useAuthStore } from '@/stores/auth';
import { fmt } from '@/composables/useFormat';
import CashModal from '@/components/transactions/CashModal.vue';

const accounts = useAccountsStore();
const goalsStore = useGoalsStore();
const auth = useAuthStore();

const LS_KEY = 'financeProCashCollapsed_v1';

const collapsed = ref(false);

onMounted(() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) collapsed.value = saved === '1';
  } catch (e) {}
});

watch(collapsed, (val) => {
  try { localStorage.setItem(LS_KEY, val ? '1' : '0'); } catch (e) {}
});

function toggle() { collapsed.value = !collapsed.value; }

const cashModalOpen = ref(false);
const cashModalOwner = ref('');
const cashModalMode = ref('add');

const totalBalance = computed(() => accounts.totalCash);

const owners = computed(() =>
  ['Сергей', 'Саша'].map(owner => ({
    owner,
    displayName: auth.nameFor(owner),
    emoji: owner === 'Сергей' ? '👨' : '👩',
    balance: accounts.getCash(owner),
  }))
);

// ============================================================
// ОСНОВНАЯ ЦЕЛЬ — учитываем наличные как накопления
// ============================================================
const cashInWallets = computed(() => accounts.totalCash);

const goalContributionsSum = computed(() => {
  const goal = goalsStore.primaryGoal;
  if (!goal) return 0;
  return Object.values(goal.contributions ?? {})
    .reduce((s, v) => s + (Number(v) || 0), 0);
});

const totalSaved = computed(() =>
  cashInWallets.value + goalContributionsSum.value
);

const remaining = computed(() => {
  const goal = goalsStore.primaryGoal;
  if (!goal) return 0;
  return Math.max(0, (Number(goal.target) || 0) - totalSaved.value);
});

const progressPct = computed(() => {
  const goal = goalsStore.primaryGoal;
  if (!goal) return 0;
  const target = Number(goal.target) || 0;
  if (target <= 0) return 0;
  return Math.min(100, (totalSaved.value / target) * 100);
});

const isDone = computed(() => progressPct.value >= 100);

function openModal(owner = '', mode = 'add') {
  cashModalOwner.value = owner;
  cashModalMode.value = mode;
  cashModalOpen.value = true;
}

// Купюры
const fallingBills = [
  { id: 1,  left: '6%',   delay: '0s',    duration: '14s', rotate: -12, scale: 0.75 },
  { id: 2,  left: '18%',  delay: '2.5s',  duration: '18s', rotate: 8,   scale: 0.9 },
  { id: 3,  left: '32%',  delay: '5s',    duration: '12s', rotate: -20, scale: 0.7 },
  { id: 4,  left: '48%',  delay: '1.2s',  duration: '16s', rotate: 15,  scale: 1 },
  { id: 5,  left: '62%',  delay: '3.8s',  duration: '20s', rotate: -8,  scale: 0.85 },
  { id: 6,  left: '76%',  delay: '6.5s',  duration: '13s', rotate: 22,  scale: 0.72 },
  { id: 7,  left: '88%',  delay: '0.8s',  duration: '17s', rotate: -14, scale: 0.95 },
  { id: 8,  left: '25%',  delay: '7.2s',  duration: '15s', rotate: 10,  scale: 0.8 },
  { id: 9,  left: '55%',  delay: '8s',    duration: '19s', rotate: -18, scale: 0.75 },
  { id: 10, left: '70%',  delay: '4.5s',  duration: '11s', rotate: 6,   scale: 0.9 },
];
</script>

<template>
  <section class="cash-block">
    <div class="cash-note" :class="{ collapsed }">
      <div class="cn-falling" aria-hidden="true">
        <div
          v-for="b in fallingBills"
          :key="b.id"
          class="cn-bill"
          :style="{
            left: b.left,
            animationDelay: b.delay,
            animationDuration: b.duration,
            '--rot': b.rotate + 'deg',
            '--scale': b.scale,
          }"
        >
          <svg viewBox="0 0 40 24" class="cn-bill-svg">
            <rect x="1" y="1" width="38" height="22" rx="2.5"
                  fill="none" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="20" cy="12" r="4"
                    fill="none" stroke="currentColor" stroke-width="0.9"/>
            <text x="20" y="15.5" text-anchor="middle"
                  font-size="6.5" font-weight="800"
                  fill="currentColor"
                  font-family="Arial, sans-serif">₽</text>
            <path d="M4 20 L6 4 M8 20 L10 4 M30 20 L32 4 M34 20 L36 4"
                  stroke="currentColor" stroke-width="0.4" opacity="0.6"/>
          </svg>
        </div>
      </div>

      <div class="cn-pattern"></div>
      <div class="cn-watermark">₽</div>

      <!-- ✅ ЗАГОЛОВОК: клик = свернуть/развернуть. Шрифт — Inter (как у всего приложения) -->
      <div
        class="cn-header"
        @click="toggle"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsed"
        @keydown.enter="toggle"
        @keydown.space.prevent="toggle"
      >
        <div class="cn-header-left">
          <span class="cn-header-icon">💵</span>
          <div class="cn-header-titles">
            <span class="cn-header-title">НАЛИЧНЫЕ</span>
            <span class="cn-header-sub">БИЛЕТ БАНКА · РУБЛЬ</span>
          </div>
        </div>

        <div class="cn-header-right">
          <div class="cn-header-value">{{ fmt(totalBalance) }} ₽</div>
          <div class="cn-header-label">всего на руках</div>
        </div>
      </div>

      <!-- ✅ Сворачиваемое содержимое -->
      <div class="cn-collapsible">
        <div class="cn-collapsible-inner">
          <div class="cn-owners">
            <div
              v-for="o in owners"
              :key="o.owner"
              class="cn-owner"
            >
              <span class="cn-owner-emoji">{{ o.emoji }}</span>
              <span class="cn-owner-name">{{ o.displayName }}</span>
              <span class="cn-owner-value">{{ fmt(o.balance) }} ₽</span>
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

          <!-- ОСНОВНАЯ ЦЕЛЬ -->
          <div v-if="goalsStore.primaryGoal" class="cn-goal" :class="{ done: isDone }">
            <div class="cn-goal-head">
              <span class="cn-goal-emoji">{{ goalsStore.primaryGoal.emoji || '🎯' }}</span>
              <span class="cn-goal-name">{{ goalsStore.primaryGoal.name }}</span>
              <span class="cn-goal-badge" :class="{ done: isDone }">
                {{ isDone ? '✅' : '⭐' }}
              </span>
            </div>

            <div class="cn-goal-progress">
              <div class="cn-goal-track">
                <div
                  class="cn-goal-fill"
                  :class="{ done: isDone }"
                  :style="{ width: progressPct + '%' }"
                ></div>
              </div>
              <div class="cn-goal-info">
                <span class="cn-goal-left">
                  {{ isDone ? 'Цель достигнута!' : `Осталось ${fmt(remaining)} ₽` }}
                </span>
                <span class="cn-goal-target">из {{ fmt(goalsStore.primaryGoal.target) }} ₽</span>
              </div>
            </div>
          </div>
        </div>
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
   Купюра — многослойная тень + объём
   ============================================================ */
.cash-note {
  position: relative;
  border-radius: 20px;
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
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -1px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(16, 185, 129, 0.25),
    0 10px 24px -6px rgba(5, 150, 105, 0.35),
    0 20px 40px -12px rgba(16, 185, 129, 0.3);

  transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), box-shadow 0.35s ease;
}

/* ✅ Свёрнутое состояние: вертикально центрируем содержимое, убираем padding снизу */
.cash-note.collapsed {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  min-height: 72px;
}

.cash-note:hover {
  transform: translateY(-2px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 -1px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 12px rgba(16, 185, 129, 0.3),
    0 16px 36px -8px rgba(5, 150, 105, 0.45),
    0 28px 56px -16px rgba(16, 185, 129, 0.35);
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
  border-radius: 16px;
  border: 1.5px dashed rgba(255, 255, 255, 0.35);
  pointer-events: none;
  z-index: 4;
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
  z-index: 0;
}

.cn-pattern {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg,
      rgba(255, 255, 255, 0.04) 0 2px,
      transparent 2px 8px);
  pointer-events: none;
  z-index: 1;
}

.cn-falling {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
  mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
}

.cn-bill {
  position: absolute;
  top: -40px;
  width: 44px;
  height: 26px;
  color: rgba(255, 255, 255, 0.35);
  opacity: 0;
  animation-name: billFall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-fill-mode: both;
  will-change: transform, opacity;
}

.cn-bill-svg {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
}

@keyframes billFall {
  0%   { transform: translate3d(0, -20px, 0) rotate(var(--rot, 0deg)) scale(var(--scale, 1)); opacity: 0; }
  8%   { opacity: 0.85; }
  50%  { transform: translate3d(14px, 55vh, 0) rotate(calc(var(--rot, 0deg) + 15deg)) scale(var(--scale, 1)); opacity: 0.75; }
  92%  { opacity: 0.5; }
  100% { transform: translate3d(-10px, 110%, 0) rotate(calc(var(--rot, 0deg) - 20deg)) scale(var(--scale, 1)); opacity: 0; }
}

/* ============================================================
   ✅ ЗАГОЛОВОК — шрифт Inter как у всего приложения.
   В свёрнутом состоянии — вертикальное центрирование.
   ============================================================ */
.cn-header {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
  transition: transform 0.2s ease;
}

.cn-header:hover { transform: translateY(-1px); }

.cn-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cn-header-icon {
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
  flex-shrink: 0;
}

.cn-header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cn-header-title {
  font-family: inherit;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 0 16px rgba(255, 255, 255, 0.25);
  line-height: 1.1;
  white-space: nowrap;
}

.cn-header-sub {
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1;
  white-space: nowrap;
}

.cn-header-right {
  text-align: right;
  flex-shrink: 0;
}

.cn-header-value {
  font-family: var(--mono);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    0 0 20px rgba(255, 255, 255, 0.15);
  white-space: nowrap;
}

.cn-header-label {
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.85;
  margin-top: 2px;
  white-space: nowrap;
}

/* ✅ В свёрнутом состоянии header растягивается по вертикали родителя */
.cash-note.collapsed .cn-header {
  flex: 1;
  width: 100%;
  padding: 0;
}

/* ============================================================
   ✅ СВОРАЧИВАЕМОЕ СОДЕРЖИМОЕ
   ============================================================ */
.cn-collapsible {
  position: relative;
  z-index: 3;
  max-height: 600px;
  opacity: 1;
  overflow: hidden;
  margin-top: 12px;
  transition:
    max-height 0.4s cubic-bezier(.22,.61,.36,1),
    opacity 0.3s ease,
    margin 0.35s ease;
}

.cash-note.collapsed .cn-collapsible {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}

.cn-collapsible-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 6px;
}

/* ============================================================
   ПОЛЬЗОВАТЕЛИ
   ============================================================ */
.cn-owners {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.25);
}

.cn-owner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.2) inset,
    0 -1px 0 rgba(0, 0, 0, 0.06) inset,
    0 2px 6px rgba(0, 0, 0, 0.06);
}

.cn-owner-emoji { font-size: 16px; line-height: 1; }

.cn-owner-name {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.cn-owner-value {
  font-family: var(--mono);
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

/* ============================================================
   КНОПКИ
   ============================================================ */
.cn-actions {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 6px;
  margin-top: 4px;
}

.cn-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.35);

  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08));
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 -1px 0 rgba(0, 0, 0, 0.12) inset,
    0 2px 4px rgba(0, 0, 0, 0.1);

  transition: all 0.18s cubic-bezier(.34,1.56,.64,1);

  &:hover {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.15));
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -1px 0 rgba(0, 0, 0, 0.12) inset,
      0 6px 14px -4px rgba(0, 0, 0, 0.35);
  }
  &:active {
    transform: translateY(0) scale(0.97);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.15) inset;
  }

  &.cn-act-primary {
    background: linear-gradient(180deg, #ffffff, #f0fdf4);
    color: #047857;
    border-color: transparent;
    font-weight: 800;

    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 -1px 0 rgba(4, 120, 87, 0.15) inset,
      0 4px 12px -2px rgba(255, 255, 255, 0.4),
      0 8px 20px -6px rgba(0, 0, 0, 0.2);

    &:hover {
      background: #ffffff;
      color: #065f46;
      transform: translateY(-2px);
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 -1px 0 rgba(4, 120, 87, 0.15) inset,
        0 6px 16px -2px rgba(255, 255, 255, 0.5),
        0 14px 32px -8px rgba(0, 0, 0, 0.3);
    }
  }
}

.cn-act-icon {
  font-size: 13px;
  line-height: 1;
}

/* ============================================================
   ЦЕЛЬ
   ============================================================ */
.cn-goal {
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.08));
  border: 1.5px dashed rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.25) inset,
    0 -1px 0 rgba(0, 0, 0, 0.08) inset,
    0 4px 12px -4px rgba(0, 0, 0, 0.15);

  &.done {
    border-style: solid;
    border-color: rgba(34, 197, 94, 0.7);
    background: linear-gradient(180deg, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.1));
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -1px 0 rgba(0, 0, 0, 0.08) inset,
      0 4px 16px -4px rgba(34, 197, 94, 0.4);
  }
}

.cn-goal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cn-goal-emoji {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.cn-goal-name {
  flex: 1;
  font-size: 13px;
  font-weight: 800;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.cn-goal-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(180deg, #fcd34d, #f59e0b);
  font-size: 12px;
  flex-shrink: 0;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5) inset,
    0 -2px 4px rgba(180, 83, 9, 0.3) inset,
    0 4px 10px -2px rgba(245, 158, 11, 0.6);

  &.done {
    background: linear-gradient(180deg, #4ade80, #22c55e);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.5) inset,
      0 -2px 4px rgba(22, 163, 74, 0.3) inset,
      0 4px 10px -2px rgba(34, 197, 94, 0.6);
  }
}

.cn-goal-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cn-goal-track {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.08));
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.15) inset,
    0 1px 0 rgba(255, 255, 255, 0.15);
}

.cn-goal-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(180deg, #fcd34d, #f59e0b, #f97316);
  transition: width 0.6s cubic-bezier(.22,.61,.36,1);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 0 12px rgba(251, 191, 36, 0.6);

  &.done {
    background: linear-gradient(180deg, #4ade80, #22c55e);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 0 12px rgba(34, 197, 94, 0.6);
  }
}

.cn-goal-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  line-height: 1.2;
}

.cn-goal-left {
  font-family: var(--mono);
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
}

.cn-goal-target {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .cash-note { padding: 14px 16px 12px; border-radius: 18px; }
  .cash-note.collapsed { padding: 12px 14px; min-height: 64px; }

  .cn-header-title { font-size: 14px; letter-spacing: 0.06em; }
  .cn-header-sub { font-size: 8.5px; letter-spacing: 0.14em; }
  .cn-header-icon { font-size: 20px; }
  .cn-header-value { font-size: 22px; }
  .cn-header-label { font-size: 9px; }

  .cn-owners { padding-top: 8px; gap: 5px; }
  .cn-owner { padding: 6px 10px; gap: 8px; border-radius: 10px; }
  .cn-owner-emoji { font-size: 14px; }
  .cn-owner-name { font-size: 11.5px; }
  .cn-owner-value { font-size: 12.5px; }

  .cn-actions { gap: 5px; }
  .cn-act { padding: 8px 6px; font-size: 10.5px; gap: 4px; border-radius: 10px; }
  .cn-act-icon { font-size: 12px; }

  .cn-watermark { font-size: 110px; bottom: -24px; right: -8px; }
  .cn-bill { width: 36px; height: 22px; }

  .cn-goal { padding: 10px 12px; gap: 6px; border-radius: 12px; }
  .cn-goal-emoji { font-size: 14px; }
  .cn-goal-name { font-size: 12px; }
  .cn-goal-badge { width: 22px; height: 22px; font-size: 11px; }
  .cn-goal-left { font-size: 11.5px; }
  .cn-goal-target { font-size: 10.5px; }
  .cn-goal-track { height: 7px; }
}

@media (max-width: 380px) {
  .cn-header-title { font-size: 13px; }
  .cn-header-sub { display: none; }
  .cn-header-value { font-size: 19px; }
  .cn-act { font-size: 10px; }
  .cn-owner-name { font-size: 11px; }
  .cn-owner-value { font-size: 12px; }
  .cn-goal-name { font-size: 11.5px; }
  .cn-goal-left { font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .cash-note { animation: none !important; }
  .cn-bill { animation: none !important; opacity: 0; }
  .cash-note,
  .cn-act,
  .cn-goal,
  .cn-goal-fill,
  .cn-header,
  .cn-collapsible { transition: none !important; transform: none !important; }
}
</style>