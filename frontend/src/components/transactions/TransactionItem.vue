<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useFiltersStore } from '@/stores/filters';
import { useAuthStore } from '@/stores/auth';
import { fmt, categoryIcon, userEmoji, bankLogo } from '@/composables/useFormat';

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

// ✅ Информация о банке для правой «монеты»
const bankStyle = computed(() => {
  const id = props.tx.accountId;
  if (!id) return null;

  if (id === 'cash' || id.startsWith('cash_')) {
    return {
      type: 'cash',
      icon: '💵',
      label: 'Наличные',
      color: '#22c55e',
      gradient: 'linear-gradient(135deg, #4ade80, #16a34a)',
    };
  }

  if (id.startsWith('tbank')) {
    return {
      type: 'tbank',
      logo: bankLogoUrl.value,
      label: 'Т-Банк',
      color: '#eab308',
      gradient: 'linear-gradient(135deg, #fde047, #eab308)',
    };
  }

  if (id.startsWith('sber')) {
    return {
      type: 'sber',
      logo: bankLogoUrl.value,
      label: 'СберБанк',
      color: '#21a038',
      gradient: 'linear-gradient(135deg, #4cd964, #21a038)',
    };
  }

  return {
    type: 'default',
    icon: '💳',
    label: accountName.value || 'Счёт',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #94a3b8, #475569)',
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
  closeReveal();
  deleting.value = true;
  setTimeout(() => { emit('delete', props.tx); }, 300);
}

function onEdit() {
  closeReveal();
  emit('edit', props.tx);
}

// ============================================================
// ✅ SWIPE-REVEAL: свайп вправо открывает кнопки слева
// ============================================================
const el = ref(null);
const offsetX = ref(0);
const revealed = ref(false);
const dragging = ref(false);

let touchStartX = 0;
let touchStartY = 0;
let isHorizontal = null;
let rafId = null;
let pendingX = null;

const REVEAL_WIDTH = 96;   // ширина панели действий (2 кнопки)
const THRESHOLD = 40;      // порог срабатывания

function isMobile() { return window.innerWidth <= 700; }

function applyOffset() {
  if (pendingX === null) return;
  offsetX.value = pendingX;
  pendingX = null;
  rafId = null;
}

function setOffset(x) {
  pendingX = Math.max(0, Math.min(REVEAL_WIDTH + 20, x));
  if (!rafId) rafId = requestAnimationFrame(applyOffset);
}

function onTouchStart(e) {
  if (!isMobile()) return;
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isHorizontal = null;
  dragging.value = true;
}

function onTouchMove(e) {
  if (!dragging.value) return;
  if (e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;

  if (isHorizontal === null) {
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      isHorizontal = Math.abs(dx) > Math.abs(dy) + 4;
    }
    if (!isHorizontal) return;
  }
  if (!isHorizontal) return;

  // Свайп вправо открывает; влево — закрывает, если уже открыто
  if (revealed.value) {
    setOffset(REVEAL_WIDTH + dx);
  } else {
    if (dx <= 0) { setOffset(0); return; }
    setOffset(dx);
  }
}

function onTouchEnd() {
  if (!dragging.value) return;
  dragging.value = false;

  if (!isHorizontal) {
    setOffset(0);
    return;
  }

  const current = offsetX.value;
  if (revealed.value) {
    // Уже открыто → закрываем, если утянули ниже половины
    if (current < REVEAL_WIDTH / 2) {
      revealed.value = false;
      setOffset(0);
    } else {
      setOffset(REVEAL_WIDTH);
    }
  } else {
    // Закрыто → открываем при достаточном сдвиге
    if (current > THRESHOLD) {
      revealed.value = true;
      setOffset(REVEAL_WIDTH);
    } else {
      setOffset(0);
    }
  }

  isHorizontal = null;
}

function closeReveal() {
  if (!revealed.value) return;
  revealed.value = false;
  setOffset(0);
}

function onDocClick(e) {
  if (!revealed.value) return;
  if (el.value && el.value.contains(e.target)) return;
  closeReveal();
}

onMounted(() => {
  document.addEventListener('touchstart', onDocClick, { passive: true });
});
onUnmounted(() => {
  document.removeEventListener('touchstart', onDocClick);
  if (rafId) cancelAnimationFrame(rafId);
});

const itemStyle = computed(() => {
  if (!offsetX.value) return {};
  return { transform: `translate3d(${offsetX.value}px, 0, 0)` };
});

const progress = computed(() =>
  revealed.value ? 1 : Math.min(1, offsetX.value / REVEAL_WIDTH)
);
</script>

<template>
  <div
    ref="el"
    class="tx-item"
    :class="[
      { 'is-appearing': appearing, 'is-deleting': deleting, 'is-revealed': revealed },
      bankStyle ? 'has-bank-' + bankStyle.type : '',
    ]"
  >
    <!-- ✅ ПАНЕЛЬ ДЕЙСТВИЙ — выезжает слева при свайпе вправо -->
    <div
      class="tx-actions-panel"
      :style="{ opacity: progress }"
      aria-hidden="true"
    >
      <button
        class="tx-action-btn tx-action-edit"
        type="button"
        @click.stop="onEdit"
        aria-label="Редактировать"
      >
        <span class="tab-icon">✏️</span>
      </button>
      <button
        class="tx-action-btn tx-action-delete"
        type="button"
        @click.stop="onDelete"
        aria-label="Удалить"
      >
        <span class="tab-icon">🗑</span>
      </button>
    </div>

    <!-- ✅ КАРТОЧКА (сдвигается) -->
    <div
      class="tx-card"
      :style="itemStyle()"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <!-- Верхний левый угол: лого банка — усилили заметность -->
      <div
        v-if="bankStyle"
        class="tx-bank-watermark"
        :class="'wm-' + bankStyle.type"
        aria-hidden="true"
      >
        <div
          class="tx-bank-glow"
          :style="{ background: `radial-gradient(circle at 30% 30%, ${bankStyle.color}33 0%, transparent 70%)` }"
        ></div>

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
        </div>
      </div>

      <!-- ✅ ПРАВАЯ ЧАСТЬ: сумма + БАНК-МОНЕТА (крупная, очевидная) -->
      <div class="tx-right">
        <div
          class="tx-amount"
          :class="[amountClass, amountFlash ? 'flash-' + amountFlash : '']"
          @click.stop="onFilter('type', tx.type)"
        >
          {{ amountSign }} {{ fmt(tx.amount) }} ₽
        </div>

        <div
          v-if="bankStyle"
          class="tx-bank-coin"
          :class="'coin-' + bankStyle.type"
          :style="{ background: bankStyle.gradient }"
          :title="bankStyle.label"
          @click.stop="tx.accountId && onFilter('account', tx.accountId)"
        >
          <img
            v-if="bankStyle.logo"
            :src="bankStyle.logo"
            class="tx-bank-coin-img"
            :alt="bankStyle.label"
            loading="lazy"
            @error="(e) => (e.target.style.display = 'none')"
          />
          <span v-else class="tx-bank-coin-emoji">{{ bankStyle.icon }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   КОНТЕЙНЕР
   ============================================================ */
.tx-item {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  touch-action: pan-y;
  box-sizing: border-box;

  &.is-appearing { animation: txAppear 0.5s cubic-bezier(.34,1.56,.64,1); }
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
  from { opacity: 1; transform: translateX(0) scale(1); }
  to   { opacity: 0; transform: translateX(-60px) scale(0.9); }
}

/* ============================================================
   ПАНЕЛЬ ДЕЙСТВИЙ — на заднем плане, слева
   ============================================================ */
.tx-actions-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 96px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0 8px;
  z-index: 0;
  pointer-events: auto;

  background: linear-gradient(
    90deg,
    rgba(99, 102, 241, 0.12) 0%,
    rgba(99, 102, 241, 0.06) 100%
  );
  transition: opacity 0.15s linear;

  .tx-item.is-revealed & { pointer-events: auto; }
  .tx-item:not(.is-revealed) & { pointer-events: none; }
}

.tx-action-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
  flex-shrink: 0;

  .tab-icon {
    font-size: 18px;
    line-height: 1;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  &:active { transform: scale(0.92); }
}

.tx-action-edit {
  background: linear-gradient(180deg, #60a5fa, #3b82f6);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(29, 78, 216, 0.3) inset,
    0 4px 10px -2px rgba(59, 130, 246, 0.5);

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -2px 0 rgba(29, 78, 216, 0.3) inset,
      0 8px 16px -2px rgba(59, 130, 246, 0.7);
  }
}

.tx-action-delete {
  background: linear-gradient(180deg, #f87171, #dc2626);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(153, 27, 27, 0.3) inset,
    0 4px 10px -2px rgba(239, 68, 68, 0.5);

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -2px 0 rgba(153, 27, 27, 0.3) inset,
      0 8px 16px -2px rgba(239, 68, 68, 0.7);
  }
}

/* ============================================================
   КАРТОЧКА
   ============================================================ */
.tx-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(250, 251, 255, 0.95) 100%
  );

  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 16px;
  overflow: hidden;
  box-sizing: border-box;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.05),
    0 8px 20px -6px rgba(15, 23, 42, 0.08);

  will-change: transform;
  transition: transform 0.32s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease, border-color 0.2s ease;

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.06) inset,
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 16px 32px -10px rgba(99, 102, 241, 0.2),
      0 24px 48px -16px rgba(15, 23, 42, 0.12);
  }
}

