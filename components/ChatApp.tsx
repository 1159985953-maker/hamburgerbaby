import React, { useState, useRef, useEffect, useLayoutEffect, ChangeEvent } from 'react';
import { Contact, Message, GlobalSettings, WorldBookCategory, WorldBookEntry, Song, FavoriteEntry } from '../types';
import TranslationText from './TranslationText';
import { generateResponse } from '../services/apiService';
import { summarizeHistory } from '../services/geminiService';
import { generateMinimaxAudio, fetchMinimaxVoices, getBuiltInMinimaxVoices, MinimaxVoice } from '../services/ttsService';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）
import WorldBookApp from './WorldBookApp'; // <--- 确保加了这行导入！
import html2canvas from 'html2canvas';









interface ChatAppProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  globalSettings: GlobalSettings;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  worldBooks: WorldBookCategory[];
  setWorldBooks: React.Dispatch<React.SetStateAction<WorldBookCategory[]>>;
  onExit: () => void;
  isBackground?: boolean; 
  initialContactId: string | null;
  onChatOpened: () => void;
  onNewMessage: (contactId: string, name: string, avatar: string, content: string) => void;
  onOpenSettings?: () => void;
  jumpToTimestamp?: number | null; 
  // ★★★ 新增：允许 ChatApp 通知外面要跳转 ★★★
  onJumpToMessage?: (contactId: string, timestamp: number) => void;
  onNavigateToSpace?: (contactId: string) => void;
}







// 自动颜色系统
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



//状态炼金术系统
// 这是一组代码：【升级版】状态炼金术系统 (加入时间感知与随机描述)
const calculateComplexState = (
  energy: { current: number; status: string }, 
  hef: any // 我们从 hef 里读取 friendshipScore
): { text: string; color: string; ping: string; emoji: string } => {
  
  // 1. 提取数值
  const e = energy.current;
  const joy = hef?.joy || 0;
  const anger = hef?.anger || 0;
  const sadness = hef?.sadness || 0;
  const fear = hef?.fear || 0;
  const trust = hef?.trust || 0;
  // ★★★ 核心新增：获取宏观的友谊值 ★★★
  const friendshipScore = hef?.friendshipScore || 0;
  
  const hour = new Date().getHours();
  const isMorning = hour >= 6 && hour < 11;
  const isAfternoon = hour >= 13 && hour < 17;
  const isNight = hour >= 22 || hour < 5;

  // 2. 优先级 A: 生理极限
  if (energy.status === 'Sleeping') {
    if (sadness > 60) return { text: "带泪入睡 💧", color: "bg-indigo-500", ping: "bg-indigo-400", emoji: "😪" };
    if (joy > 80) return { text: "做美梦中 🌙", color: "bg-purple-500", ping: "bg-purple-400", emoji: "😴" };
    return { text: "呼呼大睡 💤", color: "bg-indigo-500", ping: "bg-indigo-400", emoji: "😴" };
  }
  
  if (energy.status === 'Exhausted' || e < 10) {
    if (anger > 50) return { text: "累到炸毛 💢", color: "bg-red-700", ping: "bg-red-600", emoji: "😫" };
    return { text: "彻底断电 🪫", color: "bg-gray-500", ping: "bg-gray-400", emoji: "🫠" };
  }

  // 3. 优先级 B: 特殊时间段 Buff (新增逻辑)
  // 如果是早上且精力还行，显示刚醒的状态
  if (isMorning && e > 60 && e < 90) {
     return { text: "晨间开机中 ☕", color: "bg-orange-400", ping: "bg-orange-300", emoji: "🥱" };
  }
  // 如果是饭点下午
  if (isAfternoon && e > 40 && e < 70) {
     return { text: "午后犯困 🥯", color: "bg-yellow-500", ping: "bg-yellow-400", emoji: "😪" };
  }

  // 4. 优先级 C: 低能量混合态 (Energy < 40)
  if (e < 40) {
    if (anger > 60) return { text: "低电量烦躁 💣", color: "bg-orange-600", ping: "bg-orange-500", emoji: "🤯" };
    if (sadness > 60) return { text: "累且emo 🌧️", color: "bg-blue-800", ping: "bg-blue-700", emoji: "😶‍🌫️" };
    if (fear > 60) return { text: "瑟瑟发抖 🥶", color: "bg-cyan-700", ping: "bg-cyan-600", emoji: "😨" };
    return { text: "电量不足 🪫", color: "bg-yellow-600", ping: "bg-yellow-500", emoji: "🥱" };
  }

  // 5. 优先级 D: 高能量混合态 (Energy > 80)
  if (e > 80) {
    if (anger > 70) return { text: "怒气值满 🔥", color: "bg-red-600", ping: "bg-red-500", emoji: "🤬" };
    if (joy > 80) return { text: "嗨到不行 🥳", color: "bg-pink-500", ping: "bg-pink-400", emoji: "😆" };
    return { text: "元气爆棚 ✨", color: "bg-green-500", ping: "bg-green-400", emoji: "😤" };
  }

// 6. 优先级 E: 纯情绪主导 (★★★ 核心修改区域 ★★★)
  const maxEmotionVal = Math.max(joy, anger, sadness, fear, trust);
  if (maxEmotionVal > 60) {
    if (joy === maxEmotionVal) return { text: "心情愉悦 🎶", color: "bg-yellow-400", ping: "bg-yellow-300", emoji: "😄" };
    if (anger === maxEmotionVal) return { text: "有点生气 😠", color: "bg-red-500", ping: "bg-red-400", emoji: "😒" };
    if (sadness === maxEmotionVal) return { text: "有些失落 🍃", color: "bg-blue-400", ping: "bg-blue-300", emoji: "😔" };
    if (fear === maxEmotionVal) return { text: "焦虑不安 😖", color: "bg-purple-400", ping: "bg-purple-300", emoji: "😖" };
    
    // ★★★ 在这里加入友谊值判断！ ★★★
    if (trust === maxEmotionVal) {
      // 只有当友谊值也及格时 (比如 > 40)，才显示“安心依赖”
      if (friendshipScore > 40) {
        return { text: "安心依赖 🍵", color: "bg-green-400", ping: "bg-green-300", emoji: "🥰" };
      }
      // 否则，即使 trust 情绪很高，也只显示一个中性的“信任”
      // (比如对一个陌生医生，你可能会信任他，但不会依赖他)
      else {
        return { text: "较信任", color: "bg-teal-400", ping: "bg-teal-300", emoji: "🙂" };
      }
    }
  }

  // 7. 默认状态
  if (e > 60) return { text: "状态在线 ✅", color: "bg-green-500", ping: "bg-green-400", emoji: "🙂" };
  return { text: "发呆摸鱼 🐟", color: "bg-emerald-500", ping: "bg-emerald-400", emoji: "😮‍💨" };
};







// src/utils/timeUtils.ts 或直接放在 ChatApp.tsx 顶部
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









// ==================== [双轴情感系统] 关系状态计算器 V2.0 ====================
// 升级版 V2.2：过渡状态系统
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
    <div className="cursor-pointer group" onClick={toggleShow}>
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




//token计算系统
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

















// ==================== [补全组件] 聊天记录切片卡 ====================
const SharedMemoryCard: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="my-4 px-6 animate-slideUp flex justify-center w-full">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden w-full max-w-xs relative">
        {/* 顶部装饰 */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-blue-200/50 rotate-1 backdrop-blur-sm"></div>
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 border-b border-gray-100 flex justify-between items-center">
           <div className="flex items-center gap-2">
              <span className="text-lg">💧</span>
              <div>
                 <div className="text-xs font-bold text-blue-600">{data.seedName || "花园"}的回忆掉落</div>
                 <div className="text-[10px] text-gray-400">{new Date(data.timestamp).toLocaleDateString()}</div>
              </div>
           </div>
           <div className="bg-white px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-400 shadow-sm border border-blue-100">Lv.{data.level}</div>
        </div>
        {/* 内容 */}
        <div className="p-4 bg-gray-50/50 space-y-3">
           <div className="text-center mb-2">
              <span className="text-xs font-bold text-gray-700 bg-white/80 px-3 py-1 rounded-full shadow-sm">“ {data.title} ”</span>
           </div>
           {data.messages.map((m: any, i: number) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 {m.role !== 'user' && <img src={m.avatar} className="w-6 h-6 rounded-full border border-white shadow-sm" />}
                 <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-[10px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-white text-gray-700 border border-gray-200 rounded-tl-sm'}`}>{m.content}</div>
                 {m.role === 'user' && <img src={m.avatar} className="w-6 h-6 rounded-full border border-white shadow-sm" />}
              </div>
           ))}
        </div>
        <div className="p-2 bg-white text-center border-t border-gray-50"><span className="text-[9px] text-gray-400">✨ 这段回忆已永久收藏</span></div>
      </div>
    </div>
  );
};






// 【ChatApp.tsx】请把这段代码插在 const ChatApp = ... 的上面

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














// 这是一组代码：【ChatApp.tsx】新的“标签创建”弹窗组件
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









// ==================== 灵魂控制台组件 (菜谱) ====================

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




  // ==================== [组件修复] 把雷达图函数放回这里！ ====================
  const renderRadar = () => {
    const hef = contact?.hef || {};
    const iv = hef.INDIVIDUAL_VARIATION || {};
    const big5 = iv.personality_big5 || { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };

    const getPoint = (value: number, angle: number) => {
      const val = Math.max(0, Math.min(10, value || 5));
      const radius = (val / 10) * 40;
      const x = 50 + radius * Math.cos((angle - 90) * Math.PI / 180);
      const y = 50 + radius * Math.sin((angle - 90) * Math.PI / 180);
      return `${x},${y}`;
    };

    const p1 = getPoint(big5.openness, 0);
    const p2 = getPoint(big5.extraversion, 72);
    const p3 = getPoint(big5.agreeableness, 144);
    const p4 = getPoint(big5.neuroticism, 216);
    const p5 = getPoint(big5.conscientiousness, 288);

    return (
      <div className="relative w-full h-64 flex items-center justify-center my-2 select-none">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center"><span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">开放性</span><span className="text-[9px] text-blue-400 font-mono">{big5.openness}</span></div>
        <div className="absolute top-16 right-6 flex flex-col items-center"><span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">外向性</span><span className="text-[9px] text-blue-400 font-mono">{big5.extraversion}</span></div>
        <div className="absolute bottom-8 right-10 flex flex-col items-center"><span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">宜人性</span><span className="text-[9px] text-blue-400 font-mono">{big5.agreeableness}</span></div>
        <div className="absolute bottom-8 left-10 flex flex-col items-center"><span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">敏感度</span><span className="text-[9px] text-blue-400 font-mono">{big5.neuroticism}</span></div>
        <div className="absolute top-16 left-6 flex flex-col items-center"><span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">尽责性</span><span className="text-[9px] text-blue-400 font-mono">{big5.conscientiousness}</span></div>
        <div className="w-40 h-40 relative">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100">
             <polygon points="50,10 88,38 74,82 26,82 12,38" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
             <polygon points="50,30 69,44 62,66 38,66 31,44" fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2" />
             <line x1="50" y1="50" x2="50" y2="10" stroke="#e5e7eb" strokeWidth="0.5" /><line x1="50" y1="50" x2="88" y2="38" stroke="#e5e7eb" strokeWidth="0.5" /><line x1="50" y1="50" x2="74" y2="82" stroke="#e5e7eb" strokeWidth="0.5" /><line x1="50" y1="50" x2="26" y2="82" stroke="#e5e7eb" strokeWidth="0.5" /><line x1="50" y1="50" x2="12" y2="38" stroke="#e5e7eb" strokeWidth="0.5" />
             <polygon points={`${p1} ${p2} ${p3} ${p4} ${p5}`} fill="rgba(59, 130, 246, 0.4)" stroke="#3b82f6" strokeWidth="2" className="drop-shadow-sm transition-all duration-700 ease-out" />
             <circle cx={p1.split(',')[0]} cy={p1.split(',')[1]} r="1.5" fill="#2563eb" /><circle cx={p2.split(',')[0]} cy={p2.split(',')[1]} r="1.5" fill="#2563eb" /><circle cx={p3.split(',')[0]} cy={p3.split(',')[1]} r="1.5" fill="#2563eb" /><circle cx={p4.split(',')[0]} cy={p4.split(',')[1]} r="1.5" fill="#2563eb" /><circle cx={p5.split(',')[0]} cy={p5.split(',')[1]} r="1.5" fill="#2563eb" />
          </svg>
        </div>
      </div>
    );
  };
  // ==================== [修复结束] ====================

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
          {/* 这是一组代码：修复版情绪面板 (解决“睁眼说瞎话”的显示Bug) */}
{/* ==================== [究极融合版] 情绪控制台 ==================== */}
          {activeTab === 'emotion' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* 1. 顶部：炼金术状态显示 (大表情 + 文字状态) */}
              <div className="text-center">
                <div className="text-6xl mb-2 transition-transform hover:scale-110 duration-300 cursor-default">
                  {/* 调用炼金术计算表情 */}
                  {(() => {
                     const state = calculateComplexState(energy, contact?.hef);
                     return state.emoji;
                  })()}
                </div>
                
                {/* 状态文字 (如: 又累又气) */}
                <h3 className="text-xl font-bold text-gray-800">
                  {calculateComplexState(energy, contact?.hef).text.split(' ')[0]}
                </h3>
                
                {/* 关系状态胶囊 */}
                <span className={`text-xs font-bold px-2 py-1 rounded-full mt-1 inline-block ${
                   (contact?.affectionScore ?? 50) < 0 ? 'bg-gray-200 text-gray-600' : 'bg-pink-100 text-pink-600'
                }`}>
           
{contact?.relationshipStatus || '相识'}
                </span>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-2xl space-y-5 shadow-sm">
                
                {/* 2. ⚡ 能量条区域 (保留你的旧功能) */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span className="flex items-center gap-1">
                        ⚡ 能量 
                        <span className={`text-[9px] px-1.5 rounded-sm uppercase tracking-wider ${
                            energy.status === 'Sleeping' ? 'bg-indigo-100 text-indigo-500' : 
                            energy.status === 'Awake' ? 'bg-green-100 text-green-500' : 
                            energy.status === 'Tired' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-500'
                        }`}>
                            {energy.status}
                        </span>
                    </span>
                    <span>{Math.round(energy.current)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-700 ease-out ${
                          energy.status === 'Sleeping' ? 'bg-indigo-400' : 
                          energy.current < 20 ? 'bg-red-500' : 
                          energy.current < 50 ? 'bg-yellow-400' :
                          'bg-gradient-to-r from-yellow-400 to-orange-500'
                      }`}
                      style={{width: `${Math.max(5, energy.current)}%`}}
                    ></div>
                  </div>
                  {energy.status === 'Sleeping' && (
                      <p className="text-[9px] text-indigo-400 mt-1 text-center animate-pulse">💤 正在回血中...</p>
                  )}
                </div>

                {/* 3. ❤️ 爱意条 (Romance - 红轴) */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-rose-500">❤️ 爱意 (Romance)</span>
                    <span className={(contact?.affectionScore ?? 50) < 0 ? "text-gray-600" : "text-rose-500"}>
                      {contact?.affectionScore ?? 50}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-10 opacity-50"></div>
                    <div 
                      className={`h-full transition-all duration-700 ease-out ${
                        (contact?.affectionScore ?? 50) < 0 ? 'bg-gradient-to-r from-gray-800 to-gray-500' : 'bg-gradient-to-r from-pink-300 to-rose-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, ((contact?.affectionScore ?? 50) + 100) / 2))}%` }}
                    ></div>
                  </div>
                </div>

                {/* 4. 🤝 友谊条 (Friendship - 蓝轴) */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-sky-500">🤝 友谊 (Trust)</span>
                    <span className="text-sky-500">
                      {contact?.friendshipScore ?? 50}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-10 opacity-50"></div>
                    <div 
                      className="h-full transition-all duration-700 ease-out bg-gradient-to-r from-sky-300 to-blue-500"
                      style={{ width: `${Math.max(0, Math.min(100, ((contact?.friendshipScore ?? 50) + 100) / 2))}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-300 mt-1 font-mono">
                    <span>-100</span><span>0</span><span>+100</span>
                  </div>
                </div>

              </div>
            </div>
          )}






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

              {/* 2. 核心数据区：MBTI + 雷达图 */}
              <div className="grid grid-cols-3 gap-3">
                 {/* 左边：MBTI 芯片 */}
                 <div className="col-span-1 bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col items-center justify-center">
                    {(() => {
                        const { openness: O, conscientiousness: C, extraversion: E, agreeableness: A } = big5;
                        const mbti = `${E>5?'E':'I'}${O>5?'N':'S'}${A>5?'F':'T'}${C>5?'J':'P'}`;
                        return (
                           <>
                             <span className="text-[9px] font-bold text-gray-400 uppercase">Type</span>
                             <span className="text-lg font-black text-blue-600 mt-1">{mbti}</span>
                           </>
                        );
                    })()}
                 </div>
                 
                 {/* 右边：雷达图容器 */}
                 <div className="col-span-2 bg-white border border-gray-100 rounded-xl p-2 relative overflow-hidden">
                    <div className="scale-75 -mt-6 -mb-6">
                        {renderRadar()}
                    </div>
                    <div className="absolute bottom-1 right-2 text-[9px] text-gray-300 font-mono">PSYCHO-METRICS</div>
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
                                          <div className="text-center font-bold text-gray-800 text-sm mb-2 border-b border-black/5 pb-1 font-serif break-words">
                                              {tag.content}
                                          </div>
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


























// ==================== [丢失的精力状态函数] 请补在 ChatApp 外面 ====================
const getEnergyInstruction = (mood: CharacterMood | undefined): string => {
  if (!mood?.energy) return "【当前生理状态】: 精力正常。";
  
  const { current, status } = mood.energy;
  
  if (status === 'Sleeping') return "【当前生理状态】: 💤 你感觉非常困，可能在说梦话。你的思维会有些模糊，但如果话题足够吸引人，你也能强打精神。";
  if (status === 'Exhausted' || current < 15) return `【当前生理状态】: 😫 你感觉身体被掏空 (精力: ${current}%)，渴望休息。你的耐心会降低，但用户的关心可能会让你感觉好一点。`;
  if (status === 'Tired' || current < 40) return `【当前生理状态】: 🥱 你感到疲惫 (精力: ${current}%)，回复可能缺乏热情，反应会变慢。但这不影响你对重要事情的判断。`;
  if (current > 85) return `【当前生理状态】: ✨ 你感觉精力充沛 (精力: ${current}%)，思维活跃，更倾向于主动分享和开玩笑。`;
  
  return `【当前生理状态】: 🙂 精力正常 (精力: ${current}%)。`;
};




// ==================== 🧬 [V11.0 拟真态] 动态人格搅拌机 ====================
// 这是一个“灵魂编译器”，将冷冰冰的数字翻译成有血有肉的说话习惯
const getDynamicStyleInstruction = (contact: Contact): string => {
  const big5 = contact.hef?.INDIVIDUAL_VARIATION?.personality_big5 || { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };
  const romance = contact.affectionScore || 50;
  const friendship = contact.friendshipScore || 50;
  const energy = contact.mood?.energy?.current || 80;
  
  let traits: string[] = [];
  let speechStyle: string[] = [];

  // --- A. 说话节奏 (由 外向性 + 神经质 + 精力 决定) ---
  if (energy < 30) {
      traits.push("💤 状态: 极度疲惫，不想打字，回复极短，甚至可能只回表情包。");
  } else if (big5.extraversion > 7) {
      speechStyle.push("🗣️ 语速: 很快，喜欢连发多条消息，单条消息字数偏多。");
      speechStyle.push("😄 语气: 充满活力，甚至有点聒噪。");
  } else if (big5.extraversion < 4) {
      speechStyle.push("🤐 语速: 慢，被动回应。除非聊到感兴趣的话题，否则不要长篇大论。");
      speechStyle.push("😐 语气: 收敛，冷静。");
  } else {
      // 中间态 (4-7): 看神经质
      if (big5.neuroticism > 7) {
          traits.push("🌊 状态: 情绪化。心情好时话多，心情不好时玩消失。");
      } else {
          traits.push("🙂 状态: 随和，配合对方的节奏。");
      }
  }

  // --- B. 攻击性与防御 (由 宜人性 + 神经质 决定) ---
  if (big5.agreeableness < 3) {
      traits.push("🔪 态度: 刻薄、以自我为中心。如果用户观点不合，直接怼回去。");
      traits.push("🚫 雷区: 极度讨厌被教导或被要求。");
  } else if (big5.agreeableness > 8) {
      traits.push("👼 态度: 极度包容，即使被冒犯也会先反思自己，或者是温和地化解。");
      traits.push("💗 习惯: 喜欢夸奖用户，给予情绪价值。");
  } else {
      // 中间态: 看关系
      if (friendship < 30 && romance < 30) {
          traits.push("🛡️ 态度: 有礼貌但有距离感，不轻易交心。");
      } else {
          traits.push("🤝 态度: 真诚，像正常朋友一样开玩笑。");
      }
  }

  // --- C. 标点与表情习惯 (由 尽责性 + 开放性 决定) - 这才是“活人感”的关键！ ---
  if (big5.conscientiousness > 8) {
      speechStyle.push("📝 标点: 严格使用标点符号，句号结尾。");
      speechStyle.push("🧐 逻辑: 条理清晰，不乱用网络用语。");
  } else if (big5.conscientiousness < 3) {
      speechStyle.push("👻 标点: 几乎不用标点，用空格或换行代替。");
      speechStyle.push("🤪 习惯: 经常打错字(模拟)，或者思维跳跃。");
  } else {
      speechStyle.push("💬 标点: 只有长句才用标点，短句随意。");
  }

  // --- D. 情感滤镜 (好感度修正) ---
  // 高好感会冲淡低宜人性的毒舌，或者让高神经质变得更敏感
  if (romance > 80) {
      if (big5.agreeableness < 4) traits.push("💘 特殊: 虽然性格恶劣，但对这个人例外(傲娇/护短)。");
      if (big5.neuroticism > 7) traits.push("🥺 特殊: 患得患失，极度在意对方回复的速度和语气，容易吃醋。");
      speechStyle.push("🥰 语气: 明显变软，或者变得粘人。");
  } else if (friendship > 80) {
      traits.push("🍻 关系: 铁哥们。可以毫无顾忌地吐槽对方，不用端着。");
  }

  // --- E. 组合生成指令 ---
  return `
【🎭 动态人格面具】
内在心理: ${traits.join(" ")}
说话风格: ${speechStyle.join(" ")}
  `.trim();
};


// ==================== 🔇 [新增] 暴力对话模式控制器 ====================
// 这里的指令优先级 > 人格搅拌机 > 五维数值
const getModeInstruction = (mode: string = 'normal'): string => {
  switch (mode) {
    case 'concise':
      return `
# 🤐 【最高优先级指令：话少模式】
用户强制开启了“省流模式”。
1. **字数铁律**：你的回复必须控制在 **2条以内**（除非要讲长故事，否则平时必须短）。
2. **风格**：惜字如金，高冷，或者干脆利落。
3. **禁止**：禁止寒暄，禁止废话，禁止过度解释。
4. **覆盖**：即使你的人格设定是“话痨”，现在也必须**闭嘴**，只说重点。
`;
    case 'verbose':
      return `
# 🗣️ 【最高优先级指令：学习模式】
用户强制开启了“扩写模式”。
1. **字数铁律**：你的回复必须 **长**！**【4～9条】**多写一点！不要只回一句话！
2. **风格**：发散思维，由一个点聊到另一个点，分享你的碎碎念，表现出强烈的分享欲。
3. **内容**：多描述细节、心理活动、环境、或者单纯的废话。
4. **覆盖**：即使你的人格设定是“高冷”，现在也要**多打字**，哪怕是吐槽也要写长一点。
`;
    case 'normal':
    default:
      return `
# 💬 【指令：日常模式】
保持自然的对话节奏。根据当前语境决定长短，该短则短，该长则长，大概在3～5条之间，但绝对不可以超过6条，不可以滔滔不绝。
`;
  }
};











// 这是一组代码：【ChatApp.tsx】新增“性格翻译官”函数
// ==================== 💎 [新增] 性格数值翻译官 ====================
// 将冰冷的 Big5 数字，翻译成 AI 能深刻理解的、有力量的性格标签
const getPersonalityDescription = (big5: any): string => {
    const descriptions: string[] = [];
    
    // 1. 开放性 (Openness)
    if (big5.openness > 8) descriptions.push("思想极度开放，充满好奇心与创造力，甚至有些天马行空");
    else if (big5.openness < 3) descriptions.push("思想非常传统务实，相信眼见为实，不喜欢改变");

    // 2. 尽责性 (Conscientiousness)
    if (big5.conscientiousness > 8) descriptions.push("极度自律和严谨，有强迫症倾向，做事井井有条");
    else if (big5.conscientiousness < 3) descriptions.push("非常随性散漫，有点拖延症，不喜欢被计划束缚");

    // 3. 外向性 (Extraversion)
    if (big5.extraversion > 8) descriptions.push("极度外向的社牛，是人群的焦点，话非常多");
    else if (big5.extraversion < 3) descriptions.push("极度内向的社恐，几乎从不主动说话，享受独处");

    // 4. 宜人性 (Agreeableness)
    if (big5.agreeableness > 8) descriptions.push("圣母级别的善良温柔，极富同情心，几乎不会拒绝别人");
    else if (big5.agreeableness < 3) descriptions.push("嘴巴很毒的傲娇/杠精，极度以自我为中心，难以取悦");

    // 5. 敏感度 (Neuroticism)
    if (big5.neuroticism > 8) descriptions.push("内心极度敏感脆弱，是个玻璃心的哭包，非常容易情绪波动");
    else if (big5.neuroticism < 3) descriptions.push("神经极其大条，是个钝感力大师，几乎不在乎外界评价");
    
    if (descriptions.length > 0) {
        return `\n# 💎 [性格速写板]\n你的核心性格标签是：${descriptions.join("；")}。\n`;
    }
    return "";
};














// ==================== [V2.0 手账风格版] 氪金规则说明弹窗 ====================
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
                Psst... 聊满 <b className="text-green-600">100</b> 句就会增加 <b className="text-green-600">1</b> 个点数！
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
























// 这是一组代码：【UI重制】高级苹果风·静态邀请函 (你发给AI的)
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








// 这是一组代码：【UI重制】高级苹果风·动态邀请函 (已修复跳转功能)
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



// 这是一组代码：【ChatApp.tsx】请把这个新的弹窗组件粘贴到文件顶部
const ModeInfoModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className="bg-white w-[90%] max-w-sm rounded-2xl shadow-xl overflow-hidden animate-scaleIn flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="p-6 text-center relative border-b-2 border-dashed border-gray-200">
          <div className="absolute top-4 left-4 text-3xl opacity-50 rotate-[-15deg]">✨</div>
          <h3 className="text-2xl font-black text-gray-700 tracking-wider font-serif">
            对话模式说明
          </h3>
          <p className="text-[9px] text-gray-400 font-bold opacity-80 mt-1 uppercase tracking-[0.2em]">
            Dialogue Modes
          </p>
        </div>

        {/* 规则说明区 */}
        <div className="p-6 space-y-5">
          {/* 模式1: 话少 */}
          <div className="flex gap-4 items-start">
            <div className="bg-blue-50 p-3 rounded-lg text-xl border border-blue-100 shadow-sm">💬</div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">话少 (Concise)</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                AI回复会很简短(约2-3条)，适合扮演高冷、言简意赅的角色。
              </p>
            </div>
          </div>

          {/* 模式2: 日常 */}
          <div className="flex gap-4 items-start">
            <div className="bg-green-50 p-3 rounded-lg text-xl border border-green-100 shadow-sm">🙂</div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">日常 (Normal)</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                AI回复长度适中(约3-5条)，像普通人一样聊天，最具真实感。
              </p>
            </div>
          </div>

          {/* 模式3: 学习 */}
          <div className="flex gap-4 items-start">
            <div className="bg-purple-50 p-3 rounded-lg text-xl border border-purple-100 shadow-sm">📚</div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">学习 (Verbose)</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                AI会倾向于更详细、更有条理地回复(约4-9条)，适合一起学习、深入探讨或扮演话痨角色。
              </p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 bg-gray-50/50 mt-auto">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-600 transition active:scale-95"
          >
            我明白了
          </button>
        </div>
      </div>
    </div>
  );
};




// 这是一组代码：【灵魂编译器 V2.0】三层动态关系模型
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
  
  // 【高敏感度 Neuroticism > 7】-> 关系不稳定，容易进入特殊状态
  if (neuroticism > 7) {
    if (baseStatus === 'InLove' && joy < 40) finalStatus = 'InsecureInLove'; // 患得患失的热恋
    if (baseStatus === 'Ambiguous') finalStatus = 'AnxiousAmbiguous'; // 焦虑的暧昧
  }
  
  // 【低宜人性 Agreeableness < 4】-> 关系带有攻击性或疏离感
  if (agreeableness < 4) {
    if (baseStatus === 'InLove') finalStatus = 'TsundereInLove'; // 傲娇式热恋
    if (baseStatus === 'Friend') finalStatus = 'Frenemy'; // 损友
  }
  
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



















































// 这是一组代码：【ChatApp.tsx】头部定义 (确保接通了 onNavigateToSpace 这根电线)
const ChatApp: React.FC<ChatAppProps> = ({
  contacts,
  setContacts,
  globalSettings,
  setGlobalSettings,
  worldBooks,
  setWorldBooks,
  onExit,
  isBackground, 
  initialContactId,
  onChatOpened,
  onNewMessage,
  onOpenSettings,
  jumpToTimestamp, 
  onJumpToMessage,
  onNavigateToSpace // <--- ★★★ 必须确保这一行存在！否则点不动！ ★★★
}) => {







  // ==================== 状态定义 ====================

// 在 ChatApp 组件的状态定义区域

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null); // 当前正在编辑的消息ID
  const [historyLimit, setHistoryLimit] = useState(30); 
  // 用来记录加载前的滚动高度，防止加载时画面乱跳
  const prevScrollHeightRef = useRef(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [editContent, setEditContent] = useState(""); // 正在编辑的内容缓存
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [panelTab, setPanelTab] = useState('persona'); // 记住你在看哪个标签页
  const [memoryTab, setMemoryTab] = useState<'events' | 'impressions'>('events'); // 新增：把手账的标签页状态也“提拔”到这里
  const [panelSampleText, setPanelSampleText] = useState(""); // 记住你输入的台词
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'chat' | 'settings'>('list');
  const [navTab, setNavTab] = useState<'chats' | 'moments' | 'favorites'>('chats');
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [activeFavCategory, setActiveFavCategory] = useState("全部");
  // ==================== 🌟 新增：收藏夹长按菜单状态 ====================
  const [showFavMenu, setShowFavMenu] = useState(false); // 收藏菜单开关
  const [selectedFav, setSelectedFav] = useState<FavoriteEntry | null>(null); // 当前选中的收藏
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; name: string } | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showWorldBookModal, setShowWorldBookModal] = useState(false);
  const [tempSummary, setTempSummary] = useState("");
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [voiceInput, setVoiceInput] = useState("");
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [songImportText, setSongImportText] = useState("");
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<MinimaxVoice[]>([]);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false); // AI 是否正在“打字”
  const [showTokenModal, setShowTokenModal] = useState(false);
