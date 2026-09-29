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
const userEmoji = computed(() => userName.value === 'Сергей' ? '👨' : '👩');

// ✅ Имя владельца латиницей, капсом
const cardHolder = computed(() => {
  const u = userName.value;
  if (u === 'Сергей') return 'SERGEY';
  if (u === 'Саша') return 'SASHA';
  return String(u).toUpperCase();
});

const totalBalance = computed(() => accounts.total);

const ownersSorted = computed(() => {
  const all = Object.keys(accounts.byOwner || {});
  const me = userName.value;
  return all.sort((a, b) => {
    if (a === me) return -1;
    if (b === me) return 1;
    return a.localeCompare(b, 'ru');
  });
});

// ✅ Раскрытие счетов сохраняется в localStorage
const expandedOwners = ref({});

onMounted(() => {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) expandedOwners.value = JSON.parse(saved) || {};
  } catch (e) {}
});

watch(expandedOwners, (val) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(val)); } catch (e) {}
}, { deep: true });

function isExpanded(owner) {
  return !!expandedOwners.value[owner];
}

function toggleOwner(owner) {
  expandedOwners.value = {
    ...expandedOwners.value,
    [owner]: !expandedOwners.value[owner],
  };
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

function isMe(owner) {
  return owner === userName.value;
}
</script>

<template>
  <section class="accounts-block">
    <!-- ✅ ДЕБЕТОВАЯ КАРТА -->
    <div class="debit-card">
      <!-- Верхняя строка: аватар слева, issuer справа -->
      <div class="dc-top">
        <div class="dc-avatar">
          <span class="dc-avatar-emoji">{{ userEmoji }}</span>
        </div>
        <div class="dc-issuer">
          <div class="dc-issuer-name">VAS FINANCE PRO+</div>
          <div class="dc-issuer-sub">дебетовая</div>
        </div>
      </div>

      <!-- Баланс -->
      <div class="dc-balance">
        <div class="dc-balance-label">Ваш общий баланс</div>
        <div class="dc-balance-value">{{ fmt(totalBalance) }} ₽</div>
      </div>

      <!-- Владелец -->
      <div class="dc-holder">
        <span class="dc-holder-label">Владелец</span>
        <span class="dc-holder-value">{{ cardHolder }}</span>
      </div>

      <!-- ✅ Счета по владельцам — ВНУТРИ карты -->
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
            :aria-expanded="isExpanded(owner)"
          >
            <span class="dc-owner-emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
            <span class="dc-owner-text">{{ owner }}</span>
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
.accounts-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ============================================================
   ДЕБЕТОВАЯ КАРТА
   ============================================================ */
.debit-card {
  position: relative;
  border-radius: 22px;
  padding: 18px 20px 16px;
  overflow: hidden;

  background:
    radial-gradient(circle at 15% 0%, rgba(255, 255, 255, 0.22), transparent 55%),
    radial-gradient(circle at 95% 100%, rgba(255, 255, 255, 0.14), transparent 60%),
    linear-gradient(135deg, #06b6d4 0%, #3b82f6 30%, #7c3aed 60%, #06b6d4 100%);
  background-size: 100% 100%, 100% 100%, 300% 300%;
  animation: gradientShift 12s ease-in-out infinite;

  color: #ffffff;
  box-shadow:
    0 24px 48px -18px rgba(59, 130, 246, 0.65),
    0 12px 24px -10px rgba(124, 58, 237, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.15);

  display: flex;
  flex-direction: column;
  gap: 10px;
}

@keyframes gradientShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

/* ============================================================
   ВЕРХ: аватар + issuer
   ============================================================ */
.dc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dc-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow:
    0 8px 20px -6px rgba(0, 0, 0, 0.4),
    0 0 0 3px rgba(255, 255, 255, 0.35);
}

.dc-avatar-emoji {
  font-size: 22px;
  line-height: 1;
}

.dc-issuer {
  text-align: right;
  min-width: 0;
}

.dc-issuer-name {
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.dc-issuer-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-top: 2px;
}

/* ============================================================
   БАЛАНС
   ============================================================ */
.dc-balance {
  margin-top: 4px;
}

.dc-balance-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.8;
}

.dc-balance-value {
  font-family: var(--mono);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-top: 4px;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* ============================================================
   ВЛАДЕЛЕЦ
   ============================================================ */
.dc-holder {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.dc-holder-label {
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
}

.dc-holder-value {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   СЧЕТА ВНУТРИ КАРТЫ
   ============================================================ */
.dc-accounts {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
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
  padding: 4px 8px 4px 6px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.97); }

  .is-me & {
    border-color: rgba(255, 255, 255, 0.55);
    font-weight: 800;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.35);
  }
}

.dc-owner-emoji { font-size: 13px; }
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
}

.dc-owner-chev {
  width: 14px;
  height: 14px;
  margin-left: 2px;
  color: rgba(255, 255, 255, 0.75);
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
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  &:hover {
    background: rgba(255, 255, 255, 0.32);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -6px rgba(0, 0, 0, 0.35);
  }
  &:active { transform: scale(0.96); }
}

.dc-chip-logo {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: contain;
  background: #ffffff;
  padding: 1px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.dc-chip-logo-fallback {
  width: 18px;
  height: 18px;
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
  background: rgba(255, 255, 255, 0.92);
  color: #4f46e5;
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.25);
  animation: chipsIn 0.25s ease;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .debit-card {
    padding: 14px 16px 12px;
    border-radius: 20px;
    gap: 8px;
  }

  .dc-avatar { width: 38px; height: 38px; }
  .dc-avatar-emoji { font-size: 18px; }

  .dc-issuer-name { font-size: 10.5px; letter-spacing: 0.12em; }
  .dc-issuer-sub { font-size: 8.5px; }

  .dc-balance-label { font-size: 9px; }
  .dc-balance-value { font-size: 26px; }

  .dc-holder-label { font-size: 8px; }
  .dc-holder-value { font-size: 12px; }

  .dc-accounts { gap: 5px; padding-top: 8px; margin-top: 4px; }
  .dc-owner-row { gap: 6px; }
  .dc-owner-name { font-size: 10.5px; padding: 3px 7px 3px 5px; }
  .dc-owner-emoji { font-size: 12px; }
  .dc-owner-chev { width: 12px; height: 12px; }

  .dc-chip { font-size: 11px; padding: 3px 9px 3px 3px; gap: 5px; }
  .dc-chip-logo,
  .dc-chip-logo-fallback { width: 16px; height: 16px; }
  .dc-chip-value { font-size: 11px; }

  .dc-owner-total { font-size: 11px; padding: 2px 9px; }
}

@media (max-width: 380px) {
  .dc-balance-value { font-size: 22px; }
  .dc-issuer-name { font-size: 9.5px; }
  .dc-chips { gap: 4px; }
  .dc-chip { font-size: 10px; }
}
</style>