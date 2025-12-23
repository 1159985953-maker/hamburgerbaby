import React, { useState, useEffect, useRef } from 'react';
import ChatApp from './components/ChatApp';
import CoupleSpace from './components/CoupleSpace';
import SettingsApp from './components/SettingsApp';
import WorldBookApp from './components/WorldBookApp';
import WallpaperApp from './components/AppearanceApp';
import SafeAreaHeader from './components/SafeAreaHeader';  // ← 加这一行！
import localforage from 'localforage';
import { Contact, GlobalSettings, WorldBookCategory, Message } from './types';
import LifeApp from './components/LifeApp';
console.log('React version:', React.version);  // 只应该打印一次


// ==================== 1. 辅助函数 & 初始数据 (必须放在组件外面！) ====================



// 初始联系人数据 (防崩底包)
const INITIAL_CONTACTS: Contact[] = [
  {
    id: '1',
    created: Date.now(),
    name: "😁",
    avatar: "https://picsum.photos/200",
    persona: "",
    memo: "",
    userName: "",
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
    name: c.name || "",
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
    // 新增：保存用户自定义的名字和个性签名
userName: string;
userSignature: string;
userPersona?: string;
lifeAIHistory?: {role: 'user'|'assistant', content: string}[];
  } | null>(null);

  // ==================== 在这里粘贴新代码 ====================
const [homePageIndex, setHomePageIndex] = useState(0); // 0 代表第一页, 1 代表第二页
// =======================================================
  const [jumpToContactId, setJumpToContactId] = useState<string | null>(null);
  const [currentApp, setCurrentApp] = useState<'home' | 'chat' | 'coupleSpace' | 'settings' | 'worldbook' | 'wallpaper'>('home');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false); // 快速添加任务弹窗状态

  // 核心功能：任务自动顺延 (Rollover)
  useEffect(() => {
    if (!isLoaded || !globalSettings.todos) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    let hasChanges = false;

    // 检查是否有 "过去日期" 且 "未完成" 的任务
    const updatedTodos = globalSettings.todos.map(todo => {
      // 如果这个任务有日期，且日期小于今天，且没做完
      if (todo.date && todo.date < todayStr && !todo.completed) {
        hasChanges = true;
        // 把它的日期改成今天，并加上一个标记(可选)
        return { ...todo, date: todayStr, note: (todo.note ? todo.note + " " : "") + "[已顺延]" };
      }
      return todo;
    });

    if (hasChanges) {
      console.log("检测到未完成任务，已自动顺延到今天");
      setGlobalSettings(prev => ({ ...prev, todos: updatedTodos }));
    }
  }, [isLoaded]); // 只在加载完成后检查一次，或者你可以加 globalSettings.todos 作为依赖
  const [worldBooks, setWorldBooks] = useState<WorldBookCategory[]>([]);
const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
  wallpaper: "https://images.unsplash.com/photo-1557683316-973673baf926",
  apiPresets: [],
  activePresetId: "",
  systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  appearance: { bubbleColorUser: '', bubbleColorAI: '', fontSize: 'text-sm', showStatusBar: true },
  themePresets: [],
  
  // 用这个新的 widgets 数组覆盖旧的
widgets: [
  { id: 'chat', icon: "💬", text: "Chat", url: "chat" },
  { id: 'book', icon: "📕", text: "Book", url: "worldbook" },
  { id: 'couple', icon: "❤️", text: "Couple", url: "coupleSpace" },
  { id: 'diary', icon: "📖", text: "Diary", url: "diary" },
  { id: 'settings', icon: "⚙️", text: "Settings", url: "settings" },
  { id: 'theme', icon: "🎨", text: "Theme", url: "wallpaper" }
],
  photoFrames: [
    { id: 'top', photo: "https://picsum.photos/800/300?random=1" },
    { id: 'left', photo: "https://picsum.photos/400/400?random=2" },
     { id: 'polaroid-1', photo: "https://picsum.photos/200/200?random=3" },
  { id: 'polaroid-2', photo: "https://picsum.photos/200/200?random=4" },
  { id: 'polaroid-3', photo: "https://picsum.photos/200/200?random=5" }
  ],
avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User",
  customWallpapers: [
    "https://images.unsplash.com/photo-1557683316-973673baf926",
    "https://images.unsplash.com/photo-1618331835717-801e976710b2",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986"
  ],
userName: "Your Name",
userSignature: "个性签名~",
userPersona: "A kind and supportive partner.",
});

