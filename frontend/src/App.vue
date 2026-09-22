<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWebSocket } from '@/composables/useWebSocket';
import ToastContainer from '@/components/ui/ToastContainer.vue';

const auth = useAuthStore();
const router = useRouter();
const { connect } = useWebSocket();

onMounted(async () => {
  if (auth.token) {
    const valid = await auth.checkSession();
    if (valid) connect();
    else {
      await auth.logout();
      router.push('/login');
    }
  }
});
</script>

<template>
  <router-view />
  <ToastContainer />
</template>