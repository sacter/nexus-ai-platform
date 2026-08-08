<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Message, Lock, ArrowRight, OfficeBuilding } from '@element-plus/icons-vue'
import { authApi, type CaptchaData } from '@/modules/system/auth/api/auth.api'
import { useAuthStore } from '@/stores/auth'
import { loginSchema, type LoginFormValues } from '@/modules/system/auth/validations/auth'
import AuthSplitLayout from '@/modules/system/auth/components/AuthSplitLayout.vue'

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
const rememberMe = ref(false)
const passwordVisible = ref(false)

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
  <AuthSplitLayout
    title="欢迎回来"
    subtitle="登录您的企业AI账户，开始智能工作"
  >
    <form
      class="auth-form"
      @submit.prevent="handleSubmit"
    >
      <!-- Username -->
      <div class="auth-field">
        <label class="auth-label">用户名</label>
        <div class="auth-input-wrap">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            size="large"
            class="auth-input"
          >
            <template #prefix>
              <el-icon class="auth-input-icon">
                <Message />
              </el-icon>
            </template>
          </el-input>
        </div>
        <p
          v-if="errors.username"
          class="auth-error"
        >
          {{ errors.username }}
        </p>
      </div>

      <!-- Password -->
      <div class="auth-field">
        <div class="auth-label-row">
          <label class="auth-label">登录密码</label>
          <a
            class="auth-forgot"
            href="#"
          >忘记密码？</a>
        </div>
        <div class="auth-input-wrap">
          <el-input
            v-model="form.password"
            :type="passwordVisible ? 'text' : 'password'"
            placeholder="请输入密码"
            size="large"
            class="auth-input"
          >
            <template #prefix>
              <el-icon class="auth-input-icon">
                <Lock />
              </el-icon>
            </template>
            <template #suffix>
              <el-icon
                class="auth-input-icon auth-input-icon--clickable"
                @click="passwordVisible = !passwordVisible"
              >
                <svg
                  v-if="passwordVisible"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
                  cx="12"
                  cy="12"
                  r="3"
                /></svg>
                <svg
                  v-else
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line
                  x1="1"
                  y1="1"
                  x2="23"
                  y2="23"
                /></svg>
              </el-icon>
            </template>
          </el-input>
        </div>
        <p
          v-if="errors.password"
          class="auth-error"
        >
          {{ errors.password }}
        </p>
      </div>

      <!-- Captcha -->
      <div class="auth-field">
        <label class="auth-label">验证码</label>
        <div class="auth-captcha-row">
          <el-input
            v-model="form.captchaCode"
            placeholder="请输入验证码"
            size="large"
            class="auth-input flex-1"
          />
          <div
            class="auth-captcha-img"
            @click="fetchCaptcha"
          >
            <span
              v-if="captchaLoading"
              class="text-xs"
              style="color: #64748b"
            >加载中...</span>
            <!-- 验证码 SVG 由服务端生成，内容可信 -->
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-else-if="captcha"
              class="flex items-center justify-center"
              v-html="captcha.svg"
            />
            <!-- eslint-enable vue/no-v-html -->
          </div>
        </div>
        <p
          v-if="errors.captchaCode"
          class="auth-error"
        >
          {{ errors.captchaCode }}
        </p>
      </div>

      <!-- Remember me -->
      <div class="auth-remember">
        <el-checkbox
          v-model="rememberMe"
          class="auth-checkbox"
        >
          <span class="auth-checkbox__label">记住我的登录状态</span>
        </el-checkbox>
      </div>

      <!-- Server error -->
      <p
        v-if="serverError"
        class="auth-error auth-error--center"
      >
        {{ serverError }}
      </p>

      <!-- Submit -->
      <button
        type="submit"
        class="auth-submit"
        :disabled="submitting"
      >
        <template v-if="submitting">
          <span class="auth-submit__loading" />
          <span>登录中...</span>
        </template>
        <span
          v-else
          class="auth-submit__content"
        >
          立即登录
          <el-icon><ArrowRight /></el-icon>
        </span>
      </button>

      <!-- Footer link -->
      <p class="auth-footer">
        还没有账号？<router-link
          to="/register"
          class="auth-footer__link"
        >
          立即注册
        </router-link>
      </p>
    </form>

    <!-- SSO section (slot via parent) -->
    <div class="auth-sso">
      <div class="auth-sso__divider">
        <span class="auth-sso__divider-line" />
        <span class="auth-sso__divider-text">或通过以下方式登录</span>
        <span class="auth-sso__divider-line" />
      </div>
      <button class="auth-sso__btn">
        <el-icon class="auth-sso__btn-icon">
          <OfficeBuilding />
        </el-icon>
        <span>使用企业 SSO 单点登录</span>
      </button>
    </div>
  </AuthSplitLayout>
