<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useToast } from '@/composables/useToast';
import { fmt, categoryIcon } from '@/composables/useFormat';
import ThemeToggle from '@/components/ui/ThemeToggle.vue';

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

const editingName = ref(false);
const nameInput = ref('');
const nameInputEl = ref(null);

const fileEl = ref(null);

const createdAt = ref(null);

const extraStats = ref({
  streak: 0,
  monthCompare: null,
  topCategories: [],
});

const syncing = ref(true);
const synced = ref(false);
let syncedTimer = null;

function markSynced() {
  syncing.value = false;
  synced.value = true;
  if (syncedTimer) clearTimeout(syncedTimer);
  syncedTimer = setTimeout(() => { synced.value = false; }, 10000);
}

function markSyncing() {
  syncing.value = true;
  synced.value = false;
}

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

const createdAtText = computed(() => {
  if (!createdAt.value) return null;
  const d = new Date(createdAt.value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

const monthCompareText = computed(() => {
  const c = extraStats.value.monthCompare;
  if (!c) return null;
  return c;
});

const topCategories = computed(() => extraStats.value.topCategories || []);

function fmtPct(pct, invert = false) {
  if (pct === null || pct === undefined) return { text: '—', cls: 'flat' };
  if (!isFinite(pct)) return { text: '—', cls: 'flat' };
  const sign = pct > 0 ? '+' : '';
  const arrow = pct > 0.5 ? '↑' : pct < -0.5 ? '↓' : '→';
  const cls = Math.abs(pct) < 0.5
    ? 'flat'
    : (invert
        ? (pct > 0 ? 'down' : 'up')
        : (pct > 0 ? 'up' : 'down'));
  return { text: `${arrow} ${sign}${pct.toFixed(0)}%`, cls };
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile', { credentials: 'include' });
    const data = await res.json();
    if (data.ok && data.profile) {
      displayName.value = data.profile.displayName || me.value;
      avatar.value = data.profile.avatar || null;
      avatarPreview.value = data.profile.avatar || null;
      createdAt.value = data.profile.createdAt || null;

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

async function loadExtraStats() {
  try {
    const res = await fetch('/api/profile/stats', { credentials: 'include' });
    const data = await res.json();
    if (data.ok && data.stats) {
      extraStats.value = {
        streak: data.stats.streak || 0,
        monthCompare: data.stats.monthCompare || null,
        topCategories: data.stats.topCategories || [],
      };
    }
  } catch (e) {
    console.warn('[profile] extra stats error:', e);
  }
}

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
  markSyncing();
  try {
    const compressed = await compressAvatar(file);
    avatarPreview.value = compressed;
    avatar.value = compressed;

    await saveProfile();
    toast.success('✅ Фото обновлено');
    markSynced();
  } catch (err) {
    console.error('[avatar] error:', err);
    toast.error('Не удалось обработать изображение');
    avatarPreview.value = auth.avatar || null;
    avatar.value = auth.avatar || null;
  } finally {
    uploading.value = false;
  }
  e.target.value = '';
}

async function removeAvatar() {
  if (!avatarPreview.value) return;
  if (!confirm('Удалить фото профиля?')) return;

  uploading.value = true;
  markSyncing();
  try {
    avatarPreview.value = null;
    avatar.value = null;
    await saveProfile();
    toast.success('🗑 Фото удалено');
    markSynced();
  } catch (e) {
    toast.error('Не удалось удалить: ' + e.message);
    avatarPreview.value = auth.avatar || null;
    avatar.value = auth.avatar || null;
  } finally {
    uploading.value = false;
  }
}

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
  markSyncing();
  try {
    await saveProfile({ displayName: clean });
    displayName.value = clean;
    auth.setDisplayName(clean);
    editingName.value = false;
    toast.success('✅ Имя обновлено');
    markSynced();
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

async function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  await auth.logout();
  router.push('/login');
}

const lastLogin = ref(new Date().toLocaleString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}));

let unsubProfile = null;

onMounted(async () => {
  markSyncing();
  await Promise.all([loadProfile(), loadExtraStats()]);
  markSynced();

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
  if (syncedTimer) clearTimeout(syncedTimer);
});
</script>

<template>
  <div class="profile-page">
    <div class="profile-col profile-col-left">
      <div class="hero-card">
        <div class="hero-photo" :class="{ uploading }" @click="openFilePicker">
          <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
          <div v-else class="hero-photo-placeholder">
            <span>🧑</span>
          </div>

          <div class="hero-photo-vignette"></div>
          <div class="hero-photo-blur"></div>

          <Transition name="fade">
            <div v-if="uploading" class="hero-photo-loading">
              <div class="spinner"></div>
              <span>Сохранение…</span>
            </div>
          </Transition>
        </div>

        <div class="hero-info">
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
            <div class="hero-name-hint">Enter — сохранить · Esc — отмена</div>
          </div>

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
          >🗑</button>

          <input
            ref="fileEl"
            type="file"
            accept="image/*"
            class="hero-file"
            @change="onFileChange"
          />
        </div>

        <div class="hero-meta">
          <div class="hero-meta-row">
            <span class="hm-icon">🕐</span>
            <span class="hm-text">Последний вход: {{ lastLogin }}</span>
          </div>
          <div class="hero-meta-row">
            <span class="hm-icon">📍</span>
            <span class="hm-text">Россия · UTC+3</span>
          </div>
          <div v-if="createdAtText" class="hero-meta-row">
            <span class="hm-icon">📅</span>
            <span class="hm-text">С нами с {{ createdAtText }}</span>
          </div>
          <div v-if="extraStats.streak > 0" class="hero-meta-row streak">
            <span class="hm-icon">🔥</span>
            <span class="hm-text">
              <strong>{{ extraStats.streak }}</strong>
              {{ extraStats.streak === 1 ? 'день' : (extraStats.streak < 5 ? 'дня' : 'дней') }} подряд
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="profile-col profile-col-right">
      <div class="profile-card stats-card">
        <div class="sync-indicator" :class="{ syncing, synced }">
          <span class="sync-dot"></span>
          <span class="sync-text">
            {{ syncing ? 'Синхронизация' : (synced ? 'Synced' : 'Готово') }}
          </span>
        </div>

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

        <div v-if="monthCompareText" class="compare-block">
          <div class="compare-row">
            <span class="c-label">📈 Доходы</span>
            <span class="c-value">+{{ fmt(stats.monthIncome) }} ₽</span>
            <span
              class="c-delta"
              :class="fmtPct(monthCompareText.incomePct).cls"
            >{{ fmtPct(monthCompareText.incomePct).text }}</span>
          </div>
          <div class="compare-row">
            <span class="c-label">📉 Расходы</span>
            <span class="c-value">−{{ fmt(stats.monthExpense) }} ₽</span>
            <span
              class="c-delta"
              :class="fmtPct(monthCompareText.expensePct, true).cls"
            >{{ fmtPct(monthCompareText.expensePct, true).text }}</span>
          </div>
        </div>

        <div v-else class="stats-extra">
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

      <div v-if="topCategories.length > 0" class="profile-card">
        <h2 class="card-title">🏆 ТОП-3 КАТЕГОРИИ РАСХОДОВ</h2>
        <div class="top-cats">
          <div
            v-for="(cat, i) in topCategories"
            :key="cat.category"
            class="top-cat"
          >
            <div class="tc-rank" :class="'rank-' + (i + 1)">{{ i + 1 }}</div>
            <div class="tc-icon">{{ categoryIcon(cat.category) }}</div>
            <div class="tc-info">
              <div class="tc-name">{{ cat.category }}</div>
              <div class="tc-bar">
                <div class="tc-bar-fill" :style="{ width: cat.pct + '%' }"></div>
              </div>
            </div>
            <div class="tc-amount">
              <div class="tc-amount-value">{{ fmt(cat.amount) }} ₽</div>
              <div class="tc-amount-pct">{{ cat.pct.toFixed(0) }}%</div>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-card">
        <ThemeToggle />
      </div>

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
/* ============================================================
   СТРАНИЦА
   ============================================================ */
.profile-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  align-items: start;
  position: relative;
  min-height: 100vh;
}

@media (max-width: 980px) { .profile-page { grid-template-columns: 1fr; } }

.profile-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

/* ============================================================
   HERO-КАРТОЧКА
   ============================================================ */
.hero-card {
  position: relative;
  border-radius: 26px;
  overflow: hidden;
  background: #ffffff;

  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 20px -8px rgba(15, 23, 42, 0.12),
    0 30px 60px -20px rgba(99, 102, 241, 0.25),
    0 40px 80px -30px rgba(15, 23, 42, 0.15);

  outline: 1px solid rgba(255, 255, 255, 0.6);
  outline-offset: -1px;

  display: flex;
  flex-direction: column;

  transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), box-shadow 0.35s ease, background 0.3s ease;
}

