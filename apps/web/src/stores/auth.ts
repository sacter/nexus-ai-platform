import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  authApi,
  getToken,
  removeToken,
  type UserInfo,
  type LoginResponse,
} from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const isLoading = ref(true)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function refreshUser() {
    try {
      const token = getToken()
      if (!token) {
        user.value = null
        return
      }
      user.value = await authApi.getUserInfo()
    } catch {
      removeToken()
      user.value = null
    } finally {
      isLoading.value = false
      initialized.value = true
    }
  }

  function setUser(data: LoginResponse) {
    user.value = data.user
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    removeToken()
    user.value = null
  }

  return {
    user,
    isLoading,
    initialized,
    isAuthenticated,
    refreshUser,
    setUser,
    logout,
  }
})
