<script setup>
import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useAuthStore } from '@/stores/auth';
import { fmt } from '@/composables/useFormat';

const emit = defineEmits(['reconcile', 'user-menu']);
const accounts = useAccountsStore();
const auth = useAuthStore();

// ── Данные для карточки ──
const userName = computed(() => auth.user || 'Сергей');
const userEmoji = computed(() => userName.value === 'Сергей' ? '👨' : '👩');
const totalBalance = computed(() => accounts.total);

// ── Счета по владельцу ──
const owners = computed(() => Object.keys(accounts.byOwner || {}));

function ownerTotal(list) {
  return list.reduce((s, a) => s + (Number(a.value) || 0), 0);
}

function bankLogo(id) {
  if (!id) return null;
  if (id.startsWith('sber')) return '/img/sber.png';
  if (id.startsWith('tbank')) return '/img/tbank.png';
  return null;
}
</script>

<template>
  <section class="accounts-block">
    <!-- ✅ Банковская карта — только баланс + имя + аватар -->
    <div class="bank-card">
      <div class="bc-top">
        <div class="bc-balance">
          <div class="bc-label">Общий баланс</div>
          <div class="bc-amount">{{ fmt(totalBalance) }} ₽</div>
          <div class="bc-sub">{{ userName }}, ваш баланс на сегодня</div>
        </div>
        <div class="bc-avatar">{{ userEmoji }}</div>
      </div>
    </div>

    <!-- ✅ Компактные счета — по владельцу, чипы -->
    <div class="owners">
      <div
        v-for="owner in owners"
        :key="owner"
        class="owner-row"
      >
        <button
          class="owner-name"
          type="button"
          :title="`Открыть меню: ${owner}`"
          @click="emit('user-menu', owner)"
        >
          <span class="owner-emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
          <span class="owner-text">{{ owner }}</span>
        </button>

        <div class="owner-chips">
          <button
            v-for="acc in accounts.byOwner[owner]"
            :key="acc.id"
            type="button"
            class="acct-chip"
            :class="acc.id.startsWith('sber') ? 'sber' : 'tbank'"
            :title="`Сверить: ${acc.name}`"
            @click="emit('reconcile', acc)"
          >
            <img
              v-if="bankLogo(acc.id)"
              :src="bankLogo(acc.id)"
              class="chip-logo"
              :alt="acc.name"
            />
            <span v-else class="chip-logo-fallback">
              {{ acc.id.startsWith('sber') ? 'С' : 'Т' }}
            </span>
            <span class="chip-value">{{ fmt(acc.value) }} ₽</span>
          </button>
        </div>

        <div class="owner-total">{{ fmt(ownerTotal(accounts.byOwner[owner])) }} ₽</div>
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
  padding: 22px 22px;
  min-height: 150px;
}

.bc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.bc-balance { min-width: 0; flex: 1; }

.bc-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.75;
}

.bc-amount {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 6px 0 8px;
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.bc-sub {
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.85;
  line-height: 1.3;
}

.bc-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  border: 2px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  flex-shrink: 0;
  box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.35);
}

/* ============================================================
   КОМПАКТНЫЕ СЧЕТА
   ============================================================ */
.owners {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.owner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.owner-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(56, 189, 248, 0.12);
    color: var(--accent);
  }
}

.owner-emoji { font-size: 13px; }
.owner-text { line-height: 1; }

.owner-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.acct-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover { transform: translateY(-1px); }
  &:active { transform: scale(0.96); }

  &.sber {
    background: rgba(33, 160, 56, 0.12);
    border-color: rgba(33, 160, 56, 0.32);

    .chip-value { color: #15803d; }

    &:hover {
      background: rgba(33, 160, 56, 0.2);
      box-shadow: 0 4px 12px -4px rgba(33, 160, 56, 0.5);
    }
  }

  &.tbank {
    background: rgba(255, 221, 45, 0.22);
    border-color: rgba(255, 191, 36, 0.45);

    .chip-value { color: #b45309; }

    &:hover {
      background: rgba(255, 221, 45, 0.35);
      box-shadow: 0 4px 12px -4px rgba(255, 191, 36, 0.6);
    }
  }
}

.chip-logo {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: contain;
  background: #fff;
  padding: 1px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.chip-logo-fallback {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
}

.chip-value {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
}

.owner-total {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(139, 92, 246, 0.08));
  border: 1px solid rgba(56, 189, 248, 0.25);
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .bank-card {
    padding: 18px 18px;
    min-height: 130px;
    border-radius: 20px;
  }

  .bc-label { font-size: 10px; }
  .bc-amount { font-size: 30px; margin: 4px 0 6px; }
  .bc-sub { font-size: 11.5px; }

  .bc-avatar {
    width: 52px;
    height: 52px;
    font-size: 28px;
  }

  .owners {
    padding: 10px 12px;
    border-radius: 14px;
    gap: 6px;
  }

  .owner-row { gap: 6px; }
  .owner-name { font-size: 11px; padding: 2px 6px 2px 3px; }
  .owner-emoji { font-size: 12px; }

  .acct-chip { font-size: 11px; padding: 3px 9px 3px 3px; gap: 4px; }
  .chip-logo, .chip-logo-fallback { width: 16px; height: 16px; }
  .chip-value { font-size: 11px; }

  .owner-total {
    font-size: 11px;
    padding: 2px 8px;
  }
}

@media (max-width: 380px) {
  .bc-amount { font-size: 26px; }
  .owner-chips { gap: 4px; }
  .acct-chip { font-size: 10px; }
}
</style>