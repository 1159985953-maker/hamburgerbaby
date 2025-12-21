import React, { useState, useEffect, useRef } from 'react';
import ChatApp from './components/ChatApp';
import CoupleSpace from './components/CoupleSpace';
import SettingsApp from './components/SettingsApp';
import WorldBookApp from './components/WorldBookApp';
import WallpaperApp from './components/AppearanceApp';
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
    { id: 'left', photo: "https://picsum.photos/400/400?random=2" }
  ],
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User"  // 默认头像

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
const renderHome = () => {
  const topFrame = globalSettings.photoFrames?.find(f => f.id === 'top')?.photo || "https://picsum.photos/800/300";
const leftFrame = globalSettings.photoFrames?.find(f => f.id === 'left')?.photo || "https://picsum.photos/400/400";
const avatar = globalSettings.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User";

  return (
    <div
      className="h-full w-full bg-cover bg-center flex flex-col relative overflow-hidden"
      style={{ backgroundImage: `url(${globalSettings.wallpaper})` }}
    >
      {/* 刘海 + 状态栏 */}
      <div className="absolute top-0 left-0 right-0 h-0 bg-black/0 backdrop-blur-md flex items-end justify-between px-0 pb-0 text-white/0 z-0">

      </div>

      {/* 顶部大长方形照片框 + 右上小头像 */}
      <div className="relative pt-24 px-6 pb-10">
        <div className="relative rounded-3xl overflow-hidden shadow-xl border-2 border-white/80">
          {/* 照片框（点击换照片） */}
          <img src={topFrame} className="w-full h-48 object-cover" alt="Top Frame" />
          <label className="absolute inset-0 flex items-center justify-center bg-black/10 cursor-pointer opacity-0 hover:opacity-4 transition-opacity">
            <span className="text-white text-2xl"> 更换</span>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    if (ev.target?.result) {
                      setGlobalSettings(prev => ({
                        ...prev,
                        photoFrames: prev.photoFrames.map(f => f.id === 'top' ? { ...f, photo: ev.target!.result as string } : f)
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              accept="image/*"
            />
          </label>
        </div>

        {/* 右上小头像（可换） */}
       <label className="absolute top-28 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full overflow-hidden border-4 border-white/80 shadow-2xl cursor-pointer z-10"
  >
          <img src={avatar} className="w-full h-full object-cover" alt="Avatar" />
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (ev.target?.result) {
                    setGlobalSettings(prev => ({ ...prev, avatar: ev.target!.result as string }));
                  }
                };
                reader.readAsDataURL(file);
              }
            }}
            className="hidden"
            accept="image/*"
          />
        </label>
      </div>

      {/* 中间部分：左边小照片框 + 右边四个小图标 */}
      <div className="left-0 bottom-1 w-150/3 flex-10 flex px-6 py-4 gap-4">

        {/* 左边小正方形照片框 */}
        <div className="left-0 bottom-1 w-1/3 aspect-square rounded-3xl overflow-hidden shadow-2xl border-8 border-white/80 relative mt-0">
          <img src={leftFrame} className="w-full h-full object-cover" alt="Left Frame" />
          <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white text-2xl">📷 更换</span>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    if (ev.target?.result) {
                      setGlobalSettings(prev => ({
                        ...prev,
                        photoFrames: prev.photoFrames.map(f => f.id === 'left' ? { ...f, photo: ev.target!.result as string } : f)
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              accept="image/*"
            />
          </label>
        </div>

        {/* 右边四个小图标 */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('chat')}>
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
              💬
            </div>
            <span className="text-white text-xs font-medium drop-shadow-md">Chat</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('worldbook')}>
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
              📕
            </div>
            <span className="text-white text-xs font-medium drop-shadow-md">Book</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('coupleSpace')}>
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
              ❤️
            </div>
            <span className="text-white text-xs font-medium drop-shadow-md">Couple</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('diary')}>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
              📖
            </div>
            <span className="text-white text-xs font-medium drop-shadow-md">Diary</span>
          </div>
        </div>
      </div>

      {/* 最下面两个图标（再往下移一点） */}
     <div className="pb-32 px-6 flex justify-center gap-12 mt-40">
        <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('settings')}>
          <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-800 rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
            ⚙️
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Settings</span>
        </div>

        <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setCurrentApp('wallpaper')}>
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
            🎨
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">Theme</span>
        </div>
      </div>
    </div>
  );
};


  // ==================== 7. 主渲染 JSX ====================
return (
  <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden">
    {/* 手机外框容器 */}
    <div className="w-full h-full sm:w-[375px] sm:h-[812px] bg-black sm:rounded-[3rem] sm:border-[8px] sm:border-gray-800 overflow-hidden shadow-2xl relative ring-4 ring-gray-900/50 flex flex-col">
      {/* 1. 刘海 (Dynamic Island) */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-b-3xl z-[100] hidden sm:block pointer-events-none"></div>

      {/* 2. 顶部弹窗通知 */}
      {globalNotification && (
        <div
          onClick={() => {
            setJumpToContactId(globalNotification.contactId);
            setCurrentApp('chat');
            setGlobalNotification(null);
          }}
          className="absolute top-12 left-3 right-3 z-[999] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 flex items-center gap-3 cursor-pointer animate-slideDown active:scale-95 transition-transform duration-200"
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

      {/* 3. 桌面 */}
      {currentApp === 'home' && renderHome()}

      {/* 4. ChatApp (后台隐身) */}
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

      {/* 5. 其他 App */}
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
  <SettingsApp
    settings={globalSettings}
    setSettings={setGlobalSettings}
    contacts={contacts}
    setContacts={setContacts}
    worldBooks={worldBooks}
    setWorldBooks={setWorldBooks}
    onClose={() => setCurrentApp('home')}
  />
)}

      {currentApp === 'worldbook' && (
        <WorldBookApp worldBooks={worldBooks} setWorldBooks={setWorldBooks} onClose={() => setCurrentApp('home')} />
      )}

      {currentApp === 'wallpaper' && (
        <WallpaperApp settings={globalSettings} setSettings={setGlobalSettings} onClose={() => setCurrentApp('home')} />
      )}
    </div>
  </div>
);
};

export default App;