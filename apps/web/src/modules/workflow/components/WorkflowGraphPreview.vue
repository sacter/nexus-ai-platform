<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { VueFlow, type Node, type Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { WorkflowEdge, WorkflowNode } from '../types/workflow'
import { WORKFLOW_NODE_TYPE_LABELS } from '../types/workflow'

const props = defineProps<{
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
}>()

/** 把后端 nodes/edges 转换为 Vue Flow 元素；保持只读、用于快速预览 */
const nodeBaseStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid var(--el-border-color)',
  background: 'var(--el-bg-color)',
  color: 'var(--el-text-color-primary)',
  fontSize: '12px',
  whiteSpace: 'pre-line',
  textAlign: 'center',
  minWidth: '120px',
}
const flowNodes = computed<Node[]>(
  () =>
    (props.nodes ?? []).map((n) => ({
      id: n.id,
      label: `${n.label || n.type}\n· ${WORKFLOW_NODE_TYPE_LABELS[n.type] ?? n.type}`,
      position: { x: n.positionX ?? 0, y: n.positionY ?? 0 },
      data: { type: n.type },
      draggable: false,
      style: nodeBaseStyle as Node['style'],
    })) as Node[],
)

const flowEdges = computed<Edge[]>(
  () =>
    (props.edges ?? []).map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.label ?? '',
      animated: true,
    })) as Edge[],
)

const hasGraph = computed(() => flowNodes.value.length > 0)
</script>

<template>
  <div class="workflow-graph-preview">
    <template v-if="hasGraph">
      <VueFlow
        :nodes="flowNodes"
        :edges="flowEdges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :zoom-on-scroll="false"
        :pan-on-drag="true"
        :fit-view="true"
        :min-zoom="0.2"
        :max-zoom="1.5"
        class="h-full w-full"
      >
        <Background />
        <Controls :show-interactive="false" />
      </VueFlow>
    </template>
    <el-empty
      v-else
      description="暂无图结构（创建时未配置 nodes/edges）"
      :image-size="80"
    />
  </div>
</template>

<style scoped>
.workflow-graph-preview {
  height: 320px;
  border: 1px solid var(--border, #dcdfe6);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-secondary, #fafafa);
}
</style>
