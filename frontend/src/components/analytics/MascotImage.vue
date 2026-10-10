<!-- frontend/src/components/analytics/MascotImage.vue -->
<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  position: { type: String, default: 'left' },
  size: { type: Number, default: 0 },
  fallback: { type: String, default: '🪙' },
  alt: { type: String, default: '' },
  flip: { type: Boolean, default: false },
});

const loaded = ref(false);
const failed = ref(false);

const src = computed(() => `/img/mascots/${props.name}.png`);

const defaultSizes = {
  left: 150,
  right: 150,
  'hero-left': 240,
  'hero-right': 240,
  background: 280,
  floating: 100,
  corner: 130,
  static: 180,
  'goals-right-center': 220,
  'goals-star-mobile': 200,
};

const px = computed(() => props.size || defaultSizes[props.position] || 150);

const shouldFlip = computed(() => {
  if (props.flip) return true;
  return props.position === 'right';
});

function onLoad() { loaded.value = true; failed.value = false; }
function onError() { failed.value = true; loaded.value = false; }
</script>

<template>
  <div
    class="mascot"
    :class="[`mascot--${position}`, { 'is-loaded': loaded, 'is-failed': failed }]"
    :style="{
      '--mascot-size': px + 'px',
      '--mascot-flip': shouldFlip ? -1 : 1,
    }"
    aria-hidden="true"
  >
    <img
      v-if="!failed"
      :src="src"
      :alt="alt"
      class="mascot__img"
      loading="lazy"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="mascot__fallback">{{ fallback }}</span>
  </div>
</template>

<style scoped lang="scss">
.mascot {
  position: absolute;
  pointer-events: none;
  z-index: 3;
  width: var(--mascot-size);
  height: var(--mascot-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mascot__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.45));
  transform: scaleX(var(--mascot-flip));
  transform-origin: center center;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.mascot.is-loaded .mascot__img { opacity: 1; }

.mascot__fallback {
  font-size: calc(var(--mascot-size) * 0.7);
  line-height: 1;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
  transform: scaleX(var(--mascot-flip));
  user-select: none;
}

.mascot--static {
  position: relative;
  left: auto; right: auto; top: auto; bottom: auto;
}

/* ✅ ПК: звезда справа по центру */
.mascot--goals-right-center {
  right: -50px;
  top: 50%;
  transform: translateY(-50%);
}

/* ✅ МОБ: звезда снизу-справа, напротив «+ Добавить» */
.mascot--goals-star-mobile {
  right: -50px;
  top: 50%;
  transform: translateY(-50%);
}

.mascot--left {
  left: -30px;
  top: -30px;
  bottom: -30px;
  height: auto;
  align-items: center;
}
.mascot--right {
  right: -30px;
  top: -30px;
  bottom: -30px;
  height: auto;
  align-items: center;
}

.mascot--hero-left {
  left: -30px;
  top: -20px;
  bottom: -20px;
  height: auto;
  align-items: center;
}
.mascot--hero-right {
  right: -30px;
  top: -20px;
  bottom: -20px;
  height: auto;
  align-items: center;
}

.mascot--background { right: -40px; bottom: -30px; opacity: 0.35; z-index: 0; }
.mascot--floating { right: 8px;   top: 8px; }
.mascot--corner   { right: -20px; top: -20px; }

/* ✅ МОБИЛЬНЫЙ — звезда снизу-справа, напротив «+ Добавить» */
@media (max-width: 700px) {
  .mascot--goals-right-center,
  .mascot--goals-star-mobile {
    right: -30px;
    top: auto;
    bottom: -60px;
    transform: none;
    width: 180px !important;
    height: 180px !important;
  }

  .mascot--left {
    left: -20px !important;
    right: auto !important;
    top: -20px;
    bottom: -20px;
    height: auto;
  }
  .mascot--right {
    right: -20px !important;
    left: auto !important;
    top: -20px;
    bottom: -20px;
    height: auto;
  }
}
</style>