/* ============================================================
   ✅ ВОДЯНОЙ ЗНАК БАНКА — ВЕРХНИЙ ЛЕВЫЙ УГОЛ
   ============================================================ */
.tx-bank-watermark {
  position: absolute;
  top: -12px;
  left: -12px;
  width: 130px;
  height: 130px;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.tx-bank-glow {
  position: absolute;
  inset: -20px;
  z-index: 0;
  pointer-events: none;
  filter: blur(20px);
  opacity: 0.9;
}

.tx-bank-wm-logo {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 22px;
  box-sizing: border-box;
  display: block;
  opacity: 0.18;
  filter: blur(0.5px) saturate(1.4);

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

.tx-bank-wm-icon {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 68px;
  line-height: 1;
  opacity: 0.22;
  filter: blur(0.5px) saturate(1.3);

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

/* ============================================================
   АВАТАР
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
}

/* ============================================================
   ПРАВАЯ ЧАСТЬ: сумма + банк-монета
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

/* ✅ БАНК-МОНЕТА — крупная, цветная, в правом нижнем углу */
.tx-bank-coin {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.55) inset,
    0 -2px 4px rgba(0, 0, 0, 0.15) inset,
    0 4px 10px -2px rgba(15, 23, 42, 0.25),
    0 0 0 2px #ffffff;

  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px) scale(1.06);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.55) inset,
      0 -2px 4px rgba(0, 0, 0, 0.15) inset,
      0 8px 18px -2px rgba(15, 23, 42, 0.35),
      0 0 0 2px #ffffff;
  }
  &:active { transform: scale(0.95); }

  /* Т-Банк: жёлтая монета */
  &.coin-tbank {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.6) inset,
      0 -2px 4px rgba(120, 53, 15, 0.2) inset,
      0 4px 10px -2px rgba(234, 179, 8, 0.4),
      0 0 0 2px #ffffff;
  }

  /* Сбер: зелёная монета */
  &.coin-sber {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.6) inset,
      0 -2px 4px rgba(6, 78, 59, 0.2) inset,
      0 4px 10px -2px rgba(33, 160, 56, 0.4),
      0 0 0 2px #ffffff;
  }

  /* Наличные: зелёная монета */
  &.coin-cash {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.6) inset,
      0 -2px 4px rgba(6, 78, 59, 0.2) inset,
      0 4px 10px -2px rgba(34, 197, 94, 0.4),
      0 0 0 2px #ffffff;
  }
}

