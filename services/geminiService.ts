// services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Contact, Message, ApiPreset, WorldBookCategory } from "../types";

const getClient = (apiKey: string) => {
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

export const generateCharacterResponse = async (
  contact: Contact,
  preset: ApiPreset | undefined,
  worldBooks: WorldBookCategory[],
  userMessage: string
): Promise<string> => {
  const apiKey = preset?.apiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) return "(No API key)";

  const client = getClient(apiKey);
  if (!client) return "(Invalid key)";

  const modelName = preset?.model || 'gemini-1.5-flash';

  const time = new Date().toLocaleTimeString('en-US', {
    timeZone: contact.timezone,
    hour: '2-digit',
    minute: '2-digit'
  });

  const memoryContext = contact.summary ? `\n# MEMORY\n${contact.summary}\n` : "";
  const loreContext = worldBooks
    .filter(wb => contact.enabledWorldBooks?.includes(wb.name))
    .map(wb => `## ${wb.name}\n${wb.entries.map(e => e.content).join('\n')}`)
    .join('\n\n') || "";

  const systemPrompt = `You are ${contact.name}.
Persona: ${contact.persona}
Time: ${time}
Mood: ${contact.mood.current}
${memoryContext}
${loreContext}
Split messages with ||| . Be natural.`;

  try {
    const model = client.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
    const history = contact.history.slice(-(contact.contextDepth || 20)).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage || "Hey");
    const response = await result.response;
    return response.text() || "...";
  } catch (e) {
    return "(Error)";
  }
};

export const summarizeHistory = async (history: Message[], currentSummary: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return currentSummary;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const recent = history.slice(-30).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
    const prompt = `Update memory:\nCurrent: ${currentSummary}\nRecent:\n${recent}\nOnly output updated memory.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || currentSummary;
  } catch (e) {
    return currentSummary;
  }
};

export const generateDailyDiary = async (profile: CharacterProfile, memory: string) => {
  const prompt = `
  You are ${profile.name}. 
  Your current mood is ${profile.mood.current}.
  
  Here is a summary of your recent memories and conversations with your partner:
  ---
  ${memory}
  ---
  
  Based on your mood and these memories, write a short, personal diary entry for today. 
  Keep it natural and reflect on something from the memories.
  `;
  // ... 您调用 Gemini API 的逻辑 ...
  // const result = await model.generateContent(prompt);
  // ... return a string
};

export const generateDailyQuestion = async (): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return "What made you happy today? 😊";
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(
      "Create one warm romantic question for couples."
    );
    const response = await result.response;
    const text = response.text();

    return text.trim();
  } catch (error) {
    return "What's your favorite memory of us? ✨";
  }
};