<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <div class="auth-container">
    <!-- ========== Left: Branding Panel ========== -->
    <div class="auth-left">
      <!-- Decorative blurred shapes -->
      <div class="deco-shape deco-shape--1" />
      <div class="deco-shape deco-shape--2" />

      <div class="auth-left__inner">
        <!-- Logo -->
        <div class="auth-logo-row">
          <div class="auth-logo-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Central node -->
              <rect
                x="9"
                y="9"
                width="6"
                height="6"
                rx="2"
                stroke="white"
                stroke-width="2"
              />
              <!-- Top -->
              <line
                x1="12"
                y1="9"
                x2="12"
                y2="3"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="12"
                cy="2"
                r="1.5"
                fill="white"
              />
              <!-- Bottom -->
              <line
                x1="12"
                y1="15"
                x2="12"
                y2="21"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="12"
                cy="22"
                r="1.5"
                fill="white"
              />
              <!-- Left -->
              <line
                x1="9"
                y1="12"
                x2="3"
                y2="12"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="2"
                cy="12"
                r="1.5"
                fill="white"
              />
              <!-- Right -->
              <line
                x1="15"
                y1="12"
                x2="21"
                y2="12"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="22"
                cy="12"
                r="1.5"
                fill="white"
              />
              <!-- Diagonals -->
              <line
                x1="10.5"
                y1="10.5"
                x2="5.5"
                y2="5.5"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="4.5"
                cy="4.5"
                r="1.5"
                fill="white"
              />
              <line
                x1="13.5"
                y1="10.5"
                x2="18.5"
                y2="5.5"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="19.5"
                cy="4.5"
                r="1.5"
                fill="white"
              />
              <line
                x1="10.5"
                y1="13.5"
                x2="5.5"
                y2="18.5"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="4.5"
                cy="19.5"
                r="1.5"
                fill="white"
              />
              <line
                x1="13.5"
                y1="13.5"
                x2="18.5"
                y2="18.5"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
              />
              <circle
                cx="19.5"
                cy="19.5"
                r="1.5"
                fill="white"
              />
            </svg>
          </div>
          <span class="auth-logo-text">Nexus AI</span>
        </div>

        <!-- Headline -->
        <div class="auth-headline">
          <p class="auth-headline__line">
            企业级AI
          </p>
          <p class="auth-headline__line">
            智能工作平台
          </p>
        </div>

        <!-- Description -->
        <div class="auth-desc">
          <p>整合大模型能力，赋能企业智能化转型</p>
          <p>提升团队效率，驱动业务增长</p>
        </div>

        <!-- Feature bullets -->
        <div class="auth-features">
          <div class="auth-feature">
            <span class="auth-feature__dot auth-feature__dot--blue" />
            <span>GPT-4 / DeepSeek / 文心一言多模型接入</span>
          </div>
          <div class="auth-feature">
            <span class="auth-feature__dot auth-feature__dot--purple" />
            <span>企业知识库 RAG 增强检索</span>
          </div>
          <div class="auth-feature">
            <span class="auth-feature__dot auth-feature__dot--green" />
            <span>安全私有化部署，数据不出企业</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== Right: Form Panel ========== -->
    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-card__header">
          <h2 class="auth-card__title">
            {{ title }}
          </h2>
          <p class="auth-card__subtitle">
            {{ subtitle }}
          </p>
        </div>
        <div class="auth-card__divider" />
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   Container
   ============================================ */
.auth-container {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

/* ============================================
   Left Panel
   ============================================ */
.auth-left {
  position: relative;
  width: 660px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  background:
    linear-gradient(135deg, #0d1b3e 0%, #0a0e1a 100%);
  overflow: hidden;
}

.deco-shape {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.deco-shape--1 {
  width: 400px;
  height: 400px;
  left: -100px;
  top: -100px;
  background: rgba(30, 58, 122, 0.3);
  filter: blur(40px);
}

.deco-shape--2 {
  width: 300px;
  height: 300px;
  left: 400px;
  top: 500px;
  background: rgba(37, 99, 235, 0.15);
  filter: blur(40px);
}

.auth-left__inner {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 48px;
  padding: 0 64px 0 80px;
  width: 100%;
}

/* Logo */
.auth-logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth-logo-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  flex-shrink: 0;
}

.auth-logo-text {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}

/* Headline */
.auth-headline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.auth-headline__line {
  font-size: 52px;
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  margin: 0;
}

/* Description */
.auth-desc {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.auth-desc p {
  font-size: 18px;
  line-height: 1.6;
  color: #94a3b8;
  margin: 0;
}

/* Feature bullets */
.auth-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: #cbd5e1;
}

.auth-feature__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.auth-feature__dot--blue {
  background: #3b82f6;
}

.auth-feature__dot--purple {
  background: #8b5cf6;
}

.auth-feature__dot--green {
  background: #10b981;
}

/* ============================================
   Right Panel
   ============================================ */
.auth-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #0f1629;
  padding: 0 60px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  border-radius: 16px;
  background: #161e35;
  border: 1px solid #1e2d50;
  padding: 40px;
}

.auth-card__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-card__title {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.auth-card__subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.auth-card__divider {
  width: 100%;
  height: 1px;
  background: #1e2d50;
}

/* ============================================
   Responsive
   ============================================ */
@media (max-width: 1024px) {
  .auth-left {
    display: none;
  }

  .auth-right {
    padding: 40px 20px;
    min-height: 100vh;
  }

  .auth-card {
    padding: 32px 24px;
  }
}
</style>
