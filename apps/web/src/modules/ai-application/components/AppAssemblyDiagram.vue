<script setup lang="ts">
import { computed } from 'vue'
import type { AiApplication } from '../types/ai-application'
import { appIconGlyph } from '../types/ai-application'

/**
 * 装配图（本模块签名元素）：知识库/工作流/模型/Prompt 四个资源节点
 * 以连线汇入中央应用节点，再引出到对话 —— 把「AI 应用 = 装配体」直接视觉化。
 * 载入时路径 stroke-dashoffset 绘制动画（respect prefers-reduced-motion）。
 */

const props = defineProps<{ app: AiApplication }>()

function trunc(s: string, n = 9): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

interface ResourceNode {
  key: string
  label: string
  value: string
  glyph: string
  cy: number
}

const resources = computed<ResourceNode[]>(() => [
  { key: 'kb', label: '知识库', value: trunc(props.app.kbName), glyph: '📚', cy: 50 },
  { key: 'workflow', label: '工作流', value: trunc(props.app.workflowName), glyph: '⚡', cy: 110 },
  { key: 'model', label: '模型', value: trunc(props.app.modelDisplayName), glyph: '🧠', cy: 170 },
  { key: 'prompt', label: 'Prompt', value: trunc(props.app.promptTemplateName ?? '系统默认'), glyph: '✍️', cy: 230 },
])

// 资源节点 → 应用节点的三次贝塞尔连线路径
function connectorPath(cy: number): string {
  return `M 206 ${cy} C 268 ${cy}, 268 140, 328 140`
}
</script>

<template>
  <!-- 桌面端：SVG 装配图 -->
  <svg
    viewBox="0 0 720 280"
    class="hidden w-full md:block"
    role="img"
    :aria-label="`${app.name} 的装配图`"
  >
    <defs>
      <marker
        id="asm-arrow"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path
          d="M 0 0.5 L 7.5 4 L 0 7.5 z"
          fill="var(--border)"
        />
      </marker>
    </defs>

    <!-- 连接线（先画线，节点盖在端点上） -->
    <path
      v-for="(r, i) in resources"
      :key="`line-${r.key}`"
      :d="connectorPath(r.cy)"
      class="asm-path"
      pathLength="1"
      fill="none"
      stroke="var(--border)"
      stroke-width="1.5"
      :style="{ animationDelay: `${120 + i * 110}ms` }"
    />
    <path
      d="M 452 140 L 566 140"
      class="asm-path"
      pathLength="1"
      fill="none"
      stroke="var(--border)"
      stroke-width="1.5"
      marker-end="url(#asm-arrow)"
      :style="{ animationDelay: '580ms' }"
    />

    <!-- 资源节点 -->
    <g
      v-for="(r, i) in resources"
      :key="`node-${r.key}`"
      class="asm-node"
      :style="{ animationDelay: `${i * 110}ms` }"
    >
      <rect
        x="16"
        :y="r.cy - 23"
        width="190"
        height="46"
        rx="10"
        fill="var(--surface-secondary)"
        stroke="var(--border)"
      />
      <text
        :x="30"
        :y="r.cy - 4"
        class="asm-caption"
      >{{ r.glyph }} {{ r.label }}</text>
      <text
        :x="30"
        :y="r.cy + 14"
        class="asm-name"
      >{{ r.value }}</text>
    </g>

    <!-- 应用节点 -->
    <g
      class="asm-node"
      style="animation-delay: 450ms"
    >
      <rect
        x="328"
        y="104"
        width="124"
        height="72"
        rx="14"
        fill="var(--accent)"
      />
      <text
        x="390"
        y="136"
        text-anchor="middle"
        class="asm-app-glyph"
      >
        {{ appIconGlyph(app.icon) }}
      </text>
      <text
        x="390"
        y="160"
        text-anchor="middle"
        class="asm-app-name"
      >
        {{ trunc(app.name, 8) }}
      </text>
    </g>

    <!-- 对话节点 -->
    <g
      class="asm-node"
      style="animation-delay: 620ms"
    >
      <rect
        x="570"
        y="118"
        width="134"
        height="44"
        rx="22"
        fill="color-mix(in oklch, var(--accent) 10%, var(--surface))"
        stroke="var(--accent)"
        stroke-opacity="0.4"
      />
      <text
        x="637"
        y="145"
        text-anchor="middle"
        class="asm-name"
      >💬 对话会话</text>
    </g>
  </svg>

  <!-- 移动端：压缩为一行配方链 -->
  <div
    class="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs md:hidden"
    style="color: var(--foreground)"
  >
    <template
      v-for="r in resources"
      :key="`m-${r.key}`"
    >
      <span
        class="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
        style="background: var(--surface-secondary); border: 1px solid var(--border)"
      >
        {{ r.glyph }} {{ r.value }}
      </span>
      <span style="opacity: 0.4">▸</span>
    </template>
    <span
      class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
      style="background: var(--accent); color: var(--accent-foreground, #fff)"
    >
      {{ appIconGlyph(app.icon) }} {{ trunc(app.name, 8) }}
    </span>
  </div>
</template>

<style scoped>
.asm-caption {
  font-size: 10px;
  fill: var(--foreground);
  opacity: 0.5;
  letter-spacing: 0.05em;
}
.asm-name {
  font-size: 12px;
  fill: var(--foreground);
}
.asm-app-glyph {
  font-size: 20px;
}
.asm-app-name {
  font-size: 12px;
  font-weight: 600;
  fill: var(--accent-foreground, #fff);
}

.asm-node {
  opacity: 0;
  animation: asm-node-in 0.45s ease-out forwards;
}
.asm-path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: asm-draw 0.5s ease-out forwards;
}

@keyframes asm-node-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes asm-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .asm-node,
  .asm-path {
    animation: none;
    opacity: 1;
    stroke-dashoffset: 0;
  }
}
</style>
