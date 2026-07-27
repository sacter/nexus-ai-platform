'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth';
import http from '@/lib/api/client';
import { authApi, type CaptchaData } from '@/lib/api/auth';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { AuthCard } from '@/components/auth/auth-card';

export default function RegisterPage() {
  const router = useRouter();
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', captchaCode: '' },
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

  const onSubmit = async (values: RegisterFormValues) => {
    if (!captcha?.captchaId) {
      setError('captchaCode', { message: '请先获取验证码' });
      return;
    }

    try {
      await http.post('/auth/register', {
        username: values.username,
        email: values.email,
        password: values.password,
        captchaId: captcha.captchaId,
        captchaCode: values.captchaCode,
      });
      router.push('/login');
    } catch (err) {
      // 验证码错误时刷新
      fetchCaptcha();
      setError('root', {
        message: err instanceof Error ? err.message : '注册失败',
      });
    }
  };

  return (
    <AuthCard
      title="注册"
      description="创建您的账号"
      footer={
        <p className="text-sm text-foreground/60">
          已有账号？{' '}
          <Link
            href="/login"
            className="font-medium text-accent underline underline-offset-4"
          >
            登录
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
            placeholder="2-64个字符，字母、数字、下划线、连字符和点"
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-danger">{errors.username.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">邮箱</label>
          <Input
            type="email"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-danger">{errors.email.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">密码</label>
          <Input
            type="password"
            placeholder="6-15位，需包含字母、数字、特殊符号中至少两种"
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
          注册
        </Button>
      </form>
    </AuthCard>
  );
}
