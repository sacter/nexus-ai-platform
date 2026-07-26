import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ kbId: string; id: string }>;
}) {
  const { id } = await params;
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-2">文档详情</h1>
      <p className="text-sm text-muted-foreground mb-6">ID: {id}</p>
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="versions">版本历史</TabsTrigger>
          <TabsTrigger value="chunks">Chunks</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Document Info</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Badge variant="secondary">Ready</Badge>
                <span className="text-sm text-muted-foreground">Chunks: 145</span>
                <span className="text-sm text-muted-foreground">Dim: 1536</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="chunks">
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Chunks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { id: 1, page: 1, text: '公司实行弹性工作制...' },
                { id: 2, page: 1, text: '员工请假需提前...' },
              ].map((chunk) => (
                <div key={chunk.id} className="p-3 rounded-lg bg-muted text-sm">
                  <p className="font-medium mb-1">Chunk {chunk.id} (Page {chunk.page})</p>
                  <p className="text-muted-foreground">{chunk.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
