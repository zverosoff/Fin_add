<script setup>
import { computed, ref } from 'vue';
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
const userInitials = computed(() => {
  const name = user.value;
  return name.slice(0, 1).toUpperCase() + (name === 'Сергей' ? 'С' : 'А');
});
const userEmail = computed(() =>
  user.value === 'Сергей' ? 'sergey@finance.pro' : 'sasha@finance.pro'
);
const userPhone = computed(() =>
  user.value === 'Сергей' ? '+7 900 123-45-67' : '+7 900 987-65-43'
);

const lastLogin = ref(
  new Date().toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
);

const alertsEnabled = ref(true);
const emailNotifications = ref(true);

const totalBalance = computed(() => accounts.total);
const accountsCount = computed(() => accounts.accounts.length);
const txCount = computed(() => accounts.transactions.length);

function toggleAlerts() {
  alertsEnabled.value = !alertsEnabled.value;
  toast.info(alertsEnabled.value ? '🔔 Уведомления включены' : '🔕 Уведомления выключены');
}

function toggleEmail() {
  emailNotifications.value = !emailNotifications.value;
  toast.info(emailNotifications.value ? '📧 Email-уведомления вкл' : '📧 Email-уведомления выкл');
}

async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}

function soon(feature) {
  toast.info(`🚧 «${feature}» — в разработке`);
}

// ✅ «Мои счета» — карточки банков
const myAccounts = computed(() => accounts.accounts || []);

function accountStatus(acc) {
  // фейковый статус для визуала
  if (acc.value > 0) return { label: 'Активен', cls: 'active' };
  return { label: 'Спит', cls: 'sleep' };
}
</script>

