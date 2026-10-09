<script setup>
import { onMounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';

import FixedTable from '@/components/deposits/FixedTable.vue';

const accounts = useAccountsStore();
const toast = useToast();

onMounted(async () => {
  try {
    if (!accounts.loaded) await accounts.load();
    notifySaved('готово');
  } catch (e) {
    notifyError(e.message || 'Не удалось загрузить данные');
    toast.error('Не удалось загрузить данные');
  }
});
</script>

<template>
  <div class="deposits-page">
    <div class="container">
      <FixedTable />
    </div>
  </div>
</template>

<style scoped lang="scss">
.deposits-page {
  min-height: 100vh;
  padding: 20px 20px 20px;
  position: relative;
}

.deposits-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(180deg, #fafbff 0%, #f3f5fb 100%);
  transition: background 0.4s ease;
}

:global(:root[data-app-theme="dark"]) .deposits-page::before {
  background: transparent;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (max-width: 700px) {
  .deposits-page { padding: 16px 12px 20px; }
  .container { gap: 10px; }
}
</style>