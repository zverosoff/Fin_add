<script setup>
import { ref, computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useFiltersStore } from '@/stores/filters';
import {
  fmt,
  categoryIcon,
  userEmoji,
  bankLogo,
  bankLabel,
} from '@/composables/useFormat';

const props = defineProps({
  tx: { type: Object, required: true },
});

const emit = defineEmits(['edit', 'delete']);

const accounts = useAccountsStore();
const filters = useFiltersStore();

// ============================================================
// Вычисляемые данные
// ============================================================

const accountName = computed(() => accounts.getAccountName(props.tx.accountId));
const bank = computed(() => accounts.getBank(props.tx.accountId));
const bankLogoUrl = computed(() => bankLogo(props.tx.accountId));

const amountSign = computed(() => (props.tx.type === 'income' ? '+' : '−'));
const amountClass = computed(() =>
  props.tx.type === 'income' ? 'income' : 'expense'
);

const icon = computed(() => categoryIcon(props.tx.category));

const userClass = computed(() =>
  props.tx.user === 'Сергей' ? 'sergey' : 'sasha'
);

// ============================================================
// Фильтры по клику
// ============================================================

function onFilter(key, value) {
  filters.toggle(key, value);
}

// ============================================================
// Свайпы (мобильные)
// ============================================================

const el = ref(null);
const offsetX = ref(0);
const swipeState = ref(null); // null | 'left' | 'right'

let touchStartX = 0;
let touchStartY = 0;
let isHorizontal = null;

function isMobile() {
  return window.innerWidth <= 700;
}

function onTouchStart(e) {
  if (!isMobile()) return;
  if (e.touches.length !== 1) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isHorizontal = null;
  offsetX.value = 0;
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
}

function onTouchEnd() {
  if (!isMobile()) return;

  if (!isHorizontal) {
    offsetX.value = 0;
    return;
  }

  const threshold = 55;

  if (offsetX.value <= -threshold) {
    swipeState.value = 'left';
    offsetX.value = -70;
    setTimeout(() => {
      swipeState.value = null;
      offsetX.value = 0;
      emit('delete', props.tx);
    }, 250);
  } else if (offsetX.value >= threshold) {
    swipeState.value = 'right';
    offsetX.value = 70;
    setTimeout(() => {
      swipeState.value = null;
      offsetX.value = 0;
      emit('edit', props.tx);
    }, 250);
  } else {
    offsetX.value = 0;
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
    :class="swipeState ? 'swipe-' + swipeState : ''"
    :style="itemStyle()"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Аватар: логотип банка или эмодзи -->
    <div
      class="tx-avatar bank-avatar"
      :class="[bank, userClass]"
    >
      <img
        v-if="bankLogoUrl"
        :src="bankLogoUrl"
        :alt="bankLabel(tx.accountId)"
        class="tx-bank-logo"
        loading="lazy"
        @error="(e) => (e.target.style.display = 'none')"
      />
      <span v-else>{{ userEmoji(tx.user) }}</span>
    </div>

    <!-- Основная информация -->
    <div class="tx-main">
      <div class="tx-name">{{ tx.name || 'Без названия' }}</div>
      <div class="tx-meta">
        <span
          class="who"
          :title="`Фильтр: ${tx.user}`"
          @click.stop="onFilter('user', tx.user)"
        >{{ tx.user }}</span>

        <span
          class="cat"
          :title="`Фильтр: ${tx.category}`"
          @click.stop="onFilter('category', tx.category)"
        >{{ icon }} {{ tx.category || 'Прочее' }}</span>

        <span
          v-if="tx.accountId"
          class="cat acc-badge"
          :class="bank"
          :title="`Фильтр: ${accountName}`"
          @click.stop="onFilter('account', tx.accountId)"
        >{{ accountName }}</span>
      </div>
    </div>

    <!-- Сумма и действия -->
    <div class="tx-right">
      <div
        class="tx-amount"
        :class="amountClass"
        :title="`Фильтр: ${tx.type === 'income' ? 'только доходы' : 'только расходы'}`"
        @click.stop="onFilter('type', tx.type)"
      >
        {{ amountSign }} {{ fmt(tx.amount) }} ₽
      </div>

      <div class="tx-actions">
        <button
          class="edit"
          type="button"
          title="Редактировать"
          @click.stop="emit('edit', tx)"
        >✏️</button>

        <button
          class="danger"
          type="button"
          title="Удалить"
          @click.stop="emit('delete', tx)"
        >🗑</button>
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
  transition: transform 0.25s cubic-bezier(.34, 1.56, .64, 1),
              border-color 0.15s ease,
              box-shadow 0.15s ease,
              background 0.15s ease;
  touch-action: pan-y;
  will-change: transform;
  overflow: hidden;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
}

/* ============================================================
   Свайпы (мобильные)
   ============================================================ */
.tx-item.swipe-left {
  border-color: rgba(239, 68, 68, 0.5);
}

.tx-item.swipe-right {
  border-color: rgba(59, 130, 246, 0.5);
}

/* Красный фон с корзиной при свайпе влево */
.tx-item.swipe-left::before {
  content: "🗑";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
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

/* Синий фон с карандашом при свайпе вправо */
.tx-item.swipe-right::before {
  content: "✏️";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
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

.tx-item > * {
  position: relative;
  z-index: 1;
}

/* ============================================================
   Аватар
   ============================================================ */
.tx-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  overflow: hidden;

  &.bank-avatar {
    background: #ffffff;
    border: 1px solid var(--border);
  }

  &.sergey {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.25),
      rgba(139, 92, 246, 0.25)
    );
  }

  &.sasha {
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.25),
      rgba(245, 158, 11, 0.25)
    );
  }

  &.bank-avatar.sber {
    border-color: rgba(33, 160, 56, 0.35);
  }

  &.bank-avatar.tbank {
    border-color: rgba(255, 191, 36, 0.45);
  }
}