<template>
  <div class="profile-page">
    <PageHero title="Профиль" />

    <div class="profile-layout">

      <!-- ══════════════════════════════════════════════════════
           ЛЕВАЯ КОЛОНКА — карточка пользователя
           ══════════════════════════════════════════════════════ -->
      <aside class="profile-col profile-col-left">

        <!-- КАРТОЧКА ПРОФИЛЯ -->
        <div class="pcard pcard-user">
          <!-- Аватар -->
          <div class="pu-avatar-wrap">
            <div class="pu-avatar">
              <span class="pu-avatar-emoji">{{ userEmoji }}</span>
            </div>
            <button
              class="pu-avatar-edit"
              type="button"
              @click="soon('Загрузка аватара')"
              title="Изменить аватар"
            >📷</button>
          </div>

          <!-- Имя / Email -->
          <div class="pu-head">
            <div class="pu-name">{{ user }}</div>
            <div class="pu-role">Пользователь приложения</div>
          </div>

          <!-- Метаданные -->
          <div class="pu-meta">
            <div class="pu-meta-row">
              <span class="pu-meta-icon">🕐</span>
              <span class="pu-meta-text">Последний вход: {{ lastLogin }}</span>
            </div>
            <div class="pu-meta-row">
              <span class="pu-meta-icon">📍</span>
              <span class="pu-meta-text">Россия · UTC+3</span>
            </div>
          </div>

          <!-- Поля -->
          <div class="pu-fields">
            <div class="pu-field">
              <div class="pu-field-label">Имя</div>
              <div class="pu-field-value">
                {{ user }}
                <button class="pu-field-edit" @click="soon('Смена имени')">✏️</button>
              </div>
            </div>
            <div class="pu-field">
              <div class="pu-field-label">Телефон</div>
              <div class="pu-field-value">
                {{ userPhone }}
                <button class="pu-field-edit" @click="soon('Смена телефона')">✏️</button>
              </div>
            </div>
            <div class="pu-field">
              <div class="pu-field-label">Email</div>
              <div class="pu-field-value">
                {{ userEmail }}
                <button class="pu-field-edit" @click="soon('Смена email')">✏️</button>
              </div>
            </div>
          </div>

          <!-- Переключатель SMS -->
          <div class="pu-switch-row" @click="toggleAlerts">
            <div class="pu-switch-info">
              <span class="pu-switch-icon">🔔</span>
              <span class="pu-switch-label">SMS-уведомления</span>
            </div>
            <div class="pu-switch" :class="{ on: alertsEnabled }">
              <div class="pu-switch-knob"></div>
            </div>
          </div>

          <!-- Кнопка сохранить -->
          <button class="pu-save" type="button" @click="soon('Сохранение')">
            <span>💾</span>
            <span>Сохранить</span>
          </button>
        </div>

        <!-- МИНИ-СТАТИСТИКА -->
        <div class="pcard pcard-stats">
          <div class="ps-head">📊 Статистика</div>
          <div class="ps-grid">
            <div class="ps-item">
              <div class="ps-label">Баланс</div>
              <div class="ps-value">{{ fmt(totalBalance) }} ₽</div>
            </div>
            <div class="ps-item">
              <div class="ps-label">Счетов</div>
              <div class="ps-value">{{ accountsCount }}</div>
            </div>
            <div class="ps-item">
              <div class="ps-label">Операций</div>
              <div class="ps-value">{{ txCount }}</div>
            </div>
          </div>
        </div>

        <!-- ОПАСНАЯ ЗОНА -->
        <div class="pcard pcard-danger">
          <button class="pd-btn" type="button" @click="handleLogout">
            <span class="pd-icon">🚪</span>
            <span class="pd-label">Выйти из аккаунта</span>
          </button>
        </div>
      </aside>

      <!-- ══════════════════════════════════════════════════════
           ПРАВАЯ КОЛОНКА — счета + доп. карточки
           ══════════════════════════════════════════════════════ -->
      <main class="profile-col profile-col-right">

        <!-- МОИ СЧЕТА -->
        <div class="pcard pcard-accounts">
          <div class="pca-head">
            <div class="pca-title">💳 Мои счета</div>
            <div class="pca-actions">
              <button
                class="pca-btn-ghost"
                type="button"
                @click="soon('Поиск счёта')"
                title="Поиск"
              >🔍</button>
              <button
                class="pca-btn-primary"
                type="button"
                @click="soon('Добавление счёта')"
              >Добавить</button>
            </div>
          </div>

          <div class="pca-list">
            <div
              v-for="acc in myAccounts"
              :key="acc.id"
              class="pca-row"
            >
              <div class="pca-icon">
                <img
                  v-if="acc.id.startsWith('sber')"
                  src="/img/sber.png"
                  alt="Sber"
                />
                <img
                  v-else-if="acc.id.startsWith('tbank')"
                  src="/img/tbank.png"
                  alt="TBank"
                />
                <span v-else>💳</span>
              </div>

              <div class="pca-info">
                <div class="pca-name">{{ acc.name }}</div>
                <div class="pca-num">•••• {{ (acc.owner === 'Сергей' ? '4821' : '7395') }}</div>
              </div>

              <div class="pca-balance">{{ fmt(acc.value) }} ₽</div>

              <span class="pca-badge" :class="accountStatus(acc).cls">
                {{ accountStatus(acc).label }}
              </span>

              <button
                class="pca-more"
                type="button"
                @click="soon('Детали счёта')"
                title="Подробнее"
              >⋯</button>
            </div>

            <div v-if="myAccounts.length === 0" class="pca-empty">
              Пока нет счетов
            </div>
          </div>
        </div>

        <!-- БЛИЖАЙШИЕ ПЛАТЕЖИ (в разработке) -->
        <div class="pcard pcard-bills">
          <div class="pca-head">
            <div class="pca-title">🔔 Ближайшие счета</div>
            <button
              class="pca-btn-ghost pca-btn-filter"
              type="button"
              @click="soon('Фильтр счетов')"
            >Filter by</button>
          </div>

          <div class="pca-list">
            <div class="bill-row">
              <span class="bill-dot" style="background:#22c55e"></span>
              <span class="bill-name">Phone bill</span>
              <span class="bill-badge week">через неделю</span>
            </div>
            <div class="bill-row">
              <span class="bill-dot" style="background:#ef4444"></span>
              <span class="bill-name">Internet bill</span>
              <span class="bill-badge soon">через 2 дня</span>
            </div>
            <div class="bill-row">
              <span class="bill-dot" style="background:#10b981"></span>
              <span class="bill-name">Houser rent</span>
              <span class="bill-badge week">через неделю</span>
            </div>
            <div class="bill-row">
              <span class="bill-dot" style="background:#f59e0b"></span>
              <span class="bill-name">Income tax</span>
              <span class="bill-badge week">через неделю</span>
            </div>
          </div>

          <div class="bill-hint">
            🚧 Скоро здесь будут твои реальные платежи и напоминания.
          </div>
        </div>

        <!-- СОЦИАЛЬНОЕ ВЗАИМОДЕЙСТВИЕ (заглушка) -->
        <div class="pcard pcard-social">
          <div class="pca-head">
            <div class="pca-title">👥 Социальное</div>
          </div>

          <div class="social-grid">
            <button class="social-btn" type="button" @click="soon('Друзья')">
              <span class="social-icon">🤝</span>
              <span class="social-label">Друзья</span>
              <span class="social-badge">в разработке</span>
            </button>
            <button class="social-btn" type="button" @click="soon('Общие цели')">
              <span class="social-icon">🎯</span>
              <span class="social-label">Общие цели</span>
              <span class="social-badge">в разработке</span>
            </button>
            <button class="social-btn" type="button" @click="soon('Приглашения')">
              <span class="social-icon">✉️</span>
              <span class="social-label">Приглашения</span>
              <span class="social-badge">в разработке</span>
            </button>
            <button class="social-btn" type="button" @click="soon('Настройки приватности')">
              <span class="social-icon">🔒</span>
              <span class="social-label">Приватность</span>
              <span class="social-badge">в разработке</span>
            </button>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  padding: 20px 20px 40px;
}

