import React, { useState, useEffect, useRef } from 'react';
import ChatApp from './components/ChatApp';
import CoupleSpace from './components/CoupleSpace';
import SettingsApp from './components/SettingsApp';
import WorldBookApp from './components/WorldBookApp';
import WallpaperApp from './components/AppearanceApp';
import SafeAreaHeader from './components/SafeAreaHeader';  // ← 加这一行！
import localforage from 'localforage';
import { Contact, GlobalSettings, WorldBookCategory, Message } from './types';
console.log('React version:', React.version);  // 只应该打印一次

// ==================== 1. 辅助函数 & 初始数据 (必须放在组件外面！) ====================



// 初始联系人数据 (防崩底包)
const INITIAL_CONTACTS: Contact[] = [
  {
    id: '1',
    created: Date.now(),
    name: "Aria",
    avatar: "https://picsum.photos/200",
    persona: "Aria is a gentle but sometimes clingy artist.",
    memo: "My Artist GF",
    userName: "Darling",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    userPersona: "A supportive partner.",
    history: [{
      id: '1',
      role: 'assistant',
      content: "Hey! How is your day going?",
      timestamp: Date.now(),
      type: 'text'
    }],
    summary: "",
    mood: { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
    schedule: [],
    timezone: "Asia/Seoul",
    contextDepth: 20,
    summaryTrigger: 50,
    coupleSpaceUnlocked: false,
    enabledWorldBooks: [],
    voiceId: "female-shaonv-jingpin",
    playlist: [],
    hef: {},
    affectionScore: 60,
    relationshipStatus: 'Friend',
    aiDND: { enabled: false, until: 0 },
    interventionPoints: 0,
    longTermMemories: [],
    currentChatMode: 'Casual',
    customCSS: "",
    chatBackground: "",
    proactiveConfig: { enabled: true, minGapMinutes: 60, maxDaily: 5 } // 默认开启一点主动
  }
];

// 数据清洗函数
const sanitizeContact = (c: any): any => {
  const now = Date.now();
  return {
    ...c,
    mood: c.mood || { current: "Content", energyLevel: 80, lastUpdate: now },
    diaries: Array.isArray(c.diaries) ? c.diaries : [],
    questions: Array.isArray(c.questions) ? c.questions : [],
    letters: Array.isArray(c.letters) ? c.letters : [],
    coupleSpaceUnlocked: c.coupleSpaceUnlocked === true,
    name: c.name || "Unknown Character",
    history: Array.isArray(c.history) ? c.history : [],
    hef: c.hef || {},
    playlist: c.playlist || [],
    longTermMemories: Array.isArray(c.longTermMemories) ? c.longTermMemories : [],
    proactiveConfig: c.proactiveConfig || { enabled: false, minGapMinutes: 480, maxDaily: 2 }
  };
};

// 生命体征计算函数
const calculateLifeUpdate = (rawContact: Contact): Contact => {
  const contact = sanitizeContact(rawContact);
  const now = Date.now();
  const safeMood = contact.mood || { current: "Content", energyLevel: 80, lastUpdate: now };
  const lastUpdate = safeMood.lastUpdate || now;
  const minutesPassed = (now - lastUpdate) / 60000;

  if (minutesPassed < 1) return contact;

  let currentHour = 12;
  try {
    const timeFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: contact.timezone || "Asia/Seoul",
      hour: 'numeric',
      hour12: false
    });
    currentHour = parseInt(timeFormat.format(new Date()));
  } catch (e) {}

  let newEnergy = safeMood.energyLevel;
  let moodState = safeMood.current;
  const isSleepTime = currentHour >= 23 || currentHour < 7;

  if (isSleepTime) {
    newEnergy = Math.min(100, newEnergy + 2);
    moodState = "Sleeping";
  } else {
    newEnergy = Math.max(0, newEnergy - 0.5);
    if (newEnergy < 30) moodState = "Tired";
    else if (newEnergy > 80) moodState = "Energetic";
    else moodState = "Content";
  }

  return {
    ...contact,
    mood: {
      ...safeMood,
      current: moodState,
      energyLevel: parseFloat(newEnergy.toFixed(1)),
      lastUpdate: now
    }
  };
};

// ==================== 2. App 组件主体 ====================