// --- 日历功能状态 ---
  const [calendarDate, setCalendarDate] = useState(new Date()); // 当前显示的月份
  
  // --- ToDo 功能状态 ---
  const [todoInput, setTodoInput] = useState("");







  // --- 日历辅助函数：获取当月所有天数 ---
  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 当月1号是周几
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 当月有多少天
    
    const days = [];
    // 补前面的空白 (如果1号不是周日)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 填入日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  // --- ToDo 辅助函数 ---
  const handleAddTodo = () => {
    if (!todoInput.trim()) return;
    const newTodo: any = {
      id: Date.now().toString(),
      text: todoInput,
      completed: false,
      createdAt: Date.now()
    };
    // 更新设置并保存
    setGlobalSettings(prev => ({
      ...prev,
      todos: [newTodo, ...(prev.todos || [])]
    }));
    setTodoInput("");
  };

  const toggleTodo = (id: string) => {
    setGlobalSettings(prev => ({
      ...prev,
      todos: (prev.todos || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const deleteTodo = (id: string) => {
    setGlobalSettings(prev => ({
      ...prev,
      todos: (prev.todos || []).filter(t => t.id !== id)
    }));
  };

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
// ==================== 从这里开始替换 ====================
if (savedSettings) {
  setGlobalSettings({
    ...globalSettings, // <-- 先用初始化的 globalSettings 打底
    ...savedSettings,  // <-- 再用加载出来的数据覆盖
    // ↓↓↓ 关键修复：像 photoFrames 一样，给 widgets 也加上兜底 ↓↓↓
    widgets: savedSettings.widgets || globalSettings.widgets,
    photoFrames: savedSettings.photoFrames || globalSettings.photoFrames,
    avatar: savedSettings.avatar || globalSettings.avatar,
userName: savedSettings.userName || globalSettings.userName,
  userSignature: savedSettings.userSignature || globalSettings.userSignature
});
}
// ==================== 替换到这里结束 ====================

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
// ==================== 从这里开始完整复制，覆盖旧的 renderHome 函数 ====================
const renderHome = () => {
  // 数据获取逻辑不变
  const topFrame = globalSettings.photoFrames?.find(f => f.id === 'top')?.photo || "https://picsum.photos/800/300?random=1";
  const leftFrame = globalSettings.photoFrames?.find(f => f.id === 'left')?.photo || "https://picsum.photos/400/400?random=2";
  const avatar = globalSettings.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User";


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, key: 'avatar' | 'top' | 'left' | string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const dataUrl = ev.target.result as string;
        setGlobalSettings(prev => {
          if (key === 'avatar') return { ...prev, avatar: dataUrl };
          return { ...prev, photoFrames: (prev.photoFrames || []).map(f => f.id === key ? { ...f, photo: dataUrl } : f) };
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    // 1. 最外层：背景层
    <div
      className="h-full w-full bg-cover bg-center bg-no-repeat bg-fixed text-white flex flex-col"
      style={{ backgroundImage: `url(${globalSettings.wallpaper})` }}
    >
      <div style={{ height: `env(safe-area-inset-top)` }} />

      {/* 2. 滑动容器 */}
      <div className="flex-1 w-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar">
        







        {/* ===== 页面一：主页 ===== */}
        <div className="w-full h-full flex-shrink-0 snap-center overflow-y-auto no-scrollbar">
          
          {/* ★★★ 核心修改点 ★★★ */}
          {/* 1. px-8: 两侧留白大幅增加，内容不会顶到屏幕边缘，显得更精致（像图三） */}
          {/* 2. max-w-3xl: 限制最大宽度，保证电脑上不拉伸 */}
          {/* 3. gap-6: 强制要求每个模块之间有 24px 的间距，防止贴在一起 */}
          {/* 4. paddingBottom: 增加到底部 140px，确保 To-Do 绝对不会被 Dock 遮挡 */}
          <div className="min-h-full flex flex-col justify-evenly px-8 py-6 gap-6 w-full max-w-3xl mx-auto"
               style={{ paddingBottom: `calc(140px + env(safe-area-inset-bottom))` }}>

            {/* --- 区域A: 顶部照片框 --- */}
            <div className="h-60 w-full relative rounded-3xl overflow-hidden shadow-xl border-2 border-white/50 flex-shrink-0">
              <img src={topFrame} className="w-full h-full object-cover" alt="Top Frame" />
              <label className="absolute inset-0 cursor-pointer z-10">
                <input type="file" onChange={(e) => handlePhotoChange(e, 'top')} className="hidden" accept="image/*" />
              </label>
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
                <label className="w-20 h-20 top-6 rounded-full overflow-hidden border-4 border-white/90 shadow-2xl cursor-pointer relative z-20 -mt-8">
                  <img src={avatar} className="w-full h-full object-cover" alt="Avatar"/>
                  <input type="file" onChange={(e) => handlePhotoChange(e, 'avatar')} className="hidden" accept="image/*" />
                </label>
                <div className="w-full relative z-20">
                  <div className="bg-gradient-to-t from-white/85 via-white/80 to-transparent pt-10 pb-7">
                    <input type="text" value={globalSettings.userName || ""} onChange={(e) => setGlobalSettings(prev => ({ ...prev, userName: e.target.value }))} placeholder="输入你的名字" className="w-full text-xl font-bold text-center bg-transparent outline-none text-gray-900" />
                    <input type="text" value={globalSettings.userSignature || ""} onChange={(e) => setGlobalSettings(prev => ({ ...prev, userSignature: e.target.value }))} placeholder="个性签名~" className="w-full text-sm text-center bg-transparent outline-none text-gray-800 mt-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* --- 区域B: 中间组件 (保持左右对齐) --- */}
            <div className="w-full flex items-stretch justify-center gap-4">
              
              {/* 左图 */}
              <label className="flex-1 aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/60 relative cursor-pointer">
                <img src={leftFrame} className="w-full h-full object-cover" alt="Left Frame" />
                <input type="file" onChange={(e) => handlePhotoChange(e, 'left')} className="hidden" accept="image/*"/>
              </label>

              {/* 右侧 App Grid (图标保持小尺寸) */}
              <div className="flex-1 aspect-square grid grid-cols-2 grid-rows-2 gap-3">
                {['chat', 'life', 'couple', 'diary'].map(id => {
                  let widget = globalSettings.widgets?.find(w => w.id === id);
                  if (!widget) {
                     const defaults = [
                       { id: 'chat', icon: "💬", text: "Chat", url: "chat" },
                       { id: 'life', icon: "📅", text: "life", url: "life" },
                       { id: 'couple', icon: "❤️", text: "Couple", url: "coupleSpace" },
                       { id: 'diary', icon: "📖", text: "Diary", url: "diary" }
                     ];
                     widget = defaults.find(w => w.id === id);
                  }
                  if (!widget) return null;

                  return (
                    <div key={id} className="cursor-pointer group flex flex-col items-center justify-center rounded-2xl transition-colors hover:bg-white/5" onClick={() => setCurrentApp(widget.url as any)}>
                      {/* 图标尺寸 w-14 h-14 保持精致 */}
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden bg-white/20 backdrop-blur-md border border-white/20 flex-shrink-0">
                        {widget.customIcon ? (
                          <img src={widget.customIcon} className="w-full h-full object-cover" alt={widget.text} />
                        ) : (
                          <div className="flex items-center justify-center text-3xl">
                            <span>{widget.icon}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-800 mt-1 text-center font-bold drop-shadow-sm">{widget.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          {/* ==================== 3.2 替换主页 To-Do 小组件代码 ==================== */}
              {/* --- 区域C: 主页上的 To-Do List 小组件 --- */}
              <div 
                 className="h-40 w-full backdrop-blur-sm bg-white/20 rounded-3xl p-4 flex flex-col shadow-lg flex-shrink-0 cursor-pointer hover:bg-white/30 transition border border-white/20"
                 onClick={() => setCurrentApp('life')} // 点击大框框 -> 进APP
              >
<h3 className="font-bold text-lg mb-2 text-white flex justify-between items-center relative z-20">
  <span className="flex items-center gap-2">📝 To Do</span>
  <div className="flex items-center gap-2">
     {/* 待办计数 */}
     <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full">
       {(globalSettings.todos || []).filter(t => !t.completed && t.date === new Date().toISOString().slice(0,10)).length} 待办
     </span>
     {/* ★★★ 新增的加号按钮 ★★★ */}
     <button 
       onClick={(e) => {
         e.stopPropagation(); // 防止跳转进App
         setQuickAddMode(true);
       }}
       className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white font-bold transition-colors"
     >
       +
     </button>
  </div>
</h3>
                
                <div className="space-y-2 text-sm overflow-hidden flex-1">
                  {/* 筛选今天的待办任务 */}
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todayTasks = (globalSettings.todos || []).filter(t => t.date === todayStr && !t.completed).slice(0, 3);
                    
                    if (todayTasks.length === 0) {
                      return <div className="text-white/50 italic text-xs mt-4 text-center">今日任务已清空 🎉</div>;
                    }

                    return todayTasks.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 group">
                        {/* ★★★ 关键点：stopPropagation 防止跳转 ★★★ */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // 阻止冒泡！只打钩，不跳转
                            setGlobalSettings(prev => ({
                                ...prev,
                                todos: prev.todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t)
                            }));
                          }}
                          className="w-5 h-5 rounded-full border-2 border-white/60 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
                        >
                        </button>
                        <span className="truncate text-white/90 font-medium drop-shadow-md">{todo.text}</span>
                        {todo.time && <span className="text-[10px] text-white/60 bg-black/20 px-1 rounded">{todo.time}</span>}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>


        {/* ===== 页面二 ===== */}
        <div className="w-full h-full flex-shrink-0 snap-center p-4">
          <div className="w-full h-full flex flex-col justify-center items-center gap-y-8">
            <div className="flex justify-center items-center gap-2">
              {globalSettings.photoFrames?.filter(f => f.id.includes('polaroid')).map((frame, index) => (
                <label key={frame.id} className={`w-24 h-28 bg-white p-2 rounded-md shadow-lg border border-gray-200 cursor-pointer hover:scale-105 hover:shadow-2xl transition-transform duration-300 ${index === 0 ? '-rotate-6' : ''} ${index === 1 ? 'rotate-3 scale-110 z-10' : ''} ${index === 2 ? '-rotate-2' : ''}`}>
                  <img src={frame.photo || "https://picsum.photos/200/200"} className="w-full h-full object-cover" alt={`Polaroid ${index + 1}`} />
                  <input type="file" onChange={(e) => handlePhotoChange(e, frame.id)} className="hidden" accept="image/*"/>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 底部 Dock 栏：这里变了！3个图标！ */}
        <div className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none"
             style={{ paddingBottom: `calc(20px + env(safe-area-inset-bottom))` }}>
          <div className="flex justify-center gap-12 pointer-events-auto bg-white/20 backdrop-blur-xl px-10 py-3 rounded-full border border-white/30 shadow-2xl">
            
            {/* ★★★ 'book' 移到了这里，和 settings, theme 在一起 ★★★ */}
            {['book', 'settings', 'theme'].map(id => {
              let widget = globalSettings.widgets?.find(w => w.id === id);
              if (!widget) {
                  if(id === 'book') widget = { id: 'book', icon: "📕", text: "Book", url: "worldbook" };
                  if(id === 'settings') widget = { id: 'settings', icon: "⚙️", text: "Settings", url: "settings" };
                  if(id === 'theme') widget = { id: 'theme', icon: "🎨", text: "Theme", url: "wallpaper" };
              }
              if (!widget) return null;
              return (
                <div key={id} className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp(widget.url as any)}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden bg-white/20 backdrop-blur-md border border-white/20">
                    {widget.customIcon ? (
                      <img src={widget.customIcon} className="w-full h-full object-cover" alt={widget.text} />
                    ) : (
                      <div className="flex items-center justify-center text-3xl">
                        <span>{widget.icon}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-800 font-bold drop-shadow-sm">{widget.text}</span>
                </div>
              );
            })}
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
   {/* ChatApp - 新全屏方案：和世界书、外观设置完全一致 */}
{/* ChatApp - 终极修复版：绝对全屏容器，没有任何内边距，防止白条 */}
{currentApp === 'chat' && (
  <ChatApp
    contacts={contacts}
    setContacts={setContacts}
    globalSettings={globalSettings}
    setGlobalSettings={setGlobalSettings}
    worldBooks={worldBooks}
    setWorldBooks={setWorldBooks}
    onExit={() => setCurrentApp('home')}
    isBackground={false}
    initialContactId={jumpToContactId}
    onChatOpened={() => setJumpToContactId(null)}
    onNewMessage={(contactId, name, avatar, content) => {
      setGlobalNotification({ type: 'new_message', contactId, name, avatar, content });
      setTimeout(() => setGlobalNotification(null), 5000);
    }}
  />
)}

    {/* 其他 App (逻辑不变) */}
    {currentApp === 'coupleSpace' && contacts[0] && (
      (() => {
        let target = contacts[0];
        const safeProfile = {
          ...target,
          name: target.name || "Unknown",
          avatar: target.avatar || "",
          mood: target.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
          userName: target.userName || "用户名",
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



{/* ==================== 4. 在 App.tsx 插入新页面渲染逻辑 ==================== */}
        {currentApp === 'life' && (
          <div className="absolute inset-0 z-50 bg-white">
            <LifeApp 
              settings={globalSettings} 
              setSettings={setGlobalSettings} 
              onClose={() => setCurrentApp('home')} 
              onOpenDiary={() => setCurrentApp('diary')}
            />
          </div>
        )}
        
{/* ==================== 快速添加任务弹窗 (主页直接调用) ==================== */}
{/* ==================== 快速添加任务弹窗 (全功能版) ==================== */}
    {quickAddMode && (
      <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fadeIn">
        <div className="absolute inset-0" onClick={() => setQuickAddMode(false)} />
        
        {/* 这里使用和LifeApp一样的输入UI */}
        <div className="bg-white w-full sm:w-[90%] sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slideUp relative z-10 mb-0 sm:mb-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-xl text-gray-800">快速记录</h3>
            <button onClick={() => setQuickAddMode(false)} className="bg-gray-100 w-8 h-8 rounded-full text-gray-500">×</button>
          </div>
          
          <form onSubmit={(e) => {
             e.preventDefault();
             const form = e.target as any;
             const text = form.text.value;
             if(!text) return;
             
             // 获取表单数据
             const date = form.date.value || new Date().toISOString().slice(0, 10);
             const time = form.time.value;
             const location = form.location.value;
             const note = form.note.value;
             // 找到选中的分类ID (通过 radio button)
             const catId = form.categoryId.value;

             const newTodo = {
               id: Date.now().toString(),
               text: text,
               completed: false,
               createdAt: Date.now(),
               date: date,
               categoryId: catId,
               time: time, location: location, note: note
             };
             
             setGlobalSettings(prev => ({ ...prev, todos: [newTodo, ...(prev.todos || [])] }));
             setQuickAddMode(false);
          }}>
            <input 
              name="text"
              autoFocus 
              type="text" 
              placeholder="要做什么？" 
              className="w-full text-lg font-bold outline-none placeholder-gray-300 bg-gray-50 p-3 rounded-xl mb-3"
            />
            
            {/* 分类选择 (使用 Radio 实现) */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 mb-3">
               {(globalSettings.categories || [
                  { id: '1', name: '紧急', color: '#EF4444' },
                  { id: '2', name: '工作', color: '#3B82F6' },
                  { id: '3', name: '生活', color: '#10B981' }
               ]).map((cat, idx) => (
                 <label key={cat.id} className="cursor-pointer">
                   <input type="radio" name="categoryId" value={cat.id} defaultChecked={idx === 0} className="peer hidden" />
                   <div 
                     className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-500 bg-white peer-checked:text-white peer-checked:border-transparent transition-all whitespace-nowrap peer-checked:scale-105 shadow-sm"
                     style={{ '--checked-bg': cat.color } as any}
                   >
                     {cat.name}
                     <style>{`
                       input:checked + div { background-color: ${cat.color} !important; }
                     `}</style>
                   </div>
                 </label>
               ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
               <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm w-full" />
               <input name="time" type="time" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm w-full" />
            </div>

            <input name="location" type="text" placeholder="地点?" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm w-full mb-3" />
            
            <textarea name="note" placeholder="备注..." className="w-full bg-gray-100 rounded-xl p-3 text-sm outline-none resize-none h-16 mb-4" />

            <button type="submit" className="w-full bg-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform">
              确认添加
            </button>
          </form>
        </div>
      </div>
    )}


        {/* 这里为了防止你点击日历跳转报错，暂时加个日记本占位 */}
        {currentApp === 'diary' && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col">
            <SafeAreaHeader title="我的日记" left={<button onClick={() => setCurrentApp('home')} className="text-blue-500">返回</button>} />
            <div className="flex-1 flex items-center justify-center text-gray-400">
              这里是日记本页面 (DairyApp)
            </div>
          </div>
        )}

        {/* ==================== 插入结束 ==================== */}




    {currentApp === 'wallpaper' && (
      <WallpaperApp settings={globalSettings} setSettings={setGlobalSettings} onClose={() => setCurrentApp('home')} />
    )}
  </div>
);
};
// ========== 新代码到此结束 ==========

export default App;