.hero-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 2px 4px rgba(15, 23, 42, 0.05),
    0 12px 28px -10px rgba(15, 23, 42, 0.15),
    0 40px 80px -25px rgba(99, 102, 241, 0.35),
    0 50px 100px -35px rgba(15, 23, 42, 0.18);
}

:global(:root[data-app-theme="dark"]) .hero-card {
  background: #14091f;
  outline-color: rgba(139, 92, 246, 0.2);

  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 8px 24px -8px rgba(0, 0, 0, 0.5),
    0 30px 60px -20px rgba(139, 92, 246, 0.35),
    0 0 0 1px rgba(139, 92, 246, 0.15) inset;
}

:global(:root[data-app-theme="dark"]) .hero-card:hover {
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.5),
    0 12px 32px -10px rgba(0, 0, 0, 0.6),
    0 40px 80px -25px rgba(168, 85, 247, 0.5),
    0 0 0 1px rgba(139, 92, 246, 0.25) inset;
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
    transition: transform 0.6s cubic-bezier(.22,.61,.36,1);
  }

  &:hover img { transform: scale(1.04); }
  &.uploading { pointer-events: none; }
}

.hero-photo-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 140px;
  background: linear-gradient(135deg, #a5b4fc, #818cf8);
}

.hero-photo-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 100% 80% at 50% 30%, transparent 40%, rgba(15, 23, 42, 0.25) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, transparent 25%);
  mix-blend-mode: multiply;
}

