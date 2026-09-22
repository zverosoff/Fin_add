<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import WelcomeOverlay from '@/components/ui/WelcomeOverlay.vue';

const router = useRouter();
const auth = useAuthStore();
const accounts = useAccountsStore();

const selectedUser = ref('');
const pin = ref('');
const error = ref('');
const loading = ref(false);

const showWelcome = ref(false);
const welcomeUser = ref('');
const welcomePercent = ref(0);
const welcomeStage = ref('Авторизация…');
const welcomeDone = ref(false);

const canSubmit = computed(() =>
  selectedUser.value
  && pin.value.length >= 4
  && !auth.loading
  && !loading.value
  && !showWelcome.value
);

onMounted(() => document.addEventListener('keydown', onKeyDown));
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));

function onKeyDown(e) {
  if (!selectedUser.value || showWelcome.value) return;
  if (e.key >= '0' && e.key <= '9') { pressDigit(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
  else if (e.key === 'Escape') { clearPin(); e.preventDefault(); }
  else if (e.key === 'Enter' && canSubmit.value) { submit(); e.preventDefault(); }
}

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
  loading.value = true;

  // Сразу показываем оверлей с прогрессом
  welcomeUser.value = selectedUser.value;
  welcomePercent.value = 5;
  welcomeStage.value = 'Авторизация…';
  welcomeDone.value = false;
  showWelcome.value = true;

  try {
    // ─── Этап 1: логин ───
    await auth.login(selectedUser.value, pin.value);
    welcomePercent.value = 30;
    welcomeStage.value = 'Загрузка данных…';

    // Небольшая задержка, чтобы пользователь увидел этап
    await new Promise(r => setTimeout(r, 250));

    // ─── Этап 2: загрузка состояния ───
    await accounts.load((percent, stage) => {
      // Мапим 10-100 на 30-90 (чтобы не перескакивать)
      welcomePercent.value = 30 + (percent * 0.6);
      welcomeStage.value = stage;
    });

    // ─── Этап 3: финализация ───
    welcomePercent.value = 95;
    welcomeStage.value = 'Синхронизация…';
    await new Promise(r => setTimeout(r, 300));

    welcomePercent.value = 100;
    welcomeStage.value = 'Готово!';
    welcomeDone.value = true;

    // ─── Редирект через 700 мс после финала ───
    setTimeout(() => {
      router.push('/finance');
    }, 700);

  } catch (e) {
    // Ошибка — закрываем оверлей, показываем ошибку
    showWelcome.value = false;
    loading.value = false;
    error.value = e.response?.data?.error || e.message || 'Ошибка входа';
    pin.value = '';

    const card = document.querySelector('.login-card');
    card?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(10px)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 500 }
    );
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card" :class="{ 'has-error': error }">
      <!-- Логотип -->
      <div class="login-logo">
        <span class="logo-icon">🔐</span>
        <span class="logo-text">ФИНАНСЫ PRO+</span>
      </div>

      <!-- Шаг 1: выбор пользователя -->
      <template v-if="!selectedUser">
        <p class="hint hint--attention">👆 Выберите пользователя</p>

        <div class="user-select">
          <button class="user-btn" type="button" @click="selectUser('Сергей')">
            <span class="emoji">👨</span>
            <span class="name">Сергей</span>
          </button>
          <button class="user-btn" type="button" @click="selectUser('Саша')">
            <span class="emoji">👩</span>
            <span class="name">Саша</span>
          </button>
        </div>
      </template>

      <!-- Шаг 2: PIN -->
      <template v-else>
        <p class="hint">
          Введите PIN для <strong>{{ selectedUser }}</strong>
        </p>

        <div class="pin-display">
          <span
            v-for="i in Math.max(4, pin.length)"
            :key="i"
            class="pin-dot"
            :class="{ filled: i <= pin.length }"
          />
        </div>

        <div class="pin-pad">
          <button v-for="n in 9" :key="n" type="button" @click="pressDigit(String(n))">
            {{ n }}
          </button>
          <button class="special" type="button" @click="clearPin">C</button>
          <button type="button" @click="pressDigit('0')">0</button>
          <button class="special" type="button" @click="backspace">⌫</button>
        </div>

        <button class="submit-btn" :disabled="!canSubmit" @click="submit">
          {{ loading ? 'Проверка…' : 'Войти' }}
        </button>

        <button class="back-btn" type="button" @click="selectedUser = ''">
          ← Сменить пользователя
        </button>

        <Transition name="err">
          <p v-if="error" class="error-msg">{{ error }}</p>
        </Transition>
      </template>
    </div>

    <!-- Полноэкранный welcome с реальным прогрессом -->
    <WelcomeOverlay
      :visible="showWelcome"
      :user-name="welcomeUser"
      :percent="welcomePercent"
      :stage="welcomeStage"
      :done="welcomeDone"
    />
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
  position: relative;
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.98);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 24px;
  padding: 28px 24px 24px;
  box-shadow: 0 30px 80px -20px rgba(15, 23, 42, 0.4);
  text-align: center;
  transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;

  &.has-error {
    border-color: rgba(239, 68, 68, 0.9);
    background: linear-gradient(180deg, #fef2f2 0%, #ffffff 100%);
    box-shadow:
      0 30px 80px -20px rgba(239, 68, 68, 0.6),
      0 0 0 4px rgba(239, 68, 68, 0.15) inset;
  }
}

