'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth';
import { api } from '@/lib/api/client';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { AuthCard } from '@/components/auth/auth-card';

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await api<{
        message: string;
        user: { id: string; username: string; email: string; role: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
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
          <label className="text-sm font-medium text-foreground">邮箱</label>
          <Input
            type="email"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">密码</label>
          <Input
            type="password"
            placeholder="至少6位密码"
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
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