.tx-bank-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 5px;
  border-radius: 50%;
  box-sizing: border-box;
}

/* ============================================================
   Основная информация
   ============================================================ */
.tx-main {
  min-width: 0;
}

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

  &:hover {
    color: var(--accent);
  }
}

.tx-meta .cat {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.12);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease,
              transform 0.15s ease, box-shadow 0.15s ease;
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

    &:hover {
      background: linear-gradient(135deg, #21a038, #4cd964);
      color: #ffffff;
      box-shadow: 0 6px 16px -6px rgba(33, 160, 56, 0.6);
    }
  }

  &.acc-badge.tbank {
    background: rgba(255, 221, 45, 0.25);
    color: #92400e;

    &:hover {
      background: linear-gradient(135deg, #fbbf24, #ffdd2d);
      color: #000000;
      box-shadow: 0 6px 16px -6px rgba(255, 191, 36, 0.6);
    }
  }
}

/* ============================================================
   Сумма и действия
   ============================================================ */
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
  transition: opacity 0.15s ease, transform 0.15s ease;
  user-select: none;

  &.income {
    color: #22c55e;
  }

  &.expense {
    color: #ef4444;
  }

  &:hover {
    opacity: 0.75;
    transform: scale(1.03);
  }
}

.tx-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tx-item:hover .tx-actions {
  opacity: 1;
}

.tx-actions button {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease,
              border-color 0.15s ease;
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

/* ============================================================
   Мобильная версия
   ============================================================ */
@media (max-width: 700px) {
  .tx-item {
    padding: 10px 12px;
    gap: 10px;
  }

  .tx-avatar {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }

  .tx-name {
    font-size: 14px;
  }

  .tx-meta {
    font-size: 11px;
    gap: 5px;
  }

  .tx-meta .cat {
    font-size: 10px;
    padding: 1px 7px;
  }

  .tx-amount {
    font-size: 15px;
  }

  /* На мобильных кнопки видны всегда */
  .tx-actions {
    opacity: 1;
  }

  .tx-actions button {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }
}
</style>