'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';

export default function DashboardPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        平台概览
      </h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '知识库', value: 3 },
          { label: '文档', value: 12 },
          { label: 'Chunks', value: 156 },
          { label: 'AI 应用', value: 5 },
          { label: '模型', value: 8 },
          { label: '工具', value: 2 },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="text-center py-6">
              <div className="text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-foreground/60 mt-1">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">最近对话</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60">暂无对话记录</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
