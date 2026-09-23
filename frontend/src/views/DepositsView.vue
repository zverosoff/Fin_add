<script setup>
import { onMounted } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useWebSocket } from '@/composables/useWebSocket';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';

import PageHero from '@/components/ui/PageHero.vue';
import FixedTable from '@/components/deposits/FixedTable.vue';

const accounts = useAccountsStore();
const toast = useToast();
const { connect } = useWebSocket();

onMounted(async () => {
  try {
    if (!accounts.loaded) await accounts.load();
    notifySaved('готово');
    connect();
  } catch (e) {
    notifyError(e.message || 'Не удалось загрузить данные');
    toast.error('Не удалось загрузить данные');
  }
});
</script>

<template>
  <div class="deposits-page">
    <PageHero title="💎 Вклады" />

    <div class="container">
      <FixedTable />
    </div>
  </div>
</template>

<style scoped lang="scss">
.deposits-page {
  min-height: 100vh;
  padding: 20px 20px 60px;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (max-width: 700px) {
  .deposits-page { padding: 16px 12px 40px; }
  .container { gap: 10px; }
}
</style>