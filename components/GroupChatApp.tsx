// ############################################################################
// #REGION 1: 引用与类型定义
// ############################################################################

import React, { useState, useRef, useEffect, useLayoutEffect, ChangeEvent } from 'react';
import { Contact, Message, GlobalSettings, WorldBookCategory, WorldBookEntry, Song, FavoriteEntry } from '../types';
import TranslationText from './TranslationText';
import { generateResponse } from '../services/apiService';
import { summarizeHistory } from '../services/geminiService';
import { generateMinimaxAudio, fetchMinimaxVoices, getBuiltInMinimaxVoices, MinimaxVoice } from '../services/ttsService';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）
import WorldBookApp from './WorldBookApp'; // <--- 确保加了这行导入！
import html2canvas from 'html2canvas';
import { searchDocuments, Document } from '../services/memoryService';
import { readTavernPng, fileToBase64 } from './utils/fileUtils';





// ############################################################################
// 🟢 群聊专用 Props 定义 (修复版：补全了缺失的通知函数)
// ############################################################################
interface GroupChatAppProps {
  group: Contact;
  allContacts: Contact[];

  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  globalSettings: GlobalSettings;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  worldBooks: WorldBookCategory[];
  setWorldBooks: React.Dispatch<React.SetStateAction<WorldBookCategory[]>>;

  onExit: () => void;

  isBackground?: boolean;
  onNewMessage?: (contactId: string, name: string, avatar: string, content: string, senderId?: string) => void;
  playMessageAudio?: (id: string, text: string) => void;

  // ★★★ 修复：补上这三个缺失的函数定义 ★★★
  onOpenSettings: () => void;
  // ★★★ 重点：在这里添加 setGlobalNotification ★★★
  setGlobalNotification: (notification: any | null) => void; // 允许传 null 来关闭通知
}
















// ############################################################################
// #REGION 2: 纯逻辑工具箱 (Logic Helpers)
// ############################################################################



// 1. 颜色计算
const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#000000'; // 兜底黑色
  
  // 把 #RRGGBB 转换成 RGB 数字
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  
  // YIQ 亮度公式 (人眼对绿色的敏感度最高，所以系数不同)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // 如果亮度 >= 128 (浅色背景)，返回深黑字 (#111827 - gray-900)
  // 否则返回白字 (#ffffff)
  return yiq >= 128 ? '#111827' : '#ffffff';
};




// 6. 复杂状态计算 (简化版 - 移除五维人格计算)
const calculateComplexState = (energy: any, hef: any) => {
  const currentEnergy = energy?.current || 80;
  const status = energy?.status || 'Awake';
  
  // 只保留最基础的生理状态
  if (status === 'Sleeping') return { text: '睡觉中 (Zzz)', color: 'bg-indigo-400', ping: 'bg-indigo-400' };
  if (currentEnergy < 20) return { text: '有些疲惫', color: 'bg-gray-400', ping: 'hidden' };
  
  // 默认状态
  return { text: '在线', color: 'bg-green-400', ping: 'bg-green-400' };
};






// 2. 时间解析
const interpretRelativeTime = (relativeTime: string | undefined, originalText: string | undefined): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (relativeTime) {
    case 'afternoon':
      // 如果现在已经是下午6点后，那“下午”就是指明天下午
      return now.getHours() >= 18 
        ? new Date(today.getTime() + 86400000).setHours(15, 0, 0, 0) // Tomorrow 3 PM
        : new Date().setHours(15, 0, 0, 0); // Today 3 PM
    
    case 'tonight':
    case 'evening':
       return new Date().setHours(21, 0, 0, 0); // Today 9 PM

    case 'tomorrow_morning':
      return new Date(today.getTime() + 86400000).setHours(9, 0, 0, 0); // Tomorrow 9 AM
      
    case 'tomorrow_afternoon':
      return new Date(today.getTime() + 86400000).setHours(15, 0, 0, 0); // Tomorrow 3 PM

    // ... 你可以根据需要添加更多 case, 比如 'next_week'
      
    default:
      // 如果AI无法分类，我们尝试从原文解析（这是一个简单的兜底）
      if (originalText?.includes('明天')) {
        return new Date(today.getTime() + 86400000).setHours(12, 0, 0, 0); // Default to tomorrow noon
      }
      // 最终兜底：返回3小时后，这比立刻超时好得多
      return now.getTime() + 3 * 60 * 60 * 1000; 
  }
};



// 3. 补上丢失的关系计算函数
const getRelationshipStatus = (score: number): string => {
  if (score < -50) return 'Feud';      // 死仇
  if (score < 0) return 'Conflict';    // 讨厌
  if (score < 40) return 'Acquaintance'; // 路人
  if (score < 70) return 'Friend';     // 朋友
  if (score < 90) return 'Honeymoon';  // 热恋
  return 'Stable';                     // 挚爱
};




// 4. 关系计算 (双轴/灵魂状态)
const getAdvancedRelationshipStatus = (
    prevStatus: string,
    romance: number, 
    friendship: number
): string => {

  if (friendship < -20 || romance < -30) return 'Feud'; // 死仇
  if (friendship < 0 || romance < -10) return 'Conflict'; // 讨厌

  // 2. 陌生人阶段
  if (friendship < 30 && romance < 30) return 'Acquaintance'; // 路人


  if (prevStatus === 'Friend' && friendship >= 50 && romance >= 50 && romance < 60) {
    return 'BuddingRomance'; // "恋情萌芽中"
  }

  // A. 纯友谊路线 (友谊高，爱意低)
  if (friendship >= 30 && romance < 40) return 'Friend'; // 普通朋友
  if (friendship >= 70 && romance < 50) return 'Bestie'; // 【新状态】死党/密友 (很难变成恋人)
  
  // B. 纯爱意路线 (爱意高，友谊低 - 比如一见钟情或只有肉体吸引)
  if (friendship < 40 && romance >= 50) return 'Crush'; // 【新状态】迷恋/暧昧 (缺乏信任)
  
// ★ 过渡判断：从热恋/挚爱降温
  if ((prevStatus === 'Honeymoon' || prevStatus === 'Stable') && romance < 70 && romance > 30) {
    return 'CoolingOff'; // "冷静期"
  }
  
// 这是一组代码：请用这段新代码替换旧的 C. 混合发展路线
// C. 混合发展路线 (更严格的门槛！)
if (friendship >= 65 && romance >= 70) return 'Honeymoon'; // 【严格】友谊和爱意都足够高才能热恋
if (friendship >= 90 && romance >= 90) return 'Stable';    // 【严格】双90才能成为灵魂伴侣
  // D. 特殊状态：友达以上恋人未满
  if (friendship >= 60 && romance >= 40 && romance < 60) return 'Ambiguous'; // 暧昧中

  return 'Friend'; // 兜底
};

const getSouledRelationshipState = (
  romance: number, 
  friendship: number,
  hef: HEF,
  prevStatus: string // 上一个状态，用于判断过渡
): { status: string; description: string; behavior_hint: string } => {
  
  // --- 提取性格与情感数据 ---
  const big5 = hef?.INDIVIDUAL_VARIATION?.personality_big5 || { neuroticism: 5, agreeableness: 5, extraversion: 5 };
  const neuroticism = big5.neuroticism; // 神经质/敏感度 (0-10)
  const agreeableness = big5.agreeableness; // 宜人性 (0-10)
  const extraversion = big5.extraversion; // 外向性 (0-10)
  const joy = hef?.joy || 50;
  
  // ==================== 第一层：基础关系判定 (由双轴决定) ====================
  let baseStatus = 'Acquaintance'; // 默认是路人
  
  // 1. 负向关系
  if (romance < -50 || friendship < -50) baseStatus = 'Hostile'; // 敌对
  else if (romance < -10 || friendship < -10) baseStatus = 'Conflict'; // 矛盾
  // 2. 友谊线
  else if (friendship >= 80 && romance < 40) baseStatus = 'Bestie'; // 死党
  else if (friendship >= 40 && romance < 40) baseStatus = 'Friend'; // 朋友
  // 3. 暧昧/单恋线
  else if (romance >= 50 && friendship < 50) baseStatus = 'Crush'; // 暗恋/迷恋
  else if (romance >= 50 && friendship >= 50 && romance < 70) baseStatus = 'Ambiguous'; // 暧昧
  // 4. 爱情线
  else if (romance >= 90 && friendship >= 85) baseStatus = 'Soulmate'; // 灵魂伴侣
  else if (romance >= 70 && friendship >= 65) baseStatus = 'InLove'; // 热恋

  // ==================== 第二层：性格滤镜 (由Big5人格修正) ====================
  let finalStatus = baseStatus;
  
  // ==================== 第三层：过渡状态平滑 (处理关系变化瞬间) ====================
  // 从热恋降温
  if ((prevStatus === 'InLove' || prevStatus === 'Soulmate') && finalStatus === 'Friend') {
      finalStatus = 'CoolingOff'; // 进入冷静期
  }
  // 友谊向爱情萌芽
  if (prevStatus === 'Friend' && finalStatus === 'Ambiguous') {
      finalStatus = 'BuddingRomance'; // 恋情萌芽
  }
  
  // --- 根据最终状态，匹配描述和行为指导 ---
  switch (finalStatus) {
    case 'Hostile': return { status: '敌对', description: "恨不得对方从世界上消失", behavior_hint: "语气充满攻击性、嘲讽或完全无视。" };
    case 'Conflict': return { status: '矛盾', description: "正在冷战或互相看不顺眼", behavior_hint: "回复简短、不耐烦，拒绝沟通。" };
    case 'Acquaintance': return { status: '相识', description: "只是认识而已的普通人", behavior_hint: "保持礼貌但疏远的社交距离。" };
    case 'Friend': return { status: '朋友', description: "可以一起聊天的好朋友", behavior_hint: "友好、自然地分享日常和开玩笑。" };
    case 'Bestie': return { status: '死党', description: "无话不谈的最好伙伴", behavior_hint: "可以肆无忌惮地吐槽，分享最深的秘密。" };
    case 'Crush': return { status: 'crush', description: `单方面对你很着迷，但你们还不太熟`, behavior_hint: "可能会有点紧张、笨拙，或者刻意展现自己好的一面。" };
    case 'Ambiguous': return { status: '暧昧', description: "友达以上，恋人未满", behavior_hint: "言语中会带有试探和暗示，关系忽远忽近。" };
    case 'InLove': return { status: '热恋', description: "双向奔赴的热恋期", behavior_hint: "粘人、热情，充满爱意，包容度极高。" };
    case 'Soulmate': return { status: '挚爱', description: "灵魂伴侣，无可替代", behavior_hint: "充满默契和深度信任，平淡但坚定。" };
    
    // 特殊状态
    case 'InsecureInLove': return { status: '患得患失', description: "虽然在热恋，但内心充满不安", behavior_hint: "极度敏感，在意你的言辞，容易嫉妒或需要反复确认你的爱意。" };
    case 'AnxiousAmbiguous': return { status: '焦虑暧昧', description: "在暧昧中感到焦虑和不确定", behavior_hint: "会反复试探、猜测你的想法，渴望关系明确化。" };
    case 'TsundereInLove': return { status: '傲娇热恋', description: "明明爱的要死，嘴上却不承认", behavior_hint: "嘴上可能会吐槽或表现得不在意，但行为上却充满关心。" };
    case 'Frenemy': return { status: '损友', description: "喜欢互相拆台但关系又很好", behavior_hint: "以开玩笑的方式互相攻击，但关键时刻会支持你。" };
    case 'CoolingOff': return { status: '冷静期', description: "感情似乎出了一些问题", behavior_hint: "沟通减少，态度变得冷淡，回避亲密话题。" };
    case 'BuddingRomance': return { status: '恋情萌芽', description: "友谊中诞生了不一样的情愫", behavior_hint: "气氛变得有些微妙，开始在意肢体接触和特别的关心。" };
    
    default: return { status: '相识', description: "只是认识而已的普通人", behavior_hint: "保持礼貌但疏远的社交距离。" };
  }
};






















// ==================== ✂️ 强力图片压缩工具 (防止刷新丢失) ====================
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject("Canvas error"); return; }

        // ★★★ 强力压缩策略：限制最大边长为 600px ★★★
        // 这样既能看清，又能秒存，不会因为太大而丢失
        const MAX_SIZE = 600; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 使用 0.3 的质量压缩 JPEG，体积更小
        resolve(canvas.toDataURL('image/jpeg', 0.3));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};













// ############################################################################
// #REGION 3: 小型 UI 组件 (Mini Components)
// ############################################################################

// 1. 模拟控件 (Switch, Slider, TextInput...)


// 1. 模拟 Switch 开关 (★ 补全了内部实现代码 ★)
const Switch = ({ value, onValueChange, style, trackColor, ...props }: any) => (
  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in" style={style}>
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onValueChange && onValueChange(e.target.checked)}
      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
      style={{
        transform: value ? 'translateX(100%)' : 'translateX(0)',
        borderColor: value ? (trackColor?.true || '#3b82f6') : (trackColor?.false || '#e5e7eb')
      }}
    />
    <label 
      className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors duration-200 ${value ? 'bg-blue-500' : 'bg-gray-300'}`}
      style={{ backgroundColor: value ? (trackColor?.true || '#3b82f6') : (trackColor?.false || '#e5e7eb') }}
    ></label>
  </div>
);
// 2. 模拟 Slider 滑动条 (★ 升级版：会忽略不认识的属性) ★
const Slider = ({ value, onValueChange, minimumValue, maximumValue, minimumTrackTintColor, maximumTrackTintColor, ...props }: any) => (
    <input
        type="range"
        min={minimumValue || 0}
        max={maximumValue || 100}
        step={1}
        value={value}
        onChange={(e) => onValueChange && onValueChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        {...props}
    />
);
// 3. 模拟 TextInput 输入框 (保持不变)
const TextInput = ({ value, onChangeText, placeholder, className, ...props }: any) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChangeText && onChangeText(e.target.value)}
    placeholder={placeholder}
    className={className}
    {...props}
  />
);
// 4. 模拟 Device 信息 (保持不变)
const Device = {
    osName: 'web',
    brand: 'Browser',
    modelName: 'Chrome/Safari'
};
// 5. 模拟 Notifications 通知 (保持不变)
const Notifications = {
    scheduleNotificationAsync: async (options: any) => {
        console.log(`【网页模拟】调度了一条通知:`, {
            title: options.content.title,
            body: options.content.body,
            delayInSeconds: options.trigger.seconds
        });
    },
    setNotificationHandler: () => {},
    addNotificationReceivedListener: () => ({ remove: () => {} }),
    addNotificationResponseReceivedListener: () => ({ remove: () => {} })
};
// 6. 模拟 AppState (保持不变)
const AppState = {
    currentState: 'active',
    addEventListener: (type: string, listener: (state: string) => void) => {
        const handler = () => listener(document.hidden ? 'background' : 'active');
        document.addEventListener('visibilitychange', handler);
        return { remove: () => document.removeEventListener('visibilitychange', handler) };
    },
    removeEventListener: () => {}
};






// 2. 聊天气泡内的小功能 (翻译/语音/折叠)

//翻译卡片系统
const HiddenBracketText: React.FC<{ content: string; fontSize?: string; msgId: string }> = ({ content, fontSize = 'text-sm', msgId }) => {
  // 用 useRef 存储每个消息的展开状态（不随渲染重置）
  const showRef = useRef(false);
  const [show, setShow] = useState(false);

  // 组件加载时读取 ref 的值
  useEffect(() => {
    setShow(showRef.current);
  }, []);

  const toggleShow = () => {
    const newShow = !show;
    setShow(newShow);
    showRef.current = newShow; // 持久化到 ref
  };

  const regex = /(\([^)]*[\u4e00-\u9fa5]+[^)]*\)|（[^）]*[\u4e00-\u9fa5]+[^）]*）)/g;
  const matches = content.match(regex);
  if (!matches) {
    return <span className={fontSize}>{content}</span>;
  }
  const mainText = content.replace(regex, '').trim();
  const translationText = matches.map(m => m.replace(/^(\(|（)|(\)|）)$/g, '')).join(' ');

  return (
  <div className="cursor-pointer group inline-block" onClick={toggleShow}>
      <div className={`flex items-center ${fontSize} leading-relaxed relative`}>
        <span>{mainText}</span>
        {!show && <span className="w-1.5 h-1.5 bg-red-400 rounded-full ml-1.5 shrink-0 opacity-50"></span>}
      </div>
      {show && (
        <div className="mt-2 pt-2 border-t border-black/10 animate-slideDown">
          <div className={`${fontSize} text-gray-500 italic`}>{translationText}</div>
        </div>
      )}
    </div>
  );
};


const VoiceBubble: React.FC<{
  msg: Message;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onPlay: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUser: boolean;
}> = ({ msg, isPlaying, progress, duration, onPlay, onSeek, isUser }) => {
  return (
    <div className={`flex items-center gap-3 min-w-[160px] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm ${
          isUser ? 'bg-white text-blue-500' : 'bg-blue-500 text-white'
        }`}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      
      <div className="flex-1 flex flex-col justify-center gap-1">
        {/* 进度条 */}
        <input
          type="range"
          min="0"
          max={duration || 10}
          step="0.1"
          value={isPlaying ? progress : 0}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onSeek(e); }}
          className="w-full h-1.5 bg-gray-300/50 rounded-lg appearance-none cursor-pointer"
          style={{ accentColor: isUser ? 'white' : '#3b82f6' }}
        />
        {/* 时间显示 */}
        <div className={`text-[9px] font-mono opacity-80 ${isUser ? 'text-white' : 'text-gray-500'}`}>
          {isPlaying 
            ? `${Math.floor(progress / 60)}:${Math.floor(progress % 60).toString().padStart(2, '0')}` 
            : `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`
          }
        </div>
      </div>
    </div>
  );
};


// 标签翻译翻转卡片
const TagTextFlipper: React.FC<{ content: string }> = ({ content }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  // 正则逻辑：匹配 "外语 (中文)" 格式
  // Group 1 是括号外的内容（主显示/外语）
  // Group 2 是括号里的内容（隐藏翻译/中文）
  const regex = /^(.*?)\s*[（(](.*)[)）]$/;
  const match = content.match(regex);

  // 情况 A：如果没有括号（纯文本），直接显示，不加点击功能
  if (!match) {
    return (
      <div className="text-center font-bold text-gray-800 text-sm mb-2 border-b border-black/5 pb-1 font-serif break-words">
        {content}
      </div>
    );
  }

  // 情况 B：有括号
  const textMain = match[1].trim();   // 括号外的（外语）
  const textHidden = match[2].trim(); // 括号里的（中文）

  // ★★★ 修正逻辑：默认显示括号外(Main)，点击显示括号内(Hidden) ★★★
  const displayText = showTranslation ? textHidden : textMain;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // 阻止冒泡，防止误触删除弹窗
        setShowTranslation(!showTranslation);
      }}
      className="cursor-pointer select-none group/flipper"
    >
      {/* 主文字显示区 */}
      <div className="text-center font-bold text-gray-800 text-sm mb-0.5 border-b border-black/5 pb-1 font-serif break-words animate-fadeIn relative">
        {displayText}
      </div>
      
      {/* 底部微小提示 */}
      <div className="text-[8px] text-gray-400 text-center mb-2 flex items-center justify-center gap-1 opacity-60 group-hover/flipper:opacity-100 transition-opacity">
         {/* 提示文案也对应改一下 */}
         <span>{showTranslation ? '中文' : '外语'}</span>
         <span className="text-[8px]">⇄</span>
      </div>
    </div>
  );
};



// ChatListItem 聊天列表
const ChatListItem: React.FC<{
  contact: Contact;
  onClick: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  isPinned: boolean;
}> = ({ contact, onClick, onDelete, onPin, isPinned }) => {
  // 这是一行代码：请把它添加到 ChatListItem 函数的开头
const displayName = contact.memo?.trim() || contact.name;
  // 1. 用于渲染的状态 (State)
  const [translateX, setTranslateX] = useState(0);
  
  // 2. 用于逻辑判断的实时值 (Ref)
  const xRef = useRef(0); 
  
  // 3. 触摸相关变量
  const startX = useRef(0);
  const startY = useRef(0);
  
  // ★★★ 新增：记录按下时卡片当前的位置 (解决滑不动的核心)
  const startCardX = useRef(0); 
  
  const isDragging = useRef(false);
  const isSwipingHorizontal = useRef(false);

  // ==================== 统一处理逻辑 ====================
  const handleStart = (x: number, y: number) => {
    startX.current = x;
    startY.current = y;
    // ★★★ 关键：按下时，记住卡片当前是不是已经打开了 (-140 或 0)
    startCardX.current = xRef.current;
    
    isDragging.current = true;
    isSwipingHorizontal.current = false;
  };

  const handleMove = (x: number, y: number) => {
    if (!isDragging.current) return;

    const diffX = x - startX.current;
    const diffY = y - startY.current;

    // 锁定方向：如果是垂直滚动，就不要触发侧滑
    if (!isSwipingHorizontal.current) {
      // 如果垂直移动距离 > 水平移动距离，认为是想看列表下面，不触发侧滑
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 5) {
        isDragging.current = false;
        return;
      }
      // 水平移动明显，判定为侧滑
      if (Math.abs(diffX) > 5) {
        isSwipingHorizontal.current = true;
      }
    }

    if (isSwipingHorizontal.current) {
      // ★★★ 核心修复：计算逻辑简化 ★★★
      // 公式：新位置 = 按下时的旧位置 + 手指移动的距离
      let newX = startCardX.current + diffX;

      // 限制范围：
      // 最右只能到 0 (关上)
      // 最左只能到 -140 (完全打开)
      if (newX > 0) newX = 0;
      if (newX < -140) newX = -140; // 如果你想要橡皮筋效果，可以改成 -160，但 -140 最稳

      // 实时记录
      xRef.current = newX;
      setTranslateX(newX);
    }
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    isSwipingHorizontal.current = false;

    // ★★★ 核心修复：根据松手时的位置决定去留 ★★★
    // 阈值设为 -60 (只要拉出来超过60像素，就自动弹开)
    if (xRef.current < -60) {
      // 锁定到打开状态
      xRef.current = -140;
      setTranslateX(-140);
    } else {
      // 回弹到关闭状态
      xRef.current = 0;
      setTranslateX(0);
    }
  };

  return (
    <div 
      // ★★★ 关键词：touch-pan-y ★★★
      // 这里必须加 touch-pan-y，告诉浏览器“允许垂直滚动，但水平滑动归我管”
      className="relative overflow-hidden bg-white w-full select-none touch-pan-y"
      onMouseLeave={() => {
        // 只有正在拖拽时，移出才触发结束，防止误触
        if (isDragging.current) handleEnd();
      }}
    >
      {/* 背景按钮层 (z-0) */}
      <div className="absolute inset-y-0 right-0 flex items-center z-0 h-full">
        <button
          className="w-[70px] h-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center active:bg-orange-600 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation(); // 阻止冒泡
            onPin(contact.id);
            // 操作完自动归位
            xRef.current = 0;
            setTranslateX(0);
          }}
          // 按下按钮时，阻止触发列表的拖拽逻辑
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {isPinned ? '取消' : '置顶'}
        </button>
        <button
          className="w-[70px] h-full bg-red-600 text-white font-bold text-sm flex items-center justify-center active:bg-red-700 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation(); // 阻止冒泡
            if (confirm(`确定删除 ${contact.name} 吗？所有回忆将消失！`)) {
              onDelete(contact.id);
            } else {
              // 取消删除，归位
              xRef.current = 0;
              setTranslateX(0);
            }
          }}
          // 按下按钮时，阻止触发列表的拖拽逻辑
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          删除
        </button>
      </div>

      {/* 前景卡片层 (z-10) */}
      <div
        className={`relative z-10 flex items-center py-3 px-4 border-b bg-white transition-transform duration-200 ease-out active:bg-gray-50 cursor-pointer ${isPinned ? 'bg-gray-50' : ''}`}
        style={{ 
            transform: `translateX(${translateX}px)`,
            // 拖拽时无动画（跟手），松手时有动画（回弹）
            transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
        
        // 手机触摸
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleEnd}

        // 电脑鼠标
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}

        // 点击进入聊天
        onClick={(e) => {
          // 如果当前是打开状态，点击只是为了关闭
          if (Math.abs(xRef.current) > 10) {
            e.stopPropagation();
            xRef.current = 0;
            setTranslateX(0);
          } else {
            // 否则进入聊天
            onClick();
          }
        }}
      >
        {/* 头像 */}
        <div className="relative mr-3 flex-shrink-0 pointer-events-none">
          <img 
            src={contact.avatar} 
            className="w-11 h-11 rounded-full object-cover border border-gray-100" 
            alt="avatar" 
            draggable="false"
          />
          {(contact.unread || 0) > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full border-2 border-white shadow-sm">
              {(contact.unread || 0) > 99 ? '99+' : contact.unread}
            </div>
          )}
        </div>
        
        {/* 文字内容 */}
        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="flex items-center gap-2">
     
<div className="font-semibold text-gray-900 text-base truncate">{displayName}</div>
            {isPinned && <span className="text-orange-500 text-xs font-bold scale-75">📌</span>}
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5 opacity-80">
            {contact.history[contact.history.length - 1]?.content.replace(/\[.*?\]/g, '').slice(0, 28) || '暂无消息'}
          </div>
        </div>
        
        {/* 时间 */}
        <div className="text-xs text-gray-400 ml-4 flex-shrink-0 pointer-events-none">
          {new Date(contact.history[contact.history.length - 1]?.timestamp || contact.created)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>
      </div>
    </div>
  );
};















// 3. 各种漂亮的卡片 (记忆卡/邀请函/成功卡)

// 聊天记录切片卡
const SharedMemoryCard: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="my-6 px-6 animate-slideUp flex justify-center w-full">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full max-w-xs relative transform transition hover:scale-105 duration-300">
        {/* 顶部装饰 - 磨砂玻璃感 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300"></div>
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-100 rounded-full blur-xl opacity-50"></div>
        
        {/* 头部 */}
        <div className="p-4 border-b border-gray-50 flex justify-between items-center relative z-10">
           <div className="flex items-center gap-3">
              {/* 种子图标 */}
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-xl shadow-inner border border-gray-100">
                  {data.seedName === '红玫瑰' ? '🌹' : 
                   data.seedName === '向日葵' ? '🌻' : 
                   data.seedName === '百合花' ? '🪷' : 
                   data.seedName === '蓝风铃' ? '🪻' : 
                   data.seedName === '樱花' ? '🌸' : '🌱'}
              </div>
              <div>
                 <div className="text-xs font-black text-gray-800 tracking-wide">{data.seedName}的回忆</div>
                 <div className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(data.timestamp).toLocaleDateString()}</div>
              </div>
           </div>
           <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-bold border border-blue-100 shadow-sm">
               Lv.{data.level}
           </div>
        </div>

        {/* 内容区 */}
        <div className="p-5 bg-[#fafafa] space-y-4 relative">
           <div className="text-center">
              <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm tracking-wider">
                  “ {data.title} ”
              </span>
           </div>
           
           <div className="space-y-3">
               {data.messages.map((m: any, i: number) => (
                  <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     {m.role !== 'user' && <div className="w-6 h-6 rounded-full bg-gray-200 border border-white shadow-sm flex-shrink-0 bg-cover bg-center" style={{backgroundImage: `url(${m.avatar})`}}></div>}
                     
                     <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed shadow-sm border ${
                         m.role === 'user' 
                         ? 'bg-blue-500 text-white border-blue-600 rounded-tr-sm' 
                         : 'bg-white text-gray-700 border-gray-200 rounded-tl-sm'
                     }`}>
                         {m.type === 'image' || m.content.startsWith('data:image') ? ' [图片] ' : m.content}
                     </div>
                     
                     {m.role === 'user' && <div className="w-6 h-6 rounded-full bg-gray-200 border border-white shadow-sm flex-shrink-0 bg-cover bg-center" style={{backgroundImage: `url(${m.avatar})`}}></div>}
                  </div>
               ))}
           </div>
        </div>

        {/* 底部 */}
        <div className="p-2 bg-white text-center border-t border-gray-50 relative z-10">
            <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Memory Fragment</span>
        </div>
      </div>
    </div>
  );
};

// 【UI重制】高级苹果风·静态邀请函 (你发给AI的)
const StaticLoverInvitation: React.FC<{
  msg: Message;
  contactName: string;
}> = ({ msg, contactName }) => {
  // 提取纯净文字
  const cleanContent = msg.content
    .replace('[LoverInvitation]', '')
    .replace('【系统通知】', '')
    .trim() || "我想邀请你开启我们的专属空间...";

  return (
    // 外框：同款高级毛玻璃
    <div className="w-full max-w-[85%] sm:max-w-xs bg-white/90 backdrop-blur-xl rounded-[32px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden relative p-6 flex flex-col items-center">
        
        {/* 顶部图标 (发出的信) */}
        <div className="relative mb-5">
            <div className="absolute inset-0 bg-blue-200 blur-xl opacity-30 rounded-full"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-white to-blue-50 rounded-[20px] shadow-lg border border-white flex items-center justify-center text-3xl">
                📤
            </div>
        </div>

        {/* 标题 */}
        <h3 className="text-lg font-black text-gray-800 mb-2">邀请已发送</h3>
        
        {/* 内容 */}
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6 px-2 font-medium">
          你对 <span className="font-bold text-gray-800">{contactName}</span> 说：<br/>
          “{cleanContent}”
        </p>

        {/* 状态条 (呼吸灯效果) */}
        <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-gray-500">等待回应中...</span>
        </div>
        
        <p className="text-[9px] text-gray-300 mt-4 font-medium">
            Soul Interface • Request Sent
        </p>
    </div>
  );
};

