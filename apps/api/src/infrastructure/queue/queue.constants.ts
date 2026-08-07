/**
 * 队列名与并发配置 —— 独立 Queue 粒度
 * index(CPU)/embedding(IO)/reindex(混合)/delete-chunks(IO)/cleanup(IO) 互不阻塞
 */
export const QUEUE_NAMES = {
  INDEX: 'index',
  EMBEDDING: 'embedding',
  REINDEX: 'reindex',
  DELETE_CHUNKS: 'delete-chunks',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
  [QUEUE_NAMES.INDEX]: 3,
  [QUEUE_NAMES.EMBEDDING]: 5,
  [QUEUE_NAMES.REINDEX]: 2,
  [QUEUE_NAMES.DELETE_CHUNKS]: 2,
  [QUEUE_NAMES.CLEANUP]: 1,
};
