'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';

export default function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        对话历史: {sessionId}
      </h1>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">消息</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">消息历史将在此显示</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
