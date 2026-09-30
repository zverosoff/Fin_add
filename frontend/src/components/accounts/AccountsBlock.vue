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
const totalBalance = computed(() => accounts.total);

function displayOwner(owner) {
  if (!owner) return '';
  return auth.nameFor(owner);
}

function ownerAvatar(owner) {
  return auth.avatarFor(owner);
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

const myAvatar = computed(() => auth.avatarFor(userName.value));

// ============================================================
// 3D-наклон
// ============================================================
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

onMounted(async () => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) expandedOwners.value = JSON.parse(saved) || {};
  } catch (e) {}

  const allOwners = Object.keys(accounts.byOwner || {});
  for (const owner of allOwners) {
    if (owner !== userName.value) {
      auth.loadPeerProfile(owner);
    }
  }
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
      :class="{ 'is-tilting': isTilting, 'has-avatar': !!myAvatar }"
      :style="cardStyle"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <div class="dc-bg" aria-hidden="true">
        <div class="dc-bg-photo">
          <template v-if="myAvatar">
            <!-- ✅ Основное фото -->
            <img :src="myAvatar" alt="" class="dc-photo-layer dc-photo-base" />

            <!-- ✅ Киберпанк-глитч: 4 слоя RGB + сдвиг -->
            <img :src="myAvatar" alt="" class="dc-photo-layer dc-photo-r" />
            <img :src="myAvatar" alt="" class="dc-photo-layer dc-photo-g" />
            <img :src="myAvatar" alt="" class="dc-photo-layer dc-photo-b" />
            <img :src="myAvatar" alt="" class="dc-photo-layer dc-photo-bw" />

            <!-- ✅ Цифровые артефакты (летающие блоки) -->
            <div class="dc-glitch-blocks">
              <span class="gblock gblock-1"></span>
              <span class="gblock gblock-2"></span>
              <span class="gblock gblock-3"></span>
              <span class="gblock gblock-4"></span>
              <span class="gblock gblock-5"></span>
            </div>

            <!-- ✅ Летающие «струны» кода -->
            <div class="dc-glitch-code">
              <span>10110</span>
              <span>11001</span>
              <span>01101</span>
            </div>

            <!-- ✅ Яркие горизонтальные полосы -->
            <div class="dc-glitch-bars">
              <span class="gbar gbar-1"></span>
              <span class="gbar gbar-2"></span>
              <span class="gbar gbar-3"></span>
            </div>
          </template>
          <div v-else class="dc-bg-placeholder">
            <span class="dc-bg-emoji">{{ userName === 'Сергей' ? '👨' : '👩' }}</span>
          </div>

          <div class="dc-bg-stripes"></div>
          <div class="dc-bg-photo-shade"></div>
          <div class="dc-bg-scanlines"></div>
          <div class="dc-bg-divider"></div>
        </div>

        <div class="dc-bg-solid"></div>
        <div class="dc-bg-ribbon"></div>
      </div>

      <div class="dc-shine-cursor" :style="shineStyle" aria-hidden="true"></div>
      <div class="dc-gloss" aria-hidden="true"></div>
      <div class="dc-pattern" aria-hidden="true"></div>
      <div class="dc-watermark" aria-hidden="true">₽</div>
      <div class="dc-frame" aria-hidden="true"></div>

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
              v-if="ownerAvatar(owner)"
              :src="ownerAvatar(owner)"
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

.dc-bg {
  position: absolute;
  inset: -18px -20px -16px;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.dc-bg-photo {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 55%;
  overflow: hidden;
}

/* ✅ Общий слой для всех img */
.dc-photo-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  display: block;
  will-change: transform, opacity;
}

/* Основной слой */
.dc-photo-base {
  opacity: 0.85;
  filter: saturate(0.9) contrast(1.05) brightness(0.92);
  animation: glitchBase 6s infinite;
}

/* Красный канал — сильно смещается вправо/влево */
.dc-photo-r {
  mix-blend-mode: screen;
  filter: saturate(4) hue-rotate(-25deg) contrast(1.3);
  opacity: 0;
  animation: glitchR 6s infinite;
}

