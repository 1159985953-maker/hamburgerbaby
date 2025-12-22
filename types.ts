// ==================== 从这里开始完整复制 ====================
// 这是一个“合并修复版”的类型定义文件。
// 它解决了所有重复声明的问题，并包含了所有你需要的功能（拍立得、小组件等）。

// 基础类型
export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
}



export interface TaskCategory {
  id: string;
  name: string; // 例如 "工作", "生活"
  color: string; // 例如 "#FF5733", "rgb(0,0,0)"
}



// ★★★ 新增：记账分类 ★★★
export interface FinanceCategory {
  id: string;
  name: string; // "餐饮", "工资"
  type: 'expense' | 'income'; // 支出还是收入
  icon: string; // "🍔", "💰"
  color: string;
}



// ★★★ 新增：交易记录 ★★★
export interface Transaction {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  categoryId: string;
  date: string; // "YYYY-MM-DD"
  note?: string;
  createdAt: number;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  date: string;       // 格式 "2023-10-01"，标记任务归属哪一天
  time?: string;      // "14:00"
  location?: string;  // "星巴克"
  note?: string;      // "记得带电脑"
  categoryId?: string; // ★ 新增：关联到某个分类ID
}


export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'voice' | 'location' | 'song';
  translation?: string;
  voiceDuration?: number;
  song?: Song;
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

export interface FavoriteEntry {
  id: string;
  msg?: Message;
  messages?: Message[];
  isPackage: boolean;
  contactName: string;
  avatar: string;
  category: string;
  timestamp: number;
}

// 世界书类型
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

// API 和 主题预设
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

export interface ThemePreset {
  id: string;
  name: string;
  css: string;
}

// HEF 情感框架
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
    authority: { default_style: string; under_stress_switch: string; triggers: string[]; };
    peers: { default_style: string; jealousy_points: string[]; trust_rules: string; };
    intimates: { care_style: string; conflict_pattern: string; boundaries: string[]; };
    strangers: { default_style: string; risk_policy: string; };
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
    personality_big5: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number; };
    habits_quirks: string[];
     core_strength: number; // ★ 新增：内核强度 (1-10)，决定了负面情绪对他的影响有多大
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

// 核心类型：角色 (合并所有功能)
export interface Contact {
  id: string;
  created: number;
  name: string;
  avatar: string;
  persona: string;
  memo: string;
  userName: string;
  userAvatar: string;
  userPersona: string;
  history: Message[];
  mood: CharacterMood;
  schedule: ScheduleItem[];
  timezone: string;
  contextDepth: number;
  summaryTrigger: number;
  coupleSpaceUnlocked: boolean;
  enabledWorldBooks: string[];
  voiceId?: string;
  playlist?: Song[];
  customCSS?: string;
  chatBackground?: string;
  unread?: number;
  
  // 主动消息
  proactiveConfig?: {
    enabled: boolean;
    minGapMinutes: number;
    maxDaily: number;
  };
  proactiveLastSent?: { [date: string]: number; };
  pendingProactive?: boolean;

  // 关系系统
  affectionScore: number;
  relationshipStatus: 'Acquaintance' | 'Friend' | 'Close Friend' | 'Intimate' | 'Conflict' | 'Breaking' | 'Broken';
  
// ★★★ AI 生理状态 ★★★
  aiDND: { // Do Not Disturb 勿扰模式
    enabled: boolean;
    until: number; // 时间戳，直到几点前都不回消息
    reason?: string; // "睡觉", "上课", "生气"
  };
  
  // 长期记忆 (新版)
  longTermMemories: {
    id: string;
    content: string;
    importance: number;
    timestamp: number;
    meta?: any; // 用于存储来源等信息
  }[];

  
  
  // 其他游戏化/高级功能
  interventionPoints: number;
  currentChatMode: 'Casual' | 'Probing' | 'Intimate' | 'Cooling';
  hef: Partial<HEF>; // 使用 Partial 让 HEF 成为可选
  
  // Couple Space 预留字段 (避免报错)
  diaries?: any[];
  questions?: any[];
  letters?: any[];
  summary?: string;
}

// 桌面小组件类型

export interface Widget {
  id: string; // 'chat', 'book', 'couple', 'diary', 'settings', 'theme'
  icon: string; // emoji or a placeholder
  customIcon?: string; // 用户上传的图片 URL
  text: string;
  url: string;
  bgColor?: string;
  background?: string; // 新增：背景，可以是颜色或图片 URL
}

export interface PhotoFrame {
  id: string;
  photo: string;
}

// 核心类型：全局设置 (合并所有功能)
export interface GlobalSettings {
  wallpaper: string;
  customWallpapers: string[];
  apiPresets: ApiPreset[];
  activePresetId: string;
  systemTimezone: string;

// ★★★ 新增：记账数据 ★★★
  transactions: Transaction[];
  financeCategories: FinanceCategory[];

  userTimezone: string;
  appearance: {
    bubbleColorUser: string;
    bubbleColorAI: string;
    fontSize: string;
    showStatusBar: boolean;
  };
  themePresets: ThemePreset[];
  widgets: Widget[];
  photoFrames: PhotoFrame[];
  avatar: string;
  todos: TodoItem[]; 
  categories: TaskCategory[];
  minimax?: {
    groupId: string;
    apiKey: string;
    model: string;
    serviceArea?: 'domestic' | 'international';
  };
  userPresets?: any[]; // 用户人设预设
}

// 备份类型
export interface AppDataBackup {
  version: number;
  date: string;
  contacts: Contact[];
  globalSettings: GlobalSettings;
  worldBooks: WorldBookCategory[];
}

// Couple Space 相关 (保持兼容)
export interface DiaryEntry {
  id: string;
  author: 'user' | 'ai';
  date: string; // 或 number
  content: string;
  mood?: string;
  weather?: string;
  moodEmoji?: string;
  images?: string[];
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
  title: string;
  content: string;
  timestamp: number;
  isOpened: boolean;
  from: string;
}

export type CharacterProfile = Contact;
// ==================== 复制到这里结束 ====================