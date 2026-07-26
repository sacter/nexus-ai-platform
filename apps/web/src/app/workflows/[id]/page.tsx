import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6">Workflow: {id}</h1>
      <Card className="mb-4"><CardHeader><CardTitle className="text-base">Config (JSON)</CardTitle></CardHeader><CardContent><pre className="text-xs text-muted-foreground bg-muted p-4 rounded-lg overflow-auto">{`{\n  "type": "reflection_rag",\n  "nodes": [...],\n  "edges": [...]\n}`}</pre></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Executions</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">执行历史列表</p></CardContent></Card>
    </MainLayout>
  );
}
