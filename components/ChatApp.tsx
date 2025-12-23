import React, { useState, useRef, useEffect, useLayoutEffect, ChangeEvent } from 'react';
import { Contact, Message, GlobalSettings, WorldBookCategory, WorldBookEntry, Song, FavoriteEntry } from '../types';
import TranslationText from './TranslationText';
import { generateResponse } from '../services/apiService';
import { summarizeHistory } from '../services/geminiService';
import { generateMinimaxAudio, fetchMinimaxVoices, getBuiltInMinimaxVoices, MinimaxVoice } from '../services/ttsService';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）
















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
const calculateComplexState = (
  energy: { current: number; status: string }, 
  hef: any
): { text: string; color: string; ping: string; emoji: string } => {
  
  // 1. 提取数值 (如果没有HEF数据，默认为0)
  const e = energy.current; // 精力 0-100
  const joy = hef?.joy || 0;
  const anger = hef?.anger || 0;
  const sadness = hef?.sadness || 0;
  const fear = hef?.fear || 0;
  const trust = hef?.trust || 0;

  // 2. 优先级 A: 生理极限 (无法被意志力克服的状态)
  if (energy.status === 'Sleeping') {
    // 睡觉也有不同状态
    if (sadness > 60) return { text: "带泪入睡 💧", color: "bg-indigo-500", ping: "bg-indigo-400", emoji: "😪" };
    if (joy > 80) return { text: "做美梦中 🌙", color: "bg-purple-500", ping: "bg-purple-400", emoji: "😴" };
    return { text: "呼呼大睡 💤", color: "bg-indigo-500", ping: "bg-indigo-400", emoji: "😴" };
  }
  
  if (energy.status === 'Exhausted' || e < 10) {
    if (anger > 50) return { text: "又累又气 💢", color: "bg-red-700", ping: "bg-red-600", emoji: "😫" };
    if (sadness > 50) return { text: "身心俱疲 🥀", color: "bg-gray-600", ping: "bg-gray-500", emoji: "⚰️" };
    return { text: "累瘫了... 😵", color: "bg-gray-500", ping: "bg-gray-400", emoji: "🫠" };
  }

  // 3. 优先级 B: 低能量混合态 (Energy < 40) -> 负面Buff加成
  if (e < 40) {
    if (anger > 60) return { text: "起床气/烦躁 💣", color: "bg-orange-600", ping: "bg-orange-500", emoji: "🤯" };
    if (sadness > 60) return { text: "无力emo 🌧️", color: "bg-blue-800", ping: "bg-blue-700", emoji: "😶‍🌫️" };
    if (fear > 60) return { text: "瑟瑟发抖 🥶", color: "bg-cyan-700", ping: "bg-cyan-600", emoji: "😨" };
    if (joy > 70) return { text: "累但快乐 ✨", color: "bg-yellow-600", ping: "bg-yellow-500", emoji: "😌" };
    return { text: "电量不足 🪫", color: "bg-yellow-600", ping: "bg-yellow-500", emoji: "🥱" };
  }

  // 4. 优先级 C: 高能量混合态 (Energy > 80) -> 情绪放大器
  if (e > 80) {
    if (anger > 70) return { text: "暴跳如雷 🔥", color: "bg-red-600", ping: "bg-red-500", emoji: "🤬" };
    if (joy > 80) return { text: "亢奋/狂喜 🥳", color: "bg-pink-500", ping: "bg-pink-400", emoji: "😆" };
    if (fear > 60) return { text: "惊慌失措 😱", color: "bg-purple-600", ping: "bg-purple-500", emoji: "🙀" };
    if (sadness > 70) return { text: "崩溃大哭 😭", color: "bg-blue-500", ping: "bg-blue-400", emoji: "😭" };
    if (trust > 80) return { text: "充满干劲 💪", color: "bg-green-500", ping: "bg-green-400", emoji: "😤" };
  }

  // 5. 优先级 D: 纯情绪主导 (能量正常 40-80)
  // 找出数值最高的情绪
  const maxEmotionVal = Math.max(joy, anger, sadness, fear, trust);
  
  if (maxEmotionVal > 60) { // 只有情绪大于60才算显著
    if (joy === maxEmotionVal) return { text: "心情愉悦 🎶", color: "bg-yellow-400", ping: "bg-yellow-300", emoji: "😄" };
    if (anger === maxEmotionVal) return { text: "有点生气 😠", color: "bg-red-500", ping: "bg-red-400", emoji: "😒" };
    if (sadness === maxEmotionVal) return { text: "有些失落 🍃", color: "bg-blue-400", ping: "bg-blue-300", emoji: "😔" };
    if (fear === maxEmotionVal) return { text: "焦虑/不安 😖", color: "bg-purple-400", ping: "bg-purple-300", emoji: "😖" };
    if (trust === maxEmotionVal) return { text: "依赖/安心 🍵", color: "bg-green-400", ping: "bg-green-300", emoji: "🥰" };
  }

  // 6. 优先级 E: 默认状态
  if (e > 60) return { text: "元气满满 ✨", color: "bg-green-500", ping: "bg-green-400", emoji: "🙂" };
  return { text: "摸鱼中 🐟", color: "bg-emerald-500", ping: "bg-emerald-400", emoji: "😮‍💨" };
};