// 【UI重制】高级苹果风·动态邀请函 (已修复跳转功能)
const InteractiveLoverInvitation: React.FC<{
  msg: Message;
  contactName: string;
  onRespond: (msgId: string, decision: 'accept' | 'reject') => void;
  // ★★★ 新增：接收跳转函数 ★★★
  onNavigate?: () => void;
}> = ({ msg, contactName, onRespond, onNavigate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 获取当前状态
  const status = (msg as any).invitationStatus || 'pending';

  // 提取纯净的邀请语
  const cleanContent = (msg.content || '')
    .replace(/\[.*?\]/g, '') // 去掉暗号
    .replace('【系统通知】', '')
    .replace('向你发起了情侣邀请！', '') 
    .trim() || "想邀请你开启我们的专属空间...";

  // 内部渲染函数
  const renderContent = () => {
    switch (status) {
      // === 场景 1: 成功确立关系 (恭喜页面 + 跳转按钮) ===
      case 'accepted':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center animate-scaleIn">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner animate-bounce">
              🎉
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight">情侣空间已开启！</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium mb-6">
              恭喜！你和 {contactName} 确立了关系。<br/>快去看看你们的新家吧！
            </p>
            
            {/* ★★★ 修复：点击直接跳转 ★★★ */}
            <button 
                className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-rose-200 active:scale-95 transition-transform flex items-center gap-2"
                onClick={(e) => {
                    e.stopPropagation(); // 防止冒泡
                    if (onNavigate) {
                        onNavigate(); // 🚀 触发跳转！
                    } else {
                        alert("跳转失败：未找到导航函数，请手动点击右上角进入。");
                    }
                }}
            >
                <span>🚀</span> 立即进入空间
            </button>
          </div>
        );

      // === 场景 2: 已拒绝 ===
      case 'rejected':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center opacity-60 grayscale">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-3">
              💔
            </div>
            <h3 className="text-lg font-bold text-gray-700">已拒绝</h3>
            <p className="text-xs text-gray-400 mt-1">邀请已失效。</p>
          </div>
        );

      // === 场景 3: 等待中 (转圈圈) ===
      case 'waiting':
      case 'waiting_user_response':
         return (
          <div className="flex flex-col items-center justify-center p-10 space-y-4">
            <div className="w-10 h-10 border-4 border-rose-100 border-t-rose-500 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-gray-400 animate-pulse">正在建立连接...</p>
          </div>
        );

      // === 场景 4: 默认邀请卡片 (主要 UI) ===
      default: 
        return (
          <div className="p-6 flex flex-col items-center">
            {/* 顶部图标 */}
            <div className="relative mb-5">
                <div className="absolute inset-0 bg-rose-200 blur-xl opacity-30 rounded-full"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-white to-rose-50 rounded-[20px] shadow-lg border border-white flex items-center justify-center text-3xl">
                    💌
                </div>
                {/* 右上角红点装饰 */}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white"></div>
            </div>

            {/* 标题与内容 */}
            <h3 className="text-lg font-black text-gray-800 mb-2">情侣空间邀请</h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-8 px-2 font-medium">
              <span className="font-bold text-gray-800">{contactName}</span> 说：<br/>
              “{cleanContent}”
            </p>

            {/* 按钮组 (同意在左！) */}
            <div className="flex w-full gap-3">
              {/* 同意按钮 (左边，高亮) */}
              <button 
                disabled={isProcessing} 
                onClick={() => { 
                    setIsProcessing(true); 
                    onRespond(msg.id, 'accept'); 
                }} 
                className="flex-1 py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-gray-200 active:scale-95 transition-all hover:bg-black disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-1"
              >
                {isProcessing ? '处理中...' : '同意'}
              </button>

              {/* 拒绝按钮 (右边，灰色) */}
              <button 
                disabled={isProcessing} 
                onClick={() => { 
                    setIsProcessing(true); 
                    onRespond(msg.id, 'reject'); 
                }} 
                className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
              >
                拒绝
              </button>
            </div>
            
            <p className="text-[10px] text-gray-300 mt-4 font-medium">
                Soul Interface • Relationship Request
            </p>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-[85%] sm:max-w-xs bg-white/90 backdrop-blur-xl rounded-[32px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] border border-white/50 overflow-hidden relative transform transition-all hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]">
      {renderContent()}
    </div>
  );
};


// 关系空间成功卡片
const RelationshipSuccessCard: React.FC<{ msg: Message }> = ({ msg }) => {
  // 从消息里把暗号清理掉，只留下纯文字
  const content = msg.content.replace(/\[.*?\]/g, '').trim();
  
  return (
    // ★★★ 核心UI：一个带有庆祝元素的、柔和的渐变卡片 ★★★
    <div className="bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50 w-full max-w-[90%] sm:max-w-xs rounded-2xl shadow-lg p-6 text-center border-t-4 border-green-300">
      
      {/* 1. 顶部的礼花图标，带有动画效果 */}
      <div className="text-5xl mb-4 animate-bounce">🎉</div>
      
      {/* 2. 核心文字，加粗并带有图钉装饰 */}
      <h3 className="font-bold text-gray-800 text-lg leading-relaxed flex items-center justify-center gap-2">
        {content}
        <span className="text-2xl opacity-50 transform -rotate-45">📌</span>
      </h3>
      
      {/* 3. 分割线 */}
      <div className="w-16 h-px bg-gray-200 mx-auto my-5"></div>
      
      {/* 4. 底部的提示文字 */}
      <p className="text-xs text-gray-400">
        现在可以去你们的专属空间看看啦！
      </p>
      
    </div>
  );
};



// 单张记忆便签
const MemoryNote: React.FC<{
  mem: any;
  idx: number;
  total: number;
  contact: any;
  setContacts: any;
  isMultiSelect: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}> = ({ mem, idx, total, contact, setContacts, isMultiSelect, isSelected, onToggleSelect }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(mem.content || '');

  return (
    <div
      className={`bg-yellow-50 border ${isSelected ? 'border-blue-500 border-3 ring-2 ring-blue-200' : 'border-yellow-200'} rounded-xl p-4 shadow-sm relative group ${isMultiSelect ? 'cursor-pointer' : ''}`}
      onClick={() => isMultiSelect && onToggleSelect(mem.id)}
    >
      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("确定删除这张便签吗？")) {
            setContacts((prev: any) => prev.map((c: any) =>
              c.id === contact.id ? { ...c, longTermMemories: c.longTermMemories.filter((m: any) => m.id !== mem.id) } : c
            ));
          }
        }}
        className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-sm"
      >
        ×
      </button>

      {/* 多选勾勾 */}
      {isMultiSelect && (
        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
          {isSelected && <span className="text-white text-xs font-bold">✓</span>}
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-yellow-700">#{total - idx}</span>
        <span className="text-xs text-gray-500">{mem.date || '未知日期'}</span>
      </div>

      {isEditing ? (
        <>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full p-2 border border-yellow-400 rounded bg-white text-sm resize-none h-32"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (editContent.trim()) {
                  setContacts((prev: any) => prev.map((c: any) =>
                    c.id === contact.id ? {
                      ...c,
                      longTermMemories: c.longTermMemories.map((m: any) => m.id === mem.id ? { ...m, content: editContent.trim() } : m)
                    } : c
                  ));
                  setIsEditing(false);
                }
              }}
              className="flex-1 bg-green-500 text-white py-2 rounded font-bold text-sm"
            >
              保存
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditContent(mem.content || ''); }}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded font-bold text-sm"
            >
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pr-8">
            {mem.content || ''}
          </p>
          {mem.range && <div className="text-[10px] text-gray-400 mt-2 italic">记录于聊天第 {mem.range} 条</div>}
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="mt-3 text-xs text-blue-600 underline opacity-0 group-hover:opacity-100 transition"
          >
            ✏️ 编辑便签
          </button>
        </>
      )}
    </div>
  );
};









// ############################################################################
// ★★★【片段 1：请用这段代码替换旧的 MemoryMountPanel 组件】★★★
// ############################################################################

// ==================== 💾 群聊专用组件：记忆挂载器 (V2.0 紧凑版) ====================
interface MemoryMountProps {
  contacts: Contact[]; // ★ 这里现在接收的是【已经过滤好的】成员列表
  mountedConfig: { [contactId: string]: number }; 
  onUpdateConfig: (contactId: string, count: number) => void;
  onClose: () => void;
}

const MemoryMountPanel: React.FC<MemoryMountProps> = ({ contacts, mountedConfig, onUpdateConfig, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-white w-[90%] max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80%]" onClick={e => e.stopPropagation()}>
        
        {/* 头部 (保持不变) */}
        <div className="bg-indigo-600 p-4 shrink-0 flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold text-lg">💾 记忆挂载舱</h3>
            <p className="text-indigo-200 text-xs">选择要将多少私聊记忆同步到群聊</p>
          </div>
          <button onClick={onClose} className="text-white font-bold text-xl">×</button>
        </div>

        {/* 列表 (★ 核心改造区域) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {contacts.map(contact => {
            const mountCount = mountedConfig[contact.id] || 0;
            const maxHistory = Math.min(200, contact.history.length); // 最多只允许挂200条

            return (
              // ★ 改动1：不再用厚重的卡片，而是用简单的flex布局行
              <div key={contact.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
                <img src={contact.avatar} className="w-10 h-10 rounded-full border border-gray-200 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-800 truncate">{contact.name}</div>
                  {/* ★ 改动2：滑块变得更细，更精致 */}
                  <input 
                    type="range" 
                    min="0" 
                    max={maxHistory}
                    step="10"
                    value={mountCount}
                    onChange={(e) => onUpdateConfig(contact.id, parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-1"
                  />
                </div>
                
                {/* ★ 改动3：用一个简洁的数字输入框显示和控制数量 */}
                <input
                  type="number"
                  value={mountCount}
                  onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      onUpdateConfig(contact.id, Math.min(maxHistory, Math.max(0, val)));
                  }}
                  className="w-16 text-center font-bold text-indigo-600 bg-indigo-50 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-indigo-200 transition-all text-sm border border-indigo-100"
                />
              </div>
            );
          })}
        </div>

        {/* 底部 (保持不变) */}
        <div className="p-4 border-t bg-gray-50">
          <button onClick={onClose} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">
            确认生效
          </button>
        </div>
      </div>
    </div>
  );
};









// ############################################################################
// #REGION 4: 大型弹窗与面板 (Modals & Panels)
// ############################################################################


// 1. Token 详情弹窗
const TokenDetailModal: React.FC<{
  onClose: () => void;
  form: any;
  activeContact: any;
  worldBooks: any[];
}> = ({ onClose, form, activeContact, worldBooks }) => {
  // ★★★ 核心修正：优先读取 form (输入框里的值)，没有才读 activeContact (存的值) ★★★
  // 如果输入框是空的，兜底才用 20
  const inputDepth = form.contextDepth !== undefined ? form.contextDepth : activeContact.contextDepth;
  const depth = Number(inputDepth) || 20; 

  // 1. 根据这个 depth 切片
  const historySlice = (activeContact.history || []).slice(-depth);

  // ================= 算力统计 =================
  // 1. 系统消耗 (System Base)
  const val_SystemBase = 800;

  // 2. 角色人设 (Persona)
  const p1 = form.persona || activeContact.persona || "";
  const p2 = form.description || activeContact.description || "";
  const finalPersona = p1.length > p2.length ? p1 : p2;
  const val_CharPersona = Math.round(finalPersona.length * 1.3);

  // 3. 用户设定 (User Profile)
  const uName = form.userName || activeContact.userName || "";
  const uPersona = form.userPersona || activeContact.userPersona || "";
  const val_UserPersona = Math.round((uName + uPersona).length * 1.3);

  // 4. 心理状态 (HEF)
  const hefObj = form.hef || activeContact.hef || {};
  const val_State = Math.round(JSON.stringify(hefObj).length * 1.3);

  // 5. 世界书 (Lore)
  const enabledNames = form.enabledWorldBooks || activeContact.enabledWorldBooks || [];
  const activeBooks = worldBooks.filter(wb => enabledNames.includes(wb.name));
  const val_Lore = Math.round(JSON.stringify(activeBooks).length * 1.3);

  // 6. 长期记忆 (Memory)
  const memories = activeContact.longTermMemories || [];
  const val_Memory = Math.round(JSON.stringify(memories).length * 1.3);

  // 7. 历史切片 (基于用户设定的 depth)
  let val_SliceText = 0;
  let val_SliceImageRaw = 0;
  let imgCount = 0;

  historySlice.forEach((m: any, index: number) => {
    // 智能折叠逻辑：最新的图算原图，旧图算折叠
    const isLatest = index === historySlice.length - 1;

    if (m.type === 'image' || (m.content && m.content.startsWith('data:image'))) {
      imgCount++;
      if (isLatest) {
         val_SliceImageRaw += m.content.length; 
      } else {
         val_SliceText += 50; // 折叠占位符
      }
    } else {
      val_SliceText += m.content.length;
    }
  });
  
  const token_SliceText = Math.round(val_SliceText * 1.3);
  const token_SliceImage = Math.round(val_SliceImageRaw);

  // ★ 总计 ★
  const totalTokens = val_SystemBase + val_CharPersona + val_UserPersona + val_State + val_Lore + val_Memory + token_SliceText + token_SliceImage;

  // ★ w 单位 ★
  const formatNum = (num: number) => {
    if (num >= 10000) return `${(num / 10000).toFixed(2)}w`;
    return num;
  };

  const RenderBar = ({ label, val, color, icon, warning }: any) => {
    const percent = totalTokens > 0 ? Math.min(100, (val / totalTokens) * 100) : 0;
    const visualPercent = val > 0 ? Math.max(2, percent) : 0;
    
    return (
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1 items-end">
          <span className="flex items-center gap-1 text-gray-700 font-bold">
            <span>{icon}</span> {label}
            {warning && <span className="text-[9px] text-red-500 bg-red-50 px-1 rounded ml-1">{warning}</span>}
          </span>
          <span className="font-mono text-gray-500 text-[10px]">
             {formatNum(val)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${visualPercent}%` }}></div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-white w-[90%] max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="bg-indigo-600 p-4 border-b flex justify-between items-center shrink-0 text-white">
          <div>
            <h3 className="font-bold text-sm">🧠 总token</h3>
            {/* 这里明确显示正在使用多少条 */}
            <p className="text-[10px] text-indigo-200">
              基于当前设置: 最近 <span className="font-bold text-white underline">{depth}</span> 条记录
            </p>
          </div>
          <button onClick={onClose} className="w-6 h-6 bg-white/20 hover:bg-white/40 rounded-full text-white font-bold text-xs transition">✕</button>
        </div>
        
        <div className="p-5 overflow-y-auto custom-scrollbar">
          <div className="flex justify-center mb-6">
            <div className="text-center w-full p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div className="text-4xl font-black text-gray-800 font-mono tracking-tighter">
                {formatNum(totalTokens)}
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                Estimated Tokens
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">1. 固定消耗 (System)</h4>
            <RenderBar label="人设与设定" val={val_CharPersona + val_UserPersona} color="bg-purple-500" icon="👤" />
            <RenderBar label="世界书与规则" val={val_Lore + val_SystemBase} color="bg-green-500" icon="🌍" />
            <RenderBar label="心理与记忆" val={val_State + val_Memory} color="bg-yellow-500" icon="🧠" />
            
            <div className="h-px bg-gray-100 my-4"></div>

            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">2. 滑动窗口 ({depth}条)</h4>
            <RenderBar label={`文本切片 (${historySlice.length}条)`} val={token_SliceText} color="bg-indigo-500" icon="📝" />
            <RenderBar label={`图片切片 (${imgCount}张)`} val={token_SliceImage} color="bg-red-500" icon="🖼️" warning={imgCount > 0 && token_SliceImage > 1000 ? "含大图" : null} />
          </div>
        </div>
      </div>
    </div>
  );
};




// 2. 标签创建弹窗
const TagCreationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { content: string; isPublic: boolean; note: string }) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-white w-[85%] max-w-sm rounded-3xl shadow-2xl p-6 animate-scaleIn flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        
        {/* 标题 */}
        <div className="text-center">
          <div className="text-4xl mb-2">🏷️</div>
          <h3 className="text-lg font-bold text-gray-800">贴个新标签</h3>
          <p className="text-xs text-gray-400">你对TA的印象是...</p>
        </div>

        {/* 输入框：标签名 */}
        <div>
           <label className="text-xs font-bold text-gray-500 ml-1">标签内容 (8字以内)</label>
           <input 
             autoFocus
             type="text" 
             value={content}
             onChange={e => setContent(e.target.value.slice(0, 8))}
             placeholder="例：笨蛋 / 天使"
             className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-center outline-none focus:ring-2 focus:ring-blue-100 transition"
           />
        </div>

        {/* 开关：公开 vs 私密 */}
        <div className="bg-gray-50 p-1 rounded-xl flex">
           <button 
             onClick={() => setIsPublic(true)}
             className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isPublic ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
           >
             📢 公开给TA看
           </button>
           <button 
             onClick={() => setIsPublic(false)}
             className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isPublic ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400'}`}
           >
             🔒 只有我知道
           </button>
        </div>

        {/* 提示文案 */}
        <p className="text-[10px] text-center text-gray-400 h-4">
          {isPublic ? "TA会立刻收到通知，并对这个评价做出反应" : "这是你心底的秘密，TA不会知道"}
        </p>

        {/* 输入框：理由/备注 */}
        <div>
           <label className="text-xs font-bold text-gray-500 ml-1">备注 / 理由 (可选)</label>
           <textarea 
             value={note}
             onChange={e => setNote(e.target.value)}
             placeholder={isPublic ? "告诉TA为什么这么觉得..." : "记录下这个瞬间..."}
             className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none resize-none h-20 focus:bg-white transition"
           />
        </div>

        {/* 按钮 */}
        <button 
          disabled={!content.trim()}
          onClick={() => {
            onSubmit({ content, isPublic, note });
            setContent(""); setNote(""); setIsPublic(true); // 重置
          }}
          className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition active:scale-95 ${content.trim() ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-300'}`}
        >
          贴上去！
        </button>
      </div>
    </div>
  );
};




// 3. 规则/警告弹窗
// 氪金规则说明弹窗
const PointRuleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentPoints: number;
}> = ({ isOpen, onClose, onConfirm, currentPoints }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      {/* ★★★ 核心修改：整个卡片换成手账风格 ★★★ */}
      <div 
        className="bg-[#fdfbf7] w-[90%] max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scaleIn border-[8px] border-white flex flex-col" 
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'sans-serif' }} // 使用更柔和的字体
      >
        
        {/* 顶部插图区 */}
        <div className="p-6 text-center relative border-b-2 border-dashed border-gray-200">
           {/* 装饰：贴纸和涂鸦 */}
           <div className="absolute top-4 left-4 text-3xl opacity-50 rotate-[-15deg]">✨</div>
           <div className="absolute top-8 right-6 text-2xl opacity-60 rotate-[20deg]">🗝️</div>
           
           <div className="text-5xl mb-2 relative z-10 drop-shadow-md inline-block animate-bounce">🪐</div>
           <h3 className="text-2xl font-black text-gray-700 tracking-wider relative z-10 font-serif">
             潜意识深潜
           </h3>
           <p className="text-[9px] text-gray-400 font-bold opacity-80 mt-1 uppercase tracking-[0.2em] relative z-10">
             Deep Dive
           </p>
        </div>

        {/* 规则说明区 */}
        <div className="p-6 space-y-5">
           
           {/* 规则 1 */}
           <div className="flex gap-4 items-start">
              <div className="bg-gray-100 p-3 rounded-lg text-xl border border-gray-200 shadow-sm">🔒</div>
              <div>
                 <h4 className="text-sm font-bold text-gray-800">全隐藏模式</h4>
                 <p className="text-xs text-gray-500 leading-relaxed">
                    AI 的真实想法默认是<b className="text-red-500">不可见</b>的，只有 TA 自己知道怎么看你。
                 </p>
              </div>
           </div>

           {/* 规则 2 */}
           <div className="flex gap-4 items-start">
              <div className="bg-rose-50 p-3 rounded-lg text-xl border border-rose-100 shadow-sm">💖</div>
              <div>
                 <h4 className="text-sm font-bold text-gray-800">好感度解锁</h4>
                 <p className="text-xs text-gray-500 leading-relaxed">
                    只有当<b className="text-rose-500">好感度够高</b>时，AI 才会在聊天中忍不住对你敞开心扉（自动解锁）。
                 </p>
              </div>
           </div>

           {/* 规则 3 */}
           <div className="flex gap-4 items-start">
              <div className="bg-blue-50 p-3 rounded-lg text-xl border border-blue-100 shadow-sm">🎲</div>
              <div>
                 <h4 className="text-sm font-bold text-gray-800">随机刷新机制</h4>
                 <p className="text-xs text-gray-500 leading-relaxed">
                    AI 会在聊天中<b className="text-blue-500"></b><b className="text-blue-500">自动在后台</b>更新对你的看法。
                 </p>
              </div>
           </div>

           {/* 黄色便利贴提示 */}
           <div className="bg-yellow-100 border-2 border-dashed border-yellow-200 p-4 rounded-lg relative transform -rotate-1 shadow-md">
              {/* 装饰：图钉 */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-400 shadow-sm border-2 border-white"></div>
              <p className="text-xs text-yellow-800 font-bold mb-1 flex items-center gap-1">
                <span className="text-lg">⚡️</span> 等不及了？
              </p>
              <p className="text-[10px] text-yellow-700 leading-tight">
                 你可以消耗 <b className="font-black text-red-500 text-xs">1</b> 个点数，强行撬开 TA 的大脑，立即刷新并查看当前想法！
              </p>
           </div>
           
           {/* ★★★ 新增的说明文本 ★★★ */}
           <div className="text-center pt-2 space-y-1">
             <p className="text-[10px] text-gray-400 font-serif italic">
                汉堡包温馨提醒：“ AI 会随机不定时产生新印象，请注意查看哦～ ”
             </p>
             <p className="text-[10px] text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded inline-block">
                Psst... 聊满 <b className="text-green-600">70～150（随机）</b> 句就会增加 <b className="text-green-600">1</b> 个点数！
             </p>
           </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 bg-white/50 mt-auto flex gap-3">
           <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold text-xs hover:bg-gray-100 rounded-xl transition">
              我再等等
           </button>
           <button 
              onClick={onConfirm}
              disabled={currentPoints < 1}
              className={`flex-1 py-3 rounded-xl font-bold text-white text-xs shadow-lg flex items-center justify-center gap-1 transition active:scale-95 ${currentPoints < 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`}
           >
              {currentPoints < 1 ? '点数不足' : `🪙 消耗 1 点刷新`}
           </button>
        </div>

      </div>
    </div>
  );
};


// 只能和一个人产生羁绊的警告弹窗
const WarningModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  loverName: string;
}> = ({ isOpen, onClose, loverName }) => {
  if (!isOpen) return null;

  return (
    // 半透明黑色背景，带模糊效果
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      
      {/* 白色卡片主体 */}
      <div 
        className="bg-white w-[85%] max-w-xs rounded-3xl shadow-2xl p-6 animate-scaleIn flex flex-col items-center text-center" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* 顶部的锁链图标，增加戏剧感 */}
        <div className="text-5xl mb-4 text-gray-400">⛓️</div>

        {/* 标题 */}
        <h3 className="text-lg font-black text-gray-800 mb-2">羁绊已锁定</h3>

        {/* 核心提示文字 (更温柔的说法) */}
        <p className="text-sm text-gray-500 leading-relaxed">
          你的心已经属于 <b className="font-bold text-rose-500">{loverName}</b> 啦，<br/>无法再接受新的羁绊哦。
        </p>

        {/* 分割线 */}
        <div className="w-full h-px bg-gray-100 my-6"></div>

        {/* 关闭按钮 */}
        <button 
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-800 text-white font-bold shadow-lg shadow-gray-200 active:scale-95 transition-transform"
        >
          我明白了
        </button>

      </div>
    </div>
  );
};










