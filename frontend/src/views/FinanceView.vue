<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();
const toast = useToast();
const { connect } = useWebSocket();

onMounted(async () => {
  try {
    await accounts.load();
    connect();
  } catch (e) {
    toast.error('Не удалось загрузить данные');
    console.error(e);
  }
});

async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}
</script>

<template>
  <div class="finance-page">
    <header class="top-bar">
      <h1>Финансы PRO+</h1>
      <div class="user-info">
        <span>👤 {{ auth.user }}</span>
        <button @click="handleLogout">Выйти</button>
      </div>
    </header>

    <div class="container">
      <section class="accounts-card">
        <h2>💳 Наши счета</h2>
        <div class="total">Итого: <strong>{{ fmt(accounts.total) }} ₽</strong></div>

        <div v-for="(list, owner) in accounts.byOwner" :key="owner" class="owner-group">
          <div class="owner-title">
            {{ owner === 'Сергей' ? '👨' : '👩' }} {{ owner }}
          </div>
          <div class="account-list">
            <div v-for="acc in list" :key="acc.id" class="account-item">
              <span class="bank-icon">
                {{ acc.id.startsWith('sber') ? '🟢' : '🟡' }}
              </span>
              <span class="bank-name">{{ acc.name }}</span>
              <span class="amount">{{ fmt(acc.value) }} ₽</span>
            </div>
          </div>
        </div>
      </section>

      <section class="transactions-card">
        <h2>📋 Операции</h2>
        <p v-if="accounts.transactions.length === 0" class="empty">
          Пока нет операций
        </p>
        <p v-else class="count">
          Найдено: {{ accounts.transactions.length }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-page {
  min-height: 100vh;
  padding: 20px;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 900px;
  margin: 0 auto 20px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: var(--shadow-md);

  h1 {
    font-size: 20px;
    margin: 0;
    background: linear-gradient(135deg, #0f172a, #0284c7);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;

  button {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      border-color: var(--danger);
      color: var(--danger);
    }
  }
}

.container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.accounts-card,
.transactions-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: var(--shadow-md);

  h2 {
    font-size: 14px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 14px;
  }
}

.total {
  font-size: 15px;
  margin-bottom: 16px;
  color: var(--muted);

  strong {
    color: var(--text);
    font-family: var(--mono);
    font-size: 18px;
  }
}

.owner-group {
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
}

.owner-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(241, 245, 249, 0.95);
  border-radius: 10px;

  .bank-icon { font-size: 16px; }
  .bank-name { flex: 1; font-weight: 600; }
  .amount {
    font-family: var(--mono);
    font-weight: 700;
  }
}

.empty {
  color: var(--muted);
  text-align: center;
  padding: 30px;
}
.count {
  color: var(--muted);
  font-size: 13px;
}
</style>