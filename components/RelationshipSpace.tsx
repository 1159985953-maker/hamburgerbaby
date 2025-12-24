import React, { useState, useEffect, useRef } from 'react';
import { Contact, LoveLetter, QAEntry, Message, GlobalSettings } from '../types';
import SafeAreaHeader from './SafeAreaHeader';
import { generateResponse } from '../services/apiService'; 

// ==================== 1. 定义部分 (花语 & 主题) ====================

const SEED_TYPES = [
  { id: 'rose', name: '红玫瑰', color: 'text-rose-500', bg: 'bg-rose-100', emoji: '🌹', desc: '热烈而唯一的爱' },
  { id: 'sunflower', name: '向日葵', color: 'text-yellow-500', bg: 'bg-yellow-100', emoji: '🌻', desc: '眼中只有你' },
  { id: 'lily', name: '百合花', color: 'text-slate-500', bg: 'bg-slate-100', emoji: '🪷', desc: '纯洁的羁绊' },
  { id: 'bluebell', name: '蓝风铃', color: 'text-blue-500', bg: 'bg-blue-100', emoji: '🪻', desc: '温柔的守候' },
  { id: 'sakura', name: '樱花', color: 'text-pink-400', bg: 'bg-pink-100', emoji: '🌸', desc: '浪漫的约定' },
  { id: 'cactus', name: '仙人掌', color: 'text-green-600', bg: 'bg-green-100', emoji: '🌵', desc: '坚定的守护' },
];

const getTheme = (status: string) => {
  switch (status) {
    case 'Honeymoon':
    case 'Stable':
      return { bg: 'bg-gradient-to-b from-pink-50 via-rose-50 to-white', primary: 'text-rose-600', accent: 'bg-rose-500', border: 'border-rose-200', cardBg: 'bg-white/80', title: '恋人空间', icon: '💖' };
    case 'Friend':
    case 'Acquaintance':
      return { bg: 'bg-gradient-to-b from-sky-50 via-blue-50 to-white', primary: 'text-sky-600', accent: 'bg-sky-500', border: 'border-sky-200', cardBg: 'bg-white/80', title: '密友基地', icon: '✨' };
    default:
      return { bg: 'bg-gray-50', primary: 'text-purple-600', accent: 'bg-purple-500', border: 'border-purple-200', cardBg: 'bg-white', title: '关系空间', icon: '🌱' };
  }
};

// ==================== 2. 子组件部分 ====================