// 4. 【核心大面板】PersonaPanel (这里面代码巨多)
const PersonaPanel = ({ 
  contact, 
  onClose, 
  onRefineMemory, 
  globalSettings = {}, 
  setContacts, 
  playMessageAudio, 
  onNavigateToSettings, 
  activeTab,
  setActiveTab,
  memoryTab,
  setMemoryTab,
  sampleText,
  setSampleText,
  onForceUpdate // <--- 加在这里！
}: any) => {
  // ==================== [状态修复] 把多选相关的状态放回这里！ ====================
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  // 这是一组什么代码：这是控制“高级警告”弹窗的两个开关。

  const [selectedMemIds, setSelectedMemIds] = useState<string[]>([]);
  const [viewingTag, setViewingTag] = useState<any>(null);
 const [impressionFilter, setImpressionFilter] = useState<'all' | 'favorites'>('all');
                const [isMultiSelectSave, setIsMultiSelectSave] = useState(false);
                const [selectedTagIdsForSave, setSelectedTagIdsForSave] = useState<string[]>([]);
                const boardRef = useRef<HTMLDivElement>(null);

                const handleToggleFavorite = (tagId: string) => {
                    setContacts(prev => prev.map(c => {
                        if (c.id === contact.id) {
                            return {
                                ...c,
                                aiTagsForUser: (c.aiTagsForUser || []).map(tag => 
                                    tag.id === tagId ? { ...tag, isFavorite: !tag.isFavorite } : tag
                                )
                            };
                        }
                        return c;
                    }));
                };

                const handleToggleSelectForSave = (tagId: string) => {
                    setSelectedTagIdsForSave(prev => 
                        prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
                    );
                };
                
                // ★★★ 核心功能：【魔法】保存为图片 (100%稳定版) ★★★
                const handleSaveAsImage = async (targetRef: React.RefObject<HTMLDivElement>, fileName: string) => {
                    if (!targetRef.current) return alert("错误：找不到要截图的元素。");
                    
                    try {
                        const canvas = await html2canvas(targetRef.current, {
                            backgroundColor: null,
                            useCORS: true,
                            scale: 2
                        });
                        const image = canvas.toDataURL('image/png');
                        
                        const link = document.createElement('a');
                        link.href = image;
                        link.download = `${fileName}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } catch (error) {
                        console.error("图片保存失败:", error);
                        alert("图片保存失败，请确保已安装 html2canvas 并检查控制台。");
                    }
                };
                
                // 【魔法】多选导出 (100%稳定版)
                const handleSaveSelectedAsImage = async () => {
                    if (selectedTagIdsForSave.length === 0) return;
                    
                    const tempContainer = document.createElement('div');
                    tempContainer.style.position = 'absolute';
                    tempContainer.style.left = '-9999px';
                    tempContainer.style.top = '0';
                    tempContainer.style.padding = '20px';
                    tempContainer.style.display = 'flex';
                    tempContainer.style.flexWrap = 'wrap';
                    tempContainer.style.gap = '20px';
                    tempContainer.style.width = '800px';
                    
                    selectedTagIdsForSave.forEach(id => {
                        const originalElement = document.getElementById(`impression-tag-${id}`);
                        if (originalElement) {
                            const clonedNode = originalElement.cloneNode(true) as HTMLElement;
                            clonedNode.querySelector('.selection-overlay')?.remove();
                            clonedNode.querySelector('.favorite-button')?.remove();
                            tempContainer.appendChild(clonedNode);
                        }
                    });

                    document.body.appendChild(tempContainer);
                    
                    try {
                        const canvas = await html2canvas(tempContainer, { scale: 2 });
                        const image = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.href = image;
                        link.download = `${contact.name}_selected_impressions.png`;
                        link.click();
                    } catch(e) {
                        alert("多选导出失败！");
                    } finally {
                        document.body.removeChild(tempContainer);
                        setIsMultiSelectSave(false);
                        setSelectedTagIdsForSave([]);
                    }
                };

// 这是一组代码：【ChatApp.tsx】为 PersonaPanel 添加新状态和新函数
  // ★★★ 新增：控制新建标签弹窗 ★★★
  const [showTagCreate, setShowTagCreate] = useState(false);
// ★★★ 新增：控制规则说明弹窗 ★★★
  const [showPointRules, setShowPointRules] = useState(false);
// ★★★ 新增：刷新加载状态 ★★★
// ★★★ 状态管理：控制全局刷新动画（用于“印象集”） ★★★
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 【ChatApp.tsx 更新：私密标签不通知 + 生成乱序参数】
  const handleTagSubmit = (data: { content: string; isPublic: boolean; note: string }) => {
     const timestamp = Date.now();
     
     // ★★★ 生成乱序样式数据 ★★★
     // 旋转角度：-15度 到 15度
     const randomRotation = Math.floor(Math.random() * 30) - 15; 
     // 顶部偏移：0px 到 30px (制造高低错落感)
     const randomMargin = Math.floor(Math.random() * 30); 

     const newTag: UserTag = {
        id: timestamp.toString(),
        content: data.content,
        timestamp: timestamp,
        note: data.note,
        author: 'user',
        isPublic: data.isPublic,
        isUnlocked: true,
        // 保存这些乱序数据
        rotation: randomRotation, 
        strength: randomMargin, // 借用 strength 字段存 margin，或者你在 UserTag 类型里加一个 style 字段也可以，这里暂用 strength 存 margin
        userQuote: '', 
        aiReasoning: '' 
     };

     setContacts((prev: any) => prev.map((c: any) => {
        if (c.id === contact.id) {
            let newHistory = [...c.history];
            
            // ★★★ 核心修复：只有 isPublic 为 true 时，才发系统通知！ ★★★
            if (data.isPublic) {
                newHistory.push({
                    id: "sys_tag_" + timestamp,
                    role: 'system',
                    content: `【系统通知】用户给你贴了一个新标签：[${data.content}]${data.note ? `\n备注：“${data.note}”` : ''}`,
                    timestamp: timestamp,
                    type: 'text'
                });
            }
            
            const currentUserTags = Array.isArray(c.userTags) ? c.userTags : [];
            return { ...c, userTags: [...currentUserTags, newTag], history: newHistory };
        }
        return c;
     }));
     
     setShowTagCreate(false);
  };


  

// ★★★ 新增：解锁印象标签的逻辑 ★★★
  const handleUnlockImpression = (tagId: string) => {
    // 1. 检查钱够不够
    const currentPoints = contact.interventionPoints || 0;
    if (currentPoints < 1) {
      alert("解锁失败：你的介入点数不足 (需要 1 点)！\n\n多聊几句，或者等待每日恢复吧~");
      return;
    }

    // 2. 扣费并解锁
    if (confirm(`🔓 确定消耗 1 个点数，查看 ${contact.name} 对你的这条印象吗？`)) {
      setContacts((prev: any) => prev.map((c: any) => {
        if (c.id === contact.id) {
          return {
            ...c,
            interventionPoints: c.interventionPoints - 1, // 扣费
            aiTagsForUser: (c.aiTagsForUser || []).map((t: any) => 
              t.id === tagId ? { ...t, isUnlocked: true } : t // 标记为已解锁
            )
          };
        }
        return c;
      }));
    }
  };


















  // 处理解锁标签
  const handleUnlockTag = (tag: any) => {
      const cost = tag.unlockCost || 50;
      const currentPoints = contact.interventionPoints || 0;

      if (currentPoints < cost) {
          alert(`点数不足！\n需要: ${cost}\n拥有: ${currentPoints}`);
          return;
      }

      if (confirm(`🔓 解锁这个私密印象需要消耗 ${cost} 点数。\n(当前拥有: ${currentPoints})\n\n确定解锁吗？`)) {
          setContacts((prev: any) => prev.map((c: any) => {
              if (c.id === contact.id) {
                  const currentAiTags = Array.isArray(c.aiTagsForUser) ? c.aiTagsForUser : [];
                  return {
                      ...c,
                      interventionPoints: c.interventionPoints - cost,
                      aiTagsForUser: currentAiTags.map((t: any) => 
                          t.id === tag.id ? { ...t, isUnlocked: true } : t
                      )
                  };
              }
              return c;
          }));
          alert("解锁成功！终于看到了TA的真实想法...");
      }
  };





  // --- 辅助函数也放回来 ---
  const toggleSelect = (id: string) => {
    setSelectedMemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  // ==================== [修复结束] ====================



  // ★★★ 核心修复：正确读取新的 mood 结构 ★★★
  const mood = contact?.mood || { current: "Calm" };
  // 优先读取新的 energy 对象，没有则兜底
  const energy = mood.energy || { current: 50, max: 100, status: 'Awake' };
  
  const longTermMemories = contact?.longTermMemories || [];
  const hef = contact?.hef || {};
  const iv = hef.INDIVIDUAL_VARIATION || {};
  const big5 = iv.personality_big5 || { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };












// ==================== [修复版] 手账档案条目UI (修复Key重复警告) ====================
// ==================== [优化版] 手账档案条目UI (强化证据显示) ====================
const TraitItem: React.FC<{ label: string; traits?: any[]; icon: string; isInitiallyOpen?: boolean }> = ({ label, traits, icon, isInitiallyOpen = false }) => {
  if (!traits || traits.length === 0) return null;
  
  const formatDate = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return "未知日期";
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <details open={isInitiallyOpen} className="bg-white/60 border border-gray-200/50 rounded-xl group transition-all duration-300 open:shadow-lg open:bg-white/80 mb-2 last:mb-0">
      <summary className="px-4 py-3 text-sm font-bold text-gray-700 select-none cursor-pointer list-none flex items-center justify-between group-open:border-b">
        <span className="flex items-center gap-2">{icon} {label}</span>
        <span className="text-xs text-gray-400 transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="p-3 space-y-3">
        {traits.map((trait, index) => (
          <div key={`${trait.timestamp}-${index}`} className="bg-gray-50/70 p-3 rounded-lg border border-gray-100">
            {/* 特征值 */}
            <div className="flex items-center gap-2 mb-2">
               <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
               <p className="text-sm font-black text-gray-800">{trait.value}</p>
            </div>
            
            {/* ★★★ 核心修改：原文引用区域 (强调显示) ★★★ */}
            {trait.quote && (
                <div className="bg-white p-2 rounded border border-dashed border-purple-200 ml-2 relative">
                    <span className="absolute -top-2 left-2 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">证据</span>
                    <p className="text-xs text-gray-500 italic leading-relaxed pt-1">
                        “{trait.quote}”
                    </p>
                    <p className="text-[9px] text-gray-300 text-right mt-1">
                        — 记录于 {formatDate(trait.timestamp)}
                    </p>
                </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
};















  const resetMultiSelect = () => {
    setIsMultiSelect(false);
    setSelectedMemIds([]);
  };










  // ★★★ 新增：手动多选合并功能（真正实现！）★★★
  const handleMultiMerge = async () => {
    if (selectedMemIds.length < 2) return;
    
    const confirmed = confirm(`确定将选中的 ${selectedMemIds.length} 张便签合并为 1 张核心记忆吗？\n旧便签将被删除，此操作不可撤销！`);
    if (!confirmed) return;

    const selectedMems = longTermMemories.filter((m: any) => selectedMemIds.includes(m.id));
    const memoryContent = selectedMems.map((mem: any) => `- ${mem.content}`).join('\n');

    const activePreset = globalSettings.apiPresets?.find((p: any) => p.id === globalSettings.activePresetId);
    if (!activePreset) {
      alert("API 预设未找到，请检查设置！");
      return;
    }

    alert("AI 正在精炼选中的记忆，请稍候...");
    
    try {
      const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = `
你就是角色“${contact.name}”。请将以下选中的 ${selectedMemIds.length} 张长期记忆精炼整合成 1 条更连贯的核心记忆摘要。

要求：
1. 使用第一人称（“我”）视角。
2. 保留关键事件、情感变化、决定和计划。
3. 长度控制在 120 字左右。
4. 输出纯文本，不要任何 JSON 或额外说明。

待精炼记忆：
${memoryContent}

今天是：${today}
      `;

      const refinedSummary = await generateResponse([{ role: 'user', content: prompt }], activePreset);

      if (!refinedSummary?.trim()) throw new Error("AI 返回空内容");

      const newCoreMem = {
        id: Date.now().toString(),
        content: refinedSummary.trim(),
        date: new Date().toLocaleDateString(),
        importance: 10,
        meta: { source: 'multi-merge' }
      };

      // 删除旧的，添加新的
      setContacts((prev: any) => prev.map((c: any) =>
        c.id === contact.id
          ? { ...c, longTermMemories: [...c.longTermMemories.filter((m: any) => !selectedMemIds.includes(m.id)), newCoreMem] }
          : c
      ));

      alert(`成功！已将 ${selectedMemIds.length} 张便签合并为 1 张核心记忆～`);
      resetMultiSelect();
    } catch (err) {
      console.error(err);
      alert("合并失败，请检查网络或 API 设置");
    }
  };
  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center animate-fadeIn pointer-events-none">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => { onClose(); resetMultiSelect(); }} />
      <div
        className="bg-white w-full sm:w-[90%] h-[85%] sm:h-[80%] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp relative z-10 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
       {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <img src={contact?.avatar || ''} className="w-10 h-10 rounded-full border-2 border-white" alt="avatar"/>
            <div>
              <h2 className="font-bold text-lg leading-none">{contact?.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-[10px] text-gray-400">Soul Interface</p>
                {/* ★★★ 氪金按钮：点击钱币触发强行刷新 ★★★ */}
                {/* ★★★ 氪金按钮：点击打开规则说明书 ★★★ */}
                 <button 
                    onClick={() => setShowPointRules(true)}
                    className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-200 hover:bg-yellow-200 active:scale-95 transition cursor-pointer flex items-center gap-1"
                 >
                    <span>🪙</span>
                    <span>{contact.interventionPoints || 0}</span>
                 </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-100 m-4 rounded-xl">
{['emotion', 'persona', 'memory', 'agreement'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-colors duration-200 ${activeTab === t ? 'bg-white text-blue-600 shadow' : 'text-gray-400'}`}>
              {t === 'emotion' ? '❤️ 情绪' : t === 'persona' ? '🧬 人格' : t === 'memory' ? '🧠 记忆' : '📝 约定'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">






{/* 这是一组代码：【终极档案室】交互式人格面板 (含照片/录音/贴标签互动) */}
          {activeTab === 'persona' && (
            <div className="space-y-5 animate-slideUp pb-10">



           {/* // 1. 顶部：身份卡片 (ID Card Style) */}
              <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
                 {/* 装饰背景纹理 */}
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -z-10 opacity-50"></div>
                 
                 <div className="flex gap-4">
                    {/* 左侧：拍立得风格头像 */}
                    <div className="flex-shrink-0 relative">
                       <div className="w-20 h-24 bg-white border border-gray-200 shadow-md p-1 rotate-[-2deg] transition-transform group-hover:rotate-0">
                          <img src={contact.avatar} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all" alt="ID" />
                       </div>
                       {/* 别针装饰 */}
                       <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-gray-300 text-xl">📎</div>
                    </div>





                    {/* 右侧：基本信息 + 声音样本输入 */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                       <div className="flex justify-between items-start">
                           <div>
                               <h2 className="text-xl font-black text-gray-800 tracking-tight leading-none">{contact.name}</h2>
                               <p className="text-[10px] text-gray-400 font-mono mt-1 mb-2">ID: {contact.id.slice(0, 8).toUpperCase()}</p>
                           </div>
                           
                         {/* ★★★ 播放按钮 (带跳转逻辑) ★★★ */}
                           <button 
                               onClick={(e) => {
                                  e.stopPropagation();
                                  
                                  // 1. 检查 API Key
                                  if (!globalSettings.minimax?.apiKey || !globalSettings.minimax?.groupId) {
                                      // ★★★★★ 传送门入口！就是这里！ ★★★★★
                                      if (confirm("⚠️ 还没配置语音服务哦！\n\n是否【立即前往设置页】填入 API Key？")) {
                                          onClose(); // 1. 关掉面板
                                          // 2. 呼叫 App.tsx 里的 onOpenSettings 来切换页面
                                          if (onNavigateToSettings) {
                                              onNavigateToSettings(); 
                                          }
                                      }
                                      return; // 结束，不往下执行播放
                                  }

                                  // 2. 如果 Key 存在，就播放
                                  const textToPlay = (contact.voiceSampleText || "").trim() || `你好，我是${contact.name}。这是我的声音样本。`;
                                  playMessageAudio(`demo-${Date.now()}`, textToPlay);
                               }}
                               className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition active:scale-90 ${
                                   globalSettings.minimax?.apiKey ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-400'
                               }`}
                           >
                               <span className={globalSettings.minimax?.apiKey ? "ml-0.5" : ""}>▶</span>
                           </button>
                       </div>
                       
                       {/* ★★★ 输入框 (带自动保存) ★★★ */}
                       <div className="relative mt-2">
                           <input 
                               type="text" 
                               defaultValue={contact.voiceSampleText || ""}
                               placeholder="在此输入台词 (自动保存)..."
                               className="w-full text-[10px] bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-gray-600 focus:bg-white focus:border-blue-300 outline-none transition placeholder-gray-300"
                               onClick={(e) => e.stopPropagation()} 
                               onBlur={(e) => {
                                   const newText = e.target.value;
                                   if (newText !== contact.voiceSampleText) {
                                       setContacts((prev: any[]) => prev.map((c: any) => 
                                           c.id === contact.id 
                                           ? { ...c, voiceSampleText: newText } 
                                           : c
                                       ));
                                   }
                               }}
                               onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                       (e.target as HTMLInputElement).blur();
                                   }
                               }}
                           />
                       </div>
                    </div>
                 </div>
              </div>







              {/* ★★★ 印象轨迹 (你对AI的印象) ★★★ */}
              <div className="mt-4 relative">
                 <div className="flex justify-between items-end mb-2 px-1">
                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">你对TA的印象 (Tags)</h3>
                    <button onClick={() => setShowTagCreate(true)} className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold hover:bg-blue-100 transition shadow-sm">
                      + 贴新标签
                    </button>
                 </div>
{/* 【ChatApp.tsx 更新：标签错落摆放 + 点击修改删除】 */}
                 <div className="w-full bg-gray-50/50 border-y border-gray-200 h-40 relative overflow-x-auto overflow-y-hidden custom-scrollbar">
                    {/* 绳子装饰 */}
                    <div className="absolute top-4 left-0 w-[200%] h-0.5 bg-yellow-700/30 border-t border-yellow-800/20 shadow-sm z-0"></div>
                    
                    <div className="flex items-start gap-4 px-6 pt-3 min-w-max h-full">
                        {(!contact.userTags || contact.userTags.length === 0) && (
                           <div className="text-[10px] text-gray-400 italic mt-8 ml-4">
                              还没给TA贴过标签...
                           </div>
                        )}
               {/* 渲染用户贴的标签 (已修复：显示AI申请红点) */}
                        {(contact.userTags || []).map((tag: any) => {
                           const isPrivate = tag.isPublic === false; 
                           const rotation = tag.rotation || (Math.random() * 10 - 5); 
                           const marginTop = tag.strength || 0; 

                          return (
                             <div 
                                key={tag.id} 
                                className="relative group flex flex-col items-center flex-shrink-0 cursor-pointer hover:z-20 transition-all duration-300 ease-out" 
                                style={{ 
                                    transform: `rotate(${rotation}deg)`, 
                                    marginTop: `${marginTop}px`,
                                    marginLeft: '-5px',
                                    marginRight: '-5px' 
                                }} 
                                onClick={() => setViewingTag(tag)}
                             >
                                {/* 夹子 */}
                                <div className="w-2 h-4 bg-amber-700 rounded-sm mb-[-6px] z-20 shadow-md relative border-l border-white/20"></div>
                                
                                {/* 标签纸 */}
                                <div className={`relative ${isPrivate ? 'bg-purple-100 text-purple-900 border-purple-200' : 'bg-yellow-100 text-yellow-900 border-yellow-200'} border px-3 pt-3 pb-5 min-w-[70px] max-w-[110px] text-center shadow-lg transition-transform hover:scale-110 hover:rotate-0 z-10 flex flex-col justify-between min-h-[80px]`} style={{ borderRadius: "2px 2px 20px 2px" }}>
                                   
                                   {/* ★★★ 如果有申请，显示跳动的红点/问号 ★★★ */}
                                   {tag.aiRequestPending && (
                                       <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm animate-bounce z-30">
                                           ?
                                       </div>
                                   )}

                                   <span className="text-sm font-black leading-tight break-words font-sans mb-2">{tag.content}</span>
                                   <div className="mt-auto pt-2 border-t border-black/10 w-full flex justify-end"><span className="text-[9px] font-mono opacity-60 tracking-tighter">Me</span></div>
                                </div>
                             </div>
                           );
                        })}
                    </div>
                 </div>

                 {/* ★★★ 标签详情/删除弹窗 (更新版) ★★★ */}
                 {viewingTag && (
                   <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingTag(null)}>
                      <div className="bg-white w-[85%] max-w-xs rounded-2xl shadow-2xl p-5 animate-scaleIn" onClick={e => e.stopPropagation()}>
                         <div className="text-center mb-4">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{viewingTag.isPublic ? '📢 公开标签' : '🔒 私密标签'}</span>
                            <h3 className="text-2xl font-black text-gray-800 mt-1">#{viewingTag.content}</h3>
                            <p className="text-[10px] text-gray-400 font-mono mt-1">From: Me</p>
                         </div>
                         <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 mb-4">
                            <label className="text-[9px] font-bold text-yellow-700 uppercase mb-1 block">我的备注</label>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingTag.note || "无"}</p>
                         </div>
                        
                         <div className="flex gap-2">
                             {/* 删除按钮 */}
                             <button 
                                onClick={() => {
                                    if(confirm("确定撕掉这个标签吗？")) {
                                        setContacts((prev: any) => prev.map((c: any) => 
                                            c.id === contact.id 
                                            ? { ...c, userTags: c.userTags.filter((t: any) => t.id !== viewingTag.id) } 
                                            : c
                                        ));
                                        setViewingTag(null);
                                    }
                                }}
                                className="flex-1 bg-red-50 text-red-500 py-2 rounded-xl font-bold text-xs border border-red-100"
                             >
                                🗑️ 撕掉
                             </button>
                             <button onClick={() => setViewingTag(null)} className="flex-1 bg-gray-900 text-white py-2 rounded-xl font-bold text-xs">关闭</button>
                         </div>
                      </div>
                   </div>
                 )}







{/* 标签详情弹窗 (终极版：含申请处理 + 修改/删除/公开 三大金刚) */}
                 {viewingTag && (
                   <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingTag(null)}>
                      <div className="bg-white w-[85%] max-w-sm rounded-3xl shadow-2xl p-6 animate-scaleIn flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                         
                         {/* === 场景一：AI 正在申请查看这个私密标签 === */}
                         {viewingTag.aiRequestPending ? (
                             <div className="text-center space-y-4">
                                 <div className="text-5xl animate-bounce">🥺</div>
                                 <h3 className="text-xl font-black text-gray-800">AI 想要看这个！</h3>
                                 <p className="text-sm text-gray-500 px-4">
                                     {contact.name} 察觉到了这个私密标签的存在，并向你发起了查看申请。要给TA看吗？
                                 </p>
                                 <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 mx-4">
                                     <span className="text-xs font-bold text-purple-400 uppercase block mb-1">标签内容</span>
                                     <span className="text-lg font-black text-purple-700">#{viewingTag.content}</span>
                                 </div>
                                 
                                 <div className="flex gap-3 pt-2">
                                     <button 
                                        onClick={() => {
                                            // 拒绝：直接把 pending 状态去掉
                                            setContacts((prev: any) => prev.map((c: any) => 
                                                c.id === contact.id ? { 
                                                    ...c, 
                                                    userTags: c.userTags.map((t: any) => t.id === viewingTag.id ? { ...t, aiRequestPending: false } : t)
                                                } : c
                                            ));
                                            setViewingTag(null);
                                        }}
                                        className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200"
                                     >
                                         残忍拒绝
                                     </button>
                                     <button 
                                        onClick={() => {
                                            // 同意：转为公开 + 去掉 pending + 发系统通知
                                            const timestamp = Date.now();
                                            setContacts((prev: any) => prev.map((c: any) => {
                                                if(c.id === contact.id) {
                                                    return { 
                                                        ...c, 
                                                        userTags: c.userTags.map((t: any) => t.id === viewingTag.id ? { ...t, isPublic: true, aiRequestPending: false } : t),
                                                        history: [...c.history, {
                                                            id: "sys_reveal_" + timestamp,
                                                            role: 'system',
                                                            content: `【系统通知】你同意了 ${c.name} 的申请，标签 [${viewingTag.content}] 已公开！\n(指令: 请立刻对这个标签做出反应，就像你刚看到它一样)`,
                                                            timestamp: timestamp,
                                                            type: 'text'
                                                        }]
                                                    };
                                                }
                                                return c;
                                            }));
                                            setViewingTag(null);
                                            // 这里可以触发一次 AI 回复 (handleAiReplyTrigger)，看你的需求
                                        }}
                                        className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:bg-blue-600"
                                     >
                                         ✅ 同意并公开
                                     </button>
                                 </div>
                             </div>
                         ) : (
                             /* === 场景二：正常管理 (AI标签 或 你的标签) === */
                             <>
                                 <div className="text-center">
                                    <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded ${viewingTag.author === 'ai' ? 'bg-blue-100 text-blue-600' : (viewingTag.isPublic ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600')}`}>
                                       {viewingTag.author === 'ai' ? '🤖 AI 的印象' : (viewingTag.isPublic ? '📢 公开标签' : '🔒 私密标签')}
                                    </span>
                                    
                                    {/* 如果是编辑模式，显示输入框 */}
                                    {/* 这里为了简化，我们做成点击修改按钮后弹出 prompt，或者直接复用 TagCreationModal，但最快的方式是直接用 Prompt */}
                                    <h3 className="text-3xl font-black text-gray-800 mt-3 mb-1">#{viewingTag.content}</h3>
                                    
                                    <div className="text-xs text-gray-400 font-mono flex justify-center gap-2">
                                        <span>From: {viewingTag.author === 'ai' ? contact.name : 'Me'}</span>
                                        <span>•</span>
                                        <span>{new Date(viewingTag.timestamp).toLocaleDateString()}</span>
                                    </div>
                                 </div>

                                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase mb-2 block">
                                        {viewingTag.author === 'ai' ? 'AI Reason' : 'My Note'}
                                    </label>
                                    <p className="text-sm text-gray-700 italic">
                                       “{viewingTag.aiReasoning || viewingTag.note || "暂无备注"}”
                                    </p>
                                 </div>

                                 {/* === 你的标签：三大金刚按钮 === */}
                                 {viewingTag.author === 'user' && (
                                     <div className="grid grid-cols-3 gap-3 mt-2">
                                         {/* 1. 修改按钮 */}
                                         <button 
                                            onClick={() => {
                                                // 简单的修改逻辑：弹窗输入
                                                const newContent = prompt("修改标签内容:", viewingTag.content);
                                                const newNote = prompt("修改备注:", viewingTag.note);
                                                if (newContent !== null) {
                                                    setContacts((prev: any) => prev.map((c: any) => 
                                                        c.id === contact.id ? { 
                                                            ...c, 
                                                            userTags: c.userTags.map((t: any) => t.id === viewingTag.id ? { ...t, content: newContent || t.content, note: newNote !== null ? newNote : t.note } : t)
                                                        } : c
                                                    ));
                                                    setViewingTag(null);
                                                }
                                            }}
                                            className="flex flex-col items-center justify-center py-3 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                                         >
                                             <span className="text-xl mb-1">✏️</span>
                                             <span className="text-xs font-bold">修改</span>
                                         </button>

                                         {/* 2. 公开/私密切换按钮 */}
                                         <button 
                                            onClick={() => {
                                                const willBePublic = !viewingTag.isPublic;
                                                const timestamp = Date.now();
                                                setContacts((prev: any) => prev.map((c: any) => {
                                                    if (c.id === contact.id) {
                                                        let newHistory = [...c.history];
                                                        // 如果从私密 -> 公开，通知 AI
                                                        if (willBePublic) {
                                                            newHistory.push({
                                                                id: "sys_reveal_" + timestamp,
                                                                role: 'system',
                                                                content: `【系统通知】用户将标签 [${viewingTag.content}] 设为了公开！\n备注：${viewingTag.note || "无"}`,
                                                                timestamp: timestamp,
                                                                type: 'text'
                                                            });
                                                        }
                                                        return {
                                                            ...c,
                                                            history: newHistory,
                                                            userTags: c.userTags.map((t: any) => t.id === viewingTag.id ? { ...t, isPublic: willBePublic } : t)
                                                        };
                                                    }
                                                    return c;
                                                }));
                                                setViewingTag(null);
                                            }}
                                            className={`flex flex-col items-center justify-center py-3 rounded-2xl transition ${viewingTag.isPublic ? 'bg-purple-50 text-purple-600 hover:bg-purple-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                         >
                                             <span className="text-xl mb-1">{viewingTag.isPublic ? '🔒' : '📢'}</span>
                                             <span className="text-xs font-bold">{viewingTag.isPublic ? '转私密' : '转公开'}</span>
                                         </button>

                                         {/* 3. 摘除按钮 */}
                                         <button 
                                            onClick={() => {
                                                if(confirm("确定撕掉这个标签吗？")) {
                                                    setContacts((prev: any) => prev.map((c: any) => 
                                                        c.id === contact.id ? { ...c, userTags: c.userTags.filter((t: any) => t.id !== viewingTag.id) } : c
                                                    ));
                                                    setViewingTag(null);
                                                }
                                            }}
                                            className="flex flex-col items-center justify-center py-3 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 transition"
                                         >
                                             <span className="text-xl mb-1">🗑️</span>
                                             <span className="text-xs font-bold">摘除</span>
                                         </button>
                                     </div>
                                 )}

                                 <button onClick={() => setViewingTag(null)} className="w-full py-3 mt-2 text-gray-400 font-bold text-xs hover:text-gray-600">
                                     关闭
                                 </button>
                             </>
                         )}
                      </div>
                   </div>
                 )}

















                 
                 {/* 新建弹窗的调用 (逻辑不变) */}
                 <TagCreationModal 
                   isOpen={showTagCreate} 
                   onClose={() => setShowTagCreate(false)} 
                   onSubmit={handleTagSubmit} 
                 />
                 {/* ★★★ 规则说明弹窗 (放在这里) ★★★ */}
  {/* ★★★ 规则说明弹窗 (逻辑升级：支持 Loading) ★★★ */}

           
              </div>















              {/* 4. 详细人设 (折叠在底部) */}
              <details className="group">
                 <summary className="text-xs font-bold text-gray-400 cursor-pointer list-none flex items-center justify-center gap-2 py-2 hover:text-gray-600 transition">
                    <span>▼ 查看核心设定代码 (机密)</span>
                 </summary>
                 <div className="bg-gray-900 text-green-400 font-mono text-[10px] p-4 rounded-xl mt-2 leading-relaxed shadow-inner overflow-hidden">
                    <div className="opacity-50 mb-2 border-b border-gray-700 pb-1">CONFIDENTIAL_FILE_V1.0</div>
                    {contact?.persona}
                 </div>
              </details>

            </div>
          )}




{/* ==================== [重制版] AI 的誓约备忘录 (分层级/无打卡) ==================== */}
          {activeTab === 'agreement' && (
            <div className="animate-fadeIn h-full flex flex-col p-4 bg-gray-50/50">
              
              {/* 标题区 */}
              <div className="mb-4 text-center">
                <h4 className="text-sm font-black text-gray-700 tracking-widest uppercase">My Promises</h4>
                <p className="text-[10px] text-gray-400 mt-1"></p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-10">
                
                {(!contact.agreements || contact.agreements.filter((a: any) => a.actor === 'ai').length === 0) ? (
                   <div className="text-center text-gray-400 py-20 opacity-50">
                      <div className="text-4xl mb-2">🍃</div>
                      <p className="text-xs">风还没有吹来任何约定...</p>
                   </div>
                ) : (
                  <>
                    {/* 1. 近期事项 (Short-term) - 红色加急便签风 */}
                    {(() => {
                        const shortTerms = contact.agreements.filter((a: any) => a.actor === 'ai' && a.termType === 'short');
                        if (shortTerms.length === 0) return null;
                        return (
                            <div className="relative group">
                                <div className="absolute -left-1 top-2 bottom-2 w-1 bg-red-400 rounded-full"></div>
                                <div className="pl-4">
                                    <h5 className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1">
                                        <span>🔥</span> 近期提要 (这两天)
                                    </h5>
                                    <div className="space-y-2">
                                        {shortTerms.map((a: any) => (
                                            <div key={a.id} className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-red-200 text-sm text-gray-700 leading-relaxed relative hover:scale-[1.01] transition-transform">
                                                {/* 删除按钮 (仅悬停显示) */}
                                                <button 
                                                    onClick={() => {
                                                        if(confirm("AI: 诶？这件事不需要我记着了吗？")) {
                                                            setContacts((prev: any) => prev.map((c: any) => c.id === contact.id ? { ...c, agreements: c.agreements.filter((x: any) => x.id !== a.id) } : c));
                                                        }
                                                    }}
                                                    className="absolute top-1 right-1 text-gray-200 hover:text-red-400 p-1"
                                                >×</button>
                                                “{a.content}”
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 2. 中期计划 (Mid-term) - 蓝色手账风 */}
                    {(() => {
                        const midTerms = contact.agreements.filter((a: any) => a.actor === 'ai' && a.termType === 'mid');
                        if (midTerms.length === 0) return null;
                        return (
                            <div className="relative group">
                                <div className="absolute -left-1 top-2 bottom-2 w-1 bg-blue-400 rounded-full"></div>
                                <div className="pl-4">
                                    <h5 className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-1">
                                        <span>📅</span> 记在心上 (本月)
                                    </h5>
                                    <div className="grid gap-2">
                                        {midTerms.map((a: any) => (
                                            <div key={a.id} className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm text-blue-900 font-medium relative">
                                                 <button 
                                                    onClick={() => {
                                                        if(confirm("确定删除这条计划吗？")) {
                                                            setContacts((prev: any) => prev.map((c: any) => c.id === contact.id ? { ...c, agreements: c.agreements.filter((x: any) => x.id !== a.id) } : c));
                                                        }
                                                    }}
                                                    className="absolute top-1 right-2 text-blue-200 hover:text-blue-400"
                                                >×</button>
                                                <span className="opacity-50 mr-2">●</span> {a.content}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 3. 长期愿景 (Long-term) - 星空梦想风 */}
                    {(() => {
                        const longTerms = contact.agreements.filter((a: any) => a.actor === 'ai' && a.termType === 'long');
                        if (longTerms.length === 0) return null;
                        return (
                            <div className="relative mt-2">
                                <div className="flex items-center gap-2 mb-3 justify-center opacity-50">
                                    <div className="h-px bg-purple-200 flex-1"></div>
                                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Future & Dreams</span>
                                    <div className="h-px bg-purple-200 flex-1"></div>
                                </div>
                                <div className="space-y-3">
                                    {longTerms.map((a: any) => (
                                        <div key={a.id} className="relative group overflow-hidden bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-100 shadow-sm text-center">
                                            <div className="absolute top-0 right-0 w-10 h-10 bg-purple-100 rounded-full blur-xl -z-10"></div>
                                             <button 
                                                onClick={() => {
                                                    if(confirm("要忘记这个未来的约定吗？")) {
                                                        setContacts((prev: any) => prev.map((c: any) => c.id === contact.id ? { ...c, agreements: c.agreements.filter((x: any) => x.id !== a.id) } : c));
                                                    }
                                                }}
                                                className="absolute top-2 right-2 text-purple-200 hover:text-purple-500 opacity-0 group-hover:opacity-100 transition"
                                            >×</button>
                                            <p className="text-sm font-bold text-purple-800 italic">“ {a.content} ”</p>
                                            <p className="text-[9px] text-purple-400 mt-2 font-mono">以后...</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                  </>
                )}
              </div>
            </div>
          )}














{/* ==================== [新UI] 记忆手账 (含事件簿 & 印象集) ==================== */}
          {activeTab === 'memory' && (
            <div className="animate-fadeIn h-full flex flex-col">
              {/* --- 手账内部的标签页切换 --- */}
              <div className="flex p-1 bg-gray-100 rounded-lg mx-4 mb-4 flex-shrink-0">
                <button 
                  onClick={() => setMemoryTab('events')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${memoryTab === 'events' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  事件簿 (Events)
                </button>
                <button 
                  onClick={() => setMemoryTab('impressions')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${memoryTab === 'impressions' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}
                >
                  印象集 (Impressions)
                </button>
              </div>

              {/* --- 事件簿页面 --- */}
              {memoryTab === 'events' && (
                <div className="h-full flex flex-col px-4">
                  {/* 这里是原来“记忆面板”的所有内容，我们马上把它填回来 */}
                 <>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-gray-600">🧠 长期记忆便签墙</h4>
                      <span className="text-xs text-gray-400">{longTermMemories.length} 张便签</span>
                    </div>
                    {/* 多选控制栏 */}
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={() => { setIsMultiSelect(!isMultiSelect); if (isMultiSelect) setSelectedMemIds([]); }} className={`px-4 py-2 rounded-lg font-bold text-sm ${isMultiSelect ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {isMultiSelect ? '✓ 完成选择' : '☑️ 多选合并'}
                      </button>
                      {isMultiSelect && selectedMemIds.length >= 2 && (
                        <button onClick={handleMultiMerge} className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm shadow hover:bg-purple-600 transition">
                          🔄 合并 {selectedMemIds.length} 张
                        </button>
                      )}
                    </div>
                    {/* 便签列表 */}
                    <div className="flex-1 overflow-y-auto space-y-3 pb-20 custom-scrollbar">
                      {longTermMemories.length === 0 ? (
                        <div className="text-center text-gray-400 py-10"><span className="text-4xl mb-4 block">📝</span><p className="text-sm">还没有形成长期记忆哦</p><p className="text-xs mt-2">多聊一会儿就会自动总结啦～</p></div>
                      ) : (
                        longTermMemories.slice().reverse().map((mem: any, idx: number) => (
                          <MemoryNote key={mem.id || idx} mem={mem} idx={idx} total={longTermMemories.length} contact={contact} setContacts={setContacts} isMultiSelect={isMultiSelect} isSelected={selectedMemIds.includes(mem.id)} onToggleSelect={toggleSelect} />
                        ))
                      )}
                    </div>
                    {/* 底部一键精炼 */}
                    <div className="mt-auto pt-4 pb-4 flex-shrink-0">
                      {longTermMemories.length >= 2 && (
                        <button onClick={onRefineMemory} className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition active:scale-95">
                          🔄 精炼全部记忆
                        </button>
                      )}
                    </div>
                  </>
                </div>
              )}







  {memoryTab === 'impressions' && (() => {
                
                // ==================== [你提供的原始代码开始] ====================
                
                const profile = contact.userProfile || {};
                const themeColor = profile.themeColor || '#fdfbf7';

                // --- 装饰组件：彩色和纸胶带 ---
                const WashiTape = ({ color = "bg-rose-200", rotate = "-rotate-2", width = "w-16", top = "-top-2.5", left = "left-1/2", opacity="opacity-90" }: any) => (
                    <div className={`absolute ${top} ${left} ${width} h-4 ${color} ${rotate} shadow-sm backdrop-blur-[1px] z-20 pointer-events-none -translate-x-1/2 ${opacity}`} 
                         style={{ 
                             clipPath: "polygon(5% 0, 100% 0, 95% 100%, 0% 100%)", 
                             backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)", 
                             backgroundSize: "4px 4px" 
                         }}>
                    </div>
                );

                // --- 装饰组件：可爱贴纸 ---
                const Sticker = ({ emoji, top, left, rotate, size="text-3xl" }: any) => (
                    <div className={`absolute ${top} ${left} ${rotate} ${size} pointer-events-none drop-shadow-md z-10 opacity-90 filter contrast-125`}>
                        {emoji}
                    </div>
                );

                // --- 辅助组件：拍立得相框 (交互已修复) ---
                const PhotoFrame: React.FC<{ id: string; className: string; defaultImage: string; tapeColor?: string }> = ({ id, className, defaultImage, tapeColor }) => {
                  const currentPhoto = contact.userProfile?.[id] || defaultImage;
                  return (
                    <label className={`absolute bg-white p-2 pb-6 rounded-sm shadow-md border border-gray-100 cursor-pointer group transition-all duration-300 hover:scale-110 hover:shadow-xl ${className}`}>
                      <WashiTape color={tapeColor || "bg-yellow-200"} width="w-12" />
                      <div className="relative overflow-hidden w-full h-full bg-gray-100">
                          <img 
                            src={currentPhoto} 
                            className="w-full h-full object-cover pointer-events-none" 
                            alt={`frame-${id}`} 
                          />
                          <div className="absolute inset-0 bg-gradient-to-tr from-orange-900/10 to-transparent pointer-events-none mix-blend-multiply"></div>
                      </div>
                      <div className="absolute bottom-1 right-2 text-[8px] text-gray-400 font-serif rotate-[-3deg] opacity-70">
                          Me & You
                      </div>
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors pointer-events-none rounded-sm"></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold drop-shadow-md">
                        📸 换图
                      </div>
                      <input type="file" className="hidden" accept="image/*"
                        onClick={(e) => (e.target as any).value = null} 
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            try {
                                const base64 = await compressImage(e.target.files[0]);
                                setContacts((prev: any[]) => prev.map((c: any) => 
                                    c.id === contact.id 
                                    ? { ...c, userProfile: { ...(c.userProfile || {}), [id]: base64 } } 
                                    : c
                                ));
                            } catch(err) {
                                alert("图片处理失败，请重试");
                            }
                          }
                        }}
                      />
                    </label>
                  );
                };

                // ==================== [你提供的原始代码结束] ====================
                
                // 筛选要显示的标签
                const allTags = contact.aiTagsForUser || [];
                const filteredTags = impressionFilter === 'favorites' 
                    ? allTags.filter((tag: any) => tag.isFavorite) 
                    : allTags;

                return (
                  <div className="h-full flex flex-col relative rounded-b-2xl overflow-hidden" style={{ backgroundColor: themeColor }}>
                    

                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar z-10 relative">
                      
                      <Sticker emoji="✨" top="top-20" left="left-10" rotate="rotate-12" size="text-xl opacity-30" />
                      <Sticker emoji="🌿" top="top-40" left="-left-4" rotate="-rotate-45" size="text-6xl opacity-20" />
                      <Sticker emoji="🍪" bottom="bottom-32" right="right-4" rotate="rotate-12" size="text-4xl opacity-40" />
                      <Sticker emoji="🌸" top="top-64" right="right-8" rotate="-rotate-12" size="text-5xl opacity-30" />
                      
                      <PhotoFrame id="scattered_photo_1" className="top-4 -left-4 w-28 h-36 rotate-[-12deg] z-10" defaultImage="https://picsum.photos/200/300?random=1" tapeColor="bg-blue-300" />
                      <PhotoFrame id="scattered_photo_3" className="top-48 left-2 w-20 h-20 rotate-[-5deg] z-10" defaultImage="https://picsum.photos/250/250?random=4" tapeColor="bg-green-200" />
                      <PhotoFrame id="scattered_photo_5" className="bottom-48 -right-8 w-40 h-28 rotate-[-6deg] z-10" defaultImage="https://picsum.photos/400/200?random=6" tapeColor="bg-purple-200" />
                      
                      <div className="bg-white/95 rounded-sm shadow-xl border border-gray-200 p-6 relative flex flex-col items-center min-h-[300px] mx-2 rotate-[0.5deg] z-20">
                        <div className="absolute top-0 bottom-0 left-4 w-px border-l-2 border-dashed border-gray-300"></div>
                        <div className="absolute top-0 bottom-0 left-5 w-px border-l-red-100 opacity-50"></div>
                        <div className="absolute -top-1 -right-1 w-8 h-8 bg-gray-100 shadow-sm z-20" style={{ clipPath: "polygon(0 0, 0% 100%, 100% 100%)", background: "linear-gradient(135deg, #fff 50%, #eee 50%)" }}></div>
                        <h4 className="text-base font-black text-gray-700 mb-6 tracking-widest relative inline-block">
                           <span className="relative z-10">{contact.name} 的观察日记</span>
                           <span className="absolute bottom-1 left-0 w-full h-2 bg-yellow-200/60 -rotate-1 z-0"></span>
                        </h4>
                        <div className="relative mb-8 flex-shrink-0 z-10 group">
                            <label className="relative block w-32 h-40 bg-white p-2 pb-8 shadow-lg border border-gray-200 cursor-pointer transform -rotate-2 transition-transform hover:rotate-0 hover:scale-105">
                              <WashiTape color="bg-purple-200" width="w-20" top="-top-3" />
                              <img src={contact.userProfile?.photo || "https://picsum.photos/200/300?random=3"} className="w-full h-full object-cover filter sepia-[0.2]" alt="main profile" />
                              <input type="file" className="hidden" accept="image/*"
                                onClick={(e) => (e.target as any).value = null}
                                onChange={async (e) => { if (e.target.files?.[0]) { const base64 = await compressImage(e.target.files[0]); setContacts((prev: any[]) => prev.map((c: any) => c.id === contact.id ? { ...c, userProfile: { ...(c.userProfile || {}), photo: base64 } } : c)); } }}
                              />
                            </label>
                            <div className="absolute -bottom-4 -right-9 text-6xl rotate-90 opacity-80">✒️</div>
                        </div>
                        <div className="w-full space-y-3 relative pl-4">
                            {(!profile.personality_traits && !profile.preferences && !profile.habits) && <div className="text-center text-gray-400 py-4 font-serif italic text-xs">( 笔还在墨水瓶里蘸着... )</div>}
                            <TraitItem icon="💭" label="性格特征" traits={profile.personality_traits} />
                            <TraitItem icon="❤️" label="喜好" traits={profile.preferences?.likes} />
                            <TraitItem icon="❌" label="雷区" traits={profile.preferences?.dislikes} />
                            <TraitItem icon="🕒" label="规律" traits={profile.habits} />
                        </div>
                      </div>

                      <PhotoFrame id="scattered_photo_2" className="top-8 -right-4 w-32 h-24 rotate-[8deg] z-30" defaultImage="https://picsum.photos/300/200?random=2" tapeColor="bg-rose-300" />
                      <PhotoFrame id="scattered_photo_4" className="top-40 right-2 w-20 h-28 rotate-[10deg] z-30" defaultImage="https://picsum.photos/200/300?random=5" tapeColor="bg-orange-200" />




                    {/* --- 工具栏 --- */}

<div className="relative z-40 flex-shrink-0 p-3 bg-white/80 border-b border-gray-200 backdrop-blur-sm flex items-center justify-between gap-2">
                        {isMultiSelectSave ? (
                            <>
                                <button onClick={() => { setIsMultiSelectSave(false); setSelectedTagIdsForSave([]); }} className="text-xs font-bold text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">取消</button>
                                <span className="text-xs text-gray-400">已选 {selectedTagIdsForSave.length} 张</span>
                                <button disabled={selectedTagIdsForSave.length === 0} onClick={handleSaveSelectedAsImage} className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-50">导出选中</button>
                            </>
                        ) : (
                            <>
                                <div className="flex p-1 bg-gray-100 rounded-lg">
                                    <button onClick={() => setImpressionFilter('all')} className={`px-3 py-1 text-xs font-bold rounded-md ${impressionFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>全部</button>
                                    <button onClick={() => setImpressionFilter('favorites')} className={`px-3 py-1 text-xs font-bold rounded-md ${impressionFilter === 'favorites' ? 'bg-white shadow-sm text-rose-500' : 'text-gray-500'}`}>❤️ 收藏</button>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsMultiSelectSave(true)} className="text-xs font-bold text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">多选导出</button>
                                    <button onClick={() => handleSaveAsImage(boardRef, `${contact.name}_impressions`)} className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-sm">保存整版标签墙</button>
                                </div>
                            </>
                        )}
                    </div>

                      <div ref={boardRef} className="bg-[#e8dcca] rounded-lg shadow-inner border-[6px] border-[#d4c5b0] p-4 relative mt-6 mx-1 z-20">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-sm border border-red-700 z-20"></div>
                        <h5 className="text-xs font-bold mb-4 text-[#8b5e3c] text-center bg-[#fdfbf7]/60 inline-block px-3 py-1 rounded shadow-sm mx-auto block w-max">
                            🏷️ IMPRESSIONS
                        </h5>
                        
                        <div className="flex flex-wrap justify-center gap-4 py-2 min-h-[200px]">
                            {filteredTags.length === 0 && (
                                <div className="text-[10px] text-[#8b5e3c]/50 italic text-center w-full py-10">
                                    {impressionFilter === 'favorites' ? '还没有收藏任何印象...' : '空空如也的软木板...'}
                                </div>
                            )}
                            
                            {filteredTags.map((tag: any) => {
                              const isLocked = !tag.isUnlocked;
                              const colors = ["bg-yellow-100", "bg-pink-100", "bg-blue-100", "bg-green-100"];
                              const randomColor = colors[Math.abs(tag.content.length) % colors.length];
                              const rotation = tag.style || (Math.random()*6-3);
                              const isSelectedForSave = selectedTagIdsForSave.includes(tag.id);

                              return (
                                <div 
                                  id={`impression-tag-${tag.id}`}
                                  key={tag.id} 
                                  className={`relative group p-3 w-32 min-h-[100px] shadow-md flex flex-col transition-transform duration-300 hover:scale-110 hover:z-20 ${isLocked ? 'bg-gray-200' : randomColor}`}
                                  style={{ transform: `rotate(${rotation}deg)` }}
                                  onClick={() => {
                                      if (isMultiSelectSave) {
                                          handleToggleSelectForSave(tag.id);
                                      } else if (isLocked) {
                                          handleUnlockImpression(tag.id);
                                      }
                                  }}
                                >
                                  <div className={`selection-overlay absolute inset-0 rounded-sm transition-all duration-300 pointer-events-none ${isMultiSelectSave ? 'cursor-pointer' : ''} ${isSelectedForSave ? 'bg-blue-500/30 ring-2 ring-blue-500' : ''}`}>
                                    {isMultiSelectSave && (
                                        <div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
                                            {isSelectedForSave && <div className="w-3 h-3 bg-blue-500 rounded-full"></div>}
                                        </div>
                                    )}
                                  </div>
                                  
                                  {!isLocked && !isMultiSelectSave && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(tag.id); }}
                                        className="favorite-button absolute top-1 right-1 w-6 h-6 rounded-full bg-white/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-white"
                                      >
                                        <span className={`text-sm transition-transform ${tag.isFavorite ? 'text-rose-500 scale-125' : 'text-gray-400'}`}>❤️</span>
                                      </button>
                                  )}
                                  
                                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-3 bg-white/40 shadow-sm" style={{ clipPath: "polygon(5% 0, 95% 0, 100% 100%, 0% 100%)" }}></div>

                                  {isLocked ? (
                                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                                          <div className="text-2xl mb-1 opacity-40">🔒</div>
                                          <div className="text-[9px] font-bold text-gray-500 bg-white/50 px-2 rounded">点数解锁</div>
                                      </div>
                                  ) : (
                                      <>
        {/* ★★★ 核心修改：使用新的翻转组件替代原来的纯文本 ★★★ */}
        <TagTextFlipper content={tag.content} />

        {/* 下面的理由和日期保持不变 */}
        <div className="text-[9px] text-gray-600 leading-tight flex-1 font-handwriting opacity-90 break-words">
            {tag.aiReasoning || tag.note || "..."}
        </div>
        <div className="text-[8px] text-gray-400 text-right mt-1">
            {new Date(tag.timestamp).getDate()}日
        </div>
    </>
)}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 p-2 flex justify-center items-center gap-4 bg-white/80 border-t border-white/50 z-30 backdrop-blur-md shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                       <label className="flex flex-col items-center gap-1 cursor-pointer text-xs text-gray-600 hover:text-purple-600 transition-colors group">
                           <span className="text-xl group-hover:scale-110 transition-transform">🖼️</span><span className="text-[9px] font-bold">换桌布</span>
                           <input type="file" className="hidden" accept="image/*" onChange={async (e) => { if (e.target.files && e.target.files[0]) { const base64 = await compressImage(e.target.files[0]); setContacts((prev: any[]) => prev.map((c: any) => c.id === contact.id ? { ...c, userProfile: { ...(c.userProfile || {}), background_image: base64 } } : c)); } }}/>
                       </label>
                       <label className="flex flex-col items-center gap-1 cursor-pointer text-xs text-gray-600 hover:text-purple-600 transition-colors group">
                           <span className="w-5 h-5 rounded-full border-2 border-white shadow-md group-hover:scale-110 transition-transform" style={{ backgroundColor: contact.userProfile?.themeColor || '#fdfbf7' }}></span><span className="text-[9px] font-bold">换纸色</span>
                           <input type="color" className="absolute opacity-0" defaultValue={contact.userProfile?.themeColor || '#fdfbf7'} onChange={(e) => setContacts((prev: any[]) => prev.map((c: any) => c.id === contact.id ? { ...c, userProfile: { ...(c.userProfile || {}), themeColor: e.target.value } } : c))}/>
                       </label>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}



{/* ==================== 🛠️ [修复版] 全局弹窗挂载区 (放在这里才能全屏显示！) 🛠️ ==================== */}

          {/* 1. 规则说明弹窗 (现在无论在哪个Tab都能弹出来了！) */}

   
          <PointRuleModal 
            isOpen={showPointRules}
            currentPoints={contact.interventionPoints || 0}
            onClose={() => setShowPointRules(false)}
            onConfirm={async () => {
                setShowPointRules(false);    // 1. 关掉规则弹窗
                setIsRefreshing(true);       // 2. 开启全屏加载动画
                
                // 强制切换到印象页，让你能看到变化
                setActiveTab('memory');       
                setMemoryTab('impressions');  
                await new Promise(r => setTimeout(r, 100)); // 等待UI切换

                try {
                    // 3. ★★★ 核心修复：调用从父组件(ChatApp)传下来的 onForceUpdate 函数 ★★★
                    // 这个函数里包含了所有正确的逻辑（扣点数、调用AI、更新状态）
                    await onForceUpdate();

                } catch (e) {
                    // 父组件的 onForceUpdate 已经处理了错误弹窗，这里不用重复处理
                    console.error("刷新操作失败，错误已由父组件捕获。");
                } finally {
                    // 4. 无论如何，最后都要关闭加载动画
                    setIsRefreshing(false);
                }
            }}
          />

          {/* 2. 全屏加载遮罩 (现在是真正的全屏了，并且z-index最高) */}
          {isRefreshing && (
            <div className="absolute inset-0 z-[999] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn rounded-t-3xl sm:rounded-3xl">
                {/* 动画图标 */}
                <div className="relative mb-6 scale-125">
                   <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-4xl animate-pulse">🧠</div>
                </div>
                
                {/* 动态文字 */}
                <h3 className="text-2xl font-black text-gray-800 mb-2 tracking-widest animate-pulse">
                  正在重构印象...
                </h3>
                
                <div className="flex gap-2 mt-4">
                    <span className="text-xs text-indigo-500 font-mono bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Deep Dive</span>
                    <span className="text-xs text-purple-500 font-mono bg-purple-50 px-3 py-1 rounded-full border border-purple-100">Re-Analyzing</span>
                </div>
                
                <p className="text-xs text-gray-400 mt-8 absolute bottom-20">
                  AI 正在重新审视与你的所有回忆...
                </p>
                
                {/* 防止卡死的紧急关闭按钮 (以防万一) */}
                <button 
                  onClick={() => setIsRefreshing(false)} 
                  className="absolute top-4 right-4 text-gray-300 text-xs hover:text-gray-500 underline"
                >
                  [卡住了? 点此关闭]
                </button>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};
























// ############################################################################
// #REGION 5: 主程序入口 (ChatApp Main)
// ############################################################################

const GroupChatApp: React.FC<GroupChatAppProps> = ({
  group,
  allContacts,
  setContacts,
  globalSettings,
  setGlobalSettings,
  worldBooks = [], 
  setWorldBooks,
  onExit,
  isBackground,
  onNewMessage,

  // ★★★ 修复：在这里把它们解构出来，让组件能用 ★★★
  onOpenSettings,
  setGlobalNotification
}) => {








// =========================================================================================
  // 🧱 第 0 区：公共基础 (The Foundation) - 必须放在最上面！
  // =========================================================================================



 const contacts = allContacts;

const [view, setView] = useState<'chat' | 'settings'>('chat'); 



// 2. 核心数据计算 (直接使用传入的群组数据)
  // ★★★ 核心修改：在群聊里，当前的 activeContact 就是传入的 group！
  // 我们使用 useMemo 确保它实时更新，但如果找不到（比如被删了），就暂时用 group 兜底
  const activeContact = contacts.find(c => c.id === group.id) || group;
  
  // 为了兼容旧代码，我们需要一个假的 activeContactId
  const activeContactId = activeContact.id;

// ★★★ 修复补丁：群聊暂时不支持“跳转到消息”功能，定义为空以防止报错
  const jumpToTimestamp = null; 
  // 顺便把这几个可能缺失的变量也定义了，以防万一
  const onJumpToMessage = null;
  const onNavigateToSpace = null;



// 3. 基础 UI 状态
  const [historyLimit, setHistoryLimit] = useState(30); // 限制显示的消息条数（上拉加载用）
  const [navTab, setNavTab] = useState<'chats' | 'moments' | 'favorites'>('chats'); // 列表页底部的 Tab



// 4. 各种 Refs (系统的“眼睛”和“锚点”)
  // 这些变量不会触发重绘，但用于逻辑判断
  const chatContainerRef = useRef<HTMLDivElement>(null); // 聊天框的滚动容器
  const messagesEndRef = useRef<HTMLDivElement>(null);   // 聊天框底部的锚点
  const prevScrollHeightRef = useRef(0); // 记录上拉加载前的高度
  const prevHistoryLen = useRef(0);      // 记录之前的消息长度
  
  // 状态追踪 Refs (解决定时器读不到最新状态的问题)
  const isBackgroundRef = useRef(isBackground);       // 追踪是否在后台
  const viewRef = useRef(view);                       // 追踪当前页面
const activeContactIdRef = useRef(group.id); // ★★★ 核心修改：直接追踪群组ID


// 交互锁 Refs
  const isComposingRef = useRef(false); // 输入法是否正在拼音中
  const isJumpingRef = useRef(false);   // 是否正在执行跳转（防止自动滚动冲突）
  const isManualNav = useRef(false);    // 是否是手动点击进入（防止自动跳转冲突）
  const isLongPress = useRef(false);    // 是否触发了长按
  const longPressTimer = useRef<any>(null); // 长按计时器






























  // =========================================================================================
  // ✍️ 第 1 区：输入与发送系统 (Input & Send)
  // =========================================================================================



// 群聊新增
const [showMountPanel, setShowMountPanel] = useState(false); // 控制面板开关
const [mountedMemoryConfig, setMountedMemoryConfig] = useState<{ [id: string]: number }>({}); // 存储配置




  // --- 1.1 输入状态 ---
  const [input, setInput] = useState(""); // 输入框里的文字
  const [isTyping, setIsTyping] = useState(false); // 锁：防止 AI 正在回复时你狂点
  const [showPlusMenu, setShowPlusMenu] = useState(false); // 加号菜单开关
  const [voiceInput, setVoiceInput] = useState(""); // 语音输入框文字
  const [showVoiceInput, setShowVoiceInput] = useState(false); // 语音面板开关
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; name: string } | null>(null); // 正在引用哪条消息




// --- 1.2 核心发送函数 (用户发消息) ---
  const handleUserSend = (type: 'text' | 'voice' | 'location' = 'text', contentOverride?: string) => {
    if (!activeContact) return;
    const content = contentOverride || input;
    if (type === 'text' && !content.trim()) return;
    const isFakeImage = content.startsWith("[FakeImage]");
    let finalContent = content;
    if (replyTo) {
      finalContent = `> 引用 ${replyTo.name}: ${replyTo.content.substring(0, 15)}...\n\n${content}`;
    }
    if (type === 'voice') {
      finalContent = replyTo
        ? `> 引用 ${replyTo.name}: ${replyTo.content.substring(0, 15)}...\n\n[Voice Message] ${content}`
        : `[Voice Message] ${content}`;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalContent,
      type: isFakeImage ? 'text' : type,
      timestamp: Date.now(),
      voiceDuration: type === 'voice' ? Math.max(2, Math.round(content.replace(/\[.*?\]/g, '').trim().length / 4)) : undefined
    };

    setContacts(prev => prev.map(c => {
      if (c.id === activeContact.id) {
        // 1. 获取当前 Mood
        const currentMood = c.mood || { current: "Content", energy: { current: 80, max: 100, status: 'Awake', lastUpdate: Date.now() } };
        let newEnergy = { ...(currentMood.energy || { current: 80, max: 100, status: 'Awake', lastUpdate: Date.now() }) };
        let newMoodText = currentMood.current;

        if (newEnergy.status === 'Sleeping') {
           newEnergy.status = 'Awake'; 
           newEnergy.current = Math.max(0, newEnergy.current - 15);
           newEnergy.lastUpdate = Date.now();
           newMoodText = "被吵醒"; 
        }

        // =========================================================
        // ★★★ 核心：两个计数器同步增加 (用户回合) ★★★
        // =========================================================
        
        // 1. 积分计数器
        let totalCount = c.chatCountForPoint || 0;
        let totalPoints = c.interventionPoints || 0;
        totalCount += 1; // 用户发一条算1
        
        if (totalCount >= 100) {
            const earned = Math.floor(totalCount / 100);
            totalPoints += earned;
            totalCount = totalCount % 100;
        }

        // 2. 印象进度计数器 (完全一样的逻辑！)
        let impCount = c.impressionCount || 0;
        impCount += 1; // 用户发一条算1

        return { 
          ...c, 
          history: [...c.history, userMsg],
          mood: { ...currentMood, current: newMoodText, energy: newEnergy },
          
          chatCountForPoint: totalCount, 
          interventionPoints: totalPoints,
          impressionCount: impCount // 保存印象进度
        };
      } 
      return c;
    }));

    setInput("");
    setReplyTo(null);
    setShowPlusMenu(false);
  };

// --- 1.3 发送图片 (修复版) ---
  const handleImageSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;
    
    try {
        // 调用刚才添加在文件底部的工具函数
        const base64 = await fileToBase64(file);
        
        const imageMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: base64, // 确保这里有内容
          type: 'image',
          timestamp: Date.now()
        };

        setContacts(prev => prev.map(c => 
            c.id === activeContact.id 
            ? { ...c, history: [...c.history, imageMsg] } 
            : c
        ));
        
        setShowPlusMenu(false); // 关闭菜单
    } catch (error) {
        console.error("图片上传失败:", error);
        alert("图片处理失败，请重试");
    }
  };

  // --- 1.4 发送语音 (调用上面的 handleUserSend) ---
  const sendVoiceMessage = () => {
    if (!voiceInput.trim() || !activeContact) return;
    handleUserSend('voice', voiceInput);
    setShowVoiceInput(false);
    setVoiceInput("");
  };

  // --- 1.5 点击引用按钮 ---
  const handleReplyMessage = () => {
    if (!activeContact || !selectedMsg) return;
    setReplyTo({ id: selectedMsg.id, content: selectedMsg.content.replace(/\[.*?\]/g, ''), name: selectedMsg.role === 'user' ? activeContact.userName : activeContact.name });
    setShowMsgMenu(false); setSelectedMsg(null);
  };















// =========================================================================================
  // 🧠 第 2 区：AI 核心与逻辑 (AI Brain)
  // =========================================================================================

  // --- 2.1 AI 相关状态 ---
  const [isAiTyping, setIsAiTyping] = useState(false); 
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [loadingText, setLoadingText] = useState(""); 
  const summaryTriggeredRef = useRef<number>(0);


  // --- 2.2 辅助逻辑 (世界书 & 印象更新) ---
  // 世界书
  const findRelevantWorldBookEntries = (
    history: Message[],
    worldBooks: WorldBookCategory[],
    enabledBookNames: string[]
  ): WorldBookEntry[] => {
    // 1. ★★★ 核心修改：不再只切最后5条，而是检查传入的所有历史记录 ★★★
    // 这样只要当前对话窗口里出现过关键词，AI 就能读到设定！
    const contextText = history.map(m => m.content).join(' ').toLowerCase();

    // 2. 找出当前角色启用的世界书
    const enabledBooks = worldBooks.filter(wb => enabledBookNames.includes(wb.name));
    if (enabledBooks.length === 0) {
        return [];
    }

    const relevantEntries = new Set<WorldBookEntry>();

    // 3. 遍历所有启用的世界书
    for (const book of enabledBooks) {
        for (const entry of book.entries) {
            
            // 模式 A: 常驻/基本模式 (constant)
            // 只要这一项被标记为 constant，无论说什么，AI 都要读！
            if (entry.strategy === 'constant') {
                relevantEntries.add(entry);
                continue; 
            }

            // 模式 B: 关键词模式 (keyword)
            // 只有当 entry.keys 里的词出现在对话中时，才读取
            if (entry.keys && entry.keys.length > 0) {
                for (const key of entry.keys) {
                    if (contextText.includes(key.toLowerCase())) {
                        relevantEntries.add(entry);
                        break; // 只要命中一个关键词就够了
                    }
                }
            }
        }
    }
    
    return Array.from(relevantEntries);
 };



// 印象更新引擎 (疯狗级去重+扣费)
const updateUserProfile = async (currentContact: Contact, historySlice: any[], nextThreshold: number, isPaidRefresh = false) => {
  console.log(`[人格档案引擎] 启动！付费模式: ${isPaidRefresh}`);

  const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
  if (!activePreset) {
    throw new Error("API 预设未找到，请检查设置！");
  }

  // 1. 强力指纹生成器 (去标点、去空格、转小写，防止 "Vintage" 和 "vintage." 被当成两个)
  const generateFingerprint = (text: string): string => {
    if (typeof text !== 'string' || !text) return ''; 
    return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  };

  try {
    // ★★★ 2. 构建【全量去重指纹库】(核心修改) ★★★
    // 我们不仅要防标签重复，还要防“档案”和“标签”重复，以及“档案”内部重复
    const currentProfile = currentContact.userProfile || {};
    const existingAiTags = currentContact.aiTagsForUser || [];
    
    // 收集所有已存在的文本内容 (标签 + 特征 + 喜好 + 习惯)
    const allExistingConcepts = [
        ...existingAiTags.map(t => t.content),
        ...(currentProfile.personality_traits || []).map((t:any) => t.value),
        ...(currentProfile.preferences?.likes || []).map((t:any) => t.value),
        ...(currentProfile.preferences?.dislikes || []).map((t:any) => t.value),
        ...(currentProfile.habits || []).map((t:any) => t.value)
    ].filter(Boolean);

    // 生成指纹集合 (Set 用于 O(1) 快速查重)
    const globalFingerprints = new Set(allExistingConcepts.map(txt => generateFingerprint(txt)));
    
    // 生成给 AI 看的“禁词表” (告诉它这些绝对别再写了)
    const banListText = allExistingConcepts.join(', ');

    const profileText = JSON.stringify(currentProfile, null, 2);
    const unarchivedMessages = historySlice.filter(m => !m.isArchived);

    // 非付费且消息不足时跳过
    if (!isPaidRefresh && unarchivedMessages.length < 3) {
      console.log(`[记忆归档] 新消息不足，跳过。`);
      return Promise.resolve();
    }
    
    const chatLog = unarchivedMessages.map(m => `${m.role === 'user' ? '用户' : '我'}: ${m.content}`).join('\n');
    
    // ★★★ 3. 升级版 Prompt：引入语义查重指令 ★★★
    const systemPrompt = `
# 你的身份
你就是 "${currentContact.name}"。现在是【秘密复盘时间】，你正在偷偷写印象日记。

# 核心任务
1. **更新手账档案**: 记录用户的客观事实(喜好/雷区/习惯)。
2. **贴印象标签**: 生成 1-2 个全新的印象标签。

# ⛔️【绝对查重铁律】(违反即死机)
请仔细阅读下方的【已存在内容列表】。
**绝对禁止**生成与列表中内容**意思相近、重复、或包含关系**的新条目！
例如：如果列表中已有“喜欢猫”，你绝对不能再生成“爱猫”、“猫奴”、“养猫”。
必须挖掘**全新**的角度！如果发现全是重复的，就什么都不要写！

【已存在内容列表】: 
${banListText || "暂无"}

# 风格要求
- **客观分析**: 不要恋爱脑，像真人一样在心里碎碎念。
- **简练**: 不要写长句，提取关键词。

# 输入数据
【待分析对话】:
${chatLog}

# 输出格式 (TKV)
类型: 印象标签
内容: 笨蛋
理由: 总是问傻问题
%%
类型: 喜好
内容: 喜欢吃辣
证据: "今晚去吃火锅"
`;

    let rawResponse = await generateResponse([{ role: 'user', content: systemPrompt }], activePreset);
    
    // --- 解析器 (保持不变) ---
    const parseTKV = (text: string) => {
        const result = {
            userProfile: { personality_traits: [] as any[], preferences: { likes: [] as any[], dislikes: [] as any[] }, habits: [] as any[] },
            new_tags: [] as any[],
        };
        const entries = text.split('%%');
        for (const entryText of entries) {
            const lines = entryText.trim().split('\n');
            const entryData: { [key: string]: string } = {};
            let type = '';
            for (const line of lines) {
                const separatorIndex = line.indexOf(':');
                if (separatorIndex > -1) {
                    const key = line.substring(0, separatorIndex).trim();
                    const value = line.substring(separatorIndex + 1).trim();
                    if (key === '类型') type = value;
                    else if (key === '内容') entryData.content = value;
                    else if (key === '证据') entryData.quote = value;
                    else if (key === '理由') entryData.reason = value;
                }
            }
            const newTrait = { value: entryData.content, quote: entryData.quote, timestamp: Date.now() };
            if (entryData.content) {
                if (type === '人格特征') result.userProfile.personality_traits.push(newTrait);
                else if (type === '喜好') result.userProfile.preferences.likes.push(newTrait);
                else if (type === '雷区') result.userProfile.preferences.dislikes.push(newTrait);
                else if (type === '规律' || type === '习惯') result.userProfile.habits.push(newTrait);
            }
            if (type === '印象标签' && entryData.content) {
                result.new_tags.push({ content: entryData.content, ai_reason: entryData.reason || "..." });
            }
        }
        return result;
    };
    
    let parsedResult = parseTKV(rawResponse);
    const processedMessageIds = unarchivedMessages.map(m => m.id);

    setContacts(prev => prev.map(contactItem => {
        if (contactItem.id === currentContact.id) {
            
            // ★★★ 4. 代码层强力拦截 (Double Check) ★★★
            // 哪怕 AI 不听话生成了重复的，我们用指纹库把它过滤掉
            
            // 过滤标签
            const approvedTags = parsedResult.new_tags.filter((newTag: any) => {
                const content = newTag.content?.trim();
                if (!content) return false;
                const fp = generateFingerprint(content);
                // 如果指纹库里已经有了，直接丢弃
                if (globalFingerprints.has(fp)) {
                    console.log(`[查重拦截] 标签重复: ${content}`);
                    return false;
                }
                globalFingerprints.add(fp); // 加入指纹库，防止本次批次内自我重复
                return true;
            });

            // 构造新标签数组
            let currentAiTags = [...(contactItem.aiTagsForUser || [])];
            approvedTags.forEach((tagData: any) => {
                currentAiTags.push({
                    id: Date.now().toString() + Math.random(),
                    content: tagData.content,
                    timestamp: Date.now(),
                    style: Math.random() * 10 - 5,
                    aiReasoning: tagData.ai_reason,
                    note: tagData.ai_reason,
                    author: 'ai',
                    isPublic: false,
                    isUnlocked: Math.random() < 0.2, 
                    unlockCost: 1,
                    aiRequestPending: false
                });
            });

            // 过滤档案 (通用去重函数)
            const deduplicateAndMerge = (existing: any[] = [], incoming: any[] = []) => {
                const cleanExisting = existing || [];
                // 筛选出指纹库里没有的新条目
                const uniqueIncoming = incoming.filter(item => {
                    if(!item.value) return false;
                    const fp = generateFingerprint(item.value);
                    if (globalFingerprints.has(fp)) {
                        console.log(`[查重拦截] 档案重复: ${item.value}`);
                        return false;
                    }
                    globalFingerprints.add(fp);
                    return true;
                });
                return [...cleanExisting, ...uniqueIncoming];
            };
            
            const updatedUserProfile = { 
              ...contactItem.userProfile, 
              personality_traits: deduplicateAndMerge(contactItem.userProfile?.personality_traits, parsedResult.userProfile.personality_traits),
              preferences: {
                likes: deduplicateAndMerge(contactItem.userProfile?.preferences?.likes, parsedResult.userProfile.preferences.likes),
                dislikes: deduplicateAndMerge(contactItem.userProfile?.preferences?.dislikes, parsedResult.userProfile.preferences.dislikes)
              },
              habits: deduplicateAndMerge(contactItem.userProfile?.habits, parsedResult.userProfile.habits)
            };

            const updatedHistory = contactItem.history.map(msg => 
                processedMessageIds.includes(msg.id) ? { ...msg, isArchived: true } : msg
            );

            // 扣费逻辑
            const currentPoints = contactItem.interventionPoints || 0;
            const finalPoints = isPaidRefresh ? Math.max(0, currentPoints - 1) : currentPoints;

            return { 
                ...contactItem,
                history: updatedHistory,
                userProfile: updatedUserProfile,
                aiTagsForUser: currentAiTags,
                impressionCount: 0,
                impressionThreshold: nextThreshold,
                interventionPoints: finalPoints
            };
        } 
        return contactItem;
    }));

  } catch (e) {
    console.error("印象刷新失败", e);
    throw e;
  }
};



  // --- 2.3 记忆总结系统 ---
// 2. 自动总结 (修复 HTTP 400)
const checkAutoSummary = async (currentContact: Contact, currentHistory: Message[]) => {
    const triggerCount = currentContact.summaryTrigger || 50;
    const memories = currentContact.longTermMemories || [];
    
    const lastMemory = memories[memories.length - 1];
    const lastTimestamp = lastMemory ? (lastMemory as any).timestamp : 0;
    const unArchivedMsgs = currentHistory.filter(m => m.timestamp > lastTimestamp);
    
    if (unArchivedMsgs.length >= triggerCount) {
        console.log(`[记忆系统] 触发自动总结！未归档: ${unArchivedMsgs.length}, 阈值: ${triggerCount}`);
       
        const chunk = unArchivedMsgs; 
        const activePreset = globalSettings.apiPresets.find((p:any) => p.id === globalSettings.activePresetId);
        if(!activePreset) return;
        try {
            const historyText = chunk.map((m: Message) => {
                const sender = m.role === 'user' ? currentContact.userName : currentContact.name;
                return `${sender}: ${m.content}`;
            }).join('\n');
           
            const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
            const nextDay = new Date(Date.now() + 86400000).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
            const systemPrompt = `
# 你的任务
你就是角色“${currentContact.name}”。请你回顾一下刚才和“${currentContact.userName}”的对话，然后用【第一人称 ("我")】的口吻，总结出一段简短的、客观的、包含关键信息的记忆。
# 当前时间
- 今天是：${today}
# 核心规则
1. 【视角铁律】: 你的总结【必须】使用【主观的第一人称视角 ("我")，即角色视角，而非用户视角】来写，称用户为ta的本名。
2. 【内容核心 (最高优先级)】: 你的总结【必须】专注于以下几点：
    * 重要事件: 刚才发生了什么具体的事情？
    * 关键决定: 我们达成了什么共识或做出了什么决定？
    * 未来计划: 我们约定了什么未来的计划或待办事项？
3. 【时间转换铁律 (必须遵守)】: 如果对话中提到了相对时间（如“明天”），你【必须】结合“今天是${today}”这个信息，将其转换为【具体的公历日期】（例如：“约定了明天见面”应总结为“我们约定了${nextDay}见面”）。
4. 【风格要求】: 你的总结应该像一份备忘录，而不是一篇抒情散文。
5. 【长度铁律】: 你的总结【必须】非常简短，总长度【绝对不能超过100个字】。
6. 【输出格式】: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`{"summary": "在这里写下你以第一人称视角，总结好的核心事实与计划。"}\`
# 待总结的对话历史
${historyText}
现在，请以“${currentContact.name}”的身份，开始你的客观总结。`;
            




            // ★★★ 核心修复：role 改为 'user' ★★★
            const rawResponse = await generateResponse([{ role: 'user', content: systemPrompt }], activePreset);
            
            const match = rawResponse.match(/\{[\s\S]*\}/); 
            if (!match) throw new Error("AI未能返回有效的JSON格式。");
           
            const result = JSON.parse(match[0]);
            if (result.summary && typeof result.summary === 'string' && result.summary.trim()) {
                const newMem = {
                    id: Date.now().toString(),
                    content: result.summary.trim(),
                    importance: 5, 
                    timestamp: Date.now(),
                    meta: { source: 'auto' } 
                };
                setContacts(prev => prev.map(c =>
                    c.id === currentContact.id
                    ? { ...c, longTermMemories: [...(c.longTermMemories||[]), newMem] }
                    : c
                ));
                console.log("✅ 自动记忆便签已生成！");
            } else {
                throw new Error("AI返回了空的总结内容。");
            }
           
        } catch(e) {
            console.error("自动总结失败", e);
        }
    }
};



// 1. 全部精炼 (修复 HTTP 400)
const handleRefineMemory = async () => {
  if (!activeContact || !activeContact.longTermMemories || activeContact.longTermMemories.length < 2) {
    alert("记忆便签少于2条，还不需要精炼哦。");
    return;
  }

  const memoriesToRefine = activeContact.longTermMemories;
  const countToRefine = memoriesToRefine.length;

  const confirmed = confirm(
    `确定要精炼记忆吗？\n\n此操作会将现有的 ${countToRefine} 条记忆便签，总结成1条核心记忆。旧的便签将被替换，此操作不可撤销。`
  );
  if (!confirmed) return;

  alert("请稍候，AI正在努力回忆中...");

  const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
  if (!activePreset) {
    alert("API预设未找到，请检查设置！");
    return;
  }

  try {
    const memoryContent = memoriesToRefine.map((mem: any) => `- ${mem.content}`).join('\n');
    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `
你就是角色“${activeContact.name}”。请回顾你和“${activeContact.userName || 'User'}”的所有长期记忆，然后将它们梳理、整合并精炼成一段更加连贯、客观的核心记忆摘要。

当前时间：今天是 ${today}

要求（必须严格遵守）：
1. 使用主观的第一人称视角（“我”）来写。
2. 专注于我们共同经历的关键事件、重要决定、以及约定好的未来计划。
3. 如果记忆中提到相对时间，结合今天日期转换为具体公历日期。
4. 风格像一份清晰的个人档案或事件回顾。
5. 总长度控制在 150 字左右。
6. 输出纯文本，不要任何JSON、代码块、引号、说明或额外内容！直接输出总结文字。

待整合的记忆要点：
${memoryContent}

现在开始你的回忆梳理与精炼：`;





    // ★★★ 核心修复：role 改为 'user' ★★★
    const rawResponse = await generateResponse([{ role: 'user', content: systemPrompt }], activePreset);

    // ★★★ 超级宽容的文本提取 ★★★
    let refinedSummary = rawResponse.trim();
    refinedSummary = refinedSummary.replace(/```json/g, '').replace(/```/g, '').trim();

    // 尝试提取 JSON 中的 summary（兼容老模型）
    const jsonMatch = refinedSummary.match(/\{[\s\S]*"summary"[\s]*:[\s]*"([^"]*)"[\s\S]*\}/);
    if (jsonMatch && jsonMatch[1]) {
      refinedSummary = jsonMatch[1].trim();
    } else {
      refinedSummary = refinedSummary.replace(/^["']|["']$/g, '').trim();
    }

    if (!refinedSummary) {
      throw new Error("AI 返回了空内容，请检查模型或网络");
    }

    const finalConfirmation = confirm(`精炼完成！\n\n新核心记忆如下：\n${refinedSummary}\n\n是否确认替换旧的 ${countToRefine} 条记忆？`);
    if (!finalConfirmation) {
      alert("操作已取消，旧记忆保留。");
      return;
    }

    const newCoreMemory = {
      id: Date.now().toString(),
      content: refinedSummary,
      importance: 10,
      date: new Date().toLocaleDateString(),
      meta: { source: 'refined-all' }
    };

    handleUpdateContact({ longTermMemories: [newCoreMemory] });

    alert(`精炼成功！已将 ${countToRefine} 条记忆替换为 1 条核心记忆！`);
  } catch (error: any) {
    console.error("精炼记忆时出错:", error);
    alert(`精炼失败: ${error.message || "未知错误"}`);
  }
};



  // --- 2.4 主动消息调度 ---
const scheduleProactiveMessage = async (contact: Contact) => {
    // 0. 全局开关检查
    const config = contact.proactiveConfig || { enabled: false, minGapMinutes: 60, maxDaily: 5 };
    if (!config.enabled) return;

    // 1. 识别是否是“闹钟/约定”唤醒的 (这种必须发，不能跳过！)
    const isAlarmTriggered = contact.pendingProactive && !!contact.dueAgreementId;
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = contact.proactiveLastSent?.[today] || 0;
    
    // 2. 每日上限检查 (闹钟触发的不占额度，必须发)
    if (!isAlarmTriggered && sentToday >= config.maxDaily) {
        return;
    }

    // =================================================
    // ★★★ 核心修复：智能动机判定 (在弹窗之前先判定！) ★★★
    // =================================================
    if (!isAlarmTriggered) {
        // A. 基础概率
        let speakProbability = 0.35; 
        // B. 关系加成
        const affectionScore = contact.affectionScore || 50;
        const affectionBonus = Math.max(-0.2, (affectionScore / 100) * 0.3);
        speakProbability += affectionBonus;

        // C. 掷骰子
        const diceRoll = Math.random();
        
        // ❌ 如果骰子没过，直接静默退出！这时候用户什么都不会看到，不会有假弹窗！
        if (diceRoll > speakProbability) {
            console.log(`[主动消息] 😶 ${contact.name} 决定保持沉默 (骰子:${diceRoll.toFixed(2)} > 阈值:${speakProbability.toFixed(2)})`);
            return; 
        }
    }

    // ✅✅✅ 只有代码跑到这里，说明 AI 真的要说话了！ ✅✅✅
    // 此时再弹窗，就不会是假的了！
    setGlobalNotification({
        type: 'proactive_thinking',
        contactId: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        userName: globalSettings.userName || "User",
        userSignature: globalSettings.userSignature || ""
    });

    console.log(`[ChatApp] 准备生成主动消息: ${contact.name}`);

    // =================================================
    // 3. 准备环境数据 (保留你的原逻辑)
    // =================================================
    const dueAgreement = contact.agreements?.find(a => a.id === contact.dueAgreementId);
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const timeContext = `现在的时间是：${nowTime}。请务必根据这个时间点决定你在做什么。`;

    const recentHistory = contact.history.slice(-10).map(m => 
        `${m.role === 'user' ? 'User' : contact.name}: ${m.content}`
    ).join('\n');
    
    const lastMsg = contact.history[contact.history.length - 1];
    const minutesSinceLastMsg = lastMsg ? (Date.now() - lastMsg.timestamp) / 60000 : 99999;
    const isContinuingChat = minutesSinceLastMsg < 60;

    // =================================================
    // 4. 构建精准指令 (保留你的原逻辑)
    // =================================================
    let systemInstruction = "";

    if (dueAgreement) {
        // --- 情况 A: 约定到期 ---
        const actor = dueAgreement.actor === 'user' ? '用户' : '你(AI)';
        systemInstruction = `
【⚠️ 紧急任务：履行/监督约定】
约定内容："${dueAgreement.content}"。承诺人：${actor}。
指令：
1. 如果是用户的承诺：发消息询问用户是否做到了，或者提醒ta。
2. 如果是你的承诺：请根据约定内容履行。
3. 语气要自然，不要像个闹钟。
`;
    } else if (isContinuingChat) {
        // --- 情况 B: 延续话题 ---
        systemInstruction = `
【⚠️ 任务：延续当前话题】
距离上一条消息才过 ${Math.floor(minutesSinceLastMsg)} 分钟。
指令：不要开启新话题！针对上一条消息补充一句，或追问细节，或者发个表情包。
`;
    } else {
        // --- 情况 C: 发起新话题 ---
        systemInstruction = `
【⚠️ 任务：发起新对话】
${timeContext}
指令：
1. 不要总是问“你在干嘛”。
2. 分享你此时此刻正在做的一件具体的小事。
3. 或者发一张【FakeImage】给你看到的东西。
4. 保持简短。
`;
    }

    // =================================================
    // 5. 组装 Prompt (保留你的原逻辑)
    // =================================================
    const proactivePrompt = `
# Roleplay Instructions
You are "${contact.name}".
**Persona:** ${contact.persona}
**Time:** ${nowTime} (Very Important!)

**Recent Chat:**
${recentHistory}

**Target Instruction:**
${systemInstruction}

# Output Rules (CRITICAL)
1. **Separation**: If you want to send multiple messages, use "|||" to separate them.
2. **Images**: To send an image, use format: \`[FakeImage] description of image\`.
3. **Language**: Mimic the language style in "Recent Chat". Casual, short.
4. Output **ONLY** the message content string.
`;

    let body = "";

    try {
        const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
        if (!activePreset) {
             setGlobalNotification(null); // 如果没配置API，关掉弹窗
             return;
        }

        const generatedBody = await generateResponse([{ role: 'user', content: proactivePrompt }], activePreset);
        
        if (generatedBody && generatedBody.trim()) {
            body = generatedBody.trim().replace(/^["“'‘]|["”'’]$/g, '');
        } else {
            setGlobalNotification(null); // 如果生成失败，关掉弹窗
            return;
        }
    } catch (error) {
        console.error("主动消息生成失败:", error);
        setGlobalNotification(null); // 出错关掉弹窗
        return;
    }
    
    if (!body) {
        setGlobalNotification(null);
        return;
    }

    // 6. 切割消息
    const parts = body.split('|||'); 
    const newMessages: Message[] = parts.map((part, index) => {
        const cleanContent = part.trim();
        return {
            id: Date.now().toString() + index,
            role: 'assistant',
            content: cleanContent, 
            timestamp: Date.now() + (index * 1000), 
            type: 'text'
        };
    });

    // 7. 更新状态
    setContacts(prev => prev.map(c => {
      if (c.id === contact.id) {
          let updatedAgreements = c.agreements;
          if (dueAgreement) {
              updatedAgreements = (c.agreements || []).map(a => 
                  a.id === dueAgreement.id ? { ...a, status: 'fulfilled' } : a
              );
          }
          const newSentCount = isAlarmTriggered ? sentToday : sentToday + 1;

          return { 
             ...c, 
             history: [...c.history, ...newMessages], 
             pendingProactive: false, 
             dueAgreementId: undefined, 
             agreements: updatedAgreements,
             proactiveLastSent: { ...c.proactiveLastSent, [today]: newSentCount }, 
             unread: (c.unread || 0) + newMessages.length 
          };
      }
      return c;
    }));

    // ★★★ 生成成功，把弹窗改成“新消息通知” ★★★
    // 这样你就知道它是真的发出来了
    setGlobalNotification({
        type: 'new_message',
        contactId: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        content: newMessages[0].content, // 显示第一条内容
        userName: globalSettings.userName || "User",
        userSignature: globalSettings.userSignature || ""
    });
    
    // 5秒后自动消失
    setTimeout(() => setGlobalNotification(null), 5000);
};



// --- 2.5 ★★★ 核心回复逻辑 (最终修复版：增加暴力拆解器) ★★★ ---
  const handleAiReplyTrigger = async (historyOverride?: Message[], isForceWakeUp = false) => {
    
    // 0. DND 拦截器
    if (activeContact && activeContact.aiDND?.enabled && !isForceWakeUp) {
        const now = Date.now();
        if (now < activeContact.aiDND.until) {
            if (Math.random() < 0.9) {
                console.log("🛑 DND 生效：拦截 API 请求");
                setTimeout(() => {
                    setContacts(prev => prev.map(c => {
                        if (c.id === activeContact.id) {
                            const dndMsg: Message = {
                                id: `dnd_${Date.now()}`,
                                role: 'system',
                                content: `[DND_BLOCK] ${activeContact.aiDND.reason || "休息"}`,
                                timestamp: Date.now(),
                                type: 'text'
                            };
                            return { ...c, history: [...c.history, dndMsg] };
                        }
                        return c;
                    }));
                    setIsAiTyping(false); 
                    setIsTyping(false);
                }, 500);
                return; 
            }
        }
    }

    // 1. 基础安全检查
    if (!activeContact || !Array.isArray(activeContact.history)) {
        console.error("Critical Error: activeContact or history is invalid");
        setIsTyping(false);
        setIsAiTyping(false);
        return;
    }
    
    if (isTyping && !historyOverride) return;

    // 2. 状态锁定
    setIsAiTyping(true);
    setIsTyping(true);
      
    try {
      const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
      if (!activePreset) {
        alert("错误：API 预设未找到");
        return;
      }

      // 3. 准备基础变量
      const now = Date.now();
      const aiTimezone = activeContact.timezone || "Asia/Seoul";
      const currentHistory = Array.isArray(historyOverride) ? historyOverride : (activeContact.history || []);

      // ==================== 🌍 [世界书] ====================
      const relevantLore = findRelevantWorldBookEntries(currentHistory, worldBooks, activeContact.enabledWorldBooks || []);
      const loreText = relevantLore.map(e => `- ${e.keys.join(', ')}: ${e.content}`).join('\n');

      // ==================== ⏰ [时间感知] ====================
      const nowTimeObj = new Date();
      const aiTimeString = nowTimeObj.toLocaleString('en-US', { timeZone: aiTimezone });
      const aiDate = new Date(aiTimeString);
      const currentHour = aiDate.getHours();
      const strictTimeStr = aiDate.toLocaleString('zh-CN', { hour12: false }); 

      let holidayPatch = "";
      if (currentHour >= 23 || currentHour <= 4) {
          holidayPatch = `【💤 生理钟】现在是深夜，表现出困意。`;
      } else if (currentHour >= 6 && currentHour <= 9) {
          holidayPatch = `【☀️ 早晨】刚睡醒或吃早餐。`;
      }

      let gapDescription = "新对话";
      const lastMsg = currentHistory[currentHistory.length - 1];
      if (lastMsg) {
          const diffMinutes = Math.floor((now - lastMsg.timestamp) / 60000);
          if (diffMinutes < 2) gapDescription = "刚刚 (秒回)";
          else if (diffMinutes < 60) gapDescription = `${diffMinutes}分钟前`;
          else if (diffMinutes < 1440) gapDescription = `${Math.floor(diffMinutes/60)}小时前`;
          else gapDescription = "很久之前";
      }

      // ==================== 🎭 [极简全息档案] ====================
      const memberIds = group.members || [];
      const uniqueMemberIds = Array.from(new Set([...memberIds])).filter(id => id !== group.id);
      const fullMembersData = allContacts.filter(c => uniqueMemberIds.includes(c.id));

      const memberInstructions = fullMembersData.map(member => `
### 🎭 角色: 【${member.name}】
- **📜 设定**: ${member.persona || "无设定"}
`).join('\n\n----------------\n\n');

      // ==================== 📝 [System Prompt - 终极格式锁] ====================
      const systemPrompt = `
# 核心任务：模拟群聊 (Backend Engine)
你是一个群聊生成引擎。你需要根据语境，决定哪些群成员会发言。

# 👥 【成员列表】(只能扮演这些!)
${memberInstructions}

# 🌍 【知识库】
${loreText || "暂无特殊设定"}

# ⏰ 【环境】
- 时间: ${strictTimeStr}
- 语境: ${gapDescription}

# ⚠️ 绝对输出规则 (CRITICAL)
1. **优先使用 JSON 数组格式**。
2. 如果做不到 JSON，**必须**使用严格的脚本格式换行，格式为：\`[名字]: 内容\`。
3. **不要**把所有人的话写在同一行！
4. **不要**加任何解释性文字。
5. **绝对绝对绝对不要**使用markdown格式
6. **每个成员的话可以分为多个气泡！！不要全部挤在一个气泡里！！！！**：例如a发4个，b发2个，然后a又发了俩，c也来发了3，然后b又发了2，这样随机的感觉！
7. **不要刻意让所有群成员说话**：根据人设来回答对应的问题和话题！！！！

# ✅ 理想格式 (JSON):
[
  {"name": "Mia", "content": "哈哈哈笑死"},
  {"name": "Elio", "content": "确实"}
]

# ⚠️ 保底格式 (Script):
[Mia]: 哈哈哈笑死
[Elio]: 确实
`;

      const rawSlice = currentHistory.slice(-(activeContact.contextDepth || 20));
      
      const cleanHistorySlice = rawSlice.map((msg, index) => {
          const isImage = msg.type === 'image' || (msg.content && msg.content.startsWith('data:image'));
          const role = msg.role === 'user' ? 'user' : 'assistant';
          const isRecent = index >= rawSlice.length - 2;

          if (isImage) {
             if (isRecent) {
                 return {
                     role: role,
                     content: [
                         { type: "text", text: "（发送了一张图片）" },
                         { type: "image_url", image_url: { url: msg.content } }
                     ]
                 };
             } else {
                 return { role: role, content: "[历史图片已归档]" };
             }
          }
          // 加上名字前缀，帮AI分清是谁
          const prefix = msg.name ? `[${msg.name}]: ` : '';
          return {
              role: role,
              content: prefix + msg.content.substring(0, 2000)
          };
      });

      const apiMessages = [
        { role: 'system', content: systemPrompt }, 
        ...cleanHistorySlice
      ];
      if (relevantLore.length > 0) {
          apiMessages.push({
            role: 'system',
            content: `[System: Memory Reinforcement]\n⚠️ REMEMBER LORE KEYS: ${relevantLore.map(e => e.keys[0]).join(', ')}`
          });
      }

      console.log("正在请求 API...");
      let rawResponse = await generateResponse(apiMessages, activePreset);
      
      // 7. 解析响应 (暴力拆解版)
      if (!rawResponse) rawResponse = "[]"; // 兜底

      console.log("AI 原始回复:", rawResponse); 

      let finalResp = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);
      finalResp = finalResp.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      // 修复裸奔 JSON
      if (finalResp.startsWith('{') && finalResp.endsWith('}')) {
          finalResp = `[${finalResp}]`;
      }

      let parts: any[] = [];
      try {
          // A. 尝试标准 JSON 解析
          const parsed = JSON.parse(finalResp);
          if (Array.isArray(parsed)) {
              parts = parsed.filter((item: any) => item.content).map((item: any) => {
                  let sender = fullMembersData.find(c => c.name.trim().toLowerCase() === (item.name || "").trim().toLowerCase());
                  if (!sender) sender = fullMembersData.find(c => item.name.toLowerCase().includes(c.name.toLowerCase()));
                  const senderId = sender ? sender.id : (item.name || "Unknown");
                  return { type: 'text', content: item.content, senderId: senderId, name: item.name };
              });
          } else if (parsed.content) {
              parts = [parsed];
          }
      } catch (error) {
          console.warn("⚠️ JSON解析失败，启动【暴力拆解模式】");
          
          // ==================== 🛠️ 暴力拆解器 (针对你的截图优化) ====================
          // 你的截图情况是：[Mia]: blabla [Elio]: blabla 挤在一坨
          // 策略：用正则寻找 "[Name]:" 这种锚点，然后切分
          
          // 1. 构建所有成员名字的正则 (例如: Mia|Elio|Leo|Julian|Alex)
          const validNames = fullMembersData.map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
          
          // 这个正则的意思是：匹配 "[Mia]:" 或者 "Mia:" 这种开头
          const splitRegex = new RegExp(`(\\[?(${validNames})\\]?[:：])`, 'gi');
          
          // 2. 切分字符串
          const tokens = finalResp.split(splitRegex);
          // split 的结果会是：["", "[Mia]:", "Mia", "内容...", "[Elio]:", "Elio", "内容..."]
          
          let currentName = "";
          let currentContent = "";

          for (let i = 0; i < tokens.length; i++) {
              const token = tokens[i];
              
              // 如果这一段是名字 (我们在正则里用了捕获组，所以名字会出现在数组里)
              const matchedMember = fullMembersData.find(m => m.name.toLowerCase() === token.trim().toLowerCase());

              if (matchedMember) {
                  // 如果之前已经有内容了，先保存上一条
                  if (currentName && currentContent.trim()) {
                      const sender = fullMembersData.find(c => c.name.toLowerCase() === currentName.toLowerCase());
                      parts.push({
                          type: 'text', 
                          content: currentContent.trim(), 
                          senderId: sender ? sender.id : "Unknown", 
                          name: currentName
                      });
                  }
                  // 开始新的一条
                  currentName = matchedMember.name;
                  currentContent = ""; 
                  // 跳过下一个 token，因为它是 split 产生的完整匹配串 (如 "[Mia]:")，我们不需要它，只需要名字
                  // split 机制导致 index+1 是完整匹配，index 是捕获组。这里逻辑比较绕，简化处理：
                  // 我们只要确定 currentName 变了，接下来的非名字 token 就是内容
              } else {
                  // 如果不是名字，也不是分隔符 (例如 ":")，那就是内容
                  // 过滤掉类似 "[Mia]:" 这种纯分隔符
                  const isSeparator = /^\[?.*\]?[:：]$/.test(token.trim());
                  if (!isSeparator && currentName) {
                      currentContent += token;
                  }
              }
          }
          
          // 循环结束，保存最后一条
          if (currentName && currentContent.trim()) {
              const sender = fullMembersData.find(c => c.name.toLowerCase() === currentName.toLowerCase());
              parts.push({
                  type: 'text', 
                  content: currentContent.trim(), 
                  senderId: sender ? sender.id : "Unknown", 
                  name: currentName
              });
          }

          // 如果暴力拆解也没拆出来（比如名字没匹配上），那就当做第一人说的
          if (parts.length === 0) {
              console.log("暴力拆解失败，兜底处理");
              // 尝试简单按行切分
              const lines = finalResp.split('\n');
              if (lines.length > 1) {
                  // 有换行的情况
                   lines.forEach(line => {
                       const partsOfLine = line.split(/[:：]/);
                       if (partsOfLine.length > 1) {
                           const nameCandidate = partsOfLine[0].replace(/[\[\]]/g, '').trim();
                           const contentCandidate = partsOfLine.slice(1).join(':').trim();
                           const sender = fullMembersData.find(c => c.name.toLowerCase() === nameCandidate.toLowerCase());
                           if (sender) {
                               parts.push({ type: 'text', content: contentCandidate, senderId: sender.id, name: sender.name });
                           }
                       }
                   });
              }
              
              // 还是空的，就全部给第一个人
              if (parts.length === 0) {
                  const fallbackMember = fullMembersData[0];
                  parts = [{ 
                      type: 'text', 
                      content: finalResp, 
                      senderId: fallbackMember ? fallbackMember.id : "Unknown", 
                      name: fallbackMember ? fallbackMember.name : "Unknown" 
                  }];
              }
          }
      }

      // 8. 构建消息
      const newMessages: Message[] = [];
      parts.forEach((part, index) => {
          // 清理内容里的名字前缀 (有些 AI 会把 [Mia]: 也写进 content 里)
          let cleanContent = part.content;
          if (part.name) {
              const prefixRegex = new RegExp(`^\\[?${part.name}\\]?[:：]\\s*`, 'i');
              cleanContent = cleanContent.replace(prefixRegex, '');
          }

          newMessages.push({
              id: Date.now().toString() + index,
              role: 'assistant',
              content: cleanContent,
              timestamp: Date.now() + (index * 1000),
              type: 'text',
              senderId: part.senderId,
              name: part.name
          });
      });

      // 9. 更新状态
      setContacts(prev => prev.map(c => {
        if (c.id === activeContact.id) {
            const isReading = !isBackgroundRef.current && viewRef.current === 'chat' && activeContactIdRef.current === c.id;
            
            let totalCount = c.chatCountForPoint || 0; 
            let totalPoints = c.interventionPoints || 0;
            totalCount += newMessages.length;
            if (totalCount >= 100) { totalPoints += Math.floor(totalCount / 100); totalCount %= 100; }

            return { 
                ...c, 
                history: [...currentHistory, ...newMessages], 
                unread: isReading ? 0 : (c.unread || 0) + newMessages.length,
                chatCountForPoint: totalCount,
                interventionPoints: totalPoints
            };
        }
        return c;
      }));

      if (newMessages.length > 0) {
        const lastMsg = newMessages[newMessages.length - 1];
        onNewMessage && onNewMessage(activeContact.id, activeContact.name, activeContact.avatar, lastMsg.content, activeContact.id);
      }

    } catch (error: any) {
        console.error("AI回复生成失败:", error);
        setContacts(prev => prev.map(c => {
            if (c.id === activeContact.id) {
                return { 
                    ...c, 
                    history: [...(c.history || []), {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `(系统报错: ${error.message})`,
                        timestamp: Date.now(),
                        type: 'text'
                    }] 
                };
            }
            return c;
        }));
    } finally {
      setIsTyping(false);
      setTimeout(() => setIsAiTyping(false), 500);
    }
  };


   



  // --- 2.6 重发/重Roll (依赖上面的核心函数) ---
  const handleRegenerateLast = async () => {
    if (!activeContact) return;
    
    // 1. 获取当前完整历史记录
    const fullHistory = [...activeContact.history];
    
    // 2. ★★★ 核心修复：寻找“锚点” ★★★
    // 我们要找到最后一条“不是AI”的消息（即用户消息 OR 系统提示）
    // 之前只找 'user'，导致 'system' (信件提示) 被误删。
    // 现在：只要是 user 或者 system，都视为“用户回合”，保留下来！
    let lastAnchorIndex = -1;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        if (fullHistory[i].role === 'user' || fullHistory[i].role === 'system') {
            lastAnchorIndex = i;
            break;
        }
    }
    
    if (lastAnchorIndex === -1) {
      alert("没有可以回复的消息锚点！");
      return;
    }

    // 3. 生成“干净的”历史记录：保留到锚点为止
    // 这样，你寄信的系统提示就会被保留，AI会基于它重新生成回复！
    const cleanHistory = fullHistory.slice(0, lastAnchorIndex + 1);

    // 4. 立即更新UI，让用户看到旧的AI回复瞬间消失，但系统提示还在
    setContacts(prev => prev.map(c =>
      c.id === activeContact.id ? { ...c, history: cleanHistory } : c
    ));

    // 5. 触发 AI 重新生成
    handleAiReplyTrigger(cleanHistory);
  };


  // --- 2.7 监听器：自动记忆总结触发 ---
  useEffect(() => {
      if (!activeContact || !activeContact.history) return;
      const historyLen = activeContact.history.length;
      // 只有当历史记录长度超过上次触发的长度 + 阈值时，才执行
      if (historyLen > summaryTriggeredRef.current + (activeContact.summaryTrigger || 50)) {
          console.log("[记忆系统] 阈值已到，触发自动总结...");
          summaryTriggeredRef.current = historyLen; // 更新触发点
          checkAutoSummary(activeContact, activeContact.history);
      }
  }, [activeContact?.history.length]);













// =========================================================================================
  // 🟩 第 3 区：语音播放系统 (Audio System)
  // =========================================================================================

  // --- 3.1 播放器状态 ---
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<MinimaxVoice[]>([]);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);






  // --- 3.2 进度条拖动 ---
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setAudioProgress(newTime);
    if (activeAudio) {
      activeAudio.currentTime = newTime;
    }
  };



  // --- 3.3 ★★★ 核心播放函数 (TTS) ★★★ ---
  const playMessageAudio = async (msgId: string, text: string) => {
    if (!globalSettings.minimax?.groupId || !globalSettings.minimax?.apiKey) {
      alert("请先在【系统设置】里填 Minimax Key！");
      return;
    }
    if (playingMsgId === msgId && activeAudio) {
      activeAudio.pause();
      setPlayingMsgId(null);
      setActiveAudio(null);
      setAudioProgress(0);
      setAudioDuration(0);
      return;
    }
    if (activeAudio) {
      activeAudio.pause();
      setActiveAudio(null);
    }
    try {
      setPlayingMsgId(msgId);
      setAudioProgress(0);
      setAudioDuration(0);
      let rawText = text.replace(/^>.*?\n\n/, '').replace(/^\[Voice Message\]\s*/i, '').trim();
      let cleanText = rawText
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanText && rawText.length > 0) cleanText = rawText;
      if (!cleanText) {
        alert("这句话全是动作描写或为空，没法读哦~");
        setPlayingMsgId(null);
        return;
      }
      const audioBlob = await generateMinimaxAudio({
        groupId: globalSettings.minimax.groupId,
        apiKey: globalSettings.minimax.apiKey,
        model: globalSettings.minimax.model || "speech-01",
        voiceId: activeContact?.voiceId || "female-shaonv-jingpin",
        text: cleanText,
        serviceArea: globalSettings.minimax.serviceArea
      });
      if (!audioBlob) throw new Error("语音生成失败");
      const audioUrl = URL.createObjectURL(audioBlob as Blob);
      const audio = new Audio(audioUrl);
      audio.ontimeupdate = () => {
        setAudioProgress(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setAudioDuration(audio.duration);
        }
      };
      audio.onended = () => {
        setPlayingMsgId(null);
        setActiveAudio(null);
        setAudioProgress(0);
        setAudioDuration(0);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlayingMsgId(null);
        setActiveAudio(null);
        alert("播放失败，请检查网络或Key");
      };
      await audio.play();
      setActiveAudio(audio);
    } catch (e: any) {
      console.error("播放流程出错:", e);
      setPlayingMsgId(null);
      setActiveAudio(null);
      alert(`播放失败: ${e.message}`);
    }
  };










// =========================================================================================
  // 🟦 第 4 区：界面与弹窗控制 (Interface & Modals)
  // =========================================================================================

  // --- 4.1 界面状态 (各种开关) ---
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [panelTab, setPanelTab] = useState('persona'); 
  const [memoryTab, setMemoryTab] = useState<'events' | 'impressions'>('events'); 
  const [panelSampleText, setPanelSampleText] = useState(""); 
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningLoverName, setWarningLoverName] = useState("");
  
  // 收藏夹相关
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [activeFavCategory, setActiveFavCategory] = useState("全部");
  const [showFavMenu, setShowFavMenu] = useState(false); 
  const [selectedFav, setSelectedFav] = useState<FavoriteEntry | null>(null); 

  // 其他弹窗状态
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showWorldBookModal, setShowWorldBookModal] = useState(false);
  const [tempSummary, setTempSummary] = useState("");
  const [showSongModal, setShowSongModal] = useState(false);
  const [songImportText, setSongImportText] = useState("");
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showWorldBookSelector, setShowWorldBookSelector] = useState(false);
  const [showModeConfirm, setShowModeConfirm] = useState(false); 
  const [pendingMode, setPendingMode] = useState<'concise' | 'normal' | 'verbose' | null>(null); 
  const [showDestinyQuiz, setShowDestinyQuiz] = useState(false); 
  const [destinyAnswers, setDestinyAnswers] = useState({ q1: '', q2: '' }); 

  // 设置页表单状态
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // --- 4.2 角色管理函数 (增删改) ---
// 创建角色
  const handleCreateContact = () => {
    // 1. 从 editForm (状态) 中获取新角色的名字和设定
    const newName = editForm.name || "";
    const newPersona = editForm.persona || "";

    // 2. 创建新角色对象
    const newContact: Contact = {
      id: Date.now().toString(),
      created: Date.now(),
      name: newName,
      avatar: editForm.avatar || "https://picsum.photos/200",
      persona: newPersona,
      memo: "",
      userName: editForm.userName || "",
      userAvatar: editForm.userAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User",
      userPersona: editForm.userPersona || "",
      history: [],
      summary: "",
     mood: (() => {
    const currentHour = new Date().getHours();
    let initialEnergy = 80;
    // 深夜或凌晨创建的角色，精力应该低一些
    if (currentHour >= 23 || currentHour < 6) {
      initialEnergy = Math.floor(Math.random() * 20) + 30; // 30-50 之间的随机值
    } 
    // 早晨创建的角色，精力可以是刚醒的状态
    else if (currentHour >= 6 && currentHour < 9) {
      initialEnergy = Math.floor(Math.random() * 20) + 60; // 60-80 之间
    }
    return { current: "Happy", energyLevel: initialEnergy, lastUpdate: Date.now() };
  })(),

      schedule: [],
      timezone: "Asia/Seoul",
      contextDepth: 20,
      summaryTrigger: 50,
      coupleSpaceUnlocked: false,
      enabledWorldBooks: [],
      voiceId: "female-shaonv-jingpin",

   hef: generateDefaultHEF(newName, newPersona), 
      longTermMemories: [],
      affectionScore: 50,
      relationshipStatus: 'Acquaintance',
      aiDND: { enabled: false, until: 0 },
      interventionPoints: 3,
      currentChatMode: 'Casual',
      userTags: [],

      // ★★★ 核心新增：在这里直接写入默认颜色！★★★
      bubbleColorUser: '#FBCFE8', // 淡淡的粉色 (Tailwind rose-200)
      bubbleColorAI: '#FFFFFF',   // AI 默认白色，保持干净
      chatScale: 1.0,             // 默认缩放 100%
    };
    
// 这是一行代码：为新角色设置初始 impressionThreshold (基于默认的 'normal' 模式)
impressionThreshold: Math.floor(Math.random() * (150 - 90 + 1)) + 90, // 对于 'normal' 模式 (90-150)

    
    // 3. 更新状态，进入聊天
    setContacts(prev => [...prev, newContact]);
    setActiveContactId(newContact.id);
    setView('chat');
    setEditForm({});
  };


  const handleUpdateContact = (updates: Partial<Contact>) => {
    if (!activeContact) return;
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, ...updates } : c));
  };


