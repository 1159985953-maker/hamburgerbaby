// 这是一组代码：【types.ts 完整文件】
export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
}

// 文件位置: src/types.ts

export interface UserTag {
  id: string;
  content: string;
  timestamp: number;
  author: 'user' | 'ai';
  isPublic: boolean;        // true=公开, false=私密
  
  // ★★★ 新增：AI是否正在申请查看 ★★★
  aiRequestPending?: boolean; 
  
  isUnlocked?: boolean;     // (对AI标签) 用户是否已解锁
  unlockCost?: number;      // (对AI标签) 解锁花费
  userQuote: string;        // 触发AI标签的原话
  aiReasoning: string;      // AI的内心独白
  note?: string;            // 用户的批注
  rotation?: number;        // 旋转角度
  strength?: number;        // 借用存 margin
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
  contactId?: string;
  avatar: string;
  category: string;
  timestamp: number;
}

export interface WorldBookEntry {
  id: string;
  keys: string[];
  content: string;
  name?: string;
  strategy?: 'constant' | 'keyword'; 
}

export interface WorldBookCategory {
 id: string;
  name: string;
  type: 'global' | 'selective';
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
  META: { source_world: string; role_identity: string; continuity_principle: string; REALISM_RULE: boolean; };
  CORE_DRIVES: { primary_motive: string; secondary_motives: string[]; value_priority: string; survival_threshold: string; non_negotiables: string[]; };
  RELATIONAL_MASKS: { authority: { default_style: string; under_stress_switch: string; triggers: string[]; }; peers: { default_style: string; jealousy_points: string[]; trust_rules: string; }; intimates: { care_style: string; conflict_pattern: string; boundaries: string[]; }; strangers: { default_style: string; risk_policy: string; }; };
  EMOTIONAL_DYNAMICS: { baseline_mood: string; top_triggers_positive: string[]; top_triggers_negative: string[]; carryover_rules: string; escalation_curve: string; recovery_protocol: string; };
  CONFLICTS_DEFENSES: { inner_conflicts: string[]; defense_mechanisms: string[]; dissonance_explanations: string[]; mask_break_conditions: string[]; };
  CULTURE_SCRIPTS: { worldview: string; core_values: string[]; taboos: string[]; language_register: string; pet_phrases: string[]; role_expectations: string; };
  DEVELOPMENT_HISTORY: { key_events: string[]; unresolved_threads: string[]; current_stage: string; growth_arc_goal: string; constraints_from_past: string[]; };
  INDIVIDUAL_VARIATION: { personality_big5: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number; }; habits_quirks: string[]; speech_style: string; body_language: string; irrationalities: string[]; };
  RESOURCES_LIMITS: { skills: string[]; assets: string[]; constraints: string[]; risk_tolerance: string; };
  SCENE_EXECUTOR: { step_1_context_parse: string; step_2_state_load: string; step_3_policy_select: string; step_4_output_rules: string; step_5_memory_update: string; };
  REALISM_SELF_CHECK: { checks: string[]; pass_threshold: number; };
  joy?: number; anger?: number; sadness?: number; fear?: number; trust?: number;
}

export interface DiaryEntry {
  id: string; author: 'user' | 'ai'; date: string; content: string; mood?: string; weather?: string; moodEmoji?: string; images?: string[]; comments?: { id: string; author: 'user' | 'ai'; content: string; timestamp: number; }[];
}

export interface QAEntry {
  id: string; question: string; aiAnswer: string; userAnswer?: string; date: string; timestamp: number; isReadByPlayer?: boolean;
}

export interface LoveLetter {
  id: string; title: string; content: string; timestamp: number; isOpened: boolean; from: 'user' | 'ai'; unlockDate?: number;
}

export interface AgreementTrigger {
  type: 'time' | 'keyword' | 'event';
  value: number | string;
  original_text: string;
}

export interface ProfileTrait {
  value: string;
  quote: string;
  timestamp: number;
}