/* Зелёный канал */
.dc-photo-g {
  mix-blend-mode: screen;
  filter: saturate(4) hue-rotate(90deg) contrast(1.3);
  opacity: 0;
  animation: glitchG 6s infinite;
}

/* Голубой канал */
.dc-photo-b {
  mix-blend-mode: screen;
  filter: saturate(4) hue-rotate(170deg) contrast(1.3);
  opacity: 0;
  animation: glitchB 6s infinite;
}

/* Чёрно-белый инвертированный слой */
.dc-photo-bw {
  mix-blend-mode: difference;
  filter: grayscale(1) invert(1) contrast(2);
  opacity: 0;
  animation: glitchBW 6s infinite;
}

/* ✅ Базовое фото слегка "дёргается" */
@keyframes glitchBase {
  0%, 88%, 100% { transform: translate(0, 0); }
  89% { transform: translate(-2px, 1px); }
  90% { transform: translate(3px, -1px); }
  91% { transform: translate(-3px, 0); }
  92% { transform: translate(2px, 1px); }
  93% { transform: translate(-1px, -2px); }
  94% { transform: translate(0, 0); }
}

/* ✅ Красный канал — рвётся в стороны */
@keyframes glitchR {
  0%, 88%, 100% { opacity: 0; transform: translate(0, 0); }
  89% { opacity: 1; transform: translate(-8px, -2px); }
  90% { opacity: 1; transform: translate(6px, 1px); }
  91% { opacity: 0.9; transform: translate(-4px, 0); }
  92% { opacity: 1; transform: translate(5px, -1px); }
  93% { opacity: 0.7; transform: translate(-6px, 2px); }
  94% { opacity: 0; transform: translate(0, 0); }
}

/* ✅ Зелёный канал */
@keyframes glitchG {
  0%, 88%, 100% { opacity: 0; transform: translate(0, 0); }
  89% { opacity: 0.9; transform: translate(4px, 2px); }
  90% { opacity: 1; transform: translate(-5px, -1px); }
  91% { opacity: 0.8; transform: translate(3px, 1px); }
  92% { opacity: 1; transform: translate(-3px, -2px); }
  93% { opacity: 0.6; transform: translate(4px, 0); }
  94% { opacity: 0; transform: translate(0, 0); }
}

/* ✅ Голубой канал */
@keyframes glitchB {
  0%, 88%, 100% { opacity: 0; transform: translate(0, 0); }
  89% { opacity: 1; transform: translate(8px, 2px); }
  90% { opacity: 1; transform: translate(-6px, -1px); }
  91% { opacity: 0.9; transform: translate(4px, 0); }
  92% { opacity: 1; transform: translate(-5px, 1px); }
  93% { opacity: 0.7; transform: translate(6px, -2px); }
  94% { opacity: 0; transform: translate(0, 0); }
}

/* ✅ Чёрно-белый инвертированный */
@keyframes glitchBW {
  0%, 88%, 100% { opacity: 0; transform: translate(0, 0); }
  89% { opacity: 0.5; transform: translate(12px, 0); }
  90% { opacity: 0.7; transform: translate(-14px, 0); }
  91% { opacity: 0.4; transform: translate(6px, 0); }
  92% { opacity: 0.6; transform: translate(-8px, 0); }
  93% { opacity: 0; transform: translate(0, 0); }
}

/* ============================================================
   ✅ ЦИФРОВЫЕ АРТЕФАКТЫ — летающие блоки
   ============================================================ */
.dc-glitch-blocks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  overflow: hidden;
}

.gblock {
  position: absolute;
  background: #00ffff;
  mix-blend-mode: difference;
  opacity: 0;
  height: 6px;
  border-radius: 1px;
}

