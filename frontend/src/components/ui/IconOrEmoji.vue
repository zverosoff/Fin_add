<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  src: { type: String, required: true },
  emoji: { type: String, default: '📦' },
  size: { type: Number, default: 24 },
  alt: { type: String, default: '' },
  className: { type: String, default: '' },
});

const failed = ref(false);

// Сброс при смене src
watch(() => props.src, () => {
  failed.value = false;
});
</script>

<template>
  <span
    v-if="failed"
    class="icon-emoji-fallback"
    :style="{ fontSize: size + 'px', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size + 'px', height: size + 'px' }"
  >{{ emoji }}</span>
  <img
    v-else
    :src="src"
    :alt="alt"
    :class="className"
    :style="{ width: size + 'px', height: size + 'px', objectFit: 'contain' }"
    loading="lazy"
    decoding="async"
    @error="failed = true"
  />
</template>

<style scoped>
.icon-emoji-fallback {
  font-family: inherit;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}
</style>