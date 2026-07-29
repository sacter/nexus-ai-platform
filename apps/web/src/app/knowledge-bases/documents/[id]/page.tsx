'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@heroui/react';
import { Badge } from '@heroui/react';
import { Tabs, TabList, Tab, TabPanel } from '@heroui/react';

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ kbId: string; id: string }>;
}) {
  const { id } = use(params);

  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-2 text-foreground">
        文档详情
      </h1>
      <p className="text-sm text-foreground/60 mb-6">ID: {id}</p>
      <Tabs>
        <TabList aria-label="文档详情标签">
          <Tab id="info">基本信息</Tab>
          <Tab id="versions">版本历史</Tab>
          <Tab id="chunks">Chunks</Tab>
        </TabList>
        <TabPanel id="info">
          <Card className="mt-4">
            <CardHeader>
              <h2 className="text-base font-semibold text-foreground">
                Document Info
              </h2>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Badge color="success" variant="soft">
                  Ready
                </Badge>
                <span className="text-sm text-foreground/60">Chunks: 145</span>
                <span className="text-sm text-foreground/60">Dim: 1536</span>
              </div>
            </CardContent>
          </Card>
        </TabPanel>
        <TabPanel id="versions">
          <Card className="mt-4">
            <CardHeader>
              <h2 className="text-base font-semibold text-foreground">
                版本历史
              </h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/60">v3 · v2 · v1</p>
            </CardContent>
          </Card>
        </TabPanel>
        <TabPanel id="chunks">
          <Card className="mt-4">
            <CardHeader>
              <h2 className="text-base font-semibold text-foreground">
                Chunks
              </h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[
                { id: 1, page: 1, text: '公司实行弹性工作制...' },
                { id: 2, page: 1, text: '员工请假需提前...' },
              ].map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-3 rounded-lg bg-surface-secondary text-sm"
                >
                  <p className="font-medium mb-1 text-foreground">
                    Chunk {chunk.id} (Page {chunk.page})
                  </p>
                  <p className="text-foreground/60">{chunk.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>
    </MainLayout>
  );
}
