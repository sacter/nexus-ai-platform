'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Dropdown, Button } from '@heroui/react';
import { Moon, Sun, Palette, Car } from 'lucide-react';

const themes = [
  // { key: 'default', label: '默认', icon: Sun },
  { key: 'coinbase', label: 'Coinbase', icon: Palette },
  { key: 'uber', label: 'Uber', icon: Car },
  { key: 'rabbit', label: 'Rabbit', icon: Palette },
] as const;

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme: mode, setTheme: setMode } = useTheme();
  const [colorTheme, setColorTheme] = useState('coinbase');

  useEffect(() => {
    const stored = localStorage.getItem('nexus-color-theme') || 'coinbase';
    queueMicrotask(() => {
      setMounted(true);
      setColorTheme(stored);
    });
  }, []);

  const applyColorTheme = (key: string) => {
    setColorTheme(key);
    localStorage.setItem('nexus-color-theme', key);
    document.documentElement.setAttribute('data-theme', key);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" isIconOnly isDisabled>
        <Sun className="h-[1.15rem] w-[1.15rem]" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* color theme selector */}
      <Dropdown>
        <Button isIconOnly aria-label="Menu" variant="secondary">
          <Palette className="h-[1.15rem] w-[1.15rem]" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label="选择配色主题"
            selectedKeys={new Set([colorTheme])}
            selectionMode="single"
            onAction={(key) => applyColorTheme(key as string)}
          >
            {themes.map((t) => (
              <Dropdown.Item key={t.key} id={t.key}>
                <t.icon className="h-4 w-4" />
                <span className="ml-2">{t.label}</span>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {/* dark/light toggle */}
      <Button
        variant="ghost"
        isIconOnly
        onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      >
        {mode === 'dark' ? (
          <Moon className="h-[1.15rem] w-[1.15rem]" />
        ) : (
          <Sun className="h-[1.15rem] w-[1.15rem]" />
        )}
      </Button>
    </div>
  );
}
