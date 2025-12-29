// 文件位置: src/services/apiService.ts
// 请用这段代码，完整覆盖掉你的旧文件！

// 这是我们 API 配置的“图纸”，确保它在文件的最上方
interface ApiConfig {
  type: 'gemini' | 'openai';
  baseUrl?: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// 这是一组什么代码：【最终版 - 绝对诚实的信使 generateResponse】
// 作用：这是整个项目的网络请求核心。它被修复后，任何API层的错误都会被真实、详细地报告出来。
export const generateResponse = async (
  messages: any[], 
  config: ApiConfig
): Promise<string> => {
  
  // 检查传入的配置是否存在，这是第一道保险
  if (!config || !config.apiKey || !config.model) {
    // 如果没有有效的配置，直接返回一个清晰的、我们自己定义的错误
    return "[前端错误] 调用 generateResponse 时，传入的 API 配置 (config) 无效。";
  }

  const {
    type,
    baseUrl,
    apiKey,
    model,
    temperature = 1.0,
    maxTokens = 4096,
    topP = 1
  } = config;

  // 根据类型，准备好要发送的“信件”
  let url = '';
  let body: any = {};
  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (type === 'gemini') {
    // 适用于 Google Gemini 官方接口的配置
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    body = {
      contents: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: temperature,
        topP: topP,
        maxOutputTokens: maxTokens,
      },
    };
  } else { // OpenAI 兼容模式 (适用于所有反向代理)
    url = `${baseUrl?.replace(/\/$/, '')}/chat/completions`;
    body = {
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stream: false 
    };
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // ★★★ 这里是整个流程的心脏 ★★★
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    // 如果信使在路上收到了“服务器的白眼”（比如 401, 404, 500 等错误）
    if (!response.ok) {
      // 我们不等了，直接把服务器的“抱怨信”全文读出来
      const errorBodyText = await response.text(); 
      const detailedError = `API 请求失败!
      - 状态码 (Status): ${response.status}
      - 错误信息 (Message): ${response.statusText}
      - 服务器详细回复 (Server Response): ${errorBodyText}`;
      
      // 把这份详细的“事故报告”作为异常抛出
      throw new Error(detailedError);
    }

    // 如果一切顺利，解析服务器返回的 JSON 数据
    const data = await response.json();

    // 从返回的数据中，把 AI 说的话（核心内容）拿出来
    if (type === 'openai') {
      return data.choices[0]?.message?.content || "[AI回复解析错误] 服务器返回了成功状态，但'choices'数组为空或格式不正确。";
    }
    if (type === 'gemini') {
      return data.candidates[0]?.content?.parts[0]?.text || "[AI回复解析错误] 服务器返回了成功状态，但'candidates'数组为空或格式不正确。";
    }
    
    return "[前端错误] 未知的 API 类型，无法解析回复。";

  } catch (error: any) {
    // 如果在整个 try 过程中（包括 fetch 自己遇到的网络问题），发生了任何意外
    console.error("【generateResponse 捕获到致命错误】:", error);
    
    // 我们不再说谎，而是把最真实的错误原因返回给“大脑”
    return `[API Service 错误报告] ${error.message}`;
  }
};