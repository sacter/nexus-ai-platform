// ChatProvider 协议抽象 —— 认协议不认厂商
export type {
  ChatRole,
  ChatMessage,
  ChatProtocol,
  ChatRequest,
  ChatChunk,
  ChatProvider,
} from './chat-provider.interface.js';

export {
  OpenAiCompatibleChatClient,
} from './clients/openai-compatible.client.js';
export type { OpenAiCompatibleChatConfig } from './clients/openai-compatible.client.js';
export {
  OllamaNativeChatClient,
} from './clients/ollama-native.client.js';
export type { OllamaNativeChatConfig } from './clients/ollama-native.client.js';

export { createChatProvider } from './chat-provider.service.js';
export type { ChatProviderOptions } from './chat-provider.service.js';