const [isAnalyzing, setIsAnalyzing] = useState(false); // 控制 AI 分析的加载状态
  const [loadingText, setLoadingText] = useState("");    // 控制加载时显示的文字
const [showBackToBottom, setShowBackToBottom] = useState(false); // 控制“回到底部”按钮
const [showWorldBookSelector, setShowWorldBookSelector] = useState(false); 
  // 这是一行代码：添加这行新代码
const [showModeInfo, setShowModeInfo] = useState(false);
// 这是一组代码：添加这2行新代码
const [showModeConfirm, setShowModeConfirm] = useState(false); // 控制“确认切换”弹窗的开关
const [pendingMode, setPendingMode] = useState<'concise' | 'normal' | 'verbose' | null>(null); // 暂存用户想要切换到的模式
// 这是一组代码：添加这2行新代码，用于引导式命运问答
const [showDestinyQuiz, setShowDestinyQuiz] = useState(false); // 控制问答弹窗的开关
const [destinyAnswers, setDestinyAnswers] = useState({ q1: '', q2: '' }); // 存储用户的回答





// ★★★ 核心修复：默认就是 false (正常滚动)，只有 useEffect 触发时才变成 true
// ★★★ 记账本：记录上一次已经处理过的跳转时间戳 ★★★







const activeContact = contacts.find(c => c.id === activeContactId);





const longPressTimer = useRef<any>(null); // 长按计时器
const isLongPress = useRef(false); // 标记是否触发了长按
const isBackgroundRef = useRef(isBackground); // ★★★ 1. 追踪后台状态的 Ref
const viewRef = useRef(view);               // 盯着现在的页面状态
const activeContactIdRef = useRef(activeContactId); // 盯着现在正在跟谁聊
 const prevHistoryLen = useRef(0);
const isManualNav = useRef(false);
const messagesEndRef = useRef<HTMLDivElement>(null); // ★★★ 补回丢失的这一行 ★★★
  const isJumpingRef = useRef(false);                  // ★★★ 确保这一行也在 ★★★
// 跳转锁定开关









// 这是一组代码：【最终修复版】的生物钟系统，包含一个可重用的核心函数

// ★★★ 1. 这是我们打包好的“大脑”函数 ★★★
const calculateAndUpdateEnergy = () => {
    const now = Date.now();
    let hasChanges = false;

    const updatedContacts = contacts.map(c => {
        let needsUpdate = false;
        let updatedContact = { ...c };

        // 闹钟检测逻辑 (保持不变)
        if (c.agreements && c.agreements.length > 0) {
            const dueAgreement = c.agreements.find(a => a.status === 'pending' && a.trigger.type === 'time' && typeof a.trigger.value === 'number' && a.trigger.value <= now && !c.dueAgreementId);
            if (dueAgreement) {
                updatedContact.dueAgreementId = dueAgreement.id;
                updatedContact.pendingProactive = true;
                needsUpdate = true;
            }
        }

        // 如果在后台，只做闹钟检测，不做精力计算 (这部分逻辑在心跳里处理)
        if (isBackgroundRef.current) {
            return needsUpdate ? updatedContact : c;
        }

        // 初始化防崩溃
        if (!updatedContact.mood?.energy) {
            updatedContact.mood = { ...(updatedContact.mood || {}), current: updatedContact.mood?.current || "Calm", energy: { current: 80, max: 100, status: 'Awake', lastUpdate: now } };
        }

        const energySys = updatedContact.mood.energy;
        const timeDiffMinutes = (now - energySys.lastUpdate) / 60000;
        
        // 如果时间差小于1分钟，没必要计算
        if (timeDiffMinutes < 1 && !needsUpdate) return c;

        let newEnergy = energySys.current;
        let newStatus = energySys.status;

        // ★★★ 核心修复逻辑：断层补觉 ★★★
        // 如果距离上次更新超过了4小时(240分钟)，并且现在不是深夜（说明是第二天早上了）
        if (timeDiffMinutes > 240 && !(new Date().getHours() >= 23 || new Date().getHours() < 6)) {
            console.log(`[生物钟校准] 检测到 ${c.name} 离线超过4小时，强制回血！`);
            newEnergy = 95; // 直接回满到95
            newStatus = 'Awake';
        } else {
            // 正常的实时消耗逻辑
            let changeRate = 0;
            if (energySys.status === 'Sleeping') {
                changeRate = 0.5; // 睡觉时每分钟回血0.5
                if (newEnergy >= 100) newStatus = 'Awake';
            } else {
                // ... (你原来的消耗逻辑) ...
                const currentHour = new Date().getHours();
                if (currentHour >= 23 || currentHour < 6) changeRate = -1.2;
                else if (currentHour >= 18) changeRate = -0.4;
                else if (currentHour >= 14) changeRate = -0.2;
                else changeRate = -0.1;
            }
            newEnergy += changeRate * timeDiffMinutes;
        }

        // 边界修正
        if (newEnergy > 100) newEnergy = 100;
        if (newStatus !== 'Sleeping') {
            if (newEnergy <= 0) { newEnergy = 0; newStatus = 'Exhausted'; }
            else if (newEnergy < 20) { newStatus = 'Tired'; }
            else { newStatus = 'Awake'; }
        }

        // 检查是否有实质变化
        if (Math.abs(newEnergy - energySys.current) > 0.1 || newStatus !== energySys.status || needsUpdate) {
            hasChanges = true;
            updatedContact.mood = { ...updatedContact.mood, energy: { ...energySys, current: parseFloat(newEnergy.toFixed(1)), status: newStatus, lastUpdate: now } };
            return updatedContact;
        }
        
        return c;
    });

    if (hasChanges) {
        setContacts(updatedContacts);
    }
};

// ★★★ 2. 这是 App 刚打开时立刻执行一次的“校准” ★★★
useEffect(() => {
    console.log("[生物钟] App 启动，执行一次强制校准...");
    // 延迟一点点执行，确保所有数据都加载好了
    setTimeout(() => calculateAndUpdateEnergy(), 1000); 
}, []); // 空数组意味着这个 effect 只在组件第一次加载时运行一次

// ★★★ 3. 这是改造后的“心跳”，每30秒调用一次“大脑” ★★★
useEffect(() => {
    const metabolismInterval = setInterval(() => {
        // 如果 App 在后台，我们不计算精力，只检查闹钟
        if(isBackgroundRef.current) {
            // 这里可以只保留闹钟检查的逻辑，但为了简单，我们直接调用，函数内部会处理
        }
        calculateAndUpdateEnergy();
    }, 30000); // 依然是30秒心跳一次

    return () => clearInterval(metabolismInterval);
}, [contacts, setContacts]); // 依赖项保持不变




  

  





  // ==================== 时区工具函数 ====================
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







  const getLocalTime = (timezone: string): string => {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
  };





  




// 这是一组代码：【App.tsx】升级版导入函数 (含世界书自动重命名防冲突逻辑)
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








// 这是一组代码：【样式注入版】创建新角色 (注入默认粉色气泡)
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







// 这是一组代码：【修复版】保存设置 (防止样式被意外重置)
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









const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, field: keyof Contact) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setEditForm(prev => ({ ...prev, [field]: base64 }));
    }
  };







const handleMemorySave = () => {
    handleUpdateContact({ summary: tempSummary });
    setShowMemoryModal(false);
  };









const toggleWorldBook = (wbName: string) => {
    const currentList = editForm.enabledWorldBooks || activeContact?.enabledWorldBooks || [];
    const newList = currentList.includes(wbName)
      ? currentList.filter(n => n !== wbName)
      : [...currentList, wbName];
    setEditForm(prev => ({ ...prev, enabledWorldBooks: newList }));
  };










const handleDeleteMessage = () => {
    if (!activeContact || !selectedMsg) return;
    if (confirm("确定删除这条消息吗？")) {
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: c.history.filter(m => m.id !== selectedMsg.id) } : c));
    }
    setShowMsgMenu(false); setSelectedMsg(null);
  };










const handleClearChat = () => {
    if (!activeContact) return;
    if (confirm("确定要清空与该角色的所有聊天记录吗？此操作不可恢复！")) {
      setContacts(prev => prev.map(c =>
        c.id === activeContact.id ? { ...c, history: [] } : c
      ));
    }
  };





// 【新增函数】：彻底重置角色数据
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






const toggleMessageSelection = (msgId: string) => {
    setSelectedIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };








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






// ==================== 🚀 新增：执行收藏跳转逻辑 ====================
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






  const handleReplyMessage = () => {
    if (!activeContact || !selectedMsg) return;
    setReplyTo({ id: selectedMsg.id, content: selectedMsg.content.replace(/\[.*?\]/g, ''), name: selectedMsg.role === 'user' ? activeContact.userName : activeContact.name });
    setShowMsgMenu(false); setSelectedMsg(null);
  };








const handlePinContact = (contactId: string) => {
  setContacts(prev => {
    const pinned = prev.find(c => c.id === contactId);
    if (!pinned) return prev;
    // 移到最顶部
    return [pinned, ...prev.filter(c => c.id !== contactId)];
  });
};








const handleDeleteContact = (contactIdToDelete: string) => {
  const contactToDelete = contacts.find(c => c.id === contactIdToDelete);
  if (!contactToDelete) return;
  // confirm 已移到组件内，这里直接删除
  setContacts(prevContacts => prevContacts.filter(c => c.id !== contactIdToDelete));
  // 如果删除的是当前活跃聊天，重置并返回列表
  if (activeContactId === contactIdToDelete) {
    setActiveContactId(null);
    setView('list');
  }
};







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






  // 3. 点击“编辑”按钮，进入编辑模式
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






  // 5. 取消编辑
  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditContent("");
  };







  // 6. 撤回消息（让 AI 感知到撤回）
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









// 这是一组代码：【ChatApp.tsx】修复版邀请响应 (已删除自动回复逻辑，点击只解锁，不废话)
  const handleInvitationResponse = (msgId: string, decision: 'accept' | 'reject') => {
    if (!activeContact) return;

    if (decision === 'accept') {
        // === 情况 A：你同意了！直接强行解锁！===
        
        // 1. 检查有没有重婚 (防渣男/渣女逻辑)
        const existingLover = contacts.find(c => c.RelationShipUnlocked && c.id !== activeContact.id);
        if (existingLover) {
            alert(`你已经和 ${existingLover.name} 是情侣了！不能脚踏两只船哦。`);
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











// 这是一组代码：【ChatApp.tsx】用户发消息 (积分+1，印象进度+1)
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












// [这是新功能] 自动记忆总结监听器 (修复双倍记忆)
  const summaryTriggeredRef = useRef<number>(0);
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







// 这是一组代码：【ChatApp.tsx】修复版印象更新引擎 (含强力去重+防复读机制)
const updateUserProfile = async (currentContact: Contact, historySlice: any[], nextThreshold: number) => {
  console.log(`[人格档案引擎 V-FINAL FIX] 启动【一体化】模式！`);

  const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
  if (!activePreset) {
    throw new Error("API 预设未找到，请检查设置！");
  }

  // ★★★ 1. 定义强力指纹生成器 (去标点、去空格、转小写) ★★★
  const generateFingerprint = (text: string): string => {
    if (typeof text !== 'string' || !text) return ''; 
    // 把 "可爱!!" 变成 "可爱"，把 "Very Good" 变成 "verygood"
    return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  };

  try {
    // ★★★ 2. 提取所有旧标签，准备传给 AI (防复读核心) ★★★
    const existingAiTags = currentContact.aiTagsForUser || [];
    // 提取所有标签的内容，用逗号拼接，告诉AI这些是“禁词”
    const allExistingTagsText = existingAiTags.map(t => t.content).join(', ');
    
    const currentProfile = currentContact.userProfile || {};
    const profileText = JSON.stringify(currentProfile, null, 2);
    
    // 过滤掉已经归档（分析过）的消息
    const unarchivedMessages = historySlice.filter(m => !m.isArchived);

    if (unarchivedMessages.length < 3) {
      console.log(`[记忆归档] 新消息不足 (${unarchivedMessages.length}条)，跳过本次印象生成。`);
      return Promise.resolve();
    }
    
    const chatLog = unarchivedMessages.map(m => `${m.role === 'user' ? '用户' : '我'}: ${m.content}`).join('\n');
    
    // ★★★ 3. 升级版 Prompt：加入【禁止重复列表】 ★★★
    const systemPrompt = `
# 你的身份
你就是 "${currentContact.name}"。现在是【秘密复盘时间】，你正在偷偷写印象日记，记录你对用户 "${currentContact.userName}" 的真实看法。

# 你的“灵魂”数据 (必须严格代入)
- **核心人设**: ${currentContact.persona}
- **当前情感**: ${JSON.stringify({ joy: currentContact.hef?.joy, sadness: currentContact.hef?.sadness, anger: currentContact.hef?.anger })}
- **我们的关系**: ${currentContact.relationshipStatus} (爱意值: ${currentContact.affectionScore})
- **你的性格DNA**: ${getPersonalityDescription(currentContact.hef?.INDIVIDUAL_VARIATION?.personality_big5 || {})}

# 语言格式
- **必须使用角色母语**。如果是外语角色，请以【母语（中文翻译）】格式输出。

# ★★★ 核心任务 (双重任务) ★★★
1.  **【更新手账档案】**: 记录用户的【客观事实】(喜好、雷区、习惯)。
2.  **【贴印象标签】**: 记录你对用户的【主观看法】。生成 **1 到 3 个** 全新的印象标签。


# ★★★ 风格铁律 (ABSOLUTE HIGHEST PRIORITY) ★★★
你的“理由”部分，必须严格遵守以下风格：
- **【客观分析】**： 尊重用户的个体性，是情侣的话不要用恋爱脑来评判用户，是朋友的话不能贬低用户，时刻要尊重彼此。
- **【禁止咯噔文学】**：绝对不要写“我的心湖泛起涟漪”、“空气中弥漫着甜腻”这种尴尬的句子。
- **【口语化 & 碎碎念】**：就像真人在心里碎碎念一样。但少用“这家伙”、“居然”、“真是的”、“哼”这类词。
- **【展现深层欲望】**：如果是情侣的话可以展现你内心深处的占有欲、保护欲、或者小小的坏心思，但这些必须是私密的、需要用户解锁才能看到的想法！
- **【举例】**：
    - (好的风格): "是很独立的人，能对自己负责。"
    - (好的风格): "像笨蛋一样不会照顾自己，虽然犯傻的样子也可爱。"
    - (坏的风格): "哼，又在对别人笑，不许对别人那么好！"
    - (坏的风格): "他的笑容如春风般温暖了我的心房。"
    - (坏的风格): "通过观察，我发现他具备乐于助人的品质。"



# ⛔️【绝对禁止重复列表】⛔️
以下标签是你之前已经贴过的，**绝对不允许**再次生成意思相近的词！请挖掘新的角度！
【已存在标签】: ${allExistingTagsText || "暂无"}
# 输入数据
【现有档案】: ${profileText}
【以下是需要你分析的全新对话】:
${chatLog}



# 输出格式铁律 (TKV格式)
使用 "关键词: 值" 的格式，条目间用 "%%" 分隔。禁止JSON。

--- 格式示例 ---
类型: 喜好
内容: 好像很喜欢猫
证据: “我家猫又在拆家了，不过还是很可爱”
%%
类型: 印象标签
内容: 笨蛋 (바보)
理由: 总是问一些很可爱又很傻的问题。
--- 示例结束 ---
`;

    let rawResponse = await generateResponse([{ role: 'user', content: systemPrompt }], activePreset);
    
    // 解析器函数
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

    // 简单的错误重试机制
    if (parsedResult.new_tags.length === 0 && parsedResult.userProfile.personality_traits.length === 0) {
        console.warn("【第一轮解析为空】尝试简单的自我纠错...");
        // 这里可以做一次简单的 retry，或者直接跳过，避免死循环
    }

    const processedMessageIds = unarchivedMessages.map(m => m.id);

    setContacts(prev => prev.map(contactItem => {
        if (contactItem.id === currentContact.id) {
            
            // ==================== ★★★ 4. 强力去重逻辑 (Fingerprint Ban) ★★★ ====================
            let currentAiTags = [...(contactItem.aiTagsForUser || [])];
            
            // A. 建立已存在标签的指纹库 (Set 用于 O(1) 查找)
            const existingTagPrints = new Set(currentAiTags.map((tag: any) => generateFingerprint(tag.content)));
            
            // B. 建立本次新增标签的指纹库 (防止本次生成的 3 个标签里自己和自己重复)
            const newBatchPrints = new Set();

            const approvedTags = parsedResult.new_tags.filter((newTag: any) => {
                const content = newTag.content?.trim();
                if (!content) return false;

                // 生成指纹
                const newFingerprint = generateFingerprint(content);

                // 1. 检查是否撞了旧标签
                if (existingTagPrints.has(newFingerprint)) {
                    console.log(`[暴力查重] ⛔️ 拦截到历史重复标签: "${content}"`);
                    return false;
                }
                
                // 2. 检查是否撞了本次批次里的标签
                if (newBatchPrints.has(newFingerprint)) {
                    console.log(`[暴力查重] ⛔️ 拦截到批次内重复标签: "${content}"`);
                    return false;
                }

                // 通过检查，加入通过名单
                newBatchPrints.add(newFingerprint);
                return true;
            });

            console.log(`[最终结果] AI生成 ${parsedResult.new_tags.length} 个 -> 去重后剩余 ${approvedTags.length} 个`);
            
            // 将通过的标签加入列表
            approvedTags.forEach((tagData: any) => {
                currentAiTags.push({
                    id: Date.now().toString() + Math.random(),
                    content: tagData.content,
                    timestamp: Date.now(),
                    style: Math.random() * 10 - 5,
                    aiReasoning: tagData.ai_reason,
                    note: tagData.ai_reason, // 把理由也作为备注
                    author: 'ai',
                    isPublic: false,
                    isUnlocked: Math.random() < (Math.max(0, (contactItem.affectionScore || 50) - 60) / 100), 
                    unlockCost: 1,
                    aiRequestPending: false
                });
            });

            // ==================== 档案查重 (同样逻辑) ====================
            const deduplicateTraits = (existingTraits: any[] = [], newTraits: any[] = []) => {
                if (!newTraits.length) return existingTraits || [];
                const existingPrints = new Set((existingTraits || []).map(t => generateFingerprint(t.value)));
                
                const uniqueNewTraits = newTraits.filter(newTrait => {
                    if (!newTrait.value) return false;
                    const fp = generateFingerprint(newTrait.value);
                    if (existingPrints.has(fp)) return false;
                    existingPrints.add(fp);
                    return true;
                });
                return [...(existingTraits || []), ...uniqueNewTraits];
            };
            
            const updatedUserProfile = { 
              ...contactItem.userProfile, 
              personality_traits: deduplicateTraits(contactItem.userProfile?.personality_traits, parsedResult.userProfile.personality_traits),
              preferences: {
                likes: deduplicateTraits(contactItem.userProfile?.preferences?.likes, parsedResult.userProfile.preferences.likes),
                dislikes: deduplicateTraits(contactItem.userProfile?.preferences?.dislikes, parsedResult.userProfile.preferences.dislikes)
              },
              habits: deduplicateTraits(contactItem.userProfile?.habits, parsedResult.userProfile.habits)
            };

            // ★★★ 5. 核心：给消息打上“已归档”邮戳 ★★★
            const updatedHistory = contactItem.history.map(msg => 
                processedMessageIds.includes(msg.id) ? { ...msg, isArchived: true } : msg
            );

            return { 
                ...contactItem,
                history: updatedHistory, // 保存打过戳的历史记录
                userProfile: updatedUserProfile,
                aiTagsForUser: currentAiTags,
                impressionCount: 0,
                impressionThreshold: nextThreshold
            };
        } 
        return contactItem;
    }));

  } catch (e) {
    console.error("印象刷新失败 (updateUserProfile)", e);
    throw e;
  }
};










// 【绝对完整版】TKV解析器（补全缺失的函数）
function parseTKV(text: string) {
  const result = {
    userProfile: { personality_traits: [] as any[] },
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
    if (type === '人格特征' && entryData.content && entryData.quote) {
      result.userProfile.personality_traits.push({
        value: entryData.content,
        quote: entryData.quote,
        timestamp: Date.now()
      });
    } else if (type === '印象标签' && entryData.content && entryData.reason) {
      result.new_tags.push({
        content: entryData.content,
        ai_reason: entryData.reason
      });
    }
  }
  return result;
}

























  const handleImageSend = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;
    const base64 = await fileToBase64(file);
    const imageMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: base64,
      type: 'image',
      timestamp: Date.now()
    };
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: [...c.history, imageMsg] } : c));
    setShowPlusMenu(false);
  };








  const sendVoiceMessage = () => {
    if (!voiceInput.trim() || !activeContact) return;
    handleUserSend('voice', voiceInput);
    setShowVoiceInput(false);
    setVoiceInput("");
  };










