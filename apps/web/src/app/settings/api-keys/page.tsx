import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ApiKeysPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold">API Key 管理</h1><Button>+ 添加 Key</Button></div>
      <Table>
        <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Key</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {[{ provider: 'OpenAI', key: 'sk-****abcd' }, { provider: 'DeepSeek', key: 'sk-****efgh' }].map((k) => (
            <TableRow key={k.provider}><TableCell>{k.provider}</TableCell><TableCell className="font-mono">{k.key}</TableCell><TableCell><Badge variant="secondary">Active</Badge></TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
