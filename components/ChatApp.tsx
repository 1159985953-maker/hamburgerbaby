import React, { useState, useRef, useEffect, useLayoutEffect, ChangeEvent } from 'react';
import { Contact, Message, GlobalSettings, WorldBookCategory, WorldBookEntry, Song, FavoriteEntry } from '../types';
import TranslationText from './TranslationText';
import { generateResponse } from '../services/apiService';
import { summarizeHistory } from '../services/geminiService';
import { generateMinimaxAudio, fetchMinimaxVoices, getBuiltInMinimaxVoices, MinimaxVoice } from '../services/ttsService';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）
import WorldBookApp from './WorldBookApp'; // <--- 确保加了这行导入！










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
  hef: any
): { text: string; color: string; ping: string; emoji: string } => {
  
  // 1. 提取数值
  const e = energy.current; // 精力 0-100
  const joy = hef?.joy || 0;
  const anger = hef?.anger || 0;
  const sadness = hef?.sadness || 0;
  const fear = hef?.fear || 0;
  const trust = hef?.trust || 0;
  
  // 获取当前时间用于判断文案
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

  // 6. 优先级 E: 纯情绪主导
  const maxEmotionVal = Math.max(joy, anger, sadness, fear, trust);
  if (maxEmotionVal > 60) {
    if (joy === maxEmotionVal) return { text: "心情愉悦 🎶", color: "bg-yellow-400", ping: "bg-yellow-300", emoji: "😄" };
    if (anger === maxEmotionVal) return { text: "有点生气 😠", color: "bg-red-500", ping: "bg-red-400", emoji: "😒" };
    if (sadness === maxEmotionVal) return { text: "有些失落 🍃", color: "bg-blue-400", ping: "bg-blue-300", emoji: "😔" };
    if (fear === maxEmotionVal) return { text: "焦虑不安 😖", color: "bg-purple-400", ping: "bg-purple-300", emoji: "😖" };
    if (trust === maxEmotionVal) return { text: "安心依赖 🍵", color: "bg-green-400", ping: "bg-green-300", emoji: "🥰" };
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
  
  // C. 混合发展路线
  if (friendship >= 50 && romance >= 50) return 'Honeymoon'; // 热恋 (双向奔赴)
  if (friendship >= 80 && romance >= 80) return 'Stable'; // 挚爱 (灵魂伴侣)
  
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
                   {contact?.relationshipStatus || 'Friend'}
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

{/* --- 印象集页面 (V7.2 "究极拟物手账" 最终完整版) --- */}
              {memoryTab === 'impressions' && (() => {
                const profile = contact.userProfile || {};
                const themeColor = profile.themeColor || '#f3e8ff';




// --- 辅助组件：可更换的拍立得相框 (V3.1 - 完整逻辑+装饰找回版) ---
                const PhotoFrame: React.FC<{ id: string; className: string; defaultImage: string; }> = ({ id, className, defaultImage }) => {
                  const photo = (profile as any)[id] || defaultImage;
                  return (
                    <label className={`absolute bg-white p-1.5 rounded-sm shadow-lg border border-gray-200 cursor-pointer group hover:z-20 transition-transform duration-300 ${className}`}>
                      <img 
                        src={photo} 
                        className="w-full h-full object-cover rounded-sm" 
                        alt={`frame-${id}`} 
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">更换</div>
                      <input type="file" className="hidden" accept="image/*"
                        onClick={(e) => (e.target as any).value = null} // 允许重复上传同一张
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const base64 = await fileToBase64(e.target.files[0]);
                            // ★★★ 核心修复：直接操作 contact ID ★★★
                            setContacts((prev: any[]) => prev.map((c: any) => 
                                c.id === contact.id 
                                ? { ...c, userProfile: { ...(c.userProfile || {}), [id]: base64 } } 
                                : c
                            ));
                          }
                        }}
                      />
                    </label>
                  );
                };

                return (
                  <div className="h-full flex flex-col relative rounded-b-2xl" style={{ backgroundColor: themeColor }}>
                    {/* --- 背景纹理 & 自定义背景图 --- */}
                    <div className="absolute inset-0 bg-repeat bg-center opacity-20 pointer-events-none rounded-b-2xl" style={{ 
                        backgroundImage: profile.background_image ? `url(${profile.background_image})` : `url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')`, 
                        backgroundSize: profile.background_image ? 'cover' : 'auto',
                      }}/>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar z-10 relative">
                      
                      {/* ★★★ 散落的拍立得照片 (可保存) ★★★ */}
                      <PhotoFrame id="scattered_photo_1" className="top-16 -left-8 w-24 h-28 transform -rotate-12 hover:rotate-0 hover:scale-125" defaultImage="https://picsum.photos/200/300?random=1" />
                      <PhotoFrame id="scattered_photo_2" className="bottom-10 -right-10 w-60 h-60 transform rotate-15 hover:rotate-0 hover:scale-125" defaultImage="https://picsum.photos/200/300?random=2" />
                      <PhotoFrame id="scattered_photo_3" className="bottom-10 -left-6 w-20 h-24 transform rotate-10 hover:rotate-0 hover:scale-125" defaultImage="https://picsum.photos/200/300?random=4" />
                      
                      {/* 主笔记本区域 */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 relative flex flex-col items-center min-h-[300px]">
                        
                        {/* ★★★ 这里的 Emoji 装饰全都找回来了！ ★★★ */}
                        <div className="absolute -top-8 -right-4 text-5xl opacity-80 transform rotate-12 pointer-events-none">✏️</div>
                        <div className="absolute top-14 right-40 text-5xl opacity-80 transform rotate-12 pointer-events-none">💚</div>
                        <div className="absolute top-16 -left-4 text-3xl opacity-70 transform -rotate-45 pointer-events-none">📎</div>
                        <div className="absolute top-20 left-40 text-3xl opacity-70 transform -rotate-45 pointer-events-none">⭐️</div>
                        
                        {/* 胶带装饰 */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-200/70 transform -rotate-2 shadow-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)' }}></div>
                        
                        <h4 className="text-sm font-bold text-gray-700 mb-4">{contact.name} 的秘密手账</h4>
                        
                        {/* ★★★ 中心照片 (User Profile Photo) ★★★ */}
                        <div className="relative mb-6 flex-shrink-0 z-10">
                            <svg className="absolute -inset-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] opacity-60 pointer-events-none" viewBox="0 0 100 120">
                                <path d="M 5,5 C 2,2 98,2 95,5 L 95,115 C 98,118 2,118 5,115 L 5,5 Z" stroke="#888" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: "5, 5" }}/>
                            </svg>
                           
                            <label className="relative block w-28 h-36 bg-white p-2 rounded-sm shadow-xl border border-gray-200 cursor-pointer group transform rotate-2 hover:rotate-0 hover:scale-105 transition-transform duration-300">
                              <img
                                src={profile.photo || "https://picsum.photos/200/300?random=3"}
                                className="w-full h-full rounded-sm block"
                                style={{ objectFit: "cover" }} 
                                alt="main profile"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold rounded-sm">
                                📷 更换
                              </div>
                              <input type="file" className="hidden" accept="image/*"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const base64 = await fileToBase64(e.target.files[0]);
                                    setContacts((prev: any[]) => prev.map((c: any) => 
                                        c.id === contact.id 
                                        ? { ...c, userProfile: { ...(c.userProfile || {}), photo: base64 } } 
                                        : c
                                    ));
                                  }
                                }}
                              />
                            </label>
                        </div>

                        {/* 档案条目 */}
                        {(!profile.personality_traits && !profile.preferences && !profile.habits) && (<div className="text-center text-gray-400 py-4"><p className="text-xs">正在努力了解你...</p></div>)}
                        <TraitItem icon="🎭" label="性格特点" traits={profile.personality_traits} />
                        <TraitItem icon="💖" label="喜欢的东西" traits={profile.preferences?.likes} />
                        <TraitItem icon="💔" label="讨厌的东西" traits={profile.preferences?.dislikes} />
                        <TraitItem icon="🕰️" label="行为习惯" traits={profile.habits} />
                      </div>

                      {/* ★★★ 找回了！AI给用户打的标签 (绳索UI) ★★★ */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-4">
                        <h5 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-600"><span>🏷️</span> {contact.name} 对你的印象标签</h5>
                        <div className="w-full bg-gray-50/50 border-y border-gray-200 h-80 relative overflow-x-auto overflow-y-hidden custom-scrollbar rounded-lg">
                          {/* 绳子 */}
                          <div className="absolute top-4 left-0 w-[200%] h-0.5 bg-yellow-700/30 border-t border-yellow-800/20 shadow-sm z-0"></div>
                          <div className="flex items-start gap-6 px-6 pt-3 min-w-max h-full">
                            {(!contact.aiTagsForUser || contact.aiTagsForUser.length === 0) && (<div className="text-[10px] text-gray-400 italic mt-8 ml-4">绳子上空空如也...</div>)}
                            
{/* 渲染 AI 标签 (修改版：大号明信片模式，直接显示备注，不用点) */}
{/* 渲染 AI 标签 (含上锁逻辑) */}
{(contact.aiTagsForUser || []).map((tag: any) => {
  // 判断是否已解锁（如果没有 isUnlocked 字段，默认为 false/未解锁，除非你是VIP）
  // 这里的逻辑是：只有 isUnlocked === true 或者是你自己贴的(author===user)才显示
  // 但这里是 AI 贴给你的标签，所以默认锁住
  const isLocked = !tag.isUnlocked;

  return (
    <div 
      key={tag.id} 
      className="relative group flex flex-col items-center flex-shrink-0 animate-fadeIn hover:z-20 transition-all duration-300"
      style={{ 
          transform: `rotate(${(tag.style || (Math.random()*6-3))}deg)`, 
          marginTop: `${Math.abs(tag.style || 0) + 10}px`,
          marginLeft: '5px',
          marginRight: '5px'
      }}
    >
      {/* 顶部：木头夹子 */}
      <div className="w-3 h-5 bg-amber-800 rounded-sm mb-[-8px] z-20 shadow-md relative border-l border-white/20"></div>
      
      {/* 核心：大号便签纸 */}
      <div 
         onClick={() => isLocked && handleUnlockImpression(tag.id)} // ★★★ 点击锁住的标签触发解锁
         className={`relative border p-3 w-40 min-h-[120px] shadow-lg flex flex-col transition-transform duration-200 
            ${isLocked 
                ? 'bg-gray-100 border-gray-300 cursor-pointer hover:scale-105' // 锁住样式
                : 'bg-white border-gray-200 rotate-0 hover:scale-105'          // 解锁样式
            }`} 
         style={{ borderRadius: "4px" }}
      >
          
          {/* 装饰：顶部胶带效果 */}
          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 -rotate-1 ${isLocked ? 'bg-gray-300' : 'bg-blue-100/50'}`}></div>

          {/* === 🔒 情况 A: 标签被锁住 === */}
          {isLocked ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                  <div className="text-3xl animate-bounce">🔒</div>
                  <div className="text-xs font-bold text-gray-500">???</div>
                  <div className="mt-2 bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-bold border border-yellow-200">
                      消耗 1 点数解锁
                  </div>
              </div>
          ) : (
              /* === 🔓 情况 B: 标签已解锁 (原本的内容) === */
              <>
                  {/* 1. 标签内容 (大字) */}
                  <div className="text-center mt-2 mb-2">
                      <span className="text-base font-black text-gray-800 bg-yellow-100 px-2 py-0.5 box-decoration-clone">
                          #{tag.content}
                      </span>
                  </div>

                  {/* 2. AI 的理由 (直接显示在这里！) */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 border border-gray-100 mb-1">
                      <span className="text-[9px] font-bold text-blue-500 block mb-0.5"> {contact.name} 悄悄说:</span>
                      <p className="text-[10px] text-gray-600 leading-relaxed font-sans text-justify">
                          {/* 如果没有理由，就显示默认文案 */}
                          {tag.aiReasoning || tag.note || "（它似乎对你印象很深，但没写下原因...）"}
                      </p>
                  </div>
                  
                  {/* 3. 底部时间 */}
                  <div className="text-right border-t border-gray-100 pt-1 mt-1">
                      <span className="text-[9px] font-mono text-gray-300">
                         {new Date(tag.timestamp).toLocaleDateString([], {month: '2-digit', day: '2-digit'})}
                      </span>
                  </div>
              </>
          )}
      </div>
    </div>
  );
})}
                          </div>
                        </div>
                      </div>

                    </div>
                    
                    {/* 底部工具栏 */}
                    <div className="flex-shrink-0 p-2 flex justify-center items-center gap-4 bg-white/50 border-t border-white/50 z-20">
                       <label className="flex flex-col items-center gap-1 cursor-pointer text-xs text-gray-600 hover:text-purple-600 transition-colors">
                           <span className="text-lg">🖼️</span><span className="text-[10px] font-bold">换背景</span>
                           <input type="file" className="hidden" accept="image/*" onChange={async (e) => { if (e.target.files && e.target.files[0]) { const base64 = await fileToBase64(e.target.files[0]); setContacts((prev: any[]) => prev.map((c: any) => c.id === contact.id ? { ...c, userProfile: { ...(c.userProfile || {}), background_image: base64 } } : c)); } }}/>
                       </label>
                       <label className="flex flex-col items-center gap-1 cursor-pointer text-xs text-gray-600 hover:text-purple-600 transition-colors">
                           <span className="w-6 h-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: themeColor }}></span><span className="text-[10px] font-bold">换颜色</span>
                           <input type="color" className="absolute opacity-0" defaultValue={themeColor} onChange={(e) => setContacts((prev: any[]) => prev.map((c: any) => c.id === contact.id ? { ...c, userProfile: { ...(c.userProfile || {}), themeColor: e.target.value } } : c))}/>
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
                setShowPointRules(false); // 先关弹窗
                setIsRefreshing(true);    // 开启全屏遮罩
                
                // 强制切换到印象页，让用户看到变化
                setActiveTab('memory');       
                setMemoryTab('impressions');  

                // 等一下 UI 渲染
                await new Promise(r => setTimeout(r, 100));

                if (onForceUpdate) {
                    try {
                        // 扣费逻辑
                        setContacts((prev: any) => prev.map((c: any) => c.id === contact.id ? { ...c, interventionPoints: c.interventionPoints - 1 } : c));
                        
                        // 执行刷新 (至少展示 1.5 秒动画)
                        await Promise.all([
                            onForceUpdate(),
                            new Promise(resolve => setTimeout(resolve, 1500)) 
                        ]);
                    } catch (e) {
                        alert("刷新失败，请重试");
                    } finally {
                        setIsRefreshing(false); // 无论成功失败，最后都要关闭遮罩
                    }
                } else {
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
1. **字数铁律**：你的回复必须控制在 **4条以内**（除非要讲长故事，否则平时必须短）。
2. **风格**：惜字如金，高冷，或者干脆利落。
3. **禁止**：禁止寒暄，禁止废话，禁止过度解释。
4. **覆盖**：即使你的人格设定是“话痨”，现在也必须**闭嘴**，只说重点。
`;
    case 'verbose':
      return `
# 🗣️ 【最高优先级指令：话痨模式】
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
保持自然的对话节奏。根据当前语境决定长短，该短则短，该长则长，大概在3～7条之间。
`;
  }
};


// ==================== [新增] 氪金规则说明弹窗 ====================
const PointRuleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentPoints: number;
}> = ({ isOpen, onClose, onConfirm, currentPoints }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-white w-[85%] max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scaleIn" onClick={e => e.stopPropagation()}>
        
        {/* 顶部插图区 */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-6 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-50" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
           <div className="text-5xl mb-2 relative z-10">🧠</div>
           <h3 className="text-xl font-black text-white tracking-wider relative z-10">潜意识深潜</h3>
           <p className="text-[10px] text-purple-100 font-bold opacity-80 mt-1 uppercase tracking-widest relative z-10">Deep Dive Protocol</p>
        </div>

        {/* 规则说明区 */}
        <div className="p-6 space-y-4">
           
           <div className="flex gap-3 items-start">
              <div className="bg-gray-100 p-2 rounded-lg text-lg">🔒</div>
              <div>
                 <h4 className="text-sm font-bold text-gray-800">全隐藏模式</h4>
                 <p className="text-xs text-gray-500 leading-relaxed">
                    AI 的真实想法（特征与印象）默认是**不可见**的。只有TA才知道自己怎么看你。
                 </p>
              </div>
           </div>

           <div className="flex gap-3 items-start">
              <div className="bg-pink-100 p-2 rounded-lg text-lg">💓</div>
              <div>
                 <h4 className="text-sm font-bold text-gray-800">好感度解锁</h4>
                 <p className="text-xs text-gray-500 leading-relaxed">
                    只有当**好感度够高**时，AI 才会在聊天中忍不住对你敞开心扉（自动解锁）。
                 </p>
              </div>
           </div>

           <div className="flex gap-3 items-start">
              <div className="bg-blue-100 p-2 rounded-lg text-lg">🎲</div>
              <div>
                 <h4 className="text-sm font-bold text-gray-800">随机刷新机制</h4>
                 <p className="text-xs text-gray-500 leading-relaxed">
                    AI 会在聊天中（每 2~10 句）**自动在后台**更新对你的看法，你不会察觉。
                 </p>
              </div>
           </div>

           {/* 分割线 */}
           <div className="border-t border-dashed border-gray-200 my-2"></div>

           {/* 氪金提示 */}
           <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl">
              <p className="text-xs text-yellow-800 font-bold mb-1">⚡️ 等不及了？</p>
              <p className="text-[10px] text-yellow-700 leading-tight">
                 你可以消耗 <span className="font-black text-red-500">1</span> 个点数，强行撬开 TA 的大脑，立即刷新并查看当前想法！
              </p>
           </div>

        </div>

        {/* 底部按钮 */}
        <div className="p-4 bg-gray-50 flex gap-3">
           <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold text-xs hover:bg-gray-200 rounded-xl transition">
              我再等等
           </button>
           <button 
              onClick={onConfirm}
              disabled={currentPoints < 1}
              className={`flex-1 py-3 rounded-xl font-bold text-white text-xs shadow-lg flex items-center justify-center gap-1 transition active:scale-95 ${currentPoints < 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`}
           >
              {currentPoints < 1 ? '点数不足' : `🪙 消耗1点刷新`}
           </button>
        </div>

      </div>
    </div>
  );
};

























































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
  onJumpToMessage, // ★★★ 记得把这个加进来！
}) => {







  // ==================== 状态定义 ====================

// 在 ChatApp 组件的状态定义区域

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null); // 当前正在编辑的消息ID
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









