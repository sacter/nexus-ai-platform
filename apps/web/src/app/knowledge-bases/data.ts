export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  docCount: number;
  kbImg: string;
  createTime: string;
  updateTime: string;
  docType: string;
  chunkType: string;
  indexMode: string;
  allowScope: string;
  embeddingModel: string;
}

export interface Document {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunkCount: number;
  importMethod: string;
  uploadTime: string;
  updateTime: string;
  size: string;
}

export const KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    id: 'hr-001',
    name: 'Scater',
    description: '员工手册 · 考勤制度',
    docCount: 3,
    kbImg: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg',
    createTime: '2024-05-19 23:29:09',
    updateTime: '2024-05-19 23:29:09',
    docType: 'txt,PDF,HTML',
    chunkType: '自动分段',
    indexMode: '语义索引',
    allowScope: '允许范围',
    embeddingModel: 'text-embedding-3-small',
  },
  {
    id: 'finance-001',
    name: 'Finance',
    description: '财务制度 · 发票规范',
    docCount: 2,
    kbImg: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg',
    createTime: '2024-04-10 10:00:00',
    updateTime: '2024-04-15 14:30:00',
    docType: 'PDF,Word',
    chunkType: '自动分段',
    indexMode: '语义索引',
    allowScope: '允许范围',
    embeddingModel: 'text-embedding-3-small',
  },
  {
    id: 'rd-001',
    name: 'R&D',
    description: '研发规范 · API 文档',
    docCount: 1,
    kbImg: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg',
    createTime: '2024-06-01 09:00:00',
    updateTime: '2024-06-10 11:00:00',
    docType: 'Markdown,PDF',
    chunkType: '自动分段',
    indexMode: '语义索引',
    allowScope: '允许范围',
    embeddingModel: 'text-embedding-3-small',
  },
];

export const EMPTY_DOCUMENTS: Document[] = [];