.tx-bank-coin-img {
  width: 70%;
  height: 70%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
}

.tx-bank-coin-emoji {
  font-size: 16px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .tx-card { padding: 12px 14px; gap: 10px; border-radius: 14px; }
  .tx-avatar { flex: 0 0 38px; width: 38px; height: 38px; }
  .tx-avatar-emoji { font-size: 18px; }
  .tx-name { font-size: 14px; }
  .tx-meta { font-size: 11px; gap: 5px; }
  .tx-meta .cat { font-size: 10px; padding: 2px 8px; }
  .tx-amount { font-size: 15px; }
  .tx-bank-watermark {
    width: 100px;
    height: 100px;
    top: -8px;
    left: -8px;
  }
  .tx-bank-wm-icon { font-size: 52px; }
  .tx-bank-wm-logo { padding: 16px; }
  .tx-bank-coin { width: 26px; height: 26px; }
  .tx-bank-coin-emoji { font-size: 13px; }
  .tx-actions-panel { width: 92px; }
  .tx-action-btn { width: 36px; height: 36px; }
  .tx-action-btn .tab-icon { font-size: 16px; }
}

@media (max-width: 380px) {
  .tx-bank-watermark {
    width: 84px;
    height: 84px;
    top: -6px;
    left: -6px;
  }
  .tx-bank-wm-icon { font-size: 44px; }
  .tx-bank-wm-logo { padding: 14px; }
  .tx-bank-coin { width: 24px; height: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .tx-card,
  .tx-avatar,
  .tx-bank-coin,
  .tx-amount { transition: none !important; }
  .tx-card:hover { transform: none; }
  .tx-amount.flash-up,
  .tx-amount.flash-down,
  .tx-item.is-appearing,
  .tx-item.is-deleting { animation: none !important; }
}
</style>