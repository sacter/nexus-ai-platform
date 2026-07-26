import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-2">知识库概览</h1>
      <p className="text-sm text-muted-foreground mb-6">ID: {kbId}</p>
      <Card>
        <CardHeader><CardTitle className="text-base">统计信息</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">文档数量、Chunk 数量、最近更新等</p></CardContent>
      </Card>
    </MainLayout>
  );
}