/* ✅ Градиент перехода — светлый в светлой, тёмный в тёмной */
.hero-photo-blur {
  position: absolute; left: 0; right: 0; bottom: 0;
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
  transition: background 0.4s ease;
}

:global(:root[data-app-theme="dark"]) .hero-photo-blur {
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(20, 9, 31, 0.15) 30%,
    rgba(20, 9, 31, 0.5) 55%,
    rgba(20, 9, 31, 0.8) 75%,
    rgba(20, 9, 31, 0.95) 90%,
    #14091f 100%
  );
}

.hero-photo-loading {
  position: absolute; inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px;
  color: #ffffff;
  font-size: 13px; font-weight: 700;
  z-index: 5; pointer-events: none;
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,0.25);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.hero-info {
  position: relative; z-index: 2;
  margin-top: -100px;
  padding: 0 24px 8px;
  text-align: center;
}

.hero-name {
  display: inline-flex;
  align-items: center; justify-content: center;
  gap: 8px;
  font-size: 30px; font-weight: 900;
  color: #0f172a;
  margin: 0 0 4px;
  letter-spacing: -0.02em; line-height: 1.15;
  text-shadow: 0 2px 12px rgba(255, 255, 255, 0.9);
  transition: color 0.3s ease, text-shadow 0.3s ease;

  span { overflow: hidden; text-overflow: ellipsis; max-width: 280px; white-space: nowrap; }
}

:global(:root[data-app-theme="dark"]) .hero-name {
  color: #f4f4f6;
  text-shadow: 0 2px 12px rgba(20, 9, 31, 0.9);
}

