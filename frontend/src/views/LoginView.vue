<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const auth = useAuthStore();
const toast = useToast();

const selectedUser = ref('');
const pin = ref('');
const error = ref('');

const canSubmit = computed(() =>
  selectedUser.value && pin.value.length >= 4 && !auth.loading
);

function onKeyDown(e) {
  if (!selectedUser.value) return;
  if (e.key >= '0' && e.key <= '9') { pressDigit(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
  else if (e.key === 'Escape') { clearPin(); e.preventDefault(); }
  else if (e.key === 'Enter' && canSubmit.value) { submit(); e.preventDefault(); }
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));

function selectUser(name) {
  selectedUser.value = name;
  pin.value = '';
  error.value = '';
}

function pressDigit(d) {
  if (pin.value.length < 8) pin.value += d;
}
function backspace() { pin.value = pin.value.slice(0, -1); }
function clearPin() { pin.value = ''; }

async function submit() {
  error.value = '';
  try {
    await auth.login(selectedUser.value, pin.value);
    toast.success(`Добро пожаловать, ${selectedUser.value}!`);
    router.push('/finance');
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка входа';
    pin.value = '';
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card" :class="{ 'has-error': error }">
      <div class="logo">
        <span class="logo-icon">🔐</span>
        <span class="logo-text">ФИНАНСЫ PRO+</span>
      </div>

      <!-- Выбор пользователя -->
      <div v-if="!selectedUser" class="user-select">
        <p class="hint">👆 Выберите пользователя</p>
        <button class="user-btn" @click="selectUser('Сергей')">
          <span class="emoji">👨</span> Сергей
        </button>
        <button class="user-btn" @click="selectUser('Саша')">
          <span class="emoji">👩</span> Саша
        </button>
      </div>

      <!-- PIN -->
      <div v-else class="pin-section">
        <p class="hint">Введите PIN для {{ selectedUser }}</p>

        <div class="pin-display">
          <span
            v-for="i in Math.max(4, pin.length)"
            :key="i"
            class="pin-dot"
            :class="{ filled: i <= pin.length }"
          />
        </div>

        <div class="pin-pad">
          <button v-for="n in 9" :key="n" @click="pressDigit(String(n))">{{ n }}</button>
          <button class="special" @click="clearPin">C</button>
          <button @click="pressDigit('0')">0</button>
          <button class="special" @click="backspace">⌫</button>
        </div>

        <button class="submit-btn" :disabled="!canSubmit" @click="submit">
          {{ auth.loading ? 'Проверка…' : 'Войти' }}
        </button>

        <button class="back-btn" @click="selectedUser = ''">
          ← Сменить пользователя
        </button>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  padding: 28px 24px;
  box-shadow: 0 30px 80px -20px rgba(15, 23, 42, 0.4);
  text-align: center;

  &.has-error {
    border: 2px solid var(--danger);
    animation: shake 0.4s;
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-8px); }
  75%      { transform: translateX(8px); }
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px;
  background: linear-gradient(135deg, #dbeafe, #ede9fe);
  border-radius: 999px;
  margin-bottom: 24px;

  .logo-icon { font-size: 22px; }
  .logo-text {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #1e3a8a;
  }
}

.hint {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  margin: 0 0 16px;
}

.user-select {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.user-btn {
  padding: 16px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  background: #f8fafc;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  .emoji { font-size: 22px; display: block; margin-bottom: 6px; }

  &:hover {
    border-color: var(--accent);
    background: rgba(2, 132, 199, 0.06);
    transform: translateY(-2px);
  }
}

.pin-display {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 20px 0;

  .pin-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #cbd5e1;
    transition: all 0.2s;

    &.filled {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-color: transparent;
      transform: scale(1.15);
    }
  }
}

.pin-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;

  button {
    height: 56px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: linear-gradient(180deg, #ffffff, #f8fafc);
    font-size: 22px;
    font-weight: 700;
    font-family: var(--mono);
    cursor: pointer;
    transition: all 0.12s;

    &:hover { background: #f1f5f9; }
    &:active { transform: scale(0.94); }

    &.special {
      color: var(--muted);
      font-size: 18px;

      &:hover { color: var(--danger); }
    }
  }
}

.submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 12px 28px -10px rgba(59, 130, 246, 0.7);
  transition: all 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
  &:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 34px -10px rgba(59, 130, 246, 0.9);
  }
}

.back-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;

  &:hover { color: var(--accent); }
}

.error-msg {
  margin-top: 12px;
  padding: 10px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 600;
}
</style>