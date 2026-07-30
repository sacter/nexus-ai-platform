'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@heroui/react';
import Link from 'next/link';
import { KbCard } from '@/components/knowledge-bases/kb-card';
import { KNOWLEDGE_BASES } from './data';
import { KbCreateDialog } from '@/components/knowledge-bases/kb-create-dialog';


export default function KnowledgeBasesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-foreground">知识库</h2>
        <Button variant="primary" onPress={() => setIsCreateOpen(true)}>+ 新建知识库</Button>
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
      <KbCreateDialog
          isOpen={isCreateOpen}
          onOpenChange={() => setIsCreateOpen(false)}
        />
    </MainLayout>
  );
}