.hero-name-edit-btn {
  flex-shrink: 0;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(180deg, #ffffff, #f1f5f9);
  color: #64748b;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.2s cubic-bezier(.34,1.56,.64,1);
  padding: 0;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 4px rgba(15, 23, 42, 0.08),
    0 6px 12px -4px rgba(15, 23, 42, 0.15);

  &:hover {
    background: linear-gradient(180deg, #6366f1, #4f46e5);
    color: #ffffff;
    transform: scale(1.1) translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 4px 8px rgba(99, 102, 241, 0.3),
      0 10px 20px -4px rgba(99, 102, 241, 0.5);
  }
  &:active {
    transform: scale(0.94);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.15) inset,
      0 1px 4px rgba(99, 102, 241, 0.3);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

:global(:root[data-app-theme="dark"]) .hero-name-edit-btn {
  background: linear-gradient(180deg, #2a1840, #1e1032);
  color: #a855f7;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 2px 4px rgba(0, 0, 0, 0.4),
    0 6px 12px -4px rgba(139, 92, 246, 0.4);

  &:hover {
    background: linear-gradient(180deg, #a855f7, #8b5cf6);
    color: #ffffff;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 4px 12px rgba(168, 85, 247, 0.5),
      0 10px 24px -4px rgba(168, 85, 247, 0.7);
  }
}

.hero-name-edit { display: flex; flex-direction: column; gap: 4px; align-items: center; }

.hero-name-input {
  width: 100%; max-width: 280px;
  padding: 8px 16px;
  border-radius: 12px;
  border: 2px solid #6366f1;
  background: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 24px; font-weight: 800;
  text-align: center; outline: none;
  box-shadow:
    0 8px 24px -8px rgba(99, 102, 241, 0.4),
    0 0 0 4px rgba(99, 102, 241, 0.1);
}

:global(:root[data-app-theme="dark"]) .hero-name-input {
  background: #14091f;
  color: #f4f4f6;
  border-color: #a855f7;
  box-shadow:
    0 8px 24px -8px rgba(168, 85, 247, 0.6),
    0 0 0 4px rgba(168, 85, 247, 0.2);
}

.hero-name-hint {
  font-size: 10.5px; color: #94a3b8;
  font-weight: 600; letter-spacing: 0.02em;
}

:global(:root[data-app-theme="dark"]) .hero-name-hint { color: #8b8ba0; }

.hero-username {
  font-size: 14px; color: #64748b;
  font-weight: 600; margin: 0;
  text-shadow: 0 2px 12px rgba(255, 255, 255, 0.9);
}

:global(:root[data-app-theme="dark"]) .hero-username {
  color: #8b8ba0;
  text-shadow: 0 2px 12px rgba(20, 9, 31, 0.9);
}

.hero-actions {
  position: relative; z-index: 2;
  display: flex; gap: 12px;
  padding: 8px 20px 20px;
  justify-content: center; align-items: center;
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 12px 24px;
  border-radius: 999px;
  border: none;
  font-family: inherit;
  font-size: 14px; font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition:
    transform 0.2s cubic-bezier(.34,1.56,.64,1),
    box-shadow 0.25s ease,
    background 0.2s ease;

  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
}

.hero-btn-primary {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  color: #ffffff;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.15) inset,
    0 -1px 0 rgba(0, 0, 0, 0.3) inset,
    0 4px 12px rgba(15, 23, 42, 0.25),
    0 12px 24px -6px rgba(15, 23, 42, 0.35);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.2) inset,
      0 -1px 0 rgba(0, 0, 0, 0.3) inset,
      0 6px 16px rgba(15, 23, 42, 0.3),
      0 20px 40px -8px rgba(15, 23, 42, 0.45);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
    box-shadow:
      0 2px 6px rgba(15, 23, 42, 0.2) inset,
      0 2px 4px rgba(15, 23, 42, 0.15);
  }
}

:global(:root[data-app-theme="dark"]) .hero-btn-primary {
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.3) inset,
    0 6px 16px rgba(139, 92, 246, 0.5),
    0 12px 32px -6px rgba(168, 85, 247, 0.6);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #a855f7, #c084fc);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.4) inset,
      0 -2px 0 rgba(0, 0, 0, 0.3) inset,
      0 8px 24px rgba(168, 85, 247, 0.6),
      0 18px 44px -8px rgba(168, 85, 247, 0.75);
  }
}

.hero-btn-danger {
  width: 46px; height: 46px;
  min-width: 46px; padding: 0;
  border-radius: 50%;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: #dc2626;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 4px 10px rgba(15, 23, 42, 0.08),
    0 10px 20px -6px rgba(239, 68, 68, 0.15);

  justify-content: center; font-size: 18px;

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, #fef2f2, #fee2e2);
    transform: translateY(-2px) scale(1.05);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 6px 14px rgba(239, 68, 68, 0.2),
      0 16px 28px -6px rgba(239, 68, 68, 0.35);
  }
  &:active:not(:disabled) {
    transform: scale(0.95);
    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.15) inset;
  }
}

