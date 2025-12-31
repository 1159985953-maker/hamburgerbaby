// services/apiService.ts
// 这是一组什么代码：核心 API 通讯服务（终极融合版）
// 包含：Gemini/OpenAI 发送逻辑、模型拉取、DeepSeek 思考过程解析、多格式兼容

// @ts-ignore
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ApiConfig {
  type: 'gemini' | 'openai';
  baseUrl?: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// 1. 保留你原有的全局配置存储（防止其他文件报错）
let currentConfig: ApiConfig | null = null;

export const setCurrentConfig = (config: ApiConfig) => {
  currentConfig = config;
};

export const getCurrentConfig = (): ApiConfig | null => {
  return currentConfig;
};

// 2. 自动拉取模型列表（加入了我的“强力兜底”修复）
export const fetchModels = async (
  type: 'gemini' | 'openai',
  baseUrl: string | undefined,
  apiKey: string
): Promise<string[]> => {
  
  // === 场景 A：Gemini 官方 ===
  if (type === 'gemini') {
    try {
      // 尝试去 Google 官方拉取
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google API 报错: ${res.status}`);
      
      const data = await res.json();
      return data.models?.map((m: any) => m.name.replace('models/', '')) || [];
    } catch (e) {
      console.warn("Gemini 模型拉取失败，使用默认列表:", e);
      // ★★★ 修复：拉取失败时返回默认列表，而不是空数组 ★★★
      return [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash-8b',
        'gemini-2.0-flash-exp'
      ];
    }
  }

  // === 场景 B：OpenAI / 反代 ===
  if (!baseUrl) return [];

  try {
    // 自动补全路径
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const url = cleanBaseUrl.endsWith('/v1') ? `${cleanBaseUrl}/models` : `${cleanBaseUrl}/v1/models`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
       const errText = await res.text();
       throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.data?.map((m: any) => m.id).sort() || [];
  } catch (e) {
    console.error('模型拉取失败:', e);
    // ★★★ 修复：失败时返回常用模型，防止下拉框为空 ★★★
    return ['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'deepseek-chat'];
  }
};

// 3. 生成回复（结合了 Gemini SDK 和 你的万能解析逻辑）
export const generateResponse = async (
  messages: any[], 
  config: ApiConfig
): Promise<string> => {
  const {
    type,
    baseUrl,
    apiKey,
    model,
    temperature = 1.0,
    maxTokens = 8192, // 调大默认 token
    topP = 0.95
  } = config;

  // ==================== Gemini 官方模式 ====================
  if (type === 'gemini') {
    try {
      const genai = new GoogleGenerativeAI(apiKey);
      const geminiModel = genai.getGenerativeModel({
        model: model || 'gemini-1.5-flash',
        generationConfig: { temperature, maxOutputTokens: maxTokens, topP }
      });

      // 转换消息格式
      const history = messages.map(m => {
        const role = m.role === 'user' ? 'user' : 'model';
        
        // 处理图片
        if (m.type === 'image') {
          try {
            const base64Data = m.content.split(',')[1]; 
            const mimeType = m.content.split(';')[0].split(':')[1] || 'image/jpeg';
            return {
              role,
              parts: [{ inlineData: { mimeType, data: base64Data } }]
            };
          } catch (e) {
            return { role, parts: [{ text: "[图片解析错误]" }] };
          }
        }
        
        // 处理文本
        return {
          role,
          parts: [{ text: m.content }]
        };
      });

      const result = await geminiModel.generateContent({ contents: history });
      return result.response.text();

    } catch (e: any) {
      console.error("Gemini Error:", e);
      return `(Gemini 官方报错: ${e.message || '网络或Key错误'})`;
    }
  }

  // ==================== OpenAI / 反代模式 ====================
  if (!baseUrl) {
    throw new Error('OpenAI 模式必须填写 Base URL');
  }

  // 转换消息格式
  const apiMessages = messages.map(m => {
    // 处理图片 (Vision 格式)
    if (m.type === 'image') {
      return {
        role: m.role,
        content: [
          { type: "text", text: "Please look at this image." },
          { type: "image_url", image_url: { url: m.content } }
        ]
      };
    }
    // 处理文本
    return { role: m.role, content: m.content };
  });

  try {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const url = cleanBaseUrl.endsWith('/v1') 
      ? `${cleanBaseUrl}/chat/completions` 
      : `${cleanBaseUrl}/v1/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: false 
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // ==================== ★★★ 恢复你的万能解析逻辑 (兼容 DeepSeek) ★★★ ====================
    // 1. 标准 OpenAI 格式 & DeepSeek 思考过程
    if (data.choices && data.choices.length > 0) {
      const msg = data.choices[0].message;
      const content = msg.content;
      const reasoning = msg.reasoning_content; // 兼容深度思考模型

      // 优先返回正式内容
      if (content && content.length > 0) return content;
      
      // 如果正式内容为空，但有思考过程，也算成功（防止报错）
      if (reasoning && reasoning.length > 0) return JSON.stringify([{ type: "text", content: "(AI正在深度思考中...)" }]);

      return ""; 
    }

    // 2. Gemini / Google 接口的返回格式 (兼容部分反代)
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    // 3. 其他非标准格式的兜底 (OneAPI / NewAPI 等)
    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.response) return data.response;

    // 实在没办法了，返回原始数据让 ChatApp 自己去猜，不要直接报错
    return JSON.stringify(data);

  } catch (e: any) {
    console.error("OpenAI/Proxy Error:", e);
    return `(API 请求失败: ${e.message})`;
  }
};