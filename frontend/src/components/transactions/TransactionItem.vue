<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useFiltersStore } from '@/stores/filters';
import { useAuthStore } from '@/stores/auth';
import {
  fmt,
  categoryIcon,
  userEmoji,
  bankLogo,
  bankLabel,
} from '@/composables/useFormat';

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

// ✅ Отображаемое имя (displayName для текущего пользователя)
const displayUserName = computed(() => auth.nameFor(props.tx.user));

// Анимации
const appearing = ref(props.isNew);
const deleting = ref(false);
const amountFlash = ref(null);

const prevAmount = ref(props.tx.amount);
watch(() => props.tx.amount, (newVal, oldVal) => {
  if (newVal === oldVal) return;
  amountFlash.value = newVal > oldVal ? 'up' : 'down';
  setTimeout(() => { amountFlash.value = null; }, 900);
});

onMounted(() => {
  if (props.isNew) {
    setTimeout(() => { appearing.value = false; }, 700);
  }
});

function onFilter(key, value) { filters.toggle(key, value); }

function onDelete() {
  deleting.value = true;
  setTimeout(() => { emit('delete', props.tx); }, 480);
}

// ============================================================
// Магнитный hover
// ============================================================
const tiltRx = ref(0);
const tiltRy = ref(0);
const tiltActive = ref(false);
const MAX_MAGNET_TILT = 3;

function onCardMouseMove(e) {
  if (window.innerWidth <= 700) return;
  const elRef = el.value;
  if (!elRef) return;
  const rect = elRef.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const dx = (px - 0.5) * 2;
  const dy = (py - 0.5) * 2;
  tiltActive.value = true;
  tiltRx.value = -dy * MAX_MAGNET_TILT;
  tiltRy.value = dx * MAX_MAGNET_TILT;
}

function onCardMouseLeave() {
  tiltActive.value = false;
  tiltRx.value = 0;
  tiltRy.value = 0;
}

const magnetStyle = computed(() => {
  if (!tiltActive.value) {
    return { transform: 'perspective(600px) rotateX(0) rotateY(0)' };
  }
  return {
    transform: `perspective(600px) rotateX(${tiltRx.value}deg) rotateY(${tiltRy.value}deg)`,
  };
});

// ============================================================
// Свайпы
// ============================================================
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
  return { transform: `translateX(${offsetX.value}px)` };
}
</script>

<template>
  <div
    ref="el"
    class="tx-item"
    :class="[
      swipeState ? 'swipe-' + swipeState : '',
      { 'is-appearing': appearing, 'is-deleting': deleting },
    ]"
    :style="{ ...itemStyle(), ...magnetStyle }"
    @mousemove="onCardMouseMove"
    @mouseleave="onCardMouseLeave"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      v-if="swipeProgress > 0"
      class="tx-swipe-progress"
      :class="offsetX < 0 ? 'danger' : 'primary'"
      :style="{ opacity: swipeProgress }"
    ></div>

    <div
      class="tx-avatar"
      :class="bankLogoUrl ? 'has-bank' : ('user-' + userClass)"
    >
      <img
        v-if="bankLogoUrl"
        :src="bankLogoUrl"
        :alt="bankLabel(tx.accountId)"
        class="tx-bank-logo"
        loading="lazy"
        @error="(e) => (e.target.style.display = 'none')"
      />
      <span v-else class="tx-avatar-emoji">{{ userEmoji(tx.user) }}</span>
    </div>

    <div class="tx-main">
      <div class="tx-name">{{ tx.name || 'Без названия' }}</div>
      <div class="tx-meta">
        <!-- ✅ Фильтр работает на техническом ключе, показываем displayName -->
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
.tx-item {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.28s cubic-bezier(.22,.61,.36,1),
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease,
    opacity 0.3s ease,
    filter 0.3s ease;
  touch-action: pan-y;
  will-change: transform, opacity, filter;
  transform-style: preserve-3d;
  overflow: hidden;

  &:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow-md);
  }

  &.is-appearing {
    animation: receiptPrint 0.7s cubic-bezier(.22,.61,.36,1) both;
  }
  &.is-deleting {
    animation: printerOut 0.48s cubic-bezier(.4,0,.6,1) forwards;
    pointer-events: none;
  }
}

