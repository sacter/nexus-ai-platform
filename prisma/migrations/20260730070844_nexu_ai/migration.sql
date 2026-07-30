-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INDEX', 'REINDEX', 'DELETE_CHUNKS');

-- CreateEnum
CREATE TYPE "KbRole" AS ENUM ('admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DOCUMENT_UPLOAD', 'DOCUMENT_DELETE', 'DOCUMENT_REINDEX', 'KB_CREATE', 'KB_DELETE', 'KB_UPDATE', 'PERMISSION_CHANGE', 'SETTING_CHANGE', 'API_KEY_CREATE', 'API_KEY_DELETE', 'PROMPT_CREATE', 'PROMPT_UPDATE', 'USER_LOGIN', 'VERSION_ACTIVATE', 'AI_APP_CREATE', 'AI_APP_DELETE', 'AI_APP_UPDATE', 'MODEL_REGISTER', 'MODEL_DELETE', 'WORKFLOW_CREATE', 'WORKFLOW_UPDATE', 'WORKFLOW_EXECUTE', 'TOOL_REGISTER', 'TOOL_DELETE', 'TOOL_EXECUTE', 'CHAT_FEEDBACK');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('chat', 'embedding', 'rerank');

-- CreateEnum
CREATE TYPE "ToolType" AS ENUM ('sql', 'http', 'search', 'function', 'filesystem');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('active', 'inactive', 'draft');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED', 'WAITING');

-- CreateEnum
CREATE TYPE "WorkflowNodeType" AS ENUM ('start', 'end', 'retriever', 'llm', 'tool', 'condition', 'reflection', 'planner', 'solver', 'aggregator', 'code');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "embedding_model" VARCHAR(64),
    "retrieval_strategy" VARCHAR(32) NOT NULL DEFAULT 'vector',
    "created_by" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_permissions" (
    "id" UUID NOT NULL,
    "kb_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "KbRole" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "kb_id" UUID NOT NULL,
    "user_id" UUID,
    "current_version_id" UUID,
    "name" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(512) NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "file_size" BIGINT NOT NULL DEFAULT 0,
    "mime_type" VARCHAR(128) NOT NULL DEFAULT 'application/pdf',
    "page_count" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "embedding_model" VARCHAR(64),
    "embedding_dim" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "file_url" VARCHAR(1024) NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "status" "VersionStatus" NOT NULL DEFAULT 'PROCESSING',
    "change_summary" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "parent_chunk_id" UUID,
    "content" TEXT NOT NULL,
    "content_hash" VARCHAR(64),
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "tsv" tsvector,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk_embeddings" (
    "id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "model_name" VARCHAR(64) NOT NULL,
    "kb_id" UUID NOT NULL,
    "embedding" vector(3072) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "index_jobs" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID,
    "job_type" "JobType" NOT NULL DEFAULT 'INDEX',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" SMALLINT NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "step_description" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "index_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kb_id" UUID,
    "title" VARCHAR(512) NOT NULL DEFAULT 'New Chat',
    "prompt_template_id" UUID,
    "ai_application_id" UUID,
    "workflow_type" VARCHAR(32) NOT NULL DEFAULT 'rag',
    "workflow_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID,
    "kb_id" UUID,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "model" VARCHAR(128) NOT NULL DEFAULT '',
    "base_url" VARCHAR(512),
    "api_key" VARCHAR(512) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_applications" (
    "id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(64) NOT NULL DEFAULT 'bot',
    "knowledge_base_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "prompt_template_id" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_application_tools" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_application_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "model_name" VARCHAR(128) NOT NULL,
    "type" "ModelType" NOT NULL,
    "display_name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "api_key_id" UUID,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "type" "WorkflowNodeType" NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_edges" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "source_handle" VARCHAR(64),
    "target_handle" VARCHAR(64),
    "label" VARCHAR(128),
    "condition" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID,
    "application_id" UUID,
    "session_id" UUID,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "node_steps" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "type" "ToolType" NOT NULL,
    "display_name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "api_key_id" UUID,
    "config" JSONB NOT NULL DEFAULT '{}',
    "security" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "knowledge_bases_created_by_idx" ON "knowledge_bases"("created_by");

-- CreateIndex
CREATE INDEX "kb_permissions_kb_id_idx" ON "kb_permissions"("kb_id");

