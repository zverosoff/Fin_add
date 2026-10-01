<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';

const auth = useAuthStore();
const accounts = useAccountsStore();
const router = useRouter();
const toast = useToast();

const me = computed(() => auth.user || 'Сергей');

const displayName = ref('');
const avatar = ref(null);
const avatarPreview = ref(null);

const uploading = ref(false);
const savingName = ref(false);

// ✅ Режим редактирования имени
const editingName = ref(false);
const nameInput = ref('');
const nameInputEl = ref(null);

const fileEl = ref(null);

// ✅ Реальная статистика за месяц
const stats = computed(() => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthTxs = (accounts.transactions || []).filter(t => {
    if (t.fixed) return false;
    const d = new Date(t.date);
    return d >= monthStart && d <= monthEnd;
  });

  let income = 0;
  let expense = 0;
  for (const t of monthTxs) {
    if (t.fromReconcile) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }

  const balance = accounts.accounts.reduce((s, a) => s + (Number(a.value) || 0), 0);

  return {
    balance,
    accounts: accounts.accounts.length,
    operations: monthTxs.length,
    monthIncome: income,
    monthExpense: expense,
  };
});

// ============================================================
// Загрузка профиля
// ============================================================
async function loadProfile() {
  try {
    const res = await fetch('/api/profile', { credentials: 'include' });
    const data = await res.json();
    if (data.ok && data.profile) {
      displayName.value = data.profile.displayName || me.value;
      avatar.value = data.profile.avatar || null;
      avatarPreview.value = data.profile.avatar || null;

      auth.setDisplayName(displayName.value);
      if (typeof auth.setAvatar === 'function') {
        auth.setAvatar(data.profile.avatar || null);
      }
    } else {
      displayName.value = me.value;
    }
  } catch (e) {
    console.warn('[profile] не удалось загрузить:', e);
    displayName.value = me.value;
  }
}

// ============================================================
// Аватар
// ============================================================
function openFilePicker() {
  if (uploading.value) return;
  fileEl.value?.click();
}

async function compressAvatar(file, maxSize = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ✅ Автосохранение при выборе файла
async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast.error('Только изображения');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Максимум 5MB');
    return;
  }

  uploading.value = true;
  try {
    const compressed = await compressAvatar(file);
    avatarPreview.value = compressed;
    avatar.value = compressed;

    // ✅ Сразу сохраняем
    await saveProfile();
    toast.success('✅ Фото обновлено');
  } catch (err) {
    console.error('[avatar] error:', err);
    toast.error('Не удалось обработать изображение');
    // Откат
    avatarPreview.value = auth.avatar || null;
    avatar.value = auth.avatar || null;
  } finally {
    uploading.value = false;
  }
  e.target.value = '';
}

// ✅ Удаление фото — с автосохранением
async function removeAvatar() {
  if (!avatarPreview.value) return;
  if (!confirm('Удалить фото профиля?')) return;

  uploading.value = true;
  try {
    avatarPreview.value = null;
    avatar.value = null;
    await saveProfile();
    toast.success('🗑 Фото удалено');
  } catch (e) {
    toast.error('Не удалось удалить: ' + e.message);
    avatarPreview.value = auth.avatar || null;
    avatar.value = auth.avatar || null;
  } finally {
    uploading.value = false;
  }
}

// ============================================================
// Редактирование имени в карточке
// ============================================================
function startEditName() {
  if (editingName.value) return;
  nameInput.value = displayName.value;
  editingName.value = true;
  nextTick(() => {
    nameInputEl.value?.focus();
    nameInputEl.value?.select();
  });
}

async function saveName() {
  const clean = nameInput.value.trim();
  if (!clean) {
    toast.error('Имя не может быть пустым');
    return;
  }
  if (clean === displayName.value) {
    editingName.value = false;
    return;
  }

  savingName.value = true;
  try {
    await saveProfile({ displayName: clean });
    displayName.value = clean;
    auth.setDisplayName(clean);
    editingName.value = false;
    toast.success('✅ Имя обновлено');
  } catch (e) {
    toast.error('Не удалось сохранить: ' + e.message);
  } finally {
    savingName.value = false;
  }
}