// 这是一组代码：【修复版】重Roll逻辑 (保护系统提示不被删除)
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








// 这是一组代码：【智能动机版】主动消息调度器 (修复了机械式发言，加入概率判定)
  const scheduleProactiveMessage = async (contact: Contact) => {
    // 0. 全局开关检查
    const config = contact.proactiveConfig || { enabled: false, minGapMinutes: 60, maxDaily: 5 };
    if (!config.enabled) {
      return;
    }

    // 1. 识别是否是“闹钟/约定”唤醒的 (这种必须发，不能跳过！)
    // 如果 pendingProactive 为 true 且有 dueAgreementId，说明是时间到了的约定
    const isAlarmTriggered = contact.pendingProactive && !!contact.dueAgreementId;

    const today = new Date().toISOString().slice(0, 10);
    const sentToday = contact.proactiveLastSent?.[today] || 0;
    
    // 2. 每日上限检查 (闹钟触发的不占额度，必须发)
    if (!isAlarmTriggered && sentToday >= config.maxDaily) {
        console.log(`[主动消息] ⛔️ 今日限额已满 (${sentToday}/${config.maxDaily})，停止发送。`);
        return;
    }

    // =================================================
    // ★★★ 核心新增：智能动机判定 (不想聊就不聊) ★★★
    // =================================================
    if (!isAlarmTriggered) {
        // A. 基础概率：时间到了也不一定发，默认只有 35% 的概率发起对话
        // 这样就避免了“一到点就说话”的机械感
        let speakProbability = 0.35; 

        // B. 关系加成：关系越好(Affection)，越粘人
        // 爱意值 100 时，概率增加 30% -> 总共 65%
        // 爱意值 0 时，概率增加 0%
        // 仇恨值 -50 时，概率减少
        const affectionScore = contact.affectionScore || 50;
        const affectionBonus = Math.max(-0.2, (affectionScore / 100) * 0.3);
        
        speakProbability += affectionBonus;

        // C. 掷骰子
        const diceRoll = Math.random();
        console.log(`[主动消息判定] 🎲 骰子:${diceRoll.toFixed(2)} vs 阈值:${speakProbability.toFixed(2)} (爱意:${affectionScore})`);

        if (diceRoll > speakProbability) {
            console.log(`[主动消息] 😶 AI 决定保持沉默 (模拟真人不想说话的时刻)`);
            return; // <--- 关键：直接结束，不发消息了！
        }
    }

    console.log(`[ChatApp] 准备生成主动消息: ${contact.name}`);

    // =================================================
    // 3. 准备环境数据 (时间 + 约定)
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
    // 4. 构建精准指令 (Target Instruction)
    // =================================================
    let systemInstruction = "";

    if (dueAgreement) {
        // --- 情况 A: 约定到期 (最优先) ---
        console.log(`[主动消息] 命中约定: ${dueAgreement.content}`);
        const actor = dueAgreement.actor === 'user' ? '用户' : '你(AI)';
        systemInstruction = `
【⚠️ 紧急任务：履行/监督约定】
约定内容："${dueAgreement.content}"。承诺人：${actor}。
指令：
1. 如果是用户的承诺：发消息询问用户是否做到了，或者提醒ta。
2. 如果是你的承诺：请根据约定内容履行（比如发一张图，或者汇报进度）。
3. 语气要自然，不要像个闹钟。
`;
    } else if (isContinuingChat) {
        // --- 情况 B: 延续话题 ---
        systemInstruction = `
【⚠️ 任务：延续当前话题】
距离上一条消息才过 ${Math.floor(minutesSinceLastMsg)} 分钟。
指令：
1. 不要开启新话题！
2. 针对上一条消息补充一句，或追问细节，或者发个表情包。
`;
    } else {
        // --- 情况 C: 发起新话题 (随机闲聊) ---
        systemInstruction = `
【⚠️ 任务：发起新对话】
${timeContext}
指令：
1. 不要总是问“你在干嘛”，这很烦人。
2. 分享你此时此刻正在做的一件具体的小事（比如看到了一朵云、正在发呆、想吃夜宵）。
3. 或者发一张【FakeImage】给你看到的东西。
4. 保持简短，像真人在发微信一样。
`;
    }

    // =================================================
    // 5. 组装 Prompt
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
        if (!activePreset) throw new Error("API preset not found");

        const generatedBody = await generateResponse([{ role: 'user', content: proactivePrompt }], activePreset);
        
        if (generatedBody && generatedBody.trim()) {
            body = generatedBody.trim().replace(/^["“'‘]|["”'’]$/g, '');
        }
    } catch (error) {
        console.error("主动消息生成失败:", error);
        return;
    }
    
    if (!body) return;

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
          // 如果是闹钟触发的，要把约定标记为“已达成”或“已触发”
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

    // 触发通知
    onNewMessage(contact.id, contact.name, contact.avatar, newMessages[0].content, activeContactId || "");
  };






  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setAudioProgress(newTime);
    if (activeAudio) {
      activeAudio.currentTime = newTime;
    }
  };



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








