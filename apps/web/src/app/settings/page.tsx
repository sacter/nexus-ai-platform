'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';

export default function SettingsPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">系统设置</h1>
      {[
        {
          title: 'Embedding 配置',
          desc: 'Embedding Model、Chunk Size、Retrieval Strategy 等',
        },
        {
          title: 'Chunk 配置',
          desc: 'Parent-Child Chunking 参数',
        },
        {
          title: 'Retriever 配置',
          desc: 'Dense/Sparse/Hybrid 检索策略',
        },
      ].map((s) => (
        <Card key={s.title} className="mb-4">
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">
              {s.title}
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/60">{s.desc}</p>
          </CardContent>
        </Card>
      ))}
    </MainLayout>
  );
}
