'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleUser, Pencil, LogOut } from 'lucide-react';
import { Dropdown } from '@heroui/react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useAuth } from '@/lib/auth/auth-context';

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const handleEditInfo = useCallback(() => {
    console.log('/settings')
    // router.push('/settings');
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      // 登出失败不阻塞
    }
  }, [logout, router]);

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-foreground/60">
          Enterprise AI Platform
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />

        {isLoading ? (
          <div className="h-5 w-20 rounded bg-surface-secondary animate-pulse" />
        ) : isAuthenticated && user ? (
          <>
            <Dropdown.Root>
              <Dropdown.Trigger>
                <span className="flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none">
                  <CircleUser className="h-4 w-4" />
                  <span className="font-medium">{user.username}</span>
                </span>
              </Dropdown.Trigger>
              <Dropdown.Popover>
                <Dropdown.Menu
                  selectionMode="single"
                  onAction={(key) => {
                    if (key === 'edit') handleEditInfo();
                    else if (key === 'logout') handleLogout();
                  }}
                >
                  <Dropdown.Item id="edit">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      <span>编辑信息</span>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item id="logout">
                    <div className="flex items-center gap-2 text-danger">
                      <LogOut className="h-4 w-4" />
                      <span>退出登录</span>
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            <CircleUser className="h-5 w-5" />
            <span>登录</span>
          </Link>
        )}
      </div>
    </header>
  );
}