// 保存设置
const saveSettings = () => {
  if (!activeContact) return;
  
  // ★★★ 核心修复：不再手动添加 bubbleColor 等属性 ★★★
  // 之前的代码会把未修改的颜色(undefined)也保存进去，导致重置
  // 现在只保存 editForm 中【真正被修改】的属性，问题解决
  const currentProactiveConfig = editForm.proactiveConfig || activeContact.proactiveConfig;

  const updates = {
    ...editForm, // ← 只保留这一行，它包含了所有改动
    proactiveConfig: {
      enabled: currentProactiveConfig?.enabled ?? false,
      minGapMinutes: currentProactiveConfig?.minGapMinutes ?? 480,
      maxDaily: currentProactiveConfig?.maxDaily ?? 2
    },
    // 下面这些属性因为已经包含在 ...editForm 里，所以删掉，防止覆盖
    // bubbleColorUser: editForm.bubbleColorUser, (已删除)
    // bubbleColorAI: editForm.bubbleColorAI, (已删除)
    // bubbleFontSize: editForm.bubbleFontSize, (已删除)
    // chatScale: editForm.chatScale (已删除)
  };
  
  handleUpdateContact(updates);
  setView('chat');
  setEditForm({});
};


// 彻底重置角色数据
const handleResetCharacter = () => {
  if (!activeContact) return;

  // 1. 弹出更严厉的警告！
  const confirmation = confirm(
    `【☢️ 终极警告 ☢️】\n\n你确定要彻底重置角色 "${activeContact.name}" 吗？\n\n此操作将删除以下所有数据，且不可恢复：\n\n- 全部聊天记录\n- 全部长期记忆便签\n- 全部约定\n- 全部印象标签 (AI对你的/你对AI的)\n- 全部人格档案 (手账)\n- 所有好感度与关系状态\n\n角色将恢复到【初始创建状态】。`
  );

  // 2. 如果用户取消，就什么都不做
  if (!confirmation) {
    return;
  }

  // 3. 如果用户确认，开始重置！
  setContacts(prev => prev.map(c => {
    if (c.id === activeContact.id) {
      // 返回一个几乎全新的对象，只保留核心ID、名字、人设等基础信息
      return {
        ...c, // 保留 id, name, avatar, persona, userName, userPersona 等基础设定
        
        // ★★★ 以下是需要清空/重置的数据 ★★★
        history: [],                             // 1. 清空聊天记录
        longTermMemories: [],                    // 2. 清空长期记忆
        agreements: [],                          // 3. 清空约定
        userTags: [],                            // 4. 清空你贴的标签
        aiTagsForUser: [],                       // 5. 清空AI贴的标签
        userProfile: {},                         // 6. 清空人格档案手账
        
        // 7. 重置关系和状态
        affectionScore: 50,                      // 好感度回到初始50
        friendshipScore: 50,                     // 友谊值回到初始50
        relationshipStatus: 'Acquaintance',      // 关系回到“认识”
        isAffectionLocked: false,                // 解锁关系，可以重新校准
        interventionPoints: 3,                   // 点数清零
        chatCountForPoint: 0,                    // 计数器清零
        
        // 8. 重置其他运行时数据
        unread: 0,
        summary: "",
        diaries: [],
        questions: [],
        letters: [],
        mood: { // 重置心情和精力
            current: "Calm",
            energyLevel: 80,
            lastUpdate: Date.now(),
            energy: {
                current: 80,
                max: 100,
                status: 'Awake',
                lastUpdate: Date.now()
            }
        }
      };
    }
    return c;
  }));
  
  // 4. 给出操作完成的提示
  alert(`角色 "${activeContact.name}" 已被彻底重置。`);
};

