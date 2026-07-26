import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChatPage() {
  return (
    <MainLayout>
      <div className="flex h-full gap-4" style={{ minHeight: 'calc(100vh - 10rem)' }}>
        <div className="w-56 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">会话列表</h2>
            <Button size="sm">+ 新会话</Button>
          </div>
          <div className="space-y-1">
            <div className="px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm cursor-pointer">💰 财务 · 07-22</div>
            <div className="px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent/50">👥 HR · 07-21</div>
          </div>
        </div>
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 flex flex-col py-4">
            <div className="flex-1 space-y-4">
              <div className="flex flex-col gap-2">
                <div className="self-end max-w-[70%] rounded-xl bg-accent px-4 py-2 text-sm">公司请假流程是什么？</div>
                <div className="self-start max-w-[70%] rounded-xl bg-primary/10 px-4 py-2 text-sm">
                  <p>根据员工手册，请假需提前申请...</p>
                  <div className="mt-2 pt-2 border-t border-primary/20 text-xs text-muted-foreground">
                    📎 来源: 员工手册.pdf (第12页)
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Input placeholder="输入问题..." className="flex-1" />
              <Button>发送</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
