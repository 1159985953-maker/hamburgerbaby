import { Contact } from '../types';

export interface MinimaxVoice {
  voice_id: string;
  name: string;
  tags: string[];
  language?: string;
  gender?: string;
}

export interface MinimaxConfig {
  groupId: string;
  apiKey: string;
  model: string;
  voiceId: string;
  text: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  serviceArea?: 'domestic' | 'international'; 
}

interface TtsCacheItem {
  url: string;
  type: string;
  timestamp: number;
}

class TtsService {
  private static builtInVoices: MinimaxVoice[] = [
    { voice_id: "female-shaonv-jingpin", name: "少女精品 (默认)", tags: ["甜美"], language: "zh-CN", gender: "female" },
    { voice_id: "male-qn-qingse", name: "青涩青年", tags: ["少年"], language: "zh-CN", gender: "male" },
    { voice_id: "presenter_female", name: "女播音员", tags: ["播音"], language: "zh-CN", gender: "female" },
    { voice_id: "presenter_male", name: "男播音员", tags: ["播音"], language: "zh-CN", gender: "male" }
  ];

  private static ttsCache = new Map<string, TtsCacheItem>();

  private static getCacheKey(voiceId: string, text: string, model?: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i) | 0;
    return `tts_${voiceId}_${model}_${hash}`;
  }

  private static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  static async generateMinimaxAudio(config: MinimaxConfig): Promise<Blob | null> {
    const { groupId, apiKey, model = "speech-01", voiceId, text, serviceArea = 'domestic' } = config;

    if (!groupId || !apiKey) throw new Error("请填写 API Key 和 Group ID");

    const cacheKey = this.getCacheKey(voiceId, text, model);
    const cachedItem = this.ttsCache.get(cacheKey);
    if (cachedItem) {
      const response = await fetch(cachedItem.url);
      return await response.blob();
    }

    // 1. 确定域名
    const baseUrl = serviceArea === 'international' 
      ? "https://api.minimax.io" 
      : "https://api.minimax.chat";

    // 2. 确定接口版本 (修正版：只有 speech-01 走旧接口，其他全走新接口)
    const isLegacyV1 = model === "speech-01"; 
    const endpoint = isLegacyV1 
      ? `${baseUrl}/v1/text_to_speech` 
      : `${baseUrl}/v1/t2a_v2`;

    const url = `${endpoint}?GroupId=${groupId}`;

    // 3. 构造参数
    const body: any = {
      model: model,
      text: text,
      voice_setting: {
        voice_id: voiceId,
        speed: config.speed || 1.0,
        vol: config.vol || 1.0,
        pitch: config.pitch || 0,
      }
    };

    if (!isLegacyV1) {
      // V2 接口参数
      body.stream = false;
      body.output_format = "hex"; 
      body.audio_setting = {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      };
    } else {
      // V1 接口参数
      body.voice_id = voiceId;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const json = await response.json();
        
        // 成功情况
        if (json.data?.audio) {
          const audioBytes = this.hexToBytes(json.data.audio);
          const audioBlob = new Blob([audioBytes], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          this.ttsCache.set(cacheKey, { url: audioUrl, type: "audio/mp3", timestamp: Date.now() });
          return audioBlob;
        }
        
        if (json.data?.url || json.voice_url || json.url) {
           const dlUrl = json.data?.url || json.voice_url || json.url;
           const fileResp = await fetch(dlUrl);
           const audioBlob = await fileResp.blob();
           const audioUrl = URL.createObjectURL(audioBlob);
           this.ttsCache.set(cacheKey, { url: audioUrl, type: "audio/mp3", timestamp: Date.now() });
           return audioBlob;
        }

        // 失败情况
        const errMsg = json.base_resp?.status_msg || JSON.stringify(json);
        throw new Error(`API报错: ${errMsg}`);
      }

      if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      this.ttsCache.set(cacheKey, { url: audioUrl, type: "audio/mp3", timestamp: Date.now() });
      return audioBlob;

    } catch (error: any) {
      throw error;
    }
  }

  static async fetchMinimaxVoices(groupId: string, apiKey: string): Promise<MinimaxVoice[]> {
    return this.builtInVoices;
  }
  
  static getBuiltInMinimaxVoices() { return this.builtInVoices; }
}

export const generateMinimaxAudio = TtsService.generateMinimaxAudio.bind(TtsService);
export const fetchMinimaxVoices = TtsService.fetchMinimaxVoices.bind(TtsService);
export const getBuiltInMinimaxVoices = TtsService.getBuiltInMinimaxVoices.bind(TtsService);
export default TtsService;