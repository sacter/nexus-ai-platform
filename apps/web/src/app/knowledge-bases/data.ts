export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  docCount: number;
  kbImg: string;
}

export const KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    id: 'hr-001',
    name: '人力资源',
    description: '员工手册 · 考勤制度',
    docCount: 3,
    kbImg: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg',
  },
  {
    id: 'finance-001',
    name: 'Finance',
    description: '财务制度 · 发票规范',
    docCount: 2,
    kbImg: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg',
  },
  {
    id: 'rd-001',
    name: 'R&D',
    description: '研发规范 · API 文档',
    docCount: 1,
    kbImg: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg',
  },
];
