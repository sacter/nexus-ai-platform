<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi, type CaptchaData } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { loginSchema, type LoginFormValues } from '@/validations/auth'
import AuthCard from '@/components/auth/AuthCard.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive<LoginFormValues>({
  username: '',
  password: '',
  captchaCode: '',
})

const errors = reactive<Partial<Record<keyof LoginFormValues, string>>>({})
const captcha = ref<CaptchaData | null>(null)
const captchaLoading = ref(false)
const submitting = ref(false)
const serverError = ref('')

async function fetchCaptcha() {
  captchaLoading.value = true
  try {
    captcha.value = await authApi.getCaptcha()
  } catch {
    serverError.value = '获取验证码失败'
  } finally {
    captchaLoading.value = false
  }
}

async function handleSubmit() {
  errors.username = ''
  errors.password = ''
  errors.captchaCode = ''
  serverError.value = ''

  const result = loginSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof LoginFormValues
      errors[field] = issue.message
    }
    return
  }

  submitting.value = true
  try {
    const data = await authApi.login(
      form.username,
      form.password,
      captcha.value!.captchaId,
      form.captchaCode,
    )
    authStore.setUser(data)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : '登录失败'
    fetchCaptcha()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchCaptcha()
})
</script>

<template>
  <AuthCard title="登录" subtitle="Nexus AI Platform">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div>
        <el-input v-model="form.username" placeholder="用户名" />
        <p v-if="errors.username" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.username }}</p>
      </div>

      <div>
        <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        <p v-if="errors.password" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.password }}</p>
      </div>

      <div>
        <div class="flex gap-2">
          <el-input v-model="form.captchaCode" placeholder="验证码" />
          <div
            class="h-9 w-24 shrink-0 flex items-center justify-center rounded cursor-pointer"
            style="background-color: var(--surface-secondary)"
            @click="fetchCaptcha"
          >
            <span v-if="captchaLoading" class="text-xs">加载中...</span>
            <div v-else-if="captcha" v-html="captcha.svg" class="w-full h-full flex items-center justify-center" />
          </div>
        </div>
        <p v-if="errors.captchaCode" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.captchaCode }}</p>
      </div>

      <p v-if="serverError" class="text-sm text-center" style="color: var(--el-color-danger)">{{ serverError }}</p>

      <el-button type="primary" native-type="submit" :loading="submitting" class="w-full">
        登录
      </el-button>

      <p class="text-sm text-center" style="color: var(--foreground); opacity: 0.6">
        还没有账号？<router-link to="/register" class="font-medium" style="color: var(--accent)">立即注册</router-link>
      </p>
    </form>
  </AuthCard>
</template>
