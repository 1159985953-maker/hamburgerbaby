import React, { useState, useEffect } from 'react';
import { useCharacterLife } from './hooks/useCharacterLife';
import ChatApp from './components/ChatApp';
import CoupleSpace from './components/CoupleSpace';
import SettingsApp from './components/SettingsApp';
import WorldBookApp from './components/WorldBookApp';
import WallpaperApp from './components/WallpaperApp';
import { Contact, GlobalSettings, WorldBookCategory } from './types';
import { generateResponse } from './services/apiService';


const sanitizeContact = (c: any): any => {
  const now = Date.now();
  return {
    ...c,
    // 1. 补全 mood
    mood: c.mood || { current: "Content", energyLevel: 80, lastUpdate: now },
    // 2. 补全情侣空间字段
    diaries: Array.isArray(c.diaries) ? c.diaries : [],
    questions: Array.isArray(c.questions) ? c.questions : [],
    letters: Array.isArray(c.letters) ? c.letters : [],
    coupleSpaceUnlocked: c.coupleSpaceUnlocked === true, // 强制转布尔值
    // 3. 补全基础信息
    name: c.name || "Unknown Character",
    history: Array.isArray(c.history) ? c.history : [],
    // 4. 补全其他可能为空的对象
    hef: c.hef || {},
    playlist: c.playlist || [],
  };
};
// ==================== 全局生命计算逻辑 (防弹版) ====================
const calculateLifeUpdate = (rawContact: Contact): Contact => {
    // ★★★ 第一步先清洗数据，防止 undefined ★★★
    const contact = sanitizeContact(rawContact); 

  const now = Date.now();

  // 2. ★★★ 核心修复：如果数据里没有 mood，就给它造一个默认的，防止白屏！ ★★★
  const safeMood = contact.mood || { current: "Content", energyLevel: 80, lastUpdate: now };

  const lastUpdate = safeMood.lastUpdate || now;
  const minutesPassed = (now - lastUpdate) / 60000;

  if (minutesPassed < 1) return contact;

  // 获取角色当地时间
  let currentHour = 12; // 默认中午
  try {
    const timeFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: contact.timezone || "Asia/Seoul",
      hour: 'numeric',
      hour12: false
    });
    currentHour = parseInt(timeFormat.format(new Date()));
  } catch (e) {
    // 如果时区设置错了，就忽略，防止报错
  }

  // 能量变化逻辑
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
      ...safeMood, // 使用修复后的 mood
      current: moodState,
      energyLevel: parseFloat(newEnergy.toFixed(1)),
      lastUpdate: now
    }
  };
};

