<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useFiltersStore } from '@/stores/filters';
import { useAuthStore } from '@/stores/auth';
import {
  fmt,
  categoryIcon,
  bankIconPath,
  bankLabel,
  AVATAR_MAN,
  AVATAR_WOMAN,
} from '@/composables/useFormat';

// ✅ Пути к иконкам — через :src, чтобы Vite не пытался резолвить
const ICON_EDIT   = '/img/icons/ui/edit.png';
const ICON_DELETE = '/img/icons/ui/delete.png';

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

const categoryIconPath = computed(() => categoryIcon(props.tx.category));

const userClass = computed(() => (props.tx.user === 'Сергей' ? 'sergey' : 'sasha'));
const displayUserName = computed(() => auth.nameFor(props.tx.user));

const userAvatar = computed(() => {
  if (props.tx.user === 'Сергей') return AVATAR_MAN;
  if (props.tx.user === 'Саша') return AVATAR_WOMAN;
  return AVATAR_MAN;
});

const bankIcon = computed(() => bankIconPath(props.tx.accountId));
const bankLabelText = computed(() => bankLabel(props.tx.accountId));

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
        <img :src="ICON_EDIT" class="tab-icon-img" alt="Редактировать" />
      </button>
      <button
        class="tx-action-btn tx-action-delete"
        type="button"
        @click.stop="onDelete"
        aria-label="Удалить"
      >
        <img :src="ICON_DELETE" class="tab-icon-img" alt="Удалить" />
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
              <img :src="ICON_EDIT" class="tib-icon-img" alt="Редактировать" />
            </button>
            <button
              class="tx-inline-btn tx-inline-delete"
              type="button"
              @click.stop="onDelete"
              title="Удалить"
              aria-label="Удалить"
            >
              <img :src="ICON_DELETE" class="tib-icon-img" alt="Удалить" />
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

<!-- Стили оставь без изменений из прошлой версии -->