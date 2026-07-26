import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ToolsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold">Tool Center</h1><Button>+ 注册工具</Button></div>
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {[
            { name: 'SQL Query', type: 'sql', desc: '数据库查询' },
            { name: 'Web Search', type: 'search', desc: 'Web 搜索' },
            { name: 'Calculator', type: 'function', desc: '数学计算' },
          ].map((t) => (
            <TableRow key={t.name}><TableCell>{t.name}</TableCell><TableCell>{t.type}</TableCell><TableCell>{t.desc}</TableCell><TableCell><Badge variant="secondary">Active</Badge></TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
