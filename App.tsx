import React, { useState, useEffect, useRef } from 'react';
import ChatApp from './components/ChatApp';
import CoupleSpace from './components/CoupleSpace';
import SettingsApp from './components/SettingsApp';
import WorldBookApp from './components/WorldBookApp';
import WallpaperApp from './components/WallpaperApp';
import localforage from 'localforage';
import { Contact, GlobalSettings, WorldBookCategory, Message } from './types';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）

// ==================== 1. 辅助函数 (保持不变) ====================

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
  };
};

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
    relationshipStatus: 'Close Friend',
    aiDND: { enabled: false, until: 0 },
    interventionPoints: 0,
    longTermMemories: [],
    currentChatMode: 'Casual',
    customCSS: "",
    chatBackground: ""
  }
];

// ==================== 2. App 组件主体 ====================

const App: React.FC = () => {


  // ★★★ 全局通知状态 (整合了两种场景) ★★★
const [globalNotification, setGlobalNotification] = useState<{
  type: 'proactive_thinking' | 'new_message';
  contactId: string;
  name: string;
  avatar: string;
  content?: string;
} | null>(null);

// ★★★ 用于跨组件通信的跳转指令 ★★★
const [jumpToContactId, setJumpToContactId] = useState<string | null>(null);
  const [currentApp, setCurrentApp] = useState<'home' | 'chat' | 'coupleSpace' | 'settings' | 'worldbook' | 'wallpaper'>('home');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  




  
  // ========== 【终极数据修复版】useEffect - 解决 history.slice 崩溃 ==========
  // 1. 初始化读取 localforage
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("正在从数据库加载数据...");
        
        // 并行读取所有数据
        const [savedContacts, savedSettings, savedBooks] = await Promise.all([
          localforage.getItem<Contact[]>('contacts'),
          localforage.getItem<GlobalSettings>('globalSettings'),
          localforage.getItem<WorldBookCategory[]>('worldBooks')
        ]);

        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        // ★★★ 核心修复：在这里对加载的数据进行“安检” ★★★
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        if (savedContacts && Array.isArray(savedContacts) && savedContacts.length > 0) {
          
          const repairedContacts = savedContacts.map(contact => {
            // 对每一个加载的 contact 对象进行检查和修复
            return {
              ...contact, // 先继承所有已有的属性

              // 关键检查点：如果 history 不存在或不是数组，就强制给它一个空数组
              history: Array.isArray(contact.history) ? contact.history : [],
              
              // 【预防性修复】把所有可能是数组的字段都检查一遍，永绝后患！
              longTermMemories: Array.isArray(contact.longTermMemories) ? contact.longTermMemories : [],
              enabledWorldBooks: Array.isArray(contact.enabledWorldBooks) ? contact.enabledWorldBooks : [],
              playlist: Array.isArray(contact.playlist) ? contact.playlist : [],
              schedule: Array.isArray(contact.schedule) ? contact.schedule : [],
              
              // 【预防性修复】确保关键对象存在
              mood: contact.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
              hef: contact.hef || {},
            };
          });

          console.log(`数据修复完成，载入 ${repairedContacts.length} 个联系人。`);
          setContacts(repairedContacts); // ★★★ 使用修复后的健康数据！ ★★★

        } else {
          // 如果本地没有任何数据，就加载初始角色，保证程序能运行
          console.log("未找到本地数据，初始化默认角色...");
          setContacts(INITIAL_CONTACTS);
        }
        
        // 其他数据的加载保持不变
        if (savedSettings) {
          setGlobalSettings(savedSettings);
        }
        
        if (savedBooks) {
          setWorldBooks(savedBooks);
        }

      } catch (err) {
        console.error("读取数据库失败，这是一个严重错误:", err);
        // 如果读取彻底失败，也加载初始角色以防白屏
        setContacts(INITIAL_CONTACTS);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);











  // 3. WorldBooks State
  const [worldBooks, setWorldBooks] = useState<WorldBookCategory[]>([]);
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('worldBooks', worldBooks).catch(console.error);
    }
  }, [worldBooks, isLoaded]);

  // 4. GlobalSettings State
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    wallpaper: "#f9fafb",
    apiPresets: [], activePresetId: "",
    systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    appearance: { bubbleColorUser: '', bubbleColorAI: '', fontSize: 'text-sm', showStatusBar: true },
    themePresets: []
  });
  
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('globalSettings', globalSettings).catch(console.error);
    }
  }, [globalSettings, isLoaded]);


  // 5. 生命维持系统 heartbeat
  useEffect(() => {
    const heartbeat = () => {
      setContacts(prev => prev.map(c => calculateLifeUpdate(c)));
    };
    heartbeat();
    const intervalId = setInterval(heartbeat, 60000);
    return () => clearInterval(intervalId);
  }, []);