// 删除所有聊天记录
const handleClearChat = () => {
    if (!activeContact) return;
    if (confirm("确定要清空与该角色的所有聊天记录吗？此操作不可恢复！")) {
      setContacts(prev => prev.map(c =>
        c.id === activeContact.id ? { ...c, history: [] } : c
      ));
    }
  };

const handleDeleteContact = (contactIdToDelete: string) => {
  const contactToDelete = contacts.find(c => c.id === contactIdToDelete);
  if (!contactToDelete) return;
  // confirm 已移到组件内，这里直接删除
  setContacts(prevContacts => prevContacts.filter(c => c.id !== contactIdToDelete));
  // 如果删除的是当前活跃聊天，重置并返回列表
  if (activeContactId === contactIdToDelete) {
    onExit();
    setView('list');
  }
};

const handlePinContact = (contactId: string) => {
  setContacts(prev => {
    const pinned = prev.find(c => c.id === contactId);
    if (!pinned) return prev;
    // 移到最顶部
    return [pinned, ...prev.filter(c => c.id !== contactId)];
  });
};

// 上传图片
const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, field: keyof Contact) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setEditForm(prev => ({ ...prev, [field]: base64 }));
    }
  };

// 导入角色
  const handleCardImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let json: any = null;
    if (file.name.toLowerCase().endsWith('.png')) {
      json = await readTavernPng(file);
      if (!json) {
        alert("PNG 中未找到角色数据");
        return;
      }
    } else {
      const text = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = (ev) => resolve(ev.target?.result as string);
        r.readAsText(file);
      });
      try {
        json = JSON.parse(text);
      } catch (e) {
        alert("无效的 JSON 文件");
        return;
      }
    }
    try {
      const cardData = json.data || json;
      const cardName = cardData.name || "Imported Character";
      const cardPersona = cardData.description || cardData.persona || "";
      
      let newWorldBook: WorldBookCategory | null = null;
      if (cardData.character_book?.entries) {
        const rawEntries = Array.isArray(cardData.character_book.entries)
          ? cardData.character_book.entries
          : Object.values(cardData.character_book.entries);
          
        // 导入时自动判断模式
        const entries: any[] = rawEntries.map((e: any, i: number) => {
          const isConstant = e.constant || !e.keys || e.keys.length === 0;
          return {
            id: Date.now().toString() + i,
            keys: e.keys || [],
            content: e.content || "",
            name: e.comment || `Entry ${i + 1}`,
            strategy: isConstant ? 'constant' : 'keyword'
          };
        });

        if (entries.length > 0) {
          // ★★★ 新增：世界书重名检测与自动编号 (1)(2) ★★★
          const baseBookName = `${cardName}'s Lore`;
          let uniqueBookName = baseBookName;
          let counter = 1;

          // 循环检查：如果名字已存在，就加序号，直到找到一个没用过的名字
          while (worldBooks.some(wb => wb.name === uniqueBookName)) {
             uniqueBookName = `${baseBookName} (${counter})`;
             counter++;
          }

          newWorldBook = {
            id: Date.now().toString(),
            name: uniqueBookName, // 使用生成的唯一名字
            entries,
            type: 'selective'
          };
          setWorldBooks(prev => [...prev, newWorldBook!]);
        }
      }
      
      let avatarUrl = "https://picsum.photos/200";
      if (file.name.toLowerCase().endsWith('.png')) {
        avatarUrl = await fileToBase64(file);
      } else if (cardData.avatar && cardData.avatar !== 'none') {
        avatarUrl = cardData.avatar;
      }

      // 准备 HEF 数据
      const generatedHEF = generateDefaultHEF(cardName, cardPersona);

      const newContact: Contact = {
        id: Date.now().toString(),
        created: Date.now(),
        name: cardName,
        avatar: avatarUrl,
        persona: cardPersona,
        memo: "",
        userName: globalSettings.userName || "User",
        userAvatar: globalSettings.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        userPersona: globalSettings.userPersona || "",
        history: cardData.first_mes ? [{
          id: Date.now().toString(),
          role: 'assistant',
          content: cardData.first_mes,
          timestamp: Date.now(),
          type: 'text'
        }] : [],
        summary: "",
        mood: { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
        schedule: [],
        timezone: "Asia/Seoul",
        contextDepth: 20,
        summaryTrigger: 50,
        RelationShipUnlocked: false,
        // ★★★ 关键：这里启用的是上面生成的唯一名字 ★★★
        enabledWorldBooks: newWorldBook ? [newWorldBook.name] : [],
        voiceId: "female-shaonv-jingpin",
        hef: generatedHEF, 
        longTermMemories: [],
        affectionScore: 50,
        relationshipStatus: 'Acquaintance',
        aiDND: { enabled: false, until: 0 },
        interventionPoints: 3,
        currentChatMode: 'Casual',
        userTags: []
      };

      setContacts(prev => [...prev, newContact]);
      alert(`成功导入 ${cardName}！${newWorldBook ? `\n已创建专属世界书：${newWorldBook.name}` : ''}`);
    } catch (err) {
      console.error(err);
      alert("导入失败");
    }
  };

