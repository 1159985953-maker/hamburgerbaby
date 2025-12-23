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

  affectionScore: number;
  relationshipStatus: 'Feud' | 'Conflict' | 'Acquaintance' | 'Friend' | 'Honeymoon' | 'Stable' | 'Close Friend' | 'Intimate' | 'Breaking' | 'Broken';
  
  aiDND: {
    enabled: boolean;
    until: number;
    reason?: string;
  };
  
  longTermMemories: {
    id: string;
    content: string;
    importance: number;
    timestamp: number;
    meta?: any;
  }[];

  interventionPoints: number;
  currentChatMode: 'Casual' | 'Probing' | 'Intimate' | 'Cooling';
  hef: Partial<HEF>;
  
  diaries?: DiaryEntry[];
  questions?: QAEntry[];
  letters?: LoveLetter[];
  anniversaries?: Anniversary[];
  summary?: string;
  
  voiceSampleText?: string;
  wallpaper?: string; 
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