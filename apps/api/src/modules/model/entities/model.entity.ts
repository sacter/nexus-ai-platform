import { ModelType } from '@prisma/client';

/**
 * models 表实体（与 DATABASE.md 4.20 结构一致，camelCase）。
 * apiKeyName 由列表/详情查询 LEFT JOIN api_keys 附带返回。
 */
export class Model {
  id!: string;

  /** Provider 标识，与 api_keys.provider 对应 */
  provider!: string;

  modelName!: string;

  /** chat=对话模型, embedding=嵌入模型, rerank=重排序模型 */
  type!: ModelType;

  displayName!: string;

  description!: string | null;

  /** 关联 api_keys 凭证 id；null=使用环境变量默认 */
  apiKeyId!: string | null;

  /** 关联凭证名称（来自 api_keys.name） */
  apiKeyName!: string | null;

  /** 模型能力参数，按 type 结构不同 */
  config!: Record<string, unknown>;

  isActive!: boolean;

  createdBy!: string;

  createdAt!: Date;

  updatedAt!: Date;
}