-- CreateIndex
CREATE INDEX "kb_permissions_user_id_idx" ON "kb_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kb_permissions_kb_id_user_id_key" ON "kb_permissions"("kb_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_current_version_id_key" ON "documents"("current_version_id");

-- CreateIndex
CREATE INDEX "documents_kb_id_idx" ON "documents"("kb_id");

-- CreateIndex
CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at" DESC);

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "document_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE INDEX "document_chunks_version_id_idx" ON "document_chunks"("version_id");

-- CreateIndex
CREATE INDEX "document_chunks_version_id_page_chunk_index_idx" ON "document_chunks"("version_id", "page", "chunk_index");

-- CreateIndex
CREATE INDEX "document_chunks_content_hash_idx" ON "document_chunks"("content_hash");

-- CreateIndex
CREATE INDEX "chunk_embeddings_chunk_id_idx" ON "chunk_embeddings"("chunk_id");

-- CreateIndex
CREATE INDEX "chunk_embeddings_model_name_idx" ON "chunk_embeddings"("model_name");

-- CreateIndex
CREATE INDEX "chunk_embeddings_kb_id_idx" ON "chunk_embeddings"("kb_id");

-- CreateIndex
CREATE UNIQUE INDEX "chunk_embeddings_chunk_id_model_name_key" ON "chunk_embeddings"("chunk_id", "model_name");

-- CreateIndex
CREATE INDEX "index_jobs_document_id_idx" ON "index_jobs"("document_id");

-- CreateIndex
CREATE INDEX "index_jobs_version_id_idx" ON "index_jobs"("version_id");

-- CreateIndex
CREATE INDEX "index_jobs_status_idx" ON "index_jobs"("status");

-- CreateIndex
CREATE INDEX "index_jobs_created_at_idx" ON "index_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_kb_id_idx" ON "chat_sessions"("kb_id");

-- CreateIndex
CREATE INDEX "chat_sessions_ai_application_id_idx" ON "chat_sessions"("ai_application_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_name_key" ON "prompt_templates"("name");

-- CreateIndex
CREATE INDEX "prompt_template_versions_template_id_idx" ON "prompt_template_versions"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_template_versions_template_id_version_number_key" ON "prompt_template_versions"("template_id", "version_number");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_kb_id_idx" ON "audit_logs"("kb_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "api_keys_provider_idx" ON "api_keys"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_provider_name_key" ON "api_keys"("provider", "name");

-- CreateIndex
CREATE INDEX "workflows_type_idx" ON "workflows"("type");

-- CreateIndex
CREATE INDEX "ai_applications_knowledge_base_id_idx" ON "ai_applications"("knowledge_base_id");

-- CreateIndex
CREATE INDEX "ai_applications_workflow_id_idx" ON "ai_applications"("workflow_id");

-- CreateIndex
CREATE INDEX "ai_applications_model_id_idx" ON "ai_applications"("model_id");

-- CreateIndex
CREATE INDEX "ai_applications_status_idx" ON "ai_applications"("status");

-- CreateIndex
CREATE INDEX "ai_applications_created_by_idx" ON "ai_applications"("created_by");

-- CreateIndex
CREATE INDEX "ai_application_tools_application_id_idx" ON "ai_application_tools"("application_id");

-- CreateIndex
CREATE INDEX "ai_application_tools_tool_id_idx" ON "ai_application_tools"("tool_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_application_tools_application_id_tool_id_key" ON "ai_application_tools"("application_id", "tool_id");

-- CreateIndex
CREATE INDEX "models_provider_idx" ON "models"("provider");

-- CreateIndex
CREATE INDEX "models_type_idx" ON "models"("type");

-- CreateIndex
CREATE INDEX "models_api_key_id_idx" ON "models"("api_key_id");

-- CreateIndex
CREATE INDEX "models_created_by_idx" ON "models"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "models_provider_model_name_key" ON "models"("provider", "model_name");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflow_id_idx" ON "workflow_nodes"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_edges_workflow_id_idx" ON "workflow_edges"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_edges_source_node_id_idx" ON "workflow_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "workflow_edges_target_node_id_idx" ON "workflow_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_executions_application_id_idx" ON "workflow_executions"("application_id");

-- CreateIndex
CREATE INDEX "workflow_executions_session_id_idx" ON "workflow_executions"("session_id");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_created_at_idx" ON "workflow_executions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tools_name_key" ON "tools"("name");

-- CreateIndex
CREATE INDEX "tools_type_idx" ON "tools"("type");

-- CreateIndex
CREATE INDEX "tools_api_key_id_idx" ON "tools"("api_key_id");

-- CreateIndex
CREATE INDEX "tools_is_active_idx" ON "tools"("is_active");

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_permissions" ADD CONSTRAINT "kb_permissions_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_permissions" ADD CONSTRAINT "kb_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_parent_chunk_id_fkey" FOREIGN KEY ("parent_chunk_id") REFERENCES "document_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_embeddings" ADD CONSTRAINT "chunk_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_embeddings" ADD CONSTRAINT "chunk_embeddings_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "index_jobs" ADD CONSTRAINT "index_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "index_jobs" ADD CONSTRAINT "index_jobs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_ai_application_id_fkey" FOREIGN KEY ("ai_application_id") REFERENCES "ai_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "prompt_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_applications" ADD CONSTRAINT "ai_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_application_tools" ADD CONSTRAINT "ai_application_tools_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "ai_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_application_tools" ADD CONSTRAINT "ai_application_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "ai_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