.gblock-1 {
  top: 15%; left: 0;
  width: 40%;
  animation: gblockMove1 6s infinite;
}
.gblock-2 {
  top: 42%; left: 0;
  width: 65%;
  background: #ff00ff;
  animation: gblockMove2 6s infinite;
}
.gblock-3 {
  top: 58%; left: 0;
  width: 30%;
  background: #ff0055;
  height: 10px;
  animation: gblockMove3 6s infinite;
}
.gblock-4 {
  top: 78%; left: 0;
  width: 50%;
  background: #00ff88;
  animation: gblockMove4 6s infinite;
}
.gblock-5 {
  top: 30%; left: 0;
  width: 80%;
  background: #ffffff;
  height: 3px;
  animation: gblockMove5 6s infinite;
}

@keyframes gblockMove1 {
  0%, 88%, 100% { opacity: 0; transform: translateX(-100%); }
  89% { opacity: 1; transform: translateX(20%); }
  90% { opacity: 1; transform: translateX(60%); }
  91% { opacity: 1; transform: translateX(30%); }
  92% { opacity: 0.8; transform: translateX(80%); }
  93% { opacity: 0; transform: translateX(120%); }
}
@keyframes gblockMove2 {
  0%, 88%, 100% { opacity: 0; transform: translateX(100%); }
  89% { opacity: 1; transform: translateX(40%); }
  90% { opacity: 0.9; transform: translateX(10%); }
  91% { opacity: 1; transform: translateX(70%); }
  92% { opacity: 0; transform: translateX(-20%); }
}
@keyframes gblockMove3 {
  0%, 88%, 100% { opacity: 0; transform: translateX(-30%) scaleY(1); }
  89% { opacity: 1; transform: translateX(30%) scaleY(1.5); }
  90% { opacity: 1; transform: translateX(80%) scaleY(1); }
  91% { opacity: 0; transform: translateX(120%); }
}
@keyframes gblockMove4 {
  0%, 88%, 100% { opacity: 0; transform: translateX(50%); }
  89% { opacity: 1; transform: translateX(10%); }
  90% { opacity: 0.9; transform: translateX(70%); }
  91% { opacity: 0; transform: translateX(-40%); }
}
@keyframes gblockMove5 {
  0%, 88%, 100% { opacity: 0; transform: translateX(0); }
  89% { opacity: 1; transform: translateX(-10%); }
  90% { opacity: 0.8; transform: translateX(50%); }
  91% { opacity: 0; transform: translateX(100%); }
}

/* ============================================================
   ✅ ЛЕТАЮЩИЕ «СТРУНЫ» КОДА
   ============================================================ */
.dc-glitch-code {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  overflow: hidden;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  font-weight: 800;
  color: #00ffff;
  mix-blend-mode: screen;
  text-shadow: 0 0 6px #00ffff, 0 0 12px #00ffff;

  span {
    position: absolute;
    opacity: 0;
    white-space: nowrap;
    letter-spacing: 0.15em;
  }

  span:nth-child(1) {
    top: 22%;
    left: 8%;
    animation: codeFly1 6s infinite;
  }
  span:nth-child(2) {
    top: 52%;
    left: 20%;
    color: #ff00ff;
    text-shadow: 0 0 6px #ff00ff, 0 0 12px #ff00ff;
    animation: codeFly2 6s infinite;
  }
  span:nth-child(3) {
    top: 72%;
    left: 5%;
    color: #00ff88;
    text-shadow: 0 0 6px #00ff88, 0 0 12px #00ff88;
    animation: codeFly3 6s infinite;
  }
}

@keyframes codeFly1 {
  0%, 88%, 100% { opacity: 0; transform: translateY(20px); }
  89% { opacity: 1; transform: translateY(0); }
  90% { opacity: 1; transform: translateY(-4px); }
  91% { opacity: 1; transform: translateY(-10px); }
  92% { opacity: 0; transform: translateY(-30px); }
}
@keyframes codeFly2 {
  0%, 88%, 100% { opacity: 0; transform: translateY(15px); }
  89% { opacity: 0.9; transform: translateY(-2px); }
  90% { opacity: 1; transform: translateY(-8px); }
  91% { opacity: 0; transform: translateY(-25px); }
}
@keyframes codeFly3 {
  0%, 88%, 100% { opacity: 0; transform: translateY(10px); }
  89% { opacity: 1; transform: translateY(-3px); }
  90% { opacity: 0.8; transform: translateY(-12px); }
  91% { opacity: 0; transform: translateY(-28px); }
}

