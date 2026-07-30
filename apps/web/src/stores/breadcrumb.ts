import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBreadcrumbStore = defineStore('breadcrumb', () => {
  const segmentLabels = ref<Record<string, string>>({})

  function setLabels(labels: Record<string, string>) {
    segmentLabels.value = labels
  }

  return { segmentLabels, setLabels }
})