export interface UserProfile {
  name?: ProfileTrait;
  photo?: string;
  themeColor?: string;
  background_image?: string;
  scattered_photo_1?: string;
  scattered_photo_2?: string;
  scattered_photo_3?: string;
  personality_traits?: ProfileTrait[];
  preferences?: { likes?: ProfileTrait[]; dislikes?: ProfileTrait[]; };
  habits?: ProfileTrait[];
}

export interface Agreement {
  id: string;
  content: string;
  actor?: 'user' | 'ai';
  status: 'pending' | 'fulfilled' | 'failed';
  importance: number;
  trigger: AgreementTrigger;
  created_at: number;
  termType: 'short' | 'mid' | 'long';
}

export interface EmotionalNeed {
  type: string;
  description: string;
  intensity: number;
  trigger_reason: string;
  updated_at: number;
}

// 【Types.ts 更新：增加 chatCountForPoint 字段用于100句换1点】
export interface Contact {
  garden?: { seed: string; level: number; exp: number; lastWaterDate?: string; lastFertilizeDate?: string; flowerHistory?: { role: 'user' | 'assistant'; content: string; timestamp: number }[]; lastShadowAction?: string; aiWateredToday?: boolean; };
  userTags: UserTag[];
  isAffectionLocked?: boolean;
  bubbleColorUser?: string;
  bubbleColorAI?: string;
  bubbleFontSize?: string;
  chatScale?: number;
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
  proactiveConfig?: { enabled: boolean; minGapMinutes: number; maxDaily: number; };
  proactiveLastSent?: { [date: string]: number; };
  
  // ★★★ 新增：聊天计数器 (满100句换1点) ★★★
  chatCountForPoint?: number; 
  // ★★★ 新增：印象生成进度条 ★★★
  impressionCount?: number;      // 当前已聊句数
  impressionThreshold?: number;  // 下次触发阈值 (30-100随机)
  pendingProactive?: boolean;
  affectionScore: number;
  friendshipScore?: number;
  relationshipStatus: string;
  aiDND: { enabled: boolean; until: number; reason?: string; };
  longTermMemories: { id: string; content: string; importance: number; timestamp: number; meta?: any; }[];
  interventionPoints: number;
  currentChatMode: 'Casual' | 'Probing' | 'Intimate' | 'Cooling';
  hef: HEF;
  currentSchedule?: { activity: string; durationDays: number; energyImpact: number; startDate: number; };
  dialogueMode?: 'concise' | 'normal' | 'verbose';
  diaries?: DiaryEntry[];
  questions?: QAEntry[];
  letters?: LoveLetter[];
  summary?: string;
  voiceSampleText?: string;
  wallpaper?: string; 
  dueAgreementId?: string;
  agreements?: Agreement[];
  emotionalNeed?: EmotionalNeed;
  userProfile?: UserProfile;
  aiTagsForUser?: UserTag[];
}

export interface Widget {
  id: string; icon: string; customIcon?: string; text: string; url: string;
}

export interface PhotoFrame {
  id: string; photo: string;
}

export interface GlobalSettings {
  userName?: string;
  userSignature?: string;
  userPersona?: string;
  wallpaper: string;
  customWallpapers: string[];
  apiPresets: ApiPreset[];
  activePresetId: string;
  systemTimezone: string;
  userTimezone: string;
  appearance: { bubbleColorUser: string; bubbleColorAI: string; fontSize: string; showStatusBar: boolean; };
  themePresets: ThemePreset[];
  widgets: Widget[];
  photoFrames: PhotoFrame[];
  avatar: string;
  todos?: TodoItem[];
  categories?: TaskCategory[];
  minimax?: { groupId: string; apiKey: string; model: string; serviceArea?: 'domestic' | 'international'; };
  userPresets?: any[];
  lifeAIHistory?: { role: 'user' | 'assistant', content: string }[];
}