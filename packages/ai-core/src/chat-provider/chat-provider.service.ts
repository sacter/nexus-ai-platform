import { ChatProvider, ChatProtocol } from './chat-provider.interface.js';
import { OpenAiCompatibleChatClient } from './clients/openai-compatible.client.js';
import { OllamaNativeChatClient } from './clients/ollama-native.client.js';

export interface ChatProviderOptions {
  /** 协议（wire format）；缺省按 openai-compatible 处理 */
  protocol?: ChatProtocol;
  baseUrl: string; // 来自 DB：models.api_key.base_url
  apiKey?: string;
}

/**
 * 按协议返回 client；未知/缺省一律走 openai-compatible（覆盖绝大多数厂商）。
 * 换厂商/换模型 = 改 DB 数据，不改代码；只有协议真不同才需要新增 client 并在这里分派。
 */
export function createChatProvider(opts: ChatProviderOptions): ChatProvider {
  return opts.protocol === 'ollama-native'
    ? new OllamaNativeChatClient({ baseUrl: opts.baseUrl })
    : new OpenAiCompatibleChatClient({
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
      });
}