:global(:root[data-app-theme="dark"]) .hero-btn-danger {
  background: linear-gradient(180deg, #2a1840, #1e1032);
  color: #f43f5e;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 4px 10px rgba(0, 0, 0, 0.4),
    0 10px 24px -6px rgba(244, 63, 94, 0.4);

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, #3a1f4a, #2a1038);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.1) inset,
      0 6px 16px rgba(244, 63, 94, 0.5),
      0 16px 32px -6px rgba(244, 63, 94, 0.6);
  }
}

.hero-file { display: none; }

.hero-meta {
  position: relative; z-index: 2;
  display: flex; flex-direction: column;
  gap: 8px;
  background: linear-gradient(180deg, #f8fafc, #f1f5f9);
  border-radius: 14px;
  padding: 14px 16px;
  margin: 0 20px 20px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 -1px 0 rgba(148, 163, 184, 0.1) inset,
    0 2px 6px rgba(15, 23, 42, 0.04);

  border: 1px solid rgba(226, 232, 240, 0.7);

  transition: background 0.3s ease, border-color 0.3s ease;
}

:global(:root[data-app-theme="dark"]) .hero-meta {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border-color: rgba(139, 92, 246, 0.15);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 -1px 0 rgba(0, 0, 0, 0.2) inset,
    0 2px 6px rgba(0, 0, 0, 0.3);
}

.hero-meta-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; color: #64748b;

  &.streak { color: #dc2626; }
  strong { color: #dc2626; font-weight: 800; }
}

:global(:root[data-app-theme="dark"]) .hero-meta-row {
  color: #8b8ba0;

  &.streak { color: #f43f5e; }
  &.streak strong { color: #f43f5e; }
}

.hm-icon { font-size: 14px; }
.hm-text { font-weight: 500; }

/* ============================================================
   ПРАВЫЕ КАРТОЧКИ
   ============================================================ */
.profile-card {
  position: relative;
  background: linear-gradient(180deg, #ffffff 0%, #fdfdff 100%);
  border-radius: 20px;
  padding: 22px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 20px -8px rgba(15, 23, 42, 0.1),
    0 24px 48px -20px rgba(15, 23, 42, 0.12);

  border: 1px solid rgba(226, 232, 240, 0.6);
  transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease, background 0.3s ease, border-color 0.3s ease;
}

.profile-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 4px rgba(15, 23, 42, 0.05),
    0 12px 28px -10px rgba(15, 23, 42, 0.12),
    0 32px 60px -25px rgba(99, 102, 241, 0.15);
}

:global(:root[data-app-theme="dark"]) .profile-card {
  background:
    radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.08), transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.05), transparent 50%),
    linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%);
  border-color: rgba(139, 92, 246, 0.15);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 2px 6px rgba(0, 0, 0, 0.4),
    0 12px 32px -10px rgba(139, 92, 246, 0.25),
    0 0 0 1px rgba(139, 92, 246, 0.08) inset;
}

:global(:root[data-app-theme="dark"]) .profile-card:hover {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.08) inset,
    0 4px 12px rgba(0, 0, 0, 0.5),
    0 20px 48px -10px rgba(168, 85, 247, 0.35),
    0 0 0 1px rgba(139, 92, 246, 0.2) inset;
}

.card-title {
  font-size: 12px; font-weight: 800;
  color: #94a3b8; letter-spacing: 0.08em;
  margin: 0 0 12px;
}

:global(:root[data-app-theme="dark"]) .card-title { color: #8b8ba0; }

.stats-card { padding-top: 18px; }

.sync-indicator {
  position: absolute;
  top: 16px; right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  border: 1px solid #eef0f4;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #94a3b8;
  transition: all 0.3s ease;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 4px rgba(15, 23, 42, 0.06);
}

:global(:root[data-app-theme="dark"]) .sync-indicator {
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
  border-color: rgba(139, 92, 246, 0.2);
  color: #8b8ba0;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 2px 4px rgba(0, 0, 0, 0.3);
}

.sync-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cbd5e1;
  box-shadow: 0 0 0 0 rgba(148, 163, 184, 0.5);
  transition: all 0.25s;
}

