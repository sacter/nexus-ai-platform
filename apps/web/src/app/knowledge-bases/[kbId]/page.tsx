'use client';

import { use, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';
import { KNOWLEDGE_BASES } from '../data';
import { setBreadcrumbLabels } from '@/config/breadcrumb-context';

export default function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = use(params);
  const kb = KNOWLEDGE_BASES.find((item) => item.id === kbId);

  useEffect(() => {
    if (kb) {
      setBreadcrumbLabels({ [kbId]: kb.name });
    }
    return () => {
      setBreadcrumbLabels({});
    };
  }, [kbId, kb]);

  return (

    <MainLayout>
      <h2 className="text-2xl font-semibold mb-2 text-foreground">
        {kb ? kb.name : '知识库概览'}
      </h2>
      {kb && (
        <p className="text-sm text-foreground/60 mb-6">{kb.description}</p>
      )}
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
