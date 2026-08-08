-- chunk_embeddings 是唯一经原生 SQL（$executeRaw）写入的表，
-- 绕过了 Prisma 客户端的 @default(uuid())（客户端生成，非 DB 默认），
-- 导致 INSERT 时 id 为空违反 NOT NULL（23502）。补 DB 级默认值兜底。
-- PG13+ 内置 gen_random_uuid()，无需 pgcrypto 扩展。
ALTER TABLE "chunk_embeddings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
