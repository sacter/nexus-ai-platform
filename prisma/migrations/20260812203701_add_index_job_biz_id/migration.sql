-- AlterTable: 业务幂等键（INDEX/REINDEX = versionId；DELETE_CHUNKS 审计记录为 NULL）
ALTER TABLE "index_jobs" ADD COLUMN "biz_id" UUID;

-- CreateIndex: 唯一索引，多个 NULL 允许共存（PG 语义）
CREATE UNIQUE INDEX "index_jobs_biz_id_key" ON "index_jobs"("biz_id");
