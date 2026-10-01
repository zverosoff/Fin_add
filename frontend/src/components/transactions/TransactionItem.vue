<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useFiltersStore } from '@/stores/filters';
import { useAuthStore } from '@/stores/auth';
import { fmt, categoryIcon, userEmoji, bankLogo, bankLabel } from '@/composables/useFormat';

const props = defineProps({
  tx: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
});

const emit = defineEmits(['edit', 'delete']);

const accounts = useAccountsStore();
const filters = useFiltersStore();
const auth = useAuthStore();

const accountName = computed(() => accounts.getAccountName(props.tx.accountId));
const bank = computed(() => accounts.getBank(props.tx.accountId));
const bankLogoUrl = computed(() => bankLogo(props.tx.accountId));
const amountSign = computed(() => (props.tx.type === 'income' ? '+' : '−'));
const amountClass = computed(() => (props.tx.type === 'income' ? 'income' : 'expense'));
const icon = computed(() => categoryIcon(props.tx.category));
const userClass = computed(() => (props.tx.user === 'Сергей' ? 'sergey' : 'sasha'));
const displayUserName = computed(() => auth.nameFor(props.tx.user));
const userAvatar = computed(() => auth.avatarFor(props.tx.user));

// ✅ Банк-фон: цвет + лого
const bankStyle = computed(() => {
  const id = props.tx.accountId;
  if (!id) return null;

  if (id === 'cash' || id.startsWith('cash_')) {
    return {
      type: 'cash',
      icon: '💵',
      label: 'Наличные',
      color: '#22c55e',
      colorSoft: 'rgba(34, 197, 94, 0.15)',
    };
  }

  if (id.startsWith('tbank')) {
    return {
      type: 'tbank',
      logo: bankLogoUrl.value,
      label: 'Т-Банк',
      color: '#eab308',
      colorSoft: 'rgba(234, 179, 8, 0.18)',
    };
  }

  if (id.startsWith('sber')) {
    return {
      type: 'sber',
      logo: bankLogoUrl.value,
      label: 'СберБанк',
      color: '#21a038',
      colorSoft: 'rgba(33, 160, 56, 0.15)',
    };
  }

  return {
    type: 'default',
    icon: '💳',
    label: accountName.value || 'Счёт',
    color: '#64748b',
    colorSoft: 'rgba(100, 116, 139, 0.12)',
  };
});

const appearing = ref(false);
const deleting = ref(false);

onMounted(() => {
  if (props.isNew) {
    appearing.value = true;
    setTimeout(() => { appearing.value = false; }, 500);
  }
});

const amountFlash = ref(null);
watch(() => props.tx.amount, (newVal, oldVal) => {
  if (newVal === oldVal) return;
  amountFlash.value = newVal > oldVal ? 'up' : 'down';
  setTimeout(() => { amountFlash.value = null; }, 900);
});

function onFilter(key, value) { filters.toggle(key, value); }

function onDelete() {
  deleting.value = true;
  setTimeout(() => { emit('delete', props.tx); }, 300);
}

const el = ref(null);
const offsetX = ref(0);
const swipeState = ref(null);
const swipeProgress = ref(0);

let touchStartX = 0;
let touchStartY = 0;
let isHorizontal = null;

function isMobile() { return window.innerWidth <= 700; }

function onTouchStart(e) {
  if (!isMobile()) return;
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isHorizontal = null;
  offsetX.value = 0;
  swipeProgress.value = 0;
}

function onTouchMove(e) {
  if (!isMobile()) return;
  if (e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if (isHorizontal === null) {
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      isHorizontal = Math.abs(dx) > Math.abs(dy) + 4;
    }
  }
  if (!isHorizontal) return;
  offsetX.value = Math.max(-80, Math.min(80, dx));
  swipeProgress.value = Math.min(1, Math.abs(offsetX.value) / 55);
}

function onTouchEnd() {
  if (!isMobile()) return;
  if (!isHorizontal) { offsetX.value = 0; swipeProgress.value = 0; return; }
  const threshold = 55;
  if (offsetX.value <= -threshold) {
    swipeState.value = 'left';
    offsetX.value = -70;
    setTimeout(() => {
      swipeState.value = null;
      offsetX.value = 0;
      swipeProgress.value = 0;
      emit('delete', props.tx);
    }, 250);
  } else if (offsetX.value >= threshold) {
    swipeState.value = 'right';
    offsetX.value = 70;
    setTimeout(() => {
      swipeState.value = null;
      offsetX.value = 0;
      swipeProgress.value = 0;
      emit('edit', props.tx);
    }, 250);
  } else {
    offsetX.value = 0;
    swipeProgress.value = 0;
  }
}

