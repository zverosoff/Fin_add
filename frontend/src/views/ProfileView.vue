<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';

import PageHero from '@/components/ui/PageHero.vue';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();
const toast = useToast();

const user = computed(() => auth.user || 'Сергей');
const userEmoji = computed(() => user.value === 'Сергей' ? '👨' : '👩');

const totalBalance = computed(() => accounts.total);
const accountsCount = computed(() => accounts.accounts.length);
const txCount = computed(() => accounts.transactions.length);

async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="profile-page">
    <PageHero title="Профиль" />

    <div class="profile-container">
      <!-- Карточка пользователя -->
      <div class="profile-card user-card">
        <div class="user-avatar">{{ userEmoji }}</div>
        <div class="user-info">
          <div class="user-name">{{ user }}</div>
          <div class="user-role">Пользователь приложения</div>
        </div>
      </div>

      <!-- Статистика -->
      <div class="profile-card stats-card">
        <h2 class="card-title">📊 Статистика</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Общий баланс</div>
            <div class="stat-value">{{ fmt(totalBalance) }} ₽</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Счетов</div>
            <div class="stat-value">{{ accountsCount }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Операций</div>
            <div class="stat-value">{{ txCount }}</div>
          </div>
        </div>
      </div>

      <!-- Действия -->
      <div class="profile-card actions-card">
        <h2 class="card-title">⚙️ Действия</h2>
        <button class="action-item danger" type="button" @click="handleLogout">
          <span class="action-icon">🚪</span>
          <span class="action-label">Выйти из аккаунта</span>
        </button>
      </div>

      <div class="hint">
        🚧 Раздел «Профиль» в разработке.<br>
        Здесь появятся: смена PIN, настройки, экспорт данных.
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  padding: 20px 20px 100px;
}

.profile-container {
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profile-card {
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
}

.card-title {
  font-size: 12px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin: 0 0 12px;
}

/* Карточка пользователя */
.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.06)), #ffffff;
}

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(139, 92, 246, 0.12));
  border: 2px solid rgba(56, 189, 248, 0.25);
  flex-shrink: 0;
}

.user-info { min-width: 0; }
.user-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
}
.user-role {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}

/* Статистика */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-item {
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.06), transparent);
  border: 1px solid var(--border);
}

.stat-label {
  font-size: 10.5px;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
  font-family: var(--mono);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Действия */
.actions-card {
  display: flex;
  flex-direction: column;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #f8fafc;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  text-align: left;

  &:hover {
    background: rgba(56, 189, 248, 0.08);
    border-color: var(--accent);
    color: var(--accent);
  }

  &.danger {
    color: var(--danger);
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.04);

    &:hover {
      background: rgba(239, 68, 68, 0.12);
      border-color: var(--danger);
      color: var(--danger);
    }
  }
}

.action-icon {
  font-size: 18px;
}

.action-label { flex: 1; }

.hint {
  padding: 14px 16px;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  background: rgba(148, 163, 184, 0.06);
  border-radius: 12px;
  border: 1px dashed var(--border);
  line-height: 1.5;
}

@media (max-width: 700px) {
  .profile-page { padding: 16px 12px 100px; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .stat-item:first-child { grid-column: 1 / -1; }
}
</style>