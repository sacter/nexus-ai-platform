'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth';
import http from '@/lib/api/client';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { AuthCard } from '@/components/auth/auth-card';
import { Captcha } from '@/components/auth/captcha';

export default function LoginPage() {
  const router = useRouter();
  const [captchaCode, setCaptchaCode] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', captcha: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    // 验证码比对（大小写不敏感）
    if (values.captcha.toUpperCase() !== captchaCode.toUpperCase()) {
      setError('captcha', { message: '验证码错误' });
      return;
    }

    try {
      await http.post<{
        message: string;
        user: { id: string; username: string; email: string; role: string };
      }>('/auth/login', {
        username: values.username,
        password: values.password,
      });
      router.push('/');
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : '登录失败',
      });
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
              {...register('captcha')}
            />
            <Captcha onCodeChange={setCaptchaCode} />
          </div>
          {errors.captcha && (
            <p className="text-xs text-danger">{errors.captcha.message}</p>
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
