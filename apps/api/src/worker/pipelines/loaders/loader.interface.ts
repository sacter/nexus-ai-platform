/** 一页/一段已抽取文本 */
export interface LoadedPage {
  pageNumber: number;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Loader 策略接口 —— 新增格式只需注册新 Loader，无需改 Pipeline
 */
export interface Loader {
  supports(mimeType: string, fileName?: string): boolean;
  load(buffer: Buffer, mimeType: string, fileName?: string): Promise<LoadedPage[]>;
}