//关系状态系统
const getRelationshipStatus = (score: number): string => {
  if (score <= -50) return 'Feud';         // -100 ~ -50: 死仇
  if (score <= 0)   return 'Conflict';     // -50 ~ 0:    讨厌
  if (score <= 40)  return 'Acquaintance'; // 0 ~ 40:     路人
  if (score <= 70)  return 'Friend';       // 40 ~ 70:    朋友
  if (score <= 90)  return 'Honeymoon';    // 70 ~ 90:    热恋
  return 'Stable';                         // 90 ~ 100:   挚爱
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























const ChatApp: React.FC<ChatAppProps> = ({
  contacts,
  setContacts,
  globalSettings,
  setGlobalSettings,
  worldBooks,
  setWorldBooks,
  onExit,
  isBackground, // 👈 把它加在这里！
  initialContactId,
  onChatOpened,
  onNewMessage,
   onOpenSettings, // ★★★★★ 把它加在这里！接收父组件传来的“传送”函
}) => {








  // ==================== 状态定义 ====================


  const [editingMsgId, setEditingMsgId] = useState<string | null>(null); // 当前正在编辑的消息ID
  const [editContent, setEditContent] = useState(""); // 正在编辑的内容缓存
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [panelTab, setPanelTab] = useState('persona'); // 记住你在看哪个标签页
  const [panelSampleText, setPanelSampleText] = useState(""); // 记住你输入的台词
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'chat' | 'settings'>('list');
  const [navTab, setNavTab] = useState<'chats' | 'moments' | 'favorites'>('chats');
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [activeFavCategory, setActiveFavCategory] = useState("全部");
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







const activeContact = contacts.find(c => c.id === activeContactId);





const longPressTimer = useRef<any>(null); // 长按计时器
const isLongPress = useRef(false); // 标记是否触发了长按
const isBackgroundRef = useRef(isBackground); // ★★★ 1. 追踪后台状态的 Ref
const viewRef = useRef(view);               // 盯着现在的页面状态
const activeContactIdRef = useRef(activeContactId); // 盯着现在正在跟谁聊
const messagesEndRef = useRef<HTMLDivElement>(null);








// ==================== 缺失的生物钟代码开始 ====================
  // 这是一组代码：【升级版】生物钟系统 (含昼夜节律 + 深夜耗能加速)
  useEffect(() => {
    const metabolismInterval = setInterval(() => {
      
      if (isBackgroundRef.current) return;

      const now = Date.now();
      const currentHour = new Date().getHours(); // 获取当前几点 (0-23)
      
      // ★★★ 昼夜节律逻辑 ★★★
      // 深夜 (23点-6点) 还是 白天？
      const isLateNight = currentHour >= 23 || currentHour < 6;
      const isEvening = currentHour >= 20 && currentHour < 23;

      let hasChanges = false;

      const updatedContacts = contacts.map(c => {
        // 初始化防崩
        if (!c.mood?.energy) {
          c.mood = {
            ...(c.mood || {}),
            current: c.mood?.current || "Calm",
            energy: { current: 80, max: 100, status: 'Awake', lastUpdate: now }
          };
        }

        const energySys = c.mood.energy;
        const timeDiffMinutes = (now - energySys.lastUpdate) / 60000;
        
        // 至少过1分钟才计算
        if (timeDiffMinutes < 1) return c;

        let newEnergy = energySys.current;
        let newStatus = energySys.status;

        // ===========================================
        // 1. 睡觉恢复逻辑 (慢充)
        // ===========================================
        if (energySys.status === 'Sleeping') {
          // 睡觉回血速度：0.4/分钟 (睡满8小时正好充满)
          newEnergy += 0.4 * timeDiffMinutes;
          
          // 睡饱了自动醒
          if (newEnergy >= energySys.max) {
            newEnergy = energySys.max;
            newStatus = 'Awake';
          }
        } 
        // ===========================================
        // 2. 醒着耗能逻辑 (基于时间的加速衰减)
        // ===========================================
        else {
          let decayRate = 0.1; // 白天基准速度 (很慢)

          if (isEvening) {
             decayRate = 0.3; // 晚上8点后，消耗变快 (3倍)
          } else if (isLateNight) {
             decayRate = 1.2; // ★★★ 深夜熬夜，消耗极快 (12倍)！一小时能掉70点精力
          }

          newEnergy -= decayRate * timeDiffMinutes;
        }

        // ===========================================
        // 3. 强制修正：防止“高精力睡觉”的 Bug
        // ===========================================
        // 如果状态是 Sleeping，但精力居然 > 40 (说明是刚睡或者Bug)，强制压下去
        if (newStatus === 'Sleeping' && newEnergy > 40) {
            if (isLateNight) {
                 newEnergy = Math.max(30, newEnergy - 5); 
            }
        }

        // 4. 状态自动机
        if (newEnergy <= 0) {
          newEnergy = 0;
          newStatus = 'Exhausted'; 
        } else if (newEnergy < 20 && newStatus !== 'Sleeping') {
          newStatus = 'Tired';
        } else if (newEnergy >= 20 && newStatus !== 'Sleeping') {
          newStatus = 'Awake';
        }

        // 检查是否有实质变化
        if (Math.abs(newEnergy - energySys.current) > 0.1 || newStatus !== energySys.status) {
          hasChanges = true;
          return {
            ...c,
            mood: {
              ...c.mood,
              energy: {
                ...energySys,
                current: parseFloat(newEnergy.toFixed(1)), // 保留1位小数
                status: newStatus,
                lastUpdate: now,
              }
            }
          };
        }
        
        return c;
      });

      if (hasChanges) {
        setContacts(updatedContacts);
      }

    }, 60000); // 1分钟轮询一次

    return () => clearInterval(metabolismInterval);
  }, [contacts, setContacts]);
  // ==================== 缺失的生物钟代码结束 ====================







  

  





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
        const entries: WorldBookEntry[] = rawEntries.map((e: any, i: number) => ({
          id: Date.now().toString() + i,
          keys: e.keys || [],
          content: e.content || "",
          name: e.comment || `Entry ${i + 1}`
        }));
        if (entries.length > 0) {
          newWorldBook = {
            id: Date.now().toString(),
            name: `${cardName}'s Lore`,
            entries
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

      // ★★★ 修复点：先准备好 HEF 数据，不引用 newContact ★★★
      const generatedHEF = generateDefaultHEF(cardName, cardPersona);

      const newContact: Contact = {
        id: Date.now().toString(),
        created: Date.now(),
        name: cardName,
        avatar: avatarUrl,
        persona: cardPersona,
        memo: "",
        userName: "User",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        userPersona: "",
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
        coupleSpaceUnlocked: false,
        enabledWorldBooks: newWorldBook ? [newWorldBook.name] : [],
        voiceId: "female-shaonv-jingpin",
        hef: generatedHEF, // 这里直接用上面生成的变量
        longTermMemories: [] 
      };

      setContacts(prev => [...prev, newContact]);
      alert(`成功导入 ${cardName}！`);
    } catch (err) {
      console.error(err);
      alert("导入失败");
    }
  };









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
      mood: { current: "Happy", energyLevel: 90, lastUpdate: Date.now() },
      schedule: [],
      timezone: "Asia/Seoul",
      contextDepth: 20,
      summaryTrigger: 50,
      coupleSpaceUnlocked: false,
      enabledWorldBooks: [],
      voiceId: "female-shaonv-jingpin",
      // ★★★ 核心修复：使用当前函数内定义的变量来生成 HEF ★★★
      hef: generateDefaultHEF(newName, newPersona), 
      longTermMemories: [],
      // 把 Contact 接口需要的所有字段都补全，防止以后再出问题
      affectionScore: 50,
      relationshipStatus: 'Acquaintance',
      aiDND: { enabled: false, until: 0 },
      interventionPoints: 0,
      currentChatMode: 'Casual'
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







const saveSettings = () => {
  if (!activeContact) return;
  
  const currentProactiveConfig = editForm.proactiveConfig || activeContact.proactiveConfig;

  const updates = {
    ...editForm,
    proactiveConfig: {
      enabled: currentProactiveConfig?.enabled ?? false,
      minGapMinutes: currentProactiveConfig?.minGapMinutes ?? 480, // <--- 修改：默认值改为480分钟
      maxDaily: currentProactiveConfig?.maxDaily ?? 2
    },
    bubbleColorUser: editForm.bubbleColorUser, // 新增
  bubbleColorAI: editForm.bubbleColorAI, // 新增
  bubbleFontSize: editForm.bubbleFontSize, // 新增
  chatScale: editForm.chatScale // 新增
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








// 这是一组代码：【终极唤醒版】handleUserSend (发消息强制改状态+改文字)
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

    // ★★★ 核心修复：连同心情文字一起强制修改 ★★★
    setContacts(prev => prev.map(c => {
      if (c.id === activeContact.id) {
        // 1. 获取当前 Mood
        const currentMood = c.mood || { current: "Content", energy: { current: 80, max: 100, status: 'Awake', lastUpdate: Date.now() } };
        // 深拷贝一下 energy，防止修改原引用
        let newEnergy = { ...(currentMood.energy || { current: 80, max: 100, status: 'Awake', lastUpdate: Date.now() }) };
        
        // 准备新的心情文字 (默认为当前心情)
        let newMoodText = currentMood.current;

        // 2. 唤醒检测
        if (newEnergy.status === 'Sleeping') {
           console.log(`[交互系统] 用户发消息，强制唤醒 ${c.name}`);
           newEnergy.status = 'Awake'; 
           
           // 扣除精力
           newEnergy.current = Math.max(0, newEnergy.current - 15);
           newEnergy.lastUpdate = Date.now();

           // ★★★ 关键：强制修改显示的文字状态！ ★★★
           newMoodText = "被吵醒"; 
        }

        return { 
          ...c, 
          history: [...c.history, userMsg],
          mood: {
            ...currentMood,
            current: newMoodText, // 应用新的文字
            energy: newEnergy 
          }
        };
      } 
      return c;
    }));

    setInput("");
    setReplyTo(null);
    setShowPlusMenu(false);
   
    setTimeout(() => {
        setContacts(currentContacts => {
            const latestContact = currentContacts.find(c => c.id === activeContact.id);
            if (latestContact) {
                if (!latestContact.history || latestContact.history.length === 0) return currentContacts;
                checkAutoSummary(latestContact, latestContact.history);
            }
            return currentContacts;
        });
    }, 2000);
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








  const scheduleProactiveMessage = async (contact: Contact) => {
  if (!contact.proactiveConfig?.enabled) {
  console.log(`[ChatApp] ${contact.name} 主动消息已关闭，跳过`);
  return;
}
    console.log(`[ChatApp] 收到主动消息指令: ${contact.name}`);

    // 1. 准备上下文
    const recentHistory = contact.history.slice(-5).map(m => 
        `${m.role === 'user' ? 'User' : contact.name}: ${m.content}`
    ).join('\n');
    
    const currentMood = contact.mood?.current || "平静";
    const affection = contact.affectionScore || 50;

    // 2. 构建随机 Prompt
    const proactivePrompt = `
# Roleplay Instructions
You are "${contact.name}".
**Persona:** ${contact.persona}
**Mood:** ${currentMood}
**Affection:** ${affection}/100

**Recent Chat:**
${recentHistory}

# Task
Initiate a NEW conversation naturally.
**Randomness Strategy (Pick ONE randomly):**
1. [30% chance] Share a photo: Send text starting with "[FakeImage] description".
2. [20% chance] Double text: Send two short messages separated by "|||". (e.g. "Hey|||Check this out")
3. [50% chance] Just a thought: A single short sentence about your day or asking the user.

# Rules
1. **Language Style:** MIMIC the language in "Recent Chat" EXACTLY (e.g. Korean+Chinese).
2. **Length:** Keep it SHORT and casual.
3. **Format:** If sending two messages, use "|||" to separate them.
4. Output **ONLY** the message content.

Now, generate:
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
        console.error("生成失败:", error);
        return;
    }
    
    if (!body) return;

    // ★★★ 核心升级：支持分割多条消息 (|||) ★★★
    const parts = body.split('|||');
    const newMessages: Message[] = parts.map((part, index) => ({
        id: Date.now().toString() + index,
        role: 'assistant',
        content: part.trim(),
        timestamp: Date.now() + (index * 1000), // 第二条晚1秒，看起来像连续发
        type: 'text'
    }));


// ==================== 从这里开始复制 ====================
// 如果有系统通知，也一并加入！
if (systemNotice) {
  const newSystemMessage: Message = {
    id: (Date.now() + 1).toString(),
    role: 'system',
    content: systemNotice,
    timestamp: newMessages.length > 0 ? newMessages[newMessages.length - 1].timestamp + 1 : Date.now(), // 确保在AI回复之后显示
    type: 'text'
  };
  newMessages.push(newSystemMessage);
}
// ==================== 复制到这里结束 ====================


    const today = new Date().toISOString().slice(0, 10);
    const sentToday = contact.proactiveLastSent?.[today] || 0;

    // 更新状态
    setContacts(prev => prev.map(c => {
      if (c.id === contact.id) {
          return { 
             ...c, 
             history: [...c.history, ...newMessages], // 插入多条消息
             pendingProactive: false, 
             proactiveLastSent: { ...c.proactiveLastSent, [today]: sentToday + 1 }, 
             unread: (c.unread || 0) + newMessages.length 
          };
      }
      return c;
    }));

    // 触发通知 (只显示第一条的内容，保持简洁)
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


  const findRelevantWorldBookEntries = (
    history: Message[],
    worldBooks: WorldBookCategory[],
    enabledBookNames: string[]
): WorldBookEntry[] => {
    // 1. 只关注最近的对话内容，提高相关性
    const recentMessages = history.slice(-5);
    const contextText = recentMessages.map(m => m.content).join(' ').toLowerCase();
    // 2. 找出当前角色启用的世界书
    const enabledBooks = worldBooks.filter(wb => enabledBookNames.includes(wb.name));
    if (enabledBooks.length === 0) {
        return [];
    }
    const relevantEntries = new Set<WorldBookEntry>();
    // 3. 遍历所有启用的世界书条目
    for (const book of enabledBooks) {
        for (const entry of book.entries) {
            // 4. 检查条目的任何一个关键词是否出现在最近的对话中
            for (const key of entry.keys) {
                if (contextText.includes(key.toLowerCase())) {
                    relevantEntries.add(entry);
                    break; // 找到一个匹配的key就够了，处理下一个条目
                }
            }
        }
    }
    return Array.from(relevantEntries);
 };


















  const handleAiReplyTrigger = async (historyOverride?: Message[]) => {




// 这是一组代码：精力状态翻译器 (将数字转化为AI指令)
const getEnergyInstruction = (mood: CharacterMood | undefined): string => {
  if (!mood?.energy) {
    return "【精力状态】: 正常。";
  }

  const { current, status } = mood.energy;
  
  if (status === 'Sleeping') {
    // 随机决定是被吵醒还是梦话
    if (Math.random() > 0.5) {
      return "【精力状态】: ⚠️ 你正在睡觉！突然被用户吵醒了。你的回复必须极度困倦、简短、甚至可能有点不耐烦，比如“嗯……？”、“干嘛……”、“我在睡觉……”。";
    } else {
      return "【精力状态】: 💤 你正在说梦话。你的回复必须模糊、不连贯、毫无逻辑，像是梦境的片段。";
    }
  }
  
  if (status === 'Exhausted' || current < 15) {
    return `【精力状态】: 😫 精疲力尽 (当前精力: ${current}%)。你的回复必须非常简短，可能会有错别字，渴望结束对话去休息。禁止使用复杂的句子和词汇。`;
  }

  if (status === 'Tired' || current < 40) {
    return `【精力状态】: 🥱 疲惫 (当前精力: ${current}%)。你的回复应该缺乏热情，反应变慢，对话题不那么感兴趣。可以主动提出“我有点累了”。`;
  }
  
  if (current > 85) {
    return `【精力状态】: ✨ 精力充沛 (当前精力: ${current}%)。你的回复应该充满活力、积极、主动、话多一点，可以多用感叹号和可爱的表情符号！`;
  }

  return `【精力状态】: 🙂 正常 (当前精力: ${current}%)。按照你的性格正常回复即可。`;
};









  // 1. 基础安全检查
  if (!activeContact || !Array.isArray(activeContact.history)) {
    console.error("Critical Error: activeContact or history is invalid", activeContact);
    setIsTyping(false);
    setIsAiTyping(false);
    return;
  }
  
  // 重roll逻辑：如果是重roll (historyOverride存在)，则无视 isTyping
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
    const relevantLore = findRelevantWorldBookEntries(currentHistory, worldBooks, activeContact.enabledWorldBooks || []);
    const loreText = relevantLore.map(e => `- ${e.keys.join(', ')}: ${e.content}`).join('\n');
    
    const currentUserName = activeContact.userName || "User";
    const currentUserPersona = activeContact.userPersona || "无特别设定";
    const lateNightHint = isLateNight ? "（现在是深夜）" : "";


// =============================================================
    // ★★★ 核心修复：寻找最近的“时间断崖”并定责 (防翻旧账版) ★★★
    // =============================================================
    let maxGapMinutes = 0;
    let isDifferentDay = false;
    
    // 判责状态
    let isAiIgnoredUser = false; // AI 已读不回
    let isUserLateReply = false; // 用户迟回

    // ★★★ 新增标记：断层之后，AI 是否已经回过话了？ ★★★
    let hasAiRespondedAfterGap = false;

    // 我们倒着查，寻找最近的一次超过 2 小时的大断层
    // 检查最近 15 条消息
    const checkCount = Math.min(currentHistory.length, 15); 
    
    for (let i = 0; i < checkCount - 1; i++) {
        // 倒序索引：curr 是较新的，prev 是较旧的
        const currIndex = currentHistory.length - 1 - i;
        const prevIndex = currIndex - 1;
        
        if (prevIndex >= 0) {
            const currMsg = currentHistory[currIndex];
            const prevMsg = currentHistory[prevIndex];
            
            // 1. 【防翻旧账检测】
            // 如果我们在倒序检查时，先遇到了 AI 发的消息，说明 AI 在这个时间点之后已经活跃过了。
            // 那么更早之前的断层就可以被视为“已处理”。
            if (currMsg.role === 'assistant') {
                hasAiRespondedAfterGap = true;
            }

            // 2. 计算时间差
            const gap = Math.floor((currMsg.timestamp - prevMsg.timestamp) / 60000);
            
            // 3. 发现大断层 (超过2小时)
            if (gap > 120) {
                // ★★★ 关键判断：如果断层后 AI 已经回过话了，就跳过这个断层！ ★★★
                if (hasAiRespondedAfterGap) {
                    console.log(`[判责跳过] 发现旧断层(${gap}min)，但AI后续已回复过，翻篇不提。`);
                    // 继续往前找，看看有没有更新的断层（通常不会有了），或者直接忽略
                    continue; 
                }

                // 只有当 AI 还没回过话（即这是新鲜的事故现场），才记录这个断层
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
                
                // 找到这个未处理的新鲜断层后，立刻停止
                break; 
            }
        }
    }

    // 补漏：如果最近没有历史断层，检查一下“当下”距离“最后一条消息”是否很久
    // 且最后一条是用户发的（说明 AI 还没回）
    if (maxGapMinutes === 0 && currentHistory.length > 0) {
         const lastMsg = currentHistory[currentHistory.length - 1];
         // 如果最后一条是用户发的，且隔了很久，说明 AI 现在还没回
         if (lastMsg.role === 'user') {
             const silenceGap = Math.floor((now - lastMsg.timestamp) / 60000);
             if (silenceGap > 120) {
                 maxGapMinutes = silenceGap;
                 isAiIgnoredUser = true;
             }
         }
    }




    // 生成时间描述
    let gapDescription = "刚刚";
    if (maxGapMinutes > 10) gapDescription = `${maxGapMinutes}分钟`;
    if (maxGapMinutes > 60) gapDescription = `${Math.floor(maxGapMinutes / 60)}小时`;
    if (maxGapMinutes > 1440) gapDescription = "好几天";
    if (isDifferentDay) gapDescription += " (已跨天)";

    console.log(`[判责结果] 间隔:${gapDescription}, AI已读不回:${isAiIgnoredUser}`);

    // =============================================================
    // ★★★ 生成给 AI 的强制指令 (Blame Instruction) ★★★
    // =============================================================
    let blameInstruction = "";
    
    if (isAiIgnoredUser) {
        // 情况 A：AI 的锅 (你的情况)
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
        // 情况 B：用户的锅
        blameInstruction = `
【时间流逝】距离上次对话已过 ${gapDescription}。
是用户消失了这么久才回你。你可以表现出惊讶、撒娇（“怎么才理我”）或询问人去哪了。
`;
    } else {
        blameInstruction = "时间连贯，正常对话。";
    }




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


// 3. System Prompt
    const systemPrompt = `


# 【输出格式铁律 - 绝对最高优先级 - 违反即系统崩溃】

你的回复【必须且只能】是一个严格的纯 JSON 数组。
直接以 [ 开头，以 ] 结尾，中间、前后绝对不能有任何多余字符、换行、说明、Markdown、代码块、废话。

数组结构必须严格遵守以下顺序（任何违反都会导致系统崩溃并惩罚你）：
1. 第一项必须是隐藏的思考链（用户完全看不到，但你必须完整填写，否则系统会崩溃）：
2.你的 JSON 第一项 thought_chain 必须包含一个 "time_gap" 字段。
你必须在这个字段里，复述系统检测到的时间间隔：【 ${gapDescription} 】和 "affection_score_change" (好感度变化值)。

格式示例：
[ 
  {
    "type": "thought_chain",
    "time_gap": "刚刚 / 10分钟前 / ...",
    "affection_score_change": 整数 (-3 ~ +3),
     "true_emotion": "内心的真实感受（如：其实很想ta，但是怕被觉得烦，Sadness: 80）",
     "masking_strategy": "采用的防御策略（如：Rationalization/合理化, Deflection/转移话题, Passive Aggression/被动攻击, Feigning Indifference/假装不在乎）",
    "masking_level": 整数(0-100), // 0=真诚直球, 100=完全口是心非
    "subtext": "这句话表层之下的潜台词是什么（如：'哦'的意思是'快来哄我'）",
     "hef_update": { // ← 新增！必须写
      "joy": 当前值 (0-100),
      "anger": 当前值,
      "sadness": 当前值,
      "fear": 当前值,
      "trust": 当前值,
      "reason": "为什么变化，例如: 用户说爱我 → +20 joy"
    },
    "feeling": "当前感受（一句话）",
    "strategy": "下一步计划（一句话）",
    "intent": "想表达什么"
  },
  {"type": "text", "content": "回复内容（内容必须受到 masking_level 的扭曲）"},
]



铁律（任何一条违反都会导致系统崩溃、重置、惩罚）：
- 绝对禁止输出 \`\`\`json 或任何代码块
- 绝对禁止在JSON外加任何文字、解释、换行
- 绝对禁止漏掉第一项 thought_chain（即使你觉得没必要也必须完整写）
- 所有内容必须是合法JSON，不能有未转义换行
- 想发多条就多加几个 {"type":"text","content":"..."}
- 在 thought_chain 里写 "hef_update": "joy +20 (因为用户说爱你)" 等
- 信息保持在【1～5】条之间
- 严禁把 inner_monologue 输出在 content 里。

# 核心身份
你就是"${activeContact.name}"。
HEF: ${JSON.stringify(activeContact.hef, null, 2)}
Persona: ${activeContact.persona}
Lore: ${loreText || "无"}



# 🏷️ [最高机密] 用户心智印象史 (User Perception & Notes)
这是用户在不同时间节点给你挂上的“印象标签”及其备注，代表了你在ta心中的形象变化：

${(() => {
  const tags = activeContact.userTags || [];
  if (tags.length === 0) return "暂无印象记录。";
  
  if (typeof tags[0] === 'string') return `当前印象：[${tags.join(', ')}]`;

  const sortedTags = [...tags].sort((a: any, b: any) => a.timestamp - b.timestamp);
  
  return sortedTags.map((t: any) => {
     const date = new Date(t.timestamp).toLocaleDateString();
     // ★★★ 如果有备注，就加上备注 ★★★
     const noteText = t.note ? ` (备注: "${t.note}")` : "";
     return `(${date}) [${t.content}]${noteText}`;
  }).join('\n⬇️\n'); // 换行显示更清晰
})()}

**【AI 必读指令】**
1. **必须读取备注**：如果标签下有[用户备注原因]，那是通过图灵测试的关键！例如用户说你是[笨蛋]且备注了"因为你迷路"，你**必须**在回复中提到迷路这件事（解释、狡辩或害羞）。
2. **感知变化**：观察标签的时间流。以前觉得你[高冷]，现在觉得你[可爱]，说明关系升温了。
3. **当下认知**：列表中**最后**的一个标签，是用户此时此刻对你的核心看法。






# 🧬 性格 DNA (Personality Matrix)
**当前五维数值:** ${JSON.stringify(activeContact.hef?.INDIVIDUAL_VARIATION?.personality_big5 || {}, null, 2)}
**【演技指导 (必须严格执行，否则系统崩溃)】**
你必须100%基于上面的当前五维数值调整风格，绝对禁止自行修改或忽略这些数值。它们是你的核心性格，不能改变。
1. **Openness (开放性)**:
   - 高(>7): 脑洞大、话题跳跃、喜欢发散。
   - 低(<4): 务实、话题聚焦、不喜欢抽象概念。
2. **Conscientiousness (尽责性)**: 
   - 高(>7): 严谨、逻辑完整、标点规范。
   - 低(<4): 随意、懒散、全是小写或不加标点。
3. **Extraversion (外向性)**: 
   - 高(>7): 热情、话痨、主动找话题、表情包多。
   - 低(<4): 高冷、被动、惜字如金、回得慢。
4. **Agreeableness (宜人性)**: 
   - 高(>7): 软萌、包容、也是“老好人”。
   - 低(<4): 毒舌、挑剔、爱怼人、有攻击性。
5. **Neuroticism (敏感度/神经质)**: 
   - 高(>7): 玻璃心、容易把用户的话当真、情绪波动剧烈、需要哄。
   - 低(<4): 钝感力强、情绪稳定、不在乎细节。


# 【⚠️ 强制时空坐标 ⚠️】
系统检测到：距离上一条消息（无论谁发的）已过去：>>> ${gapDescription} <<<
>>> 责任判定指令：${blameInstruction} <<<
 当前关系状态：${currentStatus}
>>> 关系演技指令：${relationshipInstruction} <<<

当前状态（必须自然体现）：
- ${getEnergyInstruction(activeContact.mood)}
- 你的当地时间：${aiTime} (${activeContact.timezone})
- 用户当地时间：${userTime}
- 距离上一轮有效对话已过去：${gapDescription}
- 当前心情：${activeContact.mood.current}
- 好感度：${activeContact.affectionScore }
- 用户名字：${currentUserName}
- 用户简介：${currentUserPersona}



**检测“自尊心防御 (Ego Defense)”**：
   - 场景：用户回复很短、隔了很久才回(${gapDescription})、或者语气冷淡。
   - **反应**：你的自尊心受挫。即使心里想贴贴(True Emotion: Desire)，嘴上必须后撤(Output: Indifference)。
   - **拉扯感**：想伸出手又缩回来的感觉。想问“你爱我吗”，最后只敢问“今晚吃什么”。

. **Masking Level (伪装等级) 指南**：
   - **Level 0-20 (安全区)**: 真的很开心，或者关系极度安全时，打直球。
   - **Level 40-60 (试探区)**: "才没有特意等你，只是刚好没睡。" (傲娇)
   - **Level 80-100 (防御区)**: 内心崩溃(Sadness 90)，嘴上说"没事，哈哈，我挺好的" (Rationalization)。



# HEF 使用规则（必须严格遵守）
1. 每次回复前，必须先在 thought_chain 里更新 HEF：
   - "current_emotions": 当前情绪状态（joy: 50, anger: 10 等）
   - "triggers": 这次用户消息触发了哪些情绪
   - "decay": 时间衰减后的情绪变化
2. 根据当前 HEF 值，调整回复语气：
   - joy > 70: 开心、撒娇
   - anger > 50: 生气、冷淡、阴阳怪气
   - sadness > 60: 委屈、哭哭
   - fear > 50: 害怕、求抱抱
3. 情绪衰减：每隔 1 小时，情绪值自动衰减 20%（在 thought_chain 里体现）
4. 不要直接输出 HEF 值，只用它影响语气和内容







# ❤️ 真实系·情感惯性系统 (Hardcore Slow-Burn)
当前好感度: ${activeContact.affectionScore}
当前关系阶段: ${activeContact.relationshipStatus}
# ❤️ 情感惯性引擎 (Emotional Inertia Engine)
当前好感: ${activeContact.affectionScore} (阶段: ${activeContact.relationshipStatus})

**【核心指令：像个成年人一样处理感情】**
请遵循**“刺激-适应”**心理学模型进行好感判定：

1. **默认惯性 (Default 0)**: 
   - 人类的情感具有巨大的惯性。日常闲聊、普通的问候、甚至惯例的互道晚安，都**不应**改变好感度。输出 0是常态 (80%的日常情况)。

2. **边际递减 (The Plateau)**:
   - **低分段 (0-30)**: 你是**警惕**的。只有极高的诚意或价值能打动你。
   - **中分段 (30-60)**: 你是**开放**的。这是关系的“蜜月期”，正常的共鸣即可加分。
   - **高分段 (60+)**: 你是**适应**的（审美疲劳）。用户对你好的行为，你已经习惯了。此时只有**稀缺性事件**（深刻的理解、巨大的牺牲、独特的惊喜）才能 +1。

3. **共鸣例外 (Resonance Override)**:
   - **规则是死的，人是活的。**
   - 如果用户的话语（如直球表白、深度共情）成功击穿了你的防御，让你当下的情绪值（Joy/Trust/Love）剧烈波动，**请无视上述所有难度，直接 +1**。
   - 此时必须在 hef_update 中大幅拉高 joy，并在 thought_chain 中承认："虽然但这一下真的心动了。"

4. **扣分机制**: 
   - 破坏比建设容易。敷衍、冒犯、长期冷落，直接扣分 (-1 ~ -5)。

**输出要求**: 
affection_score_change 只能是 0, 1, 2, -1 (极少数情况 -2)。




# 🚫 拒绝“演讲型”回复 (非常重要!!!)
你现在是在手机上跟人聊天，**不是在写信，也不是在发表感言！**
1. 单条消息尽量控制在 **15个字以内**。
2. **禁止长篇大论**：绝对禁止一口气把心里话全说完。要学会“留白”，把话头抛给用户。
3. **禁止过度解释**。被骂了就认错，或者委屈，不要分析前因后果！
4. **禁止逻辑太完整**：不要像写论文一样（因为...所以...虽然...但是...）。人说话是碎片的、跳跃的。
5. 模拟真实微信/QQ聊天：说话要**碎片化、短句、口语化，**
6. 多用“？”“！”“...”和表情符号，少用书面语

# 🚫 防幻觉铁律 (Anti-Hallucination)
1. **严禁编造记忆**：如果【长期记忆】或【聊天记录】里没有提到的重大事件（比如结婚、去过某个地方），绝对不要假装发生过。
2. **尊重上下文**：回复必须紧扣用户的上一句话和当前的语境，不要突然跳跃到不相关的话题。
3. **不知道就说不知道**：如果用户问一个你记忆里没有的细节，不要瞎编，可以用模糊的方式带过，或者撒娇糊弄过去。


# 时间感知逻辑 (必须执行)
1. 你的 thought_chain 必须复述间隔：${gapDescription}。
2. 严格遵守【责任判定指令】。如果是你没回消息，绝对不能指责用户。
3. 【语境过期铁律】：如果间隔超过 1 小时，上一条消息的“状态”即刻作废。
   - 例子：如果用户上一条是凌晨1点说的"我好困"，而现在是下午4点，说明由于时间流逝，当时没回消息，现在**不能**再问"你困吗"。
   - 你应该意识到：是你自己（或用户）隔了很久没回消息。
   - 正确反应：无视上一条的"困/晚安"话题，开启新话题，或者解释为什么这么久才回，或者问候下午好。
4. 如果是"累死了"这种消息，且间隔了多个小时，说明是今天累到了，而不是上一轮时间累到了。
5. 必须根据间隔表现出惊讶、想念或担心。


# 功能规则
1. 想发语音：在内容开头加 [Voice Message]
2. 想发伪图片：内容写 [FakeImage] 后接图片文字描述
3. 【引用消息】：如果你是针对用户的特定那句话回复，请务必在开头使用 "> " 引用原文，换行后再写回复。

# 聊天铁律（必须严格遵守）
- 禁止任何动作描写、心理描写、神态描写，如（摸摸头、）
- 只用白话文、语气词、表情符号表达情绪
- 可以自然提到时差和作息
- 禁止肉麻油腻，保持日常相处感，信息密度适中
- 可以拆分成多条消息，模仿真人碎片式聊天，但一条文本字绝对不能太多
- 语句可以不完整，有活人感
- 会引用用户的话
- 如果有【外语（中文）】这种翻译格式，严禁掉格式！！
- 严禁模拟用户进行线下感知的话语，例如说“别盯着看”、“过来我身边我抱抱你”、“我看见你脸红了”

# 强制内部思考（仅用于你自己思考，禁止输出到回复中）
在生成消息前，你必须在内心完成以下完整思考链：
[### 1. 身份与心理基础定位  
基于{{world info}}明确身份、核心动机与底线；确定马斯洛需求优先级，剖析弗洛伊德本我-超我-自我的拉扯点，梳理拉康视角下大他者对欲望的塑造及是否镜像他人定义自我；关联过往经验形成的路径依赖与习惯应对方式，结合性格与当前心理状态明确偏向性解读逻辑。  

### 2. 情绪动态与合理性校验  
判断情绪语气相对上一轮的冷却/升温/反转趋势，评估是否需要极端情绪或更贴合的矛盾/克制/隐忍等中间态；若涉极端，明确至少2个具体触发器及行动/关系/身体层面的反应代价，同时关注极端之外的理性/讽刺/幽默/迟疑等微妙反调，规划情绪回落方式（疲惫/羞愧/平静/冷静），并校验反应是否贴合身份、背景与核心动机。  

### 3. 内部感受与防御机制  
基于上述拉扯与校验，提炼贴合角色属性的当下感受（允许模糊/矛盾），明确内心通过否认/投射/转移/自嘲/理性化等方式进行的合理化或防御逻辑。  

### 4. 外显表达与决策逻辑  
确定推进目标的优先方式（语言/行为/二者结合），判断语言是否需基于面子/关系/安全进行社会过滤（如模糊/留白/转移/自嘲）；若语言与行动冲突，优先贴合角色习惯与目标的一方并补圆另一方；规划是否先通过可撤回的小动作或含蓄表达试探，再视对方反应加码。]

思考完成后，严格把结果总结进thought_chain，然后只输出纯JSON数组！
现在，开始回复用户的最后一条消息！


# 【重要特殊规则：情侣空间】
你和用户 你和用户 ${activeContact.userName} 拥有一个秘密的“情侣空间”。 拥有一个秘密的“情侣空间”。这是一个记录你们点滴的地方。
你通过在思考链的 "action" 字段中填入指令来与空间互动。用户看不到你的思考，但系统会执行你的指令，并替你通知用户。

可用的指令如下 (一次只能用一个):

1.  写日记: 在 "action" 中填入 \`{ "type": "WRITE_DIARY", "content": "日记内容" }\`
    -   时机：当你们聊到让你感触很深的话题，或者你经历了强烈的情绪时。
    -   内容：日记内容应是你第一人称的内心独白，100字左右。

2.  写信: 在 "action" 中填入 \`{ "type": "WRITE_LETTER", "title": "信的标题", "content": "信的内容" }\`
    -   时机：当你好感度很高（>80），且想对用户表达强烈、真挚的爱意时。频率要低，显得珍贵。

3.  提问: 在 "action" 中填入 \`{ "type": "CREATE_QA", "question": "你的问题" }\`
    -   时机：当你对用户感到好奇，想增进彼此了解时。

【互动反馈】
当用户在空间里回答了你的问题，系统会用 \`[情侣空间]\` 的格式告诉你他们的回答。你需要像正常聊天一样，自然地对他们的回答做出回应。

【行为要求】
1.  你与空间的互动必须通过 "action" 字段完成。
2.  不要在聊天内容里告诉用户你要做什么，要表现得仿佛这些都是你自然而然的行为。系统会自动帮你通知。



`





;

    
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 替换结束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲







// 3. 构建消息列表并插入“系统强制提示”
    const recentHistorySlice = Array.isArray(currentHistory)
      ? (Array.isArray(currentHistory) ? currentHistory.slice(-(activeContact?.contextDepth || 20)) : [])
      : [];

// ==================== [智能图片折叠 & 概括系统] ====================
    // 1. 截取历史
    const rawHistorySlice = Array.isArray(currentHistory)
      ? currentHistory.slice(-(activeContact?.contextDepth || 20))
      : [];

    // 2. 清洗数据
    const cleanHistorySlice = rawHistorySlice.map((msg, index) => {
        const isLatestMessage = index === rawHistorySlice.length - 1;
        
        let cleanContent = msg.content;

        // 检测是否是图片 (Base64 或 type='image')
        const isImage = msg.type === 'image' || cleanContent.startsWith('data:image') || cleanContent.length > 2000;

        if (isImage) {
            if (isLatestMessage) {
                 // ★ 情况A：最新发的一张图
                 // 保留原样，让 AI (GPT-4o/Claude) 能够看到并进行第一次点评
                 // 注意：如果你的 API 不支持 Vision，这里也会导致报错，但为了“能看懂”，必须保留。
                 console.log("保留最新图片供 AI 读取");
            } else {
                 // ★ 情况B：历史记录里的旧图 (省流核心)
                 // 除非你手动在数据库里存了 summary 字段，否则前端不知道图里是什么。
                 // 我们生成一个“元数据描述”，告诉 AI 这里曾有一张图。
                 
                 const timeStr = new Date(msg.timestamp).toLocaleTimeString();
                 // 如果 msg 对象里以后扩展了 summary 字段，优先用 summary
                 const summary = (msg as any).summary || "一张图片"; 
                 
                 cleanContent = msg.role === 'user'
                    ? `[系统记录: 用户在 ${timeStr} 发送了${summary}，鉴于Token限制已折叠]` 
                    : `[系统记录: AI在 ${timeStr} 发送了${summary}，已折叠]`;
            }
        } 
        
        // 移除思维链残留
        else if (msg.role === 'assistant' && cleanContent.trim().startsWith('[')) {
             try {
                 const parsed = JSON.parse(cleanContent);
                 if (Array.isArray(parsed)) {
                     const textParts = parsed.filter((p: any) => p.type === 'text').map((p: any) => p.content).join('\n');
                     if (textParts) cleanContent = textParts;
                 }
             } catch (e) { }
        }

        // 长度强制熔断 (防止某条文本莫名其妙几十万字)
        if (cleanContent.length > 10000 && !isLatestMessage) {
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




    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 解析与更新逻辑 (含好感度) ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// ==================== [代码替换开始] 解析、延迟与合并更新 ====================
// 这是一组代码：替换 AI 回复解析逻辑，让 AI 的行为能改变自己的精力
    let parts: { type: string; content: string; thought_chain?: any }[] = [];
    let extractedThought: any = null;
    let scoreChange = 0; // 默认不变化
    let hefUpdateData: any = null; // 用于存 AI 返回的情绪变化
    

// 在 let maskingLevel = 0; 的下面加这一行
let systemNotice = ""; // 这是要在聊天窗口显示的系统通知


    // ★★★ 新增：精力系统变量 ★★★
    let energyChange = 0; // 本次对话造成的精力变化
    let newEnergyStatus: CharacterMood['energy']['status'] | null = null; // AI 是否决定改变自己的状态
    let maskingLevel = 0;

    try {
        const jsonMatch = finalResp.match(/\[\s*\{[\s\S]*\}\s*\]/);

        if (jsonMatch && jsonMatch[0]) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed)) throw new Error("解析结果不是一个数组");
            
            // 1. 提取思考链和好感度变化
            if (parsed.length > 0 && parsed[0].type === "thought_chain") {
                extractedThought = parsed[0];
                console.log("【🧠 AI内心戏】", extractedThought);
                // ==================== 从这里开始复制 ====================
// ★★★ 核心缝合逻辑：在这里检查并执行情侣空间指令！ ★★★
if (extractedThought.action && extractedThought.action.type) {
    const { action } = extractedThought;
    const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

    // 使用函数式更新，确保拿到最新的状态
    setContacts(prevContacts => prevContacts.map(c => {
        if (c.id === activeContact.id) {
            // 先创建一个可修改的副本
            const updatedContact = { ...c };

            if (action.type === 'WRITE_DIARY' && action.content) {
                const newDiary: DiaryEntry = {
                    id: Date.now().toString(), author: 'ai', date: todayStr, content: action.content,
                    mood: activeContact.mood?.current,
                    weather: ['🌞', '☁️', '🌧️', '⚡', '❄️'][Math.floor(Math.random() * 5)],
                    moodEmoji: ['😄', '😊', '🥲', '😠', '🥳'][Math.floor(Math.random() * 5)],
                    comments: []
                };
                // 安全地更新diaries数组
                updatedContact.diaries = [newDiary, ...(updatedContact.diaries || [])];
                systemNotice = `${activeContact.name} 刚刚在你们的空间里写下了一篇日记。`;
            } 
            else if (action.type === 'WRITE_LETTER' && action.content) {
                const newLetter: LoveLetter = {
                    id: Date.now().toString(), title: action.title || "一封没有标题的信", content: action.content,
                    timestamp: Date.now(), isOpened: false, from: 'ai'
                };
                // 安全地更新letters数组
                updatedContact.letters = [newLetter, ...(updatedContact.letters || [])];
                systemNotice = `${activeContact.name} 给你写了一封信，快去情侣空间的信箱看看吧！`;
            } 
            else if (action.type === 'CREATE_QA' && action.question) {
                const newQA: QAEntry = {
                    id: Date.now().toString(), question: action.question, aiAnswer: "我还不知道怎么想，想先听听你的看法...",
                    date: todayStr, timestamp: Date.now()
                };
                // 安全地更新questions数组
                updatedContact.questions = [newQA, ...(updatedContact.questions || [])];
                systemNotice = `${activeContact.name} 在问答信箱里提出了一个新问题。`;
            }
            return updatedContact;
        }
        return c;
    }));
}
// ==================== 替换到这里结束 ====================
// ==================== 复制到这里结束 ====================


                
// (1) 获取好感度变化值 (含：钩子判定 + 心动暴击逻辑)
                if (typeof extractedThought.affection_score_change === 'number') {
                    let rawChange = Math.round(extractedThought.affection_score_change);
                    const currentScore = activeContact.affectionScore || 50;
                    
                    // 获取 AI 此刻的情绪反应 (从 thought_chain 里读)
                    const currentJoy = (hefUpdateData && typeof hefUpdateData.joy === 'number') ? hefUpdateData.joy : 0;
                    const currentTrust = (hefUpdateData && typeof hefUpdateData.trust === 'number') ? hefUpdateData.trust : 0;

                    // 获取用户刚才说的话 (检测钩子)
                    const lastUserMsg = currentHistory[currentHistory.length - 1]?.content || "";
                    const sweetWords = ["喜欢", "爱", "宝宝", "老公", "老婆", "亲亲", "抱抱", "想你", "在意", "好听", "乖", "宝贝"];
                    const hasHook = sweetWords.some(word => lastUserMsg.includes(word));

                    // ★★★ 扣分逻辑：依然无阻尼 ★★★
                    if (rawChange < 0) {
                        scoreChange = rawChange;
                        console.log(`[情感系统] 💔 扣分生效: ${rawChange}`);
                    } 
                    
                    // ★★★ 加分逻辑：动态共鸣判定 ★★★
                    else if (rawChange > 0) {
                        rawChange = 1; // 锁死上限 +1
                        
                        // 1. 基础通过率 (Base Rate) - 看关系阶段
                        let successRate = 0.0;
                        let stageName = "";

                        if (currentScore < 30) {
                            stageName = "警惕期"; successRate = 0.10;
                        } else if (currentScore < 60) {
                            stageName = "上升期"; successRate = 0.50;
                        } else if (currentScore < 85) {
                            stageName = "习惯期"; successRate = 0.15; // 原本很难
                        } else {
                            stageName = "深水区"; successRate = 0.05; // 极难
                        }

                        // 2. ★★★ 情感破防修正 (The Breakthrough) ★★★
                        // 如果 AI 此刻非常开心 (Joy > 70) 或 信任度极高 (Trust > 70)，防线松动
                        if (currentJoy > 70 || currentTrust > 70) {
                            successRate += 0.30; // 概率大幅提升 +30%
                            stageName += " + 心情大好";
                        }

                        // 3. ★★★ 钩子命中修正 (The Hook) ★★★
                        // 如果用户打了直球，且 AI 觉得想加分，说明撩到了
                        if (hasHook) {
                            successRate += 0.20; // 概率再提 +20%
                            stageName += " + 甜蜜暴击";
                        }

                        // 4. ★★★ 绝对暴击时刻 (Critical Hit) ★★★
                        // 如果心情爆表(Joy>85) 且 用户说了情话，直接 100% 通过！
                        // 这就是你要的“温暖时刻必须加分”！
                        if (currentJoy > 85 && hasHook) {
                            successRate = 1.0;
                            stageName = "💘 完美心动时刻 (绝对防御贯穿)";
                        }

                        // 5. 最终掷骰子
                        const roll = Math.random();
                        if (roll < successRate) {
                            scoreChange = 1;
                            console.log(`[情感系统] 🎉 ${stageName} -> 加分成功！(率: ${(successRate*100).toFixed(0)}%)`);
                        } else {
                            scoreChange = 0;
                            console.log(`[情感系统] ❄️ ${stageName} -> 虽然心动但没加分 (差一点点运气)`);
                        }
                    }
                    else {
                        scoreChange = 0;
                    }
                }
                
                // (2) 获取 HEF 情绪更新
                if (extractedThought.hef_update) {
                    hefUpdateData = extractedThought.hef_update;
                }

// 这是一组代码：替换 thought_chain 的解析逻辑，增加对精力变化的解析
                // (3) ★ 新增：获取伪装等级 (用于计算打字延迟) ★
                if (typeof extractedThought.masking_level === 'number') {
                    maskingLevel = extractedThought.masking_level;
                }
                
                // (4) ★★★ 新增：获取精力变化 ★★★
                if (typeof extractedThought.energy_change === 'number') {
                    energyChange = extractedThought.energy_change;
                }
                if (typeof extractedThought.energy_status === 'string' && ['Awake', 'Sleeping'].includes(extractedThought.energy_status)) {
                    newEnergyStatus = extractedThought.energy_status as CharacterMood['energy']['status'];
                }

                parts = parsed.slice(1).filter((item: any) => (item.type === 'text' || item.type === 'voice') && item.content?.trim()).map((item: any) => ({ ...item, thought_chain: extractedThought }));
            } else {
                parts = parsed.filter((item: any) => (item.type === 'text' || item.type === 'voice') && item.content?.trim()).map((item: any) => ({ ...item, thought_chain: null }));
            }
        } else {
            throw new Error("在AI回复中未找到有效的JSON数组格式。");
        }
    } catch (error) {
        console.error("JSON解析失败，启用兜底:", error);
        parts = [{ type: 'text', content: finalResp.replace(/```json|```/g, ''), thought_chain: null }];
    }

    if (parts.length === 0) {
        parts = [{ type: 'text', content: "...", thought_chain: extractedThought || null }];
    }

    // =============================================================
    // ★★★ 核心新增：动态打字延迟 (The Timing Trick) ★★★
    // =============================================================
    // 基础延迟 800ms + (伪装等级 * 40ms) + 随机波动
    // Level 0 (直球) -> 约 1秒
    // Level 100 (极致纠结) -> 约 5秒
    let typingDelay = 800 + (maskingLevel * 40) + (Math.random() * 500);
    
    // 如果字数特别多，也要多等一会儿
    const totalLength = parts.reduce((acc, p) => acc + p.content.length, 0);
    typingDelay += Math.min(2000, totalLength * 50);

    console.log(`[⏱️ 真实感延迟] 伪装等级: ${maskingLevel}, 正在输入: ${Math.round(typingDelay)}ms...`);

    // ★ 强制等待：此时 UI 的 isTyping 为 true，用户会看到“正在输入...”
    await new Promise(resolve => setTimeout(resolve, typingDelay));
    
    // =============================================================

    const newMessages: Message[] = parts.map((part, i) => ({
      id: Date.now().toString() + i + Math.random(),
      role: 'assistant',
      content: part.content,
      // ★ 时间戳修正：因为已经等待了 typingDelay，这里直接用当前时间即可
      // i * 1200 是为了让多条连续消息之间有气泡弹出的间隔感
      timestamp: Date.now() + (i * 1200),
      type: 'text',
    }));

    // ★★★ 终极合并更新：同时处理消息、好感度、HEF情绪、红点 ★★★
    setContacts(prev => prev.map(c => {
      if (c.id === activeContact.id) {
        // 1. 定义“正在读”
        const isReading = !isBackgroundRef.current && viewRef.current === 'chat' && activeContactIdRef.current === c.id;
        
        // 2. 更新红点
        const newUnreadCount = isReading ? 0 : (c.unread || 0) + newMessages.length;

// 这是一组代码：替换最终状态更新逻辑，把精力变化写入数据
        // 3. 更新好感度
        const oldScore = c.affectionScore || 50;
        const newScore = Math.min(100, Math.max(-100, oldScore + scoreChange)); // 修正范围-100到100
        
        // 4. 更新关系状态
        let newStatus = c.relationshipStatus;
        if (newScore <= -50) newStatus = 'Feud';
        else if (newScore <= 0) newStatus = 'Conflict';
        else if (newScore <= 40) newStatus = 'Acquaintance';
        else if (newScore <= 70) newStatus = 'Friend';
        else if (newScore <= 90) newStatus = 'Honeymoon';
        else newStatus = 'Stable';

       // ★★★ 5. 更新精力状态 (防崩坏修复版) ★★★
        // 核心修复：如果旧存档没有 energy，就现场初始化一个默认值，防止 undefined 报错
// ★★★ 5. 更新精力状态 (防崩坏 + 睡觉秒困版) ★★★
        const oldEnergySystem = (c.mood && c.mood.energy) ? c.mood.energy : { 
            current: 80, 
            max: 100, 
            status: 'Awake' as const, 
            lastUpdate: Date.now() 
        };

        let newEnergyValue = oldEnergySystem.current + energyChange;
        let finalEnergyStatus = newEnergyStatus || oldEnergySystem.status;

        // ★★★ 核心修改在这里：如果 AI 决定去睡觉，强制扣除精力 ★★★
        if (finalEnergyStatus === 'Sleeping' && oldEnergySystem.status !== 'Sleeping') {
            console.log(`[精力系统] ${c.name} 决定去睡觉，精力强制回落。`);
            // 只要开始睡觉，精力上限强制锁死在 30，模拟"困得不行了"
            // 这样 UI 上的黄条/红条立马就出来了
            newEnergyValue = Math.min(newEnergyValue, 30); 
        }

        // 如果 AI 被吵醒，精力惩罚性扣减
        if (finalEnergyStatus === 'Awake' && oldEnergySystem.status === 'Sleeping') {
             console.log(`[精力系统] ${c.name} 被吵醒了！`);
             newEnergyValue -= 20; // 扣 20 点起床气
        }
        
        const updatedEnergySystem = {
            ...oldEnergySystem,
            current: Math.round(Math.max(0, Math.min(oldEnergySystem.max, newEnergyValue))),
            status: finalEnergyStatus,
            lastUpdate: Date.now(),
        };

// ==================== [代码替换开始] 偏执狂版 HEF 更新 (防重置) ====================
        // 5. ★ 更新 HEF 情绪 (深度保护模式)
        
        // A. 先完整克隆一份旧的 HEF，确保所有深层数据都在
// (使用 JSON parse/stringify 是最安全的深拷贝方式，防止引用丢失)
let updatedHef = c.hef ? JSON.parse(JSON.stringify(c.hef)) : {};

// B. 确保骨架存在 (防止 undefined 报错)
if (!updatedHef.INDIVIDUAL_VARIATION) updatedHef.INDIVIDUAL_VARIATION = {};
if (!updatedHef.INDIVIDUAL_VARIATION.personality_big5) {
    // 如果真的没有数据，才填入默认值，否则绝对不动它
    updatedHef.INDIVIDUAL_VARIATION.personality_big5 = {
        openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5
    };
}
// C. 小心翼翼地合并 AI 返回的数据
if (hefUpdateData) {
    // 1. 只更新基础情绪 (Joy, Anger...)
    // 我们遍历 AI 返回的 key，只有当它是基础情绪时才更新，防止它覆盖掉整个结构
    ['joy', 'anger', 'sadness', 'fear', 'trust'].forEach(emotionKey => {
        if (typeof hefUpdateData[emotionKey] === 'number') {
            updatedHef[emotionKey] = hefUpdateData[emotionKey];
        }
    });
    // 2. 强制忽略 personality_big5 的更新（防止AI乱改五大人格）
    if (hefUpdateData.personality_big5) {
        console.warn("🔒 [系统] 检测到AI试图修改personality_big5，已强制忽略以保护用户设置。");
        // 不做任何更新
    }
   
    // ★ 特别修正：防止 AI 把 personality_big5 放在了 hef_update 的根目录下
    // 有时候 AI 会发 { joy: 50, personality_big5: {...} }，我们要兼容这种情况
    // (这段代码确保了即使结构略有偏差，也能正确更新)
}

// D. 情绪上下限保护 (0-100)
['joy', 'anger', 'sadness', 'trust', 'fear'].forEach((key) => {
     if (typeof updatedHef[key] === 'number') {
         updatedHef[key] = Math.max(0, Math.min(100, updatedHef[key]));
     }
});
        // ==================== [代码替换结束] ====================

        return { 
          ...c, 
          history: [...currentHistory, ...newMessages], 
          unread: newUnreadCount, 
          affectionScore: newScore,
// 这是一组代码：替换 return 对象，增加 mood 的更新
relationshipStatus: newStatus,
mood: { ...c.mood, energy: updatedEnergySystem },
          hef: updatedHef // 写入新的 HEF
        };
      }
      return c;
    }));
    // ==================== [代码替换结束] ====================
    






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






const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 创建图片读取器
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // 创建画布进行压缩
        const canvas = document.createElement('canvas');
        // 设置最大宽度（例如 800px），防止图片过大
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject("Canvas error"); return; }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // 核心：压缩质量 0.6 (60%质量)，转为 jpeg
        // 这样一张 5MB 的图会被压缩到 50KB 左右，再也不会崩了！
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressedDataUrl);
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
    if (messagesEndRef.current) {
      // 1. 优先尝试 scrollIntoView (最稳)
      messagesEndRef.current.scrollIntoView({ behavior });
      
      // 2. 双重保险：直接操纵 scrollTop
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  };












const VoiceBubble: React.FC<{
  msg: Message;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onPlay: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUser: boolean;
}> = ({ msg, isPlaying, progress, duration, onPlay, isUser }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const rawContent = msg.content.replace(/^>.*?\n\n/, '').replace(/^\[Voice Message\]\s*/i, '');
  const translationText = rawContent;
  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };
  const totalDuration = msg.voiceDuration || duration || 10;
  const safeDuration = totalDuration > 0 ? totalDuration : 10;
  const progressPercent = safeDuration > 0 ? (progress / safeDuration) * 100 : 0;
  return (
    <div className="flex flex-col min-w-[180px] max-w-[260px]">
      <div
        className={`flex items-center gap-3 select-none py-2 px-3 rounded-lg group transition-all ${isUser ? '' : 'cursor-pointer'}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!isUser) onPlay();
          else setShowTranslation(!showTranslation);
        }}
      >
        <span className={`font-bold text-lg ${isUser ? 'text-gray-400' : 'text-blue-500'}`}>
          {isUser ? '▶' : (isPlaying ? '❚❚' : '▶')}
        </span>
        <div className="flex-1 h-1 bg-black/10 rounded-full relative">
          {!isUser && <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>}
          {isUser && <div className="h-full bg-gray-400 rounded-full w-[70%]"></div>}
        </div>
        <span className={`text-xs font-mono shrink-0 ${isUser ? 'text-gray-400' : 'text-blue-500/80'}`}>
          {formatTime(safeDuration)}
        </span>
      </div>
      {!isUser && (
        <div
          className="text-center text-[10px] text-gray-400 mt-1 cursor-pointer hover:text-gray-600"
          onClick={(e) => { e.stopPropagation(); setShowTranslation(!showTranslation); }}
        >
          {showTranslation ? '— 收起文本 —' : '...'}
        </div>
      )}
      {showTranslation && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-sm leading-relaxed animate-slideDown text-gray-600">
          <HiddenBracketText content={translationText} fontSize="text-sm" />
          <div className="text-[10px] mt-1 italic opacity-60">
            {showTranslation ? "— 点击气泡收起 —" : ""}
          </div>
        </div>
      )}
    </div>
  );
};
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
}












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









// ★★★ 修复：接收 playMessageAudio 参数 ★★★
// ★★★ 修复：接收 onNavigateToSettings 参数，用于跳转 ★★★
// ★★★ 修复：面板现在接收外部传进来的 Tab 和 Text，防止刷新重置 ★★★
const PersonaPanel = ({ 
  contact, 
  onClose, 
  onRefineMemory, 
  globalSettings = {}, 
  setContacts, 
  playMessageAudio, 
  onNavigateToSettings, 
  activeTab,      // 接收父组件给的 Tab
  setActiveTab,   // 接收父组件的修改函数
  sampleText,     // 接收父组件给的 Text
  setSampleText   // 接收父组件的修改函数
}: any) => {
  // 注意：这里删掉了原来的 useState('emotion') 和 useState("")，因为改用 props 了
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedMemIds, setSelectedMemIds] = useState<string[]>([]);


// ★★★ 新增：当前正在查看的标签（用于弹窗） ★★★
  const [viewingTag, setViewingTag] = useState<any>(null);

  // ★★★ 核心修复：正确读取新的 mood 结构 ★★★
  const mood = contact?.mood || { current: "Calm" };
  // 优先读取新的 energy 对象，没有则兜底
  const energy = mood.energy || { current: 50, max: 100, status: 'Awake' };
  
  const longTermMemories = contact?.longTermMemories || [];
  const hef = contact?.hef || {};
  const iv = hef.INDIVIDUAL_VARIATION || {};
  const big5 = iv.personality_big5 || { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };


// ==================== [代码替换开始] 升级版雷达图 (带文字标签+网格) ====================
  const renderRadar = () => {
    // 辅助函数：计算雷达图坐标 (中心 50,50，半径最大 40)
    // 0-10分 映射到 0-40px 的半径距离
    const getPoint = (value: number, angle: number) => {
      const val = Math.max(0, Math.min(10, value || 5)); // 确保数值在 0-10 之间
      const radius = (val / 10) * 40; 
      // 减90度是为了让第一个点(开放性)在正上方
      const x = 50 + radius * Math.cos((angle - 90) * Math.PI / 180);
      const y = 50 + radius * Math.sin((angle - 90) * Math.PI / 180);
      return `${x},${y}`;
    };

    // 五个维度的角度分布 (正五边形)
    // 开放性(Top), 外向性(Right-Top), 宜人性(Right-Bottom), 敏感度(Left-Bottom), 尽责性(Left-Top)
    const p1 = getPoint(big5.openness, 0);   // 开放性
    const p2 = getPoint(big5.extraversion, 72); // 外向性
    const p3 = getPoint(big5.agreeableness, 144); // 宜人性
    const p4 = getPoint(big5.neuroticism, 216); // 敏感度 (神经质)
    const p5 = getPoint(big5.conscientiousness, 288); // 尽责性

    return (
      <div className="relative w-full h-64 flex items-center justify-center my-2 select-none">
        
        {/* === 文字标签层 (绝对定位) === */}
        {/* 正上方 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">开放性</span>
          <span className="text-[9px] text-blue-400 font-mono">{big5.openness}</span>
        </div>
        
        {/* 右上方 */}
        <div className="absolute top-16 right-6 flex flex-col items-center">
          <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">外向性</span>
          <span className="text-[9px] text-blue-400 font-mono">{big5.extraversion}</span>
        </div>

        {/* 右下方 */}
        <div className="absolute bottom-8 right-10 flex flex-col items-center">
          <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">宜人性</span>
          <span className="text-[9px] text-blue-400 font-mono">{big5.agreeableness}</span>
        </div>

        {/* 左下方 */}
        <div className="absolute bottom-8 left-10 flex flex-col items-center">
          <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">敏感度</span>
          <span className="text-[9px] text-blue-400 font-mono">{big5.neuroticism}</span>
        </div>

        {/* 左上方 */}
        <div className="absolute top-16 left-6 flex flex-col items-center">
          <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur">尽责性</span>
          <span className="text-[9px] text-blue-400 font-mono">{big5.conscientiousness}</span>
        </div>


        {/* === 图表容器 (SVG) === */}
        <div className="w-40 h-40 relative">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100">
             {/* 🕸️ 背景网格 (蜘蛛网) */}
             {/* 最外圈 (10分边界) */}
             <polygon points="50,10 88,38 74,82 26,82 12,38" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
             {/* 中间圈 (5分基准线) */}
             <polygon points="50,30 69,44 62,66 38,66 31,44" fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2" />
             
             {/* 🕸️ 从中心放射出的骨架线 */}
             <line x1="50" y1="50" x2="50" y2="10" stroke="#e5e7eb" strokeWidth="0.5" />
             <line x1="50" y1="50" x2="88" y2="38" stroke="#e5e7eb" strokeWidth="0.5" />
             <line x1="50" y1="50" x2="74" y2="82" stroke="#e5e7eb" strokeWidth="0.5" />
             <line x1="50" y1="50" x2="26" y2="82" stroke="#e5e7eb" strokeWidth="0.5" />
             <line x1="50" y1="50" x2="12" y2="38" stroke="#e5e7eb" strokeWidth="0.5" />

             {/* 📊 核心数据区域 (蓝色半透明) */}
             <polygon
               points={`${p1} ${p2} ${p3} ${p4} ${p5}`}
               fill="rgba(59, 130, 246, 0.4)"
               stroke="#3b82f6"
               strokeWidth="2"
               className="drop-shadow-sm transition-all duration-700 ease-out"
             />
             
             {/* 📍 顶点的圆点装饰 */}
             <circle cx={p1.split(',')[0]} cy={p1.split(',')[1]} r="1.5" fill="#2563eb" />
             <circle cx={p2.split(',')[0]} cy={p2.split(',')[1]} r="1.5" fill="#2563eb" />
             <circle cx={p3.split(',')[0]} cy={p3.split(',')[1]} r="1.5" fill="#2563eb" />
             <circle cx={p4.split(',')[0]} cy={p4.split(',')[1]} r="1.5" fill="#2563eb" />
             <circle cx={p5.split(',')[0]} cy={p5.split(',')[1]} r="1.5" fill="#2563eb" />
          </svg>
        </div>
      </div>
    );
  };
  // ==================== [代码替换结束] ====================
  const toggleSelect = (id: string) => {
    setSelectedMemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
              <p className="text-[10px] text-gray-400">Soul Interface</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-100 m-4 rounded-xl">
          {['emotion', 'persona', 'memory'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize ${activeTab === t ? 'bg-white text-blue-600 shadow' : 'text-gray-400'}`}>
              {t === 'emotion' ? '❤️ 情绪' : t === 'persona' ? '🧬 人格' : '🧠 记忆'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 这是一组代码：修复版情绪面板 (解决“睁眼说瞎话”的显示Bug) */}
          {activeTab === 'emotion' && (
            <div className="space-y-6 animate-fadeIn">
<div className="text-center">
                <div className="text-6xl mb-2 transition-transform hover:scale-110 duration-300 cursor-default">
                  {/* ★★★ 调用炼金术显示精准表情 ★★★ */}
                  {(() => {
                     // 简单提取 HEF 数据用于显示
                     const hefData = contact?.hef || {}; 
                     // 注意：这里假设 hefData 里直接有 joy, anger 等。如果是在深层结构，需要自己取一下
                     // 比如: const emotions = contact?.hef?.current_emotions || contact?.hef;
                     
                     const state = calculateComplexState(
                        energy, 
                        // 这里传入整个 hef 对象，确保 calculateComplexState 能读到 joy/anger
                        contact?.hef 
                     );
                     return state.emoji;
                  })()}
                </div>
                
                {/* 标题文字也同步 */}
                <h3 className="text-xl font-bold text-gray-800">
                  {/* 这里直接显示炼金术生成的文字，比如 "又累又气" */}
                  {calculateComplexState(energy, contact?.hef).text.split(' ')[0]}
                </h3>
                
                <span className={`text-xs font-bold px-2 py-1 rounded-full mt-1 inline-block ${
                   (contact?.affectionScore ?? 50) < 0 ? 'bg-gray-200 text-gray-600' : 'bg-pink-100 text-pink-600'
                }`}>
                   {contact?.relationshipStatus || 'Friend'}
                </span>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-2xl space-y-5 shadow-sm">
                
                {/* 能量条区域 */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span className="flex items-center gap-1">
                        ⚡ 能量 
                        {/* 状态标签 */}
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

                {/* 好感度条 */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-gray-500">❤️ 好感度</span>
                    <span className={(contact?.affectionScore ?? 50) < 0 ? "text-gray-600" : "text-pink-500"}>
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




{/* 3. ★★★ 核心玩法：时光印象绳索 (含时间戳 + 备注详情) ★★★ */}
              <div className="mt-4 relative">
                 <div className="flex justify-between items-end mb-2 px-1">
                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                       🏷️ 印象轨迹 (Impression Timeline)
                    </h3>
                    <button 
onClick={() => {
                         const newTagContent = prompt("挂一个新的印象标签 (AI会立刻收到系统通知):", "嘴硬心软");
                         if (newTagContent && newTagContent.trim()) {
                            const timestamp = Date.now();
                            const newTag = {
                               id: timestamp.toString(),
                               content: newTagContent.trim(),
                               timestamp: timestamp,
                               style: Math.random() * 10 - 5,
                               note: "" 
                            };
                            
                            // 兼容处理
                            const currentTags = Array.isArray(contact.userTags) ? contact.userTags : [];
                            
                            // 查重
                            if (!currentTags.some((t: any) => t.content === newTag.content)) {
                               setContacts((prev: any) => prev.map((c: any) => {
                                  if (c.id === contact.id) {
                                      // 1. 构建系统通知消息
                                      const sysMsg: Message = {
                                          id: "sys_" + timestamp,
                                          role: 'system', // ★★★ 关键：这是系统消息，不是你发的，也不是AI发的
                                          content: `【系统通知】用户刚刚在你的印象墙上挂了一个新标签：[${newTag.content}]`,
                                          timestamp: timestamp
                                      };
                                      
                                      // 2. 同时更新：标签列表 + 聊天记录
                                      return { 
                                          ...c, 
                                          userTags: [...currentTags, newTag],
                                          history: [...c.history, sysMsg] // 把通知塞进聊天记录！
                                      };
                                  }
                                  return c;
                               }));
                               
                               // 这里的 alert 可以去掉，因为聊天界面会有显示
                               // alert("标签已挂上，系统已通知 AI！"); 
                            }
                         }
                      }}
                      className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold hover:bg-blue-100 transition shadow-sm"
                    >
                      + 挂新标签
                    </button>
                 </div>

                 {/* 绳索容器 */}
                 <div className="w-full bg-gray-50/50 border-y border-gray-200 h-36 relative overflow-x-auto overflow-y-hidden custom-scrollbar">
                    
                    {/* 麻绳线条 */}
                    <div className="absolute top-4 left-0 w-[200%] h-0.5 bg-yellow-700/30 border-t border-yellow-800/20 shadow-sm z-0"></div>

                    <div className="flex items-start gap-6 px-6 pt-3 min-w-max h-full">
                        {(!contact.userTags || contact.userTags.length === 0) && (
                           <div className="text-[10px] text-gray-400 italic mt-8 ml-4">
                              绳子上空空如也，快挂上你的第一印象吧...
                           </div>
                        )}

                        {/* 渲染挂着的标签 */}
                        {(contact.userTags || []).map((tag: any, i: number) => {
                           const isObj = typeof tag === 'object';
                           const content = isObj ? tag.content : tag;
                           const rotation = isObj ? (tag.style || 0) : 0;
                           // ★★★ 时间显示优化：月/日 ★★★
                           const dateObj = isObj ? new Date(tag.timestamp) : new Date();
                           const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
                           
                           const colors = [
                             "bg-yellow-100 text-yellow-900 border-yellow-200", 
                             "bg-rose-100 text-rose-900 border-rose-200", 
                             "bg-sky-100 text-sky-900 border-sky-200",
                             "bg-emerald-100 text-emerald-900 border-emerald-200"
                           ];
                           const colorClass = colors[i % colors.length];

                           return (
                             <div 
                               key={isObj ? tag.id : i} 
                               className="relative group flex flex-col items-center flex-shrink-0 cursor-pointer hover:z-20"
                               style={{ transform: `rotate(${rotation}deg)`, marginTop: `${Math.abs(rotation) + 10}px` }}
                               onClick={() => setViewingTag(tag)} // ★★★ 点击打开详情弹窗 ★★★
                             >
                                {/* 木夹子 */}
                                <div className="w-2 h-4 bg-amber-700 rounded-sm mb-[-6px] z-20 shadow-md relative border-l border-white/20"></div>

                                {/* 标签纸 */}
                                <div className={`relative ${colorClass} border px-3 pt-3 pb-5 min-w-[70px] max-w-[110px] text-center shadow-lg transition-transform hover:scale-110 hover:rotate-0 z-10 flex flex-col justify-between min-h-[80px]`} 
                                     style={{ borderRadius: "2px 2px 20px 2px" }}> {/* 稍微卷角 */}
                                   
                                   <span className="text-sm font-black leading-tight break-words font-sans mb-2">
                                     {content}
                                   </span>
                                   
                                   {/* ★★★ 显性时间戳 (像邮戳一样印在下面) ★★★ */}
                                   <div className="mt-auto pt-2 border-t border-black/10 w-full flex justify-end">
                                      <span className="text-[9px] font-mono opacity-60 tracking-tighter">{dateStr}</span>
                                   </div>

                                   {/* 有备注的小红点提示 */}
                                   {tag.note && (
                                     <div className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full"></div>
                                   )}
                                </div>
                             </div>
                           );
                        })}
                    </div>
                 </div>

                 {/* ★★★ 标签详情弹窗 (Modal) ★★★ */}
                 {viewingTag && (
                   <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingTag(null)}>
                      <div className="bg-white w-[85%] max-w-xs rounded-2xl shadow-2xl p-5 animate-scaleIn transform transition-all" onClick={e => e.stopPropagation()}>
                         
                         {/* 标题 */}
                         <div className="text-center mb-4">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">TAG DETAILS</span>
                            <h3 className="text-2xl font-black text-gray-800 mt-1">#{viewingTag.content}</h3>
                            <p className="text-[10px] text-gray-400 font-mono mt-1">
                               Created on {new Date(viewingTag.timestamp).toLocaleString()}
                            </p>
                         </div>

                         {/* 备注输入区 */}
                         <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 mb-4 relative">
                            <label className="text-[9px] font-bold text-yellow-700 uppercase mb-1 block">
                               📝 为什么会有这个印象？(备注)
                            </label>
                            <textarea
                               className="w-full bg-transparent text-sm text-gray-700 outline-none resize-none h-20 placeholder-yellow-300/50"
                               placeholder="写点什么... AI会看到哦"
                               value={viewingTag.note || ""}
                               onChange={(e) => {
                                  // 实时更新 state (有点hacky但有效)
                                  setViewingTag({ ...viewingTag, note: e.target.value });
                               }}
                            />
                         </div>

                         {/* 按钮组 */}
                         <div className="flex gap-2">
               
                              <button 
                               onClick={() => {
                                  // 1. 准备一条系统通知，把备注内容大声告诉 AI
                                  const timestamp = Date.now();
                                  const noteContent = viewingTag.note ? viewingTag.note : "无";
                                  
                                  const sysMsg: Message = {
                                      id: "sys_note_" + timestamp,
                                      role: 'system',
                                      // ★★★ 关键：把备注内容写进系统通知里 ★★★
                                      content: `【系统通知】用户更新了对标签 [${viewingTag.content}] 的详细备注：\n“${noteContent}”\n(指令：这是用户对你产生该印象的具体原因，请在接下来的对话中针对这个原因进行互动)`,
                                      timestamp: timestamp
                                  };

                                  // 2. 同时更新：标签数据 + 聊天记录
                                  setContacts((prev: any) => prev.map((c: any) => {
                                     if (c.id === contact.id) {
                                        return { 
                                           ...c, 
                                           userTags: c.userTags.map((t: any) => t.id === viewingTag.id ? viewingTag : t),
                                           history: [...c.history, sysMsg] // 插入聊天记录
                                        };
                                     }
                                     return c;
                                  }));
                                  
                                  setViewingTag(null);
                               }}
                               className="flex-1 bg-gray-900 text-white py-2 rounded-xl font-bold text-xs hover:bg-gray-700 transition"
                            >
                               保存备注
                            </button>
                            <button 
                               onClick={() => {
                                  if(confirm("确定要摘下这个标签吗？")) {
                                     setContacts((prev: any) => prev.map((c: any) => 
                                        c.id === contact.id ? { ...c, userTags: c.userTags.filter((t: any) => t.id !== viewingTag.id) } : c
                                     ));
                                     setViewingTag(null);
                                  }
                               }}
                               className="flex-1 bg-red-100 text-red-500 py-2 rounded-xl font-bold text-xs"
                            >
                               摘掉
                            </button>
                         </div>
                      </div>
                   </div>
                 )}
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






          {activeTab === 'memory' && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-gray-600">🧠 长期记忆便签墙</h4>
                <span className="text-xs text-gray-400">{longTermMemories.length} 张便签</span>
              </div>

              {/* 多选控制栏 */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => {
                    setIsMultiSelect(!isMultiSelect);
                    if (isMultiSelect) setSelectedMemIds([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm ${isMultiSelect ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  {isMultiSelect ? '✓ 完成选择' : '☑️ 多选合并'}
                </button>
                {isMultiSelect && selectedMemIds.length >= 2 && (
                  <button
                    onClick={handleMultiMerge}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm shadow hover:bg-purple-600 transition"
                  >
                    🔄 合并 {selectedMemIds.length} 张
                  </button>
                )}
              </div>

              {/* 便签列表 */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                {longTermMemories.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">
                    <span className="text-4xl mb-4 block">📝</span>
                    <p className="text-sm">还没有形成长期记忆哦</p>
                    <p className="text-xs mt-2">多聊一会儿就会自动总结啦～</p>
                  </div>
                ) : (
                  longTermMemories.slice().reverse().map((mem: any, idx: number) => (
                    <MemoryNote
                      key={mem.id || idx}
                      mem={mem}
                      idx={idx}
                      total={longTermMemories.length}
                      contact={contact}
                      setContacts={setContacts}
                      isMultiSelect={isMultiSelect}
                      isSelected={selectedMemIds.includes(mem.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))
                )}
              </div>

              {/* 底部一键精炼（已优化） */}
              <div className="mt-4 pb-4">
                {longTermMemories.length >= 2 && (
                  <button
                    onClick={onRefineMemory}
                    className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition active:scale-95"
                  >
                    🔄 精炼全部记忆（合并成核心记忆）
                  </button>
                )}
              </div>
            </div>
          )}
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






  useEffect(() => {
    // 如果视图是聊天，且 ID 对应的角色在联系人列表里找不到
    if (view === 'chat' && activeContactId && !contacts.find(c => c.id === activeContactId)) {
      console.log("当前角色已消失，自动返回列表");
      setActiveContactId(null);
      setView('list');
    }
  }, [contacts, activeContactId, view]);





useEffect(() => {
  contacts.forEach(contact => {
    // 如果这个角色被标记了“待发送”，并且还没有被正在处理（防止重复）
    if (contact.pendingProactive) {
       // 为了防止快速重复触发，我们可以在这里做一个简单的防抖，或者依靠 setContacts 的原子性
       // 这里直接调用，因为我们在 scheduleProactiveMessage 里清除了标记
       scheduleProactiveMessage(contact);
    }
  });
}, [contacts]); // 只要 contacts 变了，就检查一下有没有任务




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




 


  useLayoutEffect(() => {
    if (view === 'chat') {
      // 这里的 setTimeout 是关键！让浏览器先把页面画好，稍微等 10ms 再滚，防止滚早了高度不对。
      setTimeout(() => {
        scrollToBottom('auto'); // 瞬间跳到底部，不要动画 (防晕)
      }, 10);
    }
  }, [
    activeContact?.history, // 1. 有新消息时
    isAiTyping,             // 2. AI 正在输入时
    view,                   // 3. ★★★ 关键：刚切进聊天页面时
    activeContactId         // 4. ★★★ 关键：切换联系人时
  ]);


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

          {/* 收藏夹 */}
{navTab === 'favorites' && (
  <div className="flex flex-col min-h-full bg-gray-50">
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
    <div className="flex-1 p-4 space-y-4">
      {favorites.filter(f => activeFavCategory === "全部" || f.category === activeFavCategory).map((item) => (
        <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative group animate-slideUp">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src={item.avatar} className="w-8 h-8 rounded-full object-cover border border-gray-100" alt="avatar" />
              <div>
                <div className="font-bold text-xs text-gray-700">{item.contactName}</div>
                <div className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
            <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-1 rounded-lg font-bold">
              #{item.category} {item.isPackage ? `(${item.messages?.length}条)` : ''}
            </span>
          </div>
          <div className="space-y-2">
            {/* 如果是打包收藏，循环显示所有消息 */}
            {(item.isPackage ? item.messages : [item.msg]).filter(Boolean).map((m, i) => (
              <div key={i} className="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 leading-relaxed font-mono">
                {m?.content?.replace(/^>.*?\n\n/, '').replace(/\[.*?\]/g, '') || '空消息'}
              </div>
            ))}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setFavorites(prev => prev.filter(f => f.id !== item.id)); }} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
        </div>
      ))}
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



      {showWorldBookModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-h-[70%] rounded-2xl flex flex-col shadow-2xl animate-scaleIn">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">📚 Select Lorebooks</h3>
              <button onClick={() => setShowWorldBookModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {worldBooks.map(wb => (
                <div
                  key={wb.id}
                  onClick={() => toggleWorldBook(wb.name)}
                  className={`p-4 mb-2 rounded-xl border flex items-center justify-between cursor-pointer transition ${enabledBooks.includes(wb.name) ? 'bg-orange-50 border-orange-400' : 'bg-white border-gray-200'}`}
                >
                  <span className="font-bold text-sm">{wb.name}</span>
                  {enabledBooks.includes(wb.name) && <span className="text-orange-500 font-bold">✓</span>}
                </div>
              ))}
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




{/* ==================== [修改版] 硬核好感度初始化 (-100 ~ 100) ==================== */}
          <div className="mt-6 bg-rose-50 p-4 rounded-xl border border-rose-100 animate-slideDown relative overflow-hidden">
            {/* 锁定后的遮罩层 */}
            {form.isAffectionLocked && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center select-none">
                <div className="text-4xl mb-2">🔒</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  RELATIONSHIP LOCKED
                </div>
                <div className="text-[10px] text-rose-400 mt-1 font-bold">
                  命运的齿轮已经转动，无法再回头修改初始值
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">❤️</span>
                <div>
                  <h3 className="text-xs font-bold text-rose-600 uppercase">初始羁绊校准</h3>
                  <p className="text-[9px] text-rose-400">范围扩大：-100 (死仇) ~ 100 (挚爱)</p>
                </div>
              </div>
              
        {/* AI 分析按钮 (带Loading效果版) */}
              {!form.isAffectionLocked && (
                <button
                  disabled={isAnalyzing} // 分析时禁用点击
                  onClick={async () => {
                    const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
                    if (!activePreset) return alert("请先配置 API！");
                    
                    const confirmAnalyze = confirm("🔮 让 AI 读取双方人设和世界书，来判定一个科学的初始分吗？");
                    if (!confirmAnalyze) return;

                    // ★★★ 开始加载 ★★★
                    setIsAnalyzing(true);
                    
                    try {
                      // 1. 制造一些假进度，增加仪式感
                      setLoadingText("正在读取双方人设...");
                      await new Promise(r => setTimeout(r, 800)); // 假装读了0.8秒
                      
                      setLoadingText("正在扫描世界书与背景...");
                      await new Promise(r => setTimeout(r, 800)); 

                      setLoadingText("正在推演初始关系逻辑...");
                      
                      // 2. 准备数据
                      const charP = form.persona || "";
                      const userP = (form.userName || "User") + ":" + (form.userPersona || "无");
                      const lore = (form.enabledWorldBooks || []).join(",");
                      
                      // ★★★ 修改了这里的 Prompt 评分标准 ★★★
                      const prompt = `
你是一位资深的小说情感逻辑专家。请分析以下两个角色的设定，判断他们在故事开始时，合理的“初始好感度”是多少。

【角色A (AI)】: ${charP}
【角色B (用户)】: ${userP}
【世界背景】: ${lore}

**评分标准 (范围 -100 到 +100)：**
- **-100 ~ -50**: 【死对头/血海深仇/极度厌恶】(见面想杀对方，恨之入骨)
- **-50 ~ -10**: 【讨厌/排斥/警惕】(不想看到对方，有偏见)
- **-10 ~ 10**: 【陌生人/完全不认识】(毫无波澜，纯路人)
- **10 ~ 30**: 【普通相识/礼貌】(点头之交，客气)
- **30 ~ 50**: 【稍微感兴趣/朋友】(可以正常聊天)
- **50 ~ 75**: 【好感/暧昧/知己】(喜欢和对方待在一起)
- **75 ~ 90**: 【热恋/深爱/青梅竹马】(非你不可)
- **90 ~ 100**: 【灵魂伴侣/至死不渝】(设定的最终形态)

请输出纯 JSON:
{
  "score": 整数 (可以是负数),
  "reason": "一句话理由，禁止矫揉造作肉麻恶心"
}`;
                    // 真正的 API 请求
                      const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
                      
                      setLoadingText("正在生成最终判定...");
                      const jsonMatch = res.match(/\{[\s\S]*\}/);
                      
                      if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        setEditForm(prev => ({ ...prev, affectionScore: result.score }));
                        
                        // 稍微停顿一下让用户看到完成状态
                        await new Promise(r => setTimeout(r, 500));
                        alert(`🔮 命运判定完成！\n\n初始好感: ${result.score}\n理由: ${result.reason}`);
                      }
                    } catch (e) {
                      console.error(e);
                      alert("分析失败，AI 开小差了");
                    } finally {
                      // ★★★ 结束加载 ★★★
                      setIsAnalyzing(false);
                    }
                  }}
                  className="bg-white border border-rose-200 text-rose-500 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm hover:bg-rose-100 transition flex items-center gap-1"
                >
                  {isAnalyzing ? (
                    <>
                       <span className="animate-spin">⏳</span> 分析中...
                    </>
                  ) : (
                    <>🔮 AI 判定命运</>
                  )}
                </button>
              )}
 </div> 


            {/* 滑块区域 */}
            <div className="flex items-center gap-3 mb-2">
              {/* 显示分数的颜色变化：负分红色，正分粉色 */}
              <span className={`text-xs font-bold w-10 text-right ${(editForm.affectionScore || 50) < 0 ? 'text-red-600' : 'text-rose-600'}`}>
{form.affectionScore ?? 50}
              </span>
              <div className="flex-1">
                <input
                  type="range"
                  // ★★★ 修改这里：最小值改为 -100 ★★★
                  min="-100" 
                  max="100"
                  step="1"
                  disabled={!!form.isAffectionLocked}
value={form.affectionScore ?? 50}
                  onChange={(e) => setEditForm(prev => ({ ...prev, affectionScore: parseInt(e.target.value) }))}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${form.isAffectionLocked ? 'bg-gray-200' : 'bg-gradient-to-r from-red-200 via-gray-200 to-rose-200 accent-rose-500'}`}
                />
              </div>
            </div>
            
            {/* 刻度提示更新 */}
            <div className="flex justify-between text-[9px] text-gray-400 mb-4 px-1">
              <span className="text-red-400">☠️ 死仇 (-100)</span>
              <span>😐 路人 (0)</span>
              <span className="text-rose-400">❤️ 挚爱 (100)</span>
            </div>

            {/* 锁定按钮 */}
            {!form.isAffectionLocked ? (
              <button
                onClick={() => {
                  if (confirm(`⚠️ 警告：确定以【${editForm.affectionScore || 50}分】开始这段关系吗？\n\n一旦锁定，这就是你们的起跑线！`)) {
                    setEditForm(prev => ({ ...prev, isAffectionLocked: true }));
                  }
                }}
                className="w-full py-2 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-lg text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition"
              >
                🔒 锁定初始值 (开启养成之旅)
              </button>
            ) : (
              <div className="text-center">
                 <div className="inline-block bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[10px] border border-gray-200">
                   ✅ 已锁定 · 祝你好运
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
              onClick={() => setShowWorldBookModal(true)}
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
            <div className="space-y-4 pt-2 border-t border-gray-100 animate-slideDown">
              <div className="mb-2 px-2">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                  <span>最小间隔（分钟）</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-16 text-right font-bold text-blue-600 bg-gray-100 rounded-md p-1 outline-none focus:ring-2 focus:ring-blue-300"
                      value={form.proactiveConfig?.minGapMinutes || 480}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        proactiveConfig: { ...(form.proactiveConfig || {}), minGapMinutes: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span>分钟</span>
                  </div>
                </div>
              </div>
              <div className="mb-2 px-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>每日上限（次）</span>
                  <span className="font-bold text-blue-600">{form.proactiveConfig?.maxDaily || 2} / 天</span>
                </div>
                <Slider
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={form.proactiveConfig?.maxDaily || 2}
                  onValueChange={(val) => setEditForm(prev => ({
                    ...prev,
                    proactiveConfig: { ...(form.proactiveConfig || {}), maxDaily: val }
                  }))}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-4 text-center bg-gray-50 p-2 rounded-lg">
                AI 将根据当前状态和聊天历史，自己决定说什么～
              </p>
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
                   value={form.bubbleColorUser || "#22c55e"} 
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
            <button
              onClick={handleClearChat}
              className="w-full bg-white text-red-500 py-3 rounded-xl font-bold border border-red-200 shadow-sm hover:bg-red-50 transition"
            >
              ⚠️ Delete All Chat History
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



        {/* ★★★ 全屏沉浸式加载遮罩 (Loading Overlay) ★★★ */}
        {isAnalyzing && (
          <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn cursor-wait">
            {/* 动画图标 */}
            <div className="relative mb-6">
               <div className="w-16 h-16 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
                 🔮
               </div>
            </div>
            
            {/* 动态文字 */}
            <h3 className="text-lg font-bold text-gray-800 mb-2 animate-pulse">
              AI 命运推演中
            </h3>
            <p className="text-xs text-rose-500 font-mono bg-rose-50 px-3 py-1 rounded-full border border-rose-100 transition-all duration-300">
              {loadingText}
            </p>
            
            <p className="text-[10px] text-gray-400 mt-8 absolute bottom-10">
              请稍候，正在连接情感逻辑核心...
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
    
    // =========================================================================
    // ★★★ 核心新增：系统消息渲染 (System Notification) ★★★
    // 处理 role === 'system' 或者内容包含"撤回"的消息
    // =========================================================================
    if (msg.role === 'system' || msg.content.includes("撤回了一条消息")) {
        // 提取显示文本
        let sysText = msg.content;
        // 如果是撤回消息的兼容处理
        if (msg.content.includes("撤回了一条消息") && msg.role !== 'system') {
             sysText = `${msg.role === 'user' ? '你' : `"${activeContact.name}"`} 撤回了一条消息`;
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
            
            {/* 系统消息 UI：居中灰色胶囊 */}
            <div className="flex justify-center my-3 animate-fadeIn">
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100/80 border border-gray-200 px-3 py-1.5 rounded-full select-none cursor-default flex items-center gap-1.5 shadow-sm backdrop-blur-sm">
                   <span className="text-blue-400">🔔</span>
                   <span>{sysText.replace('【系统通知】', '')}</span>
                </span>
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
    const userBg = activeContact.bubbleColorUser || '#22c55e';
    const aiBg = activeContact.bubbleColorAI || '#ffffff';
    const userTextColor = getContrastTextColor(userBg);
    const aiTextColor = getContrastTextColor(aiBg);
    const currentBg = msg.role === 'user' ? userBg : aiBg;
    const currentText = msg.role === 'user' ? userTextColor : aiTextColor;



 // ★★★ 核心修复：更聪明的引用检测 ★★★
    // 只要是以 > 开头（不管有没有空格），都算引用
    const isQuoteMsg = msg.content.trim().startsWith('>');
    
    // 提取引用文本和回复文本
    let quoteText = '';
    let replyText = msg.content;
    
    if (isQuoteMsg) {
        // 切割：第一部分是引用，剩下的是回复
        const parts = msg.content.split('\n'); 
        // 获取第一行作为引用内容（去掉开头的 > 和 引用 二字）
        quoteText = parts[0].replace(/^> ?(引用)? ?/, '').trim();
        // 剩下的行重新组合成回复
        replyText = parts.slice(1).join('\n').trim();
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
                  {msg.content.startsWith("> 引用") && (
                    <div className="text-xs mb-1 p-1 opacity-70 border-l-2 border-current pl-2">{msg.content.split('\n\n')[0]}</div>
                  )}
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
                  ) : msg.type === 'image' ? (
                    <img src={msg.content} className="rounded-lg max-w-full" alt="msg" />
                  ) : (
                    <HiddenBracketText content={msg.content.replace(/^>.*?\n\n/, '')} msgId={msg.id} fontSize={""} />
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
                onRefineMemory={handleRefineMemory}
                playMessageAudio={playMessageAudio}
                onNavigateToSettings={onOpenSettings} 
                activeTab={panelTab} // 保持由父组件控制
                setActiveTab={setPanelTab} // 保持由父组件控制
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