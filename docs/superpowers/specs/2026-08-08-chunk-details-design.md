# 切片详情功能设计

**日期**: 2026-08-08
**状态**: 已确认
**范围**: `apps/api`（新增切片查询接口）+ `apps/web`（切片详情 tab UI）

---

## 一、背景

`KnowledgeDetail.vue` 已有「切片详情」tab（`name="chunks"`），但当前仅显示「暂无切片数据」占位。`DocumentList.vue` 已具备「切片详情」按钮（embedded 模式），点击后通过 `view-chunks` 事件切到切片 tab 并记录 `selectedDocId/Name`，但无真实切片展示。

后端 `DocumentChunk` 模型已存在（content / page / chunkIndex / tokenCount / parentChunkId / metadata JsonB），但**没有切片查询 API**——`chunk` 模块是未注册的死代码（数值型 `+id` CRUD）。

## 二、需求与交互语义

1. 点击某文档的「切片详情」→ 跳转到「切片详情」tab，展示**该文档**当前活跃版本的切片。
2. 直接点击「切片详情」tab → 展示知识库内**全部文档**（当前活跃版本）的切片。
3. 在切片 tab 内通过顶部**文档选择器**切换文档 → 展示所选文档的切片。

## 三、后端 API

### 3.1 接口

`GET /api/v1/knowledge-bases/:kbId/chunks`

查询参数：

| 参数 | 说明 | 默认 |
|---|---|---|
| `documentId` | 可选；缺省 = 全部文档 | — |
| `page` | 页码 | 1 |
| `pageSize` | 每页条数，上限 100 | 20 |

响应：

```json
{
  "items": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "documentName": "文档名",
      "versionId": "uuid",
      "page": 1,
      "chunkIndex": 0,
      "content": "切片正文",
      "tokenCount": 123,
      "metadata": {},
      "parentChunkId": null,
      "isEmbedded": true,
      "embeddingModels": ["bge-m3"],
      "createdAt": "2026-08-08T..."
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

### 3.2 数据口径

- 仅返回**当前活跃版本**（`document.currentVersionId`）的切片，排除历史版本切片。
- 排除 `status = DELETED` 的文档。
- `documentId` 指定时 → 该文档活跃版本；缺省时 → 收集库内全部非删除文档的活跃版本 id 列表，`where versionId IN (...)`。
- 排序：`documentId ASC, page ASC, chunkIndex ASC`（全部视图按文档聚合）。
- **向量化状态**：对当前页 chunk id 集合做一次 `chunkEmbeddings.findMany`，按 chunkId 归组 modelName，得到 `isEmbedded`（有 ≥1 条 embedding 即 true）+ `embeddingModels`。
- `documentName` 通过 `version.document.name` 关联返回。

### 3.3 权限

读接口沿用全局 `AuthGuard`（与现有 `GET documents` 一致），**不加** `KbPermissionGuard`，viewer 也可查看切片。

### 3.4 实现要点

- 重写 `apps/api/src/modules/knowledge/chunk/` 死代码模块：
  - `ChunkController`：路由前缀 `knowledge-bases/:kbId/chunks`，仅保留列表接口。
  - `ChunkService`：解析目标版本 id 集合 → `count + findMany`（skip/take）→ embedding 归组 → 组装返回。
- `ChunkModule` 注册进 `app.module.ts`（当前未注册）。
- 删除死代码：`create/findAll/findOne/update/remove` 及 `CreateChunkDto/UpdateChunkDto/chunk.entity`（如无其他引用）。

## 四、前端 UI

### 4.1 新增文件

- `apps/web/src/modules/knowledge/types/chunk.ts` — `Chunk`、`ChunkListResponse`、`ChunkListParams`
- `apps/web/src/modules/knowledge/api/chunk.api.ts` — `chunksApi.list(kbId, params)`
- `apps/web/src/modules/knowledge/composables/useChunks.ts` — `useChunks(kbId, { documentId, page, pageSize })`，queryKey 含 kbId + 过滤条件
- `apps/web/src/modules/knowledge/components/ChunkDetail.vue` — 切片 tab 内容组件

### 4.2 `ChunkDetail.vue`

Props：
- `kbId: string`
- `documentId: string`（`''` 表示全部文档）

Emits：
- `update:documentId`

UI：
- 顶部 `el-select` 文档选择器：「全部文档」+ 文档列表（复用 `useDocuments`）。
- `el-table` 列：
  - 「文档」列：仅 `documentId === ''`（全部视图）时显示。
  - 「页码 + 切片序号」：如 `P3 · #12`。
  - 「内容」：默认 2 行截断，`type="expand"` 展开显示全文。
  - 「Token 数」。
  - 「向量化状态」：`el-tag`（success「已向量化 · bge-m3」/ warning「未向量化」）。
- 底部 `el-pagination`：`pageSize=20`，`total` 取接口返回。
- `v-loading` 加载态；空态区分两种文案（全部 / 选中文档）。

## 五、状态协调（KnowledgeDetail.vue）

- 新增 `chunkDocId = ref('')` 作为切片 tab 的文档选择（受控状态）。
- `handleViewChunks(doc)`：**先**置 `suppressReset = true`，再 `chunkDocId = doc.id`，最后 `activeTab = 'chunks'`。
- **tab 直接点击**：`watch(activeTab)` 监听，切到 `chunks` 且 `suppressReset === false` 时重置 `chunkDocId = ''`（全部）；每次处理后复位 `suppressReset = false`。这样「切片详情」触发的切换不被重置覆盖，而主动点 tab 必重置为全部。
- `<ChunkDetail :kb-id="kbId" :document-id="chunkDocId" @update:document-id="chunkDocId = $event" />` 替换当前占位。

## 六、错误处理与边界

- API 报错走现有全局 HTTP 错误拦截器；列表空态展示。
- 选中的文档在全部视图下被删除 → 选择器刷新后若无该文档，重置为「全部」。
- 文档无切片（PROCESSING/FAILED 或暂无版本）→ 显示对应空态文案。
- 活跃版本为空（文档刚上传、`currentVersionId` 未回填）→ 空态。

## 七、验证

- 后端：curl 验证 全部 / 按文档 / 分页 / 向量化状态 / 排除已删除 五个维度。
- 前端：手动走三条路径（点 tab→全部；点切片详情→该文档；选择器切换）+ `tsc` 类型检查。
- 关注点：`el-tabs` 保持 pane 挂载导致的 prop 响应式同步是否正确。
