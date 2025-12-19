// services/apiService.ts
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

let currentConfig: ApiConfig | null = null;

export const setCurrentConfig = (config: ApiConfig) => {
  currentConfig = config;
};

export const getCurrentConfig = (): ApiConfig | null => {
  return currentConfig;
};

// 自动拉取模型列表（支持反代）
export const fetchModels = async (
  type: 'gemini' | 'openai',
  baseUrl: string | undefined,
  apiKey: string
): Promise<string[]> => {
  if (type === 'gemini') {
    return [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash-exp',
      'gemini-2.0-flash-exp'
    ];
  }

  if (!baseUrl) return [];

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data.data?.map((m: any) => m.id).sort() || [];
  } catch (e) {
    console.error('Fetch models failed:', e);
    return [];
  }
};

// 统一生成回复函数（支持 Gemini 官方 + 各种反代）
export const generateResponse = async (
  messages: { role: string; content: string }[],
  config: ApiConfig
): Promise<string> => {
  const {
    type,
    baseUrl,
    apiKey,
    model,
    temperature = 1.0,
    maxTokens = 2048,
    topP = 1
  } = config;

  // ==================== Gemini 官方模式 ====================
  if (type === 'gemini') {
    try {
      const genai = new GoogleGenerativeAI(apiKey);
      const geminiModel = genai.getGenerativeModel({
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP
        }
      });

      const formatted = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const result = await geminiModel.generateContent({ contents: formatted });
      return result.response.text() || '(无回复)';
    } catch (e: any) {
      return `(Gemini Error: ${e.message || '未知错误'})`;
    }
  }

  // ==================== OpenAI 兼容模式（反代） ====================
  if (!baseUrl) {
    throw new Error('OpenAI 模式必须填写 Base URL');
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText || '未知错误'}`);
    }

    const data = await res.json();

    // 智能解析多种返回格式（兼容大部分 Gemini 反代）
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.response) return data.response;

    // 兜底返回原始数据（调试用）
    return `(未知格式回复: ${JSON.stringify(data)})`;
  } catch (e: any) {
    return `(反代错误: ${e.message || '未知错误'})`;
  }
};