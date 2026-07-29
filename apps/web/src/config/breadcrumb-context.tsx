'use client';

import { useSyncExternalStore } from 'react';

// ==================== 模块级 Store ====================

let segmentLabels: Record<string, string> = {};
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Record<string, string> {
  return segmentLabels;
}

/** 页面调用此函数设置面包屑标签（通常在 useEffect 中） */
export function setBreadcrumbLabels(labels: Record<string, string>): void {
  segmentLabels = labels;
  listeners.forEach((cb) => cb());
}

/** Header 调用此 Hook 读取当前标签覆盖 */
export function useBreadcrumbLabels(): Record<string, string> {
  return useSyncExternalStore(subscribe, getSnapshot);
}
