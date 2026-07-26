import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">文档列表</h1>
          <p className="text-sm text-muted-foreground">知识库: {kbId}</p>
        </div>
        <Button>+ 上传文档</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>文件名</TableHead>
            <TableHead>版本</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>Chunks</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { name: '员工手册.pdf', version: 'v3', status: 'Ready', chunks: 145, date: '07-18' },
            { name: '考勤制度.pdf', version: 'v1', status: 'Ready', chunks: 32, date: '07-20' },
          ].map((doc) => (
            <TableRow key={doc.name}>
              <TableCell>{doc.name}</TableCell>
              <TableCell>{doc.version}</TableCell>
              <TableCell><Badge variant="secondary">{doc.status}</Badge></TableCell>
              <TableCell>{doc.chunks}</TableCell>
              <TableCell>{doc.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
