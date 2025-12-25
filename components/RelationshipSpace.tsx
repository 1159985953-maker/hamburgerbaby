import React, { useState, useEffect, useRef } from 'react';
import { Contact, LoveLetter, QAEntry, Message, GlobalSettings } from '../types';
import SafeAreaHeader from './SafeAreaHeader';
import { generateResponse } from '../services/apiService'; 
// 【RelationshipSpace.tsx】 文件最顶部
// 这是一组导入 html-to-image 的代码（请完全替换原来的 html2canvas 导入行）
import * as htmlToImage from 'html-to-image';




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











// 【RelationshipSpace.tsx】 找到 GardenPage 子组件，用这个【兼容对齐版】完全覆盖它






// 🌱 秘密花园 (头像强制兜底生成 + Div背景图渲染 + 底部高亮条)
const GardenPage: React.FC<{ 
    contact: Contact, 
    onUpdate: (c: Contact, sysMsg?: string, shareMsg?: any) => void, 
    globalSettings: any,
    onJumpToMessage?: (timestamp: number) => void 
}> = ({ contact, onUpdate, globalSettings, onJumpToMessage }) => {
  const garden = contact.garden || { seed: '', level: 0, exp: 0, lastWaterDate: '', lastFertilizeDate: '' };
  
  const [previewCardData, setPreviewCardData] = useState<any>(null);
  const [isWatering, setIsWatering] = useState(false);
  const [showFertilizerInput, setShowFertilizerInput] = useState(false);
  const [fertilizerMsg, setFertilizerMsg] = useState("");

  const [cardStyle, setCardStyle] = useState<'glass' | 'polaroid' | 'paper' | 'minimal'>('minimal');
  const cardToSaveRef = useRef<HTMLDivElement>(null); 
  const [isSavingImage, setIsSavingImage] = useState(false);

  // === 1. 生成备用头像 (如果图片加载失败，自动画一个首字母头像) ===
  const generateFallbackAvatar = (name: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          // 画背景
          ctx.fillStyle = '#818cf8'; // 漂亮的靛蓝色
          ctx.fillRect(0, 0, 100, 100);
          // 画文字
          ctx.font = 'bold 50px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((name || 'A')[0].toUpperCase(), 50, 50);
          return canvas.toDataURL('image/png');
      }
      return "";
  };

  // === 2. 强力转码 (Fetch -> Blob -> Base64) ===
  const urlToBase64 = async (url: string, name: string) => {
    if (!url || url === "undefined") return generateFallbackAvatar(name);
    if (url.startsWith('data:')) return url; // 已经是 Base64 就直接用

    try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error("Network response was not ok");
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn(`头像加载失败 (${url})，启用备用方案`);
        // ★★★ 核心：如果下载失败，直接返回生成的备用头像，保证不空 ★★★
        return generateFallbackAvatar(name);
    }
  };

  // 辅助函数：自动计算文字颜色
  const getContrastColor = (hexColor?: string) => {
      if (!hexColor || !hexColor.startsWith('#')) return '#000000';
      const r = parseInt(hexColor.substr(1, 2), 16);
      const g = parseInt(hexColor.substr(3, 2), 16);
      const b = parseInt(hexColor.substr(5, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? '#111827' : '#ffffff';
  };

  const handleJumpToContext = () => {
      if (!previewCardData) return;
      const targetTime = previewCardData.timestamp;
      setPreviewCardData(null);
      if (onJumpToMessage) {
          onJumpToMessage(targetTime);
      } else {
          alert(`📍 请在聊天记录中寻找：${new Date(targetTime).toLocaleString()} 附近的消息`);
      }
  };

  if (!garden.seed) { 
      return ( 
          <div className="p-6 h-full flex flex-col items-center justify-center animate-fadeIn"> 
              <h3 className="text-xl font-black text-gray-800 mb-2">选择一颗种子</h3> 
              <p className="text-sm text-gray-500 mb-6 text-center">一旦种下，就不能更换了哦。</p> 
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
  const todayStr = new Date().toISOString().slice(0, 10);
  const isWateredToday = garden.lastWaterDate === todayStr;
  const isAiWatered = isWateredToday && (garden as any).aiWateredToday;
  const isFertilizedToday = garden.lastFertilizeDate === todayStr;
  
  // ==================== 截图保存逻辑 ====================
  const handleSaveCardAsImage = async () => {
    if (!cardToSaveRef.current) return;
    setIsSavingImage(true);

    const wrapper = cardToSaveRef.current;
    const scrollableContent = wrapper.querySelector('.custom-scrollbar') as HTMLElement | null;
    
    const originalWrapperStyle = { height: wrapper.style.height, maxHeight: wrapper.style.maxHeight, overflow: wrapper.style.overflow };
    const originalContentStyle = scrollableContent ? { maxHeight: scrollableContent.style.maxHeight, overflowY: scrollableContent.style.overflowY, height: scrollableContent.style.height } : null;

    try {
      // 1. 暴力展开
      if (scrollableContent) {
        scrollableContent.style.maxHeight = 'none';
        scrollableContent.style.overflowY = 'visible';
        scrollableContent.style.height = 'auto'; 
      }
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';
      wrapper.style.overflow = 'visible';

      // 2. 增加等待时间，确保图片渲染
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      // 3. 截图 (JPG + 白底)
      const dataUrl = await htmlToImage.toJpeg(wrapper, {
        quality: 0.95, 
        pixelRatio: 3, 
        backgroundColor: '#ffffff',
        height: wrapper.scrollHeight, 
        style: { overflow: 'hidden', height: 'auto', maxHeight: 'none', transform: 'none' }, 
        cacheBust: true, 
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `HamburgerPhone-${contact.name}-${new Date().toISOString().slice(0, 10)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('保存失败', error);
      alert('保存失败，请截图保存。');
    } finally {
      if (scrollableContent && originalContentStyle) {
        scrollableContent.style.maxHeight = originalContentStyle.maxHeight;
        scrollableContent.style.overflowY = originalContentStyle.overflowY;
        scrollableContent.style.height = originalContentStyle.height;
      }
      wrapper.style.height = originalWrapperStyle.height;
      wrapper.style.maxHeight = originalWrapperStyle.maxHeight;
      wrapper.style.overflow = originalWrapperStyle.overflow;
      setIsSavingImage(false);
    }
  };

  const handleWater = async () => { 
      // if (isWateredToday) return; 
      
      const validMsgs = contact.history.filter(m => 
          m.content.length > 1 && 
          !m.content.includes('"type":') 
      ); 

      if (validMsgs.length < 5) return alert("回忆不足5条，再聊聊吧~"); 
      setIsWatering(true); 
      
      const generateCard = async (dialogue: any[], memoryTimestamp: number, isBonus: boolean = false) => { 
          
          // ★★★ 核心：所有图片预处理 ★★★
          const processedMessages = await Promise.all(dialogue.map(async (d: any) => {
              const name = d.role === 'user' ? contact.userName : contact.name;
              const avatarUrl = d.role === 'user' ? contact.userAvatar : contact.avatar;
              
              // 1. 头像转码 (带备用生成)
              const base64Avatar = await urlToBase64(avatarUrl, name);
              
              // 2. 内容图转码
              let content = d.content;
              if (d.type === 'image' && !content.startsWith('data:')) {
                  content = await urlToBase64(content, "IMG");
              }

              return { 
                  role: d.role, 
                  avatar: base64Avatar, 
                  content: content,
                  type: d.type 
              };
          }));

          const payload = { 
              type: "memory_share_card", 
              title: "一段珍贵的回忆", 
              seedName: seedInfo.name, 
              level: garden.level, 
              timestamp: memoryTimestamp, 
              messages: processedMessages
          }; 
          
          setPreviewCardData(payload); 
          const expGain = isBonus ? 20 : 10; 
          const newExp = garden.exp + expGain; 
          
          onUpdate({ ...contact, garden: { ...garden, lastWaterDate: todayStr, level: newExp >= 100 ? garden.level + 1 : garden.level, exp: newExp >= 100 ? 0 : newExp } }); 
          
          if (isBonus) alert(`⚠️ AI 走神了，但精灵帮你随机打捞了一段回忆！\n🎁 补偿：经验+20！`); 
      }; 

      try { 
          const totalCount = validMsgs.length; 
          const targetLength = Math.floor(Math.random() * 4) + 5; 
          const sliceLength = Math.min(totalCount, targetLength);
          const maxStartIndex = Math.max(0, totalCount - sliceLength); 
          const startIndex = Math.floor(Math.random() * (maxStartIndex + 1)); 
          const randomSlice = validMsgs.slice(startIndex, startIndex + sliceLength); 
          const memoryTimestamp = randomSlice[randomSlice.length-1].timestamp; 
          
          await generateCard(randomSlice, memoryTimestamp, false);

      } catch (e) { 
          console.warn("生成失败", e); 
      } finally { 
          setIsWatering(false); 
      } 
  };

  const handleFertilize = () => { 
      if (!fertilizerMsg.trim()) return; 
      const sysMsg = `[花园传信] 🌸 ${contact.userName} 给花施肥并说：“${fertilizerMsg}”`; 
      onUpdate({ ...contact, garden: { ...garden, lastFertilizeDate: todayStr, exp: Math.min(100, garden.exp + 20) } }, sysMsg); 
      setFertilizerMsg(""); setShowFertilizerInput(false); alert("📨 施肥成功！"); 
  };

  const fullTimestamp = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\//g, '/');

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center animate-fadeIn relative overflow-hidden">
        <FlowerChatWidget contact={contact} seedInfo={seedInfo} globalSettings={globalSettings} onUpdate={(newHistory) => onUpdate({ ...contact, garden: { ...contact.garden!, flowerHistory: newHistory } })} />
        
        {/* 主面板 */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl border border-white w-full max-w-sm relative overflow-hidden z-10">
            <div className="text-center mb-8">
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Secret Garden</span>
                <h3 className={`text-2xl font-black ${seedInfo.color} mt-1 flex items-center justify-center gap-2`}>
                    {seedInfo.name} <span className="text-xs bg-black/5 px-2 py-1 rounded-full text-gray-500">Lv.{garden.level}</span>
                </h3>
                <p className="text-xs text-gray-400 mt-2 italic">{seedInfo.desc}</p>
            </div>
            <div className="h-48 flex items-center justify-center mb-8 relative transition-all duration-500">
                <div className="filter drop-shadow-xl animate-bounce-slow cursor-pointer transform transition-transform hover:scale-110 active:scale-95" style={{ fontSize: `${4 + garden.level}rem` }} onClick={handleWater}>{seedInfo.emoji}</div>
                {!isWatering && <div className="absolute -top-4 right-4 bg-blue-500 text-white text-[10px] px-2 py-1 rounded-full animate-bounce shadow-md">点我生成!</div>}
                {isWatering && <div className="absolute top-0 text-2xl animate-pulse">🚿</div>}
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-8 border border-gray-200">
                <div className={`h-full ${seedInfo.bg.replace('bg-', 'bg-')} ${seedInfo.color.replace('text-', 'bg-')} transition-all duration-1000`} style={{ width: `${garden.exp}%` }}></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={handleWater} disabled={isWatering} className={`py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${isWatering ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-200'}`}>
                    <span className="text-2xl">{isWatering ? '⏳' : '♾️'}</span><span className="text-sm font-black">{isWatering ? '生成中...' : '无限浇水'}</span><span className="text-[10px] opacity-80 font-normal">测试通道</span>
                </button>
                <button onClick={() => !isFertilizedToday && setShowFertilizerInput(true)} disabled={isFertilizedToday} className={`py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${isFertilizedToday ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'}`}>
                    <span className="text-2xl">🧪</span><span className="text-sm font-black">{isFertilizedToday ? '养分充足' : '施肥'}</span><span className="text-[10px] opacity-80 font-normal">写语传情</span>
                </button>
            </div>
        </div>

        {/* 施肥弹窗 */}
        {showFertilizerInput && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
               <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
                   <h4 className="text-lg font-bold text-green-700 mb-2 text-center">施肥 · 写语传情</h4>
                   <textarea className="w-full h-24 bg-green-50 rounded-xl p-4 text-sm outline-none resize-none mb-4 border border-gray-200" placeholder="写在这里..." value={fertilizerMsg} onChange={e => setFertilizerMsg(e.target.value)} autoFocus />
                   <div className="flex gap-3">
                       <button onClick={() => setShowFertilizerInput(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">取消</button>
                       <button onClick={handleFertilize} className="flex-1 py-3 bg-green-500 rounded-xl font-bold text-white">确认施肥</button>
                   </div>
               </div>
            </div>
        )}
        
        {/* ==================== 核心：卡片预览区域 ==================== */}
        {previewCardData && (
            <div className="absolute inset-0 bg-black/80 z-[70] flex flex-col items-center justify-center p-4 animate-fadeIn backdrop-blur-md">
                
                {/* 风格切换器 */}
                <div className="flex gap-2 mb-4 bg-white/10 p-1.5 rounded-full backdrop-blur-md border border-white/20 overflow-x-auto max-w-full">
                    <button onClick={() => setCardStyle('glass')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${cardStyle === 'glass' ? 'bg-white text-blue-600 shadow-md' : 'text-white/70 hover:bg-white/10'}`}>💎 高级磨砂</button>
                    <button onClick={() => setCardStyle('minimal')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${cardStyle === 'minimal' ? 'bg-white text-gray-900 shadow-md' : 'text-white/70 hover:bg-white/10'}`}>📱 极简手机</button>
                    <button onClick={() => setCardStyle('polaroid')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${cardStyle === 'polaroid' ? 'bg-white text-gray-800 shadow-md' : 'text-white/70 hover:bg-white/10'}`}>📸 拍立得</button>
                    <button onClick={() => setCardStyle('paper')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${cardStyle === 'paper' ? 'bg-yellow-50 text-yellow-800 shadow-md' : 'text-white/70 hover:bg-white/10'}`}>📄 羊皮纸</button>
                </div>

                <div className="flex flex-col items-center w-full max-w-sm h-full max-h-[85vh] overflow-hidden">
                 {/* ========== 截图区域 (cardToSaveRef) ========== */}
                    <div 
                        ref={cardToSaveRef} 
                        className={`w-full relative shadow-2xl transition-all duration-300 flex flex-col ${cardStyle === 'minimal' ? 'rounded-[32px]' : 'rounded-[20px]'}`}
                        style={{
                            backgroundImage: contact.chatBackground 
                                ? `url(${contact.chatBackground})` 
                                : `radial-gradient(#e5e7eb 1px, transparent 1px)`,
                            backgroundSize: contact.chatBackground ? 'cover' : '20px 20px',
                            backgroundColor: '#ffffff',
                            backgroundPosition: 'center',
                            fontFamily: globalSettings.fontFamily || 'sans-serif',
                            height: 'auto',
                            minHeight: '520px',
                            maxHeight: '80vh', 
                            overflow: 'hidden' 
                        }}
                    >
                        
                        {/* ==================== 🔮 全新设计：高级磨砂 (水晶极光版) ==================== */}
                        {cardStyle === 'glass' ? (
                            <>
                                {/* 1. 磨砂专属：深色唯美滤镜遮罩 */}
                                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl z-0"></div>
                                {/* 2. 磨砂专属：极光光晕装饰 */}
                                <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/40 rounded-full blur-[80px] mix-blend-screen animate-pulse z-0"></div>
                                <div className="absolute top-40 -right-20 w-64 h-64 bg-purple-500/40 rounded-full blur-[80px] mix-blend-screen animate-pulse z-0"></div>

                                <div className="relative z-10 flex flex-col h-full p-7 text-white">
                                    {/* --- 顶部设计：杂志封面感 --- */}
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 rounded-full border border-white/30 bg-white/10 text-[9px] tracking-[0.2em] backdrop-blur-md shadow-lg font-bold">
                                                    MEMORY
                                                </span>
                                                <div className="h-px w-10 bg-white/40"></div>
                                            </div>
                                            <h2 className="text-3xl font-black italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 drop-shadow-sm">
                                                {seedInfo.name}
                                            </h2>
                                            <p className="text-[10px] text-white/60 mt-1 font-mono tracking-widest uppercase">
                                                {previewCardData.title}
                                            </p>
                                        </div>
                                        {/* 等级水晶标 */}
                                        <div className="flex flex-col items-center justify-center w-12 h-14 border border-white/20 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md rounded-b-[2rem] shadow-lg">
                                            <span className="text-xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">{seedInfo.emoji}</span>
                                            <span className="text-[8px] font-bold mt-0.5">Lv.{garden.level}</span>
                                        </div>
                                    </div>

                                    {/* --- 内容区域：悬浮玻璃片 --- */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
                                        {/* 侧边装饰线 */}
                                        <div className="absolute top-2 bottom-2 left-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                                        
                                        <div className="space-y-6 pl-4">
                                            {previewCardData.messages.map((m: any, i: number) => {
                                                const isMe = m.role === 'user';
                                                return (
                                                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative group`}>
                                                        
                                                        {/* 时间轴节点 */}
                                                        <div className={`absolute top-4 -left-[19px] w-2.5 h-2.5 rounded-full border-2 border-white/10 bg-white/90 shadow-[0_0_10px_white] z-20 ${isMe ? 'opacity-50' : 'opacity-100'}`}></div>

                                                        <div className={`max-w-[90%]`}>
                                                            {/* 气泡本体：水晶质感 */}
                                                            <div className={`
                                                                px-4 py-3 text-sm leading-relaxed backdrop-blur-md shadow-2xl transition-all duration-300 border
                                                                ${isMe 
                                                                    ? 'rounded-2xl rounded-tr-none bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/30 text-white' 
                                                                    : 'rounded-2xl rounded-tl-none bg-white/10 border-white/20 text-white/90'
                                                                }
                                                            `}>
                                                                {m.type === 'image' || (typeof m.content === 'string' && m.content.startsWith('data:image')) ? (
                                                                    <img src={m.content} alt="img" className="rounded-lg opacity-90 hover:opacity-100 transition shadow-lg" />
                                                                ) : (
                                                                    m.content
                                                                )}
                                                            </div>
                                                            
                                                            {/* 名字与头像 */}
                                                            <div className={`flex items-center gap-2 mt-1.5 opacity-60 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                                <div className="w-4 h-4 rounded-full bg-cover bg-center border border-white/30 shadow-sm" style={{ backgroundImage: `url(${m.avatar})` }}></div>
                                                                <span className="text-[9px] font-light tracking-widest uppercase">{isMe ? contact.userName : contact.name}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* --- 底部：科技感/波形图 --- */}
                                    <div className="mt-6 pt-3 border-t border-white/10 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[7px] tracking-[0.3em] uppercase opacity-50">TIMESTAMP</span>
                                            <span className="text-[10px] font-mono font-bold opacity-90">{fullTimestamp}</span>
                                        </div>
                                        {/* 模拟音频波形 */}
                                        <div className="flex items-center gap-0.5 h-3 opacity-60">
                                            {[0.4, 0.8, 0.3, 0.9, 0.5, 1, 0.6, 0.4, 0.7, 0.3].map((h, k) => (
                                                <div key={k} className="w-0.5 bg-white rounded-full" style={{ height: `${h * 100}%` }}></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            // ==================== 原有样式 (极简/拍立得/羊皮纸) ====================
                            <>
                                {/* 原有背景遮罩逻辑 */}
                                <div className={`absolute inset-0 z-0 ${
                                    cardStyle === 'minimal' ? (contact.chatBackground ? 'bg-black/5' : 'bg-transparent') : 
                                    cardStyle === 'polaroid' ? 'bg-black/10 backdrop-blur-sm' : 
                                    'bg-white/50 backdrop-blur-sm'
                                }`}></div>

                                <div className={`relative z-10 flex flex-col flex-1 w-full ${cardStyle === 'polaroid' ? 'p-6 pb-16' : cardStyle === 'minimal' ? 'p-0' : 'p-6'}`}>
                                    
                                    {/* Header (保持不变) */}
                                    {cardStyle === 'minimal' ? (
                                        <div className="pt-5 pb-3 px-5 bg-white/70 backdrop-blur-xl border-b border-white/40 flex justify-between items-center shadow-sm z-20">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-lg shadow-inner">{seedInfo.emoji}</div>
                                                <div><h3 className="text-sm font-black text-gray-800 leading-none">{seedInfo.name}的回忆</h3><p className="text-[9px] text-gray-500 font-mono mt-0.5">{new Date(previewCardData.timestamp).toLocaleDateString()}</p></div>
                                            </div>
                                            <div className="text-right"><span className="text-[9px] font-bold bg-white/50 px-2 py-0.5 rounded-full text-blue-600">Lv.{garden.level}</span></div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center mb-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-xl backdrop-blur-md shadow-sm border bg-white border-gray-200`}><span className="text-2xl filter drop-shadow-sm">{seedInfo.emoji}</span></div>
                                                <div className="flex flex-col items-start gap-1">
                                                    <p className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none px-1.5 py-0.5 rounded backdrop-blur-sm text-gray-500 bg-white/80`}>MEMORY</p>
                                                    <p className={`text-base font-black leading-none px-2 py-1 rounded-md backdrop-blur-sm shadow-sm border text-gray-800 bg-white border-gray-200`}>{seedInfo.name}的回忆</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-[10px] font-mono px-2 py-0.5 rounded-full backdrop-blur-sm mb-1 bg-white/50 text-gray-600`}>{new Date(previewCardData.timestamp).toLocaleDateString()}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-blue-600 border`}>Lv.{garden.level}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* 聊天内容 (保持不变) */}
                                    <div className={`flex-1 flex flex-col ${cardStyle === 'minimal' ? 'bg-transparent p-5' : cardStyle === 'polaroid' ? 'bg-white rounded-sm p-5 pb-12 shadow-2xl border-[12px] border-white transform rotate-1' : 'bg-[#fffdf5] rounded-lg border-yellow-100/50 shadow-md p-5'}`}>
                                        {cardStyle === 'polaroid' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-red-500/20 transform -rotate-2 backdrop-blur-sm z-20"></div>}
                                        {cardStyle !== 'minimal' && (
                                            <div className="text-center mb-6 relative z-10"><span className={`text-xs font-bold px-4 py-1.5 rounded-full shadow-sm border inline-block backdrop-blur-md ${cardStyle === 'polaroid' ? 'text-gray-600 bg-white border-gray-200' : 'text-yellow-800 bg-yellow-50 border-yellow-200'}`}>“{previewCardData.title}”</span></div>
                                        )}

                                        <div className="space-y-4 custom-scrollbar relative z-10 flex-1 h-auto overflow-y-auto">
                                            {previewCardData.messages.map((m: any, i: number) => {
                                                if (m.role === 'system') {
                                                    const content = m.content.replace('【系统通知】', '').trim();
                                                    return (
                                                        <div key={i} className="flex justify-center my-3 relative group">
                                                            <div className="absolute inset-0 bg-yellow-600/20 transform rotate-[-2deg] rounded-sm translate-y-1 translate-x-1 blur-[2px]"></div>
                                                            <div className="relative bg-[#FFFBEB] text-[#78350F] text-xs px-4 py-3 rounded-sm border border-[#FDE68A] transform rotate-[-1deg] max-w-[85%] text-center shadow-sm">
                                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 bg-yellow-200/50 backdrop-blur-[1px] rotate-90 opacity-60"></div>
                                                            <span className="font-medium leading-relaxed">{content}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                const isMe = m.role === 'user';
                                                const bubbleBg = isMe ? (contact.bubbleColorUser || '#FBCFE8') : (contact.bubbleColorAI || '#ffffff');  
                                                const textColor = getContrastColor(bubbleBg);
                                                return (
                                                    <div key={i} className={`flex items-start gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                        {!isMe && (
                                                            <div 
                                                                className="w-9 h-9 rounded-full border border-white/50 shadow-sm flex-shrink-0 bg-cover bg-center"
                                                                style={{ backgroundImage: `url(${m.avatar})` }}
                                                            ></div>
                                                        )}
                                                        
                                                        {m.type === 'image' || (typeof m.content === 'string' && m.content.startsWith('data:image')) ? (
                                                            <img src={m.content} alt="msg-img" crossOrigin="anonymous" className="rounded-lg max-w-[70%] border border-black/5 shadow-sm" />
                                                        ) : (
                                                            <div className={`px-3.5 py-2 rounded-2xl text-sm max-w-[80%] leading-relaxed shadow-sm break-words relative border border-black/5`}
                                                                style={{ backgroundColor: bubbleBg, color: textColor, borderTopLeftRadius: !isMe ? '2px' : '18px', borderTopRightRadius: isMe ? '2px' : '18px' }}>
                                                                {m.content}
                                                            </div>
                                                        )}
                                                        {isMe && (
                                                            <div 
                                                                className="w-9 h-9 rounded-full border border-white/50 shadow-sm flex-shrink-0 bg-cover bg-center"
                                                                style={{ backgroundImage: `url(${m.avatar})` }}
                                                            ></div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 底部信息 (保持不变) */}
                                    {cardStyle === 'minimal' ? (
                                        <div className="mt-4 pt-3 pb-3 px-4 bg-white/70 backdrop-blur-xl border-t border-white/40 flex justify-between items-center z-20 rounded-xl mx-2 mb-2 shadow-sm">
                                            <div className="flex items-center gap-1.5"><span className="text-sm">🍔</span><span className="text-[9px] font-black tracking-widest uppercase text-gray-500">HAMBURGER PHONE</span></div>
                                            <div className="flex flex-col items-end"><span className="text-[8px] font-bold text-gray-600">@{contact.userName || 'User'} & {contact.name}</span><span className="text-[7px] text-gray-400 font-mono">{fullTimestamp}</span></div>
                                        </div>
                                    ) : (
                                        <div className={`mt-5 py-3 px-5 flex justify-between items-end bg-white/70 backdrop-blur-xl rounded-xl shadow-sm border border-white/40 ${cardStyle === 'polaroid' ? 'absolute bottom-4 left-8 right-8 text-gray-800' : 'mx-2 mb-2'}`}>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm bg-white border border-gray-200`}>🍔</div>
                                                <div className="flex flex-col"><span className={`text-[10px] font-black tracking-[0.15em] uppercase leading-none text-gray-700`}>HAMBURGER PHONE</span><span className={`text-[7px] mt-0.5 font-mono text-gray-500`}>Captured on {fullTimestamp}</span></div>
                                            </div>
                                            <div className={`text-[9px] font-bold italic text-gray-500`}>@{contact.userName || 'User'} & {contact.name}</div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* 按钮组 + 定位按钮 */}
                    <div className="flex gap-2 w-full animate-scaleIn mt-2">
                        <button onClick={handleJumpToContext} className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition flex items-center justify-center">
                            📍 定位原文
                        </button>
                        <button onClick={handleSaveCardAsImage} disabled={isSavingImage} className="flex-1 py-3 bg-white text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                            {isSavingImage ? <><span>⏳</span> 渲染长图...</> : <><span>📸</span> 保存图片 (JPG)</>}
                        </button>
                        <button onClick={() => { onUpdate(contact, undefined, previewCardData); setPreviewCardData(null); alert("已分享给TA！"); }} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:opacity-90 transition active:scale-95 flex items-center justify-center gap-2">
                            <span>📤</span> 分享
                        </button>
                    </div>
                    
                    <div className="text-center mt-3 text-white/70 text-[10px] animate-pulse">
                        💡 提示：预览窗有滚动条，但【保存图片】会自动生成完整长图，请放心导出！
                    </div>
                    <button onClick={() => setPreviewCardData(null)} className="mt-4 text-white/50 text-xs hover:text-white underline decoration-dashed mb-10">关闭预览</button>
                </div>
            </div>
        )}
    </div>
  );
};











// ==================== 4. 主组件 (RelationshipSpace) ====================
// ==================== 4. 主组件 (RelationshipSpace) ====================

interface RelationshipSpaceProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
  onRelationshipSpaceAction: (contactId: string, msg: string) => void;
  globalSettings: GlobalSettings;
  // ★★★ 修改：跳转回调需要传两个参数：(联系人ID, 时间戳)
  onJumpToMessage?: (contactId: string, timestamp: number) => void; 
}







// ==================== 4. 主组件 (RelationshipSpace) ====================

interface RelationshipSpaceProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
  onRelationshipSpaceAction: (contactId: string, msg: string) => void;
  globalSettings: GlobalSettings;
  // 新增：跳转回调（App.tsx 需要传进来）
  onJumpToMessage?: (timestamp: number) => void; 
}

const RelationshipSpace: React.FC<RelationshipSpaceProps> = ({ contacts, setContacts, onClose, onRelationshipSpaceAction, globalSettings, onJumpToMessage }) => {
  const [view, setView] = useState<'landing' | 'list' | 'space'>('landing');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [tab, setTab] = useState<'hub' | 'garden'>('hub');
  const [selectedLetter, setSelectedLetter] = useState<LoveLetter | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWriteLetter, setShowWriteLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState({ title: '', content: '' });
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");

  const currentRelationship = contacts.find(c => c.RelationShipUnlocked);
  const targetContact = contacts.find(c => c.id === targetId);

  const getUnreadCount = (c: Contact) => (c.letters || []).filter(l => !l.isOpened && l.from === 'ai').length;
  const RelationshipUnread = currentRelationship ? getUnreadCount(currentRelationship) : 0;
  const friendsUnread = contacts.filter(c => !c.RelationShipUnlocked).reduce((sum, c) => sum + getUnreadCount(c), 0);

  useEffect(() => {
      if (currentRelationship && view === 'landing' && !targetId) {
          setTargetId(currentRelationship.id);
          setView('space');
      }
  }, []); 






// --- 处理跳转逻辑 ---
  const handleJump = (timestamp: number) => {
      // 1. 关闭 RelationshipSpace
      onClose();
      // 2. 调用父级的跳转 (如果有)，并传入当前联系人的ID
      if (onJumpToMessage && targetContact) {
          onJumpToMessage(targetContact.id, timestamp);
      } else {
          console.log("Jump request to:", timestamp);
      }
  };







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

  if (view === 'space' && targetContact) {
      const isRelationship = !!targetContact.RelationShipUnlocked;
      const theme = getTheme(isRelationship ? 'Honeymoon' : (targetContact.relationshipStatus || 'Friend'));
      const daysTogether = Math.floor((Date.now() - (targetContact.created)) / 86400000) + 1;

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
                  right={
                      <div className="relative">
                          <button onClick={() => setShowSettings(!showSettings)} className={`text-xl ${theme.primary} pr-2`}>⚙️</button>
                          {showSettings && (
                              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-32 z-50 animate-scaleIn">
                                  <button onClick={() => {
                                      const newDate = prompt("修改纪念日 (格式: YYYY-MM-DD)", targetContact.created ? new Date(targetContact.created).toISOString().slice(0,10) : "");
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
                          
                          <div className="px-6 mb-4">
                              <MailboxWidget 
                                  letters={targetContact.letters || []} 
                                  theme={theme} 
                                  onOpenLetter={(l) => { setSelectedLetter(l); if (!l.isOpened && l.from === 'ai') { setContacts(prev => prev.map(c => c.id === targetContact.id ? {...c, letters: (c.letters || []).map(x => x.id === l.id ? {...x, isOpened: true} : x)} : c)); }}} 
                                  onWriteLetter={() => setShowWriteLetter(true)}
                              />
                          </div>

                          <div className="px-6 mt-6">
                             <div className="text-sm font-bold text-gray-500 mb-4 px-1 flex items-center justify-between">
                                  <span className="flex items-center gap-2">🧩 灵魂拷问</span>
                                  <button onClick={() => setShowQuestionModal(true)} className="text-[10px] bg-white text-gray-600 px-3 py-1 rounded-full font-bold hover:bg-gray-50 transition shadow-sm border border-gray-200 flex items-center gap-1">✍️ 提问</button>
                             </div>
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
                        // ★★★ 传入跳转回调 ★★★
                        onJumpToMessage={handleJump}
                        onUpdate={(c, sysMsg, shareCard) => { 
                            setContacts(prev => prev.map(old => old.id === c.id ? c : old)); 
                            if(shareCard) onRelationshipSpaceAction(c.id, JSON.stringify(shareCard)); 
                            else if(sysMsg) onRelationshipSpaceAction(c.id, sysMsg); 
                        }} 
                      />
                  )}
              </div>

              <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-2 py-1.5 shadow-2xl flex gap-1 pointer-events-auto">
                      <button onClick={() => setTab('hub')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${tab === 'hub' ? `${theme.accent} text-white shadow-md` : 'text-gray-400 hover:bg-gray-100'}`}>🏠 空间</button>
                      <button onClick={() => setTab('garden')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${tab === 'garden' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}>🌸 花园</button>
                  </div>
              </div>

              {showWriteLetter && (
                  <div className="absolute inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 animate-fadeIn">
                      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scaleIn">
                          <h3 className="font-bold text-lg text-gray-800 mb-4 text-center">✍️ 写信给 TA</h3>
                          <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 mb-3 text-sm outline-none font-bold" placeholder="标题" value={letterDraft.title} onChange={e => setLetterDraft({...letterDraft, title: e.target.value})} />
                          <textarea className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none resize-none mb-4" placeholder="写下你想对 TA 说的话..." value={letterDraft.content} onChange={e => setLetterDraft({...letterDraft, content: e.target.value})} />
                          <div className="flex gap-3">
                              <button onClick={() => setShowWriteLetter(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">取消</button>
                              <button onClick={() => {
                                    if(!letterDraft.title || !letterDraft.content) return alert("写完再寄哦！");
                                    const newLetter: LoveLetter = { id: Date.now().toString(), title: letterDraft.title, content: letterDraft.content, timestamp: Date.now(), isOpened: false, from: 'user' };
                                    setContacts(prev => prev.map(c => c.id === targetContact.id ? { ...c, letters: [...(c.letters||[]), newLetter] } : c));
                                    onRelationshipSpaceAction(targetContact.id, `[系统通知] 用户给你寄了一封信《${newLetter.title}》。`);
                                    setLetterDraft({title:'', content:''});
                                    setShowWriteLetter(false);
                                    alert("信件已投递！📮");
                                }} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${theme.accent}`}>投递</button>
                          </div>
                      </div>
                  </div>
              )}

              {showQuestionModal && (
                  <div className="absolute inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 animate-fadeIn">
                      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scaleIn">
                          <h3 className="font-bold text-lg text-gray-800 mb-4 text-center">🧩 灵魂拷问</h3>
                          <textarea className="w-full h-28 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none resize-none mb-4 focus:ring-2 focus:ring-purple-200" placeholder="例如：对你来说，最重要的是什么？" value={questionDraft} onChange={e => setQuestionDraft(e.target.value)} autoFocus />
                          <div className="flex gap-3">
                              <button onClick={() => setShowQuestionModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">取消</button>
                              <button onClick={() => {
                                    if(!questionDraft.trim()) return alert("问题不能为空哦！");
                                    const newQA: QAEntry = { id: Date.now().toString(), question: questionDraft, aiAnswer: "", userAnswer: "这是我提出的问题", date: new Date().toLocaleDateString(), timestamp: Date.now() };
                                    setContacts(prev => prev.map(c => c.id === targetContact.id ? { ...c, questions: [...(c.questions||[]), newQA] } : c));
                                    onRelationshipSpaceAction(targetContact.id, `[系统通知] 用户向你提出了一个灵魂拷问：“${questionDraft}”`);
                                    setQuestionDraft("");
                                    setShowQuestionModal(false);
                                    alert("问题已送达！");
                                }} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg bg-purple-500 shadow-purple-200`}>发送</button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return <div className="h-full flex items-center justify-center text-gray-400">Loading...</div>;
};

export default RelationshipSpace;