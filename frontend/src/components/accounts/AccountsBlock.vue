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
const totalBalance = computed(() => accounts.total);

const owners = computed(() => Object.keys(accounts.byOwner || {}));

function bankLogo(id) {
  if (!id) return null;
  if (id.startsWith('sber')) return '/img/sber.png';
  if (id.startsWith('tbank')) return '/img/tbank.png';
  return null;
}
</script>

<template>
  <section class="accounts-block">
    <div class="bank-card">
      <!-- Верх: баланс + аватар -->
      <div class="bc-top">
        <div class="bc-balance">
          <div class="bc-label">Общий баланс</div>
          <div class="bc-amount">{{ fmt(totalBalance) }} ₽</div>
        </div>
        <div class="bc-avatar">{{ userEmoji }}</div>
      </div>

      <!-- Низ: счета по владельцам -->
      <div class="bc-accounts">
        <div
          v-for="owner in owners"
          :key="owner"
          class="bc-owner-row"
        >
          <button
            class="bc-owner-name"
            type="button"
            @click="emit('user-menu', owner)"
          >
            <span class="bc-owner-emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
            <span class="bc-owner-text">{{ owner }}</span>
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
    linear-gradient(135deg, #06b6d4 0%, #3b82f6 45%, #7c3aed 100%);
  color: #ffffff;
  box-shadow:
    0 20px 40px -18px rgba(59, 130, 246, 0.6),
    0 10px 20px -10px rgba(124, 58, 237, 0.4);
  padding: 22px 22px 18px;
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
  opacity: 0.78;
}

.bc-amount {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-top: 4px;
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.bc-avatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  border: 2px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  flex-shrink: 0;
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.35);
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
}

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
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(6px);

  &:hover {
    background: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);
  }
}

.bc-owner-emoji { font-size: 13px; }
.bc-owner-text { line-height: 1; }

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
  .bc-amount { font-size: 30px; }

  .bc-avatar {
    width: 50px;
    height: 50px;
    font-size: 26px;
  }

  .bc-accounts { gap: 8px; padding-top: 12px; }

  .bc-owner-row { gap: 6px; }
  .bc-owner-name { font-size: 11px; padding: 2px 8px 2px 4px; }
  .bc-owner-emoji { font-size: 12px; }

  .bc-chip { font-size: 11px; padding: 4px 10px 4px 4px; gap: 5px; }
  .bc-chip-logo,
  .bc-chip-logo-fallback { width: 16px; height: 16px; }
  .bc-chip-value { font-size: 11px; }
}

@media (max-width: 380px) {
  .bc-amount { font-size: 26px; }
  .bc-chips { gap: 4px; }
  .bc-chip { font-size: 10px; }
}
</style>