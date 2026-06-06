
import { GoogleGenAI } from "@google/genai";
import { AppSettings } from "../../types";

// SAFELY override fetch using defineProperty to handle "only a getter" environments
const originalFetch = window.fetch;
try {
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    get: () => async (...args: [RequestInfo | URL, RequestInit?]) => {
      const [resource, config] = args;
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : (resource as Request).url;
      
      const RETRYABLE_STATUS_CODES = [401, 429, 502, 503, 504];
      const MAX_RETRIES = 3;
      
      const performFetch = async (targetUrl: string, targetConfig: RequestInit | undefined, attempt: number = 0): Promise<Response> => {
        try {
          const response = await originalFetch(targetUrl, targetConfig);
          
          if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
            const delay = response.status === 401 ? 2000 : Math.pow(2, attempt + 1) * 1000;
            // console.log(`%c[Fetch Guard] 🔄 Thử lại lần ${attempt + 1}/${MAX_RETRIES} (Status: ${response.status}) sau ${delay}ms...`, "color: #f59e0b; font-weight: bold;");
            await new Promise(resolve => setTimeout(resolve, delay));
            return performFetch(targetUrl, targetConfig, attempt + 1);
          }
          
          return response;
        } catch (error) {
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt + 1) * 1000;
            // console.log(`%c[Fetch Guard] 🌐 Lỗi mạng, thử lại lần ${attempt + 1}/${MAX_RETRIES} sau ${delay}ms...`, "color: #ef4444; font-weight: bold;");
            await new Promise(resolve => setTimeout(resolve, delay));
            return performFetch(targetUrl, targetConfig, attempt + 1);
          }
          throw error;
        }
      };

      // Check if this is a Google AI request
      if (url.includes('generativelanguage.googleapis.com')) {
        const proxyUrl = (window as Window & { __GEMINI_PROXY_URL__?: string | null }).__GEMINI_PROXY_URL__;
        
        if (proxyUrl) {
          // Strip /v1 or /v1beta from the end of proxyUrl if present
          const cleanProxy = proxyUrl.trim().replace(/\/+$/, '').replace(/\/v1beta$|\/v1$/, '');
          const newUrl = url.replace('https://generativelanguage.googleapis.com', cleanProxy);
          
          // console.log(`%c[Fetch Guard] 🛡️ Redirecting to Proxy: ${newUrl.substring(0, 80)}...`, "color: #f59e0b; font-weight: bold;");
          
          // Ensure headers are set correctly for the proxy
          const newConfig = { ...config };
          if (newConfig.headers) {
            const headers = new Headers(newConfig.headers);
            // Some proxies need the key in Authorization header
            const apiKey = headers.get('x-goog-api-key');
            if (apiKey && !headers.has('Authorization')) {
              headers.set('Authorization', `Bearer ${apiKey}`);
            }
            newConfig.headers = headers;
          }
          
          return performFetch(newUrl, newConfig);
        }
      }

      return performFetch(url, config);
    }
  });
} catch (e) {
  console.error("[AI Client] Không thể ghi đè fetch toàn cục, đang sử dụng fallback SDK.", e);
}

// Global counter for sequential API key rotation
let currentKeyIndex = 0;
let poolCounter = 0;