.sync-indicator.syncing {
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.35);
  background: linear-gradient(180deg, #eef2ff, #e0e7ff);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 4px 10px rgba(99, 102, 241, 0.15);

  .sync-dot {
    background: #6366f1;
    animation: pulseSync 1.2s ease-in-out infinite;
  }
}

:global(:root[data-app-theme="dark"]) .sync-indicator.syncing {
  color: #a855f7;
  border-color: rgba(168, 85, 247, 0.4);
  background: linear-gradient(180deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08));

  .sync-dot { background: #a855f7; }
}

.sync-indicator.synced {
  color: #16a34a;
  border-color: rgba(34, 197, 94, 0.4);
  background: linear-gradient(180deg, #f0fdf4, #dcfce7);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 4px 10px rgba(34, 197, 94, 0.15);

  .sync-dot {
    background: #22c55e;
    animation: pulseSynced 1.6s ease-in-out infinite;
  }
}

:global(:root[data-app-theme="dark"]) .sync-indicator.synced {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.4);
  background: linear-gradient(180deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08));

  .sync-dot { background: #4ade80; }
}

@keyframes pulseSync {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6); }
  50%      { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
}

@keyframes pulseSynced {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
  50%      { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat {
  position: relative;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  border-radius: 14px;
  padding: 14px 8px;
  text-align: center;
  border: 1px solid #eef0f4;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.08) inset,
    0 2px 6px rgba(15, 23, 42, 0.04);

  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, background 0.3s ease, border-color 0.3s ease;
}

.stat:hover {
  transform: translateY(-2px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.08) inset,
    0 6px 14px -2px rgba(15, 23, 42, 0.1);
}

:global(:root[data-app-theme="dark"]) .stat {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border-color: rgba(139, 92, 246, 0.12);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 2px 6px rgba(0, 0, 0, 0.3);
}

.stat-value {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 4px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
}

:global(:root[data-app-theme="dark"]) .stat-value {
  color: #f4f4f6;
  text-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
}

.stat-label {
  font-size: 9.5px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:global(:root[data-app-theme="dark"]) .stat-label { color: #8b8ba0; }

.compare-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #eef0f4;
}

:global(:root[data-app-theme="dark"]) .compare-block {
  border-top-color: rgba(139, 92, 246, 0.15);
}

.compare-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  border: 1px solid #eef0f4;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 2px 4px rgba(15, 23, 42, 0.03);
}

:global(:root[data-app-theme="dark"]) .compare-row {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)) !important;
  border-color: rgba(139, 92, 246, 0.15) !important;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 2px 6px rgba(0, 0, 0, 0.3) !important;
}

.c-label {
  font-weight: 700;
  color: #64748b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.c-value {
  font-family: var(--mono);
  font-weight: 800;
  font-size: 13px;
  color: #0f172a;
}

:global(:root[data-app-theme="dark"]) .c-label { color: #8b8ba0 !important; }
:global(:root[data-app-theme="dark"]) .c-value {
  color: #f4f4f6 !important;
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.15);
}