const App: React.FC = () => {
  // --- 状态定义 ---
  const [globalNotification, setGlobalNotification] = useState<{
    type: 'proactive_thinking' | 'new_message';
    contactId: string;
    name: string;
    avatar: string;
    content?: string;
  } | null>(null);

  // ==================== 在这里粘贴新代码 ====================
const [homePageIndex, setHomePageIndex] = useState(0); // 0 代表第一页, 1 代表第二页
// =======================================================
  const [jumpToContactId, setJumpToContactId] = useState<string | null>(null);
  const [currentApp, setCurrentApp] = useState<'home' | 'chat' | 'coupleSpace' | 'settings' | 'worldbook' | 'wallpaper'>('home');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [worldBooks, setWorldBooks] = useState<WorldBookCategory[]>([]);
const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
  wallpaper: "https://images.unsplash.com/photo-1557683316-973673baf926",
  apiPresets: [],
  activePresetId: "",
  systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  appearance: { bubbleColorUser: '', bubbleColorAI: '', fontSize: 'text-sm', showStatusBar: true },
  themePresets: [],
  widgets: [  // ← 默认小组件（可自定义）
    { id: 'chat', icon: "https://picsum.photos/100", text: "Chat", url: "chat" },
    { id: 'couple', icon: "https://picsum.photos/100", text: "Couple", url: "coupleSpace" },
    { id: 'book', icon: "https://picsum.photos/100", text: "Book", url: "worldbook" },
    { id: 'theme', icon: "https://picsum.photos/100", text: "Theme", url: "wallpaper" },
    { id: 'settings', icon: "https://picsum.photos/100", text: "Settings", url: "settings" }
    
  ],
  photoFrames: [
    { id: 'top', photo: "https://picsum.photos/800/300?random=1" },
    { id: 'left', photo: "https://picsum.photos/400/400?random=2" },
     { id: 'polaroid-1', photo: "https://picsum.photos/200/200?random=3" },
  { id: 'polaroid-2', photo: "https://picsum.photos/200/200?random=4" },
  { id: 'polaroid-3', photo: "https://picsum.photos/200/200?random=5" }
  ],
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User"
});

  // --- 1. 强力加载逻辑 (防白屏核心) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("正在从数据库加载数据...");
        
        const [savedContacts, savedSettings, savedBooks] = await Promise.all([
          localforage.getItem<Contact[]>('contacts'),
          localforage.getItem<GlobalSettings>('globalSettings'),
          localforage.getItem<WorldBookCategory[]>('worldBooks')
        ]);


        // 恢复设置
// 恢复设置
if (savedSettings) {
  setGlobalSettings({
    ...savedSettings,
    // 强制补 photoFrames（如果旧数据没有，就用默认两个照片框）
    photoFrames: savedSettings.photoFrames || [
      { id: 'top', photo: "https://picsum.photos/800/300?random=1" },  // 大长方形
      { id: 'left', photo: "https://picsum.photos/400/400?random=2" }   // 小正方形
    ],
    avatar: savedSettings.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User"
    
  });
}

// 文件路径: src/App.tsx
// 位置：useEffect(() => { const loadData = async ... }, []); 里面的 `// 恢复联系人` 部分

        // 恢复联系人
        if (savedContacts === null) { // 情况1: 数据库里根本没有 contacts，这是第一次运行
          console.log("检测到是第一次运行，初始化默认角色");
          setContacts(INITIAL_CONTACTS);
        } else if (Array.isArray(savedContacts)) {
  if (savedContacts.length === 0) {
    console.log("数据库中无角色（用户已清空），显示空白列表");
    setContacts([]);
  } else {
    // 这里加强修复：强制加 proactiveConfig 默认值 + 清残留 pending
    const repaired = savedContacts.map(c => {
      const sanitized = sanitizeContact(c);
      return {
        ...sanitized,
        // 强制设置 proactiveConfig（如果没有，就给默认关闭）
        proactiveConfig: sanitized.proactiveConfig || {
          enabled: false,           // 默认关闭！防止没设置也发
          minGapMinutes: 480,
          maxDaily: 2
        },
        // 清掉任何残留的 pendingProactive 标记
        pendingProactive: false
      };
    });
    setContacts(repaired);
            console.log(`成功载入 ${repaired.length} 个角色`);
          }
        } else { // 情况3: savedContacts 存在但不是数组（数据损坏），进行恢复
          console.warn("Contacts数据损坏，重置为默认角色");
          setContacts(INITIAL_CONTACTS);
        }
        
        // 恢复设置
        if (savedSettings) setGlobalSettings(savedSettings);
        
        // 恢复世界书
        if (savedBooks) setWorldBooks(savedBooks);

      } catch (err) {
        console.error("严重错误：数据库读取失败", err);
        setContacts(INITIAL_CONTACTS);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);

  // --- 2. 强力存档逻辑 ---
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('contacts', contacts).catch(e => console.error("保存联系人失败", e));
    }
  }, [contacts, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('globalSettings', globalSettings).catch(console.error);
    }
  }, [globalSettings, isLoaded]);
  
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('worldBooks', worldBooks).catch(console.error);
    }
  }, [worldBooks, isLoaded]);

  // --- 3. 生命维持系统 ---
  useEffect(() => {
    const heartbeat = () => {
      setContacts(prev => prev.map(c => calculateLifeUpdate(c)));
    };
    const intervalId = setInterval(heartbeat, 60000); // 每分钟
    return () => clearInterval(intervalId);
  }, []);