// ========== 这是新的、修复好的 "全局主动消息监视器" 代码 ==========
// ★★★ 全局主动消息监视器 (Watchdog for Scene A) ★★★
      useEffect(() => {
        const checkProactiveMessages = () => {
          // ✅ 修复点：增加了 currentApp !== 'home' 的判断，只有在主屏幕才触发思考
          if (globalNotification || !isLoaded || contacts.length === 0 || currentApp !== 'home') {
            return;
          }
    
          for (const contact of contacts) {
            // ✅ 修复点：确保所有检查都使用正确的 `contact` 变量
            if (!contact.proactiveConfig?.enabled || contact.aiDND?.enabled || (contact.affectionScore || 50) < 60) continue;
            const now = Date.now();
            const lastUserMsg = [...contact.history].reverse().find(m => m.role === 'user');
            const gapMinutes = lastUserMsg ? Math.floor((now - lastUserMsg.timestamp) / 60000) : Infinity;
            const minGap = contact.proactiveConfig?.minGapMinutes ?? 480;
            if (gapMinutes < minGap) continue;
            const today = new Date().toISOString().slice(0, 10);
            const sentToday = contact.proactiveLastSent?.[today] || 0;
            const maxDaily = contact.proactiveConfig?.maxDaily ?? 2;
            if (sentToday >= maxDaily) continue;
    
            console.log(`[全局监视器] ✅ '${contact.name}' 触发了【主动聊天】！`);
            
            // ✨ 新功能：触发“正在思考”的全局通知 (你的需求 A)
            setGlobalNotification({ type: 'proactive_thinking', contactId: contact.id, name: contact.name, avatar: contact.avatar });
            // 触发一个后就停止，避免同时弹出多个
            break; 
          }
        };
    
        const intervalId = setInterval(checkProactiveMessages, 15000); // 每15秒检查一次
        return () => clearInterval(intervalId);
    
      }, [contacts, isLoaded, globalNotification, currentApp]); // 依赖项现在更准确



  // 6. 辅助函数
  const updatePrimaryContact = (updater: (prev: Contact) => Contact) => {
    setContacts(prev => {
      if (prev.length === 0) return prev;
      const updated = updater(prev[0]);
      return [updated, ...prev.slice(1)];
    });
  };

  // 7. 渲染桌面的函数 (已修复红点逻辑)
  const renderHome = () => {
    // 1. 先在这里算出总未读数
    const totalUnreadBadge = contacts.reduce((sum, c) => sum + ((c as any).unread || 0), 0);

    return (
      <div
        className="h-full w-full bg-cover bg-center flex flex-col p-6 text-white relative animate-fadeIn transition-all duration-500"
        style={{ backgroundImage: `url(${globalSettings.wallpaper})` }}
      >
        <div className="flex justify-between text-xs font-medium mb-8 pt-12">
          <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex gap-1"><span>5G</span><span>🔋 100%</span></div>
        </div>
        <div className="mb-12 text-center drop-shadow-md">
          <h1 className="text-6xl font-light tracking-tighter">
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </h1>
          <p className="text-sm font-medium opacity-90">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        {/* 图标区域 */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-8">
          
          {/* 👇 聊天图标 (带红点) 👇 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group relative" onClick={() => setCurrentApp('chat')}>
            <div className="w-14 h-14 bg-gradient-to-b from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">💬</div>
             {/* 👇👇👇 这里是新加的红点代码 👇👇👇 */}
          {contacts.reduce((sum, c) => sum + ((c as any).unread || 0), 0) > 0 && (
            <div className="absolute top-0 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 h-5 min-w-[1.25rem] flex items-center justify-center rounded-full border-2 border-black/20 shadow-sm z-10">
              {contacts.reduce((sum, c) => sum + ((c as any).unread || 0), 0) > 99 ? '99+' : contacts.reduce((sum, c) => sum + ((c as any).unread || 0), 0)}
            </div>
          )}
          {/* 👆👆👆 红点代码结束 👆👆👆 */}
       
            <span className="text-[11px] font-medium text-shadow opacity-90">Chat</span>
          </div>

          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('coupleSpace')}>
            <div className="w-14 h-14 bg-gradient-to-b from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">❤️</div>
            <span className="text-[11px] font-medium text-shadow opacity-90">Couple</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('worldbook')}>
            <div className="w-14 h-14 bg-gradient-to-b from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">📕</div>
            <span className="text-[11px] font-medium text-shadow opacity-90">Book</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer group opacity-90">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">📖</div>
            <span className="text-[11px] font-medium text-shadow opacity-90">Diary</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('wallpaper')}>
            <div className="w-14 h-14 bg-gradient-to-b from-purple-400 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">🎨</div>
            <span className="text-[11px] font-medium text-shadow opacity-90">Theme</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('settings')}>
            <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">⚙️</div>
            <span className="text-[11px] font-medium text-shadow opacity-90">Settings</span>
          </div>
        </div>
        <div className="absolute bottom-6 left-4 right-4 h-20 bg-white/20 backdrop-blur-xl rounded-[2rem] flex items-center justify-around px-2 border border-white/10">
          <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300" onClick={() => setCurrentApp('chat')}>💬</div>
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300">🌐</div>
          <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300">🎵</div>
          <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300" onClick={() => setCurrentApp('coupleSpace')}>❤️</div>
        </div>
      </div>
    );
  };

  

