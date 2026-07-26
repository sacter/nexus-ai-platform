import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function WorkflowsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold">Workflow 列表</h1><Button>+ 创建 Workflow</Button></div>
      <Table>
        <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>更新时间</TableHead></TableRow></TableHeader>
        <TableBody>
          {[
            { name: 'Reflection RAG', type: 'reflection_rag', status: 'Active', date: '07-18' },
            { name: 'Standard RAG', type: 'rag', status: 'Active', date: '07-15' },
          ].map((wf) => (
            <TableRow key={wf.name}><TableCell>{wf.name}</TableCell><TableCell>{wf.type}</TableCell><TableCell><Badge variant="secondary">{wf.status}</Badge></TableCell><TableCell>{wf.date}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
