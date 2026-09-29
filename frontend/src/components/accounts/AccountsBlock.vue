<!-- frontend/src/components/accounts/AccountsBlock.vue -->
<script setup>
import { computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAuthStore } from '@/stores/auth';
import { fmt } from '@/composables/useFormat';

const emit = defineEmits(['reconcile', 'user-menu']);
const accounts = useAccountsStore();
const auth = useAuthStore();

const userName = computed(() => auth.user || 'Сергей');
const userEmoji = computed(() => userName.value === 'Сергей' ? '👨' : '👩');

// ✅ Имя владельца латиницей, капсом
const cardHolder = computed(() => {
  const u = userName.value;
  if (u === 'Сергей') return 'SERGEY';
  if (u === 'Саша') return 'SASHA';
  return String(u).toUpperCase();
});

// ✅ Срок действия — текущий месяц/год + 2 года
const cardExpiry = computed(() => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 2) % 100).padStart(2, '0');
  return `${mm}/${yy}`;
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

const expandedOwners = ref({});

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
      <!-- Чип -->
      <div class="dc-chip" aria-hidden="true">
        <div class="dc-chip-line"></div>
        <div class="dc-chip-line"></div>
        <div class="dc-chip-line"></div>
      </div>

      <!-- Логотип банка-эмитента -->
      <div class="dc-issuer">VAS FINANCE PRO+</div>

      <!-- Номер карты -->
      <div class="dc-number">
        <span class="dc-number-group">••••</span>
        <span class="dc-number-group">••••</span>
        <span class="dc-number-group">••••</span>
        <span class="dc-number-group dc-number-last">7777</span>
      </div>

      <!-- Баланс -->
      <div class="dc-balance">
        <div class="dc-balance-label">Ваш общий баланс</div>
        <div class="dc-balance-value">{{ fmt(totalBalance) }} ₽</div>
      </div>

      <!-- Владелец и срок -->
      <div class="dc-footer">
        <div class="dc-holder">
          <div class="dc-holder-label">Владелец</div>
          <div class="dc-holder-value">{{ cardHolder }}</div>
        </div>
        <div class="dc-expiry">
          <div class="dc-expiry-label">Действует до</div>
          <div class="dc-expiry-value">{{ cardExpiry }}</div>
        </div>
        <div class="dc-avatar">
          <div class="dc-avatar-inner">{{ userEmoji }}</div>
        </div>
      </div>
    </div>

    <!-- ✅ Счёта по владельцам (оставляем раскрывающиеся чипы) -->
    <div class="bc-accounts">
      <div
        v-for="owner in ownersSorted"
        :key="owner"
        class="bc-owner-row"
        :class="{ 'is-me': isMe(owner), 'is-expanded': isExpanded(owner) }"
      >
        <button
          class="bc-owner-name"
          type="button"
          @click="toggleOwner(owner)"
          :aria-expanded="isExpanded(owner)"
        >
          <span class="bc-owner-emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
          <span class="bc-owner-text">{{ owner }}</span>
          <span v-if="isMe(owner)" class="bc-owner-you">вы</span>
          <svg class="bc-owner-chev" :class="{ open: isExpanded(owner) }" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z" fill="currentColor"/>
          </svg>
        </button>

        <div v-if="isExpanded(owner)" class="bc-chips">
          <button
            v-for="acc in accounts.byOwner[owner]"
            :key="acc.id"
            type="button"
            class="bc-chip"
            @click="emit('reconcile', acc)"
          >
            <img
              v-if="bankLogo(acc.id)"
              :src="bankLogo(acc.id)"
              class="bc-chip-logo"
              :alt="acc.name"
            />
            <span v-else class="bc-chip-logo-fallback">
              {{ acc.id.startsWith('sber') ? 'С' : 'Т' }}
            </span>
            <span class="bc-chip-value">{{ fmt(acc.value) }} ₽</span>
          </button>
        </div>

        <div v-else class="bc-owner-total">
          {{ fmt(ownerTotal(accounts.byOwner[owner])) }} ₽
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
  aspect-ratio: 1.586 / 1;
  border-radius: 22px;
  padding: 20px 22px 18px;
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
  justify-content: space-between;
}

@keyframes gradientShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

/* Чип */
.dc-chip {
  position: absolute;
  top: 20px;
  left: 22px;
  width: 42px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.35),
    0 2px 6px -2px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 5px 0;
}

