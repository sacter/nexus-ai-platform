'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';
import { Button } from '@heroui/react';

export default function AiApplicationDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);

  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        编辑: {appId}
      </h1>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">基本信息</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">名称、描述配置</p>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">绑定资源</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">
            知识库 · Workflow · Model · Prompt · Tools
          </p>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button variant="primary">保存</Button>
        <Button variant="outline">测试对话</Button>
      </div>
    </MainLayout>
  );
}