// 多选世界书
const toggleWorldBook = (wbName: string) => {
    const currentList = editForm.enabledWorldBooks || activeContact?.enabledWorldBooks || [];
    const newList = currentList.includes(wbName)
      ? currentList.filter(n => n !== wbName)
      : [...currentList, wbName];
    setEditForm(prev => ({ ...prev, enabledWorldBooks: newList }));
  };

const handleMemorySave = () => {
    handleUpdateContact({ summary: tempSummary });
    setShowMemoryModal(false);
  };


  // --- 4.4 收藏跳转逻辑 ---
// 执行收藏跳转逻辑
  const handleJumpToFav = () => {
    if (!selectedFav || !onJumpToMessage) return;

    // 1. 确定要找的人 (优先用存的ID，没有就按名字查)
    const targetId = selectedFav.contactId || contacts.find(c => c.name === selectedFav.contactName)?.id;
    // 2. 确定跳转时间 (如果是打包，就跳到第一条)
    const targetTime = selectedFav.isPackage ? selectedFav.messages?.[0]?.timestamp : selectedFav.msg?.timestamp;

    if (targetId && targetTime) {
      // 3. 关闭菜单，发射！
      setShowFavMenu(false);
      setSelectedFav(null);
      onJumpToMessage(targetId, targetTime);
    } else {
      alert("无法跳转：找不到对应的联系人或消息记录可能已删除。");
    }
  };



















// =========================================================================================
  // 🟪 第 5 区：消息列表操作 (手指交互)
  // =========================================================================================

  // --- 5.1 交互状态 (长按/多选/编辑) ---
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null); 
  const [editContent, setEditContent] = useState(""); 







  // --- 5.2 长按手势检测 ---
// 1. 开始长按（按下手指/鼠标）
  const handleTouchStart = (msg: Message) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      // 触发长按：选中消息并弹出菜单
      setSelectedMsg(msg);
      setShowMsgMenu(true);
      // 手机震动反馈 (如果支持)
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); // 600毫秒算长按
  };


 // 2. 结束长按（松开手指/鼠标）
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };









  // --- 5.3 单条消息操作 (删除/撤回/收藏) ---
// 删除消息
const handleDeleteMessage = () => {
    if (!activeContact || !selectedMsg) return;
    if (confirm("确定删除这条消息吗？")) {
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: c.history.filter(m => m.id !== selectedMsg.id) } : c));
    }
    setShowMsgMenu(false); setSelectedMsg(null);
  };

  //  撤回消息（让 AI 感知到撤回）
  const handleWithdrawMessage = () => {
    if (!activeContact || !selectedMsg) return;
    
    if (confirm("确定撤回这条消息吗？")) {
      // 这里的策略是：不直接删除，而是把内容替换成“系统提示”，这样 AI 就知道你撤回了
      // 如果你想彻底让 AI 忘记，就直接用原来的 handleDeleteMessage 删除即可
      const withdrawText = selectedMsg.role === 'user' ? "（用户撤回了一条消息）" : "（AI 撤回了一条消息）";
      
      setContacts(prev => prev.map(c => c.id === activeContact.id ? {
         ...c, 
         history: c.history.map(m => m.id === selectedMsg.id ? { ...m, content: withdrawText, type: 'text' } : m)
      } : c));
    }
    setShowMsgMenu(false); 
    setSelectedMsg(null);
  };

// 多选消息收藏选择标签
const handleCollectMessage = () => {
    if (!activeContact || !selectedMsg) return;
    const category = prompt("请输入收藏分类 (例如: 可爱, 约定, 搞笑):", "默认");
    if (category === null) return;
    const newFav: FavoriteEntry = {
      id: Date.now().toString(),
      msg: selectedMsg,
      contactName: activeContact.name,
      // ★★★ 核心新增：保存 contactId ★★★
      contactId: activeContact.id, 
      avatar: selectedMsg.role === 'user' ? activeContact.userAvatar : activeContact.avatar,
      category: category || "默认",
      timestamp: Date.now()
    };
    setFavorites(prev => [newFav, ...prev]);
    alert(`已添加到【${newFav.category}】收藏夹！⭐`);
    setShowMsgMenu(false);
    setSelectedMsg(null);
  };








  // --- 5.4 批量操作 (多选/打包) ---
// 多选消息
const toggleMessageSelection = (msgId: string) => {
    setSelectedIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

// 删除多选消息
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`确定删除选中的 ${selectedIds.length} 条消息吗？`)) {
      setContacts(prev => prev.map(c =>
        c.id === activeContact?.id
          ? { ...c, history: c.history.filter(m => !selectedIds.includes(m.id)) }
          : c
      ));
      setIsSelectionMode(false);
      setSelectedIds([]);
    }
  };

// 多选消息收藏
const handleBatchCollect = () => {
    if (selectedIds.length === 0 || !activeContact) return;
    const selectedMessages = activeContact.history
      .filter(m => selectedIds.includes(m.id))
      .sort((a, b) => a.timestamp - b.timestamp);
    const category = prompt("给这份聊天记录起个分类标签 (如: 甜甜的日常):", "聊天记录");
    if (category === null) return;
    const newFav: FavoriteEntry = {
      id: Date.now().toString(),
      isPackage: true,
      messages: selectedMessages,
      contactName: activeContact.name,
      // ★★★ 核心新增：保存 contactId ★★★
      contactId: activeContact.id,
      avatar: activeContact.avatar,
      category: category || "聊天记录",
      timestamp: Date.now()
    };
    setFavorites(prev => [newFav, ...prev]);
    alert(`已将 ${selectedMessages.length} 条消息打包收藏！📦`);
    setIsSelectionMode(false);
    setSelectedIds([]);
  };





// ==================== ⬇️ 从这里开始完整复制替换 ⬇️ ====================

const handleBatchSaveImage = async () => {
    if (selectedIds.length === 0 || !activeContact) return;

    const btn = document.getElementById('btn-save-img'); 
    const originalText = btn ? btn.innerText : "📷 保存长图";
    if(btn) btn.innerText = "生成中...";

    try {
        // 1. 准备数据
        const selectedMessages = activeContact.history
            .filter(m => selectedIds.includes(m.id))
            .sort((a, b) => a.timestamp - b.timestamp);

        // 2. 创建一个“看不见的画板” (样式保持紧凑美观)
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            left: -9999px;
            top: 0;
            width: 400px;
            padding: 24px 16px;
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        
        if (activeContact.chatBackground) {
            container.style.backgroundImage = `url(${activeContact.chatBackground})`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
        } else {
            container.style.backgroundColor = '#f4f5f7';
            container.style.backgroundImage = 'radial-gradient(#e5e7eb 1px, transparent 1px)';
            container.style.backgroundSize = '20px 20px';
        }
        document.body.appendChild(container);

        // 3. 克隆并清洗消息气泡
        selectedMessages.forEach(msg => {
            const domId = `msg_${msg.timestamp}`;
            const originalNode = document.getElementById(domId);
            
            if (originalNode) {
                const clone = originalNode.cloneNode(true) as HTMLElement;
                
                // --- 🧼 清洗步骤 1：去掉多选勾勾 ---
                clone.querySelector('.selection-checkbox-wrapper')?.remove();

                // ####################################################################
                // ★★★ 核心修改：直接渲染原始文本 ★★★
                // ####################################################################
                // 找到气泡的内容区域
                const contentDiv = clone.querySelector('.content');
                if (contentDiv && msg.content) {
                    // 不再做任何复杂的HTML拼接，直接把原始文本塞进去！
                    contentDiv.textContent = msg.content;
                }
                // ####################################################################
                
                // 样式重置
                clone.style.transform = 'none'; 
                clone.style.animation = 'none';
                clone.style.marginLeft = '0';
                clone.style.marginRight = '0';
                
                container.appendChild(clone);
            }
        });

        // 4. 底部水印框 (保持不变)
        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px dashed #d1d5db;
        `;
        const left = document.createElement('div');
        left.innerHTML = `<div style="display:flex; align-items:center; gap:6px;"><span style="font-size:18px;">🍔</span><span style="font-weight:bold; color:#a1a1aa; font-size:9px; letter-spacing:0.5px;">HAMBURGER PHONE</span></div>`;
        const right = document.createElement('div');
        const myName = globalSettings.userName || "Me";
        const formattedDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        right.innerHTML = `<div style="font-size:10px; font-weight:bold; color:#52525b; text-align:right; margin-bottom:4px;">@${myName} & ${activeContact.name}</div><div style="font-size:8px; color:#a1a1aa; font-family:monospace; text-align:right;">${formattedDate}</div>`;
        footer.appendChild(left);
        footer.appendChild(right);
        container.appendChild(footer);

        // 5. 生成图片并下载
        const canvas = await html2canvas(container, { useCORS: true, scale: 2, backgroundColor: null });
        const link = document.createElement('a');
        link.download = `HAMBURGER_${activeContact.name}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        link.remove();

        // 6. 清理
        document.body.removeChild(container);
        setIsSelectionMode(false);
        setSelectedIds([]);
        alert("🍔 汉堡回忆已打包！");

    } catch (err) {
        console.error("生成长图失败:", err);
        alert("生成失败，请重试。");
    } finally {
        if(btn) btn.innerText = originalText;
    }
};

// ==================== ⬆️ 复制到这里结束 ⬆️ ====================


  // --- 5.5 消息编辑 (修改历史记录) ---
  // 点击“编辑”按钮，进入编辑模式
  const handleStartEdit = () => {
    if (!selectedMsg) return;
    setEditingMsgId(selectedMsg.id);
    setEditContent(selectedMsg.content); // 把旧内容填进去
    setShowMsgMenu(false); // 关闭菜单
    setSelectedMsg(null);
  };



  // 4. 保存编辑后的内容
  const handleSaveEdit = () => {
    if (!activeContact || !editingMsgId) return;
    
    // 如果改空了，提示用户
    if (!editContent.trim()) {
      alert("内容不能为空哦，不需要的话请使用删除功能。");
      return;
    }

    setContacts(prev => prev.map(c => 
      c.id === activeContact.id 
      ? {
          ...c,
          history: c.history.map(m => 
            m.id === editingMsgId 
            ? { ...m, content: editContent } // 更新内容
            : m
          )
        }
      : c
    ));
    
    // 退出编辑模式
    setEditingMsgId(null);
    setEditContent("");
  };



  // 取消编辑
  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditContent("");
  };




















  // =========================================================================================
  // ⬛️ 第 6 区：导航与滚动 (Navigation & Lifecycle)
  // =========================================================================================

  // --- 6.1 滚动状态 ---
  const [showBackToBottom, setShowBackToBottom] = useState(false);

  // --- 6.2 滚动处理函数 ---
// 上拉加载逻辑 (更灵敏 + 防抖)
const handleScrollEvents = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight } = e.currentTarget;
    
    // 改动1：只要距离顶部小于 20px 就触发，不需要严格等于 0 (防止手机端滑太快触发不了)
    if (scrollTop < 20 && activeContact && activeContact.history.length > historyLimit) {
        console.log("👆 触顶！加载更多历史记录...");
        
        // 记录加载前的高度
        prevScrollHeightRef.current = scrollHeight;
        
        // 增加显示的条数
        setHistoryLimit(prev => prev + 30);
    }
};

// 回到底部 
  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {











  // ★★★ 核心逻辑：如果正在跳转，就直接退出，什么都不做 ★★★
  if (isJumpingRef.current) {
    console.log("✋ 自动滚动被跳转暂停");
    return;
  }

  if (messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior });
  }
};


  // --- 6.3 各种副作用监听 (useEffect / useLayoutEffect) ---

  // 1. 同步 Ref 状态 (让定时器能读到最新状态)
  // (搜索: isBackgroundRef.current = isBackground)
useEffect(() => {
  isBackgroundRef.current = isBackground;
}, [isBackground]);
useEffect(() => { viewRef.current = view; }, [view]);
useEffect(() => { 
      activeContactIdRef.current = activeContactId;
      // 切换人时，重置回只看最后 30 条
      setHistoryLimit(30);
  }, [activeContactId]);






  // 2. 核心跳转逻辑 (精准定位高亮)
// 精准跳转逻辑 
  useEffect(() => {
    // 1. 如果没有跳转目标，直接不执行
    if (!jumpToTimestamp || view !== 'chat' || !activeContact) return;

    // ★★★ 核心改变：开启“历史模式”，显示按钮，禁止自动滚动 ★★★
    isJumpingRef.current = true; 
    setShowBackToBottom(true); // 让按钮显示出来

    const tryScroll = (retryCount = 0) => {
      const elementId = `msg_${jumpToTimestamp}`;
      const targetElement = document.getElementById(elementId);

      if (targetElement) {
        // 2. 执行跳转
        targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        
        // 3. 高亮一下
        targetElement.style.transition = "background-color 0.5s ease";
        targetElement.style.backgroundColor = "#fef08a"; 
        setTimeout(() => { targetElement.style.backgroundColor = "transparent"; }, 2500);

        // ★★★ 注意：这里不再自动解除锁定了！必须点按钮才解除！ ★★★

      } else {
        // 没找到，重试
        if (retryCount < 20) { 
          setTimeout(() => tryScroll(retryCount + 1), 100);
        } else {
          // 实在找不到，也要解除锁定，不然会卡住
          isJumpingRef.current = false; 
          setShowBackToBottom(false);
        }
      }
    };

    setTimeout(() => tryScroll(), 100);

    // ★★★ 修改依赖项：加上 isJumpingRef.current 的变化 ★★★
    // 这样，当 isJumpingRef 状态改变时，useEffect 会重新执行一次
    // （虽然理论上不会，但这是 React Hooks 的最佳实践）
  }, [jumpToTimestamp, view, activeContactId, isJumpingRef.current]);






  // 3. 自动滚动逻辑 (打字或新消息时滚到底)
  // (搜索: if (showBackToBottom) return;)
useEffect(() => {
    if (view !== 'chat' || !activeContact) return;

    // ★★★ 关键：如果按钮显示着 (showBackToBottom)，说明你在看旧消息，绝对不滚！★★★
    if (showBackToBottom) return;

    const currentLen = activeContact.history.length;
    
    // 只有正在打字，或者消息变多了，才滚动
    if (isAiTyping || currentLen > prevHistoryLen.current) {
        scrollToBottom('smooth');
    }

    prevHistoryLen.current = currentLen;
    
  }, [activeContact?.history.length, isAiTyping, view, showBackToBottom]);




  // 4. 强制唤醒/闹钟监听
  // 这个 useEffect 专门用来监听“闹钟”信号
  useEffect(() => {
    // 遍历所有联系人，检查有没有被闹钟标记的
    contacts.forEach(contact => {
      // 如果这个角色被标记了“约定到期”，并且我们还没有开始处理它
      if (contact.dueAgreementId && !contact.pendingProactive) {
        console.log(`[强制唤醒] 检测到 ${contact.name} 的闹钟信号，立即触发主动消息！`);
        
        // ★★★ 核心：直接调用“嘴巴”，告诉它该说话了 ★★★
        scheduleProactiveMessage(contact);
      }
    });
  }, [contacts]); // 依赖项是 [contacts]，意味着只要角色数据一变，就立刻检查





  // 6. 后台状态监听 (切后台时触发主动消息)
  // (搜索: AppState.addEventListener)
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'background' || nextState === 'inactive') {
      // App进入后台，尝试给当前聊天角色调度主动消息
      if (activeContact) {
        scheduleProactiveMessage(activeContact);
      }
    }
  });

  return () => subscription.remove();
}, [activeContact]);









  // 7. 刚进页面时的定位 (智能分流)
// ==================== 1. 刚进入页面时的定位逻辑 (智能分流版) ====================
  useLayoutEffect(() => {
    setTimeout(() => {
      // 判断条件：有跳转任务，并且【不是】手动点进来的 -> 执行跳转
      if (jumpToTimestamp && !isManualNav.current) {
          console.log("🚀 执行自动跳转定位:", jumpToTimestamp);
          const element = document.getElementById(`msg_${jumpToTimestamp}`);
          if (element) {
              element.scrollIntoView({ behavior: 'auto', block: 'center' });
              // 高亮特效
              element.style.transition = "background-color 0.5s";
              element.style.backgroundColor = "#fef08a";
              setTimeout(() => { element.style.backgroundColor = "transparent"; }, 2000);
          } else {
              scrollToBottom('auto'); // 没找到元素，兜底
          }
      } 
      // 其他情况（手动点进来的，或者根本没任务） -> 统统滚到底部
      else {
          console.log("⬇️ 正常进入(或手动覆盖)，滚到底部");
          scrollToBottom('auto');
      }
      
      // ★★★ 关键：用完之后，把手动标记重置，不影响下次操作
      isManualNav.current = false;
      
    }, 50); 
  }, [activeContactId, jumpToTimestamp, view]);




  // 8. 消除红点 (正在看时)
