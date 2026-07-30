<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, type CaptchaData } from '@/api/auth'
import { registerSchema, type RegisterFormValues } from '@/validations/auth'
import AuthCard from '@/components/auth/AuthCard.vue'

const router = useRouter()

const form = reactive<RegisterFormValues>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  captchaCode: '',
})

const errors = reactive<Partial<Record<keyof RegisterFormValues, string>>>({})
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
  errors.email = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.captchaCode = ''
  serverError.value = ''

  const result = registerSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof RegisterFormValues
      if (!errors[field]) {
        errors[field] = issue.message
      }
    }
    return
  }

  submitting.value = true
  try {
    await authApi.register(
      form.username,
      form.email,
      form.password,
      captcha.value!.captchaId,
      form.captchaCode,
    )
    router.push('/login?registered=true')
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : '注册失败'
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
  <AuthCard title="注册" subtitle="创建你的 Nexus AI 账号">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div>
        <el-input v-model="form.username" placeholder="用户名" />
        <p v-if="errors.username" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.username }}</p>
      </div>

      <div>
        <el-input v-model="form.email" placeholder="邮箱" />
        <p v-if="errors.email" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.email }}</p>
      </div>

      <div>
        <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        <p v-if="errors.password" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.password }}</p>
      </div>

      <div>
        <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password />
        <p v-if="errors.confirmPassword" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.confirmPassword }}</p>
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
        注册
      </el-button>

      <p class="text-sm text-center" style="color: var(--foreground); opacity: 0.6">
        已有账号？<router-link to="/login" class="font-medium" style="color: var(--accent)">去登录</router-link>
      </p>
    </form>
  </AuthCard>
</template>
