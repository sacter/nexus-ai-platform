import { MainLayout } from '@/components/layout/main-layout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function JobsPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6">Index Job 监控</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>进度</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { id: 'job_abc123', type: 'Index', status: 'Done', progress: 100, time: '07-22 14:30' },
            { id: 'job_def456', type: 'Embedding', status: 'Running', progress: 65, time: '07-22 15:00' },
          ].map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-xs">{job.id}</TableCell>
              <TableCell>{job.type}</TableCell>
              <TableCell><Badge variant={job.status === 'Done' ? 'secondary' : 'outline'}>{job.status}</Badge></TableCell>
              <TableCell><Progress value={job.progress} className="w-24" /></TableCell>
              <TableCell>{job.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MainLayout>
  );
}
