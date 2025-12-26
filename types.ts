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
  note?: string; // 备注
  confidence?: number; // AI对自己判断的自信度
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
  contactId?: string; // ★★★ 新增：记录角色ID，用于精准跳转 ★★★
  avatar: string;
  category: string;
  timestamp: number;
}


export interface WorldBookEntry {
  id: string;
  keys: string[];   // 关键词列表
  content: string;  // 设定内容
  name?: string;    // 条目名称
  // ★★★ 新增：策略字段 (constant=常驻/基本, keyword=关键词触发)
  strategy?: 'constant' | 'keyword'; 
}

export interface WorldBookCategory {
 id: string;
  name: string;
  type: 'global' | 'selective'; // <--- 新增这行：global=基本(常驻), selective=关键词触发
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
    core_strength?: number; 
    habits_quirks: string[];
    speech_style: string;
    body_language: string;
    irrationalities: string[];
  };
  // 下面这些属性如果不需要可以删掉，保留是为了防止报错
  joy?: number;
  anger?: number;
  sadness?: number;
  fear?: number;
  trust?: number;
  current_emotions?: { joy: number; anger: number; sadness: number; fear: number; trust: number; };
  triggers?: string;
  decay?: string;
  
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




















// ==================== [新功能 V3.0] 动态人格档案 - 核心数据结构 ====================

// 定义档案里的每一个“特征”，都附带证据
export interface ProfileTrait {
  value: string; // 特征值，例如 "活泼" 或 "火锅"
  quote: string; // 证据原文
  timestamp: number; // 记录时间
}

// 定义完整的用户档案结构 (V2.0 - 带自定义主题)
export interface UserProfile {
  name?: ProfileTrait;
  photo?: string; // AI眼中的用户照片
  themeColor?: string; // 用户自定义的主题色
  background_image?: string; // 用户自定义的背景图
  scattered_photos?: string[]; // 新增：用于存放散落的拍立得照片URL
  scattered_photo_1?: string; // 散落照片1
  scattered_photo_2?: string; // 散落照片2
  scattered_photo_3?: string; // 散落照片3
  scattered_photo_4?: string; // 散落照片4
  personality_traits?: ProfileTrait[];
  preferences?: {
    likes?: ProfileTrait[];
    dislikes?: ProfileTrait[];
  };
  habits?: ProfileTrait[];
}
// ==================== 新代码块结束 ====================


export interface AgreementTrigger {
  type: 'time' | 'keyword' | 'event';
  value: number | string;
  original_text: string;
}





// [修复代码] 约定/承诺系统 (增加时间跨度)
export interface Agreement {
  id: string;
  content: string;
  actor?: 'user' | 'ai';
  status: 'pending' | 'fulfilled' | 'failed';
  importance: number;
  trigger: AgreementTrigger;
  created_at: number;
  // ★★★ 新增：目标期限类型 ★★★
  termType: 'short' | 'mid' | 'long'; // 短期(立刻去做)、中期(几天内)、长期(人生目标)
}





// 1. 【补全】情感需求接口
export interface EmotionalNeed {
  type: string;
  description: string;
  intensity: number;
}









export interface Contact {


  garden?: {
    seed: string;       // 种子类型ID
    level: number;      // 等级
    exp: number;        // 经验值
    lastWaterDate: string; // 最后浇水日期
    lastFertilizeDate: string; // 最后施肥日期
    // ★ 新增：花朵精灵的记忆
    flowerHistory?: { role: 'user' | 'assistant'; content: string; timestamp: number }[];
  };
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
  RelationShipUnlocked: boolean;
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
  affectionScore: number; // 这代表【爱意值/心动值】(Romance)
  friendshipScore: number; // 这代表【友谊值/信任值】(Friendship) - 新增！
  relationshipStatus: 'Feud' | 'Conflict' | 'Acquaintance' | 'Friend' | 'Honeymoon' | 'Stable' | 'Breaking' | 'Broken';
  statusSince: number;       // ★ 新增：进入当前状态的时间戳
  
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
  
// 在 Contact 接口内找到合适的位置（比如 hef 下面）添加这两行
  currentSchedule?: { activity: string; durationDays: number; energyImpact: number; startDate: number; }; // [新增代码] 智能行程系统
  dialogueMode?: 'concise' | 'normal' | 'verbose'; // [新增代码] 对话模式


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
userProfile?: UserProfile; // AI为你建立的专属人格档案
aiTagsForUser?: UserTag[]; // 新增：AI为用户打的标签
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