/* ============================================================
   ✅ ЯРКИЕ ГОРИЗОНТАЛЬНЫЕ ПОЛОСЫ
   ============================================================ */
.dc-glitch-bars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
}

.gbar {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  opacity: 0;
}

.gbar-1 {
  background: #00ffff;
  box-shadow: 0 0 8px #00ffff, 0 0 16px #00ffff;
  animation: gbarMove1 6s infinite;
}
.gbar-2 {
  background: #ff00ff;
  box-shadow: 0 0 8px #ff00ff, 0 0 16px #ff00ff;
  animation: gbarMove2 6s infinite;
}
.gbar-3 {
  background: #ffffff;
  box-shadow: 0 0 10px #ffffff;
  height: 4px;
  animation: gbarMove3 6s infinite;
}

@keyframes gbarMove1 {
  0%, 88%, 100% { top: 30%; opacity: 0; transform: scaleX(1); }
  89% { opacity: 1; transform: scaleX(1.1); }
  90% { top: 32%; opacity: 1; transform: scaleX(1.4); }
  91% { top: 34%; opacity: 0.8; transform: scaleX(1); }
  92% { opacity: 0; }
}
@keyframes gbarMove2 {
  0%, 88%, 100% { top: 60%; opacity: 0; transform: scaleX(1); }
  89% { opacity: 1; transform: scaleX(1.2); }
  90% { top: 62%; opacity: 1; transform: scaleX(1); }
  91% { top: 64%; opacity: 0.7; }
  92% { opacity: 0; }
}
@keyframes gbarMove3 {
  0%, 88%, 100% { top: 45%; opacity: 0; }
  89% { opacity: 1; }
  90% { top: 50%; opacity: 1; }
  91% { top: 55%; opacity: 0.9; }
  92% { top: 60%; opacity: 0; }
}

/* ============================================================
   ✅ Усиление глитча при наведении курсора
   ============================================================ */
.debit-card:hover .dc-photo-base { animation-duration: 1.5s; }
.debit-card:hover .dc-photo-r,
.debit-card:hover .dc-photo-g,
.debit-card:hover .dc-photo-b,
.debit-card:hover .dc-photo-bw { animation-duration: 1.5s; }
.debit-card:hover .gblock { animation-duration: 1.5s; }
.debit-card:hover .gbar { animation-duration: 1.5s; }
.debit-card:hover .dc-glitch-code span { animation-duration: 1.5s; }

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

.dc-bg-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 3px
  );
  mix-blend-mode: multiply;
  opacity: 0.7;
  z-index: 6;
}

.dc-bg-stripes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      -35deg,
      rgba(255, 255, 255, 0) 0px,
      rgba(255, 255, 255, 0) 12px,
      rgba(255, 255, 255, 0.12) 12px,
      rgba(255, 255, 255, 0.12) 14px
    );
  mix-blend-mode: overlay;
  opacity: 0.85;
  z-index: 7;
}

