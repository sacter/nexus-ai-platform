import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function AiApplicationDetailPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6">编辑: {appId}</h1>
      <Card className="mb-4"><CardHeader><CardTitle className="text-base">基本信息</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">名称、描述配置</p></CardContent></Card>
      <Card className="mb-4"><CardHeader><CardTitle className="text-base">绑定资源</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">知识库 · Workflow · Model · Prompt · Tools</p></CardContent></Card>
      <div className="flex gap-3"><Button>保存</Button><Button variant="outline">测试对话</Button></div>
    </MainLayout>
  );
}
