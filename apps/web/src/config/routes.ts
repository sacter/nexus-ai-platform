// ==================== 类型定义 ====================

/** Lucide 图标名称 */
export type IconName =
  | 'LayoutDashboard'
  | 'BookOpen'
  | 'Bot'
  | 'MessageSquare'
  | 'Workflow'
  | 'Cpu'
  | 'Wrench'
  | 'Activity'
  | 'Settings'
  | 'ShieldCheck';

export interface NavItem {
  href: string;
  label: string;
  iconName: IconName;
}

// ==================== 侧边栏导航项 ====================

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '仪表盘', iconName: 'LayoutDashboard' },
  { href: '/knowledge-bases', label: '知识库', iconName: 'BookOpen' },
  { href: '/ai-applications', label: 'AI 应用', iconName: 'Bot' },
  { href: '/chat', label: '对话', iconName: 'MessageSquare' },
  { href: '/workflows', label: 'Workflow', iconName: 'Workflow' },
  { href: '/models', label: '模型', iconName: 'Cpu' },
  { href: '/tools', label: '工具', iconName: 'Wrench' },
  { href: '/jobs', label: 'Job', iconName: 'Activity' },
  { href: '/settings', label: '设置', iconName: 'Settings' },
  { href: '/audit-logs', label: '审计', iconName: 'ShieldCheck' },
];

// ==================== 路由 segment → 中文标签 ====================

export const ROUTE_LABELS: Record<string, string> = {
  'knowledge-bases': '知识库',
  'ai-applications': 'AI 应用',
  chat: '对话',
  workflows: 'Workflow',
  models: '模型',
  tools: '工具',
  jobs: 'Job',
  settings: '设置',
  'audit-logs': '审计',
  login: '登录',
  register: '注册',
  'api-keys': 'API Keys',
  prompts: '提示词',
  documents: '文档',
  designer: '设计器',
};

// ==================== 隐藏面包屑的路径 ====================

export const HIDDEN_BREADCRUMBS = new Set(['/login', '/register']);

// ==================== 工具函数 ====================

/** 判断 segment 是否为动态参数（UUID 或纯数字） */
export function isDynamicId(segment: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    ) || /^\d+$/.test(segment)
  );
}

/** 根据 pathname 构建面包屑，第一项为当前路由最高级菜单父级 */
export function buildBreadcrumbs(
  pathname: string,
  segmentLabels?: Record<string, string>,
): { href: string; label: string }[] {
  const segments = pathname.split('/').filter(Boolean);

  // 根路径直接返回仪表盘
  if (segments.length === 0) {
    return [{ href: '/', label: '仪表盘' }];
  }

  const items: { href: string; label: string }[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = segmentLabels?.[segment]
      ?? (isDynamicId(segment) ? '详情' : (ROUTE_LABELS[segment] ?? segment));
    items.push({ href: currentPath, label });
  }

  return items;
}
