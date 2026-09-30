<!-- frontend/src/components/accounts/AccountsBlock.vue -->
<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAuthStore } from '@/stores/auth';
import { fmt } from '@/composables/useFormat';

const emit = defineEmits(['reconcile', 'user-menu']);
const accounts = useAccountsStore();
const auth = useAuthStore();

const LS_KEY = 'financeProAccountsExpanded_v1';

const userName = computed(() => auth.user || 'Сергей');
const displayName = computed(() => auth.displayName || userName.value);
const avatarUrl = computed(() => auth.avatar || null);
const userEmoji = computed(() => userName.value === 'Сергей' ? '👨' : '👩');
const totalBalance = computed(() => accounts.total);

function displayOwner(owner) {
  if (!owner) return '';
  if (owner === userName.value) return displayName.value;
  return owner;
}

const ownersSorted = computed(() => {
  const all = Object.keys(accounts.byOwner || {});
  const me = userName.value;
  return all.sort((a, b) => {
    if (a === me) return -1;
    if (b === me) return 1;
    return a.localeCompare(b, 'ru');
  });
});

const expandedOwners = ref({});

function isExpanded(owner) { return !!expandedOwners.value[owner]; }
function toggleOwner(owner) {
  expandedOwners.value = { ...expandedOwners.value, [owner]: !expandedOwners.value[owner] };
}
function ownerTotal(list) {
  return list.reduce((s, a) => s + (Number(a.value) || 0), 0);
}
function bankLogo(id) {
  if (!id) return null;
  if (id.startsWith('sber')) return '/img/sber.png';
  if (id.startsWith('tbank')) return '/img/tbank.png';
  return null;
}
function isMe(owner) { return owner === userName.value; }

const cardEl = ref(null);
const tilt = ref({ rx: 0, ry: 0, mx: 50, my: 50 });
const isTilting = ref(false);

const MAX_TILT = 10;
const RETURN_MS = 400;

function updateTilt(clientX, clientY) {
  const el = cardEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  const dx = (px - 0.5) * 2;
  const dy = (py - 0.5) * 2;
  tilt.value = {
    rx: -dy * MAX_TILT,
    ry: dx * MAX_TILT,
    mx: px * 100,
    my: py * 100,
  };
}

function onMouseMove(e) {
  isTilting.value = true;
  updateTilt(e.clientX, e.clientY);
}
function onMouseLeave() {
  isTilting.value = false;
  tilt.value = { rx: 0, ry: 0, mx: 50, my: 50 };
}
function onTouchStart(e) {
  if (e.touches.length !== 1) return;
  isTilting.value = true;
  updateTilt(e.touches[0].clientX, e.touches[0].clientY);
}
function onTouchMove(e) {
  if (e.touches.length !== 1) return;
  if (e.cancelable) e.preventDefault();
  updateTilt(e.touches[0].clientX, e.touches[0].clientY);
}
function onTouchEnd() {
  isTilting.value = false;
  tilt.value = { rx: 0, ry: 0, mx: 50, my: 50 };
}

const cardStyle = computed(() => {
  const t = tilt.value;
  return {
    transform: `perspective(1000px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) scale(${isTilting.value ? 1.02 : 1})`,
    transition: isTilting.value
      ? 'transform 0.05s linear'
      : `transform ${RETURN_MS}ms cubic-bezier(.34,1.56,.64,1)`,
  };
});

const shineStyle = computed(() => {
  const t = tilt.value;
  return {
    background: `radial-gradient(
      circle at ${t.mx}% ${t.my}%,
      rgba(255, 255, 255, 0.55) 0%,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 50%
    )`,
    opacity: isTilting.value ? 1 : 0,
    transition: isTilting.value
      ? 'opacity 0.15s linear'
      : `opacity ${RETURN_MS}ms ease`,
  };
});

onMounted(() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) expandedOwners.value = JSON.parse(saved) || {};
  } catch (e) {}
});

watch(expandedOwners, (val) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(val)); } catch (e) {}
}, { deep: true });
</script>

