// ==================== src/types.ts (完整覆盖) ====================

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
  author: 'user' | 'ai';
  isPublic: boolean;
  aiRequestPending?: boolean; 
  isUnlocked?: boolean;
  unlockCost?: number;
  userQuote: string;
  aiReasoning: string;
  note?: string;
  rotation?: number;
  strength?: number;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
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
  META: any;
  CORE_DRIVES: any;
  RELATIONAL_MASKS: any;
  EMOTIONAL_DYNAMICS: any;
  CONFLICTS_DEFENSES: any;
  CULTURE_SCRIPTS: any;
  DEVELOPMENT_HISTORY: any;
  INDIVIDUAL_VARIATION: any;
  RESOURCES_LIMITS: any;
  SCENE_EXECUTOR: any;
  REALISM_SELF_CHECK: any;
  joy?: number; anger?: number; sadness?: number; fear?: number; trust?: number;
}

export interface DiaryEntry {
  id: string; author: 'user' | 'ai'; date: string; content: string; mood?: string; weather?: string; moodEmoji?: string; images?: string[]; comments?: { id: string; author: 'user' | 'ai'; content: string; timestamp: number; }[];
}

export interface QAEntry {
  id: string; question: string; aiAnswer: string; userAnswer?: string; date: string; timestamp: number; isReadByPlayer?: boolean;
}

export interface LoveLetter {
  isFavorite?: boolean;
  id: string; title: string; content: string; timestamp: number; isOpened: boolean; from: 'user' | 'ai'; unlockDate?: number; 
  to?: string; // ★ 新增：这封信是写给谁的 (contactId)
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










// 这是一组代码：【types.ts】修正后的恋爱清单定义
export interface BucketItem {
    id: string;
    title: string;
    userContent: string; // 我的答案
    aiContent: string;   // AI的答案
    isDone: boolean;     // 是否完成
    isUnlocked: boolean; // ★★★ 核心：是否解锁（只有双方都填了，或者你填了以后才为true）
}

export interface FriendGroup {
    id: string;
    name: string;
    members: string[]; // 成员ID列表
    letters: LoveLetter[]; // 群组信箱
    questions: QAEntry[];  // 群组问答
    garden: { seed: string; level: number; exp: number; lastWaterDate?: string; flowerHistory?: any[] }; // 群组花园
    created: number;
}












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
  RelationShipUnlocked: boolean; // 旧字段，逐渐废弃，改用 status
  enabledWorldBooks: string[];
  voiceId?: string;
  playlist?: Song[];
  customCSS?: string;
  chatBackground?: string;
  unread?: number;
  proactiveConfig?: { enabled: boolean; minGapMinutes: number; maxDaily: number; };
  proactiveLastSent?: { [date: string]: number; };
  chatCountForPoint?: number; 
  impressionCount?: number;
  impressionThreshold?: number;
  pendingProactive?: boolean;
  affectionScore: number;
  friendshipScore?: number;
  relationshipStatus: string;
  
  // ★★★ 核心：邀请状态 (none=未邀请, inviting=等待同意, accepted=已建成, rejected=被拒) ★★★
  invitationStatus?: 'none' | 'inviting' | 'accepted' | 'rejected';
  
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
  couplePhotos?: (string | null)[]; // 拍立得照片墙
  bucketList?: BucketItem[];        // 恋爱清单
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
  friendGroups?: FriendGroup[]; 
}