function cancelEditName() {
  editingName.value = false;
  nameInput.value = displayName.value;
}

function onNameKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveName();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelEditName();
  }
}

// ============================================================
// Сохранение профиля
// ============================================================
async function saveProfile({ displayName: nameOverride } = {}) {
  const body = {
    displayName: nameOverride ?? displayName.value.trim(),
    avatar: avatar.value,
  };
  if (!body.displayName) throw new Error('Имя не может быть пустым');

  const res = await fetch('/api/profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');

  auth.setDisplayName(body.displayName);
  if (typeof auth.setAvatar === 'function') {
    auth.setAvatar(body.avatar);
  }
  return data;
}

// ============================================================
// Выход
// ============================================================
async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}

// ============================================================
// Метаданные
// ============================================================
const lastLogin = ref(new Date().toLocaleString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}));

// ============================================================
// WS — обновление профиля
// ============================================================
let unsubProfile = null;

onMounted(() => {
  loadProfile();

  const handler = (e) => {
    const p = e.detail;
    if (!p) return;
    if (p.displayName && !editingName.value) {
      displayName.value = p.displayName;
      auth.setDisplayName(p.displayName);
    }
    if (p.avatar !== undefined && !uploading.value) {
      avatar.value = p.avatar;
      avatarPreview.value = p.avatar;
      if (typeof auth.setAvatar === 'function') {
        auth.setAvatar(p.avatar);
      }
    }
  };
  window.addEventListener('profile:updated', handler);
  unsubProfile = () => window.removeEventListener('profile:updated', handler);
});

onUnmounted(() => {
  if (unsubProfile) unsubProfile();
});
</script>

<template>
  <div class="profile-page">
    <div class="profile-col profile-col-left">
      <!-- HERO-КАРТОЧКА -->
      <div class="hero-card">
        <!-- Большое фото -->
        <div class="hero-photo" :class="{ uploading }" @click="openFilePicker">
          <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
          <div v-else class="hero-photo-placeholder">
            <span>🧑</span>
          </div>

          <!-- ✅ Blur-переход к низу -->
          <div class="hero-photo-blur"></div>

          <!-- ✅ Индикатор загрузки -->
          <Transition name="fade">
            <div v-if="uploading" class="hero-photo-loading">
              <div class="spinner"></div>
              <span>Сохранение…</span>
            </div>
          </Transition>
        </div>

        <!-- Имя + подпись (с inline-редактированием) -->
        <div class="hero-info">
          <!-- ✅ Режим редактирования -->
          <div v-if="editingName" class="hero-name-edit">
            <input
              ref="nameInputEl"
              v-model="nameInput"
              class="hero-name-input"
              type="text"
              maxlength="60"
              @keydown="onNameKeydown"
              @blur="saveName"
            />
            <div class="hero-name-hint">
              Enter — сохранить · Esc — отмена
            </div>
          </div>

          <!-- ✅ Режим просмотра -->
          <h1 v-else class="hero-name">
            <span>{{ displayName || me }}</span>
            <button
              class="hero-name-edit-btn"
              type="button"
              @click.stop="startEditName"
              title="Изменить имя"
              :disabled="savingName"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </h1>

          <p class="hero-username">Пользователь приложения</p>
        </div>

        <!-- Кнопки -->
        <div class="hero-actions">
          <button
            class="hero-btn hero-btn-primary"
            type="button"
            @click="openFilePicker"
            :disabled="uploading"
          >
            <span v-if="uploading">⏳ Сохранение…</span>
            <span v-else>📷 {{ avatarPreview ? 'Сменить фото' : 'Загрузить фото' }}</span>
          </button>

          <button
            v-if="avatarPreview"
            class="hero-btn hero-btn-danger"
            type="button"
            @click="removeAvatar"
            :disabled="uploading"
            title="Удалить фото"
          >
            🗑
          </button>

          <input
            ref="fileEl"
            type="file"
            accept="image/*"
            class="hero-file"
            @change="onFileChange"
          />
        </div>

        <!-- Метаданные -->
        <div class="hero-meta">
          <div class="hero-meta-row">
            <span class="hm-icon">🕐</span>
            <span class="hm-text">Последний вход: {{ lastLogin }}</span>
          </div>
          <div class="hero-meta-row">
            <span class="hm-icon">📍</span>
            <span class="hm-text">Россия · UTC+3</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ПРАВАЯ КОЛОНКА — только статистика и выход -->
    <div class="profile-col profile-col-right">
      <!-- Статистика -->
      <div class="profile-card">
        <h2 class="card-title">📊 СТАТИСТИКА ЗА МЕСЯЦ</h2>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">{{ fmt(stats.balance) }} ₽</div>
            <div class="stat-label">БАЛАНС</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ stats.accounts }}</div>
            <div class="stat-label">СЧЕТОВ</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ stats.operations }}</div>
            <div class="stat-label">ОПЕРАЦИЙ</div>
          </div>
        </div>

        <div class="stats-extra">
          <div class="stat-extra-row income">
            <span class="se-label">📈 Доходы за месяц</span>
            <span class="se-value">+{{ fmt(stats.monthIncome) }} ₽</span>
          </div>
          <div class="stat-extra-row expense">
            <span class="se-label">📉 Расходы за месяц</span>
            <span class="se-value">−{{ fmt(stats.monthExpense) }} ₽</span>
          </div>
        </div>
      </div>

      <!-- Выход -->
      <div class="profile-card">
        <button class="logout-btn" type="button" @click="handleLogout">
          <span class="logout-icon">🚪</span>
          <span>Выйти из аккаунта</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  align-items: start;
}

