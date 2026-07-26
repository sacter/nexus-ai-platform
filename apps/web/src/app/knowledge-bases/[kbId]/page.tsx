'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';

export default function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = use(params);

  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-2 text-foreground">
        知识库概览
      </h1>
      <p className="text-sm text-foreground/60 mb-6">ID: {kbId}</p>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">统计信息</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">
            文档数量、Chunk 数量、最近更新等
          </p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
