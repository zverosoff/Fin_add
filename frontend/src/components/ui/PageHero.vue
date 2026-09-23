<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  title: { type: String, required: true },
});

const route = useRoute();

const hidden = ref(false);

let hideTimer = null;

function startHideTimer() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hidden.value = true;
  }, 1500);
}

onMounted(() => {
  startHideTimer();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer);
});

// При смене маршрута — снова показать
watch(() => route.path, () => {
  hidden.value = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
  startHideTimer();
});
</script>

<template>
  <div class="hero-block" :class="{ hidden }">
    <h1>{{ title }}</h1>
  </div>
</template>

<style scoped lang="scss">
.hero-block {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  max-height: 120px;
  margin: 0 0 16px;
  padding-top: 4px;
  opacity: 1;
  /* ✅ Не перехватывает клики, даже когда видим */
  pointer-events: none;
  transition:
    max-height 0.35s cubic-bezier(.22,.61,.36,1),
    margin 0.35s cubic-bezier(.22,.61,.36,1),
    opacity 0.3s ease,
    padding 0.35s;

  &.hidden {
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    opacity: 0;
  }
}

h1 {
  font-size: clamp(18px, 2vw + 12px, 26px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  text-align: center;
  background: linear-gradient(120deg, #0f172a 0%, #0369a1 50%, #0284c7 100%);
  background-size: 220% 220%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1.2;
  white-space: nowrap;
  animation: h1Shift 10s ease-in-out infinite;
}

@keyframes h1Shift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

@media (max-width: 700px) {
  .hero-block {
    margin: 0 0 12px;
    padding-top: 2px;
    gap: 8px;
  }

  h1 {
    font-size: 18px;
    white-space: normal;
    padding: 0 12px;
  }
}
</style>