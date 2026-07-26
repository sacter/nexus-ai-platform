'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';
import { Button } from '@heroui/react';

export default function AiApplicationsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          AI 应用中心
        </h1>
        <Button variant="primary">+ 创建 AI 应用</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            name: '💰 财务助手',
            desc: 'KB: 财务 · WF: Reflection · 🤖 DeepSeek',
          },
          {
            name: '👥 HR 助手',
            desc: 'KB: HR · WF: RAG · 🤖 Qwen',
          },
          {
            name: '🔧 研发助手',
            desc: 'KB: R&D · WF: ReWOO · 🤖 GPT-4o',
          },
        ].map((app) => (
          <Card key={app.name}>
            <CardHeader>
              <h2 className="text-base font-semibold text-foreground">
                {app.name}
              </h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/60">{app.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}