</template>

<style scoped>
/* ============================================
   Form
   ============================================ */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Field */
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-label {
  font-size: 14px;
  font-weight: 500;
  color: #94a3b8;
}

.auth-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auth-forgot {
  font-size: 13px;
  color: #3b82f6;
  text-decoration: none;
}

.auth-forgot:hover {
  text-decoration: underline;
}

/* Input */
.auth-input-wrap {
  width: 100%;
}

.auth-input :deep(.el-input__wrapper) {
  background: #0d1527;
  border: 1px solid #2d3f6b;
  border-radius: 10px;
  box-shadow: none;
  padding: 0 16px;
}

.auth-input :deep(.el-input__wrapper:hover) {
  border-color: #3b5a9a;
}

.auth-input :deep(.el-input__wrapper.is-focus) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.auth-input :deep(.el-input__inner) {
  color: #e2e8f0;
  font-size: 14px;
}

.auth-input :deep(.el-input__inner::placeholder) {
  color: #475569;
}

.auth-input-icon {
  color: #475569;
  font-size: 16px;
}

.auth-input-icon--clickable {
  cursor: pointer;
}

.auth-input-icon--clickable:hover {
  color: #94a3b8;
}

/* Captcha */
.auth-captcha-row {
  display: flex;
  gap: 12px;
}

.auth-captcha-img {
  height: 42px;
  width: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #0d1527;
  border: 1px solid #2d3f6b;
  cursor: pointer;
  overflow: hidden;
}

.auth-captcha-img:hover {
  border-color: #3b5a9a;
}

/* Checkbox */
.auth-remember {
  display: flex;
  align-items: center;
}

.auth-checkbox :deep(.el-checkbox__label) {
  color: #94a3b8;
  font-size: 14px;
}

.auth-checkbox :deep(.el-checkbox__inner) {
  background: #0d1527;
  border-color: #2d3f6b;
  border-radius: 4px;
}

.auth-checkbox :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: #3b82f6;
  border-color: #3b82f6;
}

/* Error */
.auth-error {
  font-size: 13px;
  color: #ef4444;
  margin: 0;
}

.auth-error--center {
  text-align: center;
  font-size: 14px;
}

/* Submit button */
.auth-submit {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.auth-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-submit__content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-submit__loading {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer */
.auth-footer {
  text-align: center;
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.auth-footer__link {
  color: #3b82f6;
  font-weight: 600;
  text-decoration: none;
}

.auth-footer__link:hover {
  text-decoration: underline;
}

/* ============================================
   SSO
   ============================================ */
.auth-sso {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  margin-top: 4px;
}

.auth-sso__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.auth-sso__divider-line {
  flex: 1;
  height: 1px;
  background: #1e2d50;
}

.auth-sso__divider-text {
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
}

.auth-sso__btn {
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid #1e2d50;
  border-radius: 10px;
  background: #0d1527;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.auth-sso__btn:hover {
  border-color: #3b5a9a;
  background: #111c33;
}

.auth-sso__btn-icon {
  font-size: 16px;
}
</style>