// 📮 时光信箱 (含写信按钮)
const MailboxWidget: React.FC<{ 
    letters: LoveLetter[], 
    theme: any, 
    onOpenLetter: (l: LoveLetter) => void,
    onWriteLetter: () => void 
}> = ({ letters = [], theme, onOpenLetter, onWriteLetter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = letters.filter(l => !l.isOpened && l.from === 'ai').length;

  return (
    <div className="flex flex-col items-center justify-center py-6 relative select-none">
      {/* 右上角写信按钮 */}
      <div className="absolute top-0 right-0 z-30">
          <button 
            onClick={(e) => { e.stopPropagation(); onWriteLetter(); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm bg-white border border-gray-100 flex items-center gap-1 hover:bg-gray-50 transition active:scale-95 ${theme.primary}`}
          >
              <span>✍️</span> 写信
          </button>
      </div>

      {/* 信箱主体 */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-40 h-48 cursor-pointer transition-transform duration-500 ease-out ${isOpen ? 'scale-105' : 'hover:scale-105 active:scale-95'}`}
      >
        <div className={`absolute top-0 left-0 w-full h-1/3 z-20 rounded-t-2xl shadow-sm border-b-2 border-black/5 transition-all duration-700 origin-top ${theme.accent} ${isOpen ? 'rotate-x-180 -translate-y-6 opacity-0' : ''}`} style={{ transformStyle: 'preserve-3d' }}></div>
        <div className={`absolute inset-0 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border-4 border-white ${theme.accent}`}>
           <div className="text-6xl filter drop-shadow-md transform translate-y-2">📮</div>
           <div className={`absolute -right-3 top-12 w-1.5 h-16 bg-red-500 origin-bottom transition-all duration-700 border border-white/50 rounded-full shadow-md ${unreadCount > 0 ? 'rotate-0' : 'rotate-90 translate-x-4'}`}>
              <div className="w-5 h-3 bg-red-500 absolute -top-1 -left-1.5 rounded-sm shadow-sm border border-white/50"></div>
           </div>
        </div>
        {unreadCount > 0 && !isOpen && (
            <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white z-30 animate-bounce shadow-md">
                {unreadCount}
            </div>
        )}
      </div>

      {/* 信件列表 (展开动画) */}
      <div className={`w-full max-w-[90%] transition-all duration-700 ease-out overflow-hidden flex flex-col items-center ${isOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
          {letters.length === 0 ? (
              <div className="text-center text-gray-400 text-xs italic bg-white/50 p-4 rounded-xl border border-dashed border-gray-300 w-full">
                  信箱里空空的...<br/>(快给TA写下第一封信吧)
              </div>
          ) : (
              <div className="space-y-2 w-full pb-2">
                  {[...letters].reverse().map((letter, idx) => (
                      <div key={letter.id} onClick={() => onOpenLetter(letter)} className={`bg-white p-3 rounded-xl shadow-md border-l-4 cursor-pointer transform transition-all duration-500 hover:-translate-y-1 hover:shadow-lg flex items-center gap-3 ${letter.isOpened ? 'border-gray-200' : 'border-red-400'}`} style={{ animation: isOpen ? `slideDown 0.5s ease-out ${idx * 0.1}s backwards` : 'none' }}>
                          <div className="text-2xl">{letter.from === 'user' ? '📤' : (letter.isOpened ? '📨' : '💌')}</div>
                          <div className="flex-1 min-w-0">
                              <h4 className={`font-bold text-sm truncate ${letter.isOpened || letter.from === 'user' ? 'text-gray-600' : 'text-gray-900'}`}>
                                  {letter.from === 'user' ? `致TA: ${letter.title}` : letter.title}
                              </h4>
                              <p className="text-[10px] text-gray-400">{new Date(letter.timestamp).toLocaleDateString()}</p>
                          </div>
                          {letter.from === 'ai' && !letter.isOpened && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

// 🃏 问答卡片 (落子无悔版)
const QACardStack: React.FC<{ questions: QAEntry[], theme: any, onAnswer: (id: string, ans: string) => void }> = ({ questions = [], theme, onAnswer }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [answerInput, setAnswerInput] = useState("");
    
    // 排序：未回答的优先
    const sortedQuestions = [...questions].sort((a, b) => {
        if (!a.userAnswer && b.userAnswer) return -1;
        if (a.userAnswer && !b.userAnswer) return 1;
        return b.timestamp - a.timestamp;
    });

    if (sortedQuestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center opacity-60 border-2 border-dashed border-gray-300 rounded-2xl bg-white/30">
                <span className="text-4xl mb-2 grayscale">🃏</span>
                <p className="text-xs">还没有收到灵魂拷问哦</p>
            </div>
        );
    }
    const currentQ = sortedQuestions[activeIndex];
    
    return (
        <div className="relative w-full perspective-1000">
            <div className={`absolute top-3 left-2 right-2 h-64 bg-white/50 rounded-2xl border ${theme.border} transform scale-95 translate-y-2 z-0`}></div>
            <div className={`relative h-auto min-h-[16rem] bg-white rounded-2xl shadow-xl border ${theme.border} p-5 flex flex-col justify-between z-10 transition-all duration-300`}>
                 <div>
                     <div className="flex justify-between items-center mb-4">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">QUESTION CARD</span>
                         <span className="text-[10px] text-gray-300 font-mono">{activeIndex + 1} / {sortedQuestions.length}</span>
                     </div>
                     <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                        <h3 className="text-base font-black text-gray-800 leading-snug">“{currentQ.question}”</h3>
                     </div>
                 </div>
                 {currentQ.userAnswer ? (
                     <div className={`p-3 rounded-xl border border-dashed ${theme.border} bg-${theme.bg ? theme.bg.split('-')[2] : 'gray'}-50`}>
                         <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase">我的回答 (已存档):</p>
                         <p className={`text-sm font-medium ${theme.primary}`}>“{currentQ.userAnswer}”</p>
                     </div>
                 ) : (
                     <div className="animate-fadeIn">
                         <textarea 
                            className="w-full bg-gray-50 rounded-xl p-3 text-sm outline-none resize-none h-20 mb-2 focus:ring-2 focus:ring-opacity-50 transition-all placeholder-gray-300" 
                            placeholder="写下你的答案 (落子无悔)..." 
                            value={answerInput} 
                            onChange={e => setAnswerInput(e.target.value)}
                         />
                         <button 
                            onClick={() => { if(!answerInput.trim()) return; onAnswer(currentQ.id, answerInput); setAnswerInput(""); }} 
                            className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-md transition-all active:scale-95 hover:shadow-lg ${theme.accent}`}
                         >
                            提交回答
                         </button>
                     </div>
                 )}
            </div>
            {sortedQuestions.length > 1 && (
                <div className="flex justify-center gap-6 mt-4">
                    <button onClick={() => setActiveIndex(prev => prev > 0 ? prev - 1 : sortedQuestions.length - 1)} className="w-10 h-10 rounded-full bg-white shadow-md text-gray-400 border border-gray-100 hover:text-gray-600 active:scale-90 transition-all flex items-center justify-center">←</button>
                    <button onClick={() => setActiveIndex(prev => prev < sortedQuestions.length - 1 ? prev + 1 : 0)} className="w-10 h-10 rounded-full bg-white shadow-md text-gray-400 border border-gray-100 hover:text-gray-600 active:scale-90 transition-all flex items-center justify-center">→</button>
                </div>
            )}
        </div>
    );
};