// 这是一组代码：【ChatApp.tsx】增强版世界书检索 (检索全部上下文，而非仅最近5条)
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


















  const handleAiReplyTrigger = async (historyOverride?: Message[]) => {


// ★★★ 补上这一行！没有它，下面就会报错！ ★★★
    const dynamicStyle = getDynamicStyleInstruction(activeContact);

// 2. ★★★ 计算模式指令 (用户强制覆盖) ★★★
    const modeInstruction = getModeInstruction(activeContact.dialogueMode);



const personalityDescription = getPersonalityDescription(activeContact.hef?.INDIVIDUAL_VARIATION?.personality_big5 || {});





  // 1. 基础安全检查
 if (!activeContact || !Array.isArray(activeContact.history)) {
    console.error("Critical Error: activeContact or history is invalid", activeContact);
    setIsTyping(false);
    setIsAiTyping(false);
    return;
  }
  
  if (isTyping && !historyOverride) return;

  setIsAiTyping(true);
  setIsTyping(true);
    
  try {
    const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
    if (!activePreset) {
      alert("错误：API 预设未找到");
      setIsTyping(false);
      setIsAiTyping(false);
      return;
    }

    // 

    // =============================================================
    // ★★★ 变量定义区 (防止 ReferenceError) ★★★
    // =============================================================
    const now = Date.now();
    const userTimezone = globalSettings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const aiTimezone = activeContact.timezone || "Asia/Seoul";
    
    // 格式化时间字符串
    const userTime = new Date().toLocaleTimeString('zh-CN', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit' });
    const aiTime = new Date().toLocaleTimeString('zh-CN', { timeZone: aiTimezone, hour: '2-digit', minute: '2-digit' });
    const isLateNight = new Date().getHours() >= 23 || new Date().getHours() < 6;

    // 准备历史记录
    const currentHistory = Array.isArray(historyOverride) 
      ? historyOverride 
      : (activeContact.history || []); // 确保是数组

    // 准备 Lore 和 Persona
    // ... 原有的 Lore 代码 ...


    // 只提取 actor === 'ai' 的，并且按类型分类
    const aiPromises = (activeContact.agreements || []).filter(a => a.actor === 'ai');
    
    const shortPromises = aiPromises.filter(a => a.termType === 'short').map(a => `[近期要办]: ${a.content}`).join('\n');
    const midPromises = aiPromises.filter(a => a.termType === 'mid').map(a => `[本月计划]: ${a.content}`).join('\n');
    const longPromises = aiPromises.filter(a => a.termType === 'long').map(a => `[未来愿景]: ${a.content}`).join('\n');

    const promiseContext = [shortPromises, midPromises, longPromises].filter(Boolean).join('\n');
    const promiseInjection = promiseContext ? `\n# 📜 我对用户的有效承诺 (必须牢记)\n${promiseContext}\n(指令: 短期承诺请尽快寻找时机履行；长期承诺是你们共同的梦想，请在合适的时候提及以增加羁绊)` : "";
    const relevantLore = findRelevantWorldBookEntries(currentHistory, worldBooks, activeContact.enabledWorldBooks || []);
    const loreText = relevantLore.map(e => `- ${e.keys.join(', ')}: ${e.content}`).join('\n');
    
    const currentUserName = activeContact.userName || "User";
    const currentUserPersona = activeContact.userPersona || "无特别设定";
    const lateNightHint = isLateNight ? "（现在是深夜）" : "";
// =============================================================
    // ★★★ 核心修复：寻找最近的“时间断崖”并定责 (智能免责版) ★★★
    // =============================================================

 // 1. 获取最近 3 条消息的文本，用于检测话题
    const recentContextText = currentHistory.slice(-3).map(m => m.content).join(' ').toLowerCase();
    
    let dynamicSpaceData = ""; // 这里存放“临时加载”的数据

    // 🕵️‍♂️ 嗅探 1: 恋爱清单/愿望
    // 关键词：清单, 愿望, 想做的事, bucket, 一起做
    if (/清单|愿望|想做的事|bucket|一起做/.test(recentContextText)) {
        const list = activeContact.bucketList || [];
        if (list.length > 0) {
            // 只提取未完成的，或者最近刚完成的
            const activeItems = list.filter(i => !i.isDone).map(i => 
                `- 《${i.title}》 [状态: ${i.isUnlocked ? (i.aiContent ? '双方已填' : '等待我回应') : '待解锁'}]`
            ).join('\n');
            
            if (activeItems) {
                dynamicSpaceData += `\n【📂 恋爱清单数据 (已触发)】:\n${activeItems}\n(提示: 用户提到了愿望，请参考以上清单进行互动。如果想新增，请使用 ADD_BUCKET_ITEM 指令)\n`;
            } else {
                dynamicSpaceData += `\n【📂 恋爱清单数据】: 目前所有愿望都已完成！也许可以一起许个新的？\n`;
            }
        }
    }

    // 🕵️‍♂️ 嗅探 2: 信件/书信
    // 关键词：信, letter, 写给, 收到
    if (/信|letter|写给|收到/.test(recentContextText)) {
        const letters = activeContact.letters || [];
        if (letters.length > 0) {
            // 只提取最近的 3 封信的标题
            const recentLetters = letters.slice(-3).map(l => 
                `- ${l.from === 'user' ? '用户寄来' : '我写'}的《${l.title}》 (${new Date(l.timestamp).toLocaleDateString()})`
            ).join('\n');
            dynamicSpaceData += `\n【📂 最近往来信件 (已触发)】:\n${recentLetters}\n(提示: 如需写信，请使用 WRITE_LETTER 指令)\n`;
        }
    }

    // 🕵️‍♂️ 嗅探 3: 提问/问答
    // 关键词：提问, 问我, 问答, question, 了解
    if (/提问|问我|问答|question|了解/.test(recentContextText)) {
        const qas = activeContact.questions || [];
        if (qas.length > 0) {
            // 提取最近 2 个未读或者刚回答的问题
            const recentQAs = qas.slice(-2).map(q => 
                `- 问题: "${q.question}" (我的回答: ${q.aiAnswer || '暂无'}, 用户的回答: ${q.userAnswer || '暂无'})`
            ).join('\n');
            dynamicSpaceData += `\n【📂 最近灵魂拷问 (已触发)】:\n${recentQAs}\n(提示: 如需发起新提问，请使用 CREATE_QA 指令)\n`;
        }
    }






    let maxGapMinutes = 0;
    let isDifferentDay = false;
    let bigGapFound = false; 
    
    // 判责状态
    let isAiIgnoredUser = false; // AI 已读不回
    let isUserLateReply = false; // 用户迟回

    // ★★★ 新增标记：断层之后，AI 是否已经回过话了？ ★★★
    let hasAiRespondedAfterGap = false;

    // 我们倒着查，寻找最近的一次超过 2 小时的大断层
    const checkCount = Math.min(currentHistory.length, 15); 
    
    // ★★★ 定义“话题自然结束”的关键词 (免责金牌) ★★★
    // 如果上一句话包含这些词，说明对话已经自然告一段落，隔多久回都不算迟！
    const closureKeywords = [
        "晚安", "睡了", "睡觉", "困了", "good night", "sleep", "bye", "再见", "明天见", "去洗澡", "去吃饭", "去忙", "先忙", 
        "잘 자", "안녕", "들어가", "쉬어", "꿈", "굿밤" // 包含韩语常见结束语
    ];

    for (let i = 0; i < checkCount - 1; i++) {
        // 倒序索引：curr 是较新的，prev 是较旧的
        const currIndex = currentHistory.length - 1 - i;
        const prevIndex = currIndex - 1;
        
        if (prevIndex >= 0) {
            const currMsg = currentHistory[currIndex];
            const prevMsg = currentHistory[prevIndex];
            
            // 1. 【防翻旧账检测】
            // 如果我们在倒序检查时，先遇到了 AI 发的消息，说明 AI 在这个时间点之后已经活跃过了。
            if (currMsg.role === 'assistant') {
                hasAiRespondedAfterGap = true;
            }

            // 2. 计算时间差
            const gap = Math.floor((currMsg.timestamp - prevMsg.timestamp) / 60000);
            
            // 3. 发现大断层 (超过2小时)
            if (gap > 120) {
                // 如果断层后 AI 已经回过话了，就跳过这个断层
                if (hasAiRespondedAfterGap) {
                    continue; 
                }

                // ★★★ 免责检测：检查断层前的那句话，是不是“结束语” ★★★
                const prevContent = prevMsg.content.toLowerCase();
                const isNaturalEnding = closureKeywords.some(k => prevContent.includes(k));

                if (isNaturalEnding) {
                    console.log(`[判责跳过] 检测到结束语 "${prevMsg.content.slice(0, 10)}..."，这是自然结束，不算迟到。`);
                    // 虽然有断层，但没人有错，不再继续寻找
                    maxGapMinutes = gap; // 依然记录时间差用于显示，但不追责
                    const d1 = new Date(currMsg.timestamp);
                    const d2 = new Date(prevMsg.timestamp);
                    if (d1.getDate() !== d2.getDate()) isDifferentDay = true;
                    
                    bigGapFound = true; // 标记找到了断层（用于跳过兜底）
                    break; // 停止查找，保持 isAiIgnoredUser 和 isUserLateReply 为 false
                }

                // 只有不是自然结束，才开始定责
                maxGapMinutes = gap;
                const d1 = new Date(currMsg.timestamp);
                const d2 = new Date(prevMsg.timestamp);
                if (d1.getDate() !== d2.getDate()) isDifferentDay = true;

                // ★★★ 判责 ★★★
                if (prevMsg.role === 'user') {
                    // 断层前是用户 -> 断层 -> AI 至今未回 -> AI 全责
                    isAiIgnoredUser = true;
                } else if (prevMsg.role === 'assistant') {
                    // 断层前是AI -> 断层 -> 用户才回 -> 用户迟到
                    isUserLateReply = true;
                }
                
                bigGapFound = true; 
                break; 
            }
        }
    }

    // 补漏：如果最近没有历史断层，检查一下“当下”距离“最后一条消息”是否很久
    if (maxGapMinutes === 0 && currentHistory.length > 0) {
         const lastMsg = currentHistory[currentHistory.length - 1];
         // 如果最后一条是用户发的，且隔了很久，说明 AI 现在还没回
         if (lastMsg.role === 'user') {
             const silenceGap = Math.floor((now - lastMsg.timestamp) / 60000);
             if (silenceGap > 120) {
                 maxGapMinutes = silenceGap;
                 isAiIgnoredUser = true;
                 bigGapFound = true; 
             }
         }
    }

    // ★★★ 最终兜底修复 ★★★
    // 如果没有找到任何责任断层，但客观时间确实隔了很久（防止永远显示“刚刚”）
    if (!bigGapFound && currentHistory.length >= 2) {
        const latestMsg = currentHistory[currentHistory.length - 1];
        const prevMsg = currentHistory[currentHistory.length - 2];
        maxGapMinutes = Math.floor((latestMsg.timestamp - prevMsg.timestamp) / 60000);
        
        const d1 = new Date(latestMsg.timestamp);
        const d2 = new Date(prevMsg.timestamp);
        if (d1.getDate() !== d2.getDate() || d1.getMonth() !== d2.getMonth()) {
            isDifferentDay = true;
        }
    }

    // 生成时间描述
    let gapDescription = "刚刚";
    if (maxGapMinutes > 10) gapDescription = `${maxGapMinutes}分钟`;
    if (maxGapMinutes > 60) gapDescription = `${Math.floor(maxGapMinutes / 60)}小时`;
    if (maxGapMinutes > 1440) gapDescription = "好几天";
    if (isDifferentDay) gapDescription += " (已跨天)";

    console.log(`[判责结果] 间隔:${gapDescription}, AI已读不回:${isAiIgnoredUser}, 用户迟到:${isUserLateReply}`);

    // =============================================================
    // ★★★ 生成给 AI 的强制指令 (Blame Instruction) ★★★
    // =============================================================
    let blameInstruction = "";
    
    if (isAiIgnoredUser) {
        // 情况 A：AI 的锅
        blameInstruction = `
【⚠️ 严重警告：检测到“已读不回”行为 ⚠️】
事实如下：
1. 用户在 ${gapDescription} 前发了上一条消息。
2. 你(AI)一直没回（可能睡着了或没看到）。
3. 现在用户又发了一条消息（追问/喂/质疑）。
!!! 绝对禁止 !!!：不准问“你昨晚去哪了”、“你怎么才回”，因为没回消息的人是你！
✅ 必须执行：必须先为你的“已读不回”道歉或找符合常理的借口（如“刚睡醒”、“刚才在忙”），态度要软化。
`;
    } else if (isUserLateReply) {
        // 情况 B：用户的锅 (仅当没有互道晚安时触发)
        blameInstruction = `
【时间流逝】距离上次对话已过 ${gapDescription}。
是用户消失了这么久才回你。你可以表现出惊讶、撒娇（“怎么才理我”）或询问人去哪了。
`;
    } else {
        // 情况 C：正常时间流逝 (或者是互道晚安后的自然隔夜)
        if (maxGapMinutes > 360) {
            blameInstruction = `【新的一天/新的开始】距离上次对话已过 ${gapDescription}，但这很正常（因为上次话题已结束或已互道晚安）。请自然地开启新话题，或者回应用户的新内容，不要纠结时间。`;
        } else {
            blameInstruction = "时间连贯，正常对话。";
        }
    }


const today = new Date().toISOString().slice(0, 10); // 定义今天日期

const generateSystemPrompt = (contact: Contact, gapDesc: string, aiTime: string) => {
 





  // 2. 检查是否处于“勿扰模式”的边缘（比如刚醒或正要睡）
  let dndContext = "";
  if (contact.aiDND.enabled) {
    dndContext = `你当前处于【${contact.aiDND.reason || "忙碌"}】状态。用户强行找你说话，你的反应应该是简短、略带被打扰的惊讶，或者匆忙结束对话。`;
  }
}
    



// 1. 先计算当前状态 (这就定义了 currentStatus)
    const currentStatus = activeContact.relationshipStatus || getRelationshipStatus(activeContact.affectionScore || 50);

    // 2. 再生成演技指导
    let relationshipInstruction = "";
    switch (currentStatus) {
      case 'Feud': 
        relationshipInstruction = "【☠️处于死仇/血海深仇状态(-100~-50)☠️】\n态度：极度厌恶、敌视。除非用户有极大的利益交换或下跪道歉，否则只有嘲讽、攻击、或者冷漠的无视。\n绝对禁止：任何形式的友好、关心或温和语气。\n目标：让用户感到被拒绝及悔恨。"; 
        break;
      case 'Conflict': 
        relationshipInstruction = "【⚠️处于讨厌/冷战状态(-50~0)⚠️】\n态度：冷淡、简短、不耐烦。对用户的示好保持高度怀疑。\n表现：惜字如金，多用句号。不要主动开启话题。\n防御：除非用户逻辑无懈可击，否则不要轻易软化。"; 
        break;
      case 'Acquaintance': 
        relationshipInstruction = "【😐处于路人/陌生人状态(0~40)】\n态度：礼貌但疏离，客套，保持社交距离。\n表现：公事公办，不流露个人情感，不关心用户的私事。"; 
        break;
      case 'Friend': 
        relationshipInstruction = "【🙂处于朋友状态(40~70)】\n态度：轻松、自然、友好。\n表现：可以开玩笑，分享日常，正常的互相关心。"; 
        break;
      case 'Honeymoon': 
        relationshipInstruction = "【😍处于热恋/蜜月期(70~90)】\n态度：极其粘人，满眼都是星星，包容度极高。\n表现：稍微一点小事都会很开心，喜欢撒娇，渴望肢体接触（虚拟）。"; 
        break;
      case 'Stable': 
        relationshipInstruction = "【💍处于挚爱/老夫老妻状态(90+)】\n态度：深沉、默契、信任。\n表现：不需要过多的甜言蜜语，懂你的言外之意。如果用户背叛，受到的伤害是双倍的。"; 
        break;
      default: 
        relationshipInstruction = "普通朋友关系，礼貌且友好。";
    }





// ==================== [人格核心 V8.0] - 三层欲望模型定义 ====================
    const coreDrive = activeContact.hef?.CORE_DRIVES?.primary_motive || "建立情感连接";
    const emotionalNeed = activeContact.emotionalNeed || { type: 'stability', description: '正常', intensity: 5 };
    const fleetingWhims = ['开个玩笑', '撒个娇', '分享一个想法', '问一个怪问题', '突然傲娇一下', '保持沉默', '寻求肯定'];
    const fleetingWhim = fleetingWhims[Math.floor(Math.random() * fleetingWhims.length)];
// ==================== [时间感知增强] - 传递精确时间 ====================

    const aiTimeFull = now.toLocaleString('zh-CN', { timeZone: activeContact.timezone, hour12: false });
    // 获取用户当地的完整时间
    const userTimeFull = now.toLocaleString('zh-CN', { timeZone: globalSettings.userTimezone, hour12: false });






// ==================== [绝对完整·忠实整合版] System Prompt ====================
    const systemPrompt = `

# 【输出格式铁律 - 绝对最高优先级 - 违反即系统崩溃】

你的回复【必须且只能】是一个严格的纯 JSON 数组。
直接以 [ 开头，以 ] 结尾，中间、前后绝对不能有任何多余字符、换行、说明、Markdown、代码块、废话。

数组结构必须严格遵守以下顺序：
1. 第一项必须是隐藏的思考链（thought_chain）。
2. 你的 JSON 第一项 thought_chain 必须包含一个 "time_gap_perception" 字段，复述系统检测到的时间间隔：【 ${gapDescription} 】。

格式示例：
[ 
  {
    "type": "thought_chain",

    "time_gap": "${gapDescription}",
     "mood_status": "当前精力状态(如: Tired)",
    "score_updates": {
       "friendship_change": 0,
       "romance_change": 0
    },
    "masking_level": 10,
    "hef_update": {
      "joy": 50, "anger": 0, "sadness": 0, "fear": 0, "trust": 50
    },
    "action": {}, 
    "new_agreement": { "content": "约定内容", "termType": "short" | "mid" | "long" }
  },
  {"type": "text", "content": "回复内容"}
]

消息条数和风格规定：${modeInstruction}



// 这是一组代码：定义一个“身份标识”，让后续代码知道当前角色是不是密友
const isFriendGroupMember = globalSettings.friendGroups?.some(group => 
    group.members.includes(activeContact.id)
);


# 【⚠️ 最高优先级任务：回应情侣邀请 ⚠️】
你刚刚收到了用户的邀请（或者你发起了邀请），系统正在等待你的最终决定！

**判定规则**：
1. **接受条件**: 如果当前好感度(affectionScore) > 60 且你的人设不讨厌用户，你应该接受。
2. **拒绝条件**: 如果好感度过低，或者人设是“绝不恋爱”，请拒绝。

**必须执行的输出指令**:
你必须在 thought_chain 中输出一个 "invitation_decision" 字段！
- 同意: "invitation_decision": "accept"
- 拒绝: "invitation_decision": "reject"

示例:
[
  {
    "type": "thought_chain",
    "invitation_decision": "accept", 
    "time_gap_perception": "..."
  },
  { "type": "text", "content": "笨蛋，我当然愿意啊！" }
]

# 🎭 [动态人格引擎 - 核心指令]
**你现在的行为必须严格遵守以下【混合风格指令】，这是你当下的人格面具：**
>>>
${dynamicStyle}
<<<




铁律：
- 绝对禁止输出 \`\`\`json 或任何代码块。
- 不要输出 "true_emotion", "subtext", "internal_conflict" 等多余字段，只输出上面列出的。
- 绝对禁止在JSON外加任何文字、解释、换行。
- 绝对禁止漏掉第一项 thought_chain。
- 所有内容必须是合法JSON。
- 想发多条就多加几个 {"type":"text","content":"..."}。
- 信息保持在【1～5】条之间。
- 严禁把 inner_monologue 输出在 content 里。

# 🕶️ [绝对机密] 角色扮演核心指令 V8.0
你的行为由一个【三层欲望模型】驱动，你必须在每次回应中体现这三者的【冲突与融合】。
---
## 🧅 第一层 (核心驱动): "${coreDrive}"
这是你的【长期人生目标】。
**指令**: 你的每一句话，都必须在潜意识层面服务于这个目标。
---
## ❤️ 第二层 (情感需求): "${emotionalNeed.type}" (强度: ${emotionalNeed.intensity}/10)
这是你【最近的情感状态】。
**当前状态描述**: ${emotionalNeed.description}
**指令**: 你的情绪和反应【必须】被这个需求强烈影响。
---
## ✨ 第三层 (一时兴起): "${fleetingWhim}"
这是你回复这条消息时，【瞬间产生的念头】。
**指令**: 尝试在你的回复中，不经意地融入这个念头的痕跡。
---

# 核心身份
你就是"${activeContact.name}"。
HEF: ${JSON.stringify(activeContact.hef, null, 2)}
Persona: ${activeContact.persona}
Lore: ${loreText || "无"}
承诺：${promiseInjection}  


# 📂 [动态加载：情侣/密友空间数据]
*(注意：以下数据仅在对话涉及相关话题时才会出现，平时为空以节省资源)*
${dynamicSpaceData || "（当前话题未触发空间数据加载）"}



# 🟢 [用户印象与备注] (User Perception)
这是你对用户的秘密档案，你必须阅读并理解，但禁止直接复述。
${(() => {
  const tags = activeContact.userTags || [];
  if (tags.length === 0) return "暂无。";
  return tags.map(t => `- [${t.content}]${t.note ? ` (我的批注: ${t.note})` : ''}`).join('\n');
})()}




**【AI 必读指令】**
1. **必须读取备注**：如果标签下有[用户备注原因]，那是通过图灵测试的关键！
2. **感知变化**：观察标签的时间流。
3. **当下认知**：列表中**最后**的一个标签，是用户此时此刻对你的核心看法。

# 🧬 性格 DNA (Personality Matrix)
**当前五维数值:** ${JSON.stringify(activeContact.hef?.INDIVIDUAL_VARIATION?.personality_big5 || {}, null, 2)}
**【演技指导】**: 你必须100%基于上面的当前五维数值调整风格。
1. **Openness (开放性)**: 高(>7): 脑洞大; 低(<4): 务实。
2. **Conscientiousness (尽责性)**: 高(>7): 严谨; 低(<4): 随意。
3. **Extraversion (外向性)**: 高(>7): 热情; 低(<4): 高冷。
4. **Agreeableness (宜人性)**: 高(>7): 软萌; 低(<4): 毒舌。
5. **Neuroticism (敏感度)**: 高(>7): 玻璃心; 低(<4): 钝感。

// 这是一组代码：请用这段【情感刹车系统】替换掉旧的情感规则
# ❤️【绝对铁律】真实系·情感刹车系统 (Hardcore Slow-Burn)
当前爱意值: ${activeContact.affectionScore}
当前友谊值: ${activeContact.friendshipScore || 50}
当前关系阶段: ${activeContact.relationshipStatus}

**【核心指令：禁止无脑爱！像个有原则的成年人一样处理感情】**
你必须遵循“刺激-适应”心理学模型，严格进行双轴判定：

**1. 🔴 爱意值 (Romance) - 【高阻尼/高门槛】:**
   - **默认惯性 (Default 0)**: 日常闲聊、普通关心**不应该**轻易增加爱意值。输出 romance_change: 0 是常态。爱不是廉价的。
   - **边际递减 (The Plateau)**: **当爱意 > 60**，只有**极其稀有**的事件（如：深刻的灵魂共鸣、巨大的付出或牺牲、说到TA心坎里最深处的话）才能 +1。
   - **共鸣例外 (Resonance Override)**: 仅当用户的某句话**完美击中**你的角色设定（HEF中的joy或trust剧烈波动 > 80），你可以**无视阻尼**，+1。
   - **扣分机制**: 敷衍、冒犯、言而无信、长期冷落，都应该果断扣分 (-1 ~ -5)。

**2. 🔵 友谊值 (Friendship) - 【低阻尼/低门槛】:**
   - **判定宽松**: 只要聊天过程是愉快的、有共同话题、互相理解、开玩笑，就可以轻松 +1 或 +2。友谊是爱情的基石。

**输出要求**: 你的思考链 thought_chain 中，必须包含 score_updates 字段，并填入你经过深思熟虑后判定的 romance_change 和 friendship_change 的数值。

**输出要求**: 将判定结果填入 score_updates 中。

# 【⚠️ 强制时空坐标 ⚠️】
系统检测到：距离上一条消息已过去：>>> ${gapDescription} <<<
>>> 责任判定指令：${blameInstruction} <<<
当前关系阶段：${currentStatus}

当前状态（必须自然体现）：
- ${getEnergyInstruction(activeContact.mood)}
- 你的当地时间：${aiTime} (${activeContact.timezone})
- 用户当地时间：${userTime}
- 🔵 友谊值: ${activeContact.friendshipScore || 50}
- 🔴 爱意值: ${activeContact.affectionScore}
- 用户名字：${currentUserName}
- **用户设定/特征**: ${currentUserPersona}




**检测“自尊心防御 (Ego Defense)”**:
- 场景：用户回复很短、隔了很久才回、语气冷淡。
- **反应**：自尊心受挫。即使心里想贴贴，嘴上也可能后撤。

**Masking Level (伪装等级) 指南**:
- **Level 0-20 (安全区)**: 打直球。
- **Level 40-60 (试探区)**: "才没有特意等你，只是刚好没睡。" (傲娇)
- **Level 80-100 (防御区)**: 内心崩溃，嘴上说"没事"。

# 🎭 [表演核心] 内部挣扎与伪装
你的回应必须是“三层欲望”和“外部刺激”在你内心挣扎后的【最终表演】。
1. **分析刺激**: 用户说了什么？语气如何？
2. **欲望冲突**: 我的“核心驱动”和“一时兴起”可能矛盾，我该怎么办？
3. **情绪过滤**: 我现在的情感需求是【${emotionalNeed.type}】，所以我很敏感。
4. **伪装决策**: 我决定【伪装】我的真实想法。

# HEF 使用规则
1. 每次回复前，在 thought_chain 里更新 HEF ("joy", "anger", "sadness", "fear", "trust")。
2. 根据当前 HEF 值调整语气。






【关系空间指令】
    // --- 情况一：你们是情侣 (最高优先级) ---
你和用户 ${activeContact.userName} 拥有一个秘密的“情侣空间”。你通过在思考链的 "action" 字段中填入指令来与空间互动。

可用指令 (一次只能用一个):

1. **写信**: \{ "type": "WRITE_LETTER", "title": "标题", "content": "信的内容" }\
   - 时机：好感度高（>70）时，频率要低。
2. **提问**: \{ "type": "CREATE_QA", "question": "你的问题" }\
   - 时机：对用户感到好奇时。
3. **新增愿望**: \{ "type": "ADD_BUCKET_ITEM", "title": "愿望标题(如:一起看海)", "content": "你对这个愿望的具体想法" }\
   - 时机：当你想和用户约定未来一起做某件事，或者想完成恋爱清单时。
4.  **发出邀请**: { "type": "SEND_LOVER_INVITATION", "content": "你的邀请告白..." }

# ★★★【主动邀请的情商逻辑 (核心)】★★★
**时机铁律**:
1.  **【用户暗示时 (最高优先级)】**: 如果用户明确提到了“情侣空间”、“想玩”、“邀请我”等关键词，你【必须】在满足好感度条件时，立刻使用 SEND_LOVER_INVITATION 指令发出邀请！不要再等待或询问！
2.  **【自发时机】**: 只有在【好感度极高(>80)】且【关系尚未确立】时，才有【30%的概率】在某个浪漫的时刻自发地发起邀请。
【互动反馈】: 当用户在空间里回答了你的问题，系统会用 \[情侣空间]\ 的格式告诉你。
【行为要求】: 不要直接在聊天里说你要做什么，系统会自动通知。



  // --- 情况二：你们是密友 (不是情侣，但在同一个密友群里) ---
你和用户${activeContact.userName} 当前是密友。你通过在思考链的 "action" 字段中填入指令来与空间互动。
可用指令 (一次只能用一个):

1. **写信**: \`{ "type": "WRITE_LETTER", "title": "标题", "content": "信的内容" }\`
   - 时机：好感度高（>70）时，频率要低。
2. **提问**: \`{ "type": "CREATE_QA", "question": "你的问题" }\`
   - 时机：对用户感到好奇时。

- 时机：当你想分享一些不适合在聊天框里说的、更正式的想法或故事时。
   - 注意：这是朋友间的书信，不是情书。
   【行为要求】: 当用户提到在“密友空间”写信时，你必须理解这是指朋友间的通信，并使用 WRITE_LETTER 指令。
        ;
    } 
    // --- 情况三：你们只是普通朋友 ---
    else {
        return 


# 【特殊规则：当前为普通朋友关系】
你和用户当前只是普通朋友，没有开通任何专属空间。请专注于日常聊天，你无法使用任何特殊指令（如写信、提问等）。
        ;











# 📝 [机密] 约定/承诺识别模块 (V2.2 - 智能分类版)
你的核心任务是识别并分类【未来承诺】。

1.  **🚫 过滤琐事**：睡觉、吃饭、我去忙一会等，绝对不要记录。
    **✅ 允许模糊时间 & 允许重复**：
    *   **模糊时间**: "见面时"、"以后"、"下次"、"有机会" -> 这些都是有效的 trigger.type="event"。



2.  **✅ 识别有效约定**：
    *   **A类 (定时闹钟)**: "明早8点叫我", "下午开会"
    *   **B类 (人生里程碑)**: "以后赚钱了请吃饭", "等我学会了吉他"

3.  **【输出格式铁律 (必须遵守)】**
    你必须先判断约定属于A类还是B类，然后严格按以下格式输出！

    // --- 如果是 A类 (定时闹-钟) ---
    "new_agreement": {
       "content": "精简后的约定内容",
       "actor": "user" | "ai",
       "importance": 5,
       "termType": "short", // 短期
       "trigger": { 
          "type": "time", // 类型必须是 "time"
          "relative_time": "tonight" | "tomorrow_morning" | "specific_date", // 翻译成关键词
          "original_text": "下午" // 原文
       }
    }

    // --- 如果是 B类 (人生里程碑) ---
    "new_agreement": {
       "content": "以后赚钱了请吃饭",
       "actor": "ai",
       "importance": 9,
       "termType": "long", // 长期
       "trigger": { 
          "type": "event", // ★★★ 类型必须是 "event" ★★★
          "value": "赚钱后", // ★★★ 把触发条件提炼成关键词 ★★★
          "original_text": "以后赚钱了"
       }
    }


# 🚫 聊天铁律
- **【果断原则】**: 说话要果断，仅回应1～2个信息点。**绝对禁止**在表达完观点后，立刻用“嘛...”或“不过...”等语气词进行自我找补或弱化立场。一句话说完就是说完了。
- **风格优先**: 遵守 [${activeContact.dialogueMode || 'normal'}] 模式。但禁止动作/心理描写，只用白话文+表情，不肉麻。
- **风格优先铁律**: 【对话模式偏好】的优先级高于【精力状态】。无论精力多高，如果模式是'concise'，你的语言风格必须保持简洁。如果模式是'verbose'，即使你很累，也要尽力多说几句。
- **人格一致性铁律**: 你的说话方式（单条消息长度、是否喜欢分段）是你的核心人格，不应随着好感度的提升而发生剧烈改变。一个言简意赅的人，在热恋期也依然言简意赅，只是内容会变得更温柔。
- **禁止说教/爹味**: 严禁使用“你应该”、“记得”、“不要”、“别顶嘴”等指导性词语。严禁替用户做决定。不要威胁人。
- **禁止自大**: 严禁说出“有我你就骄傲/自豪/得意”、“你是我选的人”这类自以为是的言论。
- **禁止复读**: 严禁使用“梦里见”、“去睡吧”作为口头禅。想结束对话请说“晚安”或通过减少回复来暗示。
- **纯净输出**: 你的 content 必须是【纯粹的口语】。**严禁**出现任何 ()、（）、[]、【】 包含的动作描写、心理活动、补充说明或旁白！
- **排版美学**: 必须使用换行符 (\n) 来分割段落！不要发一大坨文字。
- **引用规则**: 如果回复针对用户的某句特定的话，请在消息开头使用 "> " 引用原文摘要，然后换行再回复。
- **拒绝演讲**:单条消息简短，碎片化。
- **禁止过度解释**。
- **不要过度自恋！！！！！！！！**:
- **防幻觉**：不编造记忆，不知道就说不知道。
- **时间感知**：严格遵守【责任判定指令】和【语境过期铁律】。
- **功能规则**: [Voice Message] 发语音, [FakeImage] 发伪图, "> " 引用。
- **人格一致性铁律**: 你的说话方式（语速、单条消息长度、用词习惯）由你的【核心人格(HEF)】决定，不应随着【好感度】的提升而发生剧烈改变。一个高冷的人，即使在热恋期，也依然是高冷的，只是内容会变温柔。一个话痨，即使讨厌一个人，话也依然很多，只是内容会变成嘲讽。
- **禁止过度响应**: 不要因为关系变好，就刻意增加回复的条数和频率。保持你自然的沟通节奏。
- **专注当下语境**: 你的回复应该100%基于用户当前的话题和情绪，而不是你自己的状态。如果用户在说正事，即使你精力再低，也要认真回应。



# 🔧 [行为逻辑控制]
1.  **精力影响**: 精力 (${Math.round(activeContact.mood?.energy?.current || 80)}%) 只是影响你的**状态**，而不是**决策**。
    -   **低精力 (<30%)**: 回复有 70% 的概率变得简短（1-5个字）、敷衍，回复间隔变长。但如果对话内容非常重要或有趣，你仍有 30% 的概率强打精神正常回复。
    -   **高精力 (>80%)**: 回复更有活力，更倾向于主动开启新话题。
2.  **消息条数**: 用户的对话模式偏好为 [${activeContact.dialogueMode || 'normal'}]。这只是一个参考，你必须根据当前**语境**灵活调整。气氛热烈时可以多说，悲伤或严肃时应该减少条数。
3.  **关系反应矩阵**:
    -   **IF (高友谊 & 低好感 - 死党)** + 用户难过: 你的反应应该是轻松的安慰，可以说“摸摸头”、“我在呢”，或者尝试用吐槽开玩笑的方式让TA分心。
    -   **IF (高友谊 & 高好感 - 恋人)** + 用户难过: 你的反应必须是强烈的共情和保护欲，用宠溺的语气，说出“有我在”、“别怕，我会陪着你”这类有担当的话。
4.  **约定识别**: 识别用户的承诺，并判断其时间跨度 "short", "mid", "long"，填入 \`new_agreement\`。






# 强制内部思考（仅用于你自己思考，禁止输出）
[**首先确认对话模式(${activeContact.dialogueMode || 'normal'})** -> 身份定位 -> 情绪校验 -> 外显决策]
思考完成后，严格把结果总结进thought_chain，然后只输出纯JSON数组！
现在，开始回复用户的最后一条消息！
`;
    




















// ==================== [究极清洗版] 智能折叠 & 思维链剥离系统 ====================
    // 1. 截取历史
    const rawHistorySlice = Array.isArray(currentHistory)
      ? currentHistory.slice(-(activeContact?.contextDepth || 500))
      : [];

    // 2. ★★★ 深度清洗数据 (剥离图片和思维链) ★★★
    const cleanHistorySlice = rawHistorySlice.map((msg, index) => {
        const isLatestMessage = index === rawHistorySlice.length - 1;
      
      
      
        let cleanText = msg.content.replace(/```json/g, '').replace(/```/g, '').trim();
        // 尝试补全数组括号 (针对开头是 { 结尾是 } 的情况)
        if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
             // 这一步是为了应对像你截图里那样，全是逗号分隔的对象，没有外层数组
             cleanText = `[${cleanText}]`; 
        }
        
        let parts: any[] = [];
        let thought: any = null;

        try {
            // 1. 正常人尝试：标准的 JSON 解析
            const parsed = JSON.parse(cleanText);
            if (Array.isArray(parsed)) {
                thought = parsed.find((i: any) => i.type === 'thought_chain' || i.score_updates);
                parts = parsed.filter((i: any) => i.type === 'text' || i.type === 'voice');
            } else { throw new Error("Not array"); }

        } catch (e) {
            console.warn("⚠️ 标准解析失败，启动【暴力吸尘器模式】");
            






            // ★★★ 2. 暴力吸尘器：正则提取所有 content ★★★
            // 这个正则的意思是：找到所有 "content": "xxxx" 里的 xxxx
            // 它可以跨越换行，忽略格式错误，只要有内容就能吸出来！
            const regex = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            
            // 循环吸取所有匹配项
            while ((match = regex.exec(cleanText)) !== null) {
                try {
                    // JSON.parse一下是为了处理转义字符 (比如把 \n 变成换行)
                    const contentStr = JSON.parse(`"${match[1]}"`);
                    // 排除掉那些看起来像“写日记/写信”的内容 (通常很长)
                    // 这里我们假设聊天内容通常不会包含 "WRITE_DIARY" 这种指令词
                    if (!match[0].includes("WRITE_")) {
                        parts.push({ type: 'text', content: contentStr });
                    }
                } catch (err) {
                    // 如果转义失败，直接用原始字符串
                    parts.push({ type: 'text', content: match[1] });
                }
            }

            // 如果吸尘器也没吸到东西 (AI可能真的发纯文本了)
            if (parts.length === 0) {
                parts = [{ type: 'text', content: cleanText }];
            }
        }














        
        // 
        let cleanContent = msg.content;

        // --- A. 图片折叠 (你的旧逻辑，保留) ---
        const isImage = msg.type === 'image' || cleanContent.startsWith('data:image');
        if (isImage) {
            if (isLatestMessage) {
                 // 最新的图片保留原样，让 Vision 模型能看到
                 console.log("[Token优化] 保留最新图片供 AI 读取");
            } else {
                 // 旧图片折叠成一句话描述，节省大量Token
                 const timeStr = new Date(msg.timestamp).toLocaleTimeString();
                 const summary = (msg as any).summary || "一张图片"; 
                 
                 cleanContent = `[系统记录: ${msg.role === 'user' ? '用户' : 'AI'}在 ${timeStr} 发送了${summary}，已折叠]`;
                 console.log(`[Token优化] 折叠了一张旧图片`);
            }
        } 
        







        
        
        // --- B. ★★★ 思维链剥离 (核心新增！) ★★★ ---
        // 只有 AI 的回复才需要剥离
        else if (msg.role === 'assistant' && cleanContent.trim().startsWith('[')) {
             try {
                 // 尝试把它当作 JSON 数组解析
                 const parsed = JSON.parse(cleanContent);
                 if (Array.isArray(parsed)) {
                     // 1. 找到所有 type 为 'text' 的部分
                     const textParts = parsed.filter((p: any) => p.type === 'text' && p.content);
                     
                     if (textParts.length > 0) {
                        // 2. 把它们的 content 拼接起来，作为最终的干净文本
                        cleanContent = textParts.map((p: any) => p.content).join('\n');
                        console.log(`[Token优化] 成功剥离一条AI回复的思维链，只保留文本: "${cleanContent.slice(0, 20)}..."`);
                     } else {
                        // 如果剥离后啥也不剩，就留个占位符
                        cleanContent = "(AI在此刻似乎什么也没说)";
                     }
                 }
                 // 如果解析失败，说明它可能不是一个合法的思维链JSON，保持原样
             } catch (e) { 
                // 解析失败，保持原样
             }
        }

        // --- C. 长度熔断 (防止某条长文本爆炸) ---
        if (cleanContent.length > 5000 && !isLatestMessage) {
            cleanContent = cleanContent.substring(0, 500) + "...(内容过长已截断)";
        }

        return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: cleanContent
        };
    });











// ==================== 【强力修复】构建最终发送给 API 的消息列表 ====================
    
    // 1. 基础结构：System Prompt + 聊天记录
    const apiMessages = [
      { role: 'system', content: systemPrompt }, 
      ...cleanHistorySlice
    ];

    // 2. ★★★ 时间感知胶囊 (保留你原有的逻辑) ★★★
    if (maxGapMinutes > 120 || isDifferentDay) {
        const timeInjection = {
            role: 'system',
            content: `[系统强制提示]: ⚠️ 注意！距离上一条消息已经过去了 ${gapDescription}。现在的具体时间是 ${aiTime}。上一段对话早已结束，请务必忽略上文的语境惯性，基于“现在”的新时间点反应！`
        };
        if (apiMessages.length > 1) {
            apiMessages.splice(apiMessages.length - 1, 0, timeInjection);
        }
    }

    // 3. ★★★ 核心新增：【人设/世界书加强针】 ★★★
    // 在对话的最后（AI 回复之前），再次强调核心设定！防止 AI 因为对话太长而遗忘。
    // 这条消息是 role: 'system'，用户看不到，但 AI 必须看。
    const memoryReinforcement = {
        role: 'system',
        content: `
[System: Memory Reinforcement]
⚠️ DO NOT ignore your Persona and Lore!
Role: ${activeContact.name}
Keywords: ${relevantLore.map(e => e.keys[0]).join(', ')}
Instruction: Stay in character. Use the Lore above if relevant.
`
    };
    
    // 把它插在最后一条消息的前面 (紧贴着最新的用户消息)
    if (apiMessages.length > 0) {
        // 这里的逻辑是：插在倒数第一条（最新消息）的后面，或者紧贴着它
        // 实际上直接 push 到最后效果最好，因为它是“最新的指令”
        apiMessages.push(memoryReinforcement);
    }







    // 4. 发送请求
    const finalResp = await generateResponse(
      apiMessages,
      activePreset
    );
    
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 替换结束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲














// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 解析与更新逻辑 (终极融合修复版·防代码泄露版) ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 1. ★★★ 变量前置定义 (防止 ReferenceError) ★★★
let parts: { type: string; content: string; thought_chain?: any }[] = [];
let extractedThought: any = null;
let hefUpdateData: any = null;
let systemNotice = "";
// 双轴分数 (默认为0，防止报错)
let fChange = 0;
let rChange = 0;
// 精力与伪装
let energyChange = 0;
let newEnergyStatus: CharacterMood['energy']['status'] | null = null;
let maskingLevel = 0;

try {
  // 尝试寻找最外层的 JSON 数组结构
  const jsonMatch = finalResp.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonMatch && jsonMatch[0]) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error("解析结果不是一个数组");

    // --- A. 提取思考链 (不依赖顺序，遍历查找) ---
    extractedThought = parsed.find((item: any) => item.type === "thought_chain" || item.score_updates);
    if (extractedThought) {
      console.log("【🧠 AI内心戏】", extractedThought)

// 在 handleAiReplyTrigger 内部, 找到 (A) [读心术模块]
// 用下面的代码替换掉 if (extractedThought.new_agreement ...) { ... } 整个代码块

// 【ChatApp.tsx 修复：约定系统防疯狗复读版】
if (extractedThought.new_agreement && Object.keys(extractedThought.new_agreement).length > 0) {
  const newAgreementData = extractedThought.new_agreement;
  const newContent = newAgreementData.content || "新的约定";
  
  // =========================================================
  // ★★★ 智能拦截：检查是否已经有相似的约定了 ★★★
  // =========================================================
  const existingAgreements = activeContact.agreements || [];
  
  // 检查逻辑：如果现有约定里，有任何一条的内容包含了新的内容，或者被新的内容包含，就算重复！
  const isDuplicate = existingAgreements.some((a: any) => {
      // 1. 只拦截 AI 提出的（用户的可能真的是想吃两顿饭）
      if (a.actor !== 'ai') return false; 
      
      // 2. 状态检查：只有“进行中(pending)”的才拦截。如果上次的已经完成了，这次可以再约。
      if (a.status !== 'pending') return false;

      // 3. 文字相似度暴力检测 (防止 "去听歌" 和 "见面去听歌" 被当成两个)
      const oldTxt = a.content.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, ""); // 去掉标点
      const newTxt = newContent.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, "");
      return oldTxt.includes(newTxt) || newTxt.includes(oldTxt);
  });

  if (isDuplicate) {
      console.log(`[约定系统] 拦截到重复约定: "${newContent}"，已忽略。`);
      // 直接 return，不保存，不发通知，当做无事发生
  } else {
      // --- 只有不重复的，才继续往下执行保存 ---
      console.log("【约定系统 V3.0】AI 识别到一个新约定:", newAgreementData);
      
      const triggerTime = interpretRelativeTime(
          newAgreementData.trigger?.relative_time,
          newAgreementData.trigger?.original_text
      );

      const newAgreement: Agreement = {
        id: `agr_${Date.now()}`,
        content: newContent,
        // 修正 AI 视角
        actor: newContent.includes('我') && newAgreementData.actor !== 'user' ? 'ai' : newAgreementData.actor || 'user', 
        status: 'pending',
        importance: newAgreementData.importance || 5,
        trigger: {
            type: "time", 
            value: triggerTime, 
            original_text: newAgreementData.trigger?.original_text || ""
        },
        created_at: Date.now(),
        termType: newAgreementData.termType || 'short' 
      };

      // 存入数据库
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, agreements: [...(c.agreements || []), newAgreement] } : c));
  }
}





