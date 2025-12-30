// 文件位置: src/services/apiService.ts
// 请用这段代码，完整覆盖掉你的旧文件！

interface ApiConfig {
  type: 'gemini' | 'openai';
  baseUrl?: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// 这是我们为“工具调用”定义的数据结构
export interface AiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: {
      [key: string]: {
        type: string;
        description: string;
      };
    };
    required: string[];
  };
}

// 这是一组什么代码：【V3.0 - 支持工具调用的超级信使】
// 作用：这是整个项目的网络请求核心。它现在学会了如何向AI展示我们的工具（操作手册），
// 并能正确接收和返回AI的“工具调用”指令。
export const generateResponse = async (
  messages: any[],
  config: ApiConfig,
  tools?: AiTool[],
  toolChoice?: 'auto' | 'required' | 'none'  // <--- 新增参数
): Promise<any> => {
  
  if (!config || !config.apiKey || !config.model) {
    // 这里我们不返回字符串，而是抛出错误，让调用它的地方去处理
    throw new Error("[前端错误] 调用 generateResponse 时，传入的 API 配置 (config) 无效。");
  }

  const { type, baseUrl, apiKey, model, temperature = 1.0, maxTokens = 4096, topP = 1 } = config;

  let url = '';
  let body: any = {};
  const headers: any = { 'Content-Type': 'application/json' };

  if (type === 'gemini') {
   url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    body = {
      contents: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }]
      })),
      generationConfig: { temperature, topP, maxOutputTokens: maxTokens },
      // ★★★ Gemini 的工具调用语法 ★★★
      tools: tools ? [{ function_declarations: tools }] : undefined
    };
  } // 这是一组什么代码：【强制工具调用补丁 - apiService.ts】
// 把原来的 else { // OpenAI 兼容模式 } 整段替换成下面这整段
else {
  // OpenAI 兼容模式
  url = `${baseUrl?.replace(/\/$/, '')}/chat/completions`;
  body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    // ★★★ 关键强制调用：如果传了 tools，就强制要求必须调用工具 ★★★
    tools: tools ? tools.map(t => ({ type: 'function', function: t })) : undefined,
    tool_choice: tools ? 'required' : undefined,  // <--- 这行是杀手锏！强制调用
  };
  headers['Authorization'] = `Bearer ${apiKey}`;
}

  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const errorBodyText = await response.text(); 
      const detailedError = `API 请求失败! Status: ${response.status}, Message: ${response.statusText}, Server Response: ${errorBodyText}`;
      throw new Error(detailedError);
    }

    const data = await response.json();

    // ★★★ 核心修改：返回整个AI回复，而不仅仅是文本内容 ★★★
    // 我们现在需要检查回复里是否包含 tool_calls
    if (type === 'openai') {
      return data.choices[0]?.message || { content: "[AI回复解析错误] 'choices' 数组为空。" };
    }
    if (type === 'gemini') {
      // Gemini的回复结构略有不同，这里做了兼容
      const candidate = data.candidates?.[0]?.content;
      if (candidate?.parts[0]?.functionCall) {
        return { tool_calls: [{ function: candidate.parts[0].functionCall }] };
      }
      return candidate ? { content: candidate.parts[0]?.text || "" } : { content: "[AI回复解析错误] 'candidates' 数组为空。" };
    }
    
    throw new Error("[前端错误] 未知的 API 类型，无法解析回复。");

  } catch (error: any) {
    console.error("【generateResponse 捕获到致命错误】:", error);
    // 将错误继续向上抛出，让业务逻辑层去捕获和处理
    throw error;
  }
};