// --- 4. 全局主动消息监视器 (最终单层版) ---
useEffect(() => {
  const checkProactiveMessages = () => {
  if (globalNotification || !isLoaded || contacts.length === 0 || currentApp !== 'home') {
    return;
  }

  let triggered = false;
  const updated = contacts.map(c => {
    // 1. 先清掉残留的 pending（防止开关关了还发）
    if (c.pendingProactive && !c.proactiveConfig?.enabled) {
      return { ...c, pendingProactive: false };
    }

    // 2. 严格检查开关
    const config = c.proactiveConfig || { enabled: false, minGapMinutes: 480, maxDaily: 2 };
    if (!config.enabled) return c; // 关了就绝对不发！（你原来有这行，但要确保 config 存在）

    // 3. 其他条件
    if (c.aiDND?.enabled || (c.affectionScore || 50) < 60) return c;

    const lastMsg = c.history[c.history.length - 1];
    const now = Date.now();
    const gapMinutes = lastMsg ? Math.floor((now - lastMsg.timestamp) / (1000 * 60)) : 99999;

    if (gapMinutes < config.minGapMinutes) return c;

    const today = new Date().toISOString().slice(0, 10);
    const sentToday = c.proactiveLastSent?.[today] || 0;
    if (sentToday >= config.maxDaily) return c;

    // 命中！
    console.log(`[App监视器] 命中! ${c.name} 准备发送主动消息 (间隔: ${gapMinutes}m)`);

    if (!triggered) {
      triggered = true;
      setGlobalNotification({
        type: 'proactive_thinking',
        contactId: c.id,
        name: c.name,
        avatar: c.avatar
      });
    }
    return { ...c, pendingProactive: true };
  });

  if (triggered) setContacts(updated);
};

  const intervalId = setInterval(checkProactiveMessages, 10000); // 每10秒检查一次
  return () => clearInterval(intervalId);
}, [contacts, isLoaded, globalNotification, currentApp]);

  // --- 5. 辅助函数 ---
  const updatePrimaryContact = (updater: (prev: Contact) => Contact) => {
    setContacts(prev => {
      if (prev.length === 0) return prev;
      const updated = updater(prev[0]);
      return [updated, ...prev.slice(1)];
    });
  };

  // --- 6. 渲染桌面 ---