// Helper to get configured AI instance
export const getAiClient = (settings?: AppSettings, forceDirect: boolean = false): GoogleGenAI => {
  // PROXY POOL MODE INTERCEPTION
  if (!forceDirect && settings?.useProxyPool && settings?.proxies) {
    const pool = settings.proxies.filter(p => p.isActive !== false && p.url && p.key);
    if (pool.length > 0) {
      return {
        models: {
          calculateTokens: async (params: any) => {
            const active = pool[0];
            const client = getAiClient({ ...settings, useProxyPool: false, activeProxyId: active.id }, forceDirect);
            return (client.models as any).calculateTokens(params);
          },
          generateContent: async (params: any) => {
            const maxRetries = Math.min(3, pool.length);
            let lastError: any = null;
            
            let startIndex = 0;
            if (settings.proxyPoolStrategy === 'random') {
              startIndex = Math.floor(Math.random() * pool.length);
            } else if (settings.proxyPoolStrategy === 'round_robin') {
              startIndex = poolCounter % pool.length;
              poolCounter = (poolCounter + 1) % pool.length;
            } else {
              startIndex = 0; // Failover (order priority)
            }
            
            for (let i = 0; i < maxRetries; i++) {
              const currentIdx = (startIndex + i) % pool.length;
              const proxy = pool[currentIdx];
              try {
                proxy.lastUsed = Date.now();
                const startTime = Date.now();
                
                const client = getAiClient({ ...settings, useProxyPool: false, activeProxyId: proxy.id }, forceDirect);
                const res = await client.models.generateContent(params);
                
                proxy.latency = Date.now() - startTime;
                proxy.failCount = 0; // reset on success
                return res;
              } catch (err: any) {
                console.error(`[Proxy Pool] ❌ Node ${proxy.url} failed: ${err.message}`);
                proxy.failCount = (proxy.failCount || 0) + 1;
                proxy.lastError = err.message || String(err);
                lastError = err;
              }
            }
            throw new Error(`[Bể Proxy Cạn Kiệt] Đã thử liên tiếp ${maxRetries} proxy trong bể nhưng đều thất bại. Lỗi cuối ghi nhận: ${lastError?.message || lastError}`);
          },
          generateContentStream: async function* (params: any, options?: any) {
            const maxRetries = Math.min(3, pool.length);
            let lastError: any = null;
            
            let startIndex = 0;
            if (settings.proxyPoolStrategy === 'random') {
              startIndex = Math.floor(Math.random() * pool.length);
            } else if (settings.proxyPoolStrategy === 'round_robin') {
              startIndex = poolCounter % pool.length;
              poolCounter = (poolCounter + 1) % pool.length;
            } else {
              startIndex = 0;
            }
            
            for (let i = 0; i < maxRetries; i++) {
              if (options?.signal?.aborted) break;
              const currentIdx = (startIndex + i) % pool.length;
              const proxy = pool[currentIdx];
              try {
                proxy.lastUsed = Date.now();
                const startTime = Date.now();
                
                const client = getAiClient({ ...settings, useProxyPool: false, activeProxyId: proxy.id }, forceDirect);
                const streamIter = client.models.generateContentStream(params, options);
                
                const firstChunk = await streamIter.next();
                if (options?.signal?.aborted) break;
                if (!firstChunk.done) {
                  yield firstChunk.value;
                }
                
                proxy.latency = Date.now() - startTime;
                proxy.failCount = 0;
                
                for await (const chunk of streamIter) {
                  if (options?.signal?.aborted) break;
                  yield chunk;
                }
                return;
              } catch (err: any) {
                console.error(`[Proxy Pool Stream] ❌ Node ${proxy.url} failed: ${err.message}`);
                proxy.failCount = (proxy.failCount || 0) + 1;
                proxy.lastError = err.message || String(err);
                lastError = err;
              }
            }
            throw new Error(`[Bể Proxy Stream Cạn Kiệt] Đã thử ${maxRetries} proxy trong bể nhưng đều thất bại. Lỗi cuối: ${lastError?.message || lastError}`);
          }
        }
      } as any;
    }
  }

  // Get active proxy from the new system
  let activeProxy = settings?.proxies?.find(p => p.id === settings.activeProxyId);
  
  // If no active proxy found in the new system OR legacy proxyEnabled is true with legacy fields populated,
  // we might want to use legacy. But let's prioritize the new system if a proxy is explicitly selected.
  if (!activeProxy && (settings?.proxyEnabled || settings?.proxyUrl)) {
    activeProxy = {
      id: 'legacy',
      name: settings?.proxyName || 'Legacy Proxy',
      url: settings?.proxyUrl || '',
      key: settings?.proxyKey || '',
      model: settings?.proxyModel || '',
      models: settings?.proxyModels || [],
      isActive: true,
      type: (settings?.proxyUrl?.includes('moonshot') || settings?.proxyUrl?.includes('kimi')) ? 'openai' : (settings?.proxyEnabled ? 'openai' : 'google')
    };
  }

  // FIX: useProxy should be true if we have a valid activeProxy with URL and Key, regardless of legacy proxyEnabled toggle
  const useProxy = !!activeProxy?.url && !!activeProxy?.key && !forceDirect;

  // Set global proxy URL for the fetch override (only for Google AI)
  if (useProxy && activeProxy && (activeProxy.type === 'google' || !activeProxy.type)) {
    (window as Window & { __GEMINI_PROXY_URL__?: string | null }).__GEMINI_PROXY_URL__ = activeProxy.url;
  } else {
    (window as Window & { __GEMINI_PROXY_URL__?: string | null }).__GEMINI_PROXY_URL__ = null;
  }

  // Priority: Proxy Key > Personal API Key > System API Key
  let apiKey: string = "";
  let source = "SYSTEM";
  
  if (useProxy && activeProxy) {
    apiKey = activeProxy.key;
    source = `PROXY (${activeProxy.name})`;
  } else if (settings?.useGeminiApi !== false && settings?.geminiApiKey && Array.isArray(settings.geminiApiKey)) {
    const keys = settings.geminiApiKey.filter(k => k && k.trim() !== "" && k !== "YOUR_API_KEY");
    if (keys.length > 0) {
        const index = currentKeyIndex % keys.length;
        apiKey = keys[index];
        source = `PERSONAL_LIST (Key #${index + 1})`;
        currentKeyIndex = (index + 1) % keys.length;
    }
  }

  if (!apiKey) {
    const safeEnv = typeof process !== "undefined" ? process.env : {};
    apiKey = safeEnv.API_KEY || safeEnv.GEMINI_API_KEY || "";
    source = safeEnv.API_KEY ? "AISTUDIO_SELECTED" : "SYSTEM_ENV";
  }

  // --- OPENAI COMPATIBILITY WRAPPER ---
  // Auto-detect OpenAI type if model name looks like one, even if type is 'google'
  const modelToTest = (activeProxy?.model || settings?.aiModel || "").toLowerCase();
  const isGeminiModel = modelToTest.includes('gemini') || modelToTest.includes('learnlm');
  
  // If we have a proxy URL and it's NOT a Gemini model, we should almost always use the OpenAI wrapper
  // because most third-party proxies for non-Gemini models use OpenAI format.
  const isKimi = activeProxy?.url?.includes('moonshot') || activeProxy?.url?.includes('kimi') || modelToTest.includes('kimi');
  const isOpenAIModel = modelToTest.includes('gpt') || modelToTest.includes('claude') || modelToTest.includes('kimi') || modelToTest.includes('moonshot') || modelToTest.includes('deepseek') || modelToTest.includes('qwen') || modelToTest.includes('grok');
  
  const effectiveType = (useProxy && activeProxy) 
    ? (activeProxy.type || ((isOpenAIModel || isKimi || !isGeminiModel) ? 'openai' : 'google')) 
    : 'google';

  if (useProxy && activeProxy && (effectiveType === 'openai' || effectiveType === 'openrouter')) {
    const baseUrl = activeProxy.url.trim().replace(/\/+$/, '');
    
    return {
      models: {
        generateContent: async (params: any) => {
          const { model, contents, config } = params;
          const systemInstruction = config?.systemInstruction;
          
          // Convert Gemini contents to OpenAI messages
          const messages: any[] = [];
          if (systemInstruction) {
            messages.push({ role: 'system', content: typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction.parts?.[0]?.text || '') });
          }
          
          let contentsArray: any[] = [];
          if (typeof contents === 'string') {
            contentsArray = [{ role: 'user', parts: [{ text: contents }] }];
          } else if (Array.isArray(contents)) {
            contentsArray = contents;
          } else if (contents && typeof contents === 'object') {
            contentsArray = [contents];
          }

          const rawMessages = contentsArray.map((c: any) => {
            if (typeof c === 'string') {
              return { role: 'user', content: c };
            }
            if (c && typeof c === 'object' && c.text) {
              return { role: 'user', content: c.text };
            }
            return {
              role: c?.role === 'model' || c?.role === 'assistant' ? 'assistant' : 'user',
              content: c?.parts?.[0]?.text || c?.text || c?.content || ''
            };
          });

          // OpenAI CRITICAL: The conversation MUST end with a 'user' message for Claude/non-Gemini models.
          while (rawMessages.length > 0 && rawMessages[rawMessages.length - 1].role === 'assistant') {
            const lastAssistantMsg = rawMessages.pop();
            const trimmedPrefill = (lastAssistantMsg.content || '').trim();
            if (trimmedPrefill) {
              const lastUserIdx = [...rawMessages].reverse().findIndex(m => m.role === 'user');
              if (lastUserIdx !== -1) {
                const idx = rawMessages.length - 1 - lastUserIdx;
                rawMessages[idx].content += `\n\n[IMPORTANT: START your response exactly with: ${trimmedPrefill}]`;
              } else {
                rawMessages.push({
                  role: 'user',
                  content: `[IMPORTANT: Please continue, starting exactly with: ${trimmedPrefill}]`
                });
              }
            }
          }

          rawMessages.forEach((msg: any) => messages.push(msg));

          const body: any = {
            model: model || activeProxy?.model || settings?.aiModel || "gemini-3.5-flash",
            messages: messages,
            temperature: config?.temperature ?? settings?.temperature ?? 1.0,
            max_tokens: config?.maxOutputTokens || 4096,
            top_p: config?.topP,
            frequency_penalty: config?.frequencyPenalty,
            presence_penalty: config?.presencePenalty,
            repetition_penalty: config?.repetitionPenalty,
            min_p: config?.minP,
            top_a: config?.topA,
            stream: false
          };

          const lowerModel = body.model.toLowerCase();
          const isThinkingModel = lowerModel.includes('kimi') || lowerModel.includes('thinking') || lowerModel.includes('o1') || lowerModel.includes('o3');
          if (isThinkingModel && (!body.max_tokens || body.max_tokens < 8192)) {
            body.max_tokens = 16384; 
          }

          if (config?.responseMimeType === 'application/json') {
            body.response_format = { type: 'json_object' };
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          };

          if (effectiveType === 'openrouter') {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'Tawa SillyTavern';
          }

          const response = await fetch('/api/ai/proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-ark-client': 'ark-v2-client'
            },
            body: JSON.stringify({
              url: `${baseUrl}/chat/completions`,
              method: 'POST',
              headers: headers,
              body: body
            })
          });

          if (!response.ok) {
            const err = await response.text();
            if (response.status === 402) {
              throw new Error("PAYMENT_REQUIRED: Model này yêu cầu API Key có trả phí (Paid Tier) hoặc đã hết hạn mức miễn phí. Vui lòng chọn API Key khác trong Cài đặt.");
            }
            throw new Error(`Proxy Error (${response.status}): ${err || response.statusText}`);
          }

          const responseText = await response.text();
          let data: any = {};
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            // Robust parsing for possible buffered SSE stream response containing [DONE]
            const lines = responseText.split('\n');
            let accumulatedText = "";
            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine || cleanLine === 'data: [DONE]' || cleanLine === '[DONE]' || cleanLine.includes('[DONE]')) continue;
              if (cleanLine.startsWith('data: ')) {
                try {
                  const chunkJson = JSON.parse(cleanLine.substring(6).trim());
                  const content = chunkJson.choices?.[0]?.delta?.content || chunkJson.choices?.[0]?.message?.content || "";
                  accumulatedText += content;
                } catch (innerErr) {
                  // Ignore partial parse failures
                }
              }
            }
            if (accumulatedText) {
              data = {
                choices: [
                  {
                    message: {
                      content: accumulatedText
                    }
                  }
                ]
              };
            } else {
              // Extract standard fallback JSON block if any exists
              const firstBrace = responseText.indexOf('{');
              const lastBrace = responseText.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                  data = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
                } catch (e2) {
                  throw new Error(`Phản hồi không phải JSON hợp lệ: ${responseText}`);
                }
              } else {
                throw new Error(`Phản hồi không chứa JSON hợp lệ: ${responseText}`);
              }
            }
          }

          const text = data.choices?.[0]?.message?.content || "";
          
          return {
            text: text,
            usageMetadata: data.usage ? {
              promptTokenCount: data.usage.prompt_tokens,
              candidatesTokenCount: data.usage.completion_tokens,
              totalTokenCount: data.usage.total_tokens
            } : undefined
          };
        },
        generateContentStream: async function* (params: any, options?: any) {
          const { model, contents, config } = params;
          const systemInstruction = config?.systemInstruction;
          
          const messages: any[] = [];
          if (systemInstruction) {
            messages.push({ role: 'system', content: typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction.parts?.[0]?.text || '') });
          }
          
          let contentsArray: any[] = [];
          if (typeof contents === 'string') {
            contentsArray = [{ role: 'user', parts: [{ text: contents }] }];
          } else if (Array.isArray(contents)) {
            contentsArray = contents;
          } else if (contents && typeof contents === 'object') {
            contentsArray = [contents];
          }

          const rawMessages = contentsArray.map((c: any) => {
            if (typeof c === 'string') {
              return { role: 'user', content: c };
            }
            if (c && typeof c === 'object' && c.text) {
              return { role: 'user', content: c.text };
            }
            return {
              role: c?.role === 'model' || c?.role === 'assistant' ? 'assistant' : 'user',
              content: c?.parts?.[0]?.text || c?.text || c?.content || ''
            };
          });

          // OpenAI CRITICAL: The conversation MUST end with a 'user' message for Claude/non-Gemini models.
          while (rawMessages.length > 0 && rawMessages[rawMessages.length - 1].role === 'assistant') {
            const lastAssistantMsg = rawMessages.pop();
            const trimmedPrefill = (lastAssistantMsg.content || '').trim();
            if (trimmedPrefill) {
              const lastUserIdx = [...rawMessages].reverse().findIndex(m => m.role === 'user');
              if (lastUserIdx !== -1) {
                const idx = rawMessages.length - 1 - lastUserIdx;
                rawMessages[idx].content += `\n\n[IMPORTANT: START your response exactly with: ${trimmedPrefill}]`;
              } else {
                rawMessages.push({
                  role: 'user',
                  content: `[IMPORTANT: Please continue, starting exactly with: ${trimmedPrefill}]`
                });
              }
            }
          }

          rawMessages.forEach((msg: any) => messages.push(msg));

          const body: any = {
            model: model || activeProxy?.model || settings?.aiModel || "gemini-3.5-flash",
            messages: messages,
            temperature: config?.temperature ?? settings?.temperature ?? 0.7,
            max_tokens: config?.maxOutputTokens || 4096,
            top_p: config?.topP,
            frequency_penalty: config?.frequencyPenalty,
            presence_penalty: config?.presencePenalty,
            repetition_penalty: config?.repetitionPenalty,
            min_p: config?.minP,
            top_a: config?.topA,
            stream: true,
            stream_options: { include_usage: true }
          };

          const lowerModel = body.model.toLowerCase();
          const isThinkingModel = lowerModel.includes('kimi') || lowerModel.includes('thinking') || lowerModel.includes('o1') || lowerModel.includes('o3');
          if (isThinkingModel && (!body.max_tokens || body.max_tokens < 8192)) {
            body.max_tokens = 16384; 
          }

          if (config?.responseMimeType === 'application/json') {
            body.response_format = { type: 'json_object' };
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          };

          if (effectiveType === 'openrouter') {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'Tawa SillyTavern';
          }

          const response = await fetch('/api/ai/proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-ark-client': 'ark-v2-client'
            },
            body: JSON.stringify({
              url: `${baseUrl}/chat/completions`,
              method: 'POST',
              headers: headers,
              body: body
            }),
            signal: options?.signal
          });

          if (!response.ok) {
            const err = await response.text();
            if (response.status === 402) {
              throw new Error("PAYMENT_REQUIRED: Model này yêu cầu API Key có trả phí (Paid Tier) hoặc đã hết hạn mức miễn phí. Vui lòng chọn API Key khác trong Cài đặt.");
            }
            throw new Error(`OpenAI Stream Proxy Error (${response.status}): ${err}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("Không thể khởi tạo stream reader");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            if (options?.signal?.aborted) {
              reader.cancel();
              break;
            }
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine || cleanLine === 'data: [DONE]' || cleanLine === '[DONE]' || cleanLine.includes('[DONE]')) continue;
              if (cleanLine.startsWith('data: ')) {
                try {
                  const json = JSON.parse(cleanLine.substring(6).trim());
                  const content = json.choices?.[0]?.delta?.content || "";
                  const usage = json.usage;
                  
                  if (content) {
                    yield { text: content };
                  }
                  
                  if (usage) {
                    yield { 
                      usageMetadata: {
                        promptTokenCount: usage.prompt_tokens,
                        candidatesTokenCount: usage.completion_tokens,
                        totalTokenCount: usage.total_tokens
                      }
                    };
                  }
                } catch (e) {
                  // Ignore parse errors for partial chunks
                }
              }
            }
          }
        }
      }
    } as any;
  }

  const requestOptions: { headers?: Record<string, string> } = {};
  let baseUrl: string | undefined = undefined;
  
  if (useProxy && activeProxy) {
    // Sanitize proxy URL (remove trailing slash and common version suffixes)
    baseUrl = activeProxy.url.trim().replace(/\/+$/, '');
    
    // SDK appends version (e.g. /v1beta) automatically. 
    // If user provided it, remove it to avoid double versioning (e.g. /v1beta/v1beta)
    if (baseUrl.endsWith('/v1beta')) {
      baseUrl = baseUrl.slice(0, -7);
    } else if (baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.slice(0, -3);
    }
    
    // Some proxies require Authorization header instead of x-goog-api-key
    requestOptions.headers = {
      'Authorization': `Bearer ${apiKey}`,
      // Keep x-goog-api-key for standard Gemini proxies
      'x-goog-api-key': apiKey
    };
  }

  // CRITICAL: baseUrl/baseURL must be at the top level of the config object for @google/genai SDK
  // We provide both to be safe across different SDK versions
  const genAIConfig: Record<string, unknown> = {
    apiKey: apiKey,
  };

  if (!apiKey && !baseUrl) {
    console.error(`%c[AI Client] ❌ KHÔNG TÌM THẤY API KEY! (Source: ${source})`, "color: #ef4444; font-weight: bold;");
  } else {
    // const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "NONE";
    // console.log(`%c[AI Client] 🔑 Sử dụng key từ: ${source} (${maskedKey})`, "color: #10b981; font-weight: bold;");
  }

  if (baseUrl) {
    // console.log(`%c[AI Client] 🌐 Đang cấu hình PROXY: ${baseUrl}`, "color: #38bdf8; font-weight: bold;");
    
    // Set at top level - @google/genai uses baseURL (uppercase URL)
    genAIConfig.baseURL = baseUrl;
    genAIConfig.baseUrl = baseUrl;
    genAIConfig.apiEndpoint = baseUrl;
    
    // Set inside requestOptions as well for redundancy
    genAIConfig.requestOptions = {
      ...requestOptions,
      baseURL: baseUrl,
      baseUrl: baseUrl,
      apiEndpoint: baseUrl,
      customHeaders: requestOptions.headers,
      fetch: (url: string, options: RequestInit) => {
        // If it's a relative URL or already contains the proxy, let it be
        if (url.startsWith('/api/')) return fetch(url, options);
        
        let targetUrl = url;
        const googleBase = 'https://generativelanguage.googleapis.com';
        if (url.startsWith(googleBase)) {
          targetUrl = url.replace(googleBase, baseUrl!);
        }

        // Helper to convert Headers (including Headers instance) to a plain object
        const headersObj: Record<string, string> = {};
        if (options.headers) {
          if (options.headers instanceof Headers) {
            options.headers.forEach((value, key) => {
              headersObj[key] = value;
            });
          } else if (Array.isArray(options.headers)) {
            options.headers.forEach(([key, value]) => {
              headersObj[key] = value;
            });
          } else {
            Object.entries(options.headers).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                headersObj[key] = String(value);
              }
            });
          }
        }

        // Safe body parsing to handle non-string or unparseable bodies
        let parsedBody: any = undefined;
        if (options.body) {
          try {
            if (typeof options.body === 'string') {
              parsedBody = JSON.parse(options.body);
            } else {
              parsedBody = options.body;
            }
          } catch (e) {
            console.warn('[AI Client] Failed to parse options.body as JSON, using as-is:', e);
            parsedBody = options.body;
          }
        }

        // Use local backend proxy to bypass CORS
        return fetch('/api/ai/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ark-client': 'ark-v2-client'
          },
          body: JSON.stringify({
            url: targetUrl,
            method: options.method || 'POST',
            headers: headersObj,
            body: parsedBody
          })
        });
      }
    };

    // Task: Force fetch to use the proxy URL by overriding the global fetch if necessary
    // but for now we rely on the SDK's apiEndpoint property which is most reliable
  } else {
    // console.log("%c[AI Client] 🔑 Đang sử dụng API KEY TRỰC TIẾP", "color: #10b981; font-weight: bold;");
    if (Object.keys(requestOptions).length > 0) {
      genAIConfig.requestOptions = requestOptions;
    }
  }

  const googleAi = new GoogleGenAI(genAIConfig);

  // Mẹo: Bọc lại method generateContent để xóa các thông số không tương thích với Gemini Native
  // nếu dùng preset có chứa repetitionPenalty, minP, topA... sẽ làm API báo lỗi INVALID_ARGUMENT
  const cleanGoogleParams = (params: any) => {
    const newParams = { ...params };
    const lowerModel = (params.model || '').toLowerCase();
    const isGeminiModel = lowerModel.includes('gemini') || lowerModel.includes('learnlm');
    
    // 0. Handle model trailing prefill logic for Gemini SDK to prevent Validation Error
    if (newParams.contents && Array.isArray(newParams.contents)) {
       const contents = [...newParams.contents];
       // If it is NOT Gemini (such as Vertex Claude), always strip model/assistant messages from the end to avoid crashing.
       if (!isGeminiModel) {
          while (contents.length > 0 && (contents[contents.length - 1].role === 'model' || contents[contents.length - 1].role === 'assistant')) {
              const lastModelContent = contents.pop();
              const prefillText = lastModelContent?.parts?.[0]?.text || lastModelContent?.text || lastModelContent?.content || "";
              const trimmedPrefill = typeof prefillText === 'string' ? prefillText.trim() : "";
              
              if (trimmedPrefill) {
                  const lastUserIdx = [...contents].reverse().findIndex(m => m.role === 'user');
                  if (lastUserIdx !== -1) {
                     const idx = contents.length - 1 - lastUserIdx;
                     const lastUserContent = { ...contents[idx] };
                     const lastUserParts = [...(lastUserContent.parts || [])];
                     
                     if (lastUserParts.length > 0) {
                        const currentText = lastUserParts[0].text || lastUserParts[0] || "";
                        lastUserParts[0] = { text: currentText + `\n\n[IMPORTANT: START your response exactly with: ${trimmedPrefill}]` };
                     } else {
                        lastUserParts.push({ text: `\n\n[IMPORTANT: START your response exactly with: ${trimmedPrefill}]` });
                     }
                     lastUserContent.parts = lastUserParts;
                     contents[idx] = lastUserContent;
                  } else {
                     contents.push({
                        role: 'user',
                        parts: [{ text: `[IMPORTANT: Please continue, starting exactly with: ${trimmedPrefill}]` }]
                     });
                  }
              }
          }
       } else {
          // Native Gemini models: standard single model message prefill logic
          if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
              const lastModelContent = contents.pop();
              
              if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
                  const prefillText = lastModelContent?.parts?.[0]?.text;
                  if (prefillText) {
                    const lastUserContent = { ...contents[contents.length - 1] };
                    const lastUserParts = [...lastUserContent.parts];
                    const currentText = lastUserParts[0].text;
                    lastUserParts[0] = { text: currentText + `\n\n[IMPORTANT: START your response exactly with: ${prefillText}]` };
                    lastUserContent.parts = lastUserParts;
                    contents[contents.length - 1] = lastUserContent;
                  }
              } else {
                  contents.push(lastModelContent);
              }
          }
       }
       newParams.contents = contents;
    }

    if (!newParams?.config) return newParams;
    const newConfig = { ...newParams.config };
    
    // 1. Xóa các trường của OpenAI/OpenRouter không được Gemini API Native hỗ trợ
    delete newConfig.repetitionPenalty;
    delete newConfig.minP;
    delete newConfig.topA;
    delete newConfig.frequencyPenalty;
    delete newConfig.presencePenalty;
    
    // Tránh gửi undefined keys (Gemini API serialize JSON đôi khi nhạy cảm)
    Object.keys(newConfig).forEach(key => {
        if (newConfig[key] === undefined) {
            delete newConfig[key];
        }
    });

    // 2. Xử lý model Gemini Thinking
    const isThinkingModel = lowerModel.includes('thinking') || lowerModel.includes('gemini-2.0-pro') || lowerModel.includes('gemini-3.1-pro');
    
    if (isThinkingModel) {
        // Models như gemini-2.0-flash-thinking-exp-01-21 CẤM cấu hình temperature, topP, topK, etc...
        delete newConfig.temperature;
        delete newConfig.topP;
        delete newConfig.topK;
        delete newConfig.presencePenalty;
        delete newConfig.frequencyPenalty;
        
        // thinkingBudgetTokens phải >= 1024
        if (newConfig.thinkingConfig?.thinkingBudgetTokens && newConfig.thinkingConfig.thinkingBudgetTokens < 1024) {
             delete newConfig.thinkingConfig; // Hủy cấu hình nếu budget < 1024 để tránh lỗi API
        }
    } else {
        // Nếu không phải thinking model của Google thì xóa trường thinkingConfig
        delete newConfig.thinkingConfig;
    }

    return { ...params, config: newConfig };
  };

  const wrapMethod = (originalMethod: Function) => {
     return async function(params: any) {
         return originalMethod.call(googleAi.models, cleanGoogleParams(params));
     };
  };

  const wrapStreamMethod = (originalMethod: Function) => {
     return async function*(params: any, options?: any) {
         yield* await originalMethod.call(googleAi.models, cleanGoogleParams(params), options);
     };
  };

  return {
    ...googleAi,
    models: {
        ...googleAi.models,
        generateContent: wrapMethod(googleAi.models.generateContent),
        generateContentStream: wrapStreamMethod(googleAi.models.generateContentStream)
    }
  } as GoogleGenAI;
};

// Default instance for backward compatibility (uses env key)
const defaultKey = typeof process !== "undefined" ? (process.env.GEMINI_API_KEY || "no-key") : "no-key";
export const ai = new GoogleGenAI({ apiKey: defaultKey });
