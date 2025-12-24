// --- 这是一个“合并修复版”的类型定义文件 ---
export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
}

export interface UserTag {
  id: string;
  content: string;
  timestamp: number;
  style?: number;
  note?: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
}

export interface AssetAccount {
  id: string;
  name: string;
  type: 'cash' | 'debit' | 'credit' | 'alipay' | 'wechat' | 'other';
  balance: number;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  categoryId: string;
  accountId: string;
  date: string;
  note?: string;
  createdAt: number;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  categoryId?: string;
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
  energy?: {
    current: number;
    max: number;
    status: 'Awake' | 'Sleeping' | 'Tired' | 'Exhausted';
    lastUpdate: number;
  };
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
    core_strength: number; 
    habits_quirks: string[];
    speech_style: string;
    body_language: string;
    irrationalities: string[];
  };
  // ★★★ 核心新增：人格内核强度 (对应 #11) ★★★
    core_strength?: number; 
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
  joy?: number;
  anger?: number;
  sadness?: number;
  fear?: number;
  trust?: number;
  current_emotions?: { joy: number; anger: number; sadness: number; fear: number; trust: number; };
  triggers?: string;
  decay?: string;
}

export interface DiaryEntry {
  id: string;
  author: 'user' | 'ai';
  date: string;
  content: string;
  mood?: string;
  weather?: string;
  moodEmoji?: string;
  images?: string[];
  comments?: { id: string; author: 'user' | 'ai'; content: string; timestamp: number; }[];
}

export interface QAEntry {
  id: string;
  question: string;
  aiAnswer: string;
  userAnswer?: string;
  date: string;
  timestamp: number;
}

export interface LoveLetter {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  isOpened: boolean;
  from: 'user' | 'ai';
  unlockDate?: number;
}

export interface RelationshipAchievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  unlocked?: boolean;
  unlockedDate?: number;
  isSecret?: boolean;
}

export interface Anniversary {
  id: string;
  name: string;
  date: string;
  type: 'custom' | 'system';
}




// ==================== 这是一个新代码块：约定/承诺系统 ====================
// 这是“闹钟”的定义
export interface AgreementTrigger {
  type: 'time' | 'keyword' | 'event'; // 触发类型：时间、关键词、事件
  value: number | string; // 如果是时间，这里是时间戳；如果是关键词，这里是那个词
  original_text: string; // AI识别到的原文，比如“明天早上”
}










// ==================== [新功能] 用户印象画像系统 - 核心数据结构 ====================
export type ImpressionCategory = 'personality' | 'preference' | 'habit' | 'appearance' | 'memory';

// 定义“一条印象”的数据结构
export interface Impression {
  id: string; // 唯一ID
  category: ImpressionCategory; // 分类：性格、偏好、习惯、外貌、记忆
  content: string; // 印象内容，例如：“喜欢在深夜喝可乐”
  quotes: string[]; // 支撑这条印象的原文引述，例如：“我超爱喝可乐的！”
  last_updated: number; // 上次更新这条印象的时间
  confidence: number; // AI对这条印象的信心度 (1-10)
}
// ==================== 新代码块结束 ====================












// ==================== 这是一个新代码块：三层欲望模型 - 核心数据结构 ====================

// 第二层：情感需求 (中期欲望)
export interface EmotionalNeed {
  // 需求类型：渴望连接、渴望安抚、渴望新奇、稳定/满足
  type: 'connection' | 'reassurance' | 'novelty' | 'stability';
  // 对AI的指令描述，解释当前需求的具体表现
  description: string;
  // 需求强度 (1-10)，强度越高，越能影响AI的行为
  intensity: number;
  // 触发这个需求的原因，用于调试和AI的自我认知
  trigger_reason: string;
  // 上次更新此需求的时间戳
  updated_at: number;
}

// ==================== 新代码块结束 ====================





// 这是“小账本”里每一条约定的定义
export interface Agreement {
  id: string; // 唯一ID
  content: string; // 约定内容：“叫我起床”
  status: 'pending' | 'fulfilled' | 'failed'; // 状态：待处理、已完成、已失败
  importance: number; // AI判断的重要性 (1-10)
  trigger: AgreementTrigger; // 触发器
  created_at: number; // 创建时间
}
// ==================== 新代码块结束 ====================







export interface Contact {


  userTags: UserTag[];
  isAffectionLocked?: boolean;
  bubbleColorUser?: string;
  bubbleColorAI?: string;
  bubbleFontSize?: string;
  chatScale?: number;
  listBubbleColor?: string;
  listFontSize?: string;
  listAvatarSize?: number;
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
  
  proactiveConfig?: {
    enabled: boolean;
    minGapMinutes: number;
    maxDaily: number;
  };
  proactiveLastSent?: { [date: string]: number; };
  pendingProactive?: boolean;

 // ★★★ 核心修改：好感度 & 关系状态机 (对应 #9, #10) ★★★
  affectionScore: number;
  relationshipStatus: 'Feud' | 'Conflict' | 'Acquaintance' | 'Friend' | 'Honeymoon' | 'Stable' | 'Breaking' | 'Broken';
  
  // ★★★ 核心修改：AI勿扰模式 (对应 #13) ★★★
  aiDND: {
    enabled: boolean;
    until: number;
    reason?: string;
  };
  
  longTermMemories: {
    id: string;
    content: string;
    importance: number; // 用户可调的优先级
    timestamp: number;
    meta?: any;
  }[];

  // ★★★ 核心新增：干预点数 & 对话模式 (对应 #11, #8) ★★★
  interventionPoints: number;
  currentChatMode: 'Casual' | 'Probing' | 'Intimate' | 'Cooling';
  
  // ★★★ 核心修改：HEF不再是可选的，而是必须的 ★★★
  hef: HEF;
  
  diaries?: DiaryEntry[];
  questions?: QAEntry[];
  letters?: LoveLetter[];
  summary?: string;
  
  voiceSampleText?: string;
  wallpaper?: string; 
  dueAgreementId?: string; // 新增：到期的约定ID，用于强制唤醒
  // ==================== 这是新加的一行：约定列表 ====================
  agreements?: Agreement[];
  // ==================== 这是新加的一行：当前欲望 ====================
emotionalNeed?: EmotionalNeed; // 第二层欲望：情感需求
// ==================== [新功能] AI对用户的印象画像 ====================
  userImpressions?: Impression[];
}

export interface Widget {
  id: string;
  icon: string;
  customIcon?: string;
  text: string;
  url: string;
  bgColor?: string;
  background?: string;
}

export interface PhotoFrame {
  id: string;
  photo: string;
}

export interface GlobalSettings {
  userPersona?: string;
  wallpaper: string;
  customWallpapers: string[];
  apiPresets: ApiPreset[];
  activePresetId: string;
  systemTimezone: string;

  lifeAI?: {
    name: string;
    persona: string;
    avatar?: string;
    lifeAIHistory?: { role: 'user' | 'assistant'; content: string }[];
  };

  transactions: Transaction[];
  financeCategories: FinanceCategory[];
  accounts: AssetAccount[];
  
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
  userPresets?: any[];
  userName?: string;
  userSignature?: string;
}

export interface AppDataBackup {
  version: number;
  date: string;
  contacts: Contact[];
  globalSettings: GlobalSettings;
  worldBooks: WorldBookCategory[];
}

export type CharacterProfile = Contact;