<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import ChatWidget from '@/components/chat/ChatWidget.vue';

const auth = useAuthStore();
const toast = useToast();

const me = computed(() => auth.user || 'Сергей');

const displayName = ref('');
const avatar = ref(null);
const avatarPreview = ref(null);
const saving = ref(false);
const loading = ref(true);

const fileEl = ref(null);

const stats = computed(() => ({
  balance: 2823,
  accounts: 4,
  operations: 298,
}));

async function loadProfile() {
  loading.value = true;
  try {
    const res = await fetch('/api/profile', { credentials: 'include' });
    const data = await res.json();
    if (data.ok && data.profile) {
      displayName.value = data.profile.displayName || me.value;
      avatar.value = data.profile.avatar || null;
      avatarPreview.value = data.profile.avatar || null;
    } else {
      displayName.value = me.value;
    }
  } catch (e) {
    console.warn('[profile] не удалось загрузить:', e);
    displayName.value = me.value;
  } finally {
    loading.value = false;
  }
}

function openFilePicker() {
  fileEl.value?.click();
}

async function compressAvatar(file, maxSize = 400, quality = 0.85) {
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
  try {
    const compressed = await compressAvatar(file);
    avatarPreview.value = compressed;
    avatar.value = compressed;
  } catch (err) {
    console.error('[avatar] compress error:', err);
    toast.error('Не удалось обработать изображение');
  }
  e.target.value = '';
}

async function save() {
  const clean = displayName.value.trim();
  if (!clean) {
    toast.error('Имя не может быть пустым');
    return;
  }
  saving.value = true;
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: clean, avatar: avatar.value }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Ошибка сохранения');
    toast.success('✅ Профиль сохранён');
  } catch (e) {
    toast.error('Не удалось сохранить: ' + e.message);
  } finally {
    saving.value = false;
  }
}

const lastLogin = ref(new Date().toLocaleString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}));

onMounted(() => {
  loadProfile();
});
</script>

<template>
  <div class="profile-page">
    <!-- ЛЕВАЯ КОЛОНКА -->
    <div class="profile-col profile-col-left">
      <div class="profile-card">
        <div class="avatar-wrap">
          <div class="avatar" @click="openFilePicker">
            <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
            <span v-else class="avatar-emoji">🧑</span>
          </div>
          <button class="avatar-edit" @click.stop="openFilePicker" title="Сменить аватар">
            📷
          </button>
          <input
            ref="fileEl"
            type="file"
            accept="image/*"
            class="avatar-file"
            @change="onFileChange"
          />
        </div>

        <h1 class="profile-name">{{ displayName || me }}</h1>
        <p class="profile-sub">Пользователь приложения</p>

        <div class="meta">
          <div class="meta-row">
            <span class="meta-icon">🕐</span>
            <span class="meta-text">Последний вход: {{ lastLogin }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-icon">📍</span>
            <span class="meta-text">Россия · UTC+3</span>
          </div>
        </div>
      </div>

      <div class="profile-card">
        <label class="field-label">Имя</label>
        <div class="field">
          <input
            v-model="displayName"
            class="field-input"
            type="text"
            placeholder="Введите имя"
            maxlength="60"
          />
          <span class="field-icon">✏️</span>
        </div>

        <button class="save-btn" :disabled="saving" @click="save">
          <span v-if="saving">⏳ Сохранение…</span>
          <span v-else>💾 Сохранить</span>
        </button>
      </div>

      <div class="profile-card">
        <h2 class="card-title">📊 СТАТИСТИКА</h2>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">{{ stats.balance.toLocaleString('ru-RU') }} ₽</div>
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
      </div>
    </div>

    <!-- ПРАВАЯ КОЛОНКА -->
    <div class="profile-col profile-col-right">
      <div class="embed-chat">
        <ChatWidget :start-open="true" :embed-mode="true" />
      </div>

      <div class="insta-stub">
        <div class="insta-header">
          <div class="insta-avatar">
            <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
            <span v-else>🧑</span>
          </div>
          <div class="insta-info">
            <div class="insta-name">{{ displayName || me }}</div>
            <div class="insta-sub">Пользователь приложения</div>
          </div>
        </div>

        <div class="insta-grid">
          <div v-for="n in 9" :key="n" class="insta-cell">
            <span class="insta-cam">📷</span>
          </div>
        </div>

        <div class="insta-badge">🚧 Раздел в разработке</div>
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

.profile-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 4px 20px -8px rgba(15, 23, 42, 0.12);
  border: 1px solid #eef0f4;
}

.avatar-wrap {
  position: relative;
  width: 104px;
  height: 104px;
  margin: 0 auto 14px;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #a5b4fc, #818cf8);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  border: 4px solid #ffffff;
  box-shadow: 0 8px 24px -6px rgba(99, 102, 241, 0.45);
  transition: transform 0.2s;
  &:hover { transform: scale(1.03); }
  img { width: 100%; height: 100%; object-fit: cover; }
}

.avatar-emoji { font-size: 52px; }

.avatar-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  background: #6366f1;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
  &:active { transform: scale(0.9); }
}

.avatar-file { display: none; }

.profile-name {
  text-align: center;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 4px;
}

.profile-sub {
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 18px;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px 14px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #64748b;
}

.meta-icon { font-size: 14px; }
.meta-text { font-weight: 500; }

.field-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.field {
  position: relative;
  margin-bottom: 16px;
}

.field-input {
  width: 100%;
  padding: 12px 40px 12px 14px;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #0f172a;
  font-size: 15px;
  font-weight: 500;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:focus {
    border-color: #6366f1;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  }
}

.field-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0.6;
  pointer-events: none;
}

.save-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
  box-shadow: 0 8px 20px -6px rgba(239, 68, 68, 0.5);
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 26px -6px rgba(239, 68, 68, 0.65); }
  &:active:not(:disabled) { transform: scale(0.98); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
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

.embed-chat {
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 4px 20px -8px rgba(15, 23, 42, 0.12);
  border: 1px solid #eef0f4;
  background: #ffffff;
  min-height: 420px;
  max-height: 520px;
  display: flex;
  flex-direction: column;
}

.insta-stub {
  position: relative;
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 4px 20px -8px rgba(15, 23, 42, 0.12);
  border: 1px solid #eef0f4;
  overflow: hidden;
}

.insta-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.insta-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid #ffffff;
  box-shadow: 0 4px 12px -4px rgba(245, 158, 11, 0.5);
  font-size: 28px;
  img { width: 100%; height: 100%; object-fit: cover; }
}

.insta-name {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.insta-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.insta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  border-radius: 10px;
  overflow: hidden;
  opacity: 0.55;
  filter: grayscale(0.6);
}

.insta-cell {
  aspect-ratio: 1;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 22px;
}

.insta-cam { opacity: 0.6; }

.insta-badge {
  margin-top: 16px;
  text-align: center;
  font-size: 12.5px;
  font-weight: 700;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  border: 1px dashed rgba(99, 102, 241, 0.35);
  border-radius: 10px;
  padding: 10px;
}
</style>