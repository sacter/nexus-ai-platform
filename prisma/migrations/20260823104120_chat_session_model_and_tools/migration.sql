-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "model_id" UUID;

-- CreateTable
CREATE TABLE "chat_session_tools" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_session_tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_session_tools_session_id_idx" ON "chat_session_tools"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_session_tools_session_id_tool_id_key" ON "chat_session_tools"("session_id", "tool_id");

-- CreateIndex
CREATE INDEX "chat_sessions_model_id_idx" ON "chat_sessions"("model_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_session_tools" ADD CONSTRAINT "chat_session_tools_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_session_tools" ADD CONSTRAINT "chat_session_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