@keyframes receiptPrint {
  0% {
    max-height: 0; padding-top: 0; padding-bottom: 0;
    transform: scaleY(0.02); transform-origin: top center;
    opacity: 0; filter: blur(2px);
  }
  30% {
    max-height: 80px; padding-top: 12px; padding-bottom: 12px;
    transform: scaleY(1); opacity: 1; filter: blur(0);
  }
  70% { transform: scaleY(1) translateX(0); }
  85% { transform: scaleY(1) translateX(-3px); }
  100% { transform: scaleY(1) translateX(0); opacity: 1; }
}

@keyframes printerOut {
  0%   { opacity: 1; filter: blur(0); transform: translateX(0) scale(1); }
  40%  { opacity: 0.6; filter: blur(2px); transform: translateX(0) scale(1.02); }
  100% {
    opacity: 0; filter: blur(10px); transform: translateX(-100px) scale(0.92);
    max-height: 0; padding-top: 0; padding-bottom: 0;
    margin-bottom: -8px; border-width: 0;
  }
}

.tx-swipe-progress {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.12s;

  &.primary {
    background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.35) 100%);
  }
  &.danger {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.35) 0%, transparent 100%);
  }
}

.tx-item > * { position: relative; z-index: 1; }

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
  border-radius: 14px;
  z-index: 0;
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
  border-radius: 14px;
  z-index: 0;
  pointer-events: none;
}

.tx-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  transition: all 0.2s ease;
}
.tx-avatar.has-bank {
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 6px -2px rgba(15, 23, 42, 0.12);
}
.tx-avatar.user-sergey {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(139, 92, 246, 0.22));
  border: 1.5px solid rgba(59, 130, 246, 0.35);
}
.tx-avatar.user-sasha {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.22), rgba(245, 158, 11, 0.22));
  border: 1.5px solid rgba(236, 72, 153, 0.35);
}
.tx-bank-logo {
  width: 100%; height: 100%;
  object-fit: contain;
  padding: 5px;
  box-sizing: border-box;
}
.tx-avatar-emoji { font-size: 20px; line-height: 1; }

.tx-main { min-width: 0; }
.tx-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}
.tx-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
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
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.12);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background: linear-gradient(135deg, #38bdf8, #8b5cf6);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -6px rgba(56, 189, 248, 0.6);
  }
  &.acc-badge.sber {
    background: rgba(33, 160, 56, 0.15);
    color: #166534;
    &:hover { background: linear-gradient(135deg, #21a038, #4cd964); color: #ffffff; }
  }
  &.acc-badge.tbank {
    background: rgba(255, 221, 45, 0.25);
    color: #92400e;
    &:hover { background: linear-gradient(135deg, #fbbf24, #ffdd2d); color: #000000; }
  }
}

.tx-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.tx-amount {
  font-family: var(--mono, "JetBrains Mono", monospace);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease, transform 0.15s ease, color 0.3s ease;
  user-select: none;
  border-radius: 6px;
  padding: 1px 4px;

  &.income { color: #22c55e; }
  &.expense { color: #ef4444; }

  &:hover { opacity: 0.75; transform: scale(1.03); }

  &.flash-up { animation: amountFlashUp 0.9s ease-out; }
  &.flash-down { animation: amountFlashDown 0.9s ease-out; }
}

@keyframes amountFlashUp {
  0%   { background: rgba(34, 197, 94, 0.35); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}
@keyframes amountFlashDown {
  0%   { background: rgba(239, 68, 68, 0.35); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}

.tx-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.tx-item:hover .tx-actions { opacity: 1; }
.tx-actions button {
  width: 28px; height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  padding: 0;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56, 189, 248, 0.1);
  }
  &.danger:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.1);
  }
}

@media (max-width: 700px) {
  .tx-item { padding: 12px 14px; gap: 10px; border-radius: 12px; }
  .tx-avatar { width: 36px; height: 36px; }
  .tx-bank-logo { padding: 4px; }
  .tx-avatar-emoji { font-size: 18px; }
  .tx-name { font-size: 14px; margin-bottom: 2px; }
  .tx-meta { font-size: 11px; gap: 5px; }
  .tx-meta .cat { font-size: 10px; padding: 2px 7px; }
  .tx-meta .cat.acc-badge { font-size: 9.5px; padding: 2px 6px; }
  .tx-amount { font-size: 15px; }
  .tx-actions { opacity: 1; }
  .tx-actions button { width: 32px; height: 32px; font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .tx-item.is-appearing,
  .tx-item.is-deleting,
  .tx-amount.flash-up,
  .tx-amount.flash-down {
    animation: none !important;
  }
}
</style>