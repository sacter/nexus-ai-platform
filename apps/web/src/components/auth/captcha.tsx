'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符 0/O/1/I/l

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

interface CaptchaProps {
  onCodeChange: (code: string) => void;
}

export function Captcha({ onCodeChange }: CaptchaProps) {
  const [code, setCode] = useState(() => generateCode());
  const initialCodeRef = useRef(code);

  // 初始通知父组件（用 queueMicrotask 延迟，避免 React 19 同步 setState 警告）
  useEffect(() => {
    queueMicrotask(() => {
      onCodeChange(initialCodeRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    const newCode = generateCode();
    setCode(newCode);
    onCodeChange(newCode);
  }, [onCodeChange]);

  const chars = useMemo(() => code.split(''), [code]);

  // 用 useMemo 固定随机样式参数，只在验证码变化时重新生成
  const charStyles = useMemo(
    () =>
      chars.map(() => ({
        xOffset: Math.random() * 6 - 3,
        yOffset: Math.random() * 8 - 4,
        rotate: Math.random() * 30 - 15,
        color: `hsl(${Math.random() * 360}, 60%, 30%)`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code],
  );

  const noiseLines = useMemo(
    () =>
      Array.from({ length: 3 }, () => ({
        x1: Math.random() * 120,
        y1: Math.random() * 40,
        x2: Math.random() * 120,
        y2: Math.random() * 40,
        color: `hsl(${Math.random() * 360}, 40%, 55%)`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code],
  );

  const noiseDots = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        cx: Math.random() * 120,
        cy: Math.random() * 40,
        color: `hsl(${Math.random() * 360}, 40%, 55%)`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code],
  );

  return (
    <div className="flex items-center gap-2">
      <svg
        width={120}
        height={40}
        className="cursor-pointer rounded border border-divider select-none shrink-0"
        onClick={refresh}
        role="img"
        aria-label="验证码"
      >
        <title>点击刷新验证码</title>
        <rect width={120} height={40} fill="#f5f5f5" rx={4} />
        {noiseLines.map((line, i) => (
          <line
            key={`l-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={1}
            opacity={0.4}
          />
        ))}
        {chars.map((char, i) => (
          <text
            key={i}
            x={15 + i * 24 + charStyles[i].xOffset}
            y={28 + charStyles[i].yOffset}
            fontSize={22}
            fontWeight="bold"
            fill={charStyles[i].color}
            transform={`rotate(${charStyles[i].rotate}, ${15 + i * 24}, 28)`}
            fontFamily="monospace"
          >
            {char}
          </text>
        ))}
        {noiseDots.map((dot, i) => (
          <circle
            key={`d-${i}`}
            cx={dot.cx}
            cy={dot.cy}
            r={0.6}
            fill={dot.color}
            opacity={0.35}
          />
        ))}
      </svg>
      <span
        className="text-sm text-accent cursor-pointer hover:underline select-none whitespace-nowrap"
        onClick={refresh}
      >
        换一个
      </span>
    </div>
  );
}
