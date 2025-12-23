// services/apiService.ts
// @ts-ignore
import { GoogleGenerativeAI } from '@google/generative-ai';

// 引入或定义 Message 类型，确保这里能读到 type 属性
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

// 自动拉取模型列表（支持反代） - 保持原样
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

// 统一生成回复函数
export const generateResponse = async (
  // ★★★ 修改点1：把类型改为 any[]，因为我们需要读取 msg.type (text/image)，
  // 而不仅仅是 role 和 content。这样兼容性最强，不会报错。
  messages: any[], 
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

      // ★★★ 修改点2：Gemini 的图片处理逻辑 ★★★
      const formatted = messages.map(m => {
        const role = m.role === 'user' ? 'user' : 'model';

        // 如果是图片消息
        if (m.type === 'image') {
          // m.content 是 "data:image/jpeg;base64,......"
          // Gemini SDK 需要去掉头部，只留 base64 数据
          try {
            const base64Data = m.content.split(',')[1]; 
            const mimeType = m.content.split(';')[0].split(':')[1] || 'image/jpeg';
            return {
              role,
              parts: [
                { text: "（用户发送了一张图片）" }, // 可选：给个文字提示
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            };
          } catch (e) {
            console.error("图片解析失败", e);
            return { role, parts: [{ text: "[图片上传失败]" }] };
          }
        }

        // 普通文字消息
        return {
          role,
          parts: [{ text: m.content }]
        };
      });

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

  // ★★★ 修改点3：OpenAI 的图片处理逻辑 (Vision 格式) ★★★
  const apiMessages = messages.map(m => {
    // 1. 如果是图片，构造多模态 content 数组
    if (m.type === 'image') {
      return {
        role: m.role,
        content: [
          { type: "text", text: "（用户发送了一张图片）" },
          {
            type: "image_url",
            image_url: {
              url: m.content // OpenAI 兼容接口通常直接吃 Data URL
            }
          }
        ]
      };
    }
    
    // 2. 普通文字，保持原样
    return {
      role: m.role,
      content: m.content
    };
  });

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: apiMessages, // 使用处理过包含图片的 messages
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

    // 智能解析多种返回格式（保持你原来的逻辑完全不变）
   // ★★★ 增强版解析逻辑 ★★★
    if (data.choices && data.choices.length > 0) {
      const msg = data.choices[0].message;
      const content = msg.content;
      const reasoning = msg.reasoning_content; // 兼容深度思考模型

      // 1. 如果有内容，直接返回
      if (content && content.length > 0) return content;
      
      // 2. 如果只有思考过程（针对某些深度思考模型）
      if (reasoning && reasoning.length > 0) return `(思考中...)\n${reasoning}`;

      // 3. 如果内容是空字符串，且 token 为 0 (这就是你遇到的情况)
      return "(AI 返回了空内容，请重roll)";
    }

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.response) return data.response;

    // 兜底返回原始数据
    return `(未知格式回复: ${JSON.stringify(data)})`;
  } catch (e: any) {
    return `(网络错误: ${e.message || '未知错误'})`;
  }
};
