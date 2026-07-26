import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AiApplicationsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">AI 应用中心</h1>
        <Button>+ 创建 AI 应用</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: '💰 财务助手', desc: 'KB: 财务 · WF: Reflection · 🤖 DeepSeek' },
          { name: '👥 HR 助手', desc: 'KB: HR · WF: RAG · 🤖 Qwen' },
          { name: '🔧 研发助手', desc: 'KB: R&D · WF: ReWOO · 🤖 GPT-4o' },
        ].map((app) => (
          <Card key={app.name}>
            <CardHeader><CardTitle className="text-base">{app.name}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{app.desc}</p></CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}
