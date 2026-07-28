'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authApi,
  getToken,
  removeToken,
  type LoginResponse,
} from '@/lib/api/auth';
import type { UserInfo } from '@/lib/api/auth';

// ── Types ──

interface AuthState {
  /** 当前用户信息 */
  user: UserInfo | null;
  /** 是否正在加载（首次 token 校验 / 获取用户信息） */
  isLoading: boolean;
  /** 是否已登录 */
  isAuthenticated: boolean;
}

interface AuthActions {
  /**
   * 登录后将后端返回的 user 注入 context，
   * token 已在 authApi.login() 内部写入 localStorage。
   */
  setUser: (data: LoginResponse) => void;
  /**
   * 退出登录：调用登出接口 → 清除 token + user 状态
   */
  logout: () => Promise<void>;
  /**
   * 从服务端重新拉取当前用户信息（页面刷新时自动调用）
   */
  refreshUser: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

// ── Context ──

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setUserState(null);
        return;
      }
      const userInfo = await authApi.getUserInfo();
      setUserState(userInfo);
    } catch {
      // token 过期或无效 → 清除
      removeToken();
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 页面首次加载时检查 token 并获取用户信息
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const setUser = useCallback((data: LoginResponse) => {
    setUserState(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 登出接口失败不影响本地清除
    }
    removeToken();
    setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      setUser,
      logout,
      refreshUser,
    }),
    [user, isLoading, setUser, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