.dc-bg-photo-shade {
  position: absolute;
  inset: 0;
  z-index: 8;
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

/* ✅ Розовая полоса */
.dc-bg-divider {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 14%;
  pointer-events: none;
  z-index: 9;

  background: linear-gradient(
    160deg,
    rgba(236, 72, 153, 0.55) 0%,
    rgba(236, 72, 153, 0.4) 50%,
    rgba(168, 85, 247, 0.5) 100%
  );

  clip-path: polygon(
    100% 0%,
    100% 100%,
    0% 100%,
    0% 8%
  );

  filter: blur(0.6px);
  mix-blend-mode: screen;
  opacity: 0.9;
}

/* ============================================================
   Фиолетовая часть
   ============================================================ */
.dc-bg-solid {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  background:
    radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.15), transparent 55%),
    radial-gradient(circle at 95% 100%, rgba(255, 255, 255, 0.1), transparent 60%),
    linear-gradient(135deg, #4338ca 0%, #6366f1 30%, #8b5cf6 60%, #4f46e5 100%);
  background-size: 100% 100%, 100% 100%, 300% 300%;
  animation: gradientShift 14s ease-in-out infinite;

  clip-path: polygon(
    22% 0%,
    100% 0%,
    100% 100%,
    8% 100%
  );
}

@keyframes gradientShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

.dc-bg-ribbon {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  pointer-events: none;
  opacity: 0.6;
  mix-blend-mode: screen;

  background:
    linear-gradient(
      160deg,
      transparent 0%,
      transparent 14.5%,
      rgba(255, 255, 255, 0.3) 15%,
      rgba(255, 255, 255, 0.3) 16%,
      transparent 16.5%,
      transparent 20%,
      rgba(255, 255, 255, 0.18) 20.5%,
      rgba(255, 255, 255, 0.18) 21.5%,
      transparent 22%,
      transparent 26%,
      rgba(255, 255, 255, 0.12) 26.5%,
      rgba(255, 255, 255, 0.12) 27.2%,
      transparent 27.7%,
      transparent 100%
    );

  clip-path: polygon(
    22% 0%,
    100% 0%,
    100% 100%,
    8% 100%
  );
}

/* ============================================================
   Атмосферные слои
   ============================================================ */
.dc-shine-cursor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
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
  z-index: 10;
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
  z-index: 11;
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
  z-index: 11;
}

.dc-frame {
  position: absolute;
  inset: 6px;
  border-radius: 16px;
  border: 1.5px dashed rgba(255, 255, 255, 0.22);
  pointer-events: none;
  z-index: 12;
}

/* ============================================================
   КОНТЕНТ
   ============================================================ */
.dc-top {
  position: relative;
  z-index: 13;
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
  z-index: 13;
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
  z-index: 13;
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
  z-index: 13;
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
  width: 18px;
  height: 18px;
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
   МОБИЛЬНЫЙ — уменьшаем интенсивность глитча
   ============================================================ */
@media (max-width: 700px) {
  .debit-card { padding: 14px 16px 12px; border-radius: 20px; gap: 8px; min-height: 200px; }

  .dc-bg { inset: -14px -16px -12px; }

  .dc-bg-photo { width: 52%; }
  .dc-bg-solid { width: 68%; }
  .dc-bg-ribbon { width: 68%; }
  .dc-bg-divider { width: 16%; }
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
  .dc-owner-avatar-img { width: 16px; height: 16px; }
  .dc-owner-chev { width: 12px; height: 12px; }
  .dc-chip { font-size: 11px; padding: 3px 9px 3px 3px; gap: 5px; }
  .dc-chip-logo,
  .dc-chip-logo-fallback { width: 16px; height: 16px; }
  .dc-chip-value { font-size: 11px; }
  .dc-owner-total { font-size: 11px; padding: 2px 9px; }
  .dc-watermark { font-size: 110px; bottom: -24px; right: -8px; }

  /* ✅ На мобилке глитч — реже и слабее */
  .dc-photo-base,
  .dc-photo-r,
  .dc-photo-g,
  .dc-photo-b,
  .dc-photo-bw,
  .gblock,
  .gbar,
  .dc-glitch-code span { animation-duration: 10s; }

  .gblock-2,
  .gblock-4 { display: none; }
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
  .dc-photo-base,
  .dc-photo-r,
  .dc-photo-g,
  .dc-photo-b,
  .dc-photo-bw,
  .gblock,
  .gbar,
  .dc-glitch-code span {
    animation: none !important;
    opacity: 0 !important;
  }
  .dc-photo-base { opacity: 0.85 !important; }
}
</style>