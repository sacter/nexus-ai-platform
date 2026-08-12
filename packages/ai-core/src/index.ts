// Embedding
export { EmbeddingService } from './embedding/embedding.service.js';
export type { QueryEmbedResult } from './embedding/embedding.service.js';
export { EmbeddingModule } from './embedding/embedding.module.js';
export { BatchEmbedder } from './embedding/batch-embedder.js';

// Embedding Providers
export type { EmbeddingProvider } from './embedding/providers/embedding-provider.interface.js';
export { OllamaEmbeddingProvider } from './embedding/providers/ollama-embedding.provider.js';
export type { OllamaEmbeddingConfig } from './embedding/providers/ollama-embedding.provider.js';
export { OpenAiEmbeddingProvider } from './embedding/providers/openai-embedding.provider.js';
export type { OpenAiEmbeddingConfig } from './embedding/providers/openai-embedding.provider.js';

// Model Provider
export {
  isEmbeddingProviderName,
  parseModelName,
  resolveKnownModel,
} from './model-provider/model-provider.js';
export type {
  EmbeddingProviderName,
  EmbeddingModelConfig,
} from './model-provider/model-provider.js';
export { ModelProviderService } from './model-provider/model-provider.service.js';
export { ModelProviderModule } from './model-provider/model-provider.module.js';