.dc-chip-line {
  height: 1px;
  background: rgba(120, 53, 15, 0.55);
  margin: 0 4px;
  border-radius: 1px;
}

/* Логотип */
.dc-issuer {
  position: absolute;
  top: 20px;
  right: 22px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.9;
  text-align: right;
  max-width: 55%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Номер карты */
.dc-number {
  position: relative;
  display: flex;
  gap: 14px;
  margin-top: 62px;
  font-family: var(--mono);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.dc-number-group { opacity: 0.85; }
.dc-number-last { opacity: 1; font-weight: 800; }

/* Баланс */
.dc-balance {
  position: relative;
  margin-top: auto;
  margin-bottom: 10px;
}

.dc-balance-label {
  font-size: 10px;
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

/* Футер: владелец, срок, аватар */
.dc-footer {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.dc-holder, .dc-expiry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dc-expiry { margin-left: auto; }

.dc-holder-label,
.dc-expiry-label {
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
}

.dc-holder-value,
.dc-expiry-value {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
    0 10px 24px -8px rgba(0, 0, 0, 0.35),
    0 0 0 3px rgba(255, 255, 255, 0.35);
  margin-left: auto;
}

.dc-avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%);
}

/* ============================================================
   СЧЕТА ПО ВЛАДЕЛЬЦАМ
   ============================================================ */
.bc-accounts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
}

.bc-owner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px;
  border-radius: 10px;
  transition: background 0.25s;
}

.bc-owner-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #f8fafc;
  color: var(--text);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    border-color: rgba(99, 102, 241, 0.4);
    color: #4f46e5;
    transform: translateY(-1px);
  }

  &:active { transform: scale(0.97); }

  .is-me & {
    border-color: rgba(99, 102, 241, 0.5);
    font-weight: 800;
    box-shadow: 0 0 0 1.5px rgba(99, 102, 241, 0.2);
  }
}

.bc-owner-emoji { font-size: 13px; }
.bc-owner-text { line-height: 1; }

.bc-owner-you {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #4f46e5;
  color: #ffffff;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bc-owner-chev {
  width: 14px;
  height: 14px;
  margin-left: 2px;
  color: var(--muted);
  transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);

  &.open { transform: rotate(180deg); }
}

.bc-chips {
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

.bc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: #f8fafc;
    border-color: rgba(99, 102, 241, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -6px rgba(15, 23, 42, 0.15);
  }

  &:active { transform: scale(0.96); }
}

.bc-chip-logo {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: contain;
  background: #ffffff;
  padding: 1px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.bc-chip-logo-fallback {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
}

.bc-chip-value {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.bc-owner-total {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #4f46e5;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid var(--border);
  animation: chipsIn 0.25s ease;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .debit-card {
    padding: 16px 18px 14px;
    border-radius: 20px;
  }

  .dc-chip { top: 16px; left: 18px; width: 36px; height: 28px; }
  .dc-issuer { top: 16px; right: 18px; font-size: 10px; letter-spacing: 0.12em; }

  .dc-number {
    margin-top: 54px;
    font-size: 16px;
    gap: 10px;
  }

  .dc-balance-label { font-size: 9px; }
  .dc-balance-value { font-size: 24px; }

  .dc-avatar { width: 38px; height: 38px; }
  .dc-avatar-inner { font-size: 18px; }
  .dc-holder-value, .dc-expiry-value { font-size: 11px; }

  .bc-accounts { gap: 6px; padding-top: 4px; }
  .bc-owner-row { gap: 6px; padding: 3px; }
  .bc-owner-name { font-size: 11px; padding: 3px 7px 3px 5px; }
  .bc-owner-emoji { font-size: 12px; }
  .bc-owner-chev { width: 12px; height: 12px; }

  .bc-chip { font-size: 11px; padding: 4px 10px 4px 4px; gap: 5px; }
  .bc-chip-logo,
  .bc-chip-logo-fallback { width: 16px; height: 16px; }
  .bc-chip-value { font-size: 11px; }

  .bc-owner-total { font-size: 11px; padding: 3px 10px; }
}

@media (max-width: 380px) {
  .dc-balance-value { font-size: 20px; }
  .dc-number { font-size: 14px; gap: 8px; }
  .bc-chips { gap: 4px; }
  .bc-chip { font-size: 10px; }
}
</style>