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

export default function AuditLogsPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">审计日志</h1>
      <Table>
        <TableContent aria-label="审计日志">
          <TableHeader>
            <TableColumn>Time</TableColumn>
            <TableColumn>User</TableColumn>
            <TableColumn>Action</TableColumn>
            <TableColumn>Target</TableColumn>
          </TableHeader>
          <TableBody>
            {[
              {
                time: '07-22 14:30',
                user: 'zhang',
                action: '上传文档',
                target: 'HR/员工手册v3',
              },
              {
                time: '07-22 14:00',
                user: 'lisi',
                action: '删除文档',
                target: 'Finance/旧发票',
              },
              {
                time: '07-22 10:00',
                user: 'admin',
                action: '修改权限',
                target: 'HR → Editor',
              },
            ].map((log) => (
              <TableRow key={log.time + log.user}>
                <TableCell>{log.time}</TableCell>
                <TableCell>{log.user}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.target}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </MainLayout>
  );
}
