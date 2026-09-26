<!-- src/components/accounts/AccountsBlock.vue -->
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

const totalBalance = computed(() => accounts.total);
const totalCash = computed(() => accounts.totalCash);

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
    <div class="bank-card">
      <!-- Верх: общий баланс + аватар -->
      <div class="bc-top">
        <div class="bc-balance">
          <div class="bc-label">Ваш общий баланс</div>
          <div class="bc-amount">{{ fmt(totalBalance) }} ₽</div>

          <!-- ✅ НАЛИЧНЫЕ — только общая сумма -->
          <div class="bc-cash" :class="{ 'is-zero': totalCash === 0 }">
            <span class="bc-cash-icon">💵</span>
            <span class="bc-cash-label">Наличные</span>
            <span class="bc-cash-value">{{ fmt(totalCash) }} ₽</span>
          </div>
        </div>

        <div class="bc-avatar">
          <div class="bc-avatar-inner">{{ userEmoji }}</div>
        </div>
      </div>

      <!-- Низ: счета по владельцам -->
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
    </div>
  </section>
</template>

<style scoped lang="scss">
.accounts-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bank-card {
  position: relative;
  border-radius: 22px;
  overflow: hidden;

  background:
    radial-gradient(circle at 15% 0%, rgba(255, 255, 255, 0.18), transparent 55%),
    radial-gradient(circle at 95% 100%, rgba(255, 255, 255, 0.14), transparent 60%),
    linear-gradient(135deg, #06b6d4 0%, #3b82f6 30%, #7c3aed 60%, #06b6d4 100%);
  background-size: 100% 100%, 100% 100%, 300% 300%;
  animation: gradientShift 12s ease-in-out infinite;

  color: #ffffff;
  box-shadow:
    0 20px 40px -18px rgba(59, 130, 246, 0.6),
    0 10px 20px -10px rgba(124, 58, 237, 0.4);
  padding: 22px 22px 18px;
}

@keyframes gradientShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

.bc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
}

.bc-balance { min-width: 0; flex: 1; }

.bc-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.85;
}

.bc-amount {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-top: 6px;
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* ✅ НАЛИЧНЫЕ */
.bc-cash {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 5px 12px 5px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  transition: opacity 0.2s;

  &.is-zero {
    opacity: 0.7;
  }
}

.bc-cash-icon {
  font-size: 13px;
  line-height: 1;
}

.bc-cash-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
}

.bc-cash-value {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.bc-avatar {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow:
    0 10px 24px -8px rgba(0, 0, 0, 0.35),
    0 0 0 3px rgba(255, 255, 255, 0.35);
}

.bc-avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%);
}

.bc-accounts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.bc-owner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px;
  border-radius: 10px;
  transition: background 0.25s;

  &.is-me {
    background: transparent;
  }
}

.bc-owner-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 6px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-1px);
  }

  &:active { transform: scale(0.97); }

  .is-me & {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.5);
    color: #ffffff;
    font-weight: 800;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.35);
  }
}

.bc-owner-emoji { font-size: 13px; }
.bc-owner-text { line-height: 1; }

.bc-owner-you {
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

.bc-owner-chev {
  width: 14px;
  height: 14px;
  margin-left: 2px;
  color: rgba(255, 255, 255, 0.7);
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
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  &:hover {
    background: rgba(255, 255, 255, 0.35);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -6px rgba(0, 0, 0, 0.35);
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
  background: #ffffff;
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
  background: rgba(255, 255, 255, 0.9);
  color: #4f46e5;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.25);
  animation: chipsIn 0.25s ease;
}

@media (max-width: 700px) {
  .bank-card {
    padding: 18px 18px 14px;
    border-radius: 20px;
  }

  .bc-top { margin-bottom: 14px; gap: 10px; }

  .bc-label { font-size: 10px; }
  .bc-amount { font-size: 30px; margin-top: 4px; }

  .bc-cash {
    margin-top: 8px;
    padding: 4px 10px 4px 7px;
    gap: 5px;
  }
  .bc-cash-icon { font-size: 12px; }
  .bc-cash-label { font-size: 9.5px; }
  .bc-cash-value { font-size: 12px; }

  .bc-avatar {
    width: 54px;
    height: 54px;
  }
  .bc-avatar-inner { font-size: 28px; }

  .bc-accounts { gap: 6px; padding-top: 12px; }

  .bc-owner-row { gap: 6px; padding: 3px; }
  .bc-owner-name { font-size: 11px; padding: 3px 7px 3px 5px; }
  .bc-owner-emoji { font-size: 12px; }
  .bc-owner-chev { width: 12px; height: 12px; }

  .bc-chip { font-size: 11px; padding: 4px 10px 4px 4px; gap: 5px; }
  .bc-chip-logo,
  .bc-chip-logo-fallback { width: 16px; height: 16px; }
  .bc-chip-value { font-size: 11px; }

  .bc-owner-total {
    font-size: 11px;
    padding: 3px 10px;
  }
}

@media (max-width: 380px) {
  .bc-amount { font-size: 26px; }
  .bc-chips { gap: 4px; }
  .bc-chip { font-size: 10px; }
}
</style>