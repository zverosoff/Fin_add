<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useFiltersStore } from '@/stores/filters';
import { useAuthStore } from '@/stores/auth';
import { fmt, categoryIcon, bankIconPath, bankLabel } from '@/composables/useFormat';

const props = defineProps({
  tx: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
});

const emit = defineEmits(['edit', 'delete']);

const accounts = useAccountsStore();
const filters = useFiltersStore();
const auth = useAuthStore();

const accountName = computed(() => accounts.getAccountName(props.tx.accountId));
const amountSign = computed(() => (props.tx.type === 'income' ? '+' : '−'));
const amountClass = computed(() => (props.tx.type === 'income' ? 'income' : 'expense'));

// ✅ PNG-иконка категории
const categoryIconPath = computed(() => categoryIcon(props.tx.category));

const userClass = computed(() => (props.tx.user === 'Сергей' ? 'sergey' : 'sasha'));
const displayUserName = computed(() => auth.nameFor(props.tx.user));

// ✅ Аватар пользователя — PNG
const userAvatar = computed(() => {
  if (props.tx.user === 'Сергей') return '/img/mascots/avatar-man.png';
  if (props.tx.user === 'Саша') return '/img/mascots/avatar-woman.png';
  return '/img/mascots/avatar-man.png';
});

// ✅ Иконка банка/счёта
const bankIcon = computed(() => bankIconPath(props.tx.accountId));
const bankLabelText = computed(() => bankLabel(props.tx.accountId));