// ========================================================
// 初始默认角色数据，保持不变
const INITIAL_CONTACTS: Contact[] = [
  {
    id: '1',
    created: Date.now(),
    name: "Aria",
    avatar: "https://picsum.photos/200",
    persona: "Aria is a gentle but sometimes clingy artist. She loves painting and coffee. She gets lonely easily.",
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
    hef: {
      CORE_DRIVES: { primary_motive: 'Connection', values: ['Kindness', 'Art', 'Intimacy'] },
      EMOTIONAL_DYNAMICS: { baseline_mood: 'Calm', resilience: 7 },
      RELATIONAL_MASKS: { default_style: 'Gentle', conflict_style: 'Avoidant' },
      CULTURE_SCRIPTS: {
        core_values: ['Honesty', 'Creativity', 'Emotional Depth'],
        pet_phrases: ['嗯...', '真的吗？', '有点想你了呢']
      },
      INDIVIDUAL_VARIATION: {
        personality_big5: {
          openness: 8,
          conscientiousness: 6,
          extraversion: 7,
          agreeableness: 9,
          neuroticism: 5
        },
        speech_style: '温柔、偶尔撒娇、喜欢用省略号表达犹豫'
      }
    },
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

const App: React.FC = () => {
  // --- OS State ---
  const [currentApp, setCurrentApp] = useState<'home' | 'chat' | 'coupleSpace' | 'settings' | 'worldbook' | 'wallpaper'>('home');

  // === 数据持久化部分 (安全的版本) ===
  const [contacts, setContacts] = useState<Contact[]>(() => {
        try {
            const saved = localStorage.getItem('character-app-contacts');
            if (saved) {
                const parsed = JSON.parse(saved);
                // ★★★ 关键：读取时清洗每一个角色 ★★★
                return parsed.map(sanitizeContact);
            }
        } catch (error) {
            console.error("读取 contacts 失败", error);
        }
        return INITIAL_CONTACTS;
    });
  useEffect(() => {
    if (contacts && contacts.length > 0) {
      localStorage.setItem('character-app-contacts', JSON.stringify(contacts));
    }
  }, [contacts]);

  const [worldBooks, setWorldBooks] = useState<WorldBookCategory[]>(() => {
    const saved = localStorage.getItem('character-app-worldbooks');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => {
    localStorage.setItem('character-app-worldbooks', JSON.stringify(worldBooks));
  }, [worldBooks]);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => {
    const initialSettings: GlobalSettings = {
wallpaper: "#f9fafb",  // 浅灰色背景
      apiPresets: [], activePresetId: "",
      systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      appearance: { bubbleColorUser: '', bubbleColorAI: '', fontSize: 'text-sm', showStatusBar: true },
      themePresets: []
    };
    const saved = localStorage.getItem('character-app-global-settings');
    return saved ? { ...initialSettings, ...JSON.parse(saved) } : initialSettings;
  });
  useEffect(() => {
    localStorage.setItem('character-app-global-settings', JSON.stringify(globalSettings));
  }, [globalSettings]);

  // === 修复白屏的核心：启动安全检查 ===
  if (!contacts || contacts.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-white p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">糟糕！</h1>
        <p className="mb-4">没有找到任何角色数据。</p>
        <button
          onClick={() => {
            setContacts(INITIAL_CONTACTS);
            window.location.reload();
          }}
          className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
        >
          恢复初始角色
        </button>
      </div>
    );
  }

  // ★★★ 全局生命维持系统 (放在 App 组件里面，替换原来的 useCharacterLife) ★★★
  useEffect(() => {
    const heartbeat = () => {
      setContacts(prev => prev.map(c => calculateLifeUpdate(c)));
    };
    // 立即执行一次，然后每 60 秒执行一次
    heartbeat();
    const intervalId = setInterval(heartbeat, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // 辅助函数：更新第一个角色（用于兼容旧逻辑）
  const updatePrimaryContact = (updater: (prev: Contact) => Contact) => {
    setContacts(prev => {
      const updated = updater(prev[0]);
      return [updated, ...prev.slice(1)];
    });
  };

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // === 你的 Home 界面渲染 (我发誓这次是您完整的、一行不少的代码！) ===
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  const renderHome = () => (
    <div
      className="h-full w-full bg-cover bg-center flex flex-col p-6 text-white relative animate-fadeIn transition-all duration-500"
      style={{ backgroundImage: `url(${globalSettings.wallpaper})` }}
    >
      {/* Status Bar */}
      <div className="flex justify-between text-xs font-medium mb-8 pt-2">
        <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="flex gap-1">
          <span>5G</span>
          <span>🔋 100%</span>
        </div>
      </div>
      {/* Time Widget */}
      <div className="mb-12 text-center drop-shadow-md">
        <h1 className="text-6xl font-light tracking-tighter">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </h1>
        <p className="text-sm font-medium opacity-90">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>
      {/* Apps Grid */}
      <div className="grid grid-cols-4 gap-x-4 gap-y-8">
        <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setCurrentApp('chat')}>
          <div className="w-14 h-14 bg-gradient-to-b from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-3xl app-icon-shadow group-hover:scale-105 transition duration-300">💬</div>
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
      {/* Dock Area */}
      <div className="absolute bottom-6 left-4 right-4 h-20 bg-white/20 backdrop-blur-xl rounded-[2rem] flex items-center justify-around px-2 border border-white/10">
        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300" onClick={() => setCurrentApp('chat')}>💬</div>
        <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300">🌐</div>
        <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300">🎵</div>
        <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:-translate-y-2 transition duration-300" onClick={() => setCurrentApp('coupleSpace')}>❤️</div>
      </div>
    </div>
  );

  // === 你的主渲染逻辑 (完全不变！) ===
  return (
    <div className="w-full h-full sm:w-[375px] sm:h-[812px] bg-black sm:rounded-[3rem] sm:border-[8px] sm:border-gray-800 overflow-hidden shadow-2xl relative ring-4 ring-gray-900/50">
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-b-3xl z-50 hidden sm:block pointer-events-none transition-all duration-300"></div>

      {currentApp === 'home' && renderHome()}

      {/* 修复点 1：把 livingPrimaryContact 删掉，直接判断 contacts 长度 */}
      {currentApp === 'chat' && contacts.length > 0 && (
        <ChatApp
          contacts={contacts}  // 直接传活人列表
          setContacts={setContacts}
          globalSettings={globalSettings}
          setGlobalSettings={setGlobalSettings}
          worldBooks={worldBooks}
          setWorldBooks={setWorldBooks}
          onExit={() => setCurrentApp('home')}
        />
      )}

      {currentApp === 'coupleSpace' && contacts[0] && (
        (() => {
          let target = contacts[0];

          // ★★★★★ 超级防御修复：强制补全所有可能缺失的字段 ★★★★★
          const safeProfile = {
            ...target,
            // 基本字段补全
            name: target.name || "Unknown",
            avatar: target.avatar || "https://picsum.photos/200",
            mood: target.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
            userName: target.userName || "Darling",
            // 情侣空间专属字段（旧数据一定没有！）
            diaries: target.diaries || [],
            coupleSpaceUnlocked: target.coupleSpaceUnlocked || false,
            // 防止其他潜在字段缺失
            history: target.history || [],
            summary: target.summary || "",
          };

          const recentHistory = (target.history || []).slice(-5)
            .map((msg: any) => `${msg.role === 'user' ? target.userName : target.name}: ${msg.content || ''}`)
            .join('\n');
          const chatMemorySummary = `
长期记忆总结: ${target.summary || '无'}
最近的对话片段:
${recentHistory || '还没有聊过天。'}
    `.trim();

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
  );
};

export default App;