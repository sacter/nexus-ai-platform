<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <AppHeader />
      <main
        class="flex-1 overflow-y-auto px-3 py-3"
        style="background-color: var(--surface-secondary)"
      >
        <router-view />
      </main>
    </div>
  </div>
</template>
