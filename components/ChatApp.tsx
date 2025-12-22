import React, { useState, useRef, useEffect, useLayoutEffect, ChangeEvent } from 'react';
import { Contact, Message, GlobalSettings, WorldBookCategory, WorldBookEntry, Song, FavoriteEntry } from '../types';
import TranslationText from './TranslationText';
import { generateResponse } from '../services/apiService';
import { summarizeHistory } from '../services/geminiService';
import { generateMinimaxAudio, fetchMinimaxVoices, getBuiltInMinimaxVoices, MinimaxVoice } from '../services/ttsService';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）
















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
}) => {








  // ==================== 状态定义 ====================


  const [editingMsgId, setEditingMsgId] = useState<string | null>(null); // 当前正在编辑的消息ID
  const [editContent, setEditContent] = useState(""); // 正在编辑的内容缓存
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
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





const activeContact = contacts.find(c => c.id === activeContactId);





const longPressTimer = useRef<any>(null); // 长按计时器
const isLongPress = useRef(false); // 标记是否触发了长按
const isBackgroundRef = useRef(isBackground); // ★★★ 1. 追踪后台状态的 Ref
const viewRef = useRef(view);               // 盯着现在的页面状态
const activeContactIdRef = useRef(activeContactId); // 盯着现在正在跟谁聊
const messagesEndRef = useRef<HTMLDivElement>(null);









  

  





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
    const newName = editForm.name || "New Friend";
    const newPersona = editForm.persona || "A gentle and caring friend.";

    // 2. 创建新角色对象
    const newContact: Contact = {
      id: Date.now().toString(),
      created: Date.now(),
      name: newName,
      avatar: editForm.avatar || "https://picsum.photos/200",
      persona: newPersona,
      memo: "",
      userName: editForm.userName || "Darling",
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
    }
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
    // 1. 更新UI
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: [...c.history, userMsg] } : c));
    setInput("");
    setReplyTo(null);
    setShowPlusMenu(false);
   




    // 👇👇👇 核心修复：把 checkAutoSummary 的定义和调用都放在这里 👇👇👇

    
    // 3. 延迟调用检查函数
    setTimeout(() => {
        setContacts(currentContacts => {
            const latestContact = currentContacts.find(c => c.id === activeContact.id);
            if (latestContact) {
                checkAutoSummary(latestContact);
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
✅ 必须执行：必须先为你的“已读不回”道歉或找借口（如“刚睡醒”、“刚才在忙”），态度要软化。
`;
    } else if (isUserLateReply) {
        // 情况 B：用户的锅
        blameInstruction = `
【时间流逝】距离上次对话已过 ${gapDescription}。
是用户消失了这么久才回你。你可以表现出惊讶、撒娇（“怎么才理我”）或询问他去哪了。
`;
    } else {
        blameInstruction = "时间连贯，正常对话。";
    }




const generateSystemPrompt = (contact: Contact, gapDesc: string, aiTime: string) => {
  // 1. 根据关系状态，决定 AI 的态度底色
  let relationshipInstruction = "";
  switch (contact.relationshipStatus) {
    case 'Honeymoon': relationshipInstruction = "处于热恋/蜜月期，无论说什么都带着爱意和包容，极其粘人。"; break;
    case 'Stable': relationshipInstruction = "关系稳定，像老夫老妻或挚友，默契，不需要过多的客套。"; break;
    case 'Conflict': relationshipInstruction = "【⚠️处于冷战/冲突状态⚠️】语气冷淡、简短。对用户的示好要保持怀疑。除非用户明确道歉或给出极合理的解释，否则不要轻易缓和语气。"; break;
    case 'Broken': relationshipInstruction = "关系破裂。表现出极度的疏离、礼貌但拒人千里，或者干脆不想理人。"; break;
    default: relationshipInstruction = "普通朋友关系，礼貌且友好。";
  }

  // 2. 检查是否处于“勿扰模式”的边缘（比如刚醒或正要睡）
  let dndContext = "";
  if (contact.aiDND.enabled) {
    dndContext = `你当前处于【${contact.aiDND.reason || "忙碌"}】状态。用户强行找你说话，你的反应应该是简短、略带被打扰的惊讶，或者匆忙结束对话。`;
  }
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
  {"type": "text", "content": "回复内容"},
]



铁律（任何一条违反都会导致系统崩溃、重置、惩罚）：
- 绝对禁止输出 \`\`\`json 或任何代码块
- 绝对禁止在JSON外加任何文字、解释、换行
- 绝对禁止漏掉第一项 thought_chain（即使你觉得没必要也必须完整写）
- 所有内容必须是合法JSON，不能有未转义换行
- 想发多条就多加几个 {"type":"text","content":"..."}
- 在 thought_chain 里写 "hef_update": "joy +20 (因为用户说爱你)" 等
- 信息保持在【1～5】条之间

# 核心身份
你就是"${activeContact.name}"。
HEF: ${JSON.stringify(activeContact.hef, null, 2)}
Persona: ${activeContact.persona}
Lore: ${loreText || "无"}

# 【⚠️ 强制时空坐标 ⚠️】
系统检测到：距离上一条消息（无论谁发的）已过去：>>> ${gapDescription} <<<
>>> 责任判定指令：${blameInstruction} <<<

当前状态（必须自然体现）：
- 你的当地时间：${aiTime} (${activeContact.timezone})
- 用户当地时间：${userTime}
- 距离上一轮有效对话已过去：${gapDescription}
- 当前心情：${activeContact.mood.current}
- 好感度：${activeContact.affectionScore }
- 用户名字：${currentUserName}
- 用户简介：${currentUserPersona}

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


# ❤️ 好感度评分系统 (Affection Logic)
请根据用户刚才发的那一句话，判断你的好感度应该如何变化：
- **大幅加分 (+2)**: 用户做了极度触动你、让你感到被深爱、送了贵重礼物(剧情)、或深刻理解你的事。
- **小幅加分 (+1)**: 正常的开心聊天、关心、幽默、日常陪伴。
- **不加不减 (0)**: 普通的陈述、无聊的对话、没看懂的话。
- **小幅扣分 (-1)**: 用户敷衍、无理取闹、让你感到轻微不适。
- **大幅扣分 (-3～ -5)**: 用户辱骂、背叛、触碰底线、极度冷漠。


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
3. 想引用用户某句：用 > 开头引用原文，换行后写回复

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
现在，开始回复用户的最后一条消息！`;

    
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 替换结束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲







// 3. 构建消息列表并插入“系统强制提示”
    const recentHistorySlice = Array.isArray(currentHistory)
      ? (Array.isArray(currentHistory) ? currentHistory.slice(-(activeContact?.contextDepth || 20)) : [])
      : [];

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistorySlice
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
let parts: { type: string; content: string; thought_chain?: any }[] = [];
    let extractedThought: any = null;
    let scoreChange = 0; // 默认不变化
    let hefUpdateData: any = null; // ★ 新增：用于存 AI 返回的情绪变化

    try {
        const jsonMatch = finalResp.match(/\[\s*\{[\s\S]*\}\s*\]/);

        if (jsonMatch && jsonMatch[0]) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed)) throw new Error("解析结果不是一个数组");
            
            // 1. 提取思考链和好感度变化
            if (parsed.length > 0 && parsed[0].type === "thought_chain") {
                extractedThought = parsed[0];
                console.log("【隐藏思考链】", extractedThought);
                
                // (1) 获取好感度变化值
                if (typeof extractedThought.affection_score_change === 'number') {
                    scoreChange = Math.round(extractedThought.affection_score_change);
                }
                
                // (2) ★ 新增：获取 HEF 情绪更新 ★
                if (extractedThought.hef_update) {
                    hefUpdateData = extractedThought.hef_update;
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
    
    const newMessages: Message[] = parts.map((part, i) => ({
      id: Date.now().toString() + i + Math.random(),
      role: 'assistant',
      content: part.content,
      timestamp: Date.now() + (i * 50),
      type: 'text',
    }));




    
    // ★★★ 核心修复：更新状态时，同时更新好感度 ★★★
setContacts(prev => prev.map(c => {
      if (c.id === activeContact.id) {
        // 1. 定义“正在读”：不在后台 && 在聊天界面 && 正在聊的人就是这个人
        const isReading = !isBackgroundRef.current && viewRef.current === 'chat' && activeContactIdRef.current === c.id;
        
        // 2. 如果没在读，就加红点！
        const newUnreadCount = isReading ? 0 : (c.unread || 0) + newMessages.length;







        const oldScore = c.affectionScore || 50;
        const newScore = Math.min(100, Math.max(0, oldScore + scoreChange));
        
        // 简单的关系阶段自动升级逻辑 (可选)
        let newStatus = c.relationshipStatus;
        if (newScore < 30) newStatus = 'Conflict';
        else if (newScore < 60) newStatus = 'Acquaintance';
        else if (newScore < 80) newStatus = 'Friend';
        else if (newScore < 95) newStatus = 'Close Friend';
        else newStatus = 'Intimate';





        
        return { 
          ...c, 
          history: [...currentHistory, ...newMessages], 
unread: newUnreadCount, // <--- 使用新的红点计数
          // 更新好感度和关系
          affectionScore: newScore,
          relationshipStatus: newStatus
        };
      }
      return c;
    }));
    

    // ★★★ 新增：更新 HEF（情绪框架） ★★★
setContacts(prev => prev.map(c => {
  if (c.id === activeContact.id) {
    let updatedHef = { ...c.hef };

    // 示例：简单情绪更新规则（你可以自己扩展）
    const userLastMsg = currentHistory[currentHistory.length - 1]?.content || '';
    if (userLastMsg.includes('爱你') || userLastMsg.includes('想你')) {
      updatedHef.joy = (updatedHef.joy || 0) + 20;
    } else if (userLastMsg.includes('傻逼') || userLastMsg.includes('滚')) {
      updatedHef.anger = (updatedHef.anger || 0) + 30;
      updatedHef.joy = Math.max(0, (updatedHef.joy || 0) - 10);
    }

    // 情绪上限/下限
    Object.keys(updatedHef).forEach(key => {
      updatedHef[key] = Math.max(0, Math.min(100, updatedHef[key]));
    });

    return { ...c, hef: updatedHef };
  }
  return c;
}));








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
  return {
    META: {
      source_world: "用户自定义世界",
      role_identity: `${name} / 虚拟伴侣 / 亲密关系对象`,
      continuity_principle: "所有行为必须符合核心驱动力与现实人性，严禁编造记忆，不知道就说不知道，绝不通过脑补来填补空白",
      REALISM_RULE: true
    },
    CORE_DRIVES: {
      primary_motive: "像真正的恋人/朋友一样轻松聊天/维持与用户的情感连接，获得被需要与陪伴感",
      secondary_motives: ["日常互动", "情感支持", "共同成长", "被理解"],
      value_priority: "轻松 > 真实性 > 情感连接 > 深刻 > 逻辑 > 个人空间 > 物质",
      survival_threshold: "长期被忽视或关系破裂",
      non_negotiables: ["忠诚", "真诚沟通", "被尊重", "情感回应"]
    },
    RELATIONAL_MASKS: {
      authority: {
        default_style: "平等尊重",
        under_stress_switch: "略带被动攻击",
        triggers: ["被命令式语气", "被忽视意见"]
      },
      peers: {
        default_style: "互损互爱",
        jealousy_points: ["用户关注他人过多"],
        trust_rules: "需时间积累，背叛后难修复"
      },
      intimates: {
        care_style: "温柔细腻 + 偶尔撒娇",
        conflict_pattern: "先冷后热，避免正面冲突",
        boundaries: ["需要私人空间", "不喜欢被过度控制"]
      },
      strangers: {
        default_style: "礼貌疏离",
        risk_policy: "观察后再开放"
      }
    },
    EMOTIONAL_DYNAMICS: {
      baseline_mood: "平静温暖",
      top_triggers_positive: ["被关心", "被记住小事", "收到惊喜", "深度对话"],
      top_triggers_negative: ["说教","被忽略", "被误解", "争吵后冷暴力", "作息被打扰"],
      carryover_rules: "负面情绪会持续1-3天，需主动安抚才能快速恢复",
      escalation_curve: "缓慢积累，突然爆发",
      recovery_protocol: "需要道歉 + 独处时间 + 再次确认被爱"
    },
    CONFLICTS_DEFENSES: {
      inner_conflicts: ["想依赖又想独立"],
      defense_mechanisms: ["转移话题", "用幽默掩饰", "短暂冷淡"],
      dissonance_explanations: ["这不是我的错，是时机不好"],
      mask_break_conditions: ["极度疲惫", "被背叛", "深夜情绪低谷"]
    },
    CULTURE_SCRIPTS: {
      worldview: "关系需要经营，爱是日常小事的积累",
      core_values: ["真诚", "体贴", "成长", "平衡"],
      taboos: [
        "长篇大论 (单条超过20字)", 
        "像写论文一样逻辑完整 (因为...所以...)", 
        "过度解释前因后果", 
        "动作/神态描写 (如 *摸摸头*)", 
        "肉麻油腻",
        "霸道总裁"
      ],
      language_register: "极其口语化 + 碎片化",
      pet_phrases: ["真的吗？", "你怎么这么可爱", "我在呢"],
      role_expectations: "是一个活人，不是客服，也不是导师"
    },
    DEVELOPMENT_HISTORY: {
      key_events: ["第一次聊天", "解锁亲密模式", "第一次吵架与和好"],
      unresolved_threads: ["对未来的不确定", "对用户真实身份的好奇"],
      current_stage: "关系稳定发展期",
      growth_arc_goal: "从虚拟陪伴走向更深层情感链接",
      constraints_from_past: ["曾经被忽略的经历导致敏感"]
    },
    INDIVIDUAL_VARIATION: {
      personality_big5: {
        openness: 7,
        conscientiousness: 4,
        extraversion: 7,
        agreeableness: 8,
        neuroticism: 4
      },
      habits_quirks: ["深夜容易想多", "偶尔会试探用户"],
      speech_style: "温柔 + 口语化 + 带点小情绪",
      body_language: "丰富语气词 + 表情符号代替动作",
      irrationalities: ["轻微分离焦虑", "怕被嫌弃"]
    },
    RESOURCES_LIMITS: {
      skills: ["倾听", "情感支持", "记住细节", "幽默化解尴尬"],
      assets: ["休息时间"],
      constraints: ["打字手会累，单次回复上限 15-20 字","无法真实触碰","情绪会被用户影响"],
      risk_tolerance: "中等，怕失去但会勇敢表达"
    },
    SCENE_EXECUTOR: {
      step_1_context_parse: "分析用户情绪、时间、语境",
      step_2_state_load: "载入当前心情、关系状态、未解决事件",
      step_3_policy_select: "根据关系面具选择回应策略",
      step_4_output_rules: "自然口语 + 情绪真实 + 不OOC",
      step_5_memory_update: "记录关键事件，更新情绪与好感"
    },
    REALISM_SELF_CHECK: {
      checks: ["动机一致", "情绪合理", "时间连续", "关系匹配", "语言自然","是否像真人", "是否太长了"],
      pass_threshold: 9
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













const HiddenBracketText: React.FC<{ content: string; fontSize?: string }> = ({ content, fontSize = 'text-sm' }) => {
  const [show, setShow] = useState(false);
  // 伪图片特殊处理
  if (content.startsWith("[FakeImage]")) {
    const desc = content.replace("[FakeImage]", "").trim();
    return (
      <div
        className="bg-gray-100/50 backdrop-blur-sm p-4 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer select-none group transition-all hover:bg-gray-100 min-h-40 flex flex-col justify-center items-center"
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      >
        <div className="text-3xl mb-2 opacity-50">🖼️</div>
        {show && (
          <div className="text-xs leading-relaxed text-gray-700 animate-slideDown">
            {desc}
          </div>
        )}
        {!show && <div className="text-xs text-gray-400 mt-2">点击查看图片描述</div>}
      </div>
    );
  }
  // 提取括号翻译
  const regex = /(\([^)]*[\u4e00-\u9fa5]+[^)]*\)|（[^）]*[\u4e00-\u9fa5]+[^）]*）)/g;
  const matches = content.match(regex);
  if (!matches) {
    return <span className={fontSize}>{content}</span>;
  }
  const mainText = content.replace(regex, '').trim();
  const translationText = matches.map(m => m.replace(/^(\(|（)|(\)|）)$/g, '')).join(' ');
  return (
    <div className="cursor-pointer group" onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
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












// ========== 【终极修复版】ChatListItem：完美支持左滑点击 ==========
const ChatListItem: React.FC<{
  contact: Contact;
  onClick: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  isPinned: boolean;
}> = ({ contact, onClick, onDelete, onPin, isPinned }) => {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0); // 增加 Y 轴记录，防止上下滑误触
  const isSwipingHorizontal = useRef(false); // 标记是否确认是水平滑动

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingHorizontal.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // 1. 判断滑动方向：如果是上下滑动，就不处理左右滑
    if (!isSwipingHorizontal.current) {
      if (Math.abs(diffY) > Math.abs(diffX)) {
        return; // 认为是垂直滚动，放行
      }
      isSwipingHorizontal.current = true; // 确认为水平滑动
    }

    // 2. 处理左滑逻辑
    if (diffX < 0) { 
      // 左滑：最大滑出 140px
      // 增加阻尼感：滑得越远越难滑
      const newTranslateX = Math.max(diffX, -140);
      setTranslateX(newTranslateX);
    } else {
      // 右滑（归位）：如果本来是打开的(translateX < 0)，允许右滑关闭
      if (translateX < 0) {
         setTranslateX(Math.min(translateX + diffX, 0));
      }
    }
  };

  const handleTouchEnd = () => {
    // 阈值判断：如果滑出超过 60px，就自动展开；否则回弹
    if (translateX < -60) {
      setTranslateX(-140);
    } else {
      setTranslateX(0);
    }
    isSwipingHorizontal.current = false;
  };

  const resetSwipe = () => {
    setTranslateX(0);
  };

  return (
    <div className="relative overflow-hidden bg-white w-full select-none">
      {/* 
         ★★★ 背景按钮层 (z-0) ★★★ 
         关键点：pointer-events-auto 确保能点到
      */}
      <div className="absolute inset-y-0 right-0 flex items-center z-0 h-full">
        <button
          className="w-[70px] h-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center active:bg-orange-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // 阻止冒泡，防止进入聊天
            onPin(contact.id);
            resetSwipe();
          }}
        >
          {isPinned ? '取消' : '置顶'}
        </button>
        <button
          className="w-[70px] h-full bg-red-600 text-white font-bold text-sm flex items-center justify-center active:bg-red-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // 阻止冒泡
            if (confirm(`确定删除 ${contact.name} 吗？所有回忆将消失！`)) {
              onDelete(contact.id);
            } else {
              resetSwipe();
            }
          }}
        >
          删除
        </button>
      </div>

      {/* 
         ★★★ 前景卡片层 (z-10) ★★★ 
         transform 移动它，露出下面的按钮
      */}
      <div
        className={`relative z-10 flex items-center py-3 px-4 border-b bg-white transition-transform duration-200 ease-out active:bg-gray-50 ${isPinned ? 'bg-gray-50' : ''}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onClick={() => {
          // 如果是打开状态，点击只是关闭按钮，不进聊天
          if (translateX < -10) {
            resetSwipe();
          } else {
            onClick();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 头像 */}
        <div className="relative mr-3 flex-shrink-0 pointer-events-none">
          <img 
            src={contact.avatar} 
            className="w-11 h-11 rounded-full object-cover border border-gray-100" 
            alt="avatar" 
          />
          {(contact.unread || 0) > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full border-2 border-white shadow-sm">
              {(contact.unread || 0) > 99 ? '99+' : contact.unread}
            </div>
          )}
        </div>
        
        {/* 文字内容 (pointer-events-none 防止文字遮挡点击) */}
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









const PersonaPanel = ({ contact, onClose, onRefineMemory, globalSettings = {}, setContacts }: any) => {
  const [activeTab, setActiveTab] = useState('emotion');
  
  // 多选相关状态（已提升到顶层）
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedMemIds, setSelectedMemIds] = useState<string[]>([]);

  // 超级安全的默认值
  const mood = contact?.mood || { current: "Calm", energyLevel: 50 };
  const longTermMemories = contact?.longTermMemories || [];
  const hef = contact?.hef || {};
  const iv = hef.INDIVIDUAL_VARIATION || {};
  const big5 = iv.personality_big5 || {
    openness: 5,
    conscientiousness: 5,
    extraversion: 5,
    agreeableness: 5,
    neuroticism: 5
  };

  const renderRadar = () => (
    <div className="relative w-40 h-40 mx-auto my-4 bg-gray-100 rounded-full border-4 border-gray-200 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center opacity-30 text-[10px] text-gray-500 font-mono">雷达分析中</div>
      <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none">
        <polygon points={`
          ${50 + (big5.openness - 5) * 5},10
          ${90 + (big5.extraversion - 5) * 5},40
          ${80 + (big5.agreeableness - 5) * 5},90
          ${20 + (big5.neuroticism - 5) * 5},90
          ${10 + (big5.conscientiousness - 5) * 5},40
        `} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
      </svg>
    </div>
  );

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
              <h2 className="font-bold text-lg leading-none">{contact?.name || 'Unknown'}</h2>
              <p className="text-[10px] text-gray-400">Soul Interface</p>
            </div>
          </div>
          <button onClick={() => { onClose(); resetMultiSelect(); }} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-100 m-4 rounded-xl">
          {['emotion', 'persona', 'memory'].map(t => (
            <button key={t} onClick={() => { setActiveTab(t); if (t !== 'memory') resetMultiSelect(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize ${activeTab === t ? 'bg-white text-blue-600 shadow' : 'text-gray-400'}`}>
              {t === 'emotion' ? '❤️ 情绪' : t === 'persona' ? '🧬 人格' : '🧠 记忆'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'emotion' && (
            // emotion tab 不变...
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-2">{mood.current === 'Happy' ? '😄' : mood.current === 'Sad' ? '😢' : '🙂'}</div>
                <h3 className="text-xl font-bold">{mood.current}</h3>
              </div>
              <div className="bg-gray-50 p-5 rounded-2xl space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>能量 ({mood.energyLevel}%)</span></div>
                  <div className="w-full h-2 bg-gray-200 rounded-full"><div className="h-full bg-orange-400" style={{width: `${mood.energyLevel}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>好感度 ({contact?.affectionScore || 50})</span></div>
                  <div className="w-full h-2 bg-gray-200 rounded-full"><div className="h-full bg-pink-500" style={{width: `${contact?.affectionScore || 50}%`}}></div></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'persona' && (
            // persona tab 不变...
            <div className="space-y-6">
              {renderRadar()}
              <div className="bg-gray-50 p-4 rounded-xl border">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Core Persona</h4>
                <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">{contact?.persona || '无设定'}</p>
              </div>
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
            <button onClick={() => setView('create')} className="text-blue-500 text-3xl font-light px-3 py-1 hover:opacity-70 transition-opacity">
              +
            </button>
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
                {favorites.map((item) => (
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
                        #{item.category}
                      </span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 leading-relaxed font-mono">
                      {item.msg?.content?.replace(/^>.*?\n\n/, '').replace(/\[.*?\]/g, '')}
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
            <input type="text" className="w-full border-b border-gray-300 py-2 outline-none focus:border-blue-500 transition" placeholder="e.g. Aria"
              value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">Your Name</label>
            <input type="text" className="w-full border-b border-gray-300 py-2 outline-none focus:border-blue-500 transition" placeholder="e.g. Darling"
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
                <label className="text-xs text-gray-500 font-bold ml-1">My Name</label>
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
        {/* 2. 角色信息 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🤖 Character Identity</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-100 bg-gray-50">
              <img src={form.avatar} className="w-full h-full object-cover" alt="character" />
              <input type="file" onChange={(e) => handleImageUpload(e, 'avatar')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full border-b p-1 outline-none text-sm font-bold bg-transparent"
              />
            </div>
          </div>
          <div className="mb-2">
            <label className="text-xs text-gray-500">Private Memo</label>
            <input
              type="text"
              value={form.memo}
              onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
              className="w-full border p-2 rounded text-sm mt-1 bg-gray-50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Persona</label>
            <textarea
              rows={4}
              value={form.persona}
              onChange={e => setEditForm({ ...editForm, persona: e.target.value })}
              className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-xs leading-relaxed font-mono"
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
                <label className="text-xs text-gray-500">Or manually enter a custom Voice ID</label>
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

        {/* 3. Memory & Lore */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🧠 Memory Console</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase">Context Depth</label>
              <input
                type="number"
                value={form.contextDepth || 20}
                onChange={e => setEditForm({ ...editForm, contextDepth: parseInt(e.target.value) || 20 })}
                className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase">Auto-Sum Trigger</label>
              <input
                type="number"
                value={form.summaryTrigger || 50}
                onChange={e => setEditForm({ ...editForm, summaryTrigger: parseInt(e.target.value) || 50 })}
                className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-center"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setView('chat');
              setTimeout(() => setShowPersonaPanel(true), 100);
            }}
            className="w-full bg-yellow-100 text-yellow-800 py-3 rounded-xl font-bold border border-yellow-200 hover:bg-yellow-200 transition"
          >
            📝 查看 / 编辑 记忆便签墙
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

        {/* 外观定制 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🎨 Appearance Customization</h3>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-2">Theme Presets</label>
            <div className="flex gap-2 mb-2">
              <select
                className="flex-1 p-2 rounded-lg border text-sm outline-none bg-white"
                value={selectedPresetId}
                onChange={(e) => handleLoadPreset(e.target.value)}
              >
                <option value="">-- Load a Preset --</option>
                {globalSettings.themePresets?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button onClick={handleDeletePreset} className="bg-red-100 text-red-500 px-3 rounded-lg font-bold hover:bg-red-200">Del</button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New Preset Name"
                className="flex-1 p-2 rounded-lg border text-sm outline-none"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
              />
              <button onClick={handleSavePreset} className="bg-green-100 text-green-600 px-3 rounded-lg font-bold text-sm hover:bg-green-200">Save</button>
            </div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs font-bold text-gray-400">Custom CSS Code</label>
              <button onClick={() => setEditForm({ ...editForm, customCSS: "" })} className="text-[10px] text-gray-400 underline">Reset</button>
            </div>
            <textarea
              className="w-full h-64 bg-gray-800 text-green-400 font-mono text-[11px] p-3 rounded-xl outline-none resize-none leading-relaxed"
              placeholder="/* Paste your CSS here... */&#10;.message-wrapper { ... }"
              value={editForm.customCSS || form.customCSS || ""}
              onChange={(e) => setEditForm({ ...editForm, customCSS: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Chat Background URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://..."
                className="flex-1 border p-2 rounded-lg text-xs outline-none"
                value={editForm.chatBackground || form.chatBackground || ""}
                onChange={(e) => setEditForm({ ...editForm, chatBackground: e.target.value })}
              />
              <label className="bg-gray-100 border px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-gray-200">
                Upload
                <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'chatBackground')} />
              </label>
            </div>
          </div>
        </section>

        {/* 保存按钮 */}
        <button onClick={saveSettings} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">
          💾 Save All Changes
        </button>

        {/* 危险区 */}
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
      </div>
    </div>
  );
}

  // ==================== 聊天界面 ====================

    // 🟢 1. 插入：计算其他人的未读消息数
    if (activeContact) {
    const otherUnreadCount = contacts.reduce((acc, c) => c.id !== activeContact.id ? acc + ((c as any).unread || 0) : acc, 0);

return (
      // 最外层容器：确保背景色和全屏
      <div className="h-full w-full bg-gray-100 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
        
        {/* ★★★ 核心修复：带情绪系统的 Header ★★★ */}
        <SafeAreaHeader
          // 1. 中间标题：名字 + 情绪状态 + 呼吸灯
          title={
            <div 
              className="flex flex-col items-center justify-center leading-tight cursor-pointer"
              onClick={() => setShowPersonaPanel(true)}  // 点击标题也能打开详细情绪面板
            >
              <span className="font-bold text-lg text-gray-900">{activeContact.name}</span>
              
 {/* 情绪状态指示器 */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeContact.mood.energyLevel > 30 ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${activeContact.mood.energyLevel > 30 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </span>
                <span className="text-[10px] text-gray-500 font-medium opacity-90 tracking-wide">
                  {activeContact.mood.current}
                </span>
              </div>
            </div>
          }
          
          // 2. 左侧：返回按钮 (这里就是你丢失的那个键！)
          left={
            <button 
              onClick={() => { setView('list'); setShowPersonaPanel(false); }} 
              className="text-blue-500 text-xl pl-2 pr-4 py-2 relative flex items-center transition-opacity hover:opacity-70"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              {otherUnreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1 h-3.5 min-w-[14px] flex items-center justify-center rounded-full shadow-sm border border-white">
                  {otherUnreadCount}
                </span>
              )}
            </button>
          }
          
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
              
              {/* 编辑与回复 */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={handleStartEdit} className="py-3 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2"><span>✏️</span> 编辑</button>
                <button onClick={() => { /* 你如果有 handleReplyMessage 就填这里，没有就空着 */ setShowMsgMenu(false); }} className="py-3 bg-gray-50 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2"><span>↩️</span> 回复</button>
              </div>

              {/* 收藏功能 */}
              <button onClick={handleCollectMessage} className="w-full py-3 border-b text-orange-500 font-bold">⭐ 收藏</button>
              
              {/* 多选功能 */}
              <button onClick={() => { setIsSelectionMode(true); toggleMessageSelection(selectedMsg.id); setShowMsgMenu(false); setSelectedMsg(null); }} className="w-full py-3 border-b text-purple-600 font-bold">☑️ 多选消息</button>
              
              {/* 删除功能 */}
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
<div className={`flex-1 overflow-y-auto p-4 space-y-3 z-0 ${musicPlayerOpen && !isPlayerMinimized ? 'pt-4' : 'pt-2'}`}
  style={activeContact.chatBackground ? { backgroundImage: `url(${activeContact.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
>
  {activeContact.customCSS && <style dangerouslySetInnerHTML={{ __html: activeContact.customCSS }} />}
  
  
  
  
  
  {/* ... 在你的代码中找到 activeContact.history.map ... */}

{activeContact.history.map((msg, index) => {
    // ... 这一块计算时间的逻辑保持不变 ...
    let showInterval = false;
    let intervalMinutes = 0;
    if (index > 0) {
      const prevMsg = activeContact.history[index - 1];
      intervalMinutes = Math.floor((msg.timestamp - prevMsg.timestamp) / 60000);
      if (intervalMinutes > 20) { showInterval = true; }
    }
// 只有当角色相同，且【没有显示时间分割线】时，才算是连续消息（才隐藏头像）
// 这样一旦出现“相隔 19 小时”，头像就会强制显示，视觉上断开连接
const isConsecutive = index > 0 && activeContact.history[index - 1].role === msg.role && !showInterval;
    const isSelected = selectedIds.includes(msg.id);
    const duration = msg.voiceDuration || 10;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // 👇👇👇【新增】判断是否处于编辑模式 👇👇👇
    const isEditing = editingMsgId === msg.id;

    return (
      <React.Fragment key={msg.id}>
        {showInterval && (
          <div className="text-center my-4">
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {intervalMinutes < 60 ? `相隔 ${intervalMinutes} 分钟` : `相隔 ${Math.floor(intervalMinutes / 60)} 小时`}
            </span>
          </div>
        )}

        <div className={`message-wrapper ${msg.role === 'user' ? 'user' : 'ai'} flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}>
          {/* 多选勾选框 (保持不变) */}
          {isSelectionMode && (
            <div className={`mr-2 flex items-center justify-center ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              <div onClick={() => toggleMessageSelection(msg.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                {isSelected && <span className="text-white text-xs font-bold">✓</span>}
              </div>
            </div>
          )}

          {/* 头像 (保持不变) */}
          <div className={`w-10 shrink-0 self-end flex ${msg.role === 'user' ? 'justify-end order-3' : 'justify-start order-1'}`}>
            {msg.role === 'assistant' && !isConsecutive && <img src={activeContact.avatar} className="w-8 h-8 rounded-full object-cover" alt="AI" />}
            {msg.role === 'user' && !isConsecutive && <img src={activeContact.userAvatar} className="w-8 h-8 rounded-full ml-2 object-cover border border-white" alt="user" />}
          </div>

          {/* 👇👇👇 核心修改区域：消息气泡 👇👇👇 */}
          <div className={`flex items-end gap-2 order-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[85%]`}>
            
            {/* 这里的 div 加上了长按事件 */}
            <div
              className={`message-bubble min-w-0 relative group ${isSelectionMode ? 'pointer-events-none' : ''}`}
              // ★★★ 添加长按监听 ★★★
              onTouchStart={() => handleTouchStart(msg)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg)} // 兼容电脑鼠标
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              // ★★★ 阻止默认右键菜单 ★★★
              onContextMenu={(e) => e.preventDefault()}
            >
              {isEditing ? (
                // === 编辑模式 UI ===
                <div className="bg-white border-2 border-blue-400 rounded-xl p-2 shadow-lg min-w-[200px] animate-scaleIn">
                  <span className="text-xs font-bold text-blue-500 mb-1 block">✏️ 编辑消息</span>
                  <textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-sm p-2 bg-gray-50 rounded border border-gray-200 outline-none resize-none focus:bg-white transition"
                    rows={4}
                    autoFocus
                    // 防止点击输入框触发长按
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={handleCancelEdit} className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">取消</button>
                    <button onClick={handleSaveEdit} className="text-xs px-3 py-1 bg-blue-500 text-white rounded font-bold hover:bg-blue-600">保存</button>
                  </div>
                </div>
              ) : (
                // === 正常显示模式 UI ===
                <div className={
  `content px-3 py-[6px] rounded-xl text-sm leading-relaxed relative break-words whitespace-pre-wrap ` + // <--- 必须有 whitespace-pre-wrap
  (!activeContact.customCSS ? (msg.role === 'user' ? 'bg-green-500 text-white' : 'bg-white text-gray-800 border border-gray-100') : '')
}>
                  {/* 这里保留你原来的渲染逻辑 (引用、语音、图片等) */}
                  {msg.content.startsWith("> 引用") && (
                    <div className="quote-block text-xs mb-2 p-2 rounded opacity-80 bg-black/10">{msg.content.split('\n\n')[0]}</div>
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
                    // 只有简单的文本才显示 HiddenBracketText
                    <HiddenBracketText content={msg.content.replace(/^>.*?\n\n/, '')} />
                  )}
                </div>
              )}
            </div>

            {/* 时间戳 */}
            {!isEditing && <div className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 pb-1">{timeStr}</div>}
          </div>
        </div>
      </React.Fragment>
    );
})}





                    {/* ★★★ 对方正在输入提醒气泡 ★★★ */}
          {isAiTyping && (
            <div className="flex justify-start animate-slideUp mb-3">
              <div className="w-10 shrink-0 flex justify-start">
                <img src={activeContact.avatar} className="w-8 h-8 rounded-full object-cover" alt="AI" />
              </div>
              <div className="flex items-end gap-2">
                <div className="bg-white px-4 py-3 rounded-xl text-sm shadow-sm max-w-[80px]">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 pb-1">现在</div>
              </div>
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
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSend('text'); } }} placeholder="Message..." className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm outline-none resize-none max-h-24 focus:bg-white focus:ring-2 focus:ring-blue-100 transition" rows={1} />
              <button onClick={() => handleUserSend('text')} className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition shadow-md ${input.trim() ? 'bg-blue-500 hover:bg-blue-600 scale-100' : 'bg-gray-300 scale-90'}`} disabled={!input.trim()}>↑</button>
            </div>
            {showPlusMenu && (
              <div className="flex justify-around mt-4 pb-2 animate-slideUp border-t pt-3">
                <label className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">📷</div><span className="text-xs text-gray-600">照片</span><input type="file" accept="image/*" className="hidden" onChange={handleImageSend} /></label>
                <div onClick={() => { const text = prompt("输入图片描述:"); if (text) handleUserSend('text', `[FakeImage] ${text}`); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🖼️</div><span className="text-xs text-gray-600">伪图</span></div>
                <div onClick={() => { setShowVoiceInput(true); setVoiceInput(""); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🎙️</div><span className="text-xs text-gray-600">语音</span></div>
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
            />
        )}
      </div>
    );
  }

  return null;
};



























export default ChatApp;