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

export default function ModelsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Model Center</h1>
        <Button variant="primary">+ 注册模型</Button>
      </div>
      <Table>
        <TableContent aria-label="模型列表">
          <TableHeader>
            <TableColumn>Provider</TableColumn>
            <TableColumn>Model</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn>Status</TableColumn>
          </TableHeader>
          <TableBody>
            {[
              { provider: 'OpenAI', model: 'gpt-4o', type: 'chat' },
              { provider: 'OpenAI', model: 'text-embedding-3-lg', type: 'embedding' },
              { provider: 'DeepSeek', model: 'deepseek-chat', type: 'chat' },
            ].map((m) => (
              <TableRow key={m.model}>
                <TableCell>{m.provider}</TableCell>
                <TableCell>{m.model}</TableCell>
                <TableCell>{m.type}</TableCell>
                <TableCell>
                  <Badge color="success" variant="soft">
                    Active
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </MainLayout>
  );
}
