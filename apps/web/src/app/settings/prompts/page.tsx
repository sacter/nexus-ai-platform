import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export default function PromptsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold">Prompt Template 管理</h1><Button>+ 创建模板</Button></div>
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Latest</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
        <TableBody>
          {[{ name: 'RAG Default', version: 'v3', date: '07-18' }, { name: 'HR Assistant', version: 'v1', date: '07-20' }].map((p) => (
            <TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell>{p.version}</TableCell><TableCell>{p.date}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
