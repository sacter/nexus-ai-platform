'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';
import { Button } from '@heroui/react';
import Link from 'next/link';

export default function KnowledgeBasesPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">知识库</h1>
        <Button variant="primary">+ 新建知识库</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'HR', desc: '员工手册 · 考勤制度', docs: 3 },
          { name: 'Finance', desc: '财务制度 · 发票规范', docs: 2 },
          { name: 'R&D', desc: '研发规范 · API 文档', docs: 1 },
        ].map((kb) => (
          <Link key={kb.name} href={`/knowledge-bases/${kb.name}`}>
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer"
            >
              <CardHeader>
                <h2 className="text-base font-semibold text-foreground">
                  {kb.name}
                </h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/60">{kb.desc}</p>
                <p className="text-xs text-foreground/40 mt-2">{kb.docs} docs</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