.profile-layout {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 20px;
  align-items: start;
}

.profile-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.profile-col-left {
  position: sticky;
  top: 20px;
}

/* ============================================================
   ОБЩИЙ СТИЛЬ КАРТОЧЕК
   ============================================================ */
.pcard {
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 10px 30px -12px rgba(15, 23, 42, 0.12);
  padding: 22px;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 14px 40px -14px rgba(15, 23, 42, 0.16);
  }
}

/* ============================================================
   КАРТОЧКА ПРОФИЛЯ
   ============================================================ */
.pcard-user {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pu-avatar-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 4px 0 8px;
}

.pu-avatar {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.6), transparent 55%),
    linear-gradient(135deg, #3b82f6 0%, #6366f1 45%, #8b5cf6 100%);
  box-shadow:
    0 18px 40px -14px rgba(99, 102, 241, 0.65),
    0 0 0 6px rgba(255, 255, 255, 1),
    0 0 0 8px rgba(99, 102, 241, 0.15);
}

.pu-avatar-emoji {
  font-size: 54px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}

.pu-avatar-edit {
  position: absolute;
  right: calc(50% - 65px);
  bottom: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px -6px rgba(99, 102, 241, 0.7);
  transition: transform 0.15s;

  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.95); }
}

.pu-head {
  text-align: center;
}

.pu-name {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.02em;
}

.pu-role {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}

.pu-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.03));
  border: 1px solid rgba(99, 102, 241, 0.1);
}

.pu-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted);
}

.pu-meta-icon { font-size: 12px; }
.pu-meta-text { font-weight: 600; }

/* Поля */
.pu-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pu-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pu-field-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.pu-field-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid var(--border);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    background: #ffffff;
    border-color: rgba(99, 102, 241, 0.35);
  }
}

.pu-field-edit {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;

  &:hover { background: rgba(99, 102, 241, 0.1); }
}

/* Переключатель */
.pu-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;

  &:hover { border-color: rgba(99, 102, 241, 0.35); }
}

.pu-switch-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.pu-switch-icon { font-size: 14px; }

.pu-switch {
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: #cbd5e1;
  padding: 3px;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;

  &.on {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);

    .pu-switch-knob { transform: translateX(18px); }
  }
}

.pu-switch-knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);
}

/* Кнопка сохранить */
.pu-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%);
  color: #ffffff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 12px 28px -10px rgba(244, 63, 94, 0.6);
  transition: all 0.18s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 34px -10px rgba(244, 63, 94, 0.8);
  }

  &:active { transform: scale(0.98); }
}

/* ============================================================
   МИНИ-СТАТИСТИКА
   ============================================================ */
.pcard-stats {
  padding: 16px 18px;
}

.ps-head {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.ps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.ps-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.04));
  border: 1px solid rgba(99, 102, 241, 0.12);
  text-align: center;
}

.ps-label {
  font-size: 9.5px;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.ps-value {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  font-family: var(--mono);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   ОПАСНАЯ ЗОНА
   ============================================================ */
.pcard-danger {
  padding: 12px;
}

.pd-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.04);
  color: #dc2626;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.5);
  }

  &:active { transform: scale(0.98); }
}

.pd-icon { font-size: 16px; }
.pd-label { flex: 1; text-align: left; }

/* ============================================================
   МОИ СЧЕТА / БЛИЖАЙШИЕ СЧЕТА / СОЦИАЛЬНОЕ
   ============================================================ */
.pcard-accounts,
.pcard-bills,
.pcard-social {
  padding: 20px;
}

