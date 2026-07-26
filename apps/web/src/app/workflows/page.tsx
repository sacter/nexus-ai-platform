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
import { Button } from '@heroui/react';

export default function WorkflowsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Workflow 列表
        </h1>
        <Button variant="primary">+ 创建 Workflow</Button>
      </div>
      <Table>
        <TableContent aria-label="Workflow 列表">
        <TableHeader>
          <TableColumn>名称</TableColumn>
          <TableColumn>类型</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>更新时间</TableColumn>
        </TableHeader>
        <TableBody>
          {[
            {
              name: 'Reflection RAG',
              type: 'reflection_rag',
              status: 'Active',
              date: '07-18',
            },
            {
              name: 'Standard RAG',
              type: 'rag',
              status: 'Active',
              date: '07-15',
            },
          ].map((wf) => (
            <TableRow key={wf.name}>
              <TableCell>{wf.name}</TableCell>
              <TableCell>{wf.type}</TableCell>
              <TableCell>
                <Badge color="success" variant="soft">
                  {wf.status}
                </Badge>
              </TableCell>
              <TableCell>{wf.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
      </Table>
    </MainLayout>
  );
}
