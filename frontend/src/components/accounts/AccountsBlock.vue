<script setup>
import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAuthStore } from '@/stores/auth';
import { fmt } from '@/composables/useFormat';

const emit = defineEmits(['reconcile', 'user-menu']);
const accounts = useAccountsStore();
const auth = useAuthStore();

const userName = computed(() => auth.user || 'Сергей');
const userEmoji = computed(() => userName.value === 'Сергей' ? '👨' : '👩');

// ✅ Общий баланс (все счета всех пользователей)
const totalBalance = computed(() => accounts.total);

// ✅ Активный — первым
const ownersSorted = computed(() => {
  const all = Object.keys(accounts.byOwner || {});
  const me = userName.value;
  return all.sort((a, b) => {
    if (a === me) return -1;
    if (b === me) return 1;
    return a.localeCompare(b, 'ru');
  });
});

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

function onOwnerClick(owner) {
  if (isMe(owner)) return;
  emit('user-menu', owner);
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
          :class="{ 'is-me': isMe(owner) }"
        >
          <button
            class="bc-owner-name"
            :class="{ 'is-clickable': !isMe(owner) }"
            type="button"
            :disabled="isMe(owner)"
            @click="onOwnerClick(owner)"
          >
            <span class="bc-owner-emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
            <span class="bc-owner-text">{{ owner }}</span>
            <span v-if="isMe(owner)" class="bc-owner-you">вы</span>
          </button>

          <div class="bc-chips">
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

          <!-- ✅ Итог по владельцу справа -->
          <div class="bc-owner-total">
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
   БАНКОВСКАЯ КАРТА
   ============================================================ */
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

/* Аватар на белом фоне */
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

/* ============================================================
   СЧЕТА ВНУТРИ КАРТОЧКИ
   ============================================================ */
.bc-accounts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.bc-owner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
  padding: 4px;
  border-radius: 10px;
  transition: background 0.25s;

  &.is-me {
    background: rgba(255, 255, 255, 0.12);
  }
}

/* Имя владельца — pill */
.bc-owner-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 5px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: default;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(6px);

  /* ✅ Кликабельно только если НЕ вы */
  &.is-clickable {
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.28);
      transform: translateY(-1px);
    }
  }

  &:disabled {
    opacity: 1;
    cursor: default;
  }

  .is-me & {
    background: #ffffff;
    color: #4f46e5;
    border-color: #ffffff;
    box-shadow: 0 4px 12px -4px rgba(255, 255, 255, 0.6);
  }
}

.bc-owner-emoji { font-size: 13px; }
.bc-owner-text { line-height: 1; }

.bc-owner-you {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.15);
  color: #4f46e5;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Чипы счетов */
.bc-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
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

/* ✅ Итог по владельцу — pill справа */
.bc-owner-total {
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
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.25);
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .bank-card {
    padding: 18px 18px 14px;
    border-radius: 20px;
  }

  .bc-top { margin-bottom: 14px; gap: 10px; }

  .bc-label { font-size: 10px; }
  .bc-amount { font-size: 30px; margin-top: 4px; }

  .bc-avatar {
    width: 54px;
    height: 54px;
  }
  .bc-avatar-inner { font-size: 28px; }

  .bc-accounts { gap: 8px; padding-top: 12px; }

  .bc-owner-row { gap: 6px; padding: 3px; }
  .bc-owner-name { font-size: 11px; padding: 2px 8px 2px 4px; }
  .bc-owner-emoji { font-size: 12px; }

  .bc-chip { font-size: 11px; padding: 4px 10px 4px 4px; gap: 5px; }
  .bc-chip-logo,
  .bc-chip-logo-fallback { width: 16px; height: 16px; }
  .bc-chip-value { font-size: 11px; }

  .bc-owner-total {
    font-size: 11px;
    padding: 2px 8px;
  }
}

@media (max-width: 380px) {
  .bc-amount { font-size: 26px; }
  .bc-chips { gap: 4px; }
  .bc-chip { font-size: 10px; }
}
</style>