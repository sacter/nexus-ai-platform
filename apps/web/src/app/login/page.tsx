'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth';
import { authApi, type CaptchaData, clearPublicKeyCache } from '@/lib/api/auth';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { AuthCard } from '@/components/auth/auth-card';

export default function LoginPage() {
  const router = useRouter();
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', captchaCode: '' },
  });

  const fetchCaptcha = useCallback(async () => {
    try {
      const data = await authApi.getCaptcha();
      setCaptcha(data);
      setValue('captchaCode', '');
    } catch {
      // 获取验证码失败，静默处理
    }
  }, [setValue]);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const onSubmit = async (values: LoginFormValues) => {
    if (!captcha?.captchaId) {
      setError('captchaCode', { message: '请先获取验证码' });
      return;
    }

    try {
      await authApi.login(
        values.username,
        values.password,
        captcha.captchaId,
        values.captchaCode,
      );
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      // 解密失败说明公钥可能已过期（服务重启后密钥更换），清除缓存让下次重新获取
      if (message.includes('解密') || message.includes('刷新')) {
        clearPublicKeyCache();
      }
      // 验证码错误时刷新
      fetchCaptcha();
      setError('root', { message });
    }
  };

  return (
    <AuthCard
      title="登录"
      description="登录您的账号以继续"
      footer={
        <p className="text-sm text-foreground/60">
          还没有账号？{' '}
          <Link
            href="/register"
            className="font-medium text-accent underline underline-offset-4"
          >
            注册
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errors.root && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {errors.root.message}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">用户名</label>
          <Input
            type="text"
            placeholder="请输入用户名"
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-danger">{errors.username.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">密码</label>
          <Input
            type="password"
            placeholder="请输入密码"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-danger">{errors.password.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">验证码</label>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="请输入验证码"
              className="flex-1"
              maxLength={4}
              {...register('captchaCode')}
            />
            {captcha?.svg ? (
              <span
                className="cursor-pointer select-none shrink-0 rounded border border-divider"
                dangerouslySetInnerHTML={{ __html: captcha.svg }}
                onClick={fetchCaptcha}
                title="点击刷新验证码"
              />
            ) : (
              <div className="w-[150px] h-[50px] rounded border border-divider bg-surface-secondary animate-pulse shrink-0" />
            )}
          </div>
          {errors.captchaCode && (
            <p className="text-xs text-danger">{errors.captchaCode.message}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isPending={isSubmitting}
        >
          登录
        </Button>
      </form>
    </AuthCard>
  );
}