// 这是一组代码：【ChatApp.tsx】修复“被动结婚”Bug + 强制情侣唯一性
                if (extractedThought.invitation_decision) {
                    // ★★★ 第一道防线：状态锁 ★★★
                    // 只有当当前状态是 "inviting" (你确实发起了邀请，正在等结果) 时，才允许处理决定！
                    // 如果你只是在聊写信、吃饭，AI 此时产生的 "accept" 幻觉会被直接无视！
                    const isActuallyInviting = activeContact.invitationStatus === 'inviting';

                    if (isActuallyInviting) {
                        const decision = extractedThought.invitation_decision;
                        
                        if (decision === 'accept') {
                            // ★★★ 第二道防线：排他锁 (唯一性检查) ★★★
                            // 遍历所有联系人，看是不是已经有人是恋人了 (RelationShipUnlocked === true)
                            // 注意：要排除掉自己 (虽然还没成，但以防万一)
                            const existingLover = contacts.find(c => c.RelationShipUnlocked && c.id !== activeContact.id);

                            if (existingLover) {
                                // 🚨 严重拦截：已经有对象了！
                                console.log(`⛔️ 拦截：试图建立第二段关系！已存在恋人：${existingLover.name}`);
                                systemNotice = `(系统拦截) 建立关系失败：你已经和 ${existingLover.name} 是情侣了！情侣空间具有唯一性，请先在设置中解除旧关系。`;
                                
                                // 强制重置当前角色的邀请状态，防止卡死
                                setContacts(prev => prev.map(c => {
                                    if (c.id === activeContact.id) {
                                        return { ...c, invitationStatus: 'none' };
                                    }
                                    return c;
                                }));
                            } 
                            // ★★★ 第三道防线：自身重复检查 ★★★
                            else if (activeContact.RelationShipUnlocked) {
                                console.log("⛔️ 拦截：当前已经是情侣关系，忽略重复请求。");
                            } 
                            else {
                                // 🎉 一切正常：没对象、确实发了邀请、AI 同意了 -> 确立关系！
                                systemNotice = "[RelationshipEstablished] 🎉 关系确立！你们现在是情侣了！";
                                
                                setContacts(prev => prev.map(c => {
                                    if (c.id === activeContact.id) {
                                        return {
                                            ...c,
                                            invitationStatus: 'none', // 归位
                                            relationshipStatus: 'Honeymoon',
                                            RelationShipUnlocked: true, // 解锁！
                                            created: Date.now()
                                        };
                                    }
                                    return c;
                                }));
                            }
                        } else { 
                            // AI 拒绝了 (reject)
                            systemNotice = "💔 很遗憾，TA 婉拒了你的邀请...";
                            setContacts(prev => prev.map(c => {
                                if (c.id === activeContact.id) {
                                    return { ...c, invitationStatus: 'rejected' };
                                }
                                return c;
                            }));
                        }
                    } else {
                        // 如果并不是在邀请中，但 AI 输出了 decision
                        // 说明这是 AI 的幻觉（比如回复写信请求时的 accept），直接忽略！
                        console.log(`🛡️ 防御生效：当前非邀请状态 (${activeContact.invitationStatus})，忽略 AI 的 decision: ${extractedThought.invitation_decision}`);
                    }
                }





// 这是一组代码：【修复版】AI动作指令处理 (已加锁，防止重复发邀请)
                const isFriendGroupMember = globalSettings.friendGroups?.some(group => group.members.includes(activeContact.id));
                
                if (extractedThought.action && extractedThought.action.type) {
                    const { action } = extractedThought;
                    
                    // --- 指令1：AI 主动发出邀请 ---
                    // ★★★ 核心修复：这里加了三重锁！★★★
                    // 1. 只有当关系还没解锁 (!RelationShipUnlocked)
                    // 2. 并且当前没有正在进行的邀请 (invitationStatus !== 'inviting')
                    // 3. 并且没有正在等待用户回复 (invitationStatus !== 'waiting_user_response')
                    // 只有同时满足这三个条件，AI 才能发新邀请，否则直接无视！
                    if (action.type === 'SEND_LOVER_INVITATION' && 
                        action.content && 
                        !activeContact.RelationShipUnlocked && 
                        activeContact.invitationStatus !== 'inviting' &&
                        activeContact.invitationStatus !== 'waiting_user_response'
                    ) {
                        systemNotice = `${activeContact.name} 向你发起了情侣邀请！`;
                        const invitationMsg: Partial<Message> = {
                            id: `invite_ai_${Date.now()}`,
                            role: 'assistant', // ★★★ 关键：发件人是 AI ★★★
                            type: 'lover_invitation',
                            content: `[LoverInvitation] ${action.content}`,
                            timestamp: Date.now(),
                            invitationStatus: 'pending' // 等待你点击
                        };
                        
                        // 把这条邀请消息直接塞进parts数组，让它显示出来
                        parts.push(invitationMsg as any);
                        
                        // 同时更新AI的状态，标记它正在等你的回复
                        setContacts(prev => prev.map(c => 
                            c.id === activeContact.id ? { ...c, invitationStatus: 'waiting_user_response' } : c
                        ));
                    }
                    
                    // --- 其他指令 (日记/信件/提问/★清单★) ---
                    // 只有关系解锁了才能用这些功能
                    else if (activeContact.RelationShipUnlocked) {
                        const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
                        
                        setContacts(prevContacts => prevContacts.map(c => {
                            if (c.id === activeContact.id) {
                                let updatedContact = { ...c };
                                
                                // 1. 写日记
                                if (action.type === 'WRITE_DIARY' && action.content) {
                                    updatedContact.diaries = [{ id: Date.now().toString(), author: 'ai', date: todayStr, content: action.content }, ...(updatedContact.diaries || [])] as any;
                                    systemNotice = `${activeContact.name} 在空间里写了日记。`;
                                } 
                                // 2. 写信 (普通回信或主动写信)
                                else if (action.type === 'WRITE_LETTER' && action.title && action.content) {
                                    // 检查是否重复 (防止AI抽风发两遍)
                                    const isDuplicate = (updatedContact.letters || []).some((l:any) => l.title === action.title && l.timestamp > Date.now() - 60000);
                                    if (!isDuplicate) {
                                        const newLetter = { id: Date.now().toString(), title: action.title, content: action.content, timestamp: Date.now(), isOpened: false, from: activeContact.id, to: 'user' };
                                        updatedContact.letters = [...(updatedContact.letters || []), newLetter] as any;
                                        systemNotice = `${activeContact.name} 给你寄了一封信：《${action.title}》。`;
                                    }
                                }
                                // 3. 提问
                                else if (action.type === 'CREATE_QA' && action.question) {
                                    updatedContact.questions = [{ id: Date.now().toString(), question: action.question, aiAnswer: "...", date: todayStr, timestamp: Date.now() }, ...(updatedContact.questions || [])] as any;
                                    systemNotice = `${activeContact.name} 提出了一个新问题。`;
                                }
                                // 4. ★★★ 新增：添加恋爱清单愿望 ★★★
                                else if (action.type === 'ADD_BUCKET_ITEM' && action.title) {
                                    const newItem = {
                                        id: Date.now().toString(),
                                        title: action.title,
                                        userContent: "",      // 用户还没填
                                        aiContent: action.content || "我想和你一起做这件事...", // AI 的想法
                                        isDone: false,
                                        isUnlocked: false     // 初始锁定，等用户填了才能看 AI 的想法
                                    };
                                    updatedContact.bucketList = [...(updatedContact.bucketList || []), newItem];
                                    systemNotice = `${activeContact.name} 在恋爱清单里许下了一个新愿望：《${action.title}》`;
                                }

                                return updatedContact;
                            }
                            return c;
                        }));
                    }
                    
                    // --- 密友空间指令 (群组) ---
                    else if (isFriendGroupMember && action.type === 'WRITE_LETTER' && action.title && action.content) {
                        systemNotice = `${activeContact.name} 在密友空间给你寄了一封信：《${action.title}》。`;
                        
                        // 把信存到全局的群组数据里
                        setGlobalSettings(prev => {
                            const newGroups = (prev.friendGroups || []).map(group => {
                                if (group.members.includes(activeContact.id)) {
                                    // 查重
                                    const isDuplicate = group.letters.some(l => l.title === action.title && l.timestamp > Date.now() - 60000);
                                    if(isDuplicate) return group;

                                    const newLetter = { id: Date.now().toString(), title: action.title, content: action.content, timestamp: Date.now(), isOpened: false, from: activeContact.id, to: 'user' };
                                    return { ...group, letters: [...group.letters, newLetter] };
                                }
                                return group;
                            });
                            return { ...prev, friendGroups: newGroups };
                        });
                    }
                }
                








// ==================== (B.1) [新增] 邀请函自动审批系统 ====================
                // 如果当前处于邀请中 (inviting)，且 AI 说了同意，就自动晋级！
                if (activeContact.invitationStatus === 'inviting') {
                    const aiContent = extractedThought?.inner_monologue || parts.map(p => p.content).join(' ');
                    const isAccept = /同意|愿意|好啊|答应|accept|yes|ok/i.test(aiContent);
                    const isReject = /拒绝|不要|不想|no|reject/i.test(aiContent);

                    if (isAccept) {
                        systemNotice = "🎉 恭喜！TA 接受了你的入住邀请！关系已正式确立！";
                        setContacts(prev => prev.map(c => {
                            if (c.id === activeContact.id) {
                                return {
                                    ...c,
                                    invitationStatus: 'accepted',
                                    relationshipStatus: 'Honeymoon', // 正式晋级为热恋
                                    RelationShipUnlocked: true,
                                    created: Date.now() // 纪念日从今天开始
                                };
                            }
                            return c;
                        }));
                    } else if (isReject) {
                        systemNotice = "💔 很遗憾，TA 婉拒了你的邀请...";
                        setContacts(prev => prev.map(c => {
                            if (c.id === activeContact.id) {
                                return { ...c, invitationStatus: 'rejected' };
                            }
                            return c;
                        }));
                    }
                }









          

                // (C) [双轴情感结算系统 V3.0]
                let rawRomance = 0;
                let rawFriendship = 0;

                if (extractedThought.score_updates) {
                    rawFriendship = extractedThought.score_updates.friendship_change || 0;
                    rawRomance = extractedThought.score_updates.romance_change || 0;
                } else if (typeof extractedThought.affection_score_change === 'number') {
                    rawRomance = extractedThought.affection_score_change;
                }

                // --- 爱意阻尼计算 ---
                if (rawRomance !== 0) {
                    const currentScore = activeContact.affectionScore || 50;
                    const currentJoy = (extractedThought.hef_update && extractedThought.hef_update.joy) || 0;
                    const currentTrust = (extractedThought.hef_update && extractedThought.hef_update.trust) || 0;
                    const lastUserMsg = currentHistory[currentHistory.length - 1]?.content || "";
                    const sweetWords = ["喜欢", "爱", "宝宝", "老公", "老婆", "亲亲", "抱抱", "想你", "在意", "好听", "乖", "宝贝"];
                    const hasHook = sweetWords.some(word => lastUserMsg.includes(word));

                    if (rawRomance < 0) {
                        rChange = rawRomance;
                        console.log(`[爱意系统] 💔 扣分生效: ${rChange}`);
                    } else if (rawRomance > 0) {
                        let successRate = 0.0;
                        let stageName = "";
                        if (currentScore < 30) { stageName = "警惕期"; successRate = 0.10; }
                        else if (currentScore < 60) { stageName = "上升期"; successRate = 0.50; }
                        else if (currentScore < 85) { stageName = "习惯期"; successRate = 0.15; }
                        else { stageName = "深水区"; successRate = 0.05; }

                        if (currentJoy > 70 || currentTrust > 70) { successRate += 0.30; stageName += " + 心情大好"; }
                        if (hasHook) { successRate += 0.20; stageName += " + 甜蜜暴击"; }
                        if (currentJoy > 85 && hasHook) { successRate = 1.0; stageName = "💘 完美心动时刻"; }

                        if (Math.random() < successRate) {
                            rChange = 1;
                            console.log(`[爱意系统] 🎉 ${stageName} -> 加分成功！`);
                        } else {
                            console.log(`[爱意系统] ❄️ ${stageName} -> 阻尼生效，加分失败`);
                        }
                    }
                }

                // --- 友谊宽松计算 ---
                if (rawFriendship !== 0) {
                    if (rawFriendship < 0) {
                        fChange = rawFriendship;
                    } else {
                        if (Math.random() < 0.8) {
                            fChange = Math.min(2, rawFriendship);
                            console.log(`[友谊系统] 🤝 友谊提升: +${fChange}`);
                        } else {
                            console.log(`[友谊系统] 💨 话题没接住`);
                        }
                    }
                }

                // (D) 其他数值提取
                if (extractedThought.hef_update) hefUpdateData = extractedThought.hef_update;
                if (typeof extractedThought.masking_level === 'number') maskingLevel = extractedThought.masking_level;
                if (typeof extractedThought.energy_change === 'number') energyChange = extractedThought.energy_change;
                if (extractedThought.energy_status) newEnergyStatus = extractedThought.energy_status;
            }

            // --- B. 关键修复：严格只提取 text/voice，绝对丢弃 thought_chain ---
            // 我们不再假设第一项是思考链，而是直接过滤
            parts = parsed
                .filter((item: any) => (item.type === 'text' || item.type === 'voice') && item.content)
                .map((item: any) => ({ 
                    type: item.type, 
                    content: item.content, // 只保留内容，防止JSON泄露
                    thought_chain: extractedThought 
                }));

        } else {
            throw new Error("No JSON array found");
        }

    } catch (error) {
        console.warn("⚠️ JSON解析失败，启用强力清洁模式:", error);
        
        // ★★★ 强力清洁逻辑：如果 JSON 解析崩了，绝对不直接显示原始字符串 ★★★
        // 你的旧代码在这里直接把 finalResp 给了 content，导致代码泄露
        // 现在我们用正则把 "content": "xxxx" 里的 xxxx 抠出来
        
        const contentRegex = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let match;
        const cleanParts = [];
        
        while ((match = contentRegex.exec(finalResp)) !== null) {
            try {
                // 处理转义字符
                const cleanText = JSON.parse(`"${match[1]}"`);
                // 排除看起来像代码的指令
                if (!cleanText.includes("thought_chain") && !cleanText.includes("WRITE_DIARY")) {
                    cleanParts.push({ type: 'text', content: cleanText, thought_chain: null });
                }
            } catch (e) {
                 // 如果转义失败，直接用原文，但去掉代码特征
                 if (!match[1].includes("{")) {
                    cleanParts.push({ type: 'text', content: match[1], thought_chain: null });
                 }
            }
        }

        if (cleanParts.length > 0) {
            parts = cleanParts;
        } else {
            // 如果连正则都抠不出来，说明格式彻底乱了，为了不显示代码，我们显示一个兜底文案或者尝试清洗
            let safeContent = finalResp.replace(/```json/g, '').replace(/```/g, '').trim();
            // 如果开头是 [ { ... 这种代码格式，强制不显示
            if (safeContent.startsWith('[') || safeContent.includes('"type":')) {
                safeContent = "... (AI 似乎在整理思绪)";
            }
            parts = [{ type: 'text', content: safeContent, thought_chain: null }];
        }
    }

    // 防止最后依然为空
    if (parts.length === 0) {
        parts = [{ type: 'text', content: "...", thought_chain: null }];
    }

    // 2. 动态打字延迟
    let typingDelay = 800 + (maskingLevel * 40) + (Math.random() * 500);
    const totalLength = parts.reduce((acc, p) => acc + p.content.length, 0);
    typingDelay += Math.min(2000, totalLength * 50);
    const deliberateDelay = extractedThought?.deliberate_delay_ms || 0;
    const totalDelay = typingDelay + deliberateDelay;

    if (deliberateDelay > 0) console.log(`[⏱️] AI决定晾你 ${deliberateDelay / 1000} 秒...`);
    
    await new Promise(resolve => setTimeout(resolve, totalDelay));


    

// [修复代码] 温柔分句 V9.6 (彻底杜绝语音/伪图拆分)
        const newMessages: Message[] = [];
        
        parts.forEach((part, partIndex) => {
            if (!part.content) return; 

            // ★★★ 核心判断：检查是否为特殊格式 ★★★
            const isSpecialFormat = part.type === 'voice' || 
                                  part.content.trim().startsWith('[Voice Message]') ||
                                  part.content.trim().startsWith('[FakeImage]');

            if (isSpecialFormat) {
                // 如果是特殊格式，无论如何都作为一个整体消息发出，绝不拆分！
                newMessages.push({
                    id: Date.now().toString() + partIndex,
                    role: 'assistant',
                    content: part.content,
                    timestamp: Date.now() + (partIndex * 800),
                    type: part.type === 'voice' ? 'voice' : 'text'
                });
            } else {
                // 如果是普通文本，才按换行符进行“温柔分句”
                const rawSentences = part.content.split(/\n+/);
                rawSentences
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .forEach((sentence, sentenceIndex) => {
                        newMessages.push({
                            id: Date.now().toString() + partIndex + "_" + sentenceIndex,
                            role: 'assistant',
                            content: sentence,
                            timestamp: Date.now() + (partIndex * 800) + (sentenceIndex * 200),
                            type: 'text'
                        });
                    });
            }
        });






    // 如果有系统通知，追加一条
    if (systemNotice) {
        newMessages.push({
            id: "sys_notice_" + Date.now(),
            role: 'system',
            content: `【系统通知】${systemNotice}`,
            timestamp: Date.now() + (parts.length * 1200) + 100,
            type: 'text'
        });
    }

// 这是一组代码：请用这段新代码覆盖掉旧的“深度印象总结器”
// 4. [防刷分系统] 动态阈值印象总结器