// 9. 主渲染 JSX
  return (
    <> {/* <--- 在这里加上开始标签 */}

      {/* ★★★ 全局通知中心 UI ★★★ */}
      {globalNotification && (
        <div 
          onClick={() => {
            setJumpToContactId(globalNotification.contactId);
            setCurrentApp('chat');
            setGlobalNotification(null);
          }} 
          className="absolute top-12 left-2 right-2 z-[9998] rounded-2xl p-3 shadow-xl flex items-center gap-3 cursor-pointer animate-slideDown border"
          style={{
            backgroundColor: globalNotification.type === 'proactive_thinking' ? '#3b82f6' : 'rgba(255,255,255,0.95)',
            borderColor: globalNotification.type === 'proactive_thinking' ? '#2563eb' : '#e5e7eb'
          }}
        >
          <img src={globalNotification.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-white/50" alt="icon" />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm" style={{ color: globalNotification.type === 'proactive_thinking' ? 'white' : 'black' }}>
              {globalNotification.name}
            </span>
            {globalNotification.type === 'proactive_thinking' ? (
              <p className="text-xs text-white/80 truncate">正在准备给你发消息...</p>
            ) : (
              <p className="text-xs text-gray-600 truncate">{globalNotification.content || '发来一条新消息'}</p>
            )}
          </div>
          {globalNotification.type === 'proactive_thinking' && <span className="text-2xl text-white animate-pulse">💬</span>}
        </div>
      )}

    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="w-full h-full sm:w-[375px] sm:h-[812px] bg-black sm:rounded-[3rem] sm:border-[8px] sm:border-gray-800 overflow-hidden shadow-2xl relative ring-4 ring-gray-900/50 flex flex-col">
        
        {/* 刘海 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-b-3xl z-50 hidden sm:block pointer-events-none transition-all duration-300"></div>




      

        {/* 桌面 */}
        {currentApp === 'home' && renderHome()}

        {/* ★★★ 核心修改：让 ChatApp 在后台“隐身”运行，而不是销毁 ★★★ */}
        {/* 我们用 display: none 来控制显示，这样 AI 可以在后台继续打字回复 */}
        {/* ✅ 替换成这段 (隐身模式) */}
        <div className="w-full h-full" style={{ display: currentApp === 'chat' ? 'block' : 'none' }}>
           {contacts.length > 0 && (
// ========== 这是新的、传递了新通知工具的 <ChatApp /> 组件调用 ==========
          // ========== 这是最终正确版本的 <ChatApp /> 调用代码，请用它覆盖旧的 ==========
<ChatApp
contacts={contacts}
setContacts={setContacts}
globalSettings={globalSettings}
setGlobalSettings={setGlobalSettings}
worldBooks={worldBooks}
setWorldBooks={setWorldBooks}
onExit={() => setCurrentApp('home')}

// ✨ 核心 props，连接 App 和 ChatApp
        isBackground={currentApp !== 'chat'}
        initialContactId={jumpToContactId}
        onChatOpened={() => setJumpToContactId(null)}
        onNewMessage={(contactId, name, avatar, content, activeContactIdInChat) => {
          // ✅ 核心逻辑：只有当 App 不在聊天界面时，才弹窗
          // ChatApp 会告诉我们它正在和谁聊天 (activeContactIdInChat)，但在这里我们简化为只要不在聊天App就弹窗
          if (currentApp !== 'chat') {
            setGlobalNotification({ type: 'new_message', contactId, name, avatar, content });
            // 5秒后自动消失
            setTimeout(() => setGlobalNotification(null), 5000);
          }
        }}
      />
          )}
        </div>

        {/* 其他 App (保持原来的逻辑，这些不需要后台运行) */}
        {currentApp === 'coupleSpace' && contacts[0] && (
          (() => {
            let target = contacts[0];
            const safeProfile = {
              ...target,
              name: target.name || "Unknown",
              avatar: target.avatar || "https://picsum.photos/200",
              mood: target.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
              userName: target.userName || "Darling",
              diaries: target.diaries || [],
              coupleSpaceUnlocked: target.coupleSpaceUnlocked || false,
history: Array.isArray(target.history) ? target.history : [],
              summary: target.summary || "",
            };
// 这是安全的 recentHistory 计算代码
const recentHistory = Array.isArray(target.history) && target.history.length > 0
  ? target.history
      .slice(-5)
      .map((msg: any) => `${msg?.role === 'user' ? target.userName : target.name}: ${msg?.content || ''}`)
      .join('\n')
  : "暂无历史对话";
            const chatMemorySummary = `长期记忆总结: ${target.summary || '无'}\n最近对话:\n${recentHistory}`;
            
            return (
              <CoupleSpace
                profile={safeProfile}
                chatMemorySummary={chatMemorySummary}
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
          <WorldBookApp
            worldBooks={worldBooks}
            setWorldBooks={setWorldBooks}
            onClose={() => setCurrentApp('home')}
          />
        )}

        {currentApp === 'wallpaper' && (
          <WallpaperApp
            settings={globalSettings}
            setSettings={setGlobalSettings}
            onClose={() => setCurrentApp('home')}
          />
        )}

      </div>
    </div>
    </>
  );
};


export default App;