<template>
  <section class="accounts-block">
    <div
      ref="cardEl"
      class="debit-card"
      :class="{ 'is-tilting': isTilting, 'has-avatar': !!avatarUrl }"
      :style="cardStyle"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <!-- ============================================================
           ✅ ФОН: фото слева + фиолетовая часть с абстрактным срезом
           ============================================================ -->
      <div class="dc-bg" aria-hidden="true">
        <!-- Левая часть — фото -->
        <div class="dc-bg-photo">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" />
          <div v-else class="dc-bg-placeholder">
            <span class="dc-bg-emoji">{{ userEmoji }}</span>
          </div>

          <!-- Диагональные световые полосы -->
          <div class="dc-bg-stripes"></div>

          <!-- Вуаль -->
          <div class="dc-bg-photo-shade"></div>
        </div>

        <!-- ✅ Правая фиолетовая часть с АБСТРАКТНЫМ срезом -->
        <div class="dc-bg-solid"></div>
      </div>

      <!-- Атмосферные слои -->
      <div class="dc-shine-cursor" :style="shineStyle" aria-hidden="true"></div>
      <div class="dc-gloss" aria-hidden="true"></div>
      <div class="dc-pattern" aria-hidden="true"></div>
      <div class="dc-watermark" aria-hidden="true">₽</div>
      <div class="dc-frame" aria-hidden="true"></div>

      <!-- КОНТЕНТ -->
      <div class="dc-top">
        <div class="dc-issuer">
          <div class="dc-issuer-name">VAS FINANCE PRO+</div>
          <div class="dc-issuer-sub">дебетовая</div>
        </div>
      </div>

      <div class="dc-balance">
        <div class="dc-balance-value">{{ fmt(totalBalance) }} ₽</div>
      </div>

      <div class="dc-caption">ВАШ ОБЩИЙ БАЛАНС</div>

      <div class="dc-accounts">
        <div
          v-for="owner in ownersSorted"
          :key="owner"
          class="dc-owner-row"
          :class="{ 'is-me': isMe(owner), 'is-expanded': isExpanded(owner) }"
        >
          <button
            class="dc-owner-name"
            type="button"
            @click="toggleOwner(owner)"
          >
            <img
              v-if="isMe(owner) && avatarUrl"
              :src="avatarUrl"
              alt="avatar"
              class="dc-owner-avatar-img"
            />
            <span v-else class="dc-owner-emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
            <span class="dc-owner-text">{{ displayOwner(owner) }}</span>
            <span v-if="isMe(owner)" class="dc-owner-you">вы</span>
            <svg class="dc-owner-chev" :class="{ open: isExpanded(owner) }" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" fill="currentColor"/>
            </svg>
          </button>

          <div v-if="isExpanded(owner)" class="dc-chips">
            <button
              v-for="acc in accounts.byOwner[owner]"
              :key="acc.id"
              type="button"
              class="dc-chip"
              @click="emit('reconcile', acc)"
            >
              <img
                v-if="bankLogo(acc.id)"
                :src="bankLogo(acc.id)"
                class="dc-chip-logo"
                :alt="acc.name"
              />
              <span v-else class="dc-chip-logo-fallback">
                {{ acc.id.startsWith('sber') ? 'С' : 'Т' }}
              </span>
              <span class="dc-chip-value">{{ fmt(acc.value) }} ₽</span>
            </button>
          </div>

          <div v-else class="dc-owner-total">
            {{ fmt(ownerTotal(accounts.byOwner[owner])) }} ₽
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.accounts-block { display: flex; flex-direction: column; gap: 12px; }

.debit-card {
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  isolation: isolate;

  color: #ffffff;
  box-shadow:
    0 24px 48px -18px rgba(79, 70, 229, 0.65),
    0 12px 24px -10px rgba(139, 92, 246, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.15);

  display: flex;
  flex-direction: column;
  padding: 18px 20px 16px;
  gap: 10px;
  min-height: 240px;

  transform-style: preserve-3d;
  will-change: transform;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;

  &.is-tilting {
    box-shadow:
      0 30px 60px -20px rgba(79, 70, 229, 0.75),
      0 16px 32px -12px rgba(139, 92, 246, 0.55);
  }
}