// Определяем тип счёта для CSS-класса
const bankType = computed(() => {
  const id = props.tx.accountId;
  if (!id) return 'default';
  if (id === 'cash' || id.startsWith('cash_')) return 'cash';
  if (id.startsWith('sber')) return 'sber';
  if (id.startsWith('tbank')) return 'tbank';
  return 'default';
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

const el = ref(null);
const offsetX = ref(0);
const revealed = ref(false);
const dragging = ref(false);

let touchStartX = 0;
let touchStartY = 0;
let isHorizontal = null;
let rafId = null;
let pendingX = null;

const REVEAL_WIDTH = 96;
const THRESHOLD = 40;

function isMobile() { return window.innerWidth <= 700; }

function applyOffset() {
  if (pendingX === null) return;
  offsetX.value = pendingX;
  pendingX = null;
  rafId = null;
}

function setOffset(x) {
  pendingX = Math.min(0, Math.max(-(REVEAL_WIDTH + 20), x));
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

  if (revealed.value) {
    setOffset(-REVEAL_WIDTH + dx);
  } else {
    if (dx >= 0) { setOffset(0); return; }
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
  const absX = Math.abs(current);

  if (revealed.value) {
    if (absX < REVEAL_WIDTH / 2) {
      revealed.value = false;
      setOffset(0);
    } else {
      setOffset(-REVEAL_WIDTH);
    }
  } else {
    if (absX > THRESHOLD) {
      revealed.value = true;
      setOffset(-REVEAL_WIDTH);
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
  revealed.value ? 1 : Math.min(1, Math.abs(offsetX.value) / REVEAL_WIDTH)
);
</script>

<template>
  <div
    ref="el"
    class="tx-item"
    :class="[
      { 'is-appearing': appearing, 'is-deleting': deleting, 'is-revealed': revealed },
    ]"
  >
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
        <img src="/img/icons/ui/edit.png" class="tab-icon-img" alt="Редактировать" />
      </button>
      <button
        class="tx-action-btn tx-action-delete"
        type="button"
        @click.stop="onDelete"
        aria-label="Удалить"
      >
        <img src="/img/icons/ui/delete.png" class="tab-icon-img" alt="Удалить" />
      </button>
    </div>

    <div
      class="tx-card"
      :style="itemStyle"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <div class="tx-avatar" :class="userClass">
        <img
          :src="userAvatar"
          alt="avatar"
          class="tx-avatar-img"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div class="tx-main">
        <div class="tx-name">{{ tx.name || 'Без названия' }}</div>
        <div class="tx-meta">
          <span class="who" @click.stop="onFilter('user', tx.user)">{{ displayUserName }}</span>
          <span class="cat" @click.stop="onFilter('category', tx.category)">
            <img
              :src="categoryIconPath"
              class="tx-cat-icon"
              alt=""
              loading="lazy"
              decoding="async"
            />
            {{ tx.category || 'Прочее' }}
          </span>
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

        <div class="tx-right-bottom">
          <div class="tx-actions-inline">
            <button
              class="tx-inline-btn tx-inline-edit"
              type="button"
              @click.stop="onEdit"
              title="Редактировать"
              aria-label="Редактировать"
            >
              <img src="/img/icons/ui/edit.png" class="tib-icon-img" alt="Редактировать" />
            </button>
            <button
              class="tx-inline-btn tx-inline-delete"
              type="button"
              @click.stop="onDelete"
              title="Удалить"
              aria-label="Удалить"
            >
              <img src="/img/icons/ui/delete.png" class="tib-icon-img" alt="Удалить" />
            </button>
          </div>

          <div
            class="tx-bank-coin"
            :class="'coin-' + bankType"
            :title="bankLabelText"
            @click.stop="tx.accountId && onFilter('account', tx.accountId)"
          >
            <img
              :src="bankIcon"
              class="tx-bank-coin-img"
              :alt="bankLabelText"
              loading="lazy"
              decoding="async"
            />
          </div>
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
  from { opacity: 0; transform: translateY(8px) scale(0.96); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

@keyframes txDelete {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to   { opacity: 0; transform: translateX(60px) scale(0.9); }
}

/* ============================================================
   ПАНЕЛЬ ДЕЙСТВИЙ (свайп на мобильном)
   ============================================================ */
.tx-actions-panel {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 96px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 8px;
  z-index: 0;
  pointer-events: none;

  background: linear-gradient(
    270deg,
    rgba(139, 92, 246, 0.14) 0%,
    rgba(139, 92, 246, 0.06) 100%
  );
  transition: opacity 0.15s linear;

  .tx-item.is-revealed & { pointer-events: auto; }
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

  &:active { transform: scale(0.92); }
}

.tab-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)) brightness(1.05);
}

.tx-action-edit {
  background: linear-gradient(180deg, #818cf8, #6366f1);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(29, 78, 216, 0.3) inset,
    0 4px 10px -2px rgba(99, 102, 241, 0.5);

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -2px 0 rgba(29, 78, 216, 0.3) inset,
      0 8px 16px -2px rgba(99, 102, 241, 0.7);
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

  background: var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-sizing: border-box;

  box-shadow: var(--shadow-md);

  will-change: transform;
  transition:
    transform 0.32s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.3s ease,
    border-color 0.25s ease,
    background 0.3s ease;

  &:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-lg);
  }
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
}

.tx-avatar.sergey {
  background: linear-gradient(180deg, rgba(147, 197, 253, 0.35), rgba(139, 92, 246, 0.35));
  border: 1.5px solid rgba(99, 102, 241, 0.55);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 4px 10px -2px rgba(99, 102, 241, 0.35);
}
.tx-avatar.sasha {
  background: linear-gradient(180deg, rgba(251, 207, 232, 0.35), rgba(253, 186, 116, 0.3));
  border: 1.5px solid rgba(236, 72, 153, 0.55);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 4px 10px -2px rgba(236, 72, 153, 0.35);
}

.tx-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ============================================================
   ТЕКСТ
   ============================================================ */
.tx-main { flex: 1; min-width: 0; position: relative; z-index: 2; }

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
  user-select: none;
  transition: color 0.15s ease;
  &:hover { color: var(--accent); }
}

.tx-meta .cat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 5px;
  border-radius: 999px;
  background: var(--panel-2);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  border: 1px solid var(--border);
  transition: all 0.18s ease;

  &:hover {
    background: var(--grad-primary);
    color: #ffffff;
    border-color: transparent;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -2px rgba(139, 92, 246, 0.5);

    .tx-cat-icon { filter: drop-shadow(0 0 6px rgba(255,255,255,0.5)); }
  }
}

/* ✅ PNG-иконка категории внутри бейджа */
.tx-cat-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  transition: filter 0.2s ease;
}

/* ============================================================
   ПРАВАЯ ЧАСТЬ
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

.tx-right-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tx-amount {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  border-radius: 8px;
  padding: 2px 8px;
  transition: all 0.2s ease;

  &.income {
    color: var(--accent-2);
    background: rgba(34, 197, 94, 0.12);
    text-shadow: 0 0 12px rgba(34, 197, 94, 0.35);
  }
  &.expense {
    color: var(--danger);
    background: rgba(244, 63, 94, 0.12);
    text-shadow: 0 0 12px rgba(244, 63, 94, 0.35);
  }

  &:hover { transform: scale(1.04); }

  &.flash-up { animation: amountFlashUp 0.9s ease-out; }
  &.flash-down { animation: amountFlashDown 0.9s ease-out; }
}

@keyframes amountFlashUp {
  0%   { background: rgba(34, 197, 94, 0.5); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}
@keyframes amountFlashDown {
  0%   { background: rgba(244, 63, 94, 0.5); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}

/* ============================================================
   ИНЛАЙН-КНОПКИ (ПК)
   ============================================================ */