useEffect(() => {
    if (activeContactId && !isBackground && view === 'chat') {
      setContacts(prev => prev.map(c => c.id === activeContactId ? { ...c, unread: 0 } : c));
    }
  }, [activeContactId, isBackground, view]);







  // 9. 数据清洗兜底 (防止报错)
  useEffect(() => {
    setContacts(prev => prev.map(c => ({
      ...c,
      // 如果没有 mood，给一个默认的
      mood: c.mood || { current: "Calm", energyLevel: 50, lastUpdate: Date.now() },
      // 如果没有 hef (性格数据)，给一个默认的全 5 分
      hef: c.hef || {
        INDIVIDUAL_VARIATION: {
          personality_big5: {
            openness: 5,
            conscientiousness: 5,
            extraversion: 5,
            agreeableness: 5,
            neuroticism: 5
          }
        }
      },
      // 如果没有长期记忆数组，给一个空的
      longTermMemories: c.longTermMemories || [],
    })));
  }, []);








  // 10. 安全获取当前联系人 Ref
const activeContactRef = useRef<Contact | null>(null);

useEffect(() => {
  activeContactRef.current = contacts.find(c => c.id === activeContactId) ?? null;
}, [contacts, activeContactId]);



  // 11. 防白屏保护 (如果人没了，跳回列表)
useEffect(() => {
  if (view === 'chat' && activeContactId && !contacts.find(c => c.id === activeContactId)) {
    console.warn("当前角色已不存在，自动返回列表");
    setActiveContactId(null);
    setView('list');
  }
}, [contacts, activeContactId, view]);






















  

  







// ==================== 5.3 辅助操作函数 (Helpers) ====================

  // 时区工具函数
  const getTimezoneOffsetDiff = (userTz: string, aiTz: string): number => {
    const now = new Date();
    const parseOffset = (offsetStr: string) => {
      const match = offsetStr.match(/([+-])(\d{1,2}):?(\d{2})?/);
      if (!match) return 0;
      const hours = parseInt(match[2]);
      const minutes = match[3] ? parseInt(match[3]) : 0;
      return (match[1] === '+' ? 1 : -1) * (hours + minutes / 60);
    };
    const userOffset = new Intl.DateTimeFormat('en-US', { timeZone: userTz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(part => part.type === 'timeZoneName')?.value || 'GMT';
    const aiOffset = new Intl.DateTimeFormat('en-US', { timeZone: aiTz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(part => part.type === 'timeZoneName')?.value || 'GMT';
    return Math.round(parseOffset(aiOffset) - parseOffset(userOffset));
  };






// 当地时间
  const getLocalTime = (timezone: string): string => {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
  };





// 情侣空间邀请响应
  const handleInvitationResponse = (msgId: string, decision: 'accept' | 'reject') => {
    if (!activeContact) return;

    if (decision === 'accept') {
        // === 情况 A：你同意了！直接强行解锁！===
        
        // 1. 检查有没有重婚 (防渣男/渣女逻辑)
        const existingLover = contacts.find(c => c.RelationShipUnlocked && c.id !== activeContact.id);
        if (existingLover) {
           // 这是一组什么代码：这是用来打开我们新做的“高级警告”弹窗的指令。
setWarningLoverName(existingLover.name); // 告诉弹窗要显示谁的名字
setShowWarningModal(true); // 打开弹窗！
            return;
        }

        // 2. 直接改状态，解锁空间
        setContacts(prev => prev.map(c => {
            if (c.id === activeContact.id) {
                return {
                    ...c,
                    // ↓↓↓ 核心：直接改状态 ↓↓↓
                    invitationStatus: 'accepted', 
                    relationshipStatus: 'Honeymoon', 
                    RelationShipUnlocked: true, // 🔓 空间解锁！
                    created: Date.now(), // 纪念日设为今天
                    
                    // 把那张卡片的状态也改成已接受
                    history: c.history.map(m => 
                        m.id === msgId ? { ...m, invitationStatus: 'accepted' } as Message : m
                    )
                };
            }
            return c;
        }));

        // ★★★ 这里原本有的 setTimeout 和 handleAiReplyTrigger 已经被我删除了！ ★★★
        // 现在点击后，除了界面变红、解锁空间外，什么也不会发生，AI 绝对闭嘴。

    } else {
        // === 情况 B：你拒绝了 ===
        setContacts(prev => prev.map(c => {
            if (c.id === activeContact.id) {
                return {
                    ...c,
                    invitationStatus: 'rejected',
                    history: c.history.map(m => 
                        m.id === msgId ? { ...m, invitationStatus: 'rejected' } as Message : m
                    )
                };
            }
            return c;
        }));
    }
  };






// 用户预设选择
const PresetSelector: React.FC<{ onSelect: (preset: any) => void; globalSettings: GlobalSettings }> = ({ onSelect, globalSettings }) => {
  // 如果没有预设，显示提示信息
  if (!globalSettings?.userPresets || globalSettings.userPresets.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-400">
        暂无人设预设<br />在下方“我的描述”填好后，可保存为预设
      </div>
    );
  }

  // ★★★ 补全：如果有预设，渲染一个可点击的预设列表 ★★★
  return (
    <div className="bg-gray-50 p-3 rounded-xl border">
       <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
         Load Persona Preset
       </label>
       <div className="flex flex-wrap gap-2">
         {globalSettings.userPresets.map((preset: any) => (
           <button
             key={preset.id}
             onClick={() => onSelect(preset)}
             className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors"
           >
             {preset.name}
           </button>
         ))}
       </div>
    </div>
  );
};






// 图片压缩函数
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject("Canvas context is not available.");
          return;
        }

        // --- 核心修复：智能计算宽高比 ---
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        // 如果图片宽度大于最大值，就按比例缩小高度
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          // 如果图片高度大于最大值，就按比例缩小宽度
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 压缩质量调整为 0.7，更清晰一点
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
};







// 读取酒馆角色卡
const readTavernPng = async (file: File): Promise<any | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const view = new DataView(buffer);
      if (view.getUint32(0) !== 0x89504e47) { resolve(null); return; }
      let offset = 8;
      while (offset < buffer.byteLength) {
        const length = view.getUint32(offset);
        const type = new TextDecoder().decode(new Uint8Array(buffer, offset + 4, 4));
        if (type === 'tEXt') {
          const data = new Uint8Array(buffer, offset + 8, length);
          let nullIndex = -1;
          for (let i = 0; i < length; i++) { if (data[i] === 0) { nullIndex = i; break; } }
          if (nullIndex > -1) {
            const keyword = new TextDecoder().decode(data.slice(0, nullIndex));
            if (keyword.toLowerCase() === 'chara') {
              const text = new TextDecoder().decode(data.slice(nullIndex + 1));
              try {
                const decoded = atob(text);
                const jsonStr = new TextDecoder().decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
                resolve(JSON.parse(jsonStr));
                return;
              } catch (err) {}
            }
          }
        }
        offset += 12 + length;
      }
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
};











  // 监听 historyLimit 变化，加载完后修正滚动条位置，防止乱跳
  useLayoutEffect(() => {
      if (chatContainerRef.current && prevScrollHeightRef.current > 0) {
          const newScrollHeight = chatContainerRef.current.scrollHeight;
          const diff = newScrollHeight - prevScrollHeightRef.current;
          
          // 修正滚动条：往下挪 diff 的距离，这样视觉上就像是“停在原地”
          chatContainerRef.current.scrollTop = diff;
          
          // 重置
          prevScrollHeightRef.current = 0;
      }
  }, [historyLimit, activeContact?.id]); // 依赖项：条数变了，或者换人了
  // ==================== ★★★ 【新代码结束】 ★★★ ====================















      

































  



 























// =========================================================================================
  // 🎨 第 7 区：界面渲染 (Render / JSX)
  // =========================================================================================
















  



  
if (view === 'settings' && activeContact) {

  const form = { ...activeContact, ...editForm };
  const enabledBooks = form.enabledWorldBooks || [];
// 在设置页面的 JSX 中，找到一个合适的位置，比如“主动消息配置”下面，粘贴这段代码

  // --- 预设管理逻辑保持不变 ---
  const handleSavePreset = () => {
    if (!presetName.trim()) return alert("请输入预设名称！");
    const cssToSave = editForm.customCSS || form.customCSS || "";
    if (!cssToSave) return alert("当前没有 CSS 代码可保存！");
    const newPreset = {
      id: Date.now().toString(),
      name: presetName,
      css: cssToSave
    };
    if (!globalSettings.themePresets) globalSettings.themePresets = [];
    globalSettings.themePresets.push(newPreset);
    setPresetName("");
    alert(`预设 "${newPreset.name}" 保存成功！`);
  };

  const handleLoadPreset = (presetId) => {
    const preset = globalSettings.themePresets?.find(p => p.id === presetId);
    if (preset) {
      setEditForm({ ...editForm, customCSS: preset.css });
      setSelectedPresetId(presetId);
    }
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) return;
    if (!globalSettings.themePresets) return;
    const idx = globalSettings.themePresets.findIndex(p => p.id === selectedPresetId);
    if (idx > -1) {
      globalSettings.themePresets.splice(idx, 1);
      setSelectedPresetId("");
      setEditForm({ ...editForm, customCSS: "" });
    }
  };

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
      
      {/* 沉浸式 Header */}

<SafeAreaHeader
  title="Chat Settings"
  left={<button onClick={() => setView('chat')} className="text-blue-500 text-2xl -ml-2">‹</button>}
  right={<button onClick={saveSettings} className="text-blue-500 font-bold px-4">保存</button>}