.pca-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pca-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
}

.pca-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pca-btn-ghost {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    color: #6366f1;
    background: rgba(99, 102, 241, 0.06);
  }
}

.pca-btn-filter {
  width: auto;
  padding: 0 14px;
  font-size: 11.5px;
  font-weight: 700;
}

.pca-btn-primary {
  padding: 8px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #fb7185, #f43f5e);
  color: #ffffff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px -8px rgba(244, 63, 94, 0.6);
  transition: all 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 24px -8px rgba(244, 63, 94, 0.8);
  }

  &:active { transform: scale(0.97); }
}

/* Список счетов */
.pca-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pca-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid transparent;
  transition: all 0.15s;

  &:hover {
    background: #ffffff;
    border-color: rgba(99, 102, 241, 0.25);
    box-shadow: 0 6px 18px -10px rgba(15, 23, 42, 0.15);
  }
}

.pca-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 5px;
    box-sizing: border-box;
  }
}

.pca-info {
  min-width: 0;
}

.pca-name {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pca-num {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--mono);
  margin-top: 2px;
  font-weight: 600;
}

.pca-balance {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
}

.pca-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;

  &.active {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #ffffff;
    box-shadow: 0 4px 12px -4px rgba(34, 197, 94, 0.5);
  }

  &.sleep {
    background: #f1f5f9;
    color: var(--muted);
    border: 1px solid var(--border);
  }
}

.pca-more {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }
}

.pca-empty {
  padding: 24px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

/* Ближайшие счета */
.bill-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid transparent;
  transition: all 0.15s;

  &:hover {
    background: #ffffff;
    border-color: rgba(99, 102, 241, 0.25);
  }
}

.bill-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 1), 0 0 0 5px rgba(99, 102, 241, 0.1);
}

.bill-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.bill-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;

  &.soon {
    background: linear-gradient(135deg, #f59e0b, #f97316);
    color: #ffffff;
  }

  &.week {
    background: rgba(251, 191, 36, 0.2);
    color: #b45309;
    border: 1px solid rgba(251, 191, 36, 0.5);
  }
}

.bill-hint {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px dashed rgba(99, 102, 241, 0.3);
  color: #6366f1;
  font-size: 11.5px;
  font-weight: 600;
  text-align: center;
}

/* Социальное */
.social-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.social-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: #f8fafc;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;

  &:hover {
    background: #ffffff;
    border-color: rgba(99, 102, 241, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 12px 24px -12px rgba(99, 102, 241, 0.35);
  }

  &:active { transform: translateY(0); }
}

.social-icon {
  font-size: 24px;
  line-height: 1;
}

.social-label {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
}

.social-badge {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--muted);
}

/* ============================================================
   АДАПТИВ
   ============================================================ */
@media (max-width: 1100px) {
  .profile-layout {
    grid-template-columns: 1fr;
    max-width: 720px;
  }

  .profile-col-left { position: static; }
}

@media (max-width: 700px) {
  .profile-page { padding: 16px 12px 100px; }
  .profile-layout { gap: 10px; }
  .profile-col { gap: 10px; }

  .pcard { padding: 16px; border-radius: 16px; }

  .pu-avatar { width: 90px; height: 90px; }
  .pu-avatar-emoji { font-size: 44px; }
  .pu-avatar-edit {
    right: calc(50% - 52px);
    bottom: 4px;
    width: 28px;
    height: 28px;
  }

  .pu-name { font-size: 19px; }
  .pu-role { font-size: 11.5px; }

  .pu-field-value { font-size: 13px; padding: 9px 12px; }

  .pu-save { font-size: 13px; padding: 11px 16px; }

  .ps-grid { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .ps-item { padding: 8px 10px; }
  .ps-value { font-size: 12.5px; }

  .pca-row {
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    padding: 10px 12px;
  }

  .pca-balance,
  .pca-badge {
    grid-column: 2 / 4;
    justify-self: start;
  }

  .pca-balance { font-size: 13px; }
  .pca-badge { font-size: 9.5px; padding: 3px 10px; }
  .pca-more { grid-row: 1; grid-column: 3; }

  .pca-title { font-size: 14px; }
  .pca-btn-primary { padding: 7px 14px; font-size: 12px; }

  .social-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
  .social-btn { padding: 12px; }
  .social-icon { font-size: 20px; }
  .social-label { font-size: 12px; }
}

@media (max-width: 380px) {
  .ps-grid { grid-template-columns: 1fr; }
}
</style>