.c-delta {
  font-family: var(--mono);
  font-weight: 800;
  font-size: 11.5px;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;

  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset;

  &.up   {
    color: #16a34a;
    background: linear-gradient(180deg, #dcfce7, #bbf7d0);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  &.down {
    color: #dc2626;
    background: linear-gradient(180deg, #fee2e2, #fecaca);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  &.flat {
    color: #94a3b8;
    background: linear-gradient(180deg, #f8fafc, #f1f5f9);
    border: 1px solid #e2e8f0;
  }
}

:global(:root[data-app-theme="dark"]) .c-delta.up {
  color: #4ade80 !important;
  background: rgba(34, 197, 94, 0.15) !important;
  border-color: rgba(74, 222, 128, 0.4) !important;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

:global(:root[data-app-theme="dark"]) .c-delta.down {
  color: #f43f5e !important;
  background: rgba(244, 63, 94, 0.15) !important;
  border-color: rgba(244, 63, 94, 0.4) !important;
  text-shadow: 0 0 8px rgba(244, 63, 94, 0.5);
}

:global(:root[data-app-theme="dark"]) .c-delta.flat {
  color: #8b8ba0 !important;
  background: rgba(255,255,255,0.05) !important;
  border-color: rgba(139, 92, 246, 0.15) !important;
}

.stats-extra {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #eef0f4;
}

:global(:root[data-app-theme="dark"]) .stats-extra {
  border-top-color: rgba(139, 92, 246, 0.15);
}

.stat-extra-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 8px; padding: 8px 10px;
  border-radius: 10px; font-size: 12px;

  &.income {
    background: linear-gradient(180deg, #f0fdf4, #dcfce7);
    border: 1px solid rgba(34, 197, 94, 0.2);
    .se-value { color: #16a34a; }
  }
  &.expense {
    background: linear-gradient(180deg, #fef2f2, #fee2e2);
    border: 1px solid rgba(239, 68, 68, 0.2);
    .se-value { color: #dc2626; }
  }
}

:global(:root[data-app-theme="dark"]) .stat-extra-row.income {
  background: rgba(34, 197, 94, 0.12) !important;
  border-color: rgba(74, 222, 128, 0.3) !important;

  .se-label { color: #8b8ba0 !important; }
  .se-value {
    color: #4ade80 !important;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
  }
}

:global(:root[data-app-theme="dark"]) .stat-extra-row.expense {
  background: rgba(244, 63, 94, 0.12) !important;
  border-color: rgba(244, 63, 94, 0.3) !important;

  .se-label { color: #8b8ba0 !important; }
  .se-value {
    color: #f43f5e !important;
    text-shadow: 0 0 10px rgba(244, 63, 94, 0.5);
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

.top-cats { display: flex; flex-direction: column; gap: 10px; }

.top-cat {
  display: grid;
  grid-template-columns: 26px 34px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  border: 1px solid #eef0f4;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 6px rgba(15, 23, 42, 0.04);

  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, background 0.3s ease, border-color 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(148, 163, 184, 0.06) inset,
      0 8px 20px -4px rgba(99, 102, 241, 0.15);
  }
}

:global(:root[data-app-theme="dark"]) .top-cat {
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  border-color: rgba(139, 92, 246, 0.12);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 2px 6px rgba(0, 0, 0, 0.3);

  &:hover {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.08) inset,
      0 8px 24px -4px rgba(168, 85, 247, 0.4);
  }
}

.tc-rank {
  width: 26px; height: 26px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 900;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.25);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5) inset,
    0 -2px 4px rgba(0,0,0,0.15) inset,
    0 4px 8px rgba(0,0,0,0.15);

  &.rank-1 { background: linear-gradient(180deg, #fcd34d, #f59e0b); box-shadow: 0 1px 0 rgba(255,255,255,0.5) inset, 0 -2px 4px rgba(180,83,9,0.3) inset, 0 6px 12px -3px rgba(245,158,11,0.5); }
  &.rank-2 { background: linear-gradient(180deg, #e2e8f0, #94a3b8); }
  &.rank-3 { background: linear-gradient(180deg, #f59e0b, #b45309); }
}

.tc-icon { font-size: 22px; text-align: center; }

.tc-info { min-width: 0; }
.tc-name {
  font-size: 12.5px; font-weight: 800;
  color: #0f172a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 6px;
}

:global(:root[data-app-theme="dark"]) .tc-name { color: #f4f4f6; }

.tc-bar {
  height: 6px;
  background: linear-gradient(180deg, #e2e8f0, #f1f5f9);
  border-radius: 3px;
  overflow: hidden;

  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.08) inset,
    0 1px 0 rgba(255, 255, 255, 0.9);
}

:global(:root[data-app-theme="dark"]) .tc-bar {
  background: linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.2));
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3) inset,
    0 1px 0 rgba(255, 255, 255, 0.05);
}

.tc-bar-fill {
  height: 100%;
  background: linear-gradient(180deg, #818cf8, #6366f1);
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(.22,.61,.36,1);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5) inset,
    0 2px 4px rgba(99, 102, 241, 0.35);
}

:global(:root[data-app-theme="dark"]) .tc-bar-fill {
  background: linear-gradient(180deg, #a855f7, #8b5cf6);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 0 12px rgba(168, 85, 247, 0.6);
}

.tc-amount { text-align: right; flex-shrink: 0; }
.tc-amount-value {
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 800;
  color: #0f172a;
}

:global(:root[data-app-theme="dark"]) .tc-amount-value { color: #f4f4f6; }

.tc-amount-pct {
  font-size: 10.5px;
  color: #94a3b8;
  font-weight: 700;
  margin-top: 2px;
}

:global(:root[data-app-theme="dark"]) .tc-amount-pct { color: #8b8ba0; }

.logout-btn {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; width: 100%;
  padding: 14px;
  border-radius: 14px;
  border: 1.5px solid rgba(239, 68, 68, 0.35);

  background: linear-gradient(180deg, #fef2f2, #fee2e2);
  color: #dc2626;
  font-family: inherit;
  font-size: 14px; font-weight: 800;
  cursor: pointer;

  transition: all 0.2s cubic-bezier(.34,1.56,.64,1);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 -1px 0 rgba(239, 68, 68, 0.1) inset,
    0 4px 12px -2px rgba(239, 68, 68, 0.15);

  &:hover {
    background: linear-gradient(180deg, #fee2e2, #fecaca);
    border-color: #dc2626;
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 -1px 0 rgba(239, 68, 68, 0.15) inset,
      0 8px 20px -4px rgba(239, 68, 68, 0.35),
      0 0 0 4px rgba(239, 68, 68, 0.08);
  }

  &:active {
    transform: translateY(0) scale(0.98);
    box-shadow:
      0 2px 4px rgba(239, 68, 68, 0.2) inset;
  }
}

:global(:root[data-app-theme="dark"]) .logout-btn {
  background: linear-gradient(180deg, rgba(244,63,94,0.15), rgba(244,63,94,0.05));
  border-color: rgba(244, 63, 94, 0.4);
  color: #f43f5e;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 4px 12px -2px rgba(244, 63, 94, 0.3);

  &:hover {
    background: linear-gradient(180deg, rgba(244,63,94,0.25), rgba(244,63,94,0.12));
    border-color: #f43f5e;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.1) inset,
      0 8px 24px -4px rgba(244, 63, 94, 0.55),
      0 0 0 4px rgba(244, 63, 94, 0.15);
  }
}

.logout-icon { font-size: 16px; }

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 980px) { .hero-photo { aspect-ratio: 4 / 5; max-height: 460px; } }

@media (max-width: 700px) {
  .profile-page { padding: 12px; gap: 12px; }
  .profile-card { padding: 16px; border-radius: 16px; }
  .stats-card { padding-top: 16px; }

  .hero-card { border-radius: 20px; }
  .hero-photo { aspect-ratio: 3 / 4; max-height: none; }
  .hero-photo-placeholder { font-size: 100px; }
  .hero-photo-blur { height: 60%; }

  .hero-info { margin-top: -90px; padding: 0 18px 6px; }
  .hero-name { font-size: 24px; }
  .hero-name span { max-width: 200px; }
  .hero-name-input { font-size: 20px; padding: 6px 14px; }
  .hero-username { font-size: 13px; }

  .hero-actions { padding: 6px 16px 16px; gap: 10px; }
  .hero-btn { padding: 11px 22px; font-size: 13px; }
  .hero-btn-danger { width: 44px; height: 44px; min-width: 44px; font-size: 16px; }

  .hero-meta { margin: 0 16px 16px; padding: 12px 14px; gap: 6px; }
  .hm-text { font-size: 12px; }

  .stat-value { font-size: 15px; }

  .sync-indicator { top: 12px; right: 12px; font-size: 9.5px; padding: 4px 10px 4px 8px; }
  .sync-dot { width: 6px; height: 6px; }

  .top-cat { grid-template-columns: 22px 30px 1fr auto; gap: 8px; padding: 10px 12px; }
  .tc-rank { width: 22px; height: 22px; font-size: 11px; }
  .tc-icon { font-size: 18px; }
  .tc-name { font-size: 12px; }
  .tc-amount-value { font-size: 12px; }
}

@media (max-width: 380px) {
  .hero-name { font-size: 22px; }
  .hero-actions { gap: 6px; }
}

@media (prefers-reduced-motion: reduce) {
  .sync-indicator .sync-dot { animation: none !important; }
  .tc-bar-fill { transition: none !important; }
  .hero-card,
  .profile-card,
  .stat,
  .top-cat,
  .hero-btn,
  .logout-btn,
  .hero-name-edit-btn { transition: none !important; }
  .hero-card:hover,
  .profile-card:hover,
  .stat:hover,
  .top-cat:hover { transform: none !important; }
}
</style>