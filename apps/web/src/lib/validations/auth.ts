import { z } from 'zod';

// --- 可复用的字段 schema ---

/** 密码复杂度：6-15位，需包含英文字母、数字、特殊符号中的至少两种 */
const passwordRefine = (val: string) => {
  const hasLetter = /[a-zA-Z]/.test(val);
  const hasDigit = /\d/.test(val);
  const hasSpecial = /[^a-zA-Z0-9]/.test(val);
  return [hasLetter, hasDigit, hasSpecial].filter(Boolean).length >= 2;
};

const passwordMessage =
  '密码6-15位，需包含英文字母大小写、数字、特殊符号中的至少两种';

export const passwordSchema = z
  .string()
  .min(6, passwordMessage)
  .max(15, passwordMessage)
  .refine(passwordRefine, passwordMessage);

/** 用户名：只允许字母、数字、下划线、连字符、点号，不含表情符号等特殊字符 */
const usernameMessage = '用户名只能包含字母、数字、下划线、连字符和点';

export const usernameSchema = z
  .string()
  .min(2, '用户名至少2个字符')
  .max(64, '用户名最多64个字符')
  .regex(/^[a-zA-Z0-9._-]+$/, usernameMessage);

// --- 登录 / 注册 schema ---

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, '请输入密码'),
  captchaCode: z.string().min(1, '请输入验证码'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email('请输入有效的邮箱地址'),
  password: passwordSchema,
  captchaCode: z.string().min(1, '请输入验证码'),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
