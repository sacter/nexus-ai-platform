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
import { Button } from '@heroui/react';

export default function PromptsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Prompt Template 管理
        </h1>
        <Button variant="primary">+ 创建模板</Button>
      </div>
      <Table>
        <TableContent aria-label="Prompt Templates">
        <TableHeader>
          <TableColumn>Name</TableColumn>
          <TableColumn>Latest</TableColumn>
          <TableColumn>Updated</TableColumn>
        </TableHeader>
        <TableBody>
          {[
            { name: 'RAG Default', version: 'v3', date: '07-18' },
            { name: 'HR Assistant', version: 'v1', date: '07-20' },
          ].map((p) => (
            <TableRow key={p.name}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.version}</TableCell>
              <TableCell>{p.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
      </Table>
    </MainLayout>
  );
}
