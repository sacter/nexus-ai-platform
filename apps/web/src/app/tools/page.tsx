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

export default function ToolsPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Tool Center</h1>
        <Button variant="primary">+ 注册工具</Button>
      </div>
      <Table>
        <TableContent aria-label="工具列表">
        <TableHeader>
          <TableColumn>Name</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Description</TableColumn>
          <TableColumn>Status</TableColumn>
        </TableHeader>
        <TableBody>
          {[
            { name: 'SQL Query', type: 'sql', desc: '数据库查询' },
            { name: 'Web Search', type: 'search', desc: 'Web 搜索' },
            { name: 'Calculator', type: 'function', desc: '数学计算' },
          ].map((t) => (
            <TableRow key={t.name}>
              <TableCell>{t.name}</TableCell>
              <TableCell>{t.type}</TableCell>
              <TableCell>{t.desc}</TableCell>
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