function itemStyle() {
  if (!offsetX.value) return {};
  return { transform: `translate3d(${offsetX.value}px, 0, 0)` };
}
</script>

<template>
  <div
    ref="el"
    class="tx-item"
    :class="[
      swipeState ? 'swipe-' + swipeState : '',
      { 'is-appearing': appearing, 'is-deleting': deleting },
      bankStyle ? 'has-bank-' + bankStyle.type : '',
    ]"
    :style="itemStyle()"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- ✅ ЛОГО БАНКА В ВЕРХНЕМ ЛЕВОМ УГЛУ — как фоновый водяной знак -->
    <div
      v-if="bankStyle"
      class="tx-bank-watermark"
      :class="'wm-' + bankStyle.type"
      aria-hidden="true"
    >
      <!-- Радиальное свечение под логотипом -->
      <div
        class="tx-bank-glow"
        :style="{ background: `radial-gradient(circle at 30% 30%, ${bankStyle.colorSoft} 0%, transparent 70%)` }"
      ></div>

      <!-- Лого или иконка -->
      <img
        v-if="bankStyle.logo"
        :src="bankStyle.logo"
        :alt="bankStyle.label"
        class="tx-bank-wm-logo"
        loading="lazy"
        @error="(e) => (e.target.style.display = 'none')"
      />
      <span v-else class="tx-bank-wm-icon">{{ bankStyle.icon }}</span>
    </div>

    <div
      v-if="swipeProgress > 0"
      class="tx-swipe-progress"
      :class="offsetX < 0 ? 'danger' : 'primary'"
      :style="{ opacity: swipeProgress }"
    ></div>

    <!-- АВАТАР — вернулся влево -->
    <div class="tx-avatar" :class="userClass">
      <img
        v-if="userAvatar"
        :src="userAvatar"
        alt="avatar"
        class="tx-avatar-img"
        loading="lazy"
      />
      <span v-else class="tx-avatar-emoji">{{ userEmoji(tx.user) }}</span>
    </div>

    <div class="tx-main">
      <div class="tx-name">{{ tx.name || 'Без названия' }}</div>
      <div class="tx-meta">
        <span class="who" @click.stop="onFilter('user', tx.user)">{{ displayUserName }}</span>
        <span class="cat" @click.stop="onFilter('category', tx.category)">
          {{ icon }} {{ tx.category || 'Прочее' }}
        </span>
        <span
          v-if="tx.accountId"
          class="cat acc-badge"
          :class="bank"
          @click.stop="onFilter('account', tx.accountId)"
        >{{ accountName }}</span>
      </div>
    </div>

    <div class="tx-right">
      <div
        class="tx-amount"
        :class="[amountClass, amountFlash ? 'flash-' + amountFlash : '']"
        @click.stop="onFilter('type', tx.type)"
      >
        {{ amountSign }} {{ fmt(tx.amount) }} ₽
      </div>

      <div class="tx-actions">
        <button class="edit" type="button" @click.stop="emit('edit', tx)">✏️</button>
        <button class="danger" type="button" @click.stop="onDelete">🗑</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   КАРТОЧКА
   ============================================================ */
.tx-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;

  /* ✅ padding вернули как было */
  padding: 14px 16px;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(250, 251, 255, 0.95) 100%
  );

  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 16px;
  overflow: hidden;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.05),
    0 8px 20px -6px rgba(15, 23, 42, 0.08);

  transition:
    transform 0.25s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.3s ease,
    border-color 0.2s ease;
  touch-action: pan-y;
  box-sizing: border-box;

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.06) inset,
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 16px 32px -10px rgba(99, 102, 241, 0.2),
      0 24px 48px -16px rgba(15, 23, 42, 0.12);
  }

  &.is-appearing {
    animation: txAppear 0.5s cubic-bezier(.34,1.56,.64,1);
  }

  &.is-deleting {
    animation: txDelete 0.3s cubic-bezier(.4,0,.6,1) forwards;
    pointer-events: none;
  }
}

@keyframes txAppear {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes txDelete {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(-60px) scale(0.9);
  }
}

/* ============================================================
   ✅ ЛОГО БАНКА — ФОНОВЫЙ ВОДЯНОЙ ЗНАК В ЛЕВОМ ВЕРХНЕМ УГЛУ
   ============================================================ */
