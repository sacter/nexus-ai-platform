-- 对齐 chunk_embeddings.embedding 列维度与运行模型 bge-m3 (1024 维)
-- 原列为 vector(3072)（对应 text-embedding-3-large），与 .env 的 EMBEDDING_DIMENSION=1024 不一致
-- Prisma 将 Unsupported("vector(...)") 视为不透明类型，3072→1024 不产生 diff，故手写 ALTER
-- 表当前为空，ALTER TYPE 无数据转换风险
ALTER TABLE "chunk_embeddings" ALTER COLUMN "embedding" TYPE vector(1024);
