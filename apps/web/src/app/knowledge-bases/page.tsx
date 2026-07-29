'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@heroui/react';
import Link from 'next/link';
import { KbCard } from '@/components/knowledge-bases/kb-card';
import { KNOWLEDGE_BASES } from './data';

export default function KnowledgeBasesPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-foreground">知识库</h2>
        <Button variant="primary">+ 新建知识库</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {KNOWLEDGE_BASES.map((kb) => (
          <Link key={kb.id} href={`/knowledge-bases/${kb.id}`}>
            <KbCard
              name={kb.name}
              description={kb.description}
              kbImg={kb.kbImg}
              docCount={kb.docCount}
              href={`/knowledge-bases/${kb.id}`}
            />
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
