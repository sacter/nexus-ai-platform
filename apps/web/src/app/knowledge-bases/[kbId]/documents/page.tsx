'use client';

import { use } from 'react';
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
import { Button } from '@heroui/react';

export default function DocumentsPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = use(params);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">文档列表</h1>
          <p className="text-sm text-foreground/60">知识库: {kbId}</p>
        </div>
        <Button variant="primary">+ 上传文档</Button>
      </div>
      <Table>
        <TableContent aria-label="文档列表">
        <TableHeader>
          <TableColumn>文件名</TableColumn>
          <TableColumn>版本</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>Chunks</TableColumn>
          <TableColumn>时间</TableColumn>
        </TableHeader>
        <TableBody>
          {[
            {
              name: '员工手册.pdf',
              version: 'v3',
              status: 'Ready',
              chunks: 145,
              date: '07-18',
            },
            {
              name: '考勤制度.pdf',
              version: 'v1',
              status: 'Ready',
              chunks: 32,
              date: '07-20',
            },
          ].map((doc) => (
            <TableRow key={doc.name}>
              <TableCell>{doc.name}</TableCell>
              <TableCell>{doc.version}</TableCell>
              <TableCell>
                <Badge color="success" variant="soft">
                  {doc.status}
                </Badge>
              </TableCell>
              <TableCell>{doc.chunks}</TableCell>
              <TableCell>{doc.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
      </Table>
    </MainLayout>
  );
}
