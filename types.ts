export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string; // mp3链接
  cover: string; // 封面
}
// --- 缝合：升级版收藏条目接口 ---






export interface FavoriteEntry {
  id: string;
  // 单条模式用 msg，打包模式用 messages
  msg?: Message; 
  messages?: Message[]; // ★★★ 新增：打包的消息列表
  isPackage: boolean;   // ★★★ 新增：是否是打包记录
  contactName: string;
  avatar: string;
  category: string;
  timestamp: number;
}




export interface ThemePreset {
  id: string;
  name: string;
  css: string;
}




export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // ★★★ 修复：加上 'song' 类型，防止 ChatApp 报错 ★★★
  type?: 'text' | 'image' | 'voice' | 'location' | 'song';
  translation?: string;
  voiceDuration?: number; 
  song?: Song; // 当 type === 'song' 时，携带歌曲数据
}

export interface CharacterMood {
  current: string;
  description?: string;
  energyLevel: number;
  lastUpdate: number;
}

export interface ScheduleItem {
  time: string;
  activity: string;
}

export interface Contact {
  id: string;
  created: number;
  
  // Character Identity
  name: string;
  avatar: string; 
  persona: string;
  memo: string; 
  
  // User Identity 
  userName: string;
  userAvatar: string;
  
  userPersona: string;
  
  // Chat Data
  history: Message[];
  summary: string; // Long-term memory
  
  // State
  mood: CharacterMood;
  schedule: ScheduleItem[];
  
  // Settings
  wallpaper?: string; 
  timezone: string;
  
  // Advanced Memory Settings
  contextDepth: number;
  summaryTrigger: number;
  unread?: number; // 👈 加上这一行！
  
  coupleSpaceUnlocked: boolean;
  
  // World Book Integration
  enabledWorldBooks: string[];

  // ★★★ 修复：把新增的语音字段合并到这里 ★★★
  voiceId?: string; // e.g. "female-shaonv-jingpin"
  playlist?: Song[]; 

  // --- 缝合：单角色独立外观设置 ---
  appearance?: {
    bubbleColorUser: string;   // 这个角色窗口里的：用户气泡色
    bubbleColorAI: string;     // 这个角色窗口里的：AI气泡色
    fontSize: string;          // 这个角色窗口里的：字体大小
    chatBackground?: string;   // (预留) 独立聊天背景
  };
  // ... 其他字段 ...
  



// ===== 系统 #13 & #6: 主动消息与 AI 状态 =====
// ===== 系统 #13 & #6: 主动消息与 AI 状态 =====
  
  // AI 的勿扰/下线状态
  aiDND?: {
    enabled: boolean;
    until: number; // 时间戳
  };

  // 用户定义的主动消息配置 (无模板版)
  proactiveConfig?: {
    enabled: boolean;
minGapMinutes: number; // <--- 把原来的 minGapHours: number; 替换成这一行
    maxDaily: number;
  };

  // 系统记录的主动消息发送历史
  proactiveLastSent?: {
    [date: string]: number;
  };
  
pendingProactive?: boolean; // ★★★ 新增：标记是否正在等待发送主动消息




  // ===== 新增：关系与好感系统 =====
  affectionScore: number;              // 0-100
  relationshipStatus: 'Acquaintance' | 'Friend' | 'Close Friend' | 'Intimate' | 'Conflict' | 'Breaking' | 'Broken';

  // ===== 新增：勿扰/下线状态（用于主动消息与被动回复概率）=====
  aiDND: {
    enabled: boolean;
    until: number;                     // timestamp，0 表示永久
    reason?: string;                   // 可选，AI 自己说的下线理由
  };

  // ===== 新增：干预点数（游戏化）=====
  interventionPoints: number;          // 默认 0，用户通过日记、学习等获得

  // ===== 新增：长期记忆列表（替代原来的 summary 字符串）=====
  longTermMemories: {
    id: string;
    content: string;
    importance: number;                // 1-10，用户可调
    timestamp: number;
  }[];

  // ===== 新增：对话模式状态（互动深浅系统）=====
  currentChatMode: 'Casual' | 'Probing' | 'Intimate' | 'Cooling';
  
  

}

export interface ApiPreset {
  id: string;
  name: string;
  type: 'gemini' | 'openai';
  baseUrl?: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface WorldBookEntry {
  id: string;
  keys: string[];
  content: string;
  name?: string;
}

export interface WorldBookCategory {
  id: string;
  name: string;
  entries: WorldBookEntry[];
}

export interface GlobalSettings {
  // OS Appearance
  wallpaper: string;