// ==================== 从这里开始完整复制，覆盖旧的 renderHome 函数 ====================
const renderHome = () => {
  // 从 globalSettings 安全地获取数据
  const topFrame = globalSettings.photoFrames?.find(f => f.id === 'top')?.photo || "https://picsum.photos/800/300?random=1";
  const leftFrame = globalSettings.photoFrames?.find(f => f.id === 'left')?.photo || "https://picsum.photos/400/400?random=2";
  const avatar = globalSettings.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User";

  return (
    <div
      className="h-full w-full bg-cover bg-center text-white flex flex-col"
      style={{ backgroundImage: `url(${globalSettings.wallpaper})` }}
    >
      {/* ========== 1. 顶部状态栏 (模拟时间、信号) ========== */}
      <div 
        className="w-full flex justify-between items-center px-6 text-sm font-bold"
        style={{ paddingTop: `calc(env(safe-area-inset-top) + 8px)`, height: '44px' }}
      >
        <span>11:47</span>
        <div className="flex items-center gap-1">
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      {/* ========== 2. 主内容区 (填满剩余空间) ========== */}
      <div className="flex-1 flex flex-col">
        
        {/* ========== 3. 滑动容器 (核心) ========== */}
        <div 
          className="flex-1 w-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => {
            // 根据滚动位置判断当前在哪一页
            const scrollLeft = e.currentTarget.scrollLeft;
            const pageWidth = e.currentTarget.offsetWidth;
            const currentPage = Math.round(scrollLeft / pageWidth);
            if (currentPage !== homePageIndex) {
              setHomePageIndex(currentPage);
            }
          }}
        >
          {/* ===== 页面一 ===== */}
          <div className="w-full h-full flex-shrink-0 snap-center grid grid-rows-3 p-4 gap-4">
            {/* 区域 A: 顶部照片框 */}
            <div className="row-span-1 relative flex justify-center">
              <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-xl border-2 border-white/50">
                <img src={topFrame} className="w-full h-full object-cover" alt="Top Frame" />
                <label className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-lg font-bold">更换</span>
                  <input type="file" onChange={(e) => { /* ... 省略更换照片逻辑 ... */ }} className="hidden" accept="image/*"/>
                </label>
              </div>
              <label className="absolute -bottom-8 w-20 h-20 rounded-full overflow-hidden border-4 border-white/80 shadow-2xl cursor-pointer z-10">
                <img src={avatar} className="w-full h-full object-cover" alt="Avatar"/>
                <input type="file" onChange={(e) => { /* ... 省略更换头像逻辑 ... */ }} className="hidden" accept="image/*"/>
              </label>
            </div>

            {/* 区域 B: 中间组件 (左照片+右4图标) */}
            <div className="row-span-1 w-full flex items-center gap-4 pt-4">
              <div className="w-1/3 aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/60 relative">
                <img src={leftFrame} className="w-full h-full object-cover" alt="Left Frame" />
                <label className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                   <input type="file" onChange={(e) => { /* ... 省略更换照片逻辑 ... */ }} className="hidden" accept="image/*"/>
                </label>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                {/* ... 你的4个图标代码不变 ... */}
                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('chat')}>
                  <div className="w-14 h-14 bg-green-500/80 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">💬</div>
                  <span className="text-xs font-medium drop-shadow-md">Chat</span>
                </div>
                 <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('worldbook')}>
                  <div className="w-14 h-14 bg-orange-500/80 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">📕</div>
                  <span className="text-xs font-medium drop-shadow-md">Book</span>
                </div>
                 <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('coupleSpace')}>
                  <div className="w-14 h-14 bg-pink-500/80 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">❤️</div>
                  <span className="text-xs font-medium drop-shadow-md">Couple</span>
                </div>
                 <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('diary')}>
                  <div className="w-14 h-14 bg-blue-500/80 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">📖</div>
                  <span className="text-xs font-medium drop-shadow-md">Diary</span>
                </div>
              </div>
            </div>
            
            {/* 区域 C: 底部占位，留给最下面的图标 */}
            <div className="row-span-1"></div>
          </div>

          {/* ===== 页面二 ===== */}
          <div className="w-full h-full flex-shrink-0 snap-center p-4">
            <div className="w-full h-full flex justify-center items-start pt-16">
                {/* 这里放你的拍立得组件 */}
                <div className="flex justify-center items-center gap-2">
                    {globalSettings.photoFrames?.filter(f => f.id.includes('polaroid')).map((frame, index) => (
                      <label key={frame.id} className={`w-24 h-28 bg-white p-2 rounded-md shadow-lg border border-gray-200 cursor-pointer hover:scale-105 hover:shadow-2xl transition-transform duration-300 ${index === 0 ? '-rotate-6' : ''} ${index === 1 ? 'rotate-3 scale-110 z-10' : ''} ${index === 2 ? '-rotate-2' : ''}`}>
                        <img src={frame.photo || "https://picsum.photos/200/200"} className="w-full h-full object-cover" alt={`Polaroid ${index + 1}`} />
                        <input type="file" onChange={(e) => { /* ... 省略更换照片逻辑 ... */ }} className="hidden" accept="image/*"/>
                      </label>
                    ))}
                </div>
            </div>
          </div>
        </div>

        {/* ========== 4. 页面指示器 (小圆点) ========== */}
        <div className="w-full flex justify-center items-center gap-2 py-2">
          <div className={`w-2 h-2 rounded-full transition-all ${homePageIndex === 0 ? 'bg-white' : 'bg-white/30'}`}></div>
          <div className={`w-2 h-2 rounded-full transition-all ${homePageIndex === 1 ? 'bg-white' : 'bg-white/30'}`}></div>
        </div>

        {/* ========== 5. 底部 Dock 栏 (固定图标) ========== */}
        <div 
          className="w-full flex justify-center gap-12 py-4"
          style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 1rem)`}}
        >
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('settings')}>
            <div className="w-14 h-14 bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl shadow-lg group-hover:scale-110 transition-transform">⚙️</div>
            <span className="text-xs font-medium drop-shadow-md">Settings</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('wallpaper')}>
            <div className="w-14 h-14 bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl shadow-lg group-hover:scale-110 transition-transform">🎨</div>
            <span className="text-xs font-medium drop-shadow-md">Theme</span>
          </div>
        </div>
      </div>
    </div>
  );
};
// ==================== 复制粘贴到这里结束 ====================




  // ==================== 7. 主渲染 JSX ====================
// ========== 用这段新代码替换上面的一整块 ==========
return (
  // 直接让这个 div 成为 App 的根容器，占满整个屏幕
  <div className="h-screen w-screen bg-black flex flex-col overflow-hidden relative">
    {/* 我们删掉了外面的手机框和里面的刘海！ */}
    
    {/* 顶部弹窗通知 (这部分逻辑不变) */}
    {globalNotification && (
      <div
        onClick={() => {
          setJumpToContactId(globalNotification.contactId);
          setCurrentApp('chat');
          setGlobalNotification(null);
        }}
        className="absolute top-12 left-3 right-3 z-[999] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 flex items-center gap-3 cursor-pointer animate-slideDown active:scale-95 transition-transform duration-200"
        // ↓↓↓ 新增一个 style 来处理刘海屏，让通知往下移一点 ↓↓↓
        style={{ top: `calc(env(safe-area-inset-top, 0rem) + 1rem)` }}
      >
        <div className="relative">
          <img src={globalNotification.avatar} className="w-10 h-10 rounded-full object-cover border border-gray-200" alt="avatar" />
          {globalNotification.type === 'proactive_thinking' && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-full animate-ping"></span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sm text-gray-900 truncate">{globalNotification.name}</span>
            <span className="text-[10px] text-gray-400">刚刚</span>
          </div>
          {globalNotification.type === 'proactive_thinking' ? (
            <p className="text-xs text-blue-600 font-medium truncate flex items-center gap-1">
              <span>正在输入...</span><span className="animate-pulse">💬</span>
            </p>
          ) : (
            <p className="text-xs text-gray-600 truncate leading-tight">
              {globalNotification.content || '发来一条新消息'}
            </p>
          )}
        </div>
      </div>
    )}

    {/* 桌面 (逻辑不变) */}
    {currentApp === 'home' && renderHome()}

    {/* ChatApp (逻辑不变) */}
    <div className="w-full h-full bg-white" style={{ display: currentApp === 'chat' ? 'block' : 'none' }}>
      <ChatApp
        contacts={contacts}
        setContacts={setContacts}
        globalSettings={globalSettings}
        setGlobalSettings={setGlobalSettings}
        worldBooks={worldBooks}
        setWorldBooks={setWorldBooks}
        onExit={() => setCurrentApp('home')}
        isBackground={currentApp !== 'chat'}
        initialContactId={jumpToContactId}
        onChatOpened={() => setJumpToContactId(null)}
        onNewMessage={(contactId, name, avatar, content) => {
          setGlobalNotification({ type: 'new_message', contactId, name, avatar, content });
          setTimeout(() => setGlobalNotification(null), 5000);
        }}
      />
    </div>

    {/* 其他 App (逻辑不变) */}
    {currentApp === 'coupleSpace' && contacts[0] && (
      (() => {
        let target = contacts[0];
        const safeProfile = {
          ...target,
          name: target.name || "Unknown",
          avatar: target.avatar || "",
          mood: target.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
          userName: target.userName || "Darling",
          diaries: target.diaries || [],
          coupleSpaceUnlocked: target.coupleSpaceUnlocked || false,
          history: target.history || [],
          summary: target.summary || ""
        };
        const recentHistory = Array.isArray(target.history) && target.history.length > 0
          ? target.history.slice(-5).map((msg: any) => `${msg?.role === 'user' ? target.userName : target.name}: ${msg?.content || ''}`).join('\n')
          : "暂无历史对话";
        return (
          <CoupleSpace
            profile={safeProfile}
            chatMemorySummary={`Summary: ${target.summary}\nRecent:\n${recentHistory}`}
            onClose={() => setCurrentApp('home')}
            onUnlock={() => updatePrimaryContact(prev => ({ ...prev, coupleSpaceUnlocked: true }))}
          />
        );
      })()
    )}

    {currentApp === 'settings' && (
      <div className="absolute inset-0 z-50">
        <SettingsApp
          settings={globalSettings}
          setSettings={setGlobalSettings}
          contacts={contacts}
          setContacts={setContacts}
          worldBooks={worldBooks}
          setWorldBooks={setWorldBooks}
          onClose={() => setCurrentApp('home')}
        />
      </div>
    )}
    {currentApp === 'worldbook' && (
      <WorldBookApp worldBooks={worldBooks} setWorldBooks={setWorldBooks} onClose={() => setCurrentApp('home')} />
    )}

    {currentApp === 'wallpaper' && (
      <WallpaperApp settings={globalSettings} setSettings={setGlobalSettings} onClose={() => setCurrentApp('home')} />
    )}
  </div>
);
};
// ========== 新代码到此结束 ==========

export default App;