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

export default function ApiKeysPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          API Key 管理
        </h1>
        <Button variant="primary">+ 添加 Key</Button>
      </div>
      <Table>
        <TableContent aria-label="API Keys">
        <TableHeader>
          <TableColumn>Provider</TableColumn>
          <TableColumn>Key</TableColumn>
          <TableColumn>Status</TableColumn>
        </TableHeader>
        <TableBody>
          {[
            { provider: 'OpenAI', key: 'sk-****abcd' },
            { provider: 'DeepSeek', key: 'sk-****efgh' },
          ].map((k) => (
            <TableRow key={k.provider}>
              <TableCell>{k.provider}</TableCell>
              <TableCell className="font-mono">{k.key}</TableCell>
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
