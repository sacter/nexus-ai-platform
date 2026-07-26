import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function AuditLogsPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6">审计日志</h1>
      <Table>
        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead></TableRow></TableHeader>
        <TableBody>
          {[
            { time: '07-22 14:30', user: 'zhang', action: '上传文档', target: 'HR/员工手册v3' },
            { time: '07-22 14:00', user: 'lisi', action: '删除文档', target: 'Finance/旧发票' },
            { time: '07-22 10:00', user: 'admin', action: '修改权限', target: 'HR → Editor' },
          ].map((log) => (
            <TableRow key={log.time + log.user}><TableCell>{log.time}</TableCell><TableCell>{log.user}</TableCell><TableCell>{log.action}</TableCell><TableCell>{log.target}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
