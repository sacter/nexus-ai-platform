<script setup lang="ts">
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const nodes = ref([])
const edges = ref([])
</script>
<template>
  <div class="h-full -m-6">
    <div class="h-full" style="min-height: calc(100vh - 3.5rem)">
      <VueFlow :nodes="nodes" :edges="edges" class="h-full w-full">
        <Background />
        <Controls />
      </VueFlow>
    </div>
  </div>
</template>