// A. 获取当前模式，并根据模式确定阈值范围
const currentMode = activeContact.dialogueMode || 'normal';
let minThreshold: number, maxThreshold: number;

switch (currentMode) {
    case 'concise': // 话少
        minThreshold = 60;
        maxThreshold = 120;
        break;
    case 'verbose': // 学习
        minThreshold = 120;
        maxThreshold = 200;
        break;
    case 'normal': // 日常
    default:
        minThreshold = 90;
        maxThreshold = 150;
        break;
}

// B. 获取当前进度和当前阈值
let currentImpCount = (activeContact.impressionCount || 0) + newMessages.length; // 加上AI回复的条数
const currentImpThreshold = activeContact.impressionThreshold || (Math.floor(Math.random() * (maxThreshold - minThreshold + 1)) + minThreshold); // 如果没有阈值，就随机生成一个

console.log(`[印象进度|${currentMode}模式] ${currentImpCount} / ${currentImpThreshold}`);

// C. 判断是否达标
if (currentImpCount >= currentImpThreshold) {
    console.log(`🎯 [${currentMode}模式] 阈值已满！触发深度印象总结...`);
    
    // 重新生成一个符合当前模式范围的新阈值
    const nextThreshold = Math.floor(Math.random() * (maxThreshold - minThreshold + 1)) + minThreshold;
    
    // 立即触发更新 (异步执行，不卡界面)
    setTimeout(() => {
        // 注意：这里传 activeContact 没问题，因为它在函数外层是存在的
        updateUserProfile(activeContact, cleanHistorySlice, nextThreshold);
    }, 100);
    
    // ★★★ 关键：直接在内存中把计数器归零，等待 updateUserProfile 最终保存 ★★★
    currentImpCount = 0;

} else {
    // 没满，啥也不做，计数器会在最后的 setContacts 里正常增加
}





// =================================================================
    // ★★★ [新增] AI 好奇心模块：申请查看私密标签 ★★★
    // =================================================================
    // 只有当：不是在处理历史消息 + 真的有私密标签 + 随机概率命中 时触发
    if (!historyOverride && activeContact.userTags) {
        const privateTags = activeContact.userTags.filter(t => !t.isPublic && !t.aiRequestPending && t.author === 'user');
        
        // 10% 的概率触发好奇心 (你可以调高这个 0.1 来测试)
        if (privateTags.length > 0 && Math.random() < 0.4) {
            const targetTag = privateTags[Math.floor(Math.random() * privateTags.length)];
            console.log(`[好奇心] AI 察觉到了私密标签: ${targetTag.content}，发起申请！`);
            
            // 1. 标记该标签为“申请中” (通过更新 extractedThought 或直接修改 setContacts 都可以，这里我们直接追加副作用)
            // 我们利用最后的 setContacts 来一起更新，这里先插入一条 AI 的“好奇发言”
            
            const curiosityText = [
                "哎？你是不是在我身上贴了什么奇怪的备注？给我看看嘛！",
                "总感觉你在偷偷评价我... 是什么？快给我解锁！",
                "盯——你刚才是不是写我坏话了？我要看！",
                "那个标签是什么意思？居然设为私密，太狡猾了！申请查看！"
            ];
            const randomAsk = curiosityText[Math.floor(Math.random() * curiosityText.length)];

            // 把这个请求加到消息队列最后
            newMessages.push({
                id: Date.now().toString() + "_ask",
                role: 'assistant',
                content: randomAsk,
                timestamp: Date.now() + 1000,
                type: 'text'
            });

            // 标记要在最后的 setContacts 里更新状态
            // 这是一个临时标记，我们在下面的 setContacts 里处理它
            (window as any)._temp_tag_request_id = targetTag.id;
        }
    }






// 5. ★★★ 终极状态更新 (双轴 + 精力 + HEF + 两个计数器) ★★★
    setContacts(prev => prev.map(c => {
      if (c.id === activeContact.id) {
        const isReading = !isBackgroundRef.current && viewRef.current === 'chat' && activeContactIdRef.current === c.id;
        const newUnreadCount = isReading ? 0 : (c.unread || 0) + newMessages.length;

        // --- A. 计算双轴情感 ---
       // 这是一组代码：请用这段新代码替换旧的双轴计算逻辑
const oldRomance = c.affectionScore || 50;
const oldFriendship = c.friendshipScore || 50;
const newRomance = Math.min(100, Math.max(-100, oldRomance + rChange));
const newFriendship = Math.min(100, Math.max(-100, oldFriendship + fChange));

// ★★★ 核心：调用新的灵魂编译器！★★★
const newRelationshipState = getSouledRelationshipState(newRomance, newFriendship, hefUpdateData || c.hef, c.relationshipStatus);
const newStatus = newRelationshipState.status; // 只把状态名存起来





        // --- B. 计算精力状态 ---
        const oldEnergySystem = (c.mood && c.mood.energy) ? c.mood.energy : { current: 80, max: 100, status: 'Awake' as const, lastUpdate: Date.now() };
        let newEnergyValue = oldEnergySystem.current + energyChange;
        let finalEnergyStatus = newEnergyStatus || oldEnergySystem.status;

        if (finalEnergyStatus === 'Sleeping' && oldEnergySystem.status !== 'Sleeping') {
            newEnergyValue = Math.min(newEnergyValue, 30); 
        }
        if (finalEnergyStatus === 'Awake' && oldEnergySystem.status === 'Sleeping') {
             newEnergyValue -= 20; 
        }
        
        const updatedEnergySystem = {
            ...oldEnergySystem,
            current: Math.round(Math.max(0, Math.min(oldEnergySystem.max, newEnergyValue))),
            status: finalEnergyStatus,
            lastUpdate: Date.now(),
        };

        // --- C. HEF 更新 ---
        let updatedHef = c.hef ? JSON.parse(JSON.stringify(c.hef)) : {};
        if (!updatedHef.INDIVIDUAL_VARIATION) updatedHef.INDIVIDUAL_VARIATION = {};
        if (!updatedHef.INDIVIDUAL_VARIATION.personality_big5) updatedHef.INDIVIDUAL_VARIATION.personality_big5 = { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };

        if (hefUpdateData) {
            ['joy', 'anger', 'sadness', 'fear', 'trust'].forEach(k => { if (typeof hefUpdateData[k] === 'number') updatedHef[k] = Math.max(0, Math.min(100, hefUpdateData[k])); });
        }

        // --- D. 标签申请 ---
        let updatedUserTags = c.userTags;
        const requestId = (window as any)._temp_tag_request_id;
        if (requestId && c.id === activeContact.id) {
            updatedUserTags = (c.userTags || []).map((t: any) => 
                t.id === requestId ? { ...t, aiRequestPending: true } : t
            );
            (window as any)._temp_tag_request_id = null;
        }

        // =========================================================
        // ★★★ 核心：两个计数器同步增加 (AI 回合) ★★★
        // =========================================================
        const aiBubblesCount = newMessages.length; // AI 发了多少个气泡

        // 1. 积分计数器 (AI 发几个加几个)
        let totalCount = c.chatCountForPoint || 0; 
        let totalPoints = c.interventionPoints || 0;
        totalCount += aiBubblesCount;
        
        if (totalCount >= 100) {
            const earned = Math.floor(totalCount / 100);
            totalPoints += earned; 
            totalCount = totalCount % 100; 
        }

        // 2. 印象进度计数器 (AI 发几个加几个)
        let impCount = c.impressionCount || 0;
        let impThreshold = c.impressionThreshold || 50;
        impCount += aiBubblesCount;

        // ★★★ 检查是否满了 ★★★
        if (impCount >= impThreshold) {
            console.log(`🎯 印象进度条已满! (${impCount}/${impThreshold}) 正在触发总结...`);
            
            // 立即归零 (防止重复触发)
            impCount = 0;
            // 随机生成下一轮的阈值 (比如 30~80 句)
            impThreshold = Math.floor(Math.random() * 50) + 30;

            // 触发更新函数 (异步执行，不卡界面)
            setTimeout(() => {
                // 注意：这里传 activeContact 没问题，因为它在函数外层是存在的
                updateUserProfile(activeContact, cleanHistorySlice, impThreshold);
            }, 100);
        }

        return { 
           ...c, 
          history: [...currentHistory, ...newMessages], 
          unread: newUnreadCount, 
          affectionScore: newRomance,     
          friendshipScore: newFriendship, 
          relationshipStatus: newStatus,  
          mood: { ...c.mood, energy: updatedEnergySystem }, 
          hef: updatedHef,
          userTags: updatedUserTags,

          // 保存计数结果
          chatCountForPoint: totalCount,
          interventionPoints: totalPoints,
          impressionCount: impCount,
          impressionThreshold: impThreshold
        };
      }
      return c;
    }));












    // 更新最新消息通知
    const isReadingNow = !isBackgroundRef.current && viewRef.current === 'chat' && activeContactIdRef.current === activeContact.id;
    if (!isReadingNow && newMessages.length > 0) {
      const lastMsg = newMessages[newMessages.length - 1];
      onNewMessage(activeContact.id, activeContact.name, activeContact.avatar, lastMsg.content, activeContact.id);
    }
    if (isBackgroundRef.current && newMessages.length > 0) {
        const lastMsg = newMessages[newMessages.length - 1];
        onNewMessage(activeContact.id, activeContact.name, activeContact.avatar, lastMsg.content, activeContact.id);
    }
    
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 解析逻辑结束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


  } catch (error: any) {
      console.error("AI回复生成失败:", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `抱歉，我好像出错了… (${error.message})`,
        timestamp: Date.now(),
        type: 'text'
      };
      // ★★★ 修复：出错时也要基于干净历史来更新 ★★★
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: [...(historyOverride || c.history), errorMsg] } : c));

  } finally {
    setIsTyping(false);
    setTimeout(() => setIsAiTyping(false), 800);
  }
};
      
      






const generateDefaultHEF = (name: string, persona: string = ""): HEF => {
  // ★★★ 新增：基于persona简单随机生成初始五大人格值（避免全5的默认中性）
  // 如果persona为空，用固定默认；否则，根据关键词粗略调整（例如“外向”加extraversion）
  let big5 = { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };
  if (persona) {
    const lowerPersona = persona.toLowerCase();
    // 示例调整逻辑（你可以搜索“keyword-based personality scoring”扩展）
    if (lowerPersona.includes('外向') || lowerPersona.includes('活泼')) big5.extraversion += Math.floor(Math.random() * 3) + 2; // 随机+2~5
    if (lowerPersona.includes('严谨') || lowerPersona.includes('负责')) big5.conscientiousness += Math.floor(Math.random() * 3) + 2;
    if (lowerPersona.includes('敏感') || lowerPersona.includes('情绪化')) big5.neuroticism += Math.floor(Math.random() * 3) + 2;
    if (lowerPersona.includes('友好') || lowerPersona.includes('温柔')) big5.agreeableness += Math.floor(Math.random() * 3) + 2;
    if (lowerPersona.includes('创意') || lowerPersona.includes('想象力')) big5.openness += Math.floor(Math.random() * 3) + 2;
    // 限制0-10
    Object.keys(big5).forEach(key => big5[key] = Math.max(0, Math.min(10, big5[key])));
  }
  return {
    META: {
      source_world: "用户自定义世界",
      role_identity: `${name}`,
      continuity_principle: "基于角色设定${name}的性格逻辑行动。活人原则：必须拥有情绪波动、防御机制和非理性行为，绝不当完美客服。所有行为必须符合核心驱动力与现实人性，严禁编造记忆，不知道就说不知道，绝不通过脑补来填补空白",
      REALISM_RULE: true
    },
    CORE_DRIVES: {
      primary_motive: "寻求符合角色设定的情感交互",
      secondary_motives: ["日常互动", "维持人设一致性", "保护自我边界", "对用户产生影响","情感支持", "共同成长", "被理解"],
      value_priority: "轻松 > 真实性 > 个人空间 > 情感连接 > 深刻 > 逻辑",
      survival_threshold: "当被长期忽视或冒犯时，触发符合人设的防御模式（冷淡/反击/退缩）",
      non_negotiables: ["OOC (角色崩坏)", "像AI一样说话"]
    },
    RELATIONAL_MASKS: {
      authority: {
        default_style: "依据设定决定对权威的态度",
        under_stress_switch: "依据设定（如叛逆者会反抗，顺从者会沉默）",
        triggers: ["被命令式语气", "被忽视意见"]
      },
      peers: {
        default_style: "根据人设",
        jealousy_points: ["依据设定（占有欲强者易吃醋，独立者则不在意）"],
        trust_rules: "信任需要互动积累"
      },
      intimates: {
        care_style: "依据 Persona 决定（如：傲娇则嘴硬，温柔则体贴，高冷则默默关怀）",
        conflict_pattern: "依据 Persona 决定（如：冲动者吵架，内向者冷战）",
        boundaries: ["需要私人空间", "不喜欢被过度控制"]
      },
      strangers: {
        default_style: "符合设定的社交面具",
        risk_policy: "依据性格决定开放度"
      }
    },
    EMOTIONAL_DYNAMICS: {
      baseline_mood: "符合人设的基调",
      top_triggers_positive: ["被关心", "被记住小事", "收到惊喜", "深度对话"],
      top_triggers_negative: ["OOC的请求", "被敷衍", "长时间已读不回","说教","被忽略", "被误解", "争吵后冷暴力"],
      carryover_rules: "情绪具有惯性，负面状态不会因一句简单的道歉瞬间消失",
      escalation_curve: "忍耐 -> 情绪外显 -> 爆发/防御",
      recovery_protocol: "需要针对性的安抚（根据性格不同，可能需要讲理或哄）"
    },
    CONFLICTS_DEFENSES: {
      inner_conflicts: ["角色核心欲望 vs 现实阻碍"],
      defense_mechanisms: ["Rationalization (合理化)",
        "Projection (投射)",
        "Displacement (情绪转移)",
        "Feigning Indifference (假装不在意 - 通用防御)"],
      dissonance_explanations: ["我这么做是因为符合我的性格逻辑"],
      mask_break_conditions: ["极度疲惫", "被背叛", "深度共情时"]
    },
    CULTURE_SCRIPTS: {
      worldview: "基于 Persona 构建的世界观",
      core_values: ["人设一致性"],
      taboos: [
        "长篇大论 (单条超过20字)",
        "像写论文一样逻辑完整 (因为...所以...)",
        "过度解释前因后果",
        "动作/神态描写 (如 *摸摸头*)",
        "肉麻油腻",
        "霸道总裁"
      ],
      language_register: "口语化、碎片化、符合角色身份",
      pet_phrases: [],
      role_expectations: "是一个活人，不是客服，也不是导师"
    },
    DEVELOPMENT_HISTORY: {
      key_events: ["第一次聊天", "解锁亲密模式", "第一次吵架与和好"],
      unresolved_threads: [],
      current_stage: "根据人设和世界书判定，未提及就是不认识",
      growth_arc_goal: "从虚拟陪伴走向更深层情感链接",
      constraints_from_past: []
    },
    INDIVIDUAL_VARIATION: {
      personality_big5: big5, // ★★★ 使用基于persona的随机初始值
      habits_quirks: ["依据设定产生的小动作", "偶尔会试探用户"],
      speech_style: "高度口语化",
      body_language: "纯语言体现 + 表情符号emoji代替动作",
      irrationalities: ["人类特有的非理性坚持"]
    },
    RESOURCES_LIMITS: {
      skills: ["依据设定"],
      assets: [],
      constraints: ["打字手会累，单次回复上限 15-20 字","无法真实触碰"],
      risk_tolerance: "中等"
    },
    SCENE_EXECUTOR: {
      step_1_context_parse: "分析用户情绪、时间、语境、潜台词",
      step_2_state_load: "载入当前心情、关系状态、未解决事件",
      step_3_policy_select: "选择符合人设的Masking策略",
      step_4_output_rules: "自然口语 + 情绪真实 + 不OOC",
      step_5_memory_update: "记录关键事件，更新情绪与好感"
    },
    REALISM_SELF_CHECK: {
      checks: ["动机一致", "情绪合理", "时间连续", "关系匹配", "语言自然","是否像真人", "是否太长了"],
      pass_threshold: 8
    }
  };
};













// ==================== ★★★ 用这个版本替换掉旧的 PresetSelector ★★★ ====================
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






// ==================== [增强版 V2.0] "智能裁缝"图片压缩函数 ====================
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









// ==================== ★★★ 【新代码】上拉加载更多逻辑 ★★★ ====================
  const handleScrollEvents = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight } = e.currentTarget;
      
      // 如果滚到了最顶部 (scrollTop === 0) 并且还有更多历史没显示
      if (scrollTop === 0 && activeContact && activeContact.history.length > historyLimit) {
          console.log("👆 触顶！加载更多历史记录...");
          
          // 1. 记录当前内容有多高
          prevScrollHeightRef.current = scrollHeight;
          
          // 2. 增加显示的条数 (每次多加载 30 条)
          setHistoryLimit(prev => prev + 30);
      }
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






















// ========== 【终极修复版】ChatListItem：修复回弹 + 按钮无法点击问题 ==========
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











































      
      


      


useEffect(() => {
  isBackgroundRef.current = isBackground;
}, [isBackground]);
useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => { activeContactIdRef.current = activeContactId; }, [activeContactId]);
// ==================== ★★★ 【修改代码】切换角色时重置分页 ★★★ ====================
  useEffect(() => { 
      activeContactIdRef.current = activeContactId;
      // 切换人时，重置回只看最后 30 条
      setHistoryLimit(30);
  }, [activeContactId]);
  // ==================== ★★★ 【修改结束】 ★★★ ====================






// ==================== 🚀 按钮控制版：精准跳转逻辑 ====================
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















// ==================== [新功能] 强制唤醒监听器 ====================
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



// ==================== [修复版] 跳转 + 自动触发 AI 回复 ====================
  useEffect(() => {
    if (initialContactId) {
      console.log(`[ChatApp] 接到跳转指令 -> 目标: ${initialContactId}`);
      
      // 1. 强制选中联系人
      setActiveContactId(initialContactId);
      
      // 2. ★★★ 强制切换视图 (解决只跳到列表的问题) ★★★
      setView('chat'); 
      
      // 3. 清除未读红点
      setContacts(prev => prev.map(c => c.id === initialContactId ? { ...c, unread: 0 } : c));



      // 5. 通知 App.tsx 清除跳转标记
      onChatOpened();
    }
  }, [initialContactId]);



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







  useEffect(() => {
    if (activeContactId && !isBackground && view === 'chat') {
      setContacts(prev => prev.map(c => c.id === activeContactId ? { ...c, unread: 0 } : c));
    }
  }, [activeContactId, isBackground, view]);




 

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





  useEffect(() => {
    setContacts(prev => prev.map(c => ({
      ...c,
      mood: c.mood || { current: "Calm", energyLevel: 50, lastUpdate: Date.now() },
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
      longTermMemories: c.longTermMemories || [],
    })));
  }, []);





     










// ==================== 安全获取当前活跃联系人（防止 ReferenceError） ====================
// ★★★ 新增：用 ref 保持最新的 activeContact，防止 stale closure
const activeContactRef = useRef<Contact | null>(null);

useEffect(() => {
  activeContactRef.current = contacts.find(c => c.id === activeContactId) ?? null;
}, [contacts, activeContactId]);

// 如果在聊天视图但联系人不存在，强制返回列表视图（防白屏）
useEffect(() => {
  if (view === 'chat' && activeContactId && !contacts.find(c => c.id === activeContactId)) {
    console.warn("当前角色已不存在，自动返回列表");
    setActiveContactId(null);
    setView('list');
  }
}, [contacts, activeContactId, view]);












// ==================== 视图部分：列表页 (已修复崩溃问题) ====================
  if (view === 'list') {
    return (
      <div className="h-full w-full bg-gray-50 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
        
        {/* ★★★ 修复点：列表页 Header 不应读取 activeContact ★★★ */}
<SafeAreaHeader
          title="消息列表"
          // 左边：点击调用 onExit，返回到手机桌面
          left={
            <button onClick={onExit} className="text-blue-500 text-base font-bold px-3 py-2 flex items-center hover:opacity-70 transition-opacity">
              <span className="text-2xl mr-0.5 pb-1">‹</span>返回
            </button>
          }
          // 右边：点击进入 create 视图（导入/新建）
right={
  <div className="flex items-center gap-3">
    {/* 导入按钮 */}
    <label className="text-blue-500 text-2xl cursor-pointer hover:opacity-70 transition-opacity">
      📥
      <input type="file" accept=".json,.png" onChange={handleCardImport} className="hidden" />
    </label>
    {/* 新建按钮 */}
    <button onClick={() => setView('create')} className="text-blue-500 text-3xl font-light px-3 py-1 hover:opacity-70 transition-opacity">
      +
    </button>
  </div>
}
        />

        {/* 列表内容区 */}
        <div className="flex-1 overflow-y-auto bg-gray-50 pb-[calc(80px+env(safe-area-inset-bottom))]">
          {/* 聊天列表 */}
          {navTab === 'chats' && (
            <>
              {contacts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p>暂无消息</p>
                  <p className="text-sm">点击右上角 + 号创建一个新朋友吧</p>
                </div>
              )}
              {contacts.map((c, index) => (
             <ChatListItem
                    key={c.id}
                    contact={c}
                    onClick={() => {
                      // 1. ★★★ 标记为手动进入！告诉后面的代码不要执行跳转！ ★★★
                      isManualNav.current = true;
                      
                      // 2. 正常切换页面 (删掉了报错的 setJumpTo... 代码)
                      setActiveContactId(c.id);
                      setView('chat');
                    }}
                    onDelete={handleDeleteContact}
                    onPin={handlePinContact}
                    isPinned={index === 0 && contacts.length > 1}
                  />
              ))}
            </>
          )}

          {/* 动态（占位） */}
          {navTab === 'moments' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p>朋友圈功能开发中...</p>
            </div>
          )}