@media (max-width: 980px) {
  .profile-page { grid-template-columns: 1fr; }
}

.profile-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* ============================================================
   HERO-КАРТОЧКА
   ============================================================ */
.hero-card {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 20px 40px -18px rgba(15, 23, 42, 0.25);
  border: 1px solid #eef0f4;
  display: flex;
  flex-direction: column;
}

.hero-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 520px;
  overflow: hidden;
  background: linear-gradient(135deg, #a5b4fc, #818cf8);
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 30%;
    display: block;
    transition: transform 0.4s ease;
  }

  &:hover img { transform: scale(1.02); }

  &.uploading { pointer-events: none; }
}

.hero-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 140px;
  background: linear-gradient(135deg, #a5b4fc, #818cf8);
}

.hero-photo-blur {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  pointer-events: none;

  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 30%,
    rgba(255, 255, 255, 0.4) 55%,
    rgba(255, 255, 255, 0.75) 75%,
    rgba(255, 255, 255, 0.95) 90%,
    #ffffff 100%
  );

  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  mask-image: linear-gradient(180deg, transparent 0%, #000 60%, #000 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 60%, #000 100%);
}

/* ✅ Индикатор загрузки */
.hero-photo-loading {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  z-index: 5;
  pointer-events: none;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* Имя + подпись */
.hero-info {
  position: relative;
  z-index: 2;
  margin-top: -100px;
  padding: 0 24px 8px;
  text-align: center;
}

.hero-name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 30px;
  font-weight: 900;
  color: #0f172a;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
  line-height: 1.15;
  text-shadow: 0 2px 12px rgba(255, 255, 255, 0.9);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
    white-space: nowrap;
  }
}

