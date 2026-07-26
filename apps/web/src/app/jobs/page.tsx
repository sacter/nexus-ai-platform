'use client';

import { MainLayout } from '@/components/layout/main-layout';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  TableContent,
} from '@heroui/react';
import { Badge } from '@heroui/react';
import { ProgressBar } from '@heroui/react';

export default function JobsPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        Index Job 监控
      </h1>
      <Table>
        <TableContent aria-label="Job 监控">
        <TableHeader>
          <TableColumn>Job ID</TableColumn>
          <TableColumn>类型</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>进度</TableColumn>
          <TableColumn>时间</TableColumn>
        </TableHeader>
        <TableBody>
          {[
            {
              id: 'job_abc123',
              type: 'Index',
              status: 'Done',
              progress: 100,
              time: '07-22 14:30',
            },
            {
              id: 'job_def456',
              type: 'Embedding',
              status: 'Running',
              progress: 65,
              time: '07-22 15:00',
            },
          ].map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-xs">{job.id}</TableCell>
              <TableCell>{job.type}</TableCell>
              <TableCell>
                <Badge
                  color={job.status === 'Done' ? 'success' : 'warning'}
                  variant="soft"
                >
                  {job.status}
                </Badge>
              </TableCell>
              <TableCell>
                <ProgressBar
                  value={job.progress}
                  className="w-24"
                  color={job.progress === 100 ? 'success' : 'accent'}
                  size="sm"
                />
              </TableCell>
              <TableCell>{job.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
      </Table>
    </MainLayout>
  );
}
