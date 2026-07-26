import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ModelsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold">Model Center</h1><Button>+ 注册模型</Button></div>
      <Table>
        <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {[
            { provider: 'OpenAI', model: 'gpt-4o', type: 'chat' },
            { provider: 'OpenAI', model: 'text-embedding-3-lg', type: 'embedding' },
            { provider: 'DeepSeek', model: 'deepseek-chat', type: 'chat' },
          ].map((m) => (
            <TableRow key={m.model}><TableCell>{m.provider}</TableCell><TableCell>{m.model}</TableCell><TableCell>{m.type}</TableCell><TableCell><Badge variant="secondary">Active</Badge></TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
