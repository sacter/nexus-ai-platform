'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/auth/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        themes={['light', 'dark']}
        value={{
          light: 'light',
          dark: 'dark',
        }}
      >
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}