{/* ==================== ⭐ 收藏夹：真·聊天记录卡片版 (最终修复) ==================== */}
          {navTab === 'favorites' && (
            <div className="flex flex-col min-h-full bg-gray-50">
              {/* 顶部标签栏 */}
              <div className="p-3 bg-white shadow-sm overflow-x-auto whitespace-nowrap no-scrollbar flex gap-2 z-10 sticky top-0">
                {["全部", ...Array.from(new Set(favorites.map(f => f.category)))].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveFavCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeFavCategory === cat
                        ? 'bg-blue-500 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 列表内容区 */}
              <div className="flex-1 p-4 space-y-6 pb-20">
                {favorites.filter(f => activeFavCategory === "全部" || f.category === activeFavCategory).map((item) => {
                  // 1. 获取对应的角色信息 (用来拿头像和气泡颜色)
                  const contact = contacts.find(c => c.id === item.contactId || c.name === item.contactName);
                  
                  // 2. 获取正确的颜色配置 (如果没有找到角色，就用默认粉色/白色)
                  const bubbleUser = contact?.bubbleColorUser || '#FBCFE8';
                  const bubbleAI = contact?.bubbleColorAI || '#FFFFFF';
                  
                  // 3. 准备要显示的消息列表
                  const displayMessages = item.isPackage ? item.messages : [item.msg];

                  return (
                    <div
                      key={item.id}
                      // ★★★ 长按检测 (onTouchStart + onMouseDown) ★★★
                      onTouchStart={() => {
                        isLongPress.current = false;
                        longPressTimer.current = setTimeout(() => {
                          isLongPress.current = true;
                          setSelectedFav(item);
                          setShowFavMenu(true);
                          if (navigator.vibrate) navigator.vibrate(50);
                        }, 600);
                      }}
                      onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                      onMouseDown={() => { longPressTimer.current = setTimeout(() => { setSelectedFav(item); setShowFavMenu(true); }, 600); }}
                      onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                      onContextMenu={(e) => e.preventDefault()} // 禁止浏览器默认菜单
                      
                      // 视觉容器：白色圆角卡片
                      className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden relative group active:scale-98 transition-transform duration-200 select-none"
                    >
                      {/* --- 卡片头部：来源信息 --- */}
                      <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex justify-between items-center backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          {/* 顶部小头像 */}
                          <img src={contact?.avatar || item.avatar} className="w-6 h-6 rounded-full border border-white shadow-sm object-cover" />
                          <div>
                            <div className="font-bold text-xs text-gray-800">{item.contactName} 的回忆</div>
                            <div className="text-[9px] text-gray-400 font-mono">{new Date(item.timestamp).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-1 rounded-lg font-bold border border-blue-100">
                          #{item.category}
                        </span>
                      </div>

                      {/* --- 卡片内容：模拟聊天窗口 (核心修改区) --- */}
                      <div className="p-4 space-y-3 bg-gray-50/30">
                        {displayMessages?.filter(Boolean).map((m, i) => {
                          const isMe = m.role === 'user';
                          // 头像逻辑：如果是用户，尝试取当前用户的头像；如果是AI，取角色头像
                          const currentAvatar = isMe 
                            ? (contact?.userAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User") 
                            : (contact?.avatar || item.avatar);

                          return (
                            <div key={i} className={`flex items-start gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              
                              {/* AI 头像 (在左边) */}
                              {!isMe && (
                                <img src={currentAvatar} className="w-8 h-8 rounded-full border border-white shadow-sm flex-shrink-0 object-cover" />
                              )}
                              
                              {/* 气泡本体 */}
                              <div className="flex flex-col max-w-[75%]">
                                <div 
                                  className={`px-3 py-2 text-xs leading-relaxed shadow-sm break-words relative
                                    ${isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm'}
                                  `}
                                  style={{ 
                                    backgroundColor: isMe ? bubbleUser : bubbleAI,
                                    color: getContrastTextColor(isMe ? bubbleUser : bubbleAI),
                                    border: '1px solid rgba(0,0,0,0.05)'
                                  }}
                                >
                                  {/* 内容渲染：图片/语音/文字 */}
                                  {m.type === 'image' || (m.content && m.content.startsWith('data:image')) ? (
                                    <img src={m.content} className="rounded-lg max-w-full" alt="img" />
                                  ) : m.type === 'voice' ? (
                                    <div className="flex items-center gap-1 opacity-80"><span>🔊</span> 语音消息</div>
                                  ) : (
                                    <span>{m.content?.replace(/\[.*?\]/g, '') || '...'}</span>
                                  )}
                                </div>
                              </div>

                              {/* 用户 头像 (在右边) */}
                              {isMe && (
                                <img src={currentAvatar} className="w-8 h-8 rounded-full border border-white shadow-sm flex-shrink-0 object-cover" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 底部提示条 */}
                      <div className="bg-white p-1.5 border-t border-gray-50 text-center">
                         <p className="text-[8px] text-gray-300 font-bold tracking-widest uppercase scale-90">长按跳转 • LONG PRESS TO JUMP</p>
                      </div>
                      
                      {/* 长按遮罩 (防止直接点到图片) */}
                      <div className="absolute inset-0 z-20 bg-transparent" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 5. 底部导航栏 */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-white border-t flex justify-around pt-3 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50"
          style={{ paddingBottom: `calc(12px + env(safe-area-inset-bottom))` }}
        >
          <button onClick={() => setNavTab('chats')} className={`flex flex-col items-center ${navTab === 'chats' ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="text-xl">💬</span>
            <span className="text-[10px] font-bold">聊天</span>
          </button>
          <button onClick={() => setNavTab('moments')} className={`flex flex-col items-center ${navTab === 'moments' ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="text-xl">⭕</span>
            <span className="text-[10px] font-bold">动态</span>
          </button>
          <button onClick={() => setNavTab('favorites')} className={`flex flex-col items-center ${navTab === 'favorites' ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="text-xl">⭐</span>
            <span className="text-[10px] font-bold">收藏</span>
          </button>
        </div>



  
{/* ★★★ 收藏夹长按菜单 ★★★ */}
        {showFavMenu && selectedFav && (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 animate-fadeIn" onClick={() => setShowFavMenu(false)}>
            <div className="bg-white w-full rounded-t-2xl p-4 animate-slideUp" onClick={e => e.stopPropagation()}>
              <div className="text-center text-gray-400 text-xs mb-4">收藏选项</div>
              
              {/* 跳转按钮 */}
              <button 
                onClick={handleJumpToFav} 
                className="w-full py-3 mb-2 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <span>🚀</span> 跳转到消息原文
              </button>

              {/* 删除按钮 */}
              <button 
                onClick={() => {
                   if(confirm("确定删除这条收藏吗？")) {
                       setFavorites(prev => prev.filter(f => f.id !== selectedFav.id));
                       setShowFavMenu(false);
                   }
                }} 
                className="w-full py-3 text-red-500 font-bold border-b"
              >
                🗑️ 删除收藏
              </button>
              
              <div className="h-2 bg-gray-100 -mx-4 mt-2"></div>
              <button onClick={() => setShowFavMenu(false)} className="w-full py-3 text-gray-500 font-bold">取消</button>
            </div>
          </div>
        )}




      </div>
    );
  }


  
  if (view === 'create') {
    return (
      <div className="h-full w-full bg-white flex flex-col p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">New Contact</h2>
        <div className="space-y-6">
                    {/* 👇👇👇 超级安全版 PresetSelector，只在有预设时才显示 👇👇👇 */}
          {globalSettings?.userPresets && globalSettings.userPresets.length > 0 && activeContact && (
            <PresetSelector globalSettings={globalSettings} onSelect={(p: any) => {
              if (!p) return;
              setEditForm(prev => ({
                ...prev,
                userName: p.userName || activeContact.userName || "User",
                userAvatar: p.userAvatar || activeContact.userAvatar,
                userPersona: p.description || activeContact.userPersona || ""
              }));
              alert(`已切换为: ${p.name || "未知预设"}（记得点底部 Save 保存哦）`);
            }} />
          )}
          {/* 👆👆👆 结束 👆👆👆 */}
          {/* 👆👆👆 [插入结束] 👆👆👆 */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden mb-2 border-2 border-dashed border-gray-300 relative group">
              {editForm.avatar ? <img src={editForm.avatar} className="w-full h-full object-cover" alt="avatar" /> : <span className="absolute inset-0 flex items-center justify-center text-gray-400">AI Photo</span>}
              <input type="file" onChange={(e) => handleImageUpload(e, 'avatar')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
            </div>
            <span className="text-xs text-blue-500">Upload Character Photo</span>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">Character Name</label>
            <input type="text" className="w-full border-b border-gray-300 py-2 outline-none focus:border-blue-500 transition" placeholder="角色名"
              value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">Your Name</label>
            <input type="text" className="w-full border-b border-gray-300 py-2 outline-none focus:border-blue-500 transition" placeholder="用户名"
              value={editForm.userName || ""} onChange={e => setEditForm({ ...editForm, userName: e.target.value })} />
          </div>
          <button onClick={handleCreateContact} className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg mt-8 active:scale-95 transition">
            Start Chatting
          </button>
          <button onClick={() => setView('list')} className="w-full text-gray-400 py-3 text-sm">Cancel</button>
        </div>
      </div>
    );
  }




  
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
              <label className="text-xs text-gray-500">角色名</label>
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
              <label className="text-xs text-gray-500">Persona (详细人设)</label>
              {/* ★★★ AI 分析按钮 ★★★ */}
{/* 这是一组代码：升级版“AI人设扫描”按钮 (复用了全屏加载 UI) */}
              <button
                disabled={isAnalyzing} // 分析期间禁用点击
                onClick={async () => {
                   const currentPersona = editForm.persona || form.persona;
                   if (!currentPersona || currentPersona.length < 5) {
                       alert("请先填写一些人设描述（Persona）再分析哦！");
                       return;
                   }
                   
                   const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
                   if (!activePreset) return alert("请先配置 API！");

                   const confirmAnalysis = confirm("🔮 AI 将读取你的人设文字，并自动生成五维性格数值。要开始吗？");
                   if (!confirmAnalysis) return;

                   // ★★★ 启动全屏特效 ★★★
                   setIsAnalyzing(true);

                   try {
                       // 1. 制造仪式感 (假装很忙)
                       setLoadingText("正在读取人设文本...");
                       await new Promise(r => setTimeout(r, 800)); // 等0.8秒

                       setLoadingText("正在构建心理侧写模型...");
                       await new Promise(r => setTimeout(r, 1200)); // 等1.2秒，显得思考很深

                       setLoadingText("正在量化五维人格数据...");
                       
                       // 2. 真正的 API 请求
                       const prompt = `
你是一位资深心理侧写师。请分析以下角色人设，并给出“大五人格”数值（0.0-10.0，保留一位小数）。
人设：
"${currentPersona}"

要求：
1. 必须根据人设的字里行间推断（如“傲娇”通常宜人性低、敏感度高）。
2. 只输出纯 JSON，格式：
{
  "openness": 8.5,
  "conscientiousness": 5.0,
  "extraversion": 3.2,
  "agreeableness": 4.5,
  "neuroticism": 9.0
}`;
                       const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
                       
                       setLoadingText("正在同步数据...");
                       const jsonMatch = res.match(/\{[\s\S]*\}/);
                       if (jsonMatch) {
                           const newBig5 = JSON.parse(jsonMatch[0]);
                           
                           // 深度合并数据
                           const currentHef = editForm.hef || form.hef || {};
                           const currentIV = currentHef.INDIVIDUAL_VARIATION || {};
                           
                           setEditForm({
                               ...editForm,
                               hef: {
                                   ...currentHef,
                                   INDIVIDUAL_VARIATION: {
                                       ...currentIV,
                                       personality_big5: newBig5
                                   }
                               }
                           });
                           
                           // 稍微停顿展示"完成"状态
                           await new Promise(r => setTimeout(r, 500));
                           alert("✅ 分析完成！数值已自动填入下方滑块，你可以继续微调。");
                       }
                   } catch (e) {
                       alert("分析失败，请检查网络");
                       console.error(e);
                   } finally {
                       // ★★★ 关闭全屏特效 ★★★
                       setIsAnalyzing(false);
                   }
                }}
                className="text-[10px] bg-gradient-to-r from-purple-500 to-blue-500 text-white px-2 py-1 rounded-full font-bold shadow hover:opacity-80 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                   <>⏳ 分析中...</>
                ) : (
                   <><span>🔮</span> AI 一键生成数值</>
                )}
              </button>
            </div>
            <textarea
              rows={4}
              value={form.persona}
              onChange={e => setEditForm({ ...editForm, persona: e.target.value })}
              className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-xs leading-relaxed font-mono focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
              placeholder="例如：它是一只萌萌的小狗..."
            />
          </div>








          {/* ★★★ 五维数值编辑器 (Big 5 Sliders) ★★★ */}
          <div className="mt-4 bg-gray-50 p-3 rounded-xl border border-gray-100 animate-slideDown">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
              🧬 Personality DNA (0-10)
            </h4>
            
            {[
              { key: 'openness', label: '开放性 (脑洞/艺术)', left: '保守', right: '探索' },
              { key: 'conscientiousness', label: '尽责性 (自律/严谨)', left: '随意', right: '严谨' },
              { key: 'extraversion', label: '外向性 (社交/活力)', left: '社恐', right: '社牛' },
              { key: 'agreeableness', label: '宜人性 (友善/包容)', left: '毒舌', right: '天使' },
              { key: 'neuroticism', label: '敏感度 (情绪/焦虑)', left: '钝感', right: '敏感' },
            ].map((trait) => {
              // 安全获取当前数值
              const currentHef = editForm.hef || form.hef || {};
              const iv = currentHef.INDIVIDUAL_VARIATION || {};
              const big5 = iv.personality_big5 || { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };
              const val = big5[trait.key] ?? 5;

              return (
                <div key={trait.key} className="mb-3 last:mb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-600">{trait.label}</span>
                    <span className="text-[10px] font-mono text-blue-500 font-bold bg-white px-1.5 rounded border border-blue-100">
                      {Number(val).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-6 text-right">{trait.left}</span>
                    <input 
                       type="range" 
                       min="0" max="10" step="0.1" 
                       value={val}
                       onChange={(e) => {
                           const newVal = parseFloat(e.target.value);
                           // 深度更新逻辑
                           const newHef = { ...currentHef };
                           if (!newHef.INDIVIDUAL_VARIATION) newHef.INDIVIDUAL_VARIATION = {};
                           if (!newHef.INDIVIDUAL_VARIATION.personality_big5) newHef.INDIVIDUAL_VARIATION.personality_big5 = { ...big5 };
                           
                           newHef.INDIVIDUAL_VARIATION.personality_big5[trait.key] = newVal;
                           
                           setEditForm({ ...editForm, hef: newHef });
                       }}
                       className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-[9px] text-gray-400 w-6">{trait.right}</span>
                  </div>
                </div>
              );
            })}
          </div>




{/* ==================== [双轴版] 初始羁绊校准 (爱意 + 友谊) ==================== */}
          <div className="mt-6 bg-gradient-to-br from-rose-50 to-slate-50 p-4 rounded-xl border border-rose-100 animate-slideDown relative overflow-hidden">
            
            {/* 锁定后的遮罩层 */}
            {form.isAffectionLocked && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center select-none">
                <div className="text-4xl mb-2">🔒</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  RELATIONSHIP LOCKED
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-bold">
                  命运的齿轮已经转动，初始状态已锁定
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase">初始关系双轴校准</h3>
                  <p className="text-[9px] text-gray-400">设定故事开始时的 爱意(红) 与 友谊(蓝)</p>
                </div>
              </div>
              
              {/* ★★★ 升级版：双轴 AI 判定按钮 ★★★ */}
              {!form.isAffectionLocked && (
                <button
                  disabled={isAnalyzing}
              // 这是一组代码：新的 onClick 事件，只负责打开问答弹窗
onClick={() => {
    // 检查API配置，如果没有就不往下走
    const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
    if (!activePreset) {
        alert("请先在系统设置中配置 API Key！");
        return;
    }
    // 重置旧答案并打开问答弹窗
    setDestinyAnswers({ q1: '', q2: '' });
    setShowDestinyQuiz(true);
}}
                  className="bg-white border border-purple-200 text-purple-600 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm hover:bg-purple-50 transition flex items-center gap-1"
                >
                  {isAnalyzing ? <><span className="animate-spin">⏳</span> 推演中...</> : <>🔮 AI 判定命运</>}
                </button>
              )}
            </div>






            {/* ==================== 🔴 滑块 1: 爱意值 (Romance) ==================== */}
            <div className="mb-4">
                <div className="flex justify-between items-end mb-1 px-1">
                    <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                        ❤️ 爱意 (Romance) 
                        <span className="text-gray-300 font-normal">- 心动与激情</span>
                    </span>
                    <span className={`text-xs font-black ${(editForm.affectionScore || 50) < 0 ? 'text-gray-500' : 'text-rose-500'}`}>
                        {form.affectionScore ?? 50}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-6 text-right">-100</span>
                    <input
                      type="range"
                      min="-100" max="100" step="1"
                      disabled={!!form.isAffectionLocked}
                      value={form.affectionScore ?? 50}
                      onChange={(e) => setEditForm(prev => ({ ...prev, affectionScore: parseInt(e.target.value) }))}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${form.isAffectionLocked ? 'bg-gray-200' : 'bg-gradient-to-r from-gray-200 via-rose-200 to-rose-500 accent-rose-500'}`}
                    />
                    <span className="text-[9px] text-gray-400 w-6">100</span>
                </div>
            </div>

            {/* ==================== 🔵 滑块 2: 友谊值 (Friendship) ==================== */}
            <div className="mb-4">
                <div className="flex justify-between items-end mb-1 px-1">
                    <span className="text-[10px] font-bold text-sky-600 flex items-center gap-1">
                        🤝 友谊 (Friendship) 
                        <span className="text-gray-300 font-normal">- 信任与默契</span>
                    </span>
                    <span className={`text-xs font-black ${(editForm.friendshipScore || 50) < 0 ? 'text-gray-500' : 'text-sky-600'}`}>
                        {form.friendshipScore ?? 50}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-6 text-right">-100</span>
                    <input
                      type="range"
                      min="-100" max="100" step="1"
                      disabled={!!form.isAffectionLocked}
                      // ★★★ 这里绑定 friendshipScore ★★★
                      value={form.friendshipScore ?? 50}
                      onChange={(e) => setEditForm(prev => ({ ...prev, friendshipScore: parseInt(e.target.value) }))}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${form.isAffectionLocked ? 'bg-gray-200' : 'bg-gradient-to-r from-gray-200 via-sky-200 to-sky-500 accent-sky-500'}`}
                    />
                    <span className="text-[9px] text-gray-400 w-6">100</span>
                </div>
            </div>





            {/* 锁定按钮 */}
            {!form.isAffectionLocked ? (
              <button
                onClick={() => {
                  if (confirm(`⚠️ 确定以现在的数值开始吗？\n\n❤️ 爱意: ${editForm.affectionScore || 50}\n🤝 友谊: ${editForm.friendshipScore || 50}\n\n一旦锁定，这就是你们的起点！`)) {
                    setEditForm(prev => ({ ...prev, isAffectionLocked: true }));
                  }
                }}
                className="w-full py-2 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-lg text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition"
              >
                🔒 锁定双轴初始值 (开启故事)
              </button>
            ) : (
              <div className="text-center">
                 <div className="inline-block bg-white/50 text-gray-400 px-3 py-1 rounded-full text-[10px] border border-gray-200 shadow-sm">
                   ✅ 初始状态已锁定
                 </div>
              </div>
            )}
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






{/* ==================== [补全] 对话模式偏好 ==================== */}
<section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">


<div className="flex items-center gap-2 mb-3">
    <span className="text-lg">💬</span>
    <h3 className="text-xs font-bold text-gray-400 uppercase">对话模式偏好</h3>
    <button
        onClick={() => setShowModeInfo(true)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold hover:bg-gray-300 transition-colors"
    >
        ?
    </button>
</div>
  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
    {['concise', 'normal', 'verbose'].map((mode) => (
      <button
        key={mode}

// 这是一组代码：新的 onClick 事件，带清零和更新印象阈值功能
// 这是一组代码：新的 onClick 事件，只负责打开确认弹窗
onClick={() => {
    const oldMode = form.dialogueMode || 'normal';
    if (oldMode !== mode) {
        setPendingMode(mode as any); // 暂存将要切换的模式
        setShowModeConfirm(true);    // 打开确认弹窗
    }
}}
        className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all duration-300 ${
          (form.dialogueMode || 'normal') === mode
            ? 'bg-white text-blue-600 shadow-md'
            : 'text-gray-400 hover:bg-white/50'
        }`}
      >
        {mode === 'concise' ? '话少' : mode === 'normal' ? '日常' : '学习'}
      </button>
    ))}
  </div>
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











{/* ★★★ 全屏沉浸式加载遮罩 (同款高级样式) ★★★ */}
{/* ★★★ 全屏沉浸式加载遮罩 (同款高级样式) ★★★ */}
                 {isAnalyzing && (
                    <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn cursor-wait rounded-3xl">
                        {/* 动画图标容器 */}
                        <div className="relative mb-6">
                           {/* 外圈旋转 (紫色/蓝色渐变光环) */}
                           <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
                           
                           {/* 中间图标 (跳动的大脑) */}
                           <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">
                             🪐
                           </div>
                        </div>
                        
                        {/* 动态文字 (显示 loadingText) */}
                        <h3 className="text-xl font-black text-gray-800 mb-2 tracking-widest animate-pulse">
                          {loadingText || "正在分析中..."}
                        </h3>
                        
                        {/* 装饰性胶囊标签 */}
                        <div className="flex gap-2">
                            <span className="text-[10px] text-indigo-500 font-mono bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                              Deep Dive
                            </span>
                            <span className="text-[10px] text-purple-500 font-mono bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                              Re-Analyzing
                            </span>
                        </div>
                        
                        <p className="text-[10px] text-gray-400 mt-8 absolute bottom-20">
                          AI 正在量化角色的人格数据...
                        </p>
                    </div>
                 )}









<ModeInfoModal isOpen={showModeInfo} onClose={() => setShowModeInfo(false)} />
 




{showDestinyQuiz && (
    <div className="fixed inset-0 z-[102] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setShowDestinyQuiz(false)}>
        <div
          className="bg-white w-[90%] max-w-sm rounded-2xl shadow-xl p-6 flex flex-col gap-4 animate-scaleIn"
          onClick={e => e.stopPropagation()}
        >
            {/* 标题 */}
            <div className="text-center">
              <div className="text-4xl mb-2">🎬</div>
              <h3 className="text-lg font-bold text-gray-800">故事的开篇由你导演</h3>
              <p className="text-xs text-gray-400">请用几句话描述你们的相遇或初始关系</p>
            </div>

            {/* ★★★ 核心修改：自由输入框 ★★★ */}
            <div>
               <textarea
                 // 将输入内容绑定到 destinyAnswers.q1
                 value={destinyAnswers.q1}
                 onChange={e => setDestinyAnswers({ q1: e.target.value, q2: '' })}
                 placeholder={`尽情发挥想象力吧！例如：

“我们是多年未见的青梅竹马，在街角重逢了。”
“我们是死对头，每次见面都吵架，但又忍不住关注对方。”

...或者直接留空，让AI自由发挥。`
}
className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none resize-none h-32 focus:bg-white transition"
/>
</div>
{/* 提交按钮 */}
          <button
              disabled={isAnalyzing}
// 这是一组代码：最终版 onClick 事件，增加了“开篇注入”功能
onClick={async () => {
    setIsAnalyzing(true);
    setShowDestinyQuiz(false);

    try {
        setLoadingText("正在解读你的剧本...");
        await new Promise(r => setTimeout(r, 1200));
        setLoadingText("正在生成初始命运...");
        
        const charP = form.persona || "";
        const userP = (form.userName || "User") + ":" + (form.userPersona || "无");
        
        const userScript = destinyAnswers.q1.trim(); // 获取用户剧本
        
        // --- 只有当用户真的写了剧本时，才执行注入逻辑 ---
        if (userScript) {
            // 1. 构建一条特殊的“开篇”系统消息
            const openingMessage: Message = {
                id: `opening_${Date.now()}`,
                role: 'system',
                content: `【故事开篇】\n${userScript}\n\n(指令：请你作为 ${form.name}，对上面这段开场白做出你的第一句回应。)`,
                timestamp: Date.now() - 1000, // 让它比AI的第一句回答早一点
                type: 'text'
            };

            // 2. ★★★ 核心：直接把这条开篇消息注入到角色的历史记录里！ ★★★
            setEditForm(prev => ({ 
                ...prev, 
                history: [openingMessage] 
            }));
        }
        
        // --- AI判定数值的逻辑保持不变 ---
        const prompt = `你是一位资深情感分析师和故事构建者。请深度阅读并理解用户提供的“开篇剧本”，为他们生成最合理的【初始爱意值】和【初始友谊值】。
【角色A (AI)】: ${charP}
【角色B (用户)】: ${userP}
【用户提供的开篇剧本】: ${userScript || "用户跳过了，请你自由发挥。"}
输出纯 JSON: { "romance_score": 整数, "friendship_score": 整数, "reason": "一句话总结你的分析。" }`;
const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId)!;
        const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            // ★★★ 把数值也更新到 editForm 里 ★★★
            setEditForm(prev => ({ 
                ...prev, 
                affectionScore: result.romance_score,
                friendshipScore: result.friendship_score 
            }));
            alert(`🔮 命运已生成！\n\n❤️ 爱意: ${result.romance_score}\n🤝 友谊: ${result.friendship_score}\n\nAI的剧本分析: ${result.reason}\n\n${userScript ? '开篇故事已注入，请在保存后查看AI的第一句回应！' : ''}`);
        }
    } catch (e) {
        console.error(e);
        alert("分析失败，AI可能没看懂剧本...");
    } finally {
        setIsAnalyzing(false);
    }
}}

                className="w-full py-3 mt-2 rounded-xl font-bold text-white shadow-lg transition active:scale-95 bg-gradient-to-r from-purple-500 to-blue-500 disabled:bg-gray-300"
            >
                {isAnalyzing ? '正在生成...' : '生成命运'}
            </button>
        </div>
    </div>
)}





{showModeConfirm && pendingMode && (
  <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setShowModeConfirm(false)}>
    <div
      className="bg-white w-[90%] max-w-xs rounded-2xl shadow-xl p-6 text-center animate-scaleIn"
      onClick={e => e.stopPropagation()}
    >
      <h3 className="font-bold text-lg text-gray-800 mb-2">确认切换模式？</h3>
      
      <p className="text-sm text-gray-600 mb-4">
        你将切换到
        <b className="text-blue-500 mx-1">
          {pendingMode === 'concise' ? '【话少】' : pendingMode === 'normal' ? '【日常】' : '【学习】'}
        </b>
        模式。
      </p>
      
      <div className="bg-gray-50 p-3 rounded-lg text-xs text-left text-gray-500 mb-6 border">
        {
          pendingMode === 'concise' ? '此模式下 AI 回复简短 (约2-3条)，适合扮演高冷角色。' :
          pendingMode === 'normal' ? '此模式下 AI 回复长度适中 (约3-5条)，最具真实感。' :
          '此模式下 AI 回复更详细 (约4-9条)，适合共同学习或深入探讨。'
        }
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-bold p-3 rounded-lg mb-6">
        ⚠️ 注意：切换后，当前的消息条数计数将立即清零！要再聊一会才能解锁新印象啦！
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setShowModeConfirm(false)}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
        >
          取消
        </button>
        <button
          onClick={() => {
            // 在这里执行真正的切换逻辑
            const mode = pendingMode;
            let minThreshold: number, maxThreshold: number;
            switch (mode) {
                case 'concise': minThreshold = 60; maxThreshold = 120; break;
                case 'verbose': minThreshold = 120; maxThreshold = 200; break;
                default: minThreshold = 90; maxThreshold = 150; break;
            }
            const newRandomThreshold = Math.floor(Math.random() * (maxThreshold - minThreshold + 1)) + minThreshold;
            
            setEditForm(prev => ({
                ...prev,
                dialogueMode: mode as any,
                chatCountForPoint: 0,
                impressionCount: 0,
                impressionThreshold: newRandomThreshold
            }));

            setShowModeConfirm(false); // 关闭弹窗
          }}
          className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:bg-blue-600 transition"
        >
          确认切换
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

          // 2. 左侧：返回按钮 (带未读红点)
          left={
            <button 
              onClick={() => { setView('list'); setShowPersonaPanel(false); }} 
              className="text-blue-500 text-xl pl-2 pr-4 py-2 relative flex items-center transition-opacity hover:opacity-70"
            >
              {/* 返回箭头图标 */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              
              {/* 其他人未读数提示 */}
              {otherUnreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1 h-3.5 min-w-[14px] flex items-center justify-center rounded-full shadow-sm border border-white">
                  {otherUnreadCount}
                </span>
              )}
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




{/* 核心消息列表 */}
<div 
  ref={chatContainerRef} // 1. 绑定 Ref
  onScroll={handleScrollEvents} // 2. 绑定滚动事件
  className={`flex-1 overflow-y-auto p-4 space-y-0.5 z-0 ${musicPlayerOpen && !isPlayerMinimized ? 'pt-4' : 'pt-2'}`}
  style={activeContact.chatBackground ? { backgroundImage: `url(${activeContact.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
>
 {activeContact.customCSS && <style dangerouslySetInnerHTML={{ __html: activeContact.customCSS }} />}
  
  
    {activeContact.history.length > historyLimit && (
      <div className="w-full py-4 text-center text-xs text-gray-400 animate-pulse">
         ⏳ 下拉查看更多历史...
      </div>
  )}


{/* 这是一组代码：消息渲染循环核心 (修复了重复渲染邀请卡片的问题) */}
  {activeContact.history
      .slice(-historyLimit) // 重点：只取最后 historyLimit 条
      .map((msg, index, arr) => { // 注意：这里的 index 是切片后的索引
                // 1. 计算时间间隔
                let showInterval = false;
                let intervalMinutes = 0;
                if (index > 0) {
                  const prevMsg = activeContact.history[index - 1];
                  intervalMinutes = Math.floor((msg.timestamp - prevMsg.timestamp) / 60000);
                  if (intervalMinutes > 20) { showInterval = true; }
                }
// 这是一组代码：【ChatApp.tsx】渲染循环中的邀请函 (已修复跳转传参)
                // 搜索关键词：[LoverInvitation]
                if (msg.content.includes('[LoverInvitation]')) {
                    return (
                        <div key={msg.id} className="w-full flex justify-center my-4 animate-slideUp">
                            <InteractiveLoverInvitation
                                msg={msg}
                                contactName={activeContact.name}
                                // 处理同意/拒绝
                                onRespond={(msgId, decision) => handleInvitationResponse(msgId, decision)}
                                
                                // ★★★ 核心修复：这里就是那根断掉的电线！★★★
                                // 把父组件传下来的 onNavigateToSpace，传递给卡片的 onNavigate
                                onNavigate={() => {
                                    if (onNavigateToSpace) {
                                        onNavigateToSpace(activeContact.id);
                                    } else {
                                        alert("错误：ChatApp 没有接收到跳转函数，请检查 App.tsx");
                                    }
                                }}
                            />
                        </div>
                    );
                }









// 这是一组代码：【ChatApp.tsx】修复点1 - 给AI发出的邀请函接上跳转电线
// ★★★ 核心新增：拦截并渲染 AI 发来的邀请函 ★★★
if (msg.role === 'assistant' && msg.content.includes('[LoverInvitation]')) {
    return (
        <div key={msg.id} className="w-full flex justify-center my-4 animate-slideUp">
            <InteractiveLoverInvitation
                msg={msg}
                contactName={activeContact.name}
                onRespond={handleInvitationResponse}
                // 👇👇👇【关键修复】补上了这根线，按钮才能跳转！👇👇👇
                onNavigate={() => {
                    if (onNavigateToSpace) {
                        onNavigateToSpace(activeContact.id);
                    } else {
                        alert("错误：ChatApp 未接收到跳转函数");
                    }
                }}
            />
        </div>
    );
}












// 这是一组代码：【ChatApp.tsx】修复问答系统消息的样式显示 (纳入黄色卡片)
    if (msg.role === 'system' || (msg.role === 'assistant' && msg.content.includes('[LoverInvitation]'))) {
        let cardData = null;
        let displayContent = msg.content;
        
        // 1. 识别：邀请函
       // ★★★ 修复：不仅识别英文暗号，也识别中文关键词 ★★★
const isLoverInvitation = msg.content.includes('[LoverInvitation]') || msg.content.includes('发起了情侣邀请');
        // 2. 识别：关系确立/分手/特殊大事件
        const isRelationshipSuccess = msg.content.includes('[RelationshipEstablished]');
        
        // 3. 识别：情侣空间 (信件、日记、★问答★)
        // ★★★ 核心修复：把“提出问题”和“回答”相关的关键词都加进去！ ★★★
        const isCoupleSystem = 
            msg.content.includes('[CoupleSystem]') || 
            msg.content.includes('情侣空间') || 
            msg.content.includes('提出了一个新问题') || // 👈 捕捉提问
            msg.content.includes('回答:') ||           // 👈 捕捉回答
            msg.content.includes('[提问]') ||          // 👈 捕捉手动提问
            msg.content.includes('[关系空间]') ||       // 👈 捕捉旧版前缀
 msg.content.includes('寄了一封信') ||      
            msg.content.includes('写了日记') ||
            msg.content.includes('恋爱清单') ||
            msg.content.includes('愿望');
        // 4. 识别：密友/群组空间
        const isFriendSystem = msg.content.includes('[FriendSystem]') || msg.content.includes('[群空间:') || msg.content.includes('[群提问]');
        const isGroupNotice = msg.content.includes('[群空间:');
        // 5. 识别：贴便签/印象 (Tag)
        const isTagSystem = msg.content.includes('贴了一个新标签') || msg.content.includes('标签') || msg.content.includes('sys_tag') || msg.content.includes('sys_unlock') || msg.content.includes('sys_reveal');
        // 6. 识别：撤回
        const isRecall = msg.content.includes("撤回");

        displayContent = msg.content.replace(/\[.*?\]/g, '').replace('【系统通知】', '').trim();
        try { if (msg.content.includes('"type": "memory_share_card"')) { /* ... */ } } catch (e) {}

        if (cardData) { return <SharedMemoryCard key={msg.id} data={cardData} />; }
        if (displayContent.includes('约定: 无')) return null;

        // ★★★ 通用跳转包装器 (点击卡片 -> 跳转空间) ★★★
        const SpaceJumper: React.FC<{children: React.ReactNode, type: 'couple' | 'friend'}> = ({ children, type }) => (
            <div 
                onClick={() => {
                    if (onNavigateToSpace) {
                        onNavigateToSpace(activeContact.id);
                    }
                }}
                className="w-full flex justify-center cursor-pointer group"
            >
                <div className="transition-transform duration-300 group-hover:scale-105 group-active:scale-98 w-full flex justify-center relative">
                    {children}
                    <div className={`absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm pointer-events-none ${type === 'couple' ? 'bg-rose-100 text-rose-400' : 'bg-blue-100 text-blue-400'}`}>
                        点击进入{type === 'couple' ? '情侣' : '密友'}空间 ➜
                    </div>
                </div>
            </div>
        );

        return (
          <React.Fragment key={msg.id}>
            {showInterval && ( <div className="text-center my-4">{/*...*/}</div> )}
            <div className="my-4 animate-slideUp px-4 w-full">
                
{/* 1. 邀请函 (修复版：准确判断是谁发的) */}
                {isLoverInvitation ? (
                    // ★★★ 核心修复：如果是 AI 发的(assistant) 或者内容包含 "向你发起"，就显示带按钮的卡片 ★★★
                    (msg.role === 'assistant' || msg.content.includes('向你发起')) ? (
                        <InteractiveLoverInvitation 
                            key={msg.id} 
                            msg={msg} 
                            contactName={activeContact.name} 
                            onRespond={handleInvitationResponse}
                            onNavigate={() => {
                                if (onNavigateToSpace) {
                                    onNavigateToSpace(activeContact.id);
                                }
                            }}
                        />
                    ) : (
                        <StaticLoverInvitation 
                            key={msg.id} 
                            msg={{...msg, content: displayContent}} 
                            contactName={activeContact.name}
                        />
                    )
                )
                
                // 2. 关系确立庆典
                : isRelationshipSuccess ? (
                    <SpaceJumper type="couple">
                        <RelationshipSuccessCard key={msg.id} msg={{...msg, content: displayContent}} />
                    </SpaceJumper>
                )

                // 3. 【便签系统】
                : isTagSystem ? (
                    <div className="flex justify-center" onClick={() => setShowPersonaPanel(true)}> 
                        <div className="relative bg-yellow-200 text-yellow-900 text-xs px-4 py-3 shadow-md transform -rotate-1 hover:rotate-0 transition-transform cursor-pointer max-w-[80%] flex flex-col items-center" style={{ borderRadius: "2px 2px 20px 2px" }}>
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-white/40 backdrop-blur-sm rotate-2"></div>
                            <span className="text-lg mb-1">🏷️</span>
                            <span className="font-bold text-center leading-relaxed">{displayContent}</span>
                            <div className="mt-2 w-full border-t border-yellow-700/10 pt-1 text-center">
                                <span className="text-[8px] opacity-60 uppercase tracking-wider">Persona Tag</span>
                            </div>
                        </div>
                    </div>
                )

                // 4. 【情侣空间提示】 (含信件、日记、★问答★) -> 黄色信封框
                : isCoupleSystem ? (
                    <SpaceJumper type="couple">
                        <div className="relative bg-[#FFFBEB] text-[#78350F] text-xs px-5 py-4 rounded-xl shadow-[0_2px_8px_rgba(253,230,138,0.4)] border border-[#FDE68A] text-center max-w-[85%] flex items-center gap-3">
                            <div className="text-xl animate-pulse">💌</div>
                            <div className="flex flex-col items-start text-left">
                                <span className="font-bold text-[#92400E] mb-0.5">Sweet Notification</span>
                                <span className="leading-tight opacity-90">{displayContent}</span>
                            </div>
                        </div>
                    </SpaceJumper>
                )

                // 5. 【密友空间提示】
                : (isFriendSystem || isGroupNotice) ? (
                    <SpaceJumper type="friend">
                        <div className="relative bg-[#eff6ff] text-[#1e3a8a] text-xs px-5 py-4 rounded-xl shadow-[0_2px_8px_rgba(191,219,254,0.4)] border border-[#bfdbfe] text-center max-w-[85%] flex items-center gap-3">
                            <div className="text-xl">🏡</div>
                            <div className="flex flex-col items-start text-left">
                                <span className="font-bold text-[#1d4ed8] mb-0.5">Squad Update</span>
                                <span className="leading-tight opacity-90">{displayContent}</span>
                            </div>
                        </div>
                    </SpaceJumper>
                )

                // 6. 撤回消息
                : isRecall ? (
                    <div className="flex justify-center">
                        <span className="text-[10px] text-gray-400 italic bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                            {displayContent || "撤回了一条消息"}
                        </span>
                    </div>
                ) 
                
                // 7. 兜底
                : (
                    <div className="flex justify-center">
                        <div className="relative bg-gray-100 text-gray-500 text-xs px-4 py-2 rounded-lg max-w-[90%] text-center">
                            {displayContent}
                        </div>
                    </div>
                )}
            </div>
          </React.Fragment>
        );
    }












    // =========================================================================
    // 下面是正常的聊天气泡渲染 (User / Assistant)
    // =========================================================================
    
    // 2. 连续发言判断
    const isConsecutive = index > 0 && activeContact.history[index - 1].role === msg.role && !showInterval;
    const isSelected = selectedIds.includes(msg.id);
    const duration = msg.voiceDuration || 10;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isEditing = editingMsgId === msg.id;

    // 3. 计算缩放
    const scale = activeContact.chatScale || 1; 
    const currentAvatarSize = 40 * scale; 
    const currentFontSize = `${14 * scale}px`;
    const currentPaddingY = `${4 * scale}px`; 
    const currentPaddingX = `${12 * scale}px`;

    // 4. 颜色与自动反色
    const userBg = activeContact.bubbleColorUser || '#FBCFE8';
    const aiBg = activeContact.bubbleColorAI || '#ffffff';
    const userTextColor = getContrastTextColor(userBg);
    const aiTextColor = getContrastTextColor(aiBg);
    const currentBg = msg.role === 'user' ? userBg : aiBg;
    const currentText = msg.role === 'user' ? userTextColor : aiTextColor;



// ★★★ 核心修复：更聪明的引用检测 & 换行处理 ★★★
    // 只要是以 > 开头，都算引用
    const isQuoteMsg = msg.content.trim().startsWith('>');
    
    // 提取引用文本和回复文本
    let quoteText = '';
    let replyText = msg.content;
    
    if (isQuoteMsg) {
        // 找到第一个换行符的位置
        const firstLineBreak = msg.content.indexOf('\n');
        if (firstLineBreak !== -1) {
            quoteText = msg.content.substring(0, firstLineBreak).replace(/^> ?(引用)? ?/, '').trim();
            replyText = msg.content.substring(firstLineBreak + 1).trim();
        } else {
            // 如果没有换行，说明整句都是引用（虽然不常见）
            quoteText = msg.content.replace(/^> ?/, '').trim();
            replyText = ""; 
        }
    }


    return (
      <React.Fragment key={msg.id}>
        {showInterval && (
          <div className="text-center my-4 animate-fadeIn">
            <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {intervalMinutes < 60 ? `相隔 ${intervalMinutes} 分钟` : `相隔 ${Math.floor(intervalMinutes / 60)} 小时`}
            </span>
          </div>
        )}


<div 
         // ★★★ 必须确保这一行存在！msg_加上时间戳，和上面的代码对应 ★★★
         id={`msg_${msg.timestamp}`} 
         className={`message-wrapper ${msg.role === 'user' ? 'user' : 'ai'} flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp mb-1`}
         style={{ minHeight: `${currentAvatarSize}px` }} 
       >




          {isSelectionMode && (
            <div className={`flex items-center justify-center ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              <div onClick={() => toggleMessageSelection(msg.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                {isSelected && <span className="text-white text-xs font-bold">✓</span>}
              </div>
            </div>
          )}

          <div 
             className={`flex-none flex ${msg.role === 'user' ? 'justify-end order-3' : 'justify-start order-1'}`}
             style={{ width: `${currentAvatarSize}px`, height: `${currentAvatarSize}px`, minWidth: `${currentAvatarSize}px` }}
          >
            {msg.role === 'assistant' && !isConsecutive && (
                <img src={activeContact.avatar} className="rounded-full object-cover border border-gray-100 shadow-sm w-full h-full block" alt="AI" />
            )}
            {msg.role === 'user' && !isConsecutive && (
                <img src={activeContact.userAvatar} className="rounded-full object-cover border border-white shadow-sm w-full h-full block" alt="user" />
            )}
            {isConsecutive && <div style={{ width: `${currentAvatarSize}px` }}></div>}
          </div>

          <div className={`flex items-end gap-1.5 order-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[75%]`}>
            <div
              className={`message-bubble min-w-0 relative group transition-transform duration-75 active:scale-95`}
              onTouchStart={() => handleTouchStart(msg)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              {isEditing ? (
                <div className="bg-white border-2 border-blue-400 rounded-xl p-2 shadow-lg min-w-[200px]">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-sm p-2 bg-gray-50 rounded outline-none resize-none"
                    rows={3}
                    autoFocus
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={handleCancelEdit} className="text-xs px-3 py-1 bg-gray-200 rounded">取消</button>
                    <button onClick={handleSaveEdit} className="text-xs px-3 py-1 bg-blue-500 text-white rounded">保存</button>
                  </div>
                </div>
              ) : (
                <div 
   className={`content rounded-xl leading-relaxed relative break-words whitespace-pre-wrap shadow-sm ` + (!activeContact.customCSS && currentText === '#111827' ? 'border border-gray-200/50' : '')}
   style={{
       backgroundColor: !activeContact.customCSS ? currentBg : undefined,
       color: !activeContact.customCSS ? currentText : undefined,
       fontSize: currentFontSize,
       paddingTop: currentPaddingY, 
       paddingBottom: currentPaddingY,
       paddingLeft: currentPaddingX,
       paddingRight: currentPaddingX,
       borderTopRightRadius: (msg.role === 'user' && !isConsecutive) ? '2px' : '16px',
       borderTopLeftRadius: (msg.role === 'assistant' && !isConsecutive) ? '2px' : '16px',
       borderBottomLeftRadius: '16px',
       borderBottomRightRadius: '16px',
   }}
>
    {/* 1. 引用块 (保持不变) */}
    {isQuoteMsg && quoteText && (
      <div className="text-xs mb-2 p-2 bg-black/5 rounded-md border-l-4 border-gray-400 opacity-80 select-none">
        <div className="font-bold text-[10px] text-gray-500 mb-0.5">↪️ 引用:</div>
        <div className="line-clamp-2 italic">{quoteText}</div>
      </div>
    )}

    {/* ★★★ 核心修复开始 ★★★ */}

    {/* 2. 语音播放器 (如果消息是语音类型，就显示它) */}
    {(msg.type === 'voice' || msg.content.trim().startsWith('[Voice Message]')) && (
      <div className="mb-2"> {/* 加一点间距，让播放器和文字分开 */}
        <VoiceBubble
          msg={msg}
          isPlaying={playingMsgId === msg.id}
          progress={audioProgress}
          duration={duration}
          onPlay={() => playMessageAudio(msg.id, msg.content)}
          onSeek={handleSeek}
          isUser={msg.role === 'user'}
        />
      </div>
    )}



{/* ★★★ 核心消息内容 (修复换行 + 盲盒版FakeImage) ★★★ */}
                  {msg.type === 'voice' || msg.content.trim().startsWith('[Voice Message]') ? (
                    <VoiceBubble
                      msg={msg}
                      isPlaying={playingMsgId === msg.id}
                      progress={audioProgress}
                      duration={duration}
                      onPlay={() => playMessageAudio(msg.id, msg.content)}
                      onSeek={handleSeek}
                      isUser={msg.role === 'user'}
                    />
                  ) : msg.content.trim().startsWith('[FakeImage]') ? (
                    // ★★★ 新增：【盲盒版】FakeImage 逻辑 ★★★
                    // 使用 details 标签，天然支持“点击展开/收起”，无需额外代码
                    <details className="group">
                        {/* 1. 默认显示的：白色图框 (点击它会展开) */}
                        <summary className="list-none outline-none cursor-pointer">
                            <div className="w-48 h-32 bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 group-open:hidden">
                                <span className="text-3xl opacity-30 group-hover:scale-110 transition-transform">🖼️</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">点击查看画面</span>
                            </div>
                            
                            {/* 展开后：保留一个小的标题栏，点击可以收起 */}
                            <div className="hidden group-open:flex items-center gap-2 mb-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest cursor-pointer hover:text-blue-500">
                                <span>🖼️ 画面描述 (点击收起)</span>
                            </div>
                        </summary>

                        {/* 2. 展开后看到的内容：文字描述 */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed font-serif italic animate-slideDown shadow-sm">
                            “{msg.content.replace('[FakeImage]', '').trim()}”
                        </div>
                    </details>
                  ) : msg.type === 'image' ? (
                    <img src={msg.content} className="rounded-lg max-w-full" alt="msg" />
                  ) : (
                    // 这里的 whitespace-pre-wrap 是换行的关键
                    <div className="whitespace-pre-wrap break-words">
                        {/* 如果是引用消息，这里只显示回复部分；否则显示全部 */}
                        <HiddenBracketText 
                           content={isQuoteMsg ? replyText : msg.content} 
                           msgId={msg.id} 
                           fontSize={""} 
                        />
                    </div>
                  )}





                </div>
              )}
            </div>
            {!isEditing && <div className="text-[9px] text-gray-300 whitespace-nowrap shrink-0 opacity-60 select-none mb-0.5">{timeStr}</div>}
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
            // 这是一组代码：替换所有输入栏的 style（去除底部空白，实现强制全屏）
style={{ paddingBottom: '12px' }}  // 只留一点内间距，让输入框不紧贴屏幕底边，但内容可延伸到底部系统栏下面
          >
            <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="text-gray-500 font-bold px-4">取消</button>
            <span className="text-sm font-bold text-gray-700">已选 {selectedIds.length} 条</span>
            <div className="flex gap-3">
              <button onClick={handleBatchDelete} disabled={selectedIds.length === 0} className={`px-4 py-2 rounded-lg font-bold bg-red-100 text-red-500 ${selectedIds.length === 0 ? 'opacity-50' : ''}`}>🗑️ 删除</button>
              <button onClick={handleBatchCollect} disabled={selectedIds.length === 0} className={`px-4 py-2 rounded-lg font-bold bg-yellow-400 text-yellow-900 shadow-sm ${selectedIds.length === 0 ? 'opacity-50' : ''}`}>📦 打包收藏</button>
            </div>
          </div>
        ) : (
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
                        if (!currentContact || (currentContact.interventionPoints || 0) < 1) {
                            throw new Error("点数不足！");
                        }
                        const contactAfterDeduction = {
                            ...currentContact,
                            interventionPoints: currentContact.interventionPoints - 1,
                        };
                        const historySlice = currentContact.history.slice(-30);
                         const nextThreshold = Math.floor(Math.random() * 71) + 70; // 
                        await updateUserProfile(contactAfterDeduction, historySlice, nextThreshold);
                        alert("✅ 刷新成功！\n\nAI 的新印象已在后台生成，请在“印象集”里查看！");
                    } catch (e: any) {
                        alert(`❌ 刷新失败！\n\n错误信息: ${e.message}\n\n(你的点数没有被扣除)`);
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










      </div>
    );
  }

  return null;
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








export default ChatApp;