.tx-actions-inline {
  display: none;
  align-items: center;
  gap: 6px;
}

.tx-inline-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;

  box-shadow: var(--shadow-sm);

  transition:
    transform 0.18s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.22s ease,
    background 0.15s ease,
    border-color 0.15s ease;

  &:active { transform: scale(0.94); }
}

.tib-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
  opacity: 0.8;
  transition: opacity 0.15s ease, transform 0.2s cubic-bezier(.34,1.56,.64,1);
}

.tx-inline-edit:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.5);
  transform: translateY(-2px);
  box-shadow:
    0 6px 14px -4px rgba(139, 92, 246, 0.4),
    0 0 0 1px rgba(139, 92, 246, 0.3);

  .tib-icon-img { opacity: 1; transform: translateY(-1px) rotate(-6deg) scale(1.1); }
}

.tx-inline-delete:hover {
  background: rgba(244, 63, 94, 0.15);
  border-color: rgba(244, 63, 94, 0.5);
  transform: translateY(-2px);
  box-shadow:
    0 6px 14px -4px rgba(244, 63, 94, 0.4),
    0 0 0 1px rgba(244, 63, 94, 0.3);

  .tib-icon-img { opacity: 1; transform: scale(1.12); }
}

@media (min-width: 701px) {
  .tx-actions-inline { display: inline-flex; }
}

/* ============================================================
   БАНК-МОНЕТА
   ============================================================ */
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

  background: #ffffff;
  border: 1px solid var(--border);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.08) inset,
    0 4px 10px -2px rgba(15, 23, 42, 0.18);

  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px) scale(1.06);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.08) inset,
      0 8px 18px -2px rgba(139, 92, 246, 0.4),
      0 0 0 1px var(--neon-purple);
  }
  &:active { transform: scale(0.95); }

  &.coin-tbank { border-color: rgba(234, 179, 8, 0.5); }
  &.coin-sber { border-color: rgba(33, 160, 56, 0.5); }
  &.coin-cash { border-color: rgba(34, 197, 94, 0.5); }
  &.coin-default { border-color: rgba(139, 92, 246, 0.5); }
}

.tx-bank-coin-img {
  width: 78%;
  height: 78%;
  object-fit: contain;
  display: block;
}

/* ============================================================
   ТЁМНАЯ ТЕМА
   ============================================================ */
:global(:root[data-app-theme="dark"]) {
  .tx-bank-coin {
    background: rgba(255, 255, 255, 0.95);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 -1px 0 rgba(0, 0, 0, 0.2) inset,
      0 4px 12px -2px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(139, 92, 246, 0.3);
  }

  .tx-inline-btn {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(139, 92, 246, 0.2);
  }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .tx-card { padding: 12px 14px; gap: 10px; border-radius: 14px; }
  .tx-avatar { flex: 0 0 38px; width: 38px; height: 38px; }
  .tx-name { font-size: 14px; }
  .tx-meta { font-size: 11px; gap: 5px; }
  .tx-meta .cat { font-size: 10px; padding: 2px 8px 2px 4px; gap: 4px; }
  .tx-cat-icon { width: 14px; height: 14px; }
  .tx-amount { font-size: 15px; }
  .tx-bank-coin { width: 26px; height: 26px; }
  .tx-actions-panel { width: 92px; }
  .tx-action-btn { width: 36px; height: 36px; }
  .tab-icon-img { width: 20px; height: 20px; }
}

@media (max-width: 380px) {
  .tx-bank-coin { width: 24px; height: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .tx-card,
  .tx-avatar,
  .tx-bank-coin,
  .tx-inline-btn,
  .tx-amount,
  .tib-icon-img { transition: none !important; }
  .tx-card:hover { transform: none; }
  .tx-inline-btn:hover { transform: none; }
  .tx-inline-btn:hover .tib-icon-img { transform: none; }
  .tx-amount.flash-up,
  .tx-amount.flash-down,
  .tx-item.is-appearing,
  .tx-item.is-deleting { animation: none !important; }
}
</style>