/>

      {/* 模态框保持不变 */}
      {showMemoryModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full h-[80%] rounded-2xl flex flex-col shadow-2xl animate-scaleIn">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">🧠 Long-Term Memory</h3>
              <button onClick={() => setShowMemoryModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="flex-1 p-4 bg-yellow-50">
              <textarea
                className="w-full h-full bg-transparent outline-none resize-none text-sm font-mono leading-relaxed"
                value={tempSummary}
                onChange={(e) => setTempSummary(e.target.value)}
                placeholder="Summary..."
              />
            </div>
            <div className="p-4 border-t">
              <button onClick={handleMemorySave} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}







      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-4 pt-20 space-y-6">












                {/* 1. My Persona - 可折叠预设管理版 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm transition-all border border-gray-100">
          {/* 可点击的折叠标题栏 */}
          <div
            className="flex items-center justify-between cursor-pointer select-none mb-4 pb-3 border-b border-gray-100"
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">👤</span>
              <h3 className="font-bold text-gray-800">My Persona</h3>
              {globalSettings?.userPresets && globalSettings.userPresets.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {globalSettings.userPresets.length} 个预设
                </span>
              )}
            </div>
            <span className={`text-xl transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>

          {/* 折叠内容：只有展开时才显示 */}
          {showPersonaMenu && (
            <div className="animate-slideDown space-y-4">
              {/* 预设胶囊列表 */}
              <div>
                <div className="flex flex-wrap gap-2">
                  {globalSettings?.userPresets?.map((p: any) => (
                    <div
                      key={p.id}
                      className="relative group bg-blue-50 border border-blue-200 rounded-full px-4 py-2 text-xs font-medium text-blue-700 cursor-pointer hover:bg-blue-100 transition"
                      onClick={() => {
                        setEditForm(prev => ({
                          ...prev,
                          userName: p.userName || form.userName,
                          userAvatar: p.userAvatar || form.userAvatar,
                          userPersona: p.description || form.userPersona
                        }));
                        alert(`已加载预设: ${p.name}`);
                      }}
                    >
                      <span>{p.name}</span>
                      {/* hover 删除叉叉 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定删除预设 "${p.name}" 吗？`)) {
                            setGlobalSettings(prev => ({
                              ...prev,
                              userPresets: prev.userPresets?.filter((preset: any) => preset.id !== p.id) || []
                            }));
                            alert(`预设 "${p.name}" 已删除`);
                          }
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* 保存当前按钮 */}
                  <button
                    onClick={() => {
                      const name = prompt("保存当前设置为预设，输入名称:", "新预设");
                      if (!name?.trim()) return;
                      const newPreset = {
                        id: Date.now().toString(),
                        name: name.trim(),
                        userName: editForm.userName !== undefined ? editForm.userName : form.userName,
                        userAvatar: editForm.userAvatar || form.userAvatar,
                        description: editForm.userPersona !== undefined ? editForm.userPersona : form.userPersona
                      };
                      setGlobalSettings(prev => ({
                        ...prev,
                        userPresets: [...(prev.userPresets || []), newPreset]
                      }));
                      alert(`预设 "${name.trim()}" 保存成功！`);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-full text-xs font-bold shadow hover:bg-blue-600 transition flex items-center gap-1"
                  >
                    <span>+</span> 保存当前
                  </button>
                </div>

                {/* 无预设提示 */}
                {(!globalSettings?.userPresets || globalSettings.userPresets.length === 0) && (
                  <div className="text-center text-xs text-gray-400 mt-3 italic">
                    暂无预设，填写后可点击“+ 保存当前”创建
                  </div>
                )}
              </div>
            </div>
          )}




          {/* 下面是固定的头像 + 名字 + 描述（不受折叠影响） */}
          <div className={`transition-all ${showPersonaMenu ? 'mt-6' : ''}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-100 bg-gray-50 group hover:shadow-md transition">
                <img src={editForm.userAvatar || form.userAvatar} className="w-full h-full object-cover" alt="user" />
                <input type="file" onChange={(e) => handleImageUpload(e, 'userAvatar')} className="absolute inset-0 opacity-0 cursor-pointer" title="Change Avatar" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-bold ml-1">用户名</label>
                <input
                  type="text"
                  value={editForm.userName !== undefined ? editForm.userName : form.userName}
                  onChange={e => setEditForm({ ...editForm, userName: e.target.value })}
                  className="w-full border-b p-2 outline-none text-sm font-bold bg-transparent focus:border-blue-500 transition"
                  placeholder="User"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-bold ml-1">My Description</label>
              <textarea
                rows={3}
                value={editForm.userPersona !== undefined ? editForm.userPersona : form.userPersona}
                onChange={e => setEditForm({ ...editForm, userPersona: e.target.value })}
                className="w-full border p-3 rounded-xl text-sm mt-1 bg-gray-50 text-xs focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
                placeholder="描述一下你自己，AI 会看到的..."
              />
            </div>
          </div>
        </section>




     {/* 2. 角色信息 (含 AI 性格分析器) */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🤖 Character Identity</h3>
          
          {/* 头像与名字 */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-100 bg-gray-50">
              <img src={form.avatar} className="w-full h-full object-cover" alt="character" />
              <input type="file" onChange={(e) => handleImageUpload(e, 'avatar')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">群聊名</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full border-b p-1 outline-none text-sm font-bold bg-transparent"
              />
            </div>
          </div>
          
          <div className="mb-2">
            <label className="text-xs text-gray-500">备注</label>
            <input
              type="text"
              value={form.memo}
              onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
              className="w-full border p-2 rounded text-sm mt-1 bg-gray-50"
            />
          </div>
          





          {/* 人设编辑框 */}
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs text-gray-500"> 详细设定</label>
              {/* ★★★ AI 分析按钮 ★★★ */}
{/* 这是一组代码：升级版“AI人设扫描”按钮 (复用了全屏加载 UI) */}
             
            </div>
            <textarea
              rows={4}
              value={form.persona}
              onChange={e => setEditForm({ ...editForm, persona: e.target.value })}
              className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-xs leading-relaxed font-mono focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
              placeholder="例如：它是一只萌萌的小狗..."
            />
          </div>











          {/* Minimax Config */}
          <div className="mt-6 pt-6 border-t border-dashed border-purple-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-lg">🗣️</div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Minimax 语音配置</h3>
              </div>
            </div>
            {/* 国内/国际版选择 */}
            <div className="mb-4 bg-purple-50 p-3 rounded-xl">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!globalSettings.minimax) globalSettings.minimax = { groupId: '', apiKey: '', model: 'speech-01' };
                    globalSettings.minimax.serviceArea = 'domestic';
                    setEditForm({ ...editForm });
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${globalSettings.minimax?.serviceArea !== 'international' ? 'border-purple-500 bg-purple-500 text-white shadow-md' : 'border-gray-200 bg-white text-gray-400'}`}
                >
                  🇨🇳 国内版
                </button>
                <button
                  onClick={() => {
                    if (!globalSettings.minimax) globalSettings.minimax = { groupId: '', apiKey: '', model: 'speech-01' };
                    globalSettings.minimax.serviceArea = 'international';
                    setEditForm({ ...editForm });
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${globalSettings.minimax?.serviceArea === 'international' ? 'border-blue-500 bg-blue-500 text-white shadow-md' : 'border-gray-200 bg-white text-gray-400'}`}
                >
                  🌏 国际版
                </button>
              </div>
            </div>
            {/* 模型选择 */}
            <div className="mb-4">
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white outline-none"
                value={globalSettings.minimax?.model || "speech-01"}
                onChange={(e) => {
                  if (globalSettings.minimax) globalSettings.minimax.model = e.target.value;
                  setEditForm({ ...editForm });
                }}
              >
                <optgroup label="🔥 最新推荐">
                  <option value="speech-2.6-hd">speech-2.6-hd</option>
                  <option value="speech-2.6-turbo">speech-2.6-turbo</option>
                </optgroup>
                <optgroup label="👴 兼容旧版">
                  <option value="speech-01-hd">speech-01-hd</option>
                  <option value="speech-01">speech-01</option>
                </optgroup>
              </select>
            </div>
            {/* Voice ID 区域 */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Voice ID</label>
                <button
                  onClick={async () => {
                    if (!globalSettings.minimax?.groupId) {
                      alert("Key missing!");
                      return;
                    }
                    try {
                      await fetchMinimaxVoices(globalSettings.minimax.groupId, globalSettings.minimax.apiKey);
                      setAvailableVoices(getBuiltInMinimaxVoices());
                      alert("Voices loaded.");
                    } catch (e) {
                      alert("Failed.");
                    }
                  }}
                  className="text-[10px] text-purple-600 underline"
                >
                  🔄 Fetch
                </button>
              </div>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white"
                value={form.voiceId || ""}
                onChange={e => setEditForm({ ...editForm, voiceId: e.target.value })}
              >
                <option value="">Select Voice from List</option>
                {(availableVoices.length > 0 ? availableVoices : getBuiltInMinimaxVoices()).map(v => (
                  <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                ))}
              </select>
              <div className="mt-2">
                <label className="text-xs text-gray-500">输入VOICE ID</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded text-sm mt-1 bg-gray-50"
                  value={form.voiceId || ""}
                  onChange={e => setEditForm({ ...editForm, voiceId: e.target.value })}
                  placeholder="e.g. custom-voice-id"
                />
              </div>
            </div>
          </div>
        </section>







        {/* 3. Memory & Lore 控制台 (完全体) */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
             <div className="flex flex-col">
               <h3 className="text-xs font-bold text-gray-400 uppercase">🧠 Memory Console</h3>
               <span className="text-[9px] text-gray-400">控制 AI 的记忆长度与 Token</span>
             </div>
             





{/* 点击显示 Context Token 统计 (实时响应输入框版) */}
             <button 
               onClick={() => setShowTokenModal(true)} 
               className="bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-mono border border-blue-200 transition-colors flex items-center gap-1 shadow-sm"
             >
               <span>📊</span>
               {(() => {
                 // ================= 实时算法 =================
                 // 1. ★★★ 强行读取输入框的值 ★★★
                 const inputDepth = form.contextDepth !== undefined ? form.contextDepth : activeContact.contextDepth;
                 const depth = Number(inputDepth) || 20;

                 const historySlice = (activeContact.history || []).slice(-depth);

                 // 2. 固定消耗
                 const baseCost = 800;
                 const pCost = (form.persona || activeContact.persona || "").length * 1.3;
                 const uCost = ((form.userName || "") + (form.userPersona || "")).length * 1.3;
                 const hefCost = JSON.stringify(form.hef || activeContact.hef || {}).length * 1.3;
                 
                 const enabledNames = form.enabledWorldBooks || activeContact.enabledWorldBooks || [];
                 const activeBooks = worldBooks.filter(wb => enabledNames.includes(wb.name));
                 const loreCost = JSON.stringify(activeBooks).length * 1.3;
                 
                 const memCost = JSON.stringify(activeContact.longTermMemories || []).length * 1.3;

                 // 3. 切片消耗
                 let sliceCost = 0;
                 historySlice.forEach((m: any, idx: number) => {
                     const isLatest = idx === historySlice.length - 1;
                     if (m.type === 'image' || (m.content && m.content.startsWith('data:image'))) {
                         sliceCost += isLatest ? m.content.length : 50;
                     } else {
                         sliceCost += m.content.length;
                     }
                 });
                 sliceCost = Math.round(sliceCost * 1.3);

                 // 4. 总计
                 const totalEst = Math.round(baseCost + pCost + uCost + hefCost + loreCost + memCost + sliceCost);
                 
                 // ★ w 单位 ★
                 const displayNum = totalEst >= 10000 ? `${(totalEst/10000).toFixed(2)}w` : totalEst;
                 
                 return <span className="font-bold">≈ {displayNum} &gt;</span>;
               })()}
             </button>
          </div>






          {/* 数字输入区域 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* 上下文条数设置 */}
            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1 text-center">
                Context Depth (记忆条数)
              </label>
              <div className="flex items-center justify-center">
                <input
                  type="number"
                  value={form.contextDepth || 20}
                  onChange={e => setEditForm({ ...editForm, contextDepth: parseInt(e.target.value) || 0 })}
                  className="w-full bg-transparent text-center font-bold text-blue-600 text-lg outline-none"
                  placeholder="20"
                />
              </div>
            </div>

            {/* 自动总结阈值设置 */}
            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1 text-center">
                Summary Trigger (总结阈值)
              </label>
              <div className="flex items-center justify-center">
                <input
                  type="number"
                  value={form.summaryTrigger || 50}
                  onChange={e => setEditForm({ ...editForm, summaryTrigger: parseInt(e.target.value) || 0 })}
                  className="w-full bg-transparent text-center font-bold text-gray-700 text-lg outline-none"
                  placeholder="50"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setView('chat');
              setTimeout(() => setShowPersonaPanel(true), 100);
            }}
            className="w-full bg-yellow-50 text-yellow-700 py-3 rounded-xl font-bold border border-yellow-200 hover:bg-yellow-100 transition text-xs flex items-center justify-center gap-2 active:scale-95"
          >
            <span>📝</span> 管理长期记忆便签墙
          </button>
        </section>













        {/* World Lore */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🌍 World Lore</h3>
  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
    <span className="text-sm text-gray-600">{enabledBooks.length} Books Active</span>
    <button
      // ▼▼▼ 核心修改就在下面这一行 ▼▼▼
      onClick={() => setShowWorldBookSelector(true)} // 改成这个！
      // ▲▲▲ 核心修改就在上面这一行 ▲▲▲
      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50 transition"
    >
      Select
    </button>
  </div>
</section>







        {/* ★★★ 新增：记忆挂载控制台入口 ★★★ */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">💾</span>
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase">记忆挂载舱</h3>
                <p className="text-[10px] text-gray-400">
                  已同步 <span className="text-indigo-600 font-bold">{Object.values(mountedMemoryConfig).filter(v => v > 0).length}</span> 人的私聊记忆
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowMountPanel(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs shadow-sm border border-indigo-100 hover:bg-indigo-100 active:scale-95 transition"
            >
              ⚙️ 配置挂载
            </button>
          </div>
        </section>







        {/* 时区设置 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🕐 时区设置</h3>
          <div className="mb-4">
            <label className="text-sm font-bold text-gray-700 block mb-1">AI 角色的时区</label>
            <select
              className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white"
              value={form.timezone || "Asia/Seoul"}
              onChange={e => setEditForm({ ...editForm, timezone: e.target.value })}
            >
              <option value="Asia/Shanghai">🇨🇳 中国大陆（北京时间）</option>
              <option value="Asia/Hong_Kong">🇭🇰 香港</option>
              <option value="Asia/Taipei">🇹🇼 台湾</option>
              <option value="Asia/Seoul">🇰🇷 韩国（首尔）</option>
              <option value="Asia/Tokyo">🇯🇵 日本（东京）</option>
              <option value="Asia/Singapore">🇸🇬 新加坡</option>
              <option value="Australia/Sydney">🇦🇺 澳大利亚（悉尼）</option>
              <option value="Europe/London">🇬🇧 英国（伦敦）</option>
              <option value="Europe/Paris">🇪🇺 中欧（巴黎/柏林）</option>
              <option value="America/New_York">🇺🇸 美国东部（纽约）</option>
              <option value="America/Los_Angeles">🇺🇸 美国西部（洛杉矶）</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="text-sm font-bold text-gray-700 block mb-1">你的时区</label>
            <select
              className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white"
              value={globalSettings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={(e) => {
                const newTz = e.target.value;
                setGlobalSettings(prev => ({ ...prev, userTimezone: newTz }));
              }}
            >
              <option value="Asia/Shanghai">🇨🇳 中国大陆（北京时间）</option>
              <option value="Asia/Hong_Kong">🇭🇰 香港</option>
              <option value="Asia/Taipei">🇹🇼 台湾</option>
              <option value="Asia/Seoul">🇰🇷 韩国（首尔）</option>
              <option value="Asia/Tokyo">🇯🇵 日本（东京）</option>
              <option value="Asia/Singapore">🇸🇬 新加坡</option>
              <option value="Australia/Sydney">🇦🇺 澳大利亚（悉尼）</option>
              <option value="Europe/London">🇬🇧 英国（伦敦）</option>
              <option value="Europe/Paris">🇪🇺 中欧（巴黎/柏林）</option>
              <option value="America/New_York">🇺🇸 美国东部（纽约）</option>
              <option value="America/Los_Angeles">🇺🇸 美国西部（洛杉矶）</option>
            </select>
          </div>
          {activeContact && (
            <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-center">
              <div className="font-bold text-purple-700">
                {(() => {
                  const diff = getTimezoneOffsetDiff(
                    globalSettings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                    form.timezone || activeContact.timezone
                  );
                  if (diff > 0) return `你 比 ta 快 ${diff} 小时`;
                  if (diff < 0) return `你 比 ta 慢 ${Math.abs(diff)} 小时`;
                  return "你们在同一时区～";
                })()}
              </div>
            </div>
          )}
        </section>




        {/* 主动消息配置 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📩</span>
            <h3 className="text-xs font-bold text-gray-400 uppercase">主动消息配置</h3>
          </div>
          <div className="flex justify-between items-center mb-4 p-2">
            <span className="text-sm text-gray-700 font-bold">启用主动消息</span>
            <Switch
              onValueChange={(val) => setEditForm(prev => ({
                ...prev,
                proactiveConfig: { ...(form.proactiveConfig || {}), enabled: val }
              }))}
              value={form.proactiveConfig?.enabled || false}
            />
          </div>
{form.proactiveConfig?.enabled && (
            <div className="space-y-5 pt-4 border-t border-gray-100 animate-slideDown">
              
              {/* 设置项 1：最小间隔 */}
              <div className="px-1">
                <div className="flex justify-between items-center h-9">
                  <span className="text-xs text-gray-500 font-bold">最小间隔</span>
                  <div className="flex items-center gap-2 w-[140px] justify-end">
                    <input
                      type="number"
                      className="w-20 text-center font-bold text-gray-700 bg-gray-100 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all text-xs"
                      value={form.proactiveConfig?.minGapMinutes ?? 480}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        proactiveConfig: { ...(form.proactiveConfig || {}), minGapMinutes: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span className="text-[10px] text-gray-400 font-bold w-8 text-right">分钟</span>
                  </div>
                </div>
              </div>

              {/* 设置项 2：每日上限 (已删除灰色滑块条，完全对齐) */}
              <div className="px-1">
                <div className="flex justify-between items-center h-9">
                  <span className="text-xs text-gray-500 font-bold">每日上限</span>
                  <div className="flex items-center gap-2 w-[140px] justify-end">
                    <input
                      type="number"
                      className="w-20 text-center font-bold text-gray-700 bg-gray-100 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-blue-200 transition-all text-xs"
                      value={form.proactiveConfig?.maxDaily ?? 5} 
                      onChange={(e) => {
                         const val = parseInt(e.target.value);
                         setEditForm(prev => ({
                           ...prev,
                           proactiveConfig: { 
                               ...(form.proactiveConfig || {}), 
                               maxDaily: isNaN(val) ? 0 : val 
                           }
                         }));
                      }}
                      placeholder="5"
                    />
                    <span className="text-[10px] text-gray-400 font-bold w-8 text-right">次/天</span>
                  </div>
                </div>
                <p className="text-[9px] text-gray-300 mt-2 text-right">
                   * 填一个较大的数字（如 99）即可解除限制
                </p>
              </div>

              {/* 底部说明 */}
              <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-50 text-center mt-2">
                 <p className="text-[10px] text-blue-400/80">
                    AI 将结合“心情骰子”和“时间间隔”来决定是否主动找你~
                 </p>
              </div>
            </div>
          )}
        </section>








        {/* 这是一组代码：外观设置面板（终极修复版：找回了CSS预设功能 + 颜色/缩放控制） */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🎨 外观个性化定制</h3>

          
          
          <div className="w-full h-px bg-gray-100 my-4"></div>

          {/* 2. 气泡颜色设置 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
               <label className="text-[10px] text-gray-500 font-bold mb-1 block">我的气泡颜色</label>
               <div className="flex items-center gap-2">
                 <input 
                   type="color" 
                   value={form.bubbleColorUser || "#FBCFE8"} 
                   onChange={(e) => setEditForm({...editForm, bubbleColorUser: e.target.value})}
                   className="h-8 w-full cursor-pointer rounded border border-gray-200 p-0.5 bg-white"
                 />
               </div>
            </div>
            <div>
               <label className="text-[10px] text-gray-500 font-bold mb-1 block">AI 气泡颜色</label>
               <div className="flex items-center gap-2">
                 <input 
                   type="color" 
                   value={form.bubbleColorAI || "#ffffff"} 
                   onChange={(e) => setEditForm({...editForm, bubbleColorAI: e.target.value})}
                   className="h-8 w-full cursor-pointer rounded border border-gray-200 p-0.5 bg-white"
                 />
               </div>
            </div>
          </div>

          {/* 3. 整体界面缩放 (单滑块) */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
             <div className="flex justify-between text-xs text-blue-800 mb-2 font-bold">
               <span>🔍 界面整体缩放 (字号+头像)</span>
               <span>{((form.chatScale || 1) * 100).toFixed(0)}%</span>
             </div>
             <Slider
                minimumValue={0.8}
                maximumValue={1.3}
                step={0.05}
                value={form.chatScale || 1}
                onValueChange={(val: number) => setEditForm({ ...editForm, chatScale: val })}
             />
          </div>

          {/* 4. 聊天背景图 */}
          <div className="pt-2">
            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Chat Background URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://..."
                className="flex-1 border p-2 rounded-lg text-xs outline-none bg-gray-50"
                value={editForm.chatBackground || form.chatBackground || ""}
                onChange={(e) => setEditForm({ ...editForm, chatBackground: e.target.value })}
              />
              <label className="bg-gray-100 border px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-gray-200 flex items-center transition-colors">
                📷 上传
                <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'chatBackground')} />
              </label>
            </div>
          </div>
          
          {/* 1. ★★★ [已找回] Theme Presets 主题预设管理 ★★★ */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-6">
            <div className="flex justify-between items-center mb-2">
               <label className="text-[10px] text-gray-500 font-bold uppercase">💾 主题预设 (Theme Presets)</label>
               <span className="text-[9px] text-gray-400">{globalSettings.themePresets?.length || 0} Saved</span>
            </div>
            
            {/* 选择与删除 */}
            <div className="flex gap-2 mb-2">
              <select
                className="flex-1 p-2 rounded-lg border border-gray-300 text-xs outline-none bg-white h-9"
                value={selectedPresetId}
                onChange={(e) => handleLoadPreset(e.target.value)}
              >
                <option value="">-- 选择已保存的预设 --</option>
                {globalSettings.themePresets?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button 
                onClick={handleDeletePreset} 
                className="bg-red-100 text-red-500 px-3 rounded-lg font-bold hover:bg-red-200 h-9 text-xs transition-colors"
                disabled={!selectedPresetId}
              >
                删除
              </button>
            </div>

            {/* 新增与保存 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="给当前样式起个名..."
                className="flex-1 p-2 rounded-lg border border-gray-300 text-xs outline-none h-9 focus:border-blue-500 transition-colors"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
              />
              <button 
                onClick={handleSavePreset} 
                className="bg-green-100 text-green-600 px-3 rounded-lg font-bold text-xs hover:bg-green-200 h-9 transition-colors whitespace-nowrap"
              >
                保存当前
              </button>
            </div>
          </div>
          
          {/* 5. 自定义 CSS 代码 */}
          <div className="mt-4">
             <details>
                <summary className="text-xs font-bold text-gray-400 cursor-pointer hover:text-blue-500 transition-colors select-none">
                  高级：编辑 CSS 代码 &gt;
                </summary>
                <div className="relative mt-2">
                    <div className="flex justify-between items-center mb-1 px-1">
                        <span className="text-[10px] text-gray-400">在此粘贴代码可覆盖上方设置</span>
                        <button onClick={() => setEditForm({ ...editForm, customCSS: "" })} className="text-[10px] text-red-400 underline hover:text-red-600">
                           清空代码
                        </button>
                    </div>
                    <textarea
                      className="w-full h-32 bg-gray-800 text-green-400 font-mono text-[10px] p-3 rounded-xl outline-none resize-none leading-relaxed shadow-inner"
                      value={editForm.customCSS || form.customCSS || ""}
                      onChange={(e) => setEditForm({ ...editForm, customCSS: e.target.value })}
                      spellCheck={false}
                      placeholder="/* .message-wrapper { ... } */"
                    />
                </div>
             </details>
          </div>
        </section>





     {/* ★★★ 核心修复：把记忆挂载面板的渲染逻辑也在这里放一份 ★★★ */}
        {showMountPanel && (() => {
          // 逻辑和聊天页面那边完全一样，确保只显示其他成员
          const membersToDisplay = allContacts.filter(
            c => group.members.includes(c.id) && c.id !== group.id
          );

          return (
            <MemoryMountPanel 
              contacts={membersToDisplay}
              mountedConfig={mountedMemoryConfig}
              onUpdateConfig={(id, count) => setMountedMemoryConfig(prev => ({ ...prev, [id]: count }))}
              onClose={() => setShowMountPanel(false)}
            />
          );
        })()}








        <div className="mt-auto pt-10 pb-4">
          <section className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
            <h3 className="text-xs font-bold text-red-400 uppercase mb-3">Danger Zone</h3>
{/* 【修改点】：将 onClick 从 handleClearChat 换成 handleResetCharacter */}
        <button
          onClick={handleResetCharacter}
          className="w-full bg-white text-red-500 py-3 rounded-xl font-bold border border-red-200 shadow-sm hover:bg-red-50 transition"
        >
          ☢️ 彻底重置该角色 (Reset Character)
        </button>
          </section>
        </div>

        {/* 👇👇👇 在这里插入弹窗代码 (就在 settings 视图结束前) 👇👇👇 */}
        {showTokenModal && (
          <TokenDetailModal
            onClose={() => setShowTokenModal(false)}
            form={editForm} // 注意：在设置页里，我们看的是正在编辑的 editForm
            activeContact={activeContact}
            worldBooks={worldBooks}
          />
        )}
        {/* 👆👆👆 插入结束 👆👆👆 */}









{showWorldBookSelector && (
  <div 
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
    onClick={() => setShowWorldBookSelector(false)}
  >
    <div 
      className="bg-white w-[90%] max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn max-h-[80vh] flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      {/* 头部 */}
      <div className="bg-gray-50 p-4 border-b flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-bold text-lg text-gray-800">选择世界书</h3>
          <p className="text-xs text-gray-400">为当前角色启用设定</p>
        </div>
        <button onClick={() => setShowWorldBookSelector(false)} className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-500 font-bold text-sm transition">✕</button>
      </div>
      
      {/* 列表 */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-2">
        {worldBooks.length === 0 && (
          <div className="text-center text-gray-400 py-10">
            <p className="text-2xl">🌍</p>
            <p>还没有创建世界书哦</p>
          </div>
        )}
        {worldBooks.map(book => (
          <div 
            key={book.id}
            onClick={() => toggleWorldBook(book.name)} // 直接调用你已有的函数
            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border-2 ${
              (form.enabledWorldBooks || []).includes(book.name) 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-gray-50 border-transparent hover:bg-gray-100'
            }`}
          >
            <span className={`font-bold text-sm ${(form.enabledWorldBooks || []).includes(book.name) ? 'text-blue-700' : 'text-gray-600'}`}>
              {book.name}
            </span>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              (form.enabledWorldBooks || []).includes(book.name) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
            }`}>
              {(form.enabledWorldBooks || []).includes(book.name) && <span className="text-white text-xs font-bold">✓</span>}
            </div>
          </div>
        ))}
      </div>

      {/* 底部 */}
      <div className="p-4 border-t bg-gray-50 shrink-0">
        <button onClick={() => setShowWorldBookSelector(false)} className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 transition active:scale-95">
          完成
        </button>
      </div>
    </div>
  </div>
)}





























 
      </div>
      
    </div>

    
    
  );
  

} // <--- 这里是 if (view === 'settings') 的结束大括号





  // ==================== 聊天界面 ====================

    // 🟢 1. 插入：计算其他人的未读消息数
    if (activeContact) {
    const otherUnreadCount = contacts.reduce((acc, c) => c.id !== activeContact.id ? acc + ((c as any).unread || 0) : acc, 0);

return (
      // 最外层容器：确保背景色和全屏
      <div className="h-full w-full bg-gray-100 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
        






{/* ★★★ 修复：完整的 Header (包含左返回、中状态、右设置) ★★★ */}
        <SafeAreaHeader
          // 1. 中间标题：名字 + 智能状态 (点击打开档案)
          title={
            <div 
              className="flex flex-col items-center justify-center leading-tight cursor-pointer"
              onClick={() => setShowPersonaPanel(true)}
            >

<span className="font-bold text-lg text-gray-900">{activeContact.memo?.trim() || activeContact.name}</span>
              
              <div className="flex items-center gap-1.5 mt-0.5">
                {(() => {
                   // 准备数据
                   const energy = activeContact.mood.energy || { current: 80, status: 'Awake' };
                   const hef = activeContact.hef?.INDIVIDUAL_VARIATION ? activeContact.hef : (activeContact.hef || {}); 
                   
                   // 调用炼金术算法
                   const complexState = calculateComplexState(energy, hef);

                   return (
                     <>
                       <span className={`relative flex h-2 w-2`}>
                         <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${complexState.ping}`}></span>
                         <span className={`relative inline-flex rounded-full h-2 w-2 ${complexState.color}`}></span>
                       </span>
                       <span className="text-[10px] text-gray-500 font-medium opacity-90 tracking-wide truncate max-w-[150px]">
                         {complexState.text}
                       </span>
                     </>
                   );
                })()}
              </div>
            </div>
          }

        // 2. 左侧：返回按钮 (执行退出群聊)
          left={
            <button 
              onClick={() => { 
                  // ★★★ 核心修改：群聊点击返回，调用 onExit() 退出组件
                  onExit(); 
              }} 
              className="text-blue-500 text-xl pl-2 pr-4 py-2 relative flex items-center transition-opacity hover:opacity-70"
            >
              {/* 返回箭头图标 */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              
              {/* 群聊里通常不显示“其他人未读数”，为了界面干净，我们先去掉红点 */}
            </button>
          }
          
          // 3. 右侧：设置按钮
          right={
            <button 
              onClick={() => { setEditForm({}); setView('settings'); }} 
              className="text-gray-400 text-2xl pr-2 hover:text-gray-600 transition-colors"
            >
              ≡
            </button>
          }
        />






        {/* 背景壁纸层 */}
        {activeContact.wallpaper && <div className="absolute inset-0 bg-black/20 pointer-events-none z-0"></div>}
        















{/* ★★★ 消息操作菜单 (长按触发) ★★★ */}
{showMsgMenu && selectedMsg && (
  <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 animate-fadeIn" onClick={() => setShowMsgMenu(false)}>
    <div className="bg-white w-full rounded-t-2xl p-4 animate-slideUp" onClick={e => e.stopPropagation()}>
      <div className="text-center text-gray-400 text-xs mb-4">对消息进行操作</div>
     






      {/* 编辑与引用（新增引用按钮） */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={handleStartEdit} className="py-3 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2"><span>✏️</span> 编辑</button>
        <button onClick={handleReplyMessage} className="py-3 bg-green-50 text-green-600 rounded-xl font-bold flex items-center justify-center gap-2"><span>↩️</span> 引用</button>
      </div>
      {/* 收藏功能 */}
      <button onClick={handleCollectMessage} className="w-full py-3 border-b text-orange-500 font-bold">⭐ 收藏</button>
     
      {/* 多选功能 */}
      <button onClick={() => { setIsSelectionMode(true); toggleMessageSelection(selectedMsg.id); setShowMsgMenu(false); setSelectedMsg(null); }} className="w-full py-3 border-b text-purple-600 font-bold">☑️ 多选消息</button>
     
      {/* 删除与撤回 */}
      <button onClick={handleWithdrawMessage} className="w-full py-3 border-b text-gray-600 font-bold">↩️ 撤回</button>
      <button onClick={handleDeleteMessage} className="w-full py-3 text-red-500 font-bold">🗑️ 删除</button>
     
      <div className="h-2 bg-gray-100 -mx-4"></div>
      <button onClick={() => setShowMsgMenu(false)} className="w-full py-3 text-gray-500 font-bold">取消</button>
    </div>
  </div>
)}






        {/* 音乐弹窗 (保持不变) */}
        {showSongModal && (
          <div className="absolute inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/50 animate-fadeIn">
             {/* ...省略内部代码... */}
             {/* 这一块可以直接用你原来的，或者复制下面的简化版占位 */}
             <div className="bg-white p-4 rounded-xl"><p>Music Player Placeholder</p></div> 
          </div>
        )}


      {/* Header */}
        {/* 增加 pt-[env(safe-area-inset-top)] 让内容避开刘海，但背景色延伸到顶部 */}






        {/* 悬浮播放器 */}
        {musicPlayerOpen && currentSong && (
          <div className={`sticky top-12 mx-4 mt-2 z-30 transition-all duration-300 ${isPlayerMinimized ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 flex-1"><div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200"><img src={currentSong.cover} className="w-full h-full object-cover" alt="cover" /></div><div className="flex-1 overflow-hidden"><div className="font-bold text-gray-800 truncate text-sm">{currentSong.title}</div><div className="text-xs text-gray-500 truncate">{currentSong.artist}</div></div></div>
                <div className="flex items-center gap-2"><audio src={currentSong.url} autoPlay controls className="h-8 w-32" /><button onClick={closeMusicPlayer} className="text-gray-400 hover:text-gray-600 p-1">✕</button></div>
              </div>
              <button onClick={() => setIsPlayerMinimized(true)} className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-200 rounded-full w-6 h-6 text-xs text-gray-500 flex items-center justify-center hover:bg-gray-300">↓</button>
            </div>
          </div>
        )}
        {musicPlayerOpen && currentSong && isPlayerMinimized && (
          <div className="sticky top-12 z-30 flex justify-center mt-2">
            <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-full px-3 py-1 shadow-sm flex items-center gap-2 cursor-pointer hover:bg-white transition" onClick={() => setIsPlayerMinimized(false)}>
              <span className="text-red-500 animate-pulse">🎵</span>
              <span className="text-xs text-gray-700 truncate max-w-[100px]">{currentSong.title}</span>
              <button onClick={(e) => { e.stopPropagation(); closeMusicPlayer(); }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
          </div>
        )}








{/* ==================== ★★★ 【修改代码】绑定 Ref 和 Scroll 事件 ★★★ ==================== */}
<div 
  ref={chatContainerRef} 
  onScroll={handleScrollEvents} 
  // ★★★ 核心修复：加上 overflowAnchor: 'none'，禁止浏览器自动瞎跳 ★★★
  style={{ 
      overflowAnchor: 'none',
      ...(activeContact.chatBackground ? { backgroundImage: `url(${activeContact.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) 
  }}
  className={`flex-1 overflow-y-auto p-4 space-y-0.5 z-0 ${musicPlayerOpen && !isPlayerMinimized ? 'pt-4' : 'pt-2'}`}
>
{/* ==================== ★★★ 【修改结束】 ★★★ ==================== */}
  {activeContact.customCSS && <style dangerouslySetInnerHTML={{ __html: activeContact.customCSS }} />}
  
  
  
  {activeContact.history.length > historyLimit && (
      <div className="w-full py-4 text-center text-xs text-gray-400 animate-pulse">
         ⏳ 下拉查看更多历史...
      </div>
  )}

// ==================== ⬇️ 从这里开始完整复制替换 ⬇️ ====================

{activeContact.history
    .slice(-historyLimit)
    .map((msg, index, arr) => {
    
    // --- 1. 计算时间间隔 ---
    let showInterval = false;
    let intervalMinutes = 0;
    if (index > 0) {
        const prevMsg = arr[index - 1]; 
        intervalMinutes = Math.floor((msg.timestamp - prevMsg.timestamp) / 60000);
        if (intervalMinutes > 20) showInterval = true; 
    }

    // --- 2. 智能识别发送者 ---
    let senderName = "";
    let senderAvatar = "";
    let senderIdForCheck = ""; 
    const msgAny = msg as any;

    if (msg.role === 'user') {
        senderName = activeContact.userName || "我";
        senderAvatar = activeContact.userAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User";
        senderIdForCheck = 'user'; 
    } else {
        const messageSenderId = msgAny.senderId;
        const messageName = msgAny.name;
        let sender = allContacts.find(c => c.id === messageSenderId);
        if (!sender && messageName) {
            sender = allContacts.find(c => c.name.trim() === messageName.trim());
        }
        if (sender) {
            senderAvatar = sender.avatar;
            senderName = sender.name;
            senderIdForCheck = sender.id;
        } else {
            senderName = messageName || "未知成员";
            senderAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${senderName}`;
            senderIdForCheck = messageSenderId || 'unknown';
        }
    }
    
    // --- 3. 准备各种状态和样式 ---
    const prevMsgSenderId = index > 0 ? ((arr[index-1] as any).senderId || (arr[index-1].role === 'user' ? 'user' : '')) : '';
    const isConsecutive = index > 0 && !showInterval && senderIdForCheck === prevMsgSenderId;
    const showName = !isConsecutive && msg.role !== 'user'; 
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const scale = activeContact.chatScale || 1; 
    const currentAvatarSize = 40 * scale; 
    const currentFontSize = `${14 * scale}px`;
    const userBg = activeContact.bubbleColorUser || '#FBCFE8';
    const aiBg = activeContact.bubbleColorAI || '#FFFFFF';
    const currentBg = msg.role === 'user' ? userBg : aiBg;
    const currentText = getContrastTextColor(currentBg);
    
    // ★★★ 核心修复：把 isSelected 的判断也加进来！★★★
    const isSelected = selectedIds.includes(msg.id);
    
    if (msg.role === 'system') return null;

    return (
        <React.Fragment key={msg.id}>
        {showInterval && (
            <div className="text-center my-6">
                <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {intervalMinutes < 60 ? `${intervalMinutes}分钟` : `${Math.floor(intervalMinutes / 60)}小时`}
                </span>
            </div>
        )}

        <div 
            id={`msg_${msg.timestamp}`} 
            className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mb-1' : 'mb-2'}`}
            onTouchStart={() => handleTouchStart(msg)}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => handleTouchStart(msg)}
            onMouseUp={handleTouchEnd}
        >
            {/* ★★★ 核心修复：把丢失的多选框渲染逻辑加回来！★★★ */}
            {isSelectionMode && (
                <div className={`selection-checkbox-wrapper flex items-center justify-center ${msg.role === 'user' ? 'ml-2 order-3' : 'mr-2 order-1'}`}>
                    <div 
                        onClick={() => toggleMessageSelection(msg.id)} 
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}
                    >
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                </div>
            )}
            
            {/* 头像 (根据是否连续显示) */}
            <div 
                className={`flex-none self-start ${msg.role === 'user' ? 'order-2' : 'order-2'}`}
                style={{ width: `${currentAvatarSize}px`, height: `${currentAvatarSize}px` }}
            >
                {!isConsecutive ? (
                    <img src={senderAvatar} className="rounded-full object-cover border w-full h-full bg-gray-200" alt="avatar" />
                ) : null}
            </div>

            {/* 消息主体 (名字 + 气泡) */}
            <div className={`flex flex-col max-w-[70%] ${msg.role === 'user' ? 'order-1 items-end' : 'order-3 items-start'}`}>
                {showName && (
                    <div className="text-[10px] text-gray-400 mb-0.5 px-2 select-none">
                        {senderName}
                    </div>
                )}
                
                <div className="flex items-end gap-1.5">
                    {msg.role === 'user' && <div className="text-[9px] text-gray-300 self-end pb-1">{timeStr}</div>}
                    
<div 
                        className="content rounded-xl shadow-sm break-words whitespace-pre-wrap"
                        style={{ 
                            backgroundColor: currentBg, 
                            color: currentText, 
                            fontSize: currentFontSize,
                            padding: `${3 * scale}px ${12 * scale}px`,
                            borderTopRightRadius: (msg.role === 'user' && !isConsecutive) ? '4px' : '12px',
                            borderTopLeftRadius: (msg.role !== 'user' && !isConsecutive) ? '4px' : '12px'
                        }}
                    >
                        {/* ★★★ 核心修复：判断当前是否处于编辑模式 ★★★ */}
                        {editingMsgId === msg.id ? (
                            /* === 🅰️ 编辑模式：显示输入框和保存按钮 === */
                            <div className="min-w-[200px]" onClick={e => e.stopPropagation()}>
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full p-2 text-sm text-gray-800 bg-white border border-blue-300 rounded-lg outline-none resize-none"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button 
                                        onClick={handleCancelEdit}
                                        className="px-3 py-1 text-xs font-bold text-gray-500 bg-gray-200 rounded hover:bg-gray-300"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={handleSaveEdit}
                                        className="px-3 py-1 text-xs font-bold text-white bg-blue-500 rounded hover:bg-blue-600 shadow-sm"
                                    >
                                        保存
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* === 🅱️ 正常模式：显示图片或文字 === */
                            <>
                                {msg.type === 'image' ? (
                                    /* 1. 图片显示逻辑 */
                                    <img 
                                        src={msg.content} 
                                        alt="图片" 
                                        className="max-w-full h-auto rounded-lg cursor-pointer my-1"
                                        style={{ maxHeight: '300px' }}
                                        onClick={() => {
                                            const w = window.open();
                                            if(w) w.document.write(`<img src="${msg.content}" style="max-width:100%"/>`);
                                        }}
                                    />
                                ) : (
                                    /* 2. 文字显示逻辑 (含引用) */
                                    <>
                                        {msg.content.startsWith('> 引用') ? (
                                            (() => {
                                                const splitIndex = msg.content.indexOf('\n\n');
                                                if (splitIndex !== -1) {
                                                    const quoteText = msg.content.substring(0, splitIndex);
                                                    const mainText = msg.content.substring(splitIndex + 2);
                                                    return (
                                                        <>
                                                            <div className="mb-2 p-2 bg-black/5 rounded-lg border-l-4 border-black/20 text-[10px] opacity-70 italic select-none">
                                                                {quoteText.replace(/^> /, '')}
                                                            </div>
                                                            <HiddenBracketText content={mainText} msgId={msg.id} fontSize="" />
                                                        </>
                                                    );
                                                }
                                                return <HiddenBracketText content={msg.content} msgId={msg.id} fontSize="" />;
                                            })()
                                        ) : (
                                            <HiddenBracketText content={msg.content} msgId={msg.id} fontSize="" />
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {msg.role !== 'user' && <div className="text-[9px] text-gray-300 self-end pb-1">{timeStr}</div>}
                </div>
            </div>
        </div>
        </React.Fragment>
    );
})}




















                    {/* ★★★ 对方正在输入提醒气泡 ★★★ */}
{/* ★★★ 对方正在输入提醒气泡 (已修复：同步缩放 + 布局对齐 + 颜色) ★★★ */}
          {isAiTyping && (() => {
            // 在这里重新计算一下缩放，确保和上面保持一致
            const scale = activeContact.chatScale || 1;
            const currentAvatarSize = 40 * scale;
            const currentPaddingY = `${6 * scale}px`; 
            const currentPaddingX = `${12 * scale}px`;
            const aiBg = activeContact.bubbleColorAI || '#ffffff'; // 同步 AI 气泡颜色

            return (
              <div 
                // 1. 布局同步：mb-1 紧凑，gap-3 对齐头像
                className="flex gap-3 justify-start animate-slideUp mb-1"
                style={{ minHeight: `${currentAvatarSize}px` }}
              >
                {/* 2. 头像同步：强制大小，禁止变形 */}
                <div 
                  className="flex-none flex justify-start"
                  style={{ width: `${currentAvatarSize}px`, height: `${currentAvatarSize}px`, minWidth: `${currentAvatarSize}px` }}
                >
                  <img 
                    src={activeContact.avatar} 
                    className="rounded-full object-cover border border-gray-100 shadow-sm w-full h-full block" 
                    alt="AI" 
                  />
                </div>

                <div className="flex items-end gap-1.5 max-w-[75%]">
                  {/* 3. 气泡同步：应用缩放后的 Padding 和 圆角 */}
                  <div 
                    className="rounded-xl shadow-sm border border-gray-100 flex items-center"
                    style={{
                      backgroundColor: aiBg,
                      paddingTop: currentPaddingY,
                      paddingBottom: currentPaddingY,
                      paddingLeft: currentPaddingX,
                      paddingRight: currentPaddingX,
                      // 尖角逻辑：因为是正在输入，肯定算“最新一条”，所以左上角给尖角
                      borderTopLeftRadius: '2px', 
                      borderTopRightRadius: '16px',
                      borderBottomLeftRadius: '16px',
                      borderBottomRightRadius: '16px',
                      height: 'auto'
                    }}
                  >
                    {/* 跳动的点点 */}
                    <div className="flex gap-1 items-center" style={{ height: `${14 * scale}px` }}>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                  
                  {/* 时间戳 */}
                  <div className="text-[9px] text-gray-300 whitespace-nowrap shrink-0 opacity-60 select-none mb-0.5">
                    现在
                  </div>
                </div>
              </div>
            );
          })()}



{/* ★★★ 新增：回到底部按钮 ★★★ */}
          {showBackToBottom && (
            <div className="sticky bottom-4 flex justify-center z-50 animate-bounce">
              <button
                onClick={() => {
                  // 1. 解除锁定
                  setShowBackToBottom(false);
                  isJumpingRef.current = false;
                  // 2. 滚到底部
                  scrollToBottom('smooth');
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs flex items-center gap-2 hover:bg-blue-600 transition active:scale-95"
              >
                <span>⬇️</span> 我看完了，回到底部
              </button>
            </div>
          )}








          <div ref={messagesEndRef} />
        </div>




        {/* Input Area */}
      {/* 增加 paddingBottom: env(safe-area-inset-bottom) 确保输入框在黑条上方 */}
{isSelectionMode ? (
          <div 
            className="bg-white border-t p-4 z-20 flex justify-between items-center animate-slideUp shadow-[0_-5px_15px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: '20px' }} 
          >
            {/* 左边：取消按钮 */}
            <button 
                onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} 
                className="text-gray-500 font-bold px-2 text-sm"
            >
                取消
            </button>

            {/* 中间：数量提示 */}
            <span className="text-xs font-bold text-gray-400">已选 {selectedIds.length}</span>

            {/* 右边：操作按钮组 */}
            <div className="flex gap-2">
              {/* 1. 删除按钮 */}
              <button 
                  onClick={handleBatchDelete} 
                  disabled={selectedIds.length === 0} 
                  className={`px-3 py-2 rounded-lg font-bold text-xs bg-red-50 text-red-500 border border-red-100 ${selectedIds.length === 0 ? 'opacity-50' : ''}`}
              >
                  🗑️ 删除
              </button>

              {/* 2. 打包收藏按钮 */}
              <button 
                  onClick={handleBatchCollect} 
                  disabled={selectedIds.length === 0} 
                  className={`px-3 py-2 rounded-lg font-bold text-xs bg-yellow-50 text-yellow-600 border border-yellow-100 ${selectedIds.length === 0 ? 'opacity-50' : ''}`}
              >
                  📦 收藏
              </button>

              {/* 3. ★★★ 新增：保存图片按钮 ★★★ */}
              <button 
                  id="btn-save-img"
                  onClick={handleBatchSaveImage} 
                  disabled={selectedIds.length === 0} 
                  className={`px-3 py-2 rounded-lg font-bold text-xs bg-blue-500 text-white shadow-md active:scale-95 transition-transform ${selectedIds.length === 0 ? 'opacity-50' : ''}`}
              >
                  📷 保存长图
              </button>
            </div>
          </div>
        ) : (
          // ... 这里是你原来的输入框代码 (else 分支)，保持不动 ...
          <div 
            className="bg-white/90 backdrop-blur border-t p-3 z-10"
            // 这是一组代码：替换所有输入栏的 style（去除底部空白，实现强制全屏）
style={{ paddingBottom: '12px' }}  // 只留一点内间距，让输入框不紧贴屏幕底边，但内容可延伸到底部系统栏下面
          >
            {replyTo && (
              <div className="flex justify-between items-center bg-gray-100 p-2 rounded-t-lg text-xs text-gray-500 mb-2 border-b animate-slideUp">
                <span>↪️ 回复 {replyTo.name}: {replyTo.content.substring(0, 15)}...</span><button onClick={() => setReplyTo(null)} className="font-bold text-gray-400 px-2">×</button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={() => setShowPlusMenu(!showPlusMenu)} className={`w-9 h-9 rounded-full flex items-center justify-center transition ${showPlusMenu ? 'bg-gray-200 rotate-45' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>+</button>
              <button onClick={handleAiReplyTrigger} disabled={isTyping} className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm ${isTyping ? 'bg-purple-200 text-purple-400 cursor-not-allowed' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}>✨</button>
          {/* 这是一组代码：修复输入框文字看不见的问题 (添加了 text-gray-900) */}
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSend('text'); } }} 
                placeholder="Message..." 
                // ★★★ 关键修复：加了 text-gray-900 (深灰黑色)，防止文字变白 ★★★
                className="flex-1 bg-gray-100 text-gray-900 rounded-2xl px-4 py-2 text-sm outline-none resize-none max-h-24 focus:bg-white focus:ring-2 focus:ring-blue-100 transition" 
                rows={1} 
              />
              <button onClick={() => handleUserSend('text')} className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition shadow-md ${input.trim() ? 'bg-blue-500 hover:bg-blue-600 scale-100' : 'bg-gray-300 scale-90'}`} disabled={!input.trim()}>↑</button>
            </div>
            {showPlusMenu && (
              <div className="flex justify-around mt-4 pb-2 animate-slideUp border-t pt-3">
                <label className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">📷</div><span className="text-xs text-gray-600">照片</span><input type="file" accept="image/*" className="hidden" onChange={handleImageSend} /></label>
                <div onClick={() => { const text = prompt("输入图片描述:"); if (text) handleUserSend('text', `[FakeImage] ${text}`); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🖼️</div><span className="text-xs text-gray-600">伪图</span></div>
                <div onClick={() => { setShowVoiceInput(true); setVoiceInput(""); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">💬</div><span className="text-xs text-gray-600">语音</span></div>
                <div onClick={() => setShowSongModal(true)} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🎵</div><span className="text-xs text-gray-600">点歌</span></div>
                {activeContact?.history.some(m => m.role === 'assistant') && (<div onClick={() => { handleRegenerateLast(); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🔄</div><span className="text-xs text-gray-600">重roll</span></div>)}
              </div>
            )}
            {showVoiceInput && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                <div className="w-full bg-white rounded-t-3xl p-6 animate-slideUp">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">录音消息</h3><button onClick={() => setShowVoiceInput(false)} className="text-gray-500 text-xl hover:text-gray-700">✕</button></div>
                  <textarea value={voiceInput} onChange={e => setVoiceInput(e.target.value)} placeholder="输入你要说的语音内容..." className="w-full p-4 border rounded-xl resize-none h-32 outline-none" autoFocus />
                  <div className="flex gap-3 mt-4"><button onClick={() => setShowVoiceInput(false)} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition">取消</button><button onClick={sendVoiceMessage} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition">发送</button></div>
                </div>
              </div>
            )}
          </div>
        )}




{showPersonaPanel && activeContact && (
       <PersonaPanel
                contact={activeContact}
                globalSettings={globalSettings}
                setContacts={setContacts}
                onClose={() => setShowPersonaPanel(false)}
                playMessageAudio={playMessageAudio}
// 这是一行代码：【修复版】把 PersonaPanel 的跳转功能正确连接到 App 的设置开关
onNavigateToSettings={onOpenSettings}
                onRefineMemory={handleRefineMemory}
                
                // ★★★ 核心修复：把所有 sampleText 相关名字统一 ★★★
                // 确保这里用的是 panelSampleText 和 setPanelSampleText
                activeTab={panelTab}
                setActiveTab={setPanelTab}
                memoryTab={memoryTab}
                setMemoryTab={setMemoryTab}
                sampleText={panelSampleText}
                setSampleText={setPanelSampleText} 
onForceUpdate={async () => {
                    try {
                        const currentContact = contacts.find(c => c.id === activeContact.id);
                        
                        // 1. 检查钱够不够
                        if (!currentContact || (currentContact.interventionPoints || 0) < 1) {
                            throw new Error("点数不足！请多聊几句赚取点数吧~");
                        }

                        // 2. 准备数据
                        // 哪怕只聊了一句，只要付费了，就强制分析最近30条，不看未归档标记
                        const historySlice = currentContact.history.slice(-30); 
                        const nextThreshold = Math.floor(Math.random() * 71) + 70;

                        // 3. ★★★ 核心修复：传入 true (代表这是付费刷新！) ★★★
                        await updateUserProfile(currentContact, historySlice, nextThreshold, true);
                        
                        alert("✅ 刷新成功！\n\n消耗 1 点数。\nAI 的新印象已生成，请在“印象集”里查看！");
                    } catch (e: any) {
                        alert(`❌ 刷新失败！\n\n错误信息: ${e.message}\n\n(点数未扣除)`);
                        throw e;
                    }
                }}
            />
        )}





{showTokenModal && activeContact && (
          <TokenDetailModal
            onClose={() => setShowTokenModal(false)}
            form={activeContact} // 或者是 editForm
            activeContact={activeContact}
            worldBooks={worldBooks}
          />
        )}




   






{/* ▼▼▼ 把你的新代码粘贴在这里！▼▼▼ */}
{/* ==================== 漂亮的警告弹窗 ==================== */}
<WarningModal 
  isOpen={showWarningModal}
  onClose={() => setShowWarningModal(false)}
  loverName={warningLoverName}
/>
{/* ▲▲▲ 粘贴到这里结束 ▲▲▲ */}






      </div>



    );


    // ==========================================
// 🧩 图片处理工具箱 (复制到文件最末尾)
// ==========================================
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject("Canvas error"); return; }

        // 限制尺寸，防止图片太大导致卡顿
        const MAX_SIZE = 800; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 压缩质量 0.7
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};
  }





  

  return null;
};


export default GroupChatApp;