// 🧚‍♀️ 花朵精灵 (小分身)
const FlowerChatWidget: React.FC<{ contact: Contact, seedInfo: any, onUpdate: (history: any[]) => void, globalSettings: any }> = ({ contact, seedInfo, onUpdate, globalSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const history = contact.garden?.flowerHistory || [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input, timestamp: Date.now() };
    const newHistory = [...history, userMsg];
    onUpdate(newHistory); 
    setInput("");
    setIsTyping(true);

    try {
      const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
      const prompt = `
你不是AI助手，你是一朵【${seedInfo.name}】的小花精灵。
你的主人是 "${contact.userName}" 和 "${contact.name}"。
你一直静静地看着他们相处。
你的性格：可爱、治愈、稍微有点八卦、非常维护他们的关系。
请用简短、可爱的语气回复主人。
历史对话：
${newHistory.slice(-5).map((m: any) => `${m.role}: ${m.content}`).join('\n')}
User: ${input}`;

      const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
      const aiMsg = { role: 'assistant', content: res, timestamp: Date.now() };
      onUpdate([...newHistory, aiMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <div className="absolute top-16 right-4 z-20 flex flex-col items-end">
         {!isOpen && history.length > 0 && history[history.length-1].role === 'assistant' && (
             <div onClick={() => setIsOpen(true)} className="bg-white px-3 py-2 rounded-l-xl rounded-tr-xl shadow-md border border-green-100 text-[10px] text-gray-600 mb-1 animate-bounce cursor-pointer max-w-[120px] truncate">
                 {history[history.length-1].content}
             </div>
         )}
         <div onClick={() => setIsOpen(!isOpen)} className="text-4xl cursor-pointer filter drop-shadow-lg hover:scale-110 transition-transform animate-pulse-slow">
             {seedInfo.emoji}
         </div>
      </div>

      {isOpen && (
        <div className="absolute top-28 right-4 w-64 h-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 flex flex-col z-30 overflow-hidden animate-scaleIn origin-top-right">
           <div className="bg-green-50 p-2 flex justify-between items-center border-b border-green-100">
              <span className="text-xs font-bold text-green-700 ml-2">🧚‍♀️ 花朵精灵</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 px-2">×</button>
           </div>
           <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar" ref={scrollRef}>
              {history.length === 0 && <div className="text-center text-[10px] text-gray-400 mt-4">我是你们种下的{seedInfo.name}，<br/>我见证了你们所有的故事哦~</div>}
              {history.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-700 rounded-bl-none'}`}>
                          {msg.content}
                      </div>
                  </div>
              ))}
              {isTyping && <div className="text-[10px] text-gray-400 ml-2">正在思考...</div>}
           </div>
           <div className="p-2 border-t border-gray-100 bg-gray-50 flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs outline-none focus:border-green-400" placeholder="和小花聊聊..." />
              <button onClick={handleSend} className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm">↑</button>
           </div>
        </div>
      )}
    </>
  );
};

// 🌱 秘密花园 (含影子AI行动反馈)
const GardenPage: React.FC<{ contact: Contact, onUpdate: (c: Contact, sysMsg?: string, shareMsg?: any) => void, globalSettings: any }> = ({ contact, onUpdate, globalSettings }) => {
  const garden = contact.garden || { seed: '', level: 0, exp: 0, lastWaterDate: '', lastFertilizeDate: '' };
  
  if (!garden.seed) {
      return (
          <div className="p-6 h-full flex flex-col items-center justify-center animate-fadeIn">
              <h3 className="text-xl font-black text-gray-800 mb-2">选择一颗种子</h3>
              <p className="text-sm text-gray-500 mb-6 text-center">一旦种下，就不能更换了哦。<br/>它将见证你们的关系生长。</p>
              <div className="grid grid-cols-2 gap-4 w-full">
                  {SEED_TYPES.map(seed => (
                      <div key={seed.id} onClick={() => onUpdate({ ...contact, garden: { ...garden, seed: seed.id } })} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 ${seed.bg} border-transparent hover:border-blue-300 flex flex-col items-center text-center shadow-sm`}>
                          <span className="text-4xl mb-2">{seed.emoji}</span>
                          <span className={`font-bold ${seed.color}`}>{seed.name}</span>
                          <span className="text-[10px] text-gray-500 mt-1">{seed.desc}</span>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  const seedInfo = SEED_TYPES.find(s => s.id === garden.seed) || SEED_TYPES[0];
  const todayStr = new Date().toLocaleDateString();
  const isWateredToday = garden.lastWaterDate === todayStr;
  
  // ★★★ 核心功能：检查是否是 AI 浇的水 ★★★
  // 在 App.tsx 的 runShadowAI 里，如果 AI 浇水，会设置 aiWateredToday: true
  const isAiWatered = isWateredToday && (garden as any).aiWateredToday;

  const isFertilizedToday = garden.lastFertilizeDate === todayStr;
  const [showFertilizerInput, setShowFertilizerInput] = useState(false);
  const [fertilizerMsg, setFertilizerMsg] = useState("");
  const [isWatering, setIsWatering] = useState(false);

// ==================== [升级版] 智能浇水：回忆剪辑师 ====================
  // ==================== [永不落空版] 智能浇水逻辑 ====================
// ==================== [随机打捞版] 智能浇水逻辑 ====================
  const handleWater = async () => {
    if (isWateredToday) return;
    
    // 1. 筛选素材 (只看文本，不看系统消息)
    const validMsgs = contact.history.filter(m => m.type === 'text' && m.role !== 'system' && m.content.length > 2);
    
    if (validMsgs.length < 5) return alert("才聊了几句呀，再多存点回忆再来吧~(至少5条)");

    setIsWatering(true);

    // 通用卡片生成器
    const generateCard = (title: string, dialogue: any[], isBonus: boolean = false) => {
        const payload = {
            type: "memory_share_card",
            title: title,
            seedName: seedInfo.name,
            level: garden.level,
            timestamp: Date.now(),
            messages: dialogue.map((d: any) => ({
                role: d.role,
                avatar: d.role === 'user' ? contact.userAvatar : contact.avatar,
                content: d.content
            }))
        };
        
        setPreviewCardData(payload); // 弹窗预览

        // 经验结算 (兜底给双倍)
        const expGain = isBonus ? 20 : 10;
        const newExp = garden.exp + expGain;
        const finalLevel = newExp >= 100 ? garden.level + 1 : garden.level;
        const finalExp = newExp >= 100 ? 0 : newExp;

        onUpdate({
            ...contact,
            garden: { 
                ...garden, 
                lastWaterDate: todayStr, 
                level: finalLevel, 
                exp: finalExp 
            }
        });

        if (isBonus) {
            alert(`⚠️ AI 稍微走神了一下，但花朵精灵帮你随机打捞了一段回忆！\n🎁 补偿奖励：经验值翻倍 (+20)！`);
        } else {
            alert("💧 浇水成功！回忆卡片已生成，快去分享吧！");
        }
    };

    try {
        // 2. 尝试 AI 智能剪辑 (优先)
        const recentChat = validMsgs.slice(-50).map(m => ({
            role: m.role,
            name: m.role === 'user' ? contact.userName : contact.name,
            content: m.content
        }));

        const prompt = `
你是一位回忆剪辑师。请从对话中截取一段连续的对话（3-5句）。
必须返回JSON格式：{"title": "标题", "dialogue": [{"role": "user/assistant", "content": "..."}]}
素材：${JSON.stringify(recentChat)}
`;
        
        const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
        if (!activePreset) throw new Error("No API");

        const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            generateCard(result.title || "珍贵回忆", result.dialogue, false);
        } else {
            throw new Error("Format Error");
        }

    } catch (e) {
        console.warn("AI生成失败，启用随机打捞兜底", e);
        
        // 3. ★★★ 随机打捞逻辑 (Plan B) ★★★
        // 既然 AI 挂了，那就在历史记录里随机切一段！
        
        const totalCount = validMsgs.length;
        // 随机长度：3 到 5 句
        const sliceLength = Math.floor(Math.random() * 3) + 3; 
        // 随机起点：确保切片不越界
        // 例如总共10条，长度3，起点只能是 0~7
        const maxStartIndex = Math.max(0, totalCount - sliceLength);
        const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
        
        const randomSlice = validMsgs.slice(startIndex, startIndex + sliceLength).map(m => ({
            role: m.role,
            content: m.content
        }));

        // 随机标题库
        const randomTitles = ["偶然的瞬间", "时光碎片", "那时候...", "突然想起", "以前的我们"];
        const randomTitle = randomTitles[Math.floor(Math.random() * randomTitles.length)];

        // 生成卡片 (标记 isBonus = true)
        generateCard(randomTitle, randomSlice, true);

    } finally {
        setIsWatering(false);
    }
  };









  const handleFertilize = () => {
      if (!fertilizerMsg.trim()) return;
      const sysMsg = `[花园传信] 🌸 ${contact.userName} 给这朵花施了肥，并悄悄对你说：\n“${fertilizerMsg}”`;
      onUpdate({ ...contact, garden: { ...garden, lastFertilizeDate: todayStr, exp: Math.min(100, garden.exp + 20) } }, sysMsg);
      setFertilizerMsg(""); setShowFertilizerInput(false);
      alert("📨 施肥成功！这句话已随着花香送到了 TA 的心里。");
  };

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center animate-fadeIn relative overflow-hidden">
        <FlowerChatWidget contact={contact} seedInfo={seedInfo} globalSettings={globalSettings} onUpdate={(newHistory) => onUpdate({ ...contact, garden: { ...contact.garden!, flowerHistory: newHistory } })} />

        <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl border border-white w-full max-w-sm relative overflow-hidden z-10">
            <div className="text-center mb-8">
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Secret Garden</span>
                <h3 className={`text-2xl font-black ${seedInfo.color} mt-1 flex items-center justify-center gap-2`}>{seedInfo.name} <span className="text-xs bg-black/5 px-2 py-1 rounded-full text-gray-500">Lv.{garden.level}</span></h3>
                <p className="text-xs text-gray-400 mt-2 italic">{seedInfo.desc}</p>
            </div>
            <div className="h-48 flex items-center justify-center mb-8 relative transition-all duration-500">
                <div className="filter drop-shadow-xl animate-bounce-slow cursor-pointer transform transition-transform hover:scale-110 active:scale-95" style={{ fontSize: `${4 + garden.level}rem` }} onClick={handleWater}>{seedInfo.emoji}</div>
                {!isWateredToday && !isWatering && <div className="absolute -top-4 right-4 bg-blue-500 text-white text-[10px] px-2 py-1 rounded-full animate-bounce shadow-md">渴了...💧</div>}
                
                {/* ★★★ 影子AI行动反馈：如果AI浇过水，显示爱心 ★★★ */}
                {isAiWatered && <div className="absolute -top-4 left-4 bg-pink-500 text-white text-[10px] px-2 py-1 rounded-full animate-pulse shadow-md">TA浇过啦❤️</div>}
                
                {isWatering && <div className="absolute top-0 text-2xl animate-pulse">🚿</div>}
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-8 border border-gray-200"><div className={`h-full ${seedInfo.bg.replace('bg-', 'bg-')} ${seedInfo.color.replace('text-', 'bg-')} transition-all duration-1000`} style={{ width: `${garden.exp}%` }}></div></div>
           <div className="grid grid-cols-2 gap-3">
                {/* === 左边：浇水按钮 (蓝色 - 生成回忆卡片) === */}
                <button 
                    onClick={handleWater} 
                    disabled={isWateredToday || isWatering} 
                    className={`py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${isWateredToday ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-200'}`}
                >
                    <span className="text-2xl">{isWatering ? '⏳' : '💧'}</span>
                    {/* 主标题 */}
                    <span className="text-sm font-black">
                        {isWatering ? '萃取中...' : (isWateredToday ? (isAiWatered ? 'TA已浇水' : '明日再来') : '浇水')}
                    </span>
                    {/* 副标题 */}
                    <span className="text-[10px] opacity-80 font-normal">回忆掉落</span>
                </button>

                {/* === 右边：施肥按钮 (绿色 - 写语传情) === */}
                <button 
                    onClick={() => !isFertilizedToday && setShowFertilizerInput(true)} 
                    disabled={isFertilizedToday} 
                    className={`py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${isFertilizedToday ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'}`}
                >
                    <span className="text-2xl">🧪</span> 
                    {/* 主标题 */}
                    <span className="text-sm font-black">{isFertilizedToday ? '养分充足' : '施肥'}</span>
                    {/* 副标题 */}
                    <span className="text-[10px] opacity-80 font-normal">写语传情</span>
                </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-3">每天仅限一次 · 会自动创建聊天回忆</p>
        </div>

        {showFertilizerInput && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
                <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-scaleIn">
                    <h4 className="text-lg font-bold text-green-700 mb-2 text-center">施肥 · 写语传情</h4>
                    <p className="text-xs text-gray-400 mb-4 text-center">写一句话作为养分，花朵精灵会帮你传达给 TA。</p>
                    <textarea className="w-full h-24 bg-green-50 rounded-xl p-4 text-sm outline-none resize-none mb-4 border border-gray-200 focus:ring-2 focus:ring-green-200 transition-all" placeholder="写在这里..." value={fertilizerMsg} onChange={e => setFertilizerMsg(e.target.value)} autoFocus />
                    <div className="flex gap-3">
                        <button onClick={() => setShowFertilizerInput(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">取消</button>
                        <button onClick={handleFertilize} className="flex-1 py-3 bg-green-500 rounded-xl font-bold text-white shadow-lg shadow-green-200">确认施肥</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};







// ==================== 4. 主组件 (RelationshipSpace) ====================

interface RelationshipSpaceProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
  onRelationshipSpaceAction: (contactId: string, msg: string) => void;
  globalSettings: GlobalSettings;
}

const RelationshipSpace: React.FC<RelationshipSpaceProps> = ({ contacts, setContacts, onClose, onRelationshipSpaceAction, globalSettings }) => {
  // ★★★ 核心修复：View 状态定义 (防黑屏关键) ★★★
  const [view, setView] = useState<'landing' | 'list' | 'space'>('landing');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [tab, setTab] = useState<'hub' | 'garden'>('hub');
  const [selectedLetter, setSelectedLetter] = useState<LoveLetter | null>(null);
  
  // ★★★ 设置 & 写信 状态 ★★★
  const [showSettings, setShowSettings] = useState(false);
  const [showWriteLetter, setShowWriteLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState({ title: '', content: '' });
// ★★★ 新增：用于存放刚刚生成的“回忆卡片”数据，准备预览 ★★★
  const [previewCardData, setPreviewCardData] = useState<any>(null);
  // 获取当前关系
  const currentRelationship = contacts.find(c => c.RelationShipUnlocked);
  const targetContact = contacts.find(c => c.id === targetId);

  // 计算红点
  const getUnreadCount = (c: Contact) => (c.letters || []).filter(l => !l.isOpened && l.from === 'ai').length;
  const RelationshipUnread = currentRelationship ? getUnreadCount(currentRelationship) : 0;
  const friendsUnread = contacts.filter(c => !c.RelationShipUnlocked).reduce((sum, c) => sum + getUnreadCount(c), 0);

  // 自动跳转逻辑
  useEffect(() => {
      if (currentRelationship && view === 'landing' && !targetId) {
          setTargetId(currentRelationship.id);
          setView('space');
      }
  }, []); // 只在挂载时检查一次，如果用户手动退回到 Landing，不会被强制吸回去

  // --- Shadow AI 检查 (每次进空间触发) ---
  useEffect(() => {
      if (view === 'space' && targetContact) {
          const nowStr = new Date().toLocaleDateString();
          // 如果今天还没检查过，或者数据太老，可以在这里触发一次轻量级检查
          // 目前主要依赖 App.tsx 的全局定时器，这里主要做数据同步
          // 可以在这里加上逻辑：如果进空间时发现 hef 有大变化，触发某种动画
      }
  }, [view, targetContact]);

  // --- 落地页 (Landing) ---
  if (view === 'landing') {
      return (
          <div className="h-full w-full bg-slate-50 flex flex-col pt-[calc(env(safe-area-inset-top)+20px)] p-6">
              <button onClick={onClose} className="absolute top-4 left-4 w-8 h-8 bg-white rounded-full text-gray-500 shadow-sm z-50">✕</button>
              <h2 className="text-2xl font-black text-slate-800 mb-2 mt-8">Relationship Space</h2>
              <p className="text-sm text-slate-400 mb-8">选择你要进入的空间类型</p>

              <div 
                onClick={() => { if (currentRelationship) { setTargetId(currentRelationship.id); setView('space'); } else { alert("还未解锁恋人空间哦 (需好感度>60且AI同意)"); setView('list'); } }} 
                className="bg-gradient-to-br from-rose-400 to-pink-600 rounded-3xl p-6 shadow-xl shadow-rose-200 mb-6 cursor-pointer transform transition hover:scale-105 active:scale-95 relative overflow-hidden group"
              >
                  {/* 红点提醒 */}
                  {RelationshipUnread > 0 && <div className="absolute top-4 right-4 bg-white text-rose-500 text-xs font-bold px-2 py-1 rounded-full shadow-md animate-bounce">{RelationshipUnread} 新信件</div>}
                  <div className="absolute -right-4 -bottom-4 text-9xl opacity-20 group-hover:scale-110 transition-transform">💞</div>
                  <h3 className="text-xl font-bold text-white mb-1">唯一挚爱</h3>
                  <p className="text-white/80 text-xs font-medium">Relationship Space</p>
                  <div className="mt-6 flex items-center gap-2">
                      {currentRelationship ? <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1"><img src={currentRelationship.avatar} className="w-5 h-5 rounded-full border border-white" /><span className="text-xs text-white font-bold">与 {currentRelationship.name} 热恋中</span></div> : <span className="text-xs text-white/90 bg-black/10 px-3 py-1 rounded-full">暂无解锁</span>}
                  </div>
              </div>

              <div onClick={() => setView('list')} className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200 cursor-pointer transform transition hover:scale-105 active:scale-95 relative overflow-hidden group">
                  {friendsUnread > 0 && <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">{friendsUnread}</div>}
                  <div className="absolute -right-4 -bottom-4 text-9xl opacity-5 grayscale group-hover:grayscale-0 transition-all">✨</div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1">羁绊广场</h3>
                  <p className="text-slate-400 text-xs font-medium">General Relationships</p>
              </div>
          </div>
      );
  }

  // --- 列表页 (List) ---
  if (view === 'list') {
      return (
          <div className="h-full w-full bg-slate-50 flex flex-col">
              <SafeAreaHeader title="羁绊广场" left={<button onClick={() => setView('landing')} className="text-blue-500 font-bold px-2">← 返回</button>} />
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {contacts.map(c => {
                      const unread = getUnreadCount(c);
                      return (
                        <div key={c.id} onClick={() => { setTargetId(c.id); setView('space'); }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:bg-slate-50 relative">
                            <img src={c.avatar} className="w-12 h-12 rounded-full border border-slate-200 object-cover" />
                            <div><h4 className="font-bold text-slate-800">{c.name}</h4><p className="text-xs text-slate-400">{c.relationshipStatus || 'Acquaintance'}</p></div>
                            {unread > 0 && <div className="ml-auto bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{unread}</div>}
                        </div>
                      );
                  })}
              </div>
          </div>
      );
  }

  // --- 空间页 (Space) ---
  if (view === 'space' && targetContact) {
      const isRelationship = !!targetContact.RelationShipUnlocked;
      const theme = getTheme(isRelationship ? 'Honeymoon' : (targetContact.relationshipStatus || 'Friend'));
      const daysTogether = Math.floor((Date.now() - (targetContact.created)) / 86400000) + 1;

      // 信件阅读模式
      if (selectedLetter) {
          return (
              <div className={`h-full w-full ${theme.bg} flex flex-col pt-[calc(env(safe-area-inset-top)+20px)]`}>
                  <div className="px-4 pb-2">
                      <button onClick={() => setSelectedLetter(null)} className={`${theme.primary} font-bold text-sm px-4 py-2 bg-white/50 rounded-full shadow-sm`}>← 返回</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                      <div className="bg-[#fffdf0] text-gray-800 rounded-sm shadow-2xl p-8 w-full max-w-md min-h-[70vh] relative mx-auto transform rotate-1 border border-gray-200" style={{ backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '100% 2rem', lineHeight: '2rem' }}>
                          <div className="absolute top-4 right-4 w-20 h-20 border-2 border-red-800/20 rounded-full flex items-center justify-center transform -rotate-12 pointer-events-none"><span className="text-[10px] text-red-800/30 font-mono text-center leading-tight">POST MARK<br/>{new Date(selectedLetter.timestamp).toLocaleDateString()}</span></div>
                          <h2 className="text-xl font-black text-gray-900 mb-8 mt-4 text-center tracking-wide">{selectedLetter.title}</h2>
                          <p className="text-gray-700 font-serif whitespace-pre-wrap text-base leading-8">{selectedLetter.content}</p>
                          <div className="mt-16 text-right pb-8">
                              <p className="font-cursive text-xl text-gray-500">Yours,</p>
                              <p className="font-bold text-gray-800 mt-2 text-lg">{selectedLetter.from === 'user' ? 'Me' : targetContact.name}</p>
                          </div>
                      </div>
                  </div>
              </div>
          );
      }

      return (
          <div className={`h-full w-full ${theme.bg} flex flex-col overflow-hidden`}>
              <SafeAreaHeader 
                  title={tab === 'hub' ? theme.title : '秘密花园'} 
                  left={<button onClick={() => setView('landing')} className={`text-xl ${theme.primary} pl-2`}>✕</button>}
                  // ★★★ 右上角设置按钮：纪念日 & 解除关系 ★★★
                  right={
                      <div className="relative">
                          <button onClick={() => setShowSettings(!showSettings)} className={`text-xl ${theme.primary} pr-2`}>⚙️</button>
                          {showSettings && (
                              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-32 z-50 animate-scaleIn">
                                  <button onClick={() => {
                                      const newDate = prompt("修改纪念日 (格式: YYYY-MM-DD)", targetContact.created ? new Date(targetContact.created).toISOString().slice(0,10) : "");
                                      // 这里其实应该存 anniversary 字段，暂时用 created 代替演示
                                      setShowSettings(false);
                                  }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded">📅 改纪念日</button>
                                  
                                  {isRelationship && <button onClick={() => {
                                      if(confirm("⚠️ 确定要解除情侣空间吗？\n\n所有信件和花园等级将保留，但关系将退回普通朋友。")) {
                                          setContacts(prev => prev.map(c => c.id === targetContact.id ? { ...c, RelationShipUnlocked: false } : c));
                                          onRelationshipSpaceAction(targetContact.id, "[系统通知] 用户解除了情侣空间。");
                                          setView('landing');
                                      }
                                  }} className="block w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded">💔 解除关系</button>}
                              </div>
                          )}
                      </div>
                  }
              />

              <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
                  {tab === 'hub' && (
                      <div className="p-6 space-y-8 animate-fadeIn">
                          {/* 头部信息 */}
                          <div className="relative p-6 text-center">
                              <div className="inline-block relative group">
                                  <img src={targetContact.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-xl object-cover transition-transform group-hover:scale-105" alt="avatar" />
                                  <div className={`absolute -bottom-2 -right-2 w-9 h-9 ${theme.accent} rounded-full flex items-center justify-center text-white text-base border-4 border-white shadow-md`}>{theme.icon}</div>
                              </div>
                              <h2 className="text-2xl font-black text-gray-800 mt-4">{targetContact.name}</h2>
                              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${theme.cardBg} border ${theme.border} mt-2 shadow-sm`}>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Days Connected</span>
                                  <span className={`text-lg font-black ${theme.primary}`}>{daysTogether}</span>
                              </div>
                          </div>
                          
                          {/* 信箱 (可写信) */}
                          <div className="px-6 mb-4">
                              <MailboxWidget 
                                  letters={targetContact.letters || []} 
                                  theme={theme} 
                                  onOpenLetter={(l) => { setSelectedLetter(l); if (!l.isOpened && l.from === 'ai') { setContacts(prev => prev.map(c => c.id === targetContact.id ? {...c, letters: (c.letters || []).map(x => x.id === l.id ? {...x, isOpened: true} : x)} : c)); }}} 
                                  onWriteLetter={() => setShowWriteLetter(true)}
                              />
                          </div>

                          {/* 问答 (落子无悔) */}
                          <div className="px-6 mt-6">
                              <h3 className="text-sm font-bold text-gray-500 mb-4 px-1 flex items-center justify-between"><span className="flex items-center gap-2">🧩 灵魂拷问</span><span className="text-[10px] bg-white px-2 py-1 rounded-full text-gray-400 border border-gray-100 font-mono">{targetContact.questions?.length || 0} CARDS</span></h3>
                              <QACardStack 
                                questions={targetContact.questions || []} 
                                theme={theme} 
                                onAnswer={(id, ans) => { 
                                    setContacts(prev => prev.map(c => c.id === targetContact.id ? { ...c, questions: (c.questions || []).map(q => q.id === id ? {...q, userAnswer: ans} : q) } : c)); 
                                    const qText = targetContact.questions?.find(q => q.id === id)?.question; 
                                    onRelationshipSpaceAction(targetContact.id, `[关系空间] 我回答了你的提问：“${qText}”，我的答案是：“${ans}”`); 
                                    alert("回答已存档 (落子无悔)！"); 
                                }} 
                              />
                          </div>
                      </div>
                  )}

                  {tab === 'garden' && (
                      <GardenPage 
                        contact={targetContact} 
                        globalSettings={globalSettings} 
                        onUpdate={(c, sysMsg, shareCard) => { 
                            setContacts(prev => prev.map(old => old.id === c.id ? c : old)); 
                            if(shareCard) onRelationshipSpaceAction(c.id, JSON.stringify(shareCard)); 
                            else if(sysMsg) onRelationshipSpaceAction(c.id, sysMsg); 
                        }} 
                      />
                  )}
              </div>

              {/* 底部导航 */}
              <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-2 py-1.5 shadow-2xl flex gap-1 pointer-events-auto">
                      <button onClick={() => setTab('hub')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${tab === 'hub' ? `${theme.accent} text-white shadow-md` : 'text-gray-400 hover:bg-gray-100'}`}>🏠 空间</button>
                      <button onClick={() => setTab('garden')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${tab === 'garden' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}>🌸 花园</button>
                  </div>
              </div>

              {/* 写信弹窗 */}
              {showWriteLetter && (
                  <div className="absolute inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 animate-fadeIn">
                      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scaleIn">
                          <h3 className="font-bold text-lg text-gray-800 mb-4 text-center">✍️ 写信给 TA</h3>
                          <input 
                             className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 mb-3 text-sm outline-none font-bold"
                             placeholder="标题 (例如: 给亲爱的你)"
                             value={letterDraft.title}
                             onChange={e => setLetterDraft({...letterDraft, title: e.target.value})}
                          />
                          <textarea 
                             className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none resize-none mb-4"
                             placeholder="写下你想对 TA 说的话... (落子无悔哦)"
                             value={letterDraft.content}
                             onChange={e => setLetterDraft({...letterDraft, content: e.target.value})}
                          />
                          <div className="flex gap-3">
                              <button onClick={() => setShowWriteLetter(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">取消</button>
                              <button 
                                onClick={() => {
                                    if(!letterDraft.title || !letterDraft.content) return alert("写完再寄哦！");
                                    const newLetter: LoveLetter = {
                                        id: Date.now().toString(),
                                        title: letterDraft.title,
                                        content: letterDraft.content,
                                        timestamp: Date.now(),
                                        isOpened: false, // 对方未读
                                        from: 'user'
                                    };
                                    setContacts(prev => prev.map(c => c.id === targetContact.id ? { ...c, letters: [...(c.letters||[]), newLetter] } : c));
                                    onRelationshipSpaceAction(targetContact.id, `[系统通知] 用户刚刚给你寄了一封信，标题是《${newLetter.title}》。\n(请在下次行动中表现出收到信的反应，或者回信)`);
                                    setLetterDraft({title:'', content:''});
                                    setShowWriteLetter(false);
                                    alert("信件已投递！📮");
                                }}
                                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${theme.accent}`}
                              >
                                  投递
                              </button>
                          </div>
                      </div>
                  </div>
              )}


{/* ★★★ 回忆卡片预览 & 分享弹窗 ★★★ */}
              {previewCardData && (
                  <div className="absolute inset-0 bg-black/60 z-[70] flex items-center justify-center p-6 animate-fadeIn backdrop-blur-sm">
                      <div className="bg-white w-full max-w-sm rounded-3xl p-2 shadow-2xl animate-scaleIn flex flex-col items-center">
                          <div className="w-full bg-gray-100 rounded-t-3xl rounded-b-xl p-4 mb-2 relative overflow-hidden">
                              <h3 className="text-center font-bold text-gray-600 mb-2 text-xs uppercase tracking-widest">Memory Generated</h3>
                              {/*这里直接复用卡片样式，稍微简化一点用于预览*/}
                              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-xs">
                                  <div className="bg-blue-50 p-2 border-b border-gray-100 font-bold text-blue-600 flex justify-between">
                                      <span>💧 {previewCardData.seedName}的回忆</span>
                                      <span>{new Date(previewCardData.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <div className="p-3 space-y-2 bg-gray-50/30 max-h-[200px] overflow-y-auto custom-scrollbar">
                                      <div className="text-center"><span className="bg-white border px-2 py-0.5 rounded-full font-bold shadow-sm">“{previewCardData.title}”</span></div>
                                      {previewCardData.messages.map((m: any, i: number) => (
                                          <div key={i} className={`flex gap-1 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                              <div className={`px-2 py-1 rounded max-w-[85%] ${m.role==='user'?'bg-blue-500 text-white':'bg-white border'}`}>{m.content}</div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          <div className="flex gap-2 w-full px-2 pb-2">
                              <button 
                                onClick={() => {
                                    alert("图片已保存到相册！(模拟)");
                                }} 
                                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition"
                              >
                                  📥 保存图片
                              </button>
                              <button 
                                onClick={() => {
                                    // ★★★ 在这里真正发送给主AI ★★★
                                    onRelationshipSpaceAction(contact.id, JSON.stringify(previewCardData));
                                    setPreviewCardData(null); // 关闭弹窗
                                    alert("已分享给TA！快去聊天窗口看看吧~");
                                }} 
                                className="flex-1 py-3 bg-blue-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-600 transition"
                              >
                                  📤 分享给TA
                              </button>
                          </div>
                          
                          <button onClick={() => setPreviewCardData(null)} className="mt-2 text-gray-400 text-xs hover:text-gray-600">关闭 (仅保留经验值)</button>
                      </div>
                  </div>
              )}








          </div>
      );
  }

  // 兜底
  return <div className="h-full flex items-center justify-center text-gray-400">Loading...</div>;
};

export default RelationshipSpace;