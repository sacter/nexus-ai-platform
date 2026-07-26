'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        Workflow: {id}
      </h1>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">
            Config (JSON)
          </h2>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-foreground/60 bg-surface-secondary p-4 rounded-lg overflow-auto">
            {`{
  "type": "reflection_rag",
  "nodes": [...],
  "edges": [...]
}`}
          </pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">
            Executions
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">执行历史列表</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
