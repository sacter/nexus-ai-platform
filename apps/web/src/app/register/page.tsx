'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth';
import http from '@/lib/api/client';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { AuthCard } from '@/components/auth/auth-card';
import { Captcha } from '@/components/auth/captcha';

export default function RegisterPage() {
  const router = useRouter();
  const [captchaCode, setCaptchaCode] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', captcha: '' },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    // 验证码比对（大小写不敏感）
    if (values.captcha.toUpperCase() !== captchaCode.toUpperCase()) {
      setError('captcha', { message: '验证码错误' });
      return;
    }

    try {
      await http.post('/auth/register', {
        username: values.username,
        email: values.email,
        password: values.password,
      });
      router.push('/login');
    } catch (err) {
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
          注册
        </Button>
      </form>
    </AuthCard>
  );
}
