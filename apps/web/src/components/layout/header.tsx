import Link from 'next/link';
import { CircleUser } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';

export function Header() {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-foreground/60">
          Enterprise AI Platform
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
        >
          <CircleUser className="h-5 w-5" />
          <span>User</span>
        </Link>
      </div>
    </header>
  );
}
