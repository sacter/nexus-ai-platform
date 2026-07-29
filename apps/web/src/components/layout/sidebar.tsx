'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
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
} from 'lucide-react';
import { NAV_ITEMS, type IconName } from '@/config/routes';

const ICON_MAP: Record<IconName, LucideIcon> = {
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
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface h-screen sticky top-0 overflow-y-auto">
      <div className="flex items-center gap-2 h-14 px-4 border-b border-border">
        <FileText className="h-5 w-5 text-accent" />
        <span className="font-semibold text-sm text-foreground">Nexus AI</span>
      </div>
      <nav className="p-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = ICON_MAP[item.iconName];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
