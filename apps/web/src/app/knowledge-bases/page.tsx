import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function KnowledgeBasesPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">知识库</h1>
        <Button>+ 新建知识库</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'HR', desc: '员工手册 · 考勤制度', docs: 3 },
          { name: 'Finance', desc: '财务制度 · 发票规范', docs: 2 },
          { name: 'R&D', desc: '研发规范 · API 文档', docs: 1 },
        ].map((kb) => (
          <Link key={kb.name} href={`/knowledge-bases/${kb.name}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader><CardTitle className="text-base">{kb.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{kb.desc}</p>
                <p className="text-xs text-muted-foreground mt-2">{kb.docs} docs</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