  // ... 原有字段 ...
  
  // ★★★ 新增：外观预设库 ★★★
  themePresets: ThemePreset[]; 

  // API Config
  apiPresets: ApiPreset[];
  activePresetId: string;
  
  // Misc
  systemTimezone: string;
  userTimezone?: string;  // 新增：用户手动选择的时区（优先于系统时区）

  // --- 缝合开始：外观美化设置 ---
  appearance: {
    bubbleColorUser: string;   // 用户气泡颜色
    bubbleColorAI: string;     // AI 气泡颜色
    fontSize: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg'; // 字体大小
    showStatusBar: boolean;    // 是否显示状态栏
  };
  // --- 缝合结束 ---

  // 修改 minimax 部分如下：
  minimax?: {
    groupId: string;
    apiKey: string;
    model: string;
    // 新增这个字段，用来存 "domestic"(国内) 还是 "international"(国际)
    serviceArea?: 'domestic' | 'international'; 
  };
}

export interface AppDataBackup {
  version: number;
  date: string;
  contacts: Contact[];
  globalSettings: GlobalSettings;
  worldBooks: WorldBookCategory[];
}

// Components Compatibility
export type CharacterProfile = Contact;

export interface UserProfile {
  name: string;
  avatar: string;
  persona: string;
}

// Types for Couple Space
export interface DiaryEntry {
  id: string;
  author: 'user' | 'ai';
  date: string;
  content: string;
  mood?: string;
}

export interface QAEntry {
  id: string;
  question: string;
  aiAnswer: string;
  userAnswer?: string;
  date: string;
}

export interface LoveLetter {
  id: string;
  content: string;
  date: string;
  opened: boolean;
}

// 在 types.ts 中确保包含或更新以下内容
export interface DiaryEntry {
  id: string;
  date: number; // 建议改成 number 时间戳方便排序
  content: string;
  weather?: string;
  moodEmoji?: string;
  images?: string[]; // 支持日记配图
}

export interface LoveLetter {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  isOpened: boolean; // 是否已拆信
  from: string; // 谁写的
}

export interface HEF {
  META: {
    source_world: string;
    role_identity: string;
    continuity_principle: string;
    REALISM_RULE: boolean;
  };

  CORE_DRIVES: {
    primary_motive: string;
    secondary_motives: string[];
    value_priority: string;
    survival_threshold: string;
    non_negotiables: string[];
  };

  RELATIONAL_MASKS: {
    authority: {
      default_style: string;
      under_stress_switch: string;
      triggers: string[];
    };
    peers: {
      default_style: string;
      jealousy_points: string[];
      trust_rules: string;
    };
    intimates: {
      care_style: string;
      conflict_pattern: string;
      boundaries: string[];
    };
    strangers: {
      default_style: string;
      risk_policy: string;
    };
  };

  EMOTIONAL_DYNAMICS: {
    baseline_mood: string;
    top_triggers_positive: string[];
    top_triggers_negative: string[];
    carryover_rules: string;
    escalation_curve: string;
    recovery_protocol: string;
  };

  CONFLICTS_DEFENSES: {
    inner_conflicts: string[];
    defense_mechanisms: string[];
    dissonance_explanations: string[];
    mask_break_conditions: string[];
  };

  CULTURE_SCRIPTS: {
    worldview: string;
    core_values: string[];
    taboos: string[];
    language_register: string;
    pet_phrases: string[];
    role_expectations: string;
  };

  DEVELOPMENT_HISTORY: {
    key_events: string[];
    unresolved_threads: string[];
    current_stage: string;
    growth_arc_goal: string;
    constraints_from_past: string[];
  };

  INDIVIDUAL_VARIATION: {
    personality_big5: {
      openness: number;        // 1-10
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    };
    habits_quirks: string[];
    speech_style: string;
    body_language: string;
    irrationalities: string[];
  };

  RESOURCES_LIMITS: {
    skills: string[];
    assets: string[];
    constraints: string[];
    risk_tolerance: string;
  };

  SCENE_EXECUTOR: {
    step_1_context_parse: string;
    step_2_state_load: string;
    step_3_policy_select: string;
    step_4_output_rules: string;
    step_5_memory_update: string;
  };

  REALISM_SELF_CHECK: {
    checks: string[];
    pass_threshold: number;
  };
}

// 在 Contact 接口里保持：
hef: HEF;




