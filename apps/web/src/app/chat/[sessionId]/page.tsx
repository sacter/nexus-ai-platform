import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ChatSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6">对话历史: {sessionId}</h1>
      <Card><CardHeader><CardTitle className="text-base">消息</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">消息历史将在此显示</p></CardContent></Card>
    </MainLayout>
  );
}
