'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  MessageSquare,
  Workflow,
  Cpu,
  Wrench,
  Activity,
  Settings,
  ShieldCheck,
  FileText,
} from 'lucide-react';

const navItems = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/knowledge-bases', label: '知识库', icon: BookOpen },
  { href: '/ai-applications', label: 'AI 应用', icon: Bot },
  { href: '/chat', label: '对话', icon: MessageSquare },
  { href: '/workflows', label: 'Workflow', icon: Workflow },
  { href: '/models', label: '模型', icon: Cpu },
  { href: '/tools', label: '工具', icon: Wrench },
  { href: '/jobs', label: 'Job', icon: Activity },
  { href: '/settings', label: '设置', icon: Settings },
  { href: '/audit-logs', label: '审计', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar-background h-screen sticky top-0 overflow-y-auto">
      <div className="flex items-center gap-2 h-14 px-4 border-b border-sidebar-border">
        <FileText className="h-5 w-5 text-sidebar-primary" />
        <span className="font-semibold text-sm text-sidebar-foreground">Nexus AI</span>
      </div>
      <nav className="p-3 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
