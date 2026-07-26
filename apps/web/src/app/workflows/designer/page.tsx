'use client';

import { MainLayout } from '@/components/layout/main-layout';

export default function WorkflowDesignerPage() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-semibold mb-6 text-foreground">
        Workflow Designer (V3)
      </h1>
      <div className="h-96 rounded-xl border border-dashed border-border flex items-center justify-center bg-surface-secondary">
        <p className="text-foreground/60 text-sm">
          可视化编辑器 — React Flow 拖拽区域
        </p>
      </div>
    </MainLayout>
  );
}