.tx-bank-watermark {
  position: absolute;
  top: -12px;
  left: -12px;
  width: 140px;
  height: 140px;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

/* Радиальное свечение под логотипом */
.tx-bank-glow {
  position: absolute;
  inset: -20px;
  z-index: 0;
  pointer-events: none;
  filter: blur(20px);
  opacity: 0.9;
}

/* Лого — большое, размытое, полупрозрачное */
.tx-bank-wm-logo {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 20px;
  box-sizing: border-box;
  display: block;

  /* ✅ Мягкое размытие + полупрозрачность */
  opacity: 0.18;
  filter: blur(1px) saturate(1.3);

  /* ✅ Плавный переход к правому нижнему краю */
  -webkit-mask-image: radial-gradient(
    circle at 30% 30%,
    #000 0%,
    rgba(0, 0, 0, 0.7) 40%,
    rgba(0, 0, 0, 0.2) 70%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle at 30% 30%,
    #000 0%,
    rgba(0, 0, 0, 0.7) 40%,
    rgba(0, 0, 0, 0.2) 70%,
    transparent 100%
  );
}

/* Иконка наличных/дефолт */
.tx-bank-wm-icon {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 72px;
  line-height: 1;

  /* ✅ Мягкое размытие + полупрозрачность */
  opacity: 0.15;
  filter: blur(0.5px) saturate(1.3);

  /* ✅ Плавный переход */
  -webkit-mask-image: radial-gradient(
    circle at 30% 30%,
    #000 0%,
    rgba(0, 0, 0, 0.7) 40%,
    rgba(0, 0, 0, 0.2) 70%,
    transparent 100%
  );
  mask-image: radial-gradient(
    circle at 30% 30%,
    #000 0%,
    rgba(0, 0, 0, 0.7) 40%,
    rgba(0, 0, 0, 0.2) 70%,
    transparent 100%
  );
}

/* ✅ На мобильном водяной знак меньше */
@media (max-width: 700px) {
  .tx-bank-watermark {
    width: 110px;
    height: 110px;
    top: -8px;
    left: -8px;
  }
  .tx-bank-wm-icon { font-size: 56px; }
  .tx-bank-wm-logo { padding: 14px; }
}

@media (max-width: 380px) {
  .tx-bank-watermark {
    width: 90px;
    height: 90px;
    top: -6px;
    left: -6px;
  }
  .tx-bank-wm-icon { font-size: 46px; }
  .tx-bank-wm-logo { padding: 12px; }
}

/* ============================================================
   АВАТАР — как было (42×42)
   ============================================================ */
.tx-avatar {
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  z-index: 2;

  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tx-avatar.sergey {
  background: linear-gradient(180deg, rgba(147, 197, 253, 0.35), rgba(139, 92, 246, 0.35));
  border: 1.5px solid rgba(59, 130, 246, 0.4);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.6) inset,
    0 4px 10px -2px rgba(59, 130, 246, 0.25);
}
.tx-avatar.sasha {
  background: linear-gradient(180deg, rgba(251, 207, 232, 0.4), rgba(253, 186, 116, 0.3));
  border: 1.5px solid rgba(236, 72, 153, 0.4);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.6) inset,
    0 4px 10px -2px rgba(236, 72, 153, 0.25);
}

.tx-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tx-avatar-emoji {
  font-size: 20px;
  line-height: 1;
}

/* ============================================================
   ТЕКСТ
   ============================================================ */
.tx-main {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 2;
}

.tx-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.tx-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  position: relative;
  z-index: 2;
}

.tx-meta .who {
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  transition: color 0.15s ease;
  user-select: none;
  &:hover { color: var(--accent); }
}