/* ============================================================
   ФОН
   ============================================================ */
.dc-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: 22px;
}

.dc-bg-photo {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 55%;
  overflow: hidden;
}

.dc-bg-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  display: block;
  opacity: 0.82;
  filter: saturate(0.85) contrast(1.05) brightness(0.9);
}

.dc-bg-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #818cf8, #a5b4fc);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.82;
}
.dc-bg-emoji {
  font-size: 88px;
  line-height: 1;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.35));
}

/* Диагональные световые полосы поверх фото */
.dc-bg-stripes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      -30deg,
      rgba(255, 255, 255, 0) 0px,
      rgba(255, 255, 255, 0) 14px,
      rgba(255, 255, 255, 0.14) 14px,
      rgba(255, 255, 255, 0.14) 16px,
      rgba(255, 255, 255, 0) 16px,
      rgba(255, 255, 255, 0) 30px,
      rgba(139, 92, 246, 0.2) 30px,
      rgba(139, 92, 246, 0.2) 32px
    );
  mix-blend-mode: overlay;
  opacity: 0.85;
}

.dc-bg-photo-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(15, 23, 42, 0.4) 0%,
      rgba(15, 23, 42, 0.18) 25%,
      rgba(15, 23, 42, 0.05) 55%,
      rgba(15, 23, 42, 0.25) 100%
    ),
    linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.35) 0%,
      rgba(15, 23, 42, 0) 25%,
      rgba(15, 23, 42, 0) 65%,
      rgba(15, 23, 42, 0.45) 100%
    );
}

/* ============================================================
   ✅ Правая фиолетовая часть с АБСТРАКТНЫМ срезом
   Крупные диагональные «ступени» — не симметричные, абстрактные
   ============================================================ */
.dc-bg-solid {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 65%;
  background:
    radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.15), transparent 55%),
    radial-gradient(circle at 95% 100%, rgba(255, 255, 255, 0.1), transparent 60%),
    linear-gradient(135deg, #4338ca 0%, #6366f1 30%, #8b5cf6 60%, #4f46e5 100%);
  background-size: 100% 100%, 100% 100%, 300% 300%;
  animation: gradientShift 14s ease-in-out infinite;

  /* ✅ Абстрактный срез — 7 крупных нерегулярных «ступеней»
     Идут по диагонали сверху-слева к низу-справа */
  clip-path: polygon(
    22% 0%,                 /* верхний край — начало среза */
    100% 0%,
    100% 100%,
    18% 100%,               /* нижний край — конец среза */

    /* Абстрактные «ступени» — от верха к низу */
    8%  92%,                /* большая впадина */
    20% 84%,
    4%  74%,                /* глубокая впадина */
    18% 68%,
    2%  58%,                /* самая глубокая */
    22% 48%,
    6%  38%,
    20% 30%,
    8%  22%,
    26% 14%,
    14% 8%,
    22% 0%                  /* замыкаем на верх */
  );
}

@keyframes gradientShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

/* ============================================================
   Атмосферные слои
   ============================================================ */
.dc-shine-cursor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  mix-blend-mode: overlay;
}

.dc-gloss {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 40% at 20% 10%, rgba(255, 255, 255, 0.25), transparent 60%),
    radial-gradient(ellipse 50% 30% at 90% 100%, rgba(139, 92, 246, 0.4), transparent 60%);
  animation: glossRotate 12s ease-in-out infinite;
  pointer-events: none;
  z-index: 3;
  mix-blend-mode: overlay;
}
@keyframes glossRotate {
  0%, 100% { background-position: 0% 0%, 100% 100%; opacity: 0.9; }
  50%      { background-position: 100% 100%, 0% 0%; opacity: 1; }
}

.dc-pattern {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.035) 0 2px, transparent 2px 8px);
  pointer-events: none;
  z-index: 4;
  mix-blend-mode: overlay;
}

.dc-watermark {
  position: absolute;
  right: -10px;
  bottom: -30px;
  font-size: 140px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.06);
  line-height: 1;
  pointer-events: none;
  user-select: none;
  font-family: var(--mono);
  z-index: 4;
}