/* Кнопка-карандаш */
.hero-name-edit-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.06);
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;

  &:hover {
    background: #6366f1;
    color: #ffffff;
    transform: scale(1.08);
  }
  &:active { transform: scale(0.94); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

/* ✅ Inline-редактирование имени */
.hero-name-edit {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.hero-name-input {
  width: 100%;
  max-width: 280px;
  padding: 8px 16px;
  border-radius: 12px;
  border: 2px solid #6366f1;
  background: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 24px;
  font-weight: 800;
  text-align: center;
  outline: none;
  box-shadow: 0 8px 24px -8px rgba(99, 102, 241, 0.4);

  &:focus { box-shadow: 0 8px 28px -6px rgba(99, 102, 241, 0.55); }
}

.hero-name-hint {
  font-size: 10.5px;
  color: #94a3b8;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.hero-username {
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 2px 12px rgba(255, 255, 255, 0.9);
}

/* Кнопки */
.hero-actions {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 10px;
  padding: 8px 20px 20px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 24px;
  border-radius: 999px;
  border: none;
  font-family: inherit;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.hero-btn-primary {
  background: #0f172a;
  color: #ffffff;
  box-shadow: 0 8px 20px -8px rgba(15, 23, 42, 0.5);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 28px -8px rgba(15, 23, 42, 0.6);
    background: #1e293b;
  }
  &:active:not(:disabled) { transform: scale(0.98); }
}

.hero-btn-danger {
  width: 46px;
  height: 46px;
  min-width: 46px;
  padding: 0;
  border-radius: 50%;
  background: #ffffff;
  color: #dc2626;
  border: 2px solid #e2e8f0;
  justify-content: center;
  font-size: 18px;

  &:hover:not(:disabled) {
    border-color: #dc2626;
    background: rgba(239, 68, 68, 0.06);
  }
  &:active:not(:disabled) { transform: scale(0.94); }
}

.hero-file { display: none; }

.hero-meta {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8fafc;
  border-radius: 14px;
  padding: 14px 16px;
  margin: 0 20px 20px;
}

.hero-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #64748b;
}

.hm-icon { font-size: 14px; }
.hm-text { font-weight: 500; }

/* ============================================================
   Правая колонка
   ============================================================ */
.profile-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 4px 20px -8px rgba(15, 23, 42, 0.12);
  border: 1px solid #eef0f4;
}

.card-title {
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
  letter-spacing: 0.08em;
  margin: 0 0 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat {
  background: #f8fafc;
  border-radius: 12px;
  padding: 14px 8px;
  text-align: center;
  border: 1px solid #eef0f4;
}

.stat-value {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 9.5px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-extra {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #eef0f4;
}

.stat-extra-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;

  &.income {
    background: rgba(34, 197, 94, 0.06);
    .se-value { color: #16a34a; }
  }
  &.expense {
    background: rgba(239, 68, 68, 0.06);
    .se-value { color: #dc2626; }
  }
}

.se-label {
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10.5px;
}

.se-value {
  font-family: var(--mono);
  font-weight: 800;
  font-size: 13px;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
  color: #dc2626;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.12);
    border-color: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 8px 20px -8px rgba(239, 68, 68, 0.5);
  }
  &:active { transform: scale(0.98); }
}

.logout-icon { font-size: 16px; }

/* Мобильный */
@media (max-width: 980px) {
  .hero-photo { aspect-ratio: 4 / 5; max-height: 460px; }
}

@media (max-width: 700px) {
  .profile-page { padding: 12px; gap: 12px; }
  .profile-card { padding: 16px; border-radius: 14px; }

  .hero-card { border-radius: 20px; }
  .hero-photo { aspect-ratio: 3 / 4; max-height: none; }
  .hero-photo-placeholder { font-size: 100px; }

  .hero-photo-blur { height: 60%; }

  .hero-info { margin-top: -90px; padding: 0 18px 6px; }
  .hero-name { font-size: 24px; }
  .hero-name span { max-width: 200px; }
  .hero-name-input { font-size: 20px; padding: 6px 14px; }
  .hero-username { font-size: 13px; }

  .hero-actions { padding: 6px 16px 16px; gap: 8px; }
  .hero-btn { padding: 10px 20px; font-size: 13px; }
  .hero-btn-danger { width: 42px; height: 42px; min-width: 42px; font-size: 16px; }

  .hero-meta { margin: 0 16px 16px; padding: 12px 14px; gap: 6px; }
  .hm-text { font-size: 12px; }

  .stat-value { font-size: 15px; }
}

@media (max-width: 380px) {
  .hero-name { font-size: 22px; }
  .hero-actions { gap: 6px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-photo img,
  .hero-name-edit-btn,
  .hero-btn { transition: none !important; }
}
</style>