.tx-meta .cat {
  padding: 3px 9px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(241, 245, 249, 0.95), rgba(226, 232, 240, 0.85));
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;
  border: 1px solid rgba(148, 163, 184, 0.15);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 1px 2px rgba(15, 23, 42, 0.04);

  &:hover {
    background: linear-gradient(180deg, #818cf8, #6366f1);
    color: #ffffff;
    border-color: transparent;
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 4px 10px -2px rgba(99, 102, 241, 0.5);
  }
  &.acc-badge.sber {
    background: linear-gradient(180deg, rgba(220, 252, 231, 1), rgba(187, 247, 208, 0.8));
    color: #166534;
    border-color: rgba(33, 160, 56, 0.25);
    &:hover {
      background: linear-gradient(180deg, #4cd964, #21a038);
      color: #ffffff;
      box-shadow: 0 4px 10px -2px rgba(33, 160, 56, 0.5);
    }
  }
  &.acc-badge.tbank {
    background: linear-gradient(180deg, rgba(254, 249, 195, 1), rgba(253, 224, 71, 0.6));
    color: #92400e;
    border-color: rgba(245, 158, 11, 0.3);
    &:hover {
      background: linear-gradient(180deg, #fde047, #f59e0b);
      color: #000000;
      box-shadow: 0 4px 10px -2px rgba(245, 158, 11, 0.5);
    }
  }
  &.acc-badge.cash {
    background: linear-gradient(180deg, rgba(220, 252, 231, 1), rgba(187, 247, 208, 0.8));
    color: #166534;
    border-color: rgba(34, 197, 94, 0.3);
  }
}

/* ============================================================
   СУММА
   ============================================================ */
.tx-right {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  position: relative;
  z-index: 2;
}

.tx-amount {
  font-family: var(--mono, "JetBrains Mono", monospace);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  user-select: none;
  border-radius: 8px;
  padding: 2px 6px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);

  &.income {
    color: #16a34a;
    background: linear-gradient(180deg, rgba(220, 252, 231, 0.5), rgba(187, 247, 208, 0.3));
  }
  &.expense {
    color: #dc2626;
    background: linear-gradient(180deg, rgba(254, 226, 226, 0.5), rgba(254, 202, 202, 0.3));
  }

  &:hover { transform: scale(1.04); }

  &.flash-up { animation: amountFlashUp 0.9s ease-out; }
  &.flash-down { animation: amountFlashDown 0.9s ease-out; }
}

@keyframes amountFlashUp {
  0%   { background: rgba(34, 197, 94, 0.4); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}
@keyframes amountFlashDown {
  0%   { background: rgba(239, 68, 68, 0.4); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}

/* ============================================================
   КНОПКИ
   ============================================================ */
.tx-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.tx-item:hover .tx-actions { opacity: 1; }

.tx-actions button {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s cubic-bezier(.34,1.56,.64,1);
  padding: 0;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 2px 4px rgba(15, 23, 42, 0.06);

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    color: #6366f1;
    background: linear-gradient(180deg, #eef2ff, #e0e7ff);
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 4px 10px -2px rgba(99, 102, 241, 0.3);
  }
  &:active {
    transform: translateY(0) scale(0.95);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1) inset;
  }
  &.danger:hover {
    border-color: rgba(239, 68, 68, 0.4);
    color: #dc2626;
    background: linear-gradient(180deg, #fef2f2, #fee2e2);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 4px 10px -2px rgba(239, 68, 68, 0.3);
  }
}

/* ============================================================
   Свайп
   ============================================================ */
.tx-swipe-progress {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  pointer-events: none;
  z-index: 3;
  transition: opacity 0.12s;

  &.primary {
    background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.35) 100%);
  }
  &.danger {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.35) 0%, transparent 100%);
  }
}

.tx-item.swipe-left { border-color: rgba(239, 68, 68, 0.5); }
.tx-item.swipe-right { border-color: rgba(59, 130, 246, 0.5); }

.tx-item.swipe-left::before {
  content: "🗑";
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 24px;
  background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.85));
  color: #fff;
  font-size: 20px;
  border-radius: 16px;
  z-index: 4;
  pointer-events: none;
}
.tx-item.swipe-right::before {
  content: "✏️";
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 24px;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.85), transparent);
  color: #fff;
  font-size: 20px;
  border-radius: 16px;
  z-index: 4;
  pointer-events: none;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .tx-item { padding: 12px 14px; gap: 10px; border-radius: 14px; }
  .tx-avatar { flex: 0 0 38px; width: 38px; height: 38px; }
  .tx-avatar-emoji { font-size: 18px; }
  .tx-name { font-size: 14px; }
  .tx-meta { font-size: 11px; gap: 5px; }
  .tx-meta .cat { font-size: 10px; padding: 2px 8px; }
  .tx-amount { font-size: 15px; }
  .tx-actions { opacity: 1; }
  .tx-actions button { width: 32px; height: 32px; }
  .tx-item:active { transform: scale(0.99); }
}

@media (prefers-reduced-motion: reduce) {
  .tx-item,
  .tx-item:hover,
  .tx-avatar,
  .tx-actions button,
  .tx-amount { transition: none !important; transform: none !important; }
  .tx-item.is-appearing,
  .tx-item.is-deleting,
  .tx-amount.flash-up,
  .tx-amount.flash-down { animation: none !important; }
}
</style>