.login-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px;
  background: linear-gradient(135deg, #dbeafe, #ede9fe);
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-radius: 999px;
  margin-bottom: 20px;
  box-shadow:
    0 8px 24px -8px rgba(59, 130, 246, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  animation: logoIn 0.7s cubic-bezier(.34,1.56,.64,1) both;

  .logo-icon {
    font-size: 22px;
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(59, 130, 246, 0.4));
    animation: iconBounce 2.5s ease-in-out infinite;
  }

  .logo-text {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #1e3a8a;
    white-space: nowrap;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
  }
}

@keyframes logoIn {
  from { opacity: 0; transform: scale(.7) translateY(-20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes iconBounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

.hint {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  margin: 0 0 16px;
  min-height: 18px;

  strong {
    color: var(--accent);
    font-weight: 800;
  }

  &--attention {
    color: #3b82f6;
    animation: hintPulse 2s ease-in-out infinite;
  }
}

@keyframes hintPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}

.user-select {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.user-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 12px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  background: #f8fafc;
  color: #334155;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(.34,1.56,.64,1);

  .emoji {
    font-size: 26px;
    line-height: 1;
    transition: transform 0.25s;
  }

  .name { line-height: 1; }

  &:hover {
    border-color: var(--accent);
    background: rgba(2, 132, 199, 0.06);
    transform: translateY(-2px);

    .emoji { transform: scale(1.15); }
  }

  &:active { transform: scale(0.97); }
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
    transition: all 0.2s cubic-bezier(.34,1.56,.64,1);

    &.filled {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-color: transparent;
      transform: scale(1.15);
      box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.5);
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
    color: var(--text);
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s cubic-bezier(.34,1.56,.64,1);
    box-shadow: 0 2px 6px -2px rgba(15, 23, 42, 0.08);

    &:hover {
      background: linear-gradient(180deg, #f1f5f9, #e2e8f0);
      border-color: #cbd5e1;
    }

    &:active {
      transform: scale(0.94);
      background: linear-gradient(135deg, #e0e7ff, #dbeafe);
    }

    &.special {
      color: var(--muted);
      font-size: 18px;

      &:hover {
        color: var(--danger);
        border-color: rgba(220, 38, 38, 0.3);
        background: rgba(220, 38, 38, 0.05);
      }
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
  font-family: inherit;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 12px 28px -10px rgba(59, 130, 246, 0.7);
  transition: all 0.2s cubic-bezier(.34,1.56,.64,1);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 34px -10px rgba(59, 130, 246, 0.9);
  }

  &:not(:disabled):active { transform: scale(0.97); }
}

.back-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  background: none;
  border: none;
  color: var(--muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.15s;

  &:hover { color: var(--accent); }
}

.error-msg {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.4;
}

.err-enter-active, .err-leave-active {
  transition: all 0.25s ease;
}
.err-enter-from, .err-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 400px) {
  .login-card { padding: 22px 18px 18px; }
  .pin-pad button { height: 52px; font-size: 20px; }
  .login-logo { padding: 8px 18px; }
  .logo-text { font-size: 15px; }
}
</style>