<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const QUOTES = [
  { text: 'Не откладывай на завтра то, что можно накопить сегодня.', author: 'Народная мудрость' },
  { text: 'Богатство — это способность полностью прожить свою жизнь.', author: 'Генри Дэвид Торо' },
  { text: 'Инвестиции в знания платят лучшие проценты.', author: 'Бенджамин Франклин' },
  { text: 'Богатые покупают активы. Бедные — обязательства.', author: 'Роберт Кийосаки' },
  { text: 'Деньги — плохой хозяин, но хороший слуга.', author: 'Фрэнсис Бэкон' },
  { text: 'Сначала заплати себе.', author: 'Джордж Клейсон' },
  { text: 'Не важно, сколько ты зарабатываешь. Важно, сколько ты сохраняешь.', author: 'Роберт Кийосаки' },
  { text: 'Сложный процент — восьмое чудо света.', author: 'Альберт Эйнштейн' },
  { text: 'Каждый сэкономленный рубль — это рубль, заработанный дважды.', author: 'Народная мудрость' },
  { text: 'Бюджет — это план, а не ограничение.', author: 'Дэйв Рэмси' },
  { text: 'Инвестируй, пока спишь — деньги работают за тебя.', author: 'Уоррен Баффет' },
  { text: 'Дисциплина важнее мотивации.', author: 'Джим Рон' },
  { text: 'Маленькие ежедневные шаги — путь к большому результату.', author: 'Народная мудрость' },
  { text: 'Правило 50/30/20: 50% на нужды, 30% на желания, 20% на сбережения.', author: 'Элизабет Уоррен' },
  { text: 'Не работай за деньги — заставь деньги работать на тебя.', author: 'Роберт Кийосаки' },
];

const currentIdx = ref(0);
const fading = ref(false);
let interval = null;

const current = computed(() => QUOTES[currentIdx.value]);

function next() {
  fading.value = true;
  setTimeout(() => {
    currentIdx.value = (currentIdx.value + 1) % QUOTES.length;
    fading.value = false;
  }, 300);
}

function prev() {
  fading.value = true;
  setTimeout(() => {
    currentIdx.value = (currentIdx.value - 1 + QUOTES.length) % QUOTES.length;
    fading.value = false;
  }, 300);
}

onMounted(() => {
  // Каждые 15 секунд — новая цитата
  interval = setInterval(next, 15000);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<template>
  <section class="quotes-card">
    <header class="qc-head">
      <div class="qc-head-icon">💡</div>
      <div class="qc-head-text">
        <div class="qc-title">Цитаты из мира финансов</div>
        <div class="qc-sub">Мудрость на каждый день</div>
      </div>
    </header>

    <div class="qc-body" :class="{ fading }">
      <div class="qc-quote-mark">"</div>
      <p class="qc-text">{{ current.text }}</p>
      <p class="qc-author">— {{ current.author }}</p>
    </div>

    <div class="qc-nav">
      <button class="qc-btn" type="button" @click="prev" aria-label="Предыдущая цитата">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="qc-dots">
        <span
          v-for="(_, i) in QUOTES"
          :key="i"
          class="qc-dot"
          :class="{ active: i === currentIdx }"
        ></span>
      </div>

      <button class="qc-btn" type="button" @click="next" aria-label="Следующая цитата">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.quotes-card {
  padding: 16px 18px;
  background:
    radial-gradient(circle at 0% 100%, rgba(236, 72, 153, 0.06), transparent 60%),
    rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  animation: cardEnter 0.55s cubic-bezier(.34,1.56,.64,1) both;
  animation-delay: 400ms;
}

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(16px) scale(0.95); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.qc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.qc-head-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ec4899, #f59e0b);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: 0 6px 16px -8px rgba(236, 72, 153, 0.7);
}

.qc-head-text { min-width: 0; }
.qc-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.02em;
}
.qc-sub {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  margin-top: 1px;
}

.qc-body {
  position: relative;
  padding: 14px 16px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.06), rgba(99, 102, 241, 0.04));
  border: 1px solid rgba(236, 72, 153, 0.15);
  transition: opacity 0.3s ease, transform 0.3s ease;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  &.fading {
    opacity: 0;
    transform: translateY(6px);
  }
}

.qc-quote-mark {
  position: absolute;
  top: 4px;
  left: 10px;
  font-size: 42px;
  font-weight: 900;
  color: rgba(236, 72, 153, 0.18);
  line-height: 1;
  pointer-events: none;
  font-family: Georgia, serif;
}

.qc-text {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
  margin: 0 0 8px;
  font-style: italic;
  position: relative;
  z-index: 1;
}

.qc-author {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 700;
  margin: 0;
  text-align: right;
  position: relative;
  z-index: 1;
}

.qc-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.qc-btn {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    border-color: #ec4899;
    color: #ec4899;
    background: rgba(236, 72, 153, 0.06);
  }
  &:active { transform: scale(0.92); }
}

.qc-dots {
  display: flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-wrap: wrap;
}

.qc-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.35);
  transition: all 0.2s;

  &.active {
    width: 16px;
    border-radius: 3px;
    background: linear-gradient(90deg, #ec4899, #8b5cf6);
  }
}

@media (max-width: 700px) {
  .quotes-card { padding: 12px 14px; border-radius: 14px; }
  .qc-head-icon { width: 32px; height: 32px; font-size: 16px; }
  .qc-title { font-size: 12px; }
  .qc-sub { font-size: 10.5px; }
  .qc-body { min-height: 100px; padding: 12px 14px 10px; }
  .qc-text { font-size: 12.5px; }
  .qc-author { font-size: 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .quotes-card { animation: none !important; }
  .qc-body { transition: none !important; }
}
</style>