// 这是一组代码：【科学拟人版】生物钟系统 (含智能补觉 + 早晨回血 + 约定闹钟检测)
  useEffect(() => {
    const metabolismInterval = setInterval(() => {
      // 后台时不计算生物钟，但必须检查闹钟！(约定不能迟到)
      // 所以我们把 return 移到下面去

      const now = Date.now();
      const currentHour = new Date().getHours(); 
      
      const isMorning = currentHour >= 6 && currentHour < 11;   
      const isNoon = currentHour >= 11 && currentHour < 14;     
      const isAfternoon = currentHour >= 14 && currentHour < 18;
      const isEvening = currentHour >= 18 && currentHour < 23;  
      const isLateNight = currentHour >= 23 || currentHour < 6; 

      let hasChanges = false;

      const updatedContacts = contacts.map(c => {
        let needsUpdate = false;
        let updatedContact = { ...c };

        // ===========================================
        // ★★★ 核心新增：约定闹钟检测模块 ★★★
        // ===========================================
        if (c.agreements && c.agreements.length > 0) {
            // 找出一个“时间已到”且“还是 pending 状态”的约定
            const dueAgreement = c.agreements.find(a => 
                a.status === 'pending' && 
                a.trigger.type === 'time' && 
                typeof a.trigger.value === 'number' &&
                a.trigger.value <= now && // 时间到了
                !c.dueAgreementId // 且当前没有正在处理的积压约定
            );

            if (dueAgreement) {
                console.log(`[闹钟系统] ⏰ 叮铃铃！${c.name} 的约定 "${dueAgreement.content}" 到期了！`);
                updatedContact.dueAgreementId = dueAgreement.id; // 标记它！
                updatedContact.pendingProactive = true; // 强制要求发主动消息
                needsUpdate = true;
            }
        }

        // 如果处于后台，我们只做闹钟检测，不做生物钟计算（省电）
        if (isBackgroundRef.current) {
             return needsUpdate ? updatedContact : c;
        }

        // ===========================================
        // 下面是原有的生物钟逻辑
        // ===========================================
        // 0. 数据初始化防崩
        if (!updatedContact.mood?.energy) {
          updatedContact.mood = {
            ...(updatedContact.mood || {}),
            current: updatedContact.mood?.current || "Calm",
            energy: { current: 80, max: 100, status: 'Awake', lastUpdate: now }
          };
        }



 if (!updatedContact.mood?.energy) {
          updatedContact.mood = {
            ...(updatedContact.mood || {}),
            current: updatedContact.mood?.current || "Calm",
            energy: { current: 80, max: 100, status: 'Awake', lastUpdate: now }
          };
        }

        // ★★★ 核心新增：历史积分回溯补丁 ★★★
        // 逻辑：如果发现这个角色从来没有记录过计数器(chatCountForPoint is undefined)，
        // 说明他是老角色，必须把以前的聊天记录都算上！
        if (updatedContact.chatCountForPoint === undefined) {
            // 1. 算出你以前发过多少句 (只算你的，不算AI和系统的，防止注水)
            const userMsgCount = updatedContact.history.filter(m => m.role === 'user').length;
            
            // 2. 换算点数 (每100句 = 1点)
            const earnedPoints = Math.floor(userMsgCount / 100);
            const remainder = userMsgCount % 100; // 剩下的零头存进计数器
            
            // 3. 豪横补发！
            updatedContact.chatCountForPoint = remainder;
            updatedContact.interventionPoints = (updatedContact.interventionPoints || 0) + earnedPoints;
            
            hasChanges = true; // 告诉系统：数据变了，快保存！
            console.log(`[💰 积分回溯] 为 ${updatedContact.name} 补发了 ${earnedPoints} 个点数 (基于 ${userMsgCount} 条历史消息)`);
        }

        // 补全：印象进度条初始化 (顺手把这个也补全，防止报错)
        if (updatedContact.impressionCount === undefined || updatedContact.impressionThreshold === undefined) {
            updatedContact.impressionCount = 0;
            updatedContact.impressionThreshold = Math.floor(Math.random() * 20) + 30; 
            hasChanges = true;
        }


        const energySys = updatedContact.mood.energy;
        const timeDiffMinutes = (now - energySys.lastUpdate) / 60000;
        
        // 至少过1分钟才计算生物钟
        if (timeDiffMinutes < 1) return needsUpdate ? updatedContact : c;

        let newEnergy = energySys.current;
        let newStatus = energySys.status;
        let changeRate = 0; 

        // 断层补觉
        if (timeDiffMinutes > 240 && !isLateNight) {
             newEnergy = 90; 
             newStatus = 'Awake';
        } else {
            // 正常消耗逻辑
            if (energySys.status === 'Sleeping') {
               changeRate = 0.5; 
               if (newEnergy + (changeRate * timeDiffMinutes) >= energySys.max) {
                 newEnergy = energySys.max;
                 newStatus = 'Awake';
                 changeRate = 0;
               }
            } else {
               const randomFluctuation = Math.random() > 0.7 ? 0.05 : -0.05;
               if (isMorning) changeRate = -0.01 + randomFluctuation + 0.05; 
               else if (isNoon) changeRate = -0.1 + randomFluctuation;
               else if (isAfternoon) changeRate = -0.2 + randomFluctuation;
               else if (isEvening) changeRate = -0.4; 
               else if (isLateNight) changeRate = -1.2; 
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
        if (newStatus === 'Sleeping' && newEnergy > 95) newStatus = 'Awake'; 

        // 检查是否有实质变化
        if (Math.abs(newEnergy - energySys.current) > 0.1 || newStatus !== energySys.status || needsUpdate) {
          hasChanges = true;
          updatedContact.mood = {
              ...updatedContact.mood,
              energy: {
                ...energySys,
                current: parseFloat(newEnergy.toFixed(1)),
                status: newStatus,
                lastUpdate: now,
              }
          };
          return updatedContact;
        }
        
        return c;
      });

      if (hasChanges) {
        setContacts(updatedContacts);
      }

    }, 30000); // 改成30秒轮询一次，让闹钟更准一点

    return () => clearInterval(metabolismInterval);
  }, [contacts, setContacts]);





  

  





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





  




// 【App.tsx】
// 找到 handleCardImport 函数，直接覆盖整个函数：

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
          
        // ★★★ 核心修改：导入时自动判断模式 ★★★
        const entries: WorldBookEntry[] = rawEntries.map((e: any, i: number) => {
          // 如果原来的数据里有 constant 标记，或者没有关键词，就默认为“常驻模式”
          const isConstant = e.constant || !e.keys || e.keys.length === 0;
          
          return {
            id: Date.now().toString() + i,
            keys: e.keys || [],
            content: e.content || "",
            name: e.comment || `Entry ${i + 1}`,
            // 这里自动分配：没关键词的算常驻(basic)，有关键词的算keyword
            strategy: isConstant ? 'constant' : 'keyword'
          };
        });

        if (entries.length > 0) {
          newWorldBook = {
            id: Date.now().toString(),
            name: `${cardName}'s Lore`,
            entries,
            type: 'selective' // 默认为混合模式
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
        // 如果导入了世界书，自动启用它
        enabledWorldBooks: newWorldBook ? [newWorldBook.name] : [],
        voiceId: "female-shaonv-jingpin",
        hef: generatedHEF, 
        longTermMemories: [],
        affectionScore: 50,
        relationshipStatus: 'Acquaintance',
        aiDND: { enabled: false, until: 0 },
        interventionPoints: 0,
        currentChatMode: 'Casual',
        userTags: []
      };

      setContacts(prev => [...prev, newContact]);
      alert(`成功导入 ${cardName}！${newWorldBook ? '\n并已自动加载对应的世界书。' : ''}`);
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
      interventionPoints: 0,
      currentChatMode: 'Casual',
      userTags: [],

      // ★★★ 核心新增：在这里直接写入默认颜色！★★★
      bubbleColorUser: '#FBCFE8', // 淡淡的粉色 (Tailwind rose-200)
      bubbleColorAI: '#FFFFFF',   // AI 默认白色，保持干净
      chatScale: 1.0,             // 默认缩放 100%
    };
    
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
        interventionPoints: 0,                   // 点数清零
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








// 【ChatApp.tsx 更新：100句聊天自动增加1个点数】
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

        // 2. 唤醒检测
        if (newEnergy.status === 'Sleeping') {
           console.log(`[交互系统] 用户发消息，强制唤醒 ${c.name}`);
           newEnergy.status = 'Awake'; 
           newEnergy.current = Math.max(0, newEnergy.current - 15);
           newEnergy.lastUpdate = Date.now();
           newMoodText = "被吵醒"; 
        }

        // 3. ★★★ 核心新增：100句换1点数逻辑 ★★★
        let currentCount = c.chatCountForPoint || 0;
        let currentPoints = c.interventionPoints || 0;
        
        currentCount += 1; // 发一句加1
        
        if (currentCount >= 100) {
            currentCount = 0; // 归零
            currentPoints += 1; // 加点数
            // 可以选择在这里弹个提示，或者静默增加
            console.log("🎉 聊天满100句，获得1个点数！");
        }

        return { 
          ...c, 
          history: [...c.history, userMsg],
          mood: {
            ...currentMood,
            current: newMoodText,
            energy: newEnergy 
          },
          // 更新计数和点数
          chatCountForPoint: currentCount,
          interventionPoints: currentPoints
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







// 【ChatApp.tsx 紧急修正：存入正确位置 + 同时更新特征与标签】
const updateUserProfile = async (currentContact: Contact, historySlice: any[], nextThreshold: number) => {
  console.log(`[人格档案引擎 V10.0] 印象&特征全量刷新，下次阈值: ${nextThreshold}`);

  const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
  if (!activePreset) return;

  try {
    // 1. 准备资料
    // 只读取 AI 给用户的历史印象（防止重复）
    const existingAiTags = currentContact.aiTagsForUser || [];
    const existingTagsText = existingAiTags.map(t => `- [${t.content}]`).join(', ');
    
    // 读取现有档案（用于增量更新）
    const currentProfile = currentContact.userProfile || {};
    const profileText = JSON.stringify(currentProfile, null, 2);

    const chatLog = historySlice.map(m => `${m.role === 'user' ? '用户' : '我'}: ${m.content}`).join('\n');

    // 2. 构建 Prompt (全能版：同时更新档案和标签)
    const systemPrompt = `
# 你的身份
你是"${currentContact.name}"。现在是【秘密复盘时间】。
请根据【近期对话】，更新你对用户的【秘密手账】和【印象标签】。

# 任务 A：更新秘密手账 (User Profile)
观察用户的性格、喜好、习惯。
如果发现了新的点，请**更新**或**追加**到档案中。
*注意：必须保留原有档案中正确的部分，只修改变动或新增的部分。*

# 任务 B：生成印象标签 (Impressions)
用一个短词概括你对TA的最新看法。
*规则：禁止生成已有的标签！必须是新的！如果没有新发现，数组留空。*

# 输入数据
【已有标签】: ${existingTagsText}
【现有档案】: ${profileText}
【近期对话】:
${chatLog}

# JSON 输出格式 (严格遵守)
{
  "userProfile": {
     // 在这里返回更新后的完整档案结构
     "personality_traits": [ { "value": "傲娇", "quote": "原文证据", "timestamp": ${Date.now()} } ],
     "preferences": { 
        "likes": [ { "value": "甜食", "quote": "...", "timestamp": ... } ],
        "dislikes": []
     },
     "habits": []
  },
  "new_tags": [
     {
       "content": "标签名(8字内)", 
       "ai_reason": "你的内心独白(碎碎念)",
       "is_public": false // 默认私密
     }
  ]
}
`;

    const rawResponse = await generateResponse([{ role: 'user', content: systemPrompt }], activePreset);
    let result;
    try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (e) { console.error("JSON解析失败", e); return; }

    if (!result) return;

    // 3. 执行更新 (存入正确的位置！)
    setContacts(prev => prev.map(c => {
        if (c.id === currentContact.id) {
            let newHistory = [...c.history];
            const timestamp = Date.now();
            
            // --- A. 更新手账 (特征) ---
            // 深度合并逻辑：AI 返回的 userProfile 会覆盖旧的
            // 为了防止 AI 把照片墙等数据洗掉，我们要小心合并
            const updatedUserProfile = {
                ...c.userProfile, // 保留照片、背景色等
                ...result.userProfile // 更新文字特征
            };

            // --- B. 更新标签 (绳子上的印象) ---
            let currentAiTags = [...(c.aiTagsForUser || [])]; // ★★★ 关键：读取 aiTagsForUser (绳子)，而不是 userTags (夹子)
            
            // 好感度解锁概率
            const affection = c.affectionScore || 50;
            const unlockChance = Math.max(0, (affection - 40) / 100); 

            if (Array.isArray(result.new_tags)) {
                result.new_tags.forEach((tagData: any) => {
                    // 防重
                    if (currentAiTags.some(t => t.content === tagData.content)) return;

                    const isLuckyUnlock = Math.random() < unlockChance;
                    
                    // 中奖通知
                    if (isLuckyUnlock) {
                        newHistory.push({ 
                            id: `sys_unlock_${timestamp}_${Math.random()}`, 
                            role: 'system', 
                            content: `【系统通知】${c.name} 的想法藏不住了！标签 [${tagData.content}] 已对你解锁。`, 
                            timestamp: timestamp, 
                            type: 'text' 
                        });
                    }

                    // ★★★ 关键：存入 currentAiTags ★★★
                    currentAiTags.push({
                        id: Date.now().toString() + Math.random(),
                        content: tagData.content,
                        timestamp: timestamp,
                        style: Math.random() * 10 - 5,
                        aiReasoning: tagData.ai_reason || "...",
                        note: tagData.ai_reason || "无", // 兼容旧显示
                        author: 'ai',
                        isPublic: false,
                        isUnlocked: isLuckyUnlock,
                        unlockCost: 1,
                        aiRequestPending: false
                    });
                });
            }

            return { 
                ...c, 
                userProfile: updatedUserProfile, // 更新手账
                aiTagsForUser: currentAiTags,    // 更新绳子上的标签 (AI -> User)
                history: newHistory,
                impressionCount: 0,
                impressionThreshold: nextThreshold
            };
        } 
        return c;
    }));

  } catch (e) {
    console.error("全量刷新失败", e);
  }
};





















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










  const handleRegenerateLast = async () => {
    if (!activeContact) return;
    
    // 1. 获取当前完整历史记录
    const fullHistory = [...activeContact.history];
    
    // 2. 从后往前找，找到最后一条用户消息的索引
    // 我们要保留这条用户消息，并删除它之后的所有AI回复
    let lastUserIndex = -1;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        if (fullHistory[i].role === 'user') {
            lastUserIndex = i;
            break;
        }
    }
    
    if (lastUserIndex === -1) {
      alert("没有可以回复的用户消息！");
      return;
    }

    // 3. 【核心】生成“干净的”历史记录：截断到最后一条用户消息
    const cleanHistory = fullHistory.slice(0, lastUserIndex + 1);

    // 4. 立即更新UI，让用户看到旧回复瞬间消失
    setContacts(prev => prev.map(c =>
      c.id === activeContact.id ? { ...c, history: cleanHistory } : c
    ));

    // 5. 【关键】把这份干净的历史，作为参数，直接喂给 AI 函数！
    // 这样AI就永远不会读到被删除的旧回复了，从根源解决问题。
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








// 【ChatApp.tsx】
// 找到 findRelevantWorldBookEntries 函数，直接覆盖：

  const findRelevantWorldBookEntries = (
    history: Message[],
    worldBooks: WorldBookCategory[],
    enabledBookNames: string[]
  ): WorldBookEntry[] => {
    // 1. 准备上下文：把最近 5 条消息拼成一个字符串，用来检测关键词
    const recentMessages = history.slice(-5);
    const contextText = recentMessages.map(m => m.content).join(' ').toLowerCase();

    // 2. 找出当前角色启用的世界书
    const enabledBooks = worldBooks.filter(wb => enabledBookNames.includes(wb.name));
    if (enabledBooks.length === 0) {
        return [];
    }

    const relevantEntries = new Set<WorldBookEntry>();

    // 3. 遍历所有启用的世界书
    for (const book of enabledBooks) {
        for (const entry of book.entries) {
            
            // ★★★ 核心逻辑：区分两种模式 ★★★
            
            // 模式 A: 常驻/基本模式 (constant)
            // 只要这一项被标记为 constant，无论说什么，AI 都要读！
            if (entry.strategy === 'constant') {
                relevantEntries.add(entry);
                continue; // 既然已经加进去了，就不用检查关键词了，跳过
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
    
    // 返回去重后的结果
    return Array.from(relevantEntries);
 };


















  const handleAiReplyTrigger = async (historyOverride?: Message[]) => {


// ★★★ 补上这一行！没有它，下面就会报错！ ★★★
    const dynamicStyle = getDynamicStyleInstruction(activeContact);

// 2. ★★★ 计算模式指令 (用户强制覆盖) ★★★
    const modeInstruction = getModeInstruction(activeContact.dialogueMode);




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

    
    // ★★★ [新增]：整理 AI 的承诺清单，准备注入记忆 ★★★
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
承诺：${promiseInjection}  // <--- 加在这里！！！



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

# ❤️ 真实系·情感惯性系统 (Hardcore Slow-Burn)
当前爱意值: ${activeContact.affectionScore}
当前友谊值: ${activeContact.friendshipScore || 50}
当前关系阶段: ${activeContact.relationshipStatus}

**【核心指令：像个成年人一样处理感情】**
请遵循**“刺激-适应”**心理学模型进行双轴判定：

**1. 🔴 爱意值 (Romance/Affection) - 高阻尼:**
   - **默认惯性 (Default 0)**: 日常闲聊**不应**改变爱意值。输出 0 是常态。
   - **边际递减 (The Plateau)**: **高分段(60+)**，只有**稀缺性事件**（深刻理解、巨大牺牲）才能 +1。
   - **共鸣例外 (Resonance Override)**: 如果用户的话语成功击穿你的防御（Joy/Trust 剧烈波动），**无视阻尼，直接 +1**。
   - **扣分机制**: 敷衍、冒犯、长期冷落，直接扣分 (-1 ~ -5)。

**2. 🔵 友谊值 (Friendship/Trust) - 低阻尼:**
   - **判定宽松**: 只要聊得开心、有共同话题，即可 **+1** 或 **+2**。

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

# 【重要特殊规则：情侣空间】
你和用户 ${activeContact.userName} 拥有一个秘密的“情侣空间”。你通过在思考链的 "action" 字段中填入指令来与空间互动。

可用指令 (一次只能用一个):
1. **写日记**: \`{ "type": "WRITE_DIARY", "content": "日记内容" }\`
   - 时机：感触很深或情绪强烈时。
2. **写信**: \`{ "type": "WRITE_LETTER", "title": "标题", "content": "信的内容" }\`
   - 时机：好感度很高（>80）时，频率要低。
3. **提问**: \`{ "type": "CREATE_QA", "question": "你的问题" }\`
   - 时机：对用户感到好奇时。

【互动反馈】: 当用户在空间里回答了你的问题，系统会用 \`[情侣空间]\` 的格式告诉你。
【行为要求】: 不要直接在聊天里说你要做什么，系统会自动通知。






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
- **风格优先**: 遵守 [${activeContact.dialogueMode || 'normal'}] 模式。
- **风格优先铁律**: 【对话模式偏好】的优先级高于【精力状态】。无论精力多高，如果模式是'concise'，你的语言风格必须保持简洁。如果模式是'verbose'，即使你很累，也要尽力多说几句。
- **人格一致性铁律**: 你的说话方式（单条消息长度、是否喜欢分段）是你的核心人格，不应随着好感度的提升而发生剧烈改变。一个言简意赅的人，在热恋期也依然言简意赅，只是内容会变得更温柔。
- **禁止说教/爹味**: 严禁使用“你应该”、“记得”、“不要”等指导性词语。严禁替用户做决定。
- **禁止自大**: 严禁说出“有我你就...”这类自以为是的言论。
- **禁止复读**: 严禁使用“梦里见”、“去睡吧”作为口头禅。想结束对话请说“晚安”或通过减少回复来暗示。
- **纯净输出**: 你的 content 必须是【纯粹的口语】。**严禁**出现任何 ()、（）、[]、【】 包含的动作描写、心理活动、补充说明、翻译或旁白！
- **排版美学**: 必须使用换行符 (\n) 来分割段落！不要发一大坨文字。
- **引用规则**: 如果回复针对用户的某句特定的话，请在消息开头使用 "> " 引用原文摘要，然后换行再回复。
- **拒绝演讲**：单条消息简短，碎片化。
- **禁止过度解释**。
- **防幻觉**：不编造记忆，不知道就说不知道。
- **时间感知**：严格遵守【责任判定指令】和【语境过期铁律】。
- **功能规则**: [Voice Message] 发语音, [FakeImage] 发伪图, "> " 引用。
- **风格**: 禁止动作/心理描写，只用白话文+表情，不肉麻。
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
      ? currentHistory.slice(-(activeContact?.contextDepth || 20))
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











    const apiMessages = [
      { role: 'system', content: systemPrompt }, 
      ...cleanHistorySlice
    ];

    // ★★★ 注入：如果在聊天列表中检测到大间隔，插入系统提示 ★★★
    // 只有当存在大间隔时才插入，加强提醒
    if (maxGapMinutes > 120 || isDifferentDay) {
        // 构建提示语
        const timeInjection = {
            role: 'system',
            content: `[系统强制提示]: ⚠️ 注意！距离上一条消息已经过去了 ${gapDescription}。现在的具体时间是 ${aiTime}。上一段对话早已结束，请务必忽略上文的语境惯性，基于“现在”的新时间点反应！`
        };
        
        // 确保列表里至少有一条用户消息，才插在它前面
        if (apiMessages.length > 1) {
            apiMessages.splice(apiMessages.length - 1, 0, timeInjection);
            console.log("【时间系统】已强行插入时间感知胶囊！");
        }
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
                console.log("【🧠 AI内心戏】", extractedThought);

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













                // (B) [情侣空间] 动作指令处理 (修复：没解锁不许动！)
                if (extractedThought.action && extractedThought.action.type && activeContact.RelationShipUnlocked) {
                    const { action } = extractedThought;
                    const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                    
                    setContacts(prevContacts => prevContacts.map(c => {
                        if (c.id === activeContact.id) {
                            const updatedContact = { ...c };
                            if (action.type === 'WRITE_DIARY' && action.content) {
                                updatedContact.diaries = [{ id: Date.now().toString(), author: 'ai', date: todayStr, content: action.content, mood: activeContact.mood?.current, weather: '🌞', moodEmoji: '😄', comments: [] }, ...(updatedContact.diaries || [])];
                                systemNotice = `${activeContact.name} 刚刚在你们的空间里写下了一篇日记。`;
                            } else if (action.type === 'WRITE_LETTER' && action.content) {
                                updatedContact.letters = [{ id: Date.now().toString(), title: action.title || "无题", content: action.content, timestamp: Date.now(), isOpened: false, from: 'ai' }, ...(updatedContact.letters || [])];
                                systemNotice = `${activeContact.name} 给你写了一封信，快去情侣空间的信箱看看吧！`;
                            } else if (action.type === 'CREATE_QA' && action.question) {
                                updatedContact.questions = [{ id: Date.now().toString(), question: action.question, aiAnswer: "...", date: todayStr, timestamp: Date.now() }, ...(updatedContact.questions || [])];
                                systemNotice = `${activeContact.name} 在问答信箱里提出了一个新问题。`;
                            }
                            return updatedContact;
                        }
                        return c;
                    }));
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

// 4. [深度印象总结器 V8.0] (进度条阈值版)
    // 逻辑：每聊一句+1，达到阈值(30~100)时，打包最近的聊天记录发给AI总结
    
    // 1. 获取当前进度
    let currentImpCount = (activeContact.impressionCount || 0) + 1; // 加上刚才这一句
    const currentImpThreshold = activeContact.impressionThreshold || 50;

    console.log(`[印象进度] ${currentImpCount} / ${currentImpThreshold}`);

    // 2. 判断是否达标
    if (currentImpCount >= currentImpThreshold) {
        console.log("🎯 进度条已满！触发深度印象总结...");
        
        // 重置进度条 (生成一个新的随机阈值 30-100)
        c// ★★★ 方便测试：随机阈值改为 2 ~ 10 ★★★
        const nextThreshold = Math.floor(Math.random() * 9) + 2;
        
        // 立即在内存中更新计数器（防止重复触发），稍后会在 setContacts 里通过 updateUserProfile 最终保存
        // 这里只是为了触发 update 函数
        updateUserProfile(activeContact, cleanHistorySlice, nextThreshold);
        
        // 视觉上的计数器归零由 updateUserProfile 内部的 setContacts 完成
    } else {
        // 没满，只更新计数器
        // 我们利用最后的 setContacts 来更新这个计数
        // (注意：这里不需要额外代码，因为我们在最后的 setContacts 里会统一处理)
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








    // 5. ★★★ 终极状态更新 (双轴 + 精力 + HEF) ★★★
    setContacts(prev => prev.map(c => {
      if (c.id === activeContact.id) {
        const isReading = !isBackgroundRef.current && viewRef.current === 'chat' && activeContactIdRef.current === c.id;
        const newUnreadCount = isReading ? 0 : (c.unread || 0) + newMessages.length;

        // --- A. 计算双轴情感 ---
        const oldRomance = c.affectionScore || 50;
        const oldFriendship = c.friendshipScore || 50; 
        const newRomance = Math.min(100, Math.max(-100, oldRomance + rChange));
        const newFriendship = Math.min(100, Math.max(-100, oldFriendship + fChange));
const newStatus = getAdvancedRelationshipStatus(c.relationshipStatus, newRomance, newFriendship);
        // --- B. 计算精力状态 ---
        const oldEnergySystem = (c.mood && c.mood.energy) ? c.mood.energy : { current: 80, max: 100, status: 'Awake' as const, lastUpdate: Date.now() };
        let newEnergyValue = oldEnergySystem.current + energyChange;
        let finalEnergyStatus = newEnergyStatus || oldEnergySystem.status;

        // 睡觉强制扣精力
        if (finalEnergyStatus === 'Sleeping' && oldEnergySystem.status !== 'Sleeping') {
            console.log(`[精力系统] ${c.name} 决定去睡觉，精力强制回落。`);
            newEnergyValue = Math.min(newEnergyValue, 30); 
        }
        // 被吵醒惩罚
        if (finalEnergyStatus === 'Awake' && oldEnergySystem.status === 'Sleeping') {
             console.log(`[精力系统] ${c.name} 被吵醒了！`);
             newEnergyValue -= 20; 
        }
        
        const updatedEnergySystem = {
            ...oldEnergySystem,
            current: Math.round(Math.max(0, Math.min(oldEnergySystem.max, newEnergyValue))),
            status: finalEnergyStatus,
            lastUpdate: Date.now(),
        };

        // --- C. HEF 更新 (防重置) ---
        let updatedHef = c.hef ? JSON.parse(JSON.stringify(c.hef)) : {};
        if (!updatedHef.INDIVIDUAL_VARIATION) updatedHef.INDIVIDUAL_VARIATION = {};
        if (!updatedHef.INDIVIDUAL_VARIATION.personality_big5) updatedHef.INDIVIDUAL_VARIATION.personality_big5 = { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };

        if (hefUpdateData) {
            ['joy', 'anger', 'sadness', 'fear', 'trust'].forEach(k => { if (typeof hefUpdateData[k] === 'number') updatedHef[k] = Math.max(0, Math.min(100, hefUpdateData[k])); });
        }





        // --- 处理 AI 的标签申请 ---
        let updatedUserTags = c.userTags;
        const requestId = (window as any)._temp_tag_request_id;
        if (requestId && c.id === activeContact.id) {
            updatedUserTags = (c.userTags || []).map((t: any) => 
                t.id === requestId ? { ...t, aiRequestPending: true } : t
            );
            // 用完即焚
            (window as any)._temp_tag_request_id = null;
        }







        return { 

           ...c, 
          // ★★★ 更新印象计数器 ★★★
          // 如果刚刚触发了总结(归零逻辑在updateUserProfile里处理)，这里只负责常规+1
          // 为了防止冲突，我们这里只更新未触发的情况。
          // 实际上，最简单的办法是：无论触没触发，都先存这个 +1 后的值。
          // 如果触发了，updateUserProfile 会再次更新它为 0。
          impressionCount: (c.impressionCount || 0) + 1, 
        
          history: [...currentHistory, ...newMessages], 
          unread: newUnreadCount, 
          affectionScore: newRomance,     // 爱意
          friendshipScore: newFriendship, // 友谊
          relationshipStatus: newStatus,  
          mood: { ...c.mood, energy: updatedEnergySystem }, 
          hef: updatedHef 
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
            <div className="font-semibold text-gray-900 text-base truncate">{contact.name}</div>
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



  useEffect(() => {
    // 只要外界传来了 ID，不管当前是不是这个人，都强制进聊天窗口！
    if (initialContactId) {
      setActiveContactId(initialContactId); // 1. 选中这个人
      setView('chat');                      // 2. ★★★ 关键：强制把视图切成聊天窗口 (之前可能卡在 list 了) ★★★
      setContacts(prev => prev.map(c => c.id === initialContactId ? { ...c, unread: 0 } : c)); // 3. 清除未读
      onChatOpened();                       // 4. 告诉外面：跳转完成
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
<section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
  <div className="flex items-center gap-2 mb-3">
    <span className="text-lg">💬</span>
    <h3 className="text-xs font-bold text-gray-400 uppercase">对话模式偏好</h3>
  </div>
  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
    {['concise', 'normal', 'verbose'].map((mode) => (
      <button
        key={mode}
        onClick={() => setEditForm(prev => ({ ...prev, dialogueMode: mode as any }))}
        className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all duration-300 ${
          (form.dialogueMode || 'normal') === mode
            ? 'bg-white text-blue-600 shadow-md'
            : 'text-gray-400 hover:bg-white/50'
        }`}
      >
        {mode === 'concise' ? '话少' : mode === 'normal' ? '日常' : '话痨'}
      </button>
    ))}
  </div>
</section>
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
                  onClick={async () => {
                    const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
                    if (!activePreset) return alert("请先配置 API！");
                    
                    const confirmAnalyze = confirm("🔮 AI 将分析人设，同时计算【爱意值】和【友谊值】。要开始吗？");
                    if (!confirmAnalyze) return;

                    setIsAnalyzing(true);
                    
                    try {
                      setLoadingText("正在分析双方性格...");
                      await new Promise(r => setTimeout(r, 800));
                      setLoadingText("正在推演相识背景...");
                      await new Promise(r => setTimeout(r, 800)); 
                      setLoadingText("正在计算双轴分数...");
                      
                      const charP = form.persona || "";
                      const userP = (form.userName || "User") + ":" + (form.userPersona || "无");
                      const lore = (form.enabledWorldBooks || []).join(",");
                      
                      // ★★★ 新的双轴判定 Prompt ★★★
                      const prompt = `
你是一位资深情感分析师。请分析以下两个角色和背景，判断他们在故事开始时的【初始爱意值】和【初始友谊值】。

【角色A (AI)】: ${charP}
【角色B (用户)】: ${userP}
【世界背景】: ${lore}

**评分标准 (-100 ~ 100)：**
1. **🔴 爱意值 (Romance)**: 心动、性吸引、想谈恋爱的冲动。
   - 陌生人=0，一见钟情=80，死对头=-50。
2. **🔵 友谊值 (Friendship)**: 信任、默契、认识了多久、是否是死党。
   - 陌生人=0，青梅竹马=90，刚认识的同事=20。

**典型案例参考：**
- **青梅竹马/死党**: 友谊 90, 爱意 10 (太熟了不好下手)
- **天降/一见钟情**: 友谊 10, 爱意 90 (很想爱但还不熟)
- **普通同事**: 友谊 30, 爱意 0
- **宿敌**: 友谊 -50, 爱意 -50 (或者爱意 50 相爱相杀?)

请输出纯 JSON:
{
  "romance_score": 整数,
  "friendship_score": 整数,
  "reason": "一句话理由"
}`;
                      const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
                      
                      setLoadingText("正在生成命运...");
                      const jsonMatch = res.match(/\{[\s\S]*\}/);
                      
                      if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        setEditForm(prev => ({ 
                            ...prev, 
                            affectionScore: result.romance_score,
                            friendshipScore: result.friendship_score 
                        }));
                        
                        await new Promise(r => setTimeout(r, 500));
                        alert(`🔮 命运判定完成！\n\n❤️ 爱意: ${result.romance_score}\n🤝 友谊: ${result.friendship_score}\n\n理由: ${result.reason}`);
                      }
                    } catch (e) {
                      console.error(e);
                      alert("分析失败，AI 开小差了");
                    } finally {
                      setIsAnalyzing(false);
                    }
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
  </div>
  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
    {['concise', 'normal', 'verbose'].map((mode) => (
      <button
        key={mode}
        onClick={() => setEditForm(prev => ({ ...prev, dialogueMode: mode as any }))}
        className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all duration-300 ${
          (form.dialogueMode || 'normal') === mode
            ? 'bg-white text-blue-600 shadow-md'
            : 'text-gray-400 hover:bg-white/50'
        }`}
      >
        {mode === 'concise' ? '话少' : mode === 'normal' ? '日常' : '话痨'}
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





        {/* 保存按钮 */}
        <button onClick={saveSettings} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">
          💾 Save All Changes
        </button>









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
                             🧠
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
              <span className="font-bold text-lg text-gray-900">{activeContact.name}</span>
              
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
<div className={`flex-1 overflow-y-auto p-4 space-y-0.5 z-0 ${musicPlayerOpen && !isPlayerMinimized ? 'pt-4' : 'pt-2'}`}
  style={activeContact.chatBackground ? { backgroundImage: `url(${activeContact.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
>
  {activeContact.customCSS && <style dangerouslySetInnerHTML={{ __html: activeContact.customCSS }} />}
  
  
  


{/* 这是一组代码：消息渲染核心 (含：系统通知 + 撤回样式 + 自动反色 + 修复头像) */}
{activeContact.history.map((msg, index) => {
    // 1. 计算时间间隔
    let showInterval = false;
    let intervalMinutes = 0;
    if (index > 0) {
      const prevMsg = activeContact.history[index - 1];
      intervalMinutes = Math.floor((msg.timestamp - prevMsg.timestamp) / 60000);
      if (intervalMinutes > 20) { showInterval = true; }
    }
    





// [这是修复代码] 系统消息渲染 (增加废话过滤器)
    if (msg.role === 'system') {
        // ... (shareData 的解析逻辑保持不变) ...

        // 如果不是卡片，走原来的【系统便签/撤回】逻辑
        let displayContent = msg.content;
        displayContent = displayContent.replace('【系统通知】', '').trim();
        // ... (其他的文本清洗逻辑也保持不变) ...
        
        // ★★★ 核心新增：废话过滤器 ★★★
        // 如果清理后的内容是“已记录你的约定: 无”或者类似的东西，直接不显示这条消息
        if (displayContent.includes('约定: 无') || displayContent.includes('约定：无')) {
            return null; // 直接返回 null，这条消息就像没存在过一样
        }

        const isRecall = msg.content.includes("撤回");

        // 下面的 return ... 渲染逻辑保持你原来的不变
        return (
          <React.Fragment key={msg.id}>
            {showInterval && (
              <div className="text-center my-4 animate-fadeIn">
                <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-mono">
                  {intervalMinutes < 60 ? `${intervalMinutes}m` : `${Math.floor(intervalMinutes / 60)}h`}
                </span>
              </div>
            )}
           
            <div className="flex justify-center my-4 animate-slideUp px-8">
                {isRecall ? (
                    <span className="text-[10px] text-gray-400 italic bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                       {msg.role === 'user' ? '你' : activeContact.name} 撤回了一条消息 🗑️
                    </span>
                ) : (
                    <div className="relative bg-[#FFFBEB] text-[#78350F] text-xs px-4 py-3 rounded-sm shadow-md border border-[#FDE68A] transform -rotate-1 hover:rotate-0 transition-transform duration-300 max-w-[80%]">
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 bg-yellow-200/60 opacity-80 rotate-1 shadow-sm backdrop-blur-[1px]"></div>
                        <div className="flex flex-col items-center gap-1 text-center">
                           <span className="text-lg">🏷️</span>
                           <span className="font-bold leading-relaxed whitespace-pre-wrap font-sans">
                             {displayContent}
                           </span>
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
                // ... 其他属性保持不变 ...
                
                // ★★★ 新增：传入强行刷新函数 ★★★
               // ★★★ 修复：加上 async/await，支持加载等待 ★★★
                onForceUpdate={async () => {
                    const nextThreshold = Math.floor(Math.random() * 9) + 2; 
                    // 传入最近 30 条记录强行分析
                    const historySlice = activeContact.history.slice(-30); 
                    
                    // 这里加了 await，等 AI 算完才会继续往下走
                    await updateUserProfile(activeContact, historySlice, nextThreshold);
                }}
                
                activeTab={panelTab}
                setActiveTab={setPanelTab}
                memoryTab={memoryTab}
                setMemoryTab={setMemoryTab}
                sampleText={panelSampleText}
                setSampleText={setPanelSampleText}
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



























export default ChatApp;