.dc-frame {
  position: absolute;
  inset: 6px;
  border-radius: 16px;
  border: 1.5px dashed rgba(255, 255, 255, 0.22);
  pointer-events: none;
  z-index: 5;
}

/* ============================================================
   КОНТЕНТ
   ============================================================ */
.dc-top {
  position: relative;
  z-index: 6;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.dc-issuer { text-align: right; min-width: 0; }
.dc-issuer-name {
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
}
.dc-issuer-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.8;
  margin-top: 2px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.dc-balance {
  position: relative;
  z-index: 6;
  margin-top: 12px;
  text-align: center;
}
.dc-balance-value {
  font-family: var(--mono);
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-shadow:
    0 6px 20px rgba(0, 0, 0, 0.65),
    0 2px 6px rgba(0, 0, 0, 0.5);
}
.dc-caption {
  position: relative;
  z-index: 6;
  text-align: center;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-top: -2px;
  margin-bottom: 4px;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
}

.dc-accounts {
  position: relative;
  z-index: 6;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dc-owner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dc-owner-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);

  &:hover { background: rgba(255, 255, 255, 0.25); transform: translateY(-1px); }
  &:active { transform: scale(0.97); }

  .is-me & {
    border-color: rgba(255, 255, 255, 0.6);
    font-weight: 800;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.4);
  }
}

.dc-owner-emoji { font-size: 13px; }
.dc-owner-avatar-img {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.dc-owner-text { line-height: 1; }
.dc-owner-you {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: #4f46e5;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: none;
}
.dc-owner-chev {
  width: 14px; height: 14px;
  margin-left: 2px;
  color: rgba(255, 255, 255, 0.85);
  transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);
  &.open { transform: rotate(180deg); }
}

.dc-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
  animation: chipsIn 0.25s ease;
}
@keyframes chipsIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);

  &:hover { background: rgba(255, 255, 255, 0.3); transform: translateY(-1px); }
  &:active { transform: scale(0.96); }
}

.dc-chip-logo {
  width: 18px; height: 18px;
  border-radius: 50%;
  object-fit: contain;
  background: #ffffff;
  padding: 1px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.dc-chip-logo-fallback {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #ffffff;
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
}
.dc-chip-value {
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.dc-owner-total {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #4f46e5;
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.35);
  animation: chipsIn 0.25s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .debit-card { padding: 14px 16px 12px; border-radius: 20px; gap: 8px; min-height: 200px; }

  .dc-bg-photo { width: 52%; }
  .dc-bg-solid { width: 62%; }
  .dc-bg-emoji { font-size: 64px; }

  .dc-issuer-name { font-size: 10.5px; letter-spacing: 0.12em; }
  .dc-issuer-sub { font-size: 8.5px; }

  .dc-balance { margin-top: 8px; }
  .dc-balance-value { font-size: 34px; }
  .dc-caption { font-size: 9.5px; letter-spacing: 0.12em; }

  .dc-accounts { gap: 5px; padding-top: 8px; margin-top: 4px; }
  .dc-owner-row { gap: 6px; }
  .dc-owner-name { font-size: 10.5px; padding: 3px 7px 3px 3px; }
  .dc-owner-emoji { font-size: 12px; }
  .dc-owner-avatar-img { width: 14px; height: 14px; }
  .dc-owner-chev { width: 12px; height: 12px; }
  .dc-chip { font-size: 11px; padding: 3px 9px 3px 3px; gap: 5px; }
  .dc-chip-logo,
  .dc-chip-logo-fallback { width: 16px; height: 16px; }
  .dc-chip-value { font-size: 11px; }
  .dc-owner-total { font-size: 11px; padding: 2px 9px; }
  .dc-watermark { font-size: 110px; bottom: -24px; right: -8px; }
}

@media (max-width: 380px) {
  .dc-bg-emoji { font-size: 52px; }
  .dc-balance-value { font-size: 28px; }
  .dc-issuer-name { font-size: 9.5px; }
  .dc-chips { gap: 4px; }
  .dc-chip { font-size: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .dc-bg-solid,
  .dc-gloss {
    animation: none !important;
  }
}
</style>