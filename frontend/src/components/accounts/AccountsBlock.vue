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

onMounted(async () => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) expandedOwners.value = JSON.parse(saved) || {};
  } catch (e) {}

  const allOwners = Object.keys(accounts.byOwner || {});
  for (const owner of allOwners) {
    if (owner !== userName.value) auth.loadPeerProfile(owner);
  }
});

watch(expandedOwners, (val) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(val)); } catch (e) {}
}, { deep: true });
</script>

<template>
  <section class="accounts-block">
    <div
      class="debit-card"
      :class="{ 'has-avatar': !!myAvatar }"
    >
      <div class="dc-bg" aria-hidden="true">
        <div class="dc-bg-photo">
          <template v-if="myAvatar">
            <!-- ✅ Слой Кен Бёрнса — медленный zoom + pan -->
            <div
              class="dc-photo-kenburns"
              :style="{ backgroundImage: `url(${myAvatar})` }"
            ></div>

            <!-- ✅ Слой глитча — поверх Кен Бёрнса -->
            <div
              class="dc-photo-glitch"
              :style="{ backgroundImage: `url(${myAvatar})` }"
            ></div>
          </template>
          <div v-else class="dc-bg-placeholder">
            <span class="dc-bg-emoji">{{ userName === 'Сергей' ? '👨' : '👩' }}</span>
          </div>

          <div class="dc-bg-stripes"></div>
          <div class="dc-bg-photo-shade"></div>
          <div class="dc-bg-scanlines"></div>
        </div>

        <!-- ✅ RGB-расслоение на границе -->
        <div class="dc-bg-chroma dc-bg-chroma-cyan"></div>
        <div class="dc-bg-chroma dc-bg-chroma-magenta"></div>

        <div class="dc-bg-solid"></div>
        <div class="dc-bg-ribbon"></div>
      </div>

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
  border-radius: 24px;
  overflow: hidden;
  isolation: isolate;
  contain: layout paint style;

  color: #ffffff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -1px 0 rgba(0, 0, 0, 0.15) inset,
    0 4px 8px rgba(79, 70, 229, 0.25),
    0 12px 28px -6px rgba(79, 70, 229, 0.35),
    0 28px 60px -20px rgba(15, 23, 42, 0.25);

  display: flex;
  flex-direction: column;
  padding: 18px 20px 16px;
  gap: 10px;
  min-height: 240px;

  user-select: none;
  -webkit-user-select: none;
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

/* ============================================================
   ✅ КЕН БЁРНС — медленный zoom + pan
   ============================================================ */
.dc-photo-kenburns {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 25%;
  background-repeat: no-repeat;
  opacity: 0.85;
  filter: saturate(0.9) contrast(1.05) brightness(0.92);
  transform: translateZ(0) scale(1.02);
  transform-origin: center 25%;
  will-change: transform;
  animation: kenBurns 20s ease-in-out infinite;
}

@keyframes kenBurns {
  0%   { transform: translateZ(0) scale(1.02) translate(0%, 0%); }
  25%  { transform: translateZ(0) scale(1.08) translate(-1.5%, -1%); }
  50%  { transform: translateZ(0) scale(1.12) translate(1.5%, 0.5%); }
  75%  { transform: translateZ(0) scale(1.08) translate(-1%, 1%); }
  100% { transform: translateZ(0) scale(1.02) translate(0%, 0%); }
}

/* ============================================================
   ✅ ГЛИТЧ — поверх Кен Бёрнса
   ============================================================ */
.dc-photo-glitch {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 25%;
  background-repeat: no-repeat;
  opacity: 0;
  mix-blend-mode: screen;
  pointer-events: none;
  will-change: opacity, filter;
  animation: glitchShift 6s steps(1, end) infinite;
}

@keyframes glitchShift {
  0%, 88%, 100% {
    opacity: 0;
    transform: translateX(0);
    filter: saturate(2.5) hue-rotate(-15deg) contrast(1.2);
  }
  89% {
    opacity: 0.85;
    transform: translateX(-3px);
    filter: saturate(3) hue-rotate(-25deg) contrast(1.3);
  }
  90% {
    opacity: 0.9;
    transform: translateX(3px);
    filter: saturate(3) hue-rotate(20deg) contrast(1.3);
  }
  91% {
    opacity: 0.85;
    transform: translateX(-2px);
    filter: saturate(3) hue-rotate(160deg) contrast(1.3);
  }
  92% {
    opacity: 0.9;
    transform: translateX(2px);
    filter: saturate(3) hue-rotate(200deg) contrast(1.3);
  }
  93% {
    opacity: 0.7;
    transform: translateX(-1px);
    filter: saturate(2.5) hue-rotate(90deg) contrast(1.2);
  }
  94% {
    opacity: 0.4;
    transform: translateX(1px);
    filter: saturate(2) hue-rotate(-90deg) contrast(1.1);
  }
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
  opacity: 0.6;
  z-index: 6;
}

.dc-bg-stripes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    -35deg,
    rgba(255, 255, 255, 0) 0px,
    rgba(255, 255, 255, 0) 12px,
    rgba(255, 255, 255, 0.12) 12px,
    rgba(255, 255, 255, 0.12) 14px
  );
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

/* ============================================================
   RGB-РАССЛОЕНИЕ
   ============================================================ */
.dc-bg-chroma {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.6;
  will-change: opacity;
}

.dc-bg-chroma-cyan {
  width: 70%;
  background: linear-gradient(
    180deg,
    rgba(0, 255, 255, 0.7) 0%,
    rgba(0, 255, 255, 0.4) 50%,
    rgba(0, 255, 255, 0.7) 100%
  );
  clip-path: polygon(21% 0%, 23% 0%, 9% 100%, 7% 100%);
  animation: chromaPulse 3s ease-in-out infinite;
}

.dc-bg-chroma-magenta {
  width: 70%;
  background: linear-gradient(
    180deg,
    rgba(255, 0, 255, 0.7) 0%,
    rgba(255, 0, 255, 0.4) 50%,
    rgba(255, 0, 255, 0.7) 100%
  );
  clip-path: polygon(22% 0%, 24% 0%, 10% 100%, 8% 100%);
  animation: chromaPulse 3s ease-in-out infinite 0.15s;
}

@keyframes chromaPulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.8; }
}

/* ============================================================
   ФИОЛЕТОВАЯ ЧАСТЬ
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
  clip-path: polygon(22% 0%, 100% 0%, 100% 100%, 8% 100%);
  z-index: 10;
}

.dc-bg-ribbon {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: screen;
  z-index: 11;
  background: linear-gradient(
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
    transparent 100%
  );
  clip-path: polygon(22% 0%, 100% 0%, 100% 100%, 8% 100%);
}

.dc-gloss {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 60% 40% at 20% 10%, rgba(255, 255, 255, 0.25), transparent 60%);
  pointer-events: none;
  z-index: 12;
  mix-blend-mode: overlay;
}

.dc-pattern {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.035) 0 2px, transparent 2px 8px);
  pointer-events: none;
  z-index: 13;
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
  z-index: 13;
}

.dc-frame {
  position: absolute;
  inset: 6px;
  border-radius: 16px;
  border: 1.5px dashed rgba(255, 255, 255, 0.22);
  pointer-events: none;
  z-index: 14;
}

/* ============================================================
   КОНТЕНТ
   ============================================================ */
.dc-top {
  position: relative;
  z-index: 15;
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
  z-index: 15;
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
  z-index: 15;
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
  z-index: 15;
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
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s, background 0.15s;
  white-space: nowrap;
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
}

.dc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);

  &:hover { background: rgba(255, 255, 255, 0.3); }
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
  background: rgba(255, 255, 255, 0.9);
  color: #4f46e5;
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.35);
}

/* ============================================================
   МОБИЛЬНЫЙ — всё то же, что и на ПК, только меньше размеры
   ============================================================ */
@media (max-width: 700px) {
  .debit-card { padding: 14px 16px 12px; border-radius: 20px; gap: 8px; min-height: 200px; }

  .dc-bg { inset: -14px -16px -12px; }

  .dc-bg-photo { width: 52%; }
  .dc-bg-solid { width: 68%; }
  .dc-bg-ribbon { width: 68%; }
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
}

@media (max-width: 380px) {
  .dc-bg-emoji { font-size: 52px; }
  .dc-balance-value { font-size: 28px; }
  .dc-issuer-name { font-size: 9.5px; }
  .dc-chips { gap: 4px; }
  .dc-chip { font-size: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .dc-photo-kenburns,
  .dc-photo-glitch,
  .dc-bg-chroma-cyan,
  .dc-bg-chroma-magenta {
    animation: none !important;
  }
  .dc-photo-kenburns {
    transform: translateZ(0) scale(1.05) !important;
  }
  .dc-photo-glitch {
    opacity: 0 !important;
  }
  .dc-bg-chroma-cyan,
  .dc-bg-chroma-magenta {
    opacity: 0.6 !important;
  }
}
</style>