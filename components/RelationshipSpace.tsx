import React, { useState, useEffect, useRef } from 'react';
import { Contact, LoveLetter, QAEntry, Message, GlobalSettings } from '../types';
import SafeAreaHeader from './SafeAreaHeader';
import { generateResponse } from '../services/apiService'; 
// 【RelationshipSpace.tsx】 文件最顶部
// 这是一组导入 html-to-image 的代码（请完全替换原来的 html2canvas 导入行）
import * as htmlToImage from 'html-to-image';
// 找到这行 import，把 FriendGroup 和 BucketItem 加进去
import {FriendGroup, BucketItem } from '../types';










// ==================== [更新] 真实信封样式表 ====================
const MailboxStyles = () => (
  <style>{`
    /* 1. 邮箱开盖动画 (保持) */
    @keyframes lid-open { 0% { transform: rotateX(0deg); } 100% { transform: rotateX(-110deg); } }
    .mailbox-lid.open { animation: lid-open 0.6s forwards ease-in-out; transform-origin: top; }
    
    /* 2. 纸笔悬浮 (保持) */
    @keyframes float-y { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    .animate-float-y { animation: float-y 3s infinite ease-in-out; }

    /* 3. ★★★ 真实信封样式 (核心) ★★★ */
    .real-envelope {
        background-color: #fdfbf7; /* 米黄信纸底色 */
        position: relative;
        box-shadow: 0 4px 8px rgba(0,0,0,0.08);
        border: 1px solid #e5e5e5;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .real-envelope:active { transform: scale(0.98); }
    
    /* 信封的三角形封口 */
    .envelope-flap {
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 0;
        border-top: 60px solid #f3f0e9; /* 稍微深一点的米色 */
        border-left: 140px solid transparent;
        border-right: 140px solid transparent;
        z-index: 10;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.05));
    }
    
    /* 邮票纹理 */
    .stamp-border {
        border: 2px dashed #e5e7eb;
        background: radial-gradient(circle, transparent 40%, #ffffff 45%);
        background-size: 8px 8px;
    }
    
    /* 邮戳印记 */
    .postmark {
        border: 2px solid rgba(0,0,0,0.1);
        border-radius: 50%;
        color: rgba(0,0,0,0.2);
        font-family: 'Courier New', monospace;
        text-transform: uppercase;
        transform: rotate(-15deg);
    }
  `}</style>
);











// ==================== [新增] 情侣空间专属组件 ====================

// 这是一组代码：修复背景层遮挡，让鼠标能穿透爱心点到按钮
const FloatingHearts = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="absolute text-pink-200 animate-float" 
           style={{
             left: `${Math.random() * 100}%`,
             top: '100%',
             fontSize: `${Math.random() * 20 + 10}px`,
             animationDuration: `${Math.random() * 5 + 5}s`,
             animationDelay: `${Math.random() * 2}s`
           }}>
         {['❤', '✨', '💖'][i % 3]}
      </div>
    ))}
    <style>{`
      @keyframes float { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 20% { opacity: 0.8; } 100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; } }
      .animate-float { animation: float linear infinite; }
    `}</style>
  </div>
);





// 这是一组代码：新增的成员选择器 (用于写信/浇水时选人)
const MemberSelectorModal: React.FC<{
    isOpen: boolean;
    contacts: Contact[];
    members: string[]; // 成员ID列表
    title: string;
    onSelect: (contact: Contact) => void;
    onClose: () => void;
}> = ({ isOpen, contacts, members, title, onSelect, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-64 rounded-2xl p-4 shadow-2xl animate-scaleIn" onClick={e => e.stopPropagation()}>
                <h3 className="text-center font-bold text-gray-800 mb-3">{title}</h3>
                <div className="grid grid-cols-3 gap-3">
                    {members.map(mid => {
                        const c = contacts.find(contact => contact.id === mid);
                        if (!c) return null;
                        return (
                            <div key={mid} onClick={() => onSelect(c)} className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition active:scale-95">
                                <img src={c.avatar} className="w-10 h-10 rounded-full border border-gray-200 object-cover" />
                                <span className="text-[10px] text-gray-600 mt-1 truncate w-full text-center">{c.name}</span>
                            </div>
                        );
                    })}
                </div>
                <button onClick={onClose} className="w-full mt-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">取消</button>
            </div>
        </div>
    );
};









// 2. 📸 拍立得照片墙 (沉没成本核心：存了照片就舍不得删)
const PolaroidWall: React.FC<{ photos: (string | null)[], onUpload: (e: any, i: number) => void }> = ({ photos = [null, null, null], onUpload }) => {
  return (
    <div className="relative h-40 w-full mb-6 z-10 flex justify-center items-center">
       {/* 绳子 */}
       <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-300 shadow-sm transform -rotate-1"></div>
       
       {[0, 1, 2].map((i) => (
         <div key={i} className="relative group transition-transform hover:z-20 hover:scale-110 duration-300" 
              style={{ transform: `rotate(${i === 0 ? -15 : i === 1 ? 5 : 15}deg) translateY(${i === 1 ? 10 : 0}px)`, margin: '0 -10px' }}>
            {/* 夹子 */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-8 bg-amber-700 rounded-sm shadow-md z-20"></div>
            
            <label className="block w-24 h-28 bg-white p-2 pb-6 shadow-lg transform transition cursor-pointer relative overflow-hidden">
               {photos[i] ? (
                 <img src={photos[i]!} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all" />
               ) : (
                 <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 text-xs font-bold border-2 border-dashed border-gray-200">
                    + 照片
                 </div>
               )}
               <input type="file" className="hidden" accept="image/*" onChange={(e) => onUpload(e, i)} />
               {/* 底部手写字 */}
               <div className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-cursive text-gray-400 opacity-0 group-hover:opacity-100 transition">Memories</div>
            </label>
         </div>
       ))}
    </div>
  );
};
// ==================== ⬇️ 替换 HeartbeatTouch 组件 ⬇️ ====================
// 3. 💓 心动触碰 (去油腻版：纯粹的心跳共鸣)
const HeartbeatTouch: React.FC<{ contact: Contact, days: number }> = ({ contact, days }) => {
    const [animate, setAnimate] = useState(false);
    
    const handlePoke = () => {
        setAnimate(true);
        // 只有震动反馈，没有文字，此时无声胜有声
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        setTimeout(() => setAnimate(false), 800);
    };

    return (
        <div className="relative text-center z-10 mb-8 mt-4">
            <div className="inline-block relative group" onClick={handlePoke}>
                {/* 呼吸灯光晕 */}
                <div className={`absolute inset-0 rounded-full bg-rose-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000 ${animate ? 'animate-ping opacity-60' : 'animate-pulse'}`}></div>
                
                {/* 头像 */}
                <img 
                    src={contact.avatar} 
                    className={`w-32 h-32 rounded-full border-4 border-white shadow-2xl object-cover relative z-10 cursor-pointer transition-all duration-300 ${animate ? 'scale-90 grayscale-[20%]' : 'hover:scale-105'}`} 
                />
                
                {/* 状态徽章 */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20">
                    <span className="bg-white/90 backdrop-blur text-rose-500 text-[10px] font-black px-3 py-1 rounded-full shadow-sm border border-rose-100 flex items-center gap-1 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        在线
                    </span>
                </div>
            </div>
            
            <h2 className="text-2xl font-black text-gray-800 mt-5 flex items-center justify-center gap-2 tracking-tight">
                {contact.name} 
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1 tracking-widest uppercase">Connected for {days} Days</p>
        </div>
    );
};





// ==================== 1. 定义部分 (花语 & 主题) ====================

const SEED_TYPES = [
  { id: 'rose', name: '红玫瑰', color: 'text-rose-500', bg: 'bg-rose-100', emoji: '🌹', desc: '热烈而唯一的爱' },
  { id: 'sunflower', name: '向日葵', color: 'text-yellow-500', bg: 'bg-yellow-100', emoji: '🌻', desc: '眼中只有你' },
  { id: 'lily', name: '百合花', color: 'text-slate-500', bg: 'bg-slate-100', emoji: '🪷', desc: '纯洁的羁绊' },
  { id: 'bluebell', name: '蓝风铃', color: 'text-blue-500', bg: 'bg-blue-100', emoji: '🪻', desc: '温柔的守候' },
  { id: 'sakura', name: '樱花', color: 'text-pink-400', bg: 'bg-pink-100', emoji: '🌸', desc: '浪漫的约定' },
  { id: 'cactus', name: '仙人掌', color: 'text-green-600', bg: 'bg-green-100', emoji: '🌵', desc: '坚定的守护' },
];

// ==================== ⬇️ 替换 getTheme 函数 ⬇️ ====================
const getTheme = (status: string) => {
  // 通用纹理：一种细腻的纸质噪点
  const paperTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

  switch (status) {
    case 'Honeymoon':
    case 'Stable':
      // 恋人：柔和粉白 + 噪点纹理
      return { 
          bg: 'bg-[#fff5f7]', // 纯色底
          style: { backgroundImage: paperTexture }, // 叠加纹理
          primary: 'text-rose-600', 
          accent: 'bg-rose-500', 
          border: 'border-rose-200', 
          cardBg: 'bg-white/60 backdrop-blur-sm', 
          title: '甜蜜小窝', 
          icon: '💖' 
      };
    default:
      // 朋友：清爽蓝白 + 噪点纹理
      return { 
          bg: 'bg-[#f0f9ff]', 
          style: { backgroundImage: paperTexture },
          primary: 'text-sky-600', 
          accent: 'bg-sky-500', 
          border: 'border-sky-200', 
          cardBg: 'bg-white/60 backdrop-blur-sm', 
          title: '密友基地', 
          icon: '✨' 
      };
  }
};










// ==================== [Pro版] 桌面沉浸式信箱组件 ====================

// 1. 💌 读信/写信通用弹窗 (增加了回复和收藏功能)
const LetterPaperModal: React.FC<{
    isOpen: boolean;
    mode: 'read' | 'write';
    themeColor: string;
    initialData?: { id: string; title: string; content: string; fromName?: string; toName?: string; date?: string; isFavorite?: boolean };
    replyContext?: string; // 回复时的上下文
    onClose: () => void;
    onSend?: (title: string, content: string, signature: string) => void;
    onReply?: (letterId: string, content: string, title: string) => void; // 点击回复按钮的回调
    onToggleStar?: (letterId: string) => void; // 点击收藏的回调
}> = ({ isOpen, mode, themeColor, initialData, replyContext, onClose, onSend, onReply, onToggleStar }) => {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [signature, setSignature] = useState("我");
    const [isStar, setIsStar] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (mode === 'read' && initialData) {
                setTitle(initialData.title);
                setContent(initialData.content);
                setSignature(initialData.fromName || "未知");
                setIsStar(!!initialData.isFavorite);
            } else if (mode === 'write') {
                setTitle(replyContext ? `Re: ${replyContext}` : ""); // 如果是回复，自动填标题
                setContent("");
                setSignature("我"); 
            }
        }
    }, [isOpen, mode, initialData, replyContext]);

    if (!isOpen) return null;

    const accentColor = themeColor === 'rose' ? 'text-rose-500' : 'text-blue-500';
    const btnBg = themeColor === 'rose' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" onClick={onClose}>
            <div 
                className="relative w-full max-w-sm bg-[#fffdf5] rounded-sm shadow-2xl p-6 paper-texture transform transition-all duration-500 rotate-1 animate-scaleIn flex flex-col"
                onClick={e => e.stopPropagation()}
                style={{ minHeight: '65vh', maxHeight: '85vh' }}
            >
                {/* 装饰：右上角邮票 */}
                <div className="absolute top-4 right-4 p-2 border-2 border-dashed border-gray-300 rounded opacity-60 pointer-events-none">
                    <span className="text-2xl grayscale opacity-50">🏔️</span>
                </div>

                {/* 顶部信息 */}
                <div className="mb-4 border-b border-gray-200 pb-2">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400 font-mono">
                            {mode === 'read' ? (initialData?.date || 'Unknown') : new Date().toLocaleDateString()}
                        </span>
                        {/* 收藏按钮 (仅读信模式) */}
                        {mode === 'read' && initialData && (
                            <button 
                                onClick={() => { setIsStar(!isStar); onToggleStar && onToggleStar(initialData.id); }}
                                className="text-xl hover:scale-110 transition active:scale-95"
                            >
                                {isStar ? '⭐' : '☆'}
                            </button>
                        )}
                    </div>
                    {mode === 'read' && (
                        <div className="text-xs font-bold text-gray-500">
                            To: {initialData?.toName || 'Me'}
                        </div>
                    )}
                    {/* 回复上下文提示 */}
                    {mode === 'write' && replyContext && (
                        <div className="text-[10px] text-gray-400 italic bg-gray-100 p-1 rounded mb-2">
                            正在回复: "{replyContext}"
                        </div>
                    )}
                </div>

                {/* 内容区 */}
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                    {mode === 'write' ? (
                        <input 
                            className="w-full bg-transparent text-xl font-black text-gray-800 outline-none placeholder-gray-300 border-b border-dashed border-gray-300 pb-1"
                            placeholder="信件标题..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    ) : (
                        <h3 className="text-xl font-black text-gray-800 border-b border-dashed border-gray-300 pb-2">{title}</h3>
                    )}

                    {mode === 'write' ? (
                        <textarea 
                            className="w-full h-full min-h-[200px] bg-transparent text-sm text-gray-700 leading-loose outline-none resize-none placeholder-gray-300 font-serif"
                            placeholder={replyContext ? "写下你的回信..." : "展信佳..."}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                    ) : (
                        <div className="text-sm text-gray-700 leading-loose whitespace-pre-wrap font-serif pb-4">
                            {content}
                        </div>
                    )}
                </div>
{/* 底部按钮区 (修复版：自己发的信不显示回信按钮) */}
                <div className="pt-4 border-t border-gray-100 flex items-end justify-between mt-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest">From</span>
                        {mode === 'write' ? (
                            <input 
                                className="bg-transparent font-cursive text-lg text-gray-600 outline-none w-20 border-b border-gray-200"
                                value={signature}
                                onChange={e => setSignature(e.target.value)}
                            />
                        ) : (
                            <span className="font-cursive text-lg text-gray-600">{signature}</span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {/* 写信模式：显示寄出 */}
                        {mode === 'write' && (
                            <button 
                                onClick={() => onSend && onSend(title, content, signature)}
                                disabled={!title.trim() || !content.trim()}
                                className={`${btnBg} text-white px-5 py-2 rounded-full font-bold text-xs shadow-lg active:scale-95 transition flex items-center gap-1 disabled:opacity-50`}
                            >
                                <span>📮</span> 寄出
                            </button>
                        )}
                        
                        {/* 读信模式 */}
                        {mode === 'read' && initialData && (
                            <>
                                <button onClick={onClose} className="px-4 py-2 text-gray-400 font-bold text-xs hover:bg-gray-100 rounded-full transition">
                                    关闭
                                </button>
                                
                                {/* ★★★ 核心修复：只有"不是我发的"信，才显示回信按钮 ★★★ */}
                                {initialData.fromName !== '我' && (
                                    <button 
                                        onClick={() => onReply && onReply(initialData.id, initialData.content, initialData.title)}
                                        className={`${btnBg} text-white px-4 py-2 rounded-full font-bold text-xs shadow-lg active:scale-95 transition flex items-center gap-1`}
                                    >
                                        <span>↩️</span> 回信
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// 2. 📮 桌面信箱主组件 (修复头像 + 修复回信通知)
const MailboxSection: React.FC<{
    letters: LoveLetter[];
    contacts: Contact[]; 
    members: string[]; 
    isGroup: boolean;
    // ★★★ 新增：接收用户的真实信息 ★★★
    userAvatar: string;
    userName: string;
    // 修改：增加 isReply 参数
    onSend: (targetId: string, title: string, content: string, isReply: boolean) => void;
    onMarkAsRead: (letterId: string) => void;
    onToggleStar: (letterId: string) => void;
}> = ({ letters, contacts, members, isGroup, userAvatar, userName, onSend, onMarkAsRead, onToggleStar }) => {
    
    const [viewMode, setViewMode] = useState<'closed' | 'inbox' | 'outbox' | 'favorites'>('closed');
    const [isAnimating, setIsAnimating] = useState(false);
    
    const [showMemberSelect, setShowMemberSelect] = useState(false);
    const [showPaper, setShowPaper] = useState(false);
    const [paperMode, setPaperMode] = useState<'read' | 'write'>('read');
    
    const [currentLetterData, setCurrentLetterData] = useState<any>(null);
    const [targetRecipientId, setTargetRecipientId] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<{title: string, content: string} | null>(null);

    const receivedLetters = letters.filter(l => l.from !== 'user');
    const sentLetters = letters.filter(l => l.from === 'user');
    const favoriteLetters = letters.filter(l => l.isFavorite);
    const unreadCount = receivedLetters.filter(l => !l.isOpened).length;

    const styles = {
        deskClass: isGroup ? 'wood-texture-blue' : 'wood-texture-rose',
        mailboxMain: isGroup ? 'bg-blue-500 border-blue-700' : 'bg-rose-500 border-rose-700',
        mailboxLid: isGroup ? 'bg-blue-400 border-blue-600' : 'bg-rose-400 border-rose-600',
        badge: isGroup ? 'bg-orange-500' : 'bg-red-500',
        stampColor: isGroup ? 'text-blue-300' : 'text-rose-300'
    };

    const handleMailboxClick = () => {
        if (viewMode !== 'closed') { setViewMode('closed'); setIsAnimating(false); } 
        else { setIsAnimating(true); setTimeout(() => setViewMode('inbox'), 600); }
    };

    const handleStationeryClick = () => {
        setViewMode('closed'); setReplyingTo(null);
        if (isGroup) { setShowMemberSelect(true); } 
        else {
            const target = members[0] || contacts[0]?.id; 
            if(target) { setTargetRecipientId(target); setPaperMode('write'); setShowPaper(true); }
        }
    };

    const handleSendLetter = (title: string, content: string, signature: string) => {
        if (!targetRecipientId) return;
        
        // 构建内容
        const finalContent = replyingTo 
            ? `${content}\n\n--- 引用: ${replyingTo.title} ---\n${replyingTo.content.slice(0,50)}... \n\n-- ${signature}` 
            : `${content}\n\n-- ${signature}`;
        
        // ★★★ 核心修复：明确传递 isReply 状态 (由 replyingTo 决定) ★★★
        const isReplyAction = !!replyingTo;
        onSend(targetRecipientId, title, finalContent, isReplyAction);
        
        setShowPaper(false); setReplyingTo(null); setTargetRecipientId(null);
        alert("信件已投递！🕊️"); setViewMode('outbox');
    };

    const handleReadClick = (letter: LoveLetter) => {
        if (!letter.isOpened && letter.from !== 'user') onMarkAsRead(letter.id);

        const isMe = letter.from === 'user';
        let partnerContact: Contact | undefined;
        
        if (isGroup) {
            const partnerId = isMe ? letter.to : letter.from;
            partnerContact = contacts.find(c => c.id === partnerId);
        } else {
            const partnerId = members[0];
            partnerContact = contacts.find(c => c.id === partnerId);
        }

        const fromName = isMe ? '我' : (partnerContact?.name || 'Partner');
        const toName = isMe ? (partnerContact?.name || 'Partner') : '我';

        setCurrentLetterData({
            id: letter.id,
            title: letter.title,
            content: letter.content,
            fromName,
            toName,
            date: new Date(letter.timestamp).toLocaleDateString(),
            isFavorite: letter.isFavorite
        });
        setPaperMode('read');
        setShowPaper(true);
    };

    const handleReplyClick = (letterId: string, content: string, title: string) => {
        const original = letters.find(l => l.id === letterId);
        if(original) {
            setTargetRecipientId(original.from);
            setReplyingTo({ title, content });
            setPaperMode('write');
        }
    };

    const displayList = viewMode === 'inbox' ? receivedLetters : viewMode === 'outbox' ? sentLetters : favoriteLetters;

    return (
        <div className={`mt-6 mb-6 mx-2 pt-8 pb-4 px-4 rounded-3xl relative transition-colors duration-500 shadow-inner ${styles.deskClass}`}>
            <MailboxStyles />

            <div className="flex justify-between items-end h-40 relative z-10 perspective-1000 mb-6 px-4">
                <div className="relative group cursor-pointer transform transition-transform hover:scale-105 active:scale-95" onClick={handleMailboxClick}>
                    {unreadCount > 0 && viewMode === 'closed' && (
                        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 ${styles.badge} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-bounce z-20 whitespace-nowrap border-2 border-white`}>
                            {unreadCount} 封新信件
                        </div>
                    )}
                    <div className={`mailbox-lid absolute top-0 left-0 w-28 h-16 ${styles.mailboxLid} rounded-t-3xl border-b-4 border-black/10 origin-top transition-all duration-500 z-10 ${viewMode !== 'closed' || isAnimating ? 'open' : ''}`}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 font-black text-[10px] tracking-widest uppercase">{isGroup ? 'SQUAD MAIL' : 'LOVE MAIL'}</div>
                    </div>
                    <div className={`w-28 h-20 ${styles.mailboxMain} rounded-b-xl border-x-2 border-b-4 shadow-xl relative`}></div>
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3 h-20 bg-gray-700 -z-10 rounded-full"></div>
                    <div className="text-center mt-6 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {viewMode === 'closed' ? '点击查收' : '关闭信箱'}
                    </div>
                </div>

                <div className="relative group cursor-pointer hover-trigger transform transition-transform hover:scale-105 active:scale-95" onClick={handleStationeryClick}>
                    <div className="relative w-24 h-24 flex items-center justify-center animate-float-y">
                        <div className="absolute w-16 h-20 bg-white border border-gray-200 rounded shadow-sm transform rotate-6"></div>
                        <div className="absolute w-16 h-20 bg-[#fffdf5] border border-gray-200 rounded shadow-md flex flex-col items-center justify-center p-2 transform rotate-1">
                            <div className="w-full h-0.5 bg-gray-200 mb-2"></div>
                            <div className="w-2/3 h-0.5 bg-gray-200"></div>
                        </div>
                        <div className="absolute -top-2 -right-4 text-4xl filter drop-shadow-md pen-icon">✒️</div>
                    </div>
                    <div className="text-center mt-2 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-0.5 rounded-full backdrop-blur-sm">提笔写信</div>
                </div>
            </div>

            {viewMode !== 'closed' && (
                <div className="space-y-4 animate-slideDown pb-4 min-h-[200px]">
                    <div className="flex justify-center gap-2 mb-4">
                        {[ { id: 'inbox', label: '收件箱', icon: '📬' }, { id: 'outbox', label: '寄件箱', icon: '📤' }, { id: 'favorites', label: '收藏', icon: '⭐' } ].map(tab => (
                            <button key={tab.id} onClick={() => setViewMode(tab.id as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${viewMode === tab.id ? 'bg-white text-gray-800 scale-105' : 'bg-white/40 text-gray-500 hover:bg-white/60'}`}>
                                <span>{tab.icon}</span> {tab.label}
                            </button>
                        ))}
                    </div>

                    {displayList.length === 0 ? (
                        <div className="text-center py-10 opacity-50"><span className="text-4xl grayscale block mb-2">📭</span><span className="text-xs font-bold text-gray-500">这里没有信件...</span></div>
                    ) : (
                        [...displayList].reverse().map(letter => {
                            const isMe = letter.from === 'user';
                            
                            // ★★★ 修复头像显示逻辑 ★★★
                            let contact;
                            if (isGroup) {
                                const cid = isMe ? letter.to : letter.from;
                                contact = contacts.find(c => c.id === cid);
                            } else {
                                contact = isMe ? contacts.find(c => c.id === letter.to) : contacts.find(c => c.id === members[0]); 
                            }
                            
                            // 如果是 'user'，使用传入的 userAvatar；如果是对方，使用 contact.avatar
                            const displayAvatar = isMe ? userAvatar : (contact?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Love");
                            
                            // 如果是 'user'，名字显示“我”；如果是对方，显示对方名字
                            const displayName = isMe ? '我' : (contact?.name || 'Partner');
                            const prefix = isMe ? (viewMode === 'outbox' ? `致: ${contact?.name || 'TA'}` : '我') : `来自: ${displayName}`;

                            return (
                                <div key={letter.id} onClick={() => handleReadClick(letter)} className="real-envelope rounded-lg p-4 mx-2 cursor-pointer flex flex-col gap-2 group relative">
                                    <div className="envelope-flap"></div>
                                    <div className="flex justify-between items-start mb-2 relative z-20">
                                        <div className="flex items-center gap-2">
                                            <img src={displayAvatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover bg-gray-100" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700">{prefix}</span>
                                                <span className="text-[9px] text-gray-400 font-mono">{new Date(letter.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-12 bg-white stamp-border flex items-center justify-center shadow-sm transform rotate-3"><span className={`text-lg ${styles.stampColor}`}>🌷</span></div>
                                        <div className="absolute top-1 right-8 postmark w-12 h-12 flex items-center justify-center text-[8px] font-bold pointer-events-none">{isGroup ? 'FRIEND' : 'LOVE'}</div>
                                    </div>
                                    <h4 className="text-sm font-black text-gray-800 ml-1 z-20 relative">{letter.title || "无标题信件"}</h4>
                                    <p className="text-xs text-gray-500 italic ml-1 truncate opacity-70 z-20 relative font-serif">{letter.content.replace(/\n/g, ' ')}</p>
                                    <div className="absolute bottom-3 right-3 flex gap-2 z-20">
                                        {!letter.isOpened && !isMe && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                                        {letter.isFavorite && <span className="text-xs">⭐</span>}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <MemberSelectorModal isOpen={showMemberSelect} title="寄给谁？" contacts={contacts} members={members} onClose={() => setShowMemberSelect(false)} onSelect={(c) => { setTargetRecipientId(c.id); setShowMemberSelect(false); setPaperMode('write'); setShowPaper(true); }} />
            <LetterPaperModal isOpen={showPaper} mode={paperMode} themeColor={isGroup ? 'blue' : 'rose'} initialData={currentLetterData} replyContext={replyingTo ? replyingTo.title : undefined} onClose={() => { setShowPaper(false); setCurrentLetterData(null); setReplyingTo(null); }} onSend={handleSendLetter} onReply={handleReplyClick} onToggleStar={onToggleStar} />
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










// ==================== [修复版] 恋爱清单组件 (修复保存逻辑 + 自动打标签) ====================
const CoupleBucketList: React.FC<{ 
    contact: Contact, 
    theme: any, 
    onUpdate: (items: BucketItem[]) => void,
    onShare: (item: BucketItem) => void 
}> = ({ contact, theme, onUpdate, onShare }) => {
    // 读取清单，如果没有就初始化几个默认的
    const items: BucketItem[] = (contact as any).bucketList || [
        { id: '1', title: '一起看一场日出', userContent: '', aiContent: '我想在海边看太阳升起...', isDone: false, isUnlocked: false },
        { id: '2', title: '为对方做一顿饭', userContent: '', aiContent: '想给你做虽然可能不好吃但是充满爱心的炒饭！', isDone: false, isUnlocked: false },
        { id: '3', title: '换一次情侣头像', userContent: '', aiContent: '想要那种酷酷的黑白风！', isDone: false, isUnlocked: false },
    ];

    const [activeItem, setActiveItem] = useState<BucketItem | null>(null);
    const [inputVal, setInputVal] = useState("");

    // 提交我的想法 (双盲解锁核心 + 修复保存)
    const handleSubmit = () => {
        if (!activeItem || !inputVal.trim()) return;
        
        // 1. 计算新的清单数据
        const newItems = items.map(it => {
            if (it.id === activeItem.id) {
                // 只要我有内容，且AI也有内容(预设或生成)，就解锁
                const canUnlock = !!it.aiContent; 
                return { ...it, userContent: inputVal, isUnlocked: canUnlock };
            }
            return it;
        });
        
        // 2. ★★★ 关键修复：立即执行保存 ★★★
        onUpdate(newItems); 
        
        // 3. 准备要分享/通知的对象
        const updatedItem = { ...activeItem, userContent: inputVal, isUnlocked: true };

        // 4. 触发分享通知 (这里只负责传对象，具体加标签在父组件)
        onShare(updatedItem);

        // 5. 清理状态
        alert("✨ 想法已记录！");
        setInputVal("");
        setActiveItem(null);
    };

    return (
        <div className="mt-8 px-2">
            <div className="flex justify-between items-center mb-4 px-1">
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1">📝 恋爱清单 100 件小事</span>
                <button onClick={() => {
                    const title = prompt("添加一个新的愿望:");
                    if(title) {
                        const newItem: BucketItem = { id: Date.now().toString(), title, userContent: '', aiContent: '', isDone: false, isUnlocked: false };
                        onUpdate([...items, newItem]);
                    }
                }} className="text-[10px] bg-white text-gray-600 px-3 py-1.5 rounded-full font-bold hover:bg-gray-50 transition shadow-sm border border-gray-200">
                    + 添加愿望
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {items.map(item => (
                    <div 
                        key={item.id} 
                        onClick={() => setActiveItem(item)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-32 shadow-sm active:scale-95
                            ${item.isUnlocked 
                                ? 'bg-white border-pink-200' 
                                : 'bg-gray-50 border-gray-100 grayscale-[0.5]'
                            }`}
                    >
                        {/* 状态角标 */}
                        <div className="absolute top-0 right-0 px-2 py-1 bg-black/5 text-[9px] rounded-bl-lg font-bold text-gray-400">
                            {item.isUnlocked ? (item.isDone ? '✅ 已完成' : '✨ 进行中') : '🔒 待填写'}
                        </div>

                        <h4 className="font-bold text-sm text-gray-800 leading-tight mt-2">{item.title}</h4>
                        
                        {/* 双盲遮罩文字 */}
                        <div className="text-[10px] text-gray-400 mt-2">
                            {item.isUnlocked 
                                ? <span className="text-pink-500">点击查看双方想法 ➜</span> 
                                : "填入你的想法后解锁"}
                        </div>
                    </div>
                ))}
            </div>

            {/* 填写/查看详情弹窗 */}
            {activeItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fadeIn" onClick={() => setActiveItem(null)}>
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        
                        {/* 顶部标题 */}
                        <div className="text-center mb-6">
                            <span className="text-xs font-bold text-pink-400 tracking-widest uppercase">WISH NO.{activeItem.id}</span>
                            <h3 className="text-xl font-black text-gray-800 mt-1">{activeItem.title}</h3>
                        </div>

                        {/* 内容区：如果已解锁，显示双方；如果未解锁，只显示输入框 */}
                        {activeItem.isUnlocked ? (
                            <div className="space-y-4">
                                {/* AI的想法 */}
                                <div className="bg-blue-50 p-4 rounded-2xl rounded-tl-none border border-blue-100 relative">
                                    <span className="absolute -top-3 left-0 bg-blue-100 text-blue-600 text-[9px] px-2 py-0.5 rounded-full font-bold">{contact.name} 的想法</span>
                                    <p className="text-sm text-gray-700">{activeItem.aiContent || "（TA 还在思考中...）"}</p>
                                </div>
                                {/* 我的想法 */}
                                <div className="bg-pink-50 p-4 rounded-2xl rounded-tr-none border border-pink-100 relative text-right">
                                    <span className="absolute -top-3 right-0 bg-pink-100 text-pink-600 text-[9px] px-2 py-0.5 rounded-full font-bold">我的想法</span>
                                    <p className="text-sm text-gray-700">{activeItem.userContent}</p>
                                </div>
                                
                                {/* 按钮组 */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                                    <button onClick={() => {
                                        // 标记完成
                                        const newItems = items.map(it => it.id === activeItem.id ? { ...it, isDone: !it.isDone } : it);
                                        onUpdate(newItems);
                                        setActiveItem(null);
                                    }} className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${activeItem.isDone ? 'bg-gray-100 text-gray-500' : 'bg-green-500 text-white shadow-lg'}`}>
                                        {activeItem.isDone ? '撤销完成' : '我们做到了! ✅'}
                                    </button>
                                    <button onClick={() => onShare(activeItem)} className="px-4 bg-yellow-400 text-yellow-900 rounded-xl font-bold text-lg shadow-sm">
                                        📤
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* 未解锁状态：输入框 */
                            <div>
                                <div className="bg-gray-100 p-4 rounded-xl mb-4 text-center text-gray-400 text-xs italic">
                                    🔒 对方的想法被隐藏了<br/>写下你的想法，看看你们是否默契？
                                </div>
                                <textarea 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none resize-none h-32 focus:border-pink-300 transition" 
                                    placeholder="我想..." 
                                    value={inputVal}
                                    onChange={e => setInputVal(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleSubmit} className="w-full mt-4 bg-pink-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-pink-600 active:scale-95 transition">
                                    写好了，解锁TA的想法！🔓
                                </button>
                            </div>
                        )}
                    </div>
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














// 这是一组代码：GardenPage 参数更新 (增加 isGroup 和 contacts)
const GardenPage: React.FC<{ 
    contact: Contact, 
    onUpdate: (c: Contact, sysMsg?: string, shareMsg?: any) => void, 
    globalSettings: any,
    onJumpToMessage?: (timestamp: number) => void,
    isGroup?: boolean,      // 新增：是否是群组
    members?: string[],     // 新增：群成员ID
    allContacts?: Contact[] // 新增：所有联系人(用于查找成员头像)
}> = ({ contact, onUpdate, globalSettings, onJumpToMessage, isGroup = false, members = [], allContacts = [] }) => {
  const garden = contact.garden || { seed: '', level: 0, exp: 0, lastWaterDate: '', lastFertilizeDate: '' };
  
  const [previewCardData, setPreviewCardData] = useState<any>(null);
  const [isWatering, setIsWatering] = useState(false);
  const [showFertilizerInput, setShowFertilizerInput] = useState(false);
  const [fertilizerMsg, setFertilizerMsg] = useState("");

  const [cardStyle, setCardStyle] = useState<'glass' | 'polaroid' | 'paper' | 'minimal'>('minimal');
  const cardToSaveRef = useRef<HTMLDivElement>(null); 
  const [isSavingImage, setIsSavingImage] = useState(false);
  // 新增：控制选人弹窗
  const [showMemberSelect, setShowMemberSelect] = useState(false);

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

// 这是一组代码：新的浇水逻辑 (支持选定特定对象的聊天记录)
  const handleWater = async (targetContactInput?: Contact) => { 
      // 如果是群组且没传人，先弹窗选人
      if (isGroup && !targetContactInput) {
          setShowMemberSelect(true);
          return;
      }

      // 确定目标：如果是群组就用选的人，否则就是当前contact
      const target = targetContactInput || contact;
      setShowMemberSelect(false); // 关闭弹窗

      // 1. 检查聊天记录 (使用 target 的历史)
      const validMsgs = target.history.filter(m => m.content.length > 1 && !m.content.includes('"type":')); 
      if (validMsgs.length < 5) return alert(`和 ${target.name} 的回忆不足5条，再多聊聊吧~`); 
      
      setIsWatering(true); 
      
      // ... (保留你原来的 generateCard 逻辑，注意要把里面的 contact 换成 target) ...
      const generateCard = async (dialogue: any[], memoryTimestamp: number, isBonus: boolean = false) => { 
          const processedMessages = await Promise.all(dialogue.map(async (d: any) => {
              const name = d.role === 'user' ? target.userName : target.name; // 用 target
              const avatarUrl = d.role === 'user' ? target.userAvatar : target.avatar; // 用 target
              const base64Avatar = await urlToBase64(avatarUrl, name);
              let content = d.content;
              if (d.type === 'image' && !content.startsWith('data:')) {
                  content = await urlToBase64(content, "IMG");
              }
              return { role: d.role, avatar: base64Avatar, content: content, type: d.type };
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
          
          // 更新并通知
          const sysMsg = `[花园] 用户使用了与 ${target.name} 的回忆给花浇水了！(经验+${expGain})`;
          onUpdate({ ...contact, garden: { ...garden, lastWaterDate: todayStr, level: newExp >= 100 ? garden.level + 1 : garden.level, exp: newExp >= 100 ? 0 : newExp } }, sysMsg); 
          
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
{/* 选人浇水弹窗 */}
        <MemberSelectorModal 
            isOpen={showMemberSelect}
            title="选择一份回忆作为养料"
            contacts={allContacts}
            members={members}
            onClose={() => setShowMemberSelect(false)}
            onSelect={(c) => handleWater(c)}
        />
        
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
// ==================== [RelationshipSpace.tsx] Props 接口更新 ====================
interface RelationshipSpaceProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
  onRelationshipSpaceAction: (contactId: string, msg: string) => void;
  globalSettings: GlobalSettings;
  // ★★★ 新增：必须把保存全局设置的函数传进来，不然群组存不住！★★★
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>; 
  onJumpToMessage?: (contactId: string, timestamp: number) => void;
}

















// ==================== [新增组件] 完美UI弹窗系列 ====================

// 1. 📅 日期选择器 (不用填文字了，选日历！)
const DatePickerModal: React.FC<{ isOpen: boolean; currentDate: string; onClose: () => void; onSave: (date: string) => void; }> = ({ isOpen, currentDate, onClose, onSave }) => {
    const [dateVal, setDateVal] = useState(currentDate);
    useEffect(() => { if(isOpen) setDateVal(currentDate); }, [isOpen, currentDate]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slideUp" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-6">
                    <span className="text-4xl mb-2 block">📅</span>
                    <h3 className="text-lg font-bold text-gray-800">设定纪念日</h3>
                    <p className="text-xs text-gray-400 mt-1">故事开始的那一天</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 flex justify-center">
                    <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} className="bg-transparent text-xl font-bold text-gray-700 outline-none text-center font-mono w-full h-12"/>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm">取消</button>
                    <button onClick={() => { onSave(dateVal); onClose(); }} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-200">确认</button>
                </div>
            </div>
        </div>
    );
};

// 2. 💔 分手确认窗 (红色警戒风格)
const BreakupModal: React.FC<{ isOpen: boolean; name: string; onClose: () => void; onConfirm: () => void; }> = ({ isOpen, name, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn p-6" onClick={onClose}>
            <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl animate-scaleIn border-t-4 border-red-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="text-center relative z-10">
                    <div className="text-5xl mb-4 grayscale">🥀</div>
                    <h3 className="text-xl font-black text-gray-800 mb-2">真的要结束吗？</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">你即将解除与 <strong className="text-red-500">{name}</strong> 的关系。<br/>花园和信件会保留，但关系将退回朋友。</p>
                </div>
                <div className="flex flex-col gap-3 relative z-10">
                    <button onClick={onConfirm} className="w-full py-3 bg-white border-2 border-red-100 text-red-500 rounded-xl font-bold text-sm">是的，解除关系</button>
                    <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg">我反悔了</button>
                </div>
            </div>
        </div>
    );
};

// 3. 💏 候选人列表 (选妃界面：核心逻辑在这里！)
const CandidateSelectionModal: React.FC<{ isOpen: boolean; contacts: Contact[]; onClose: () => void; onSelect: (contact: Contact) => void; }> = ({ isOpen, contacts, onClose, onSelect }) => {
    if (!isOpen) return null;
    const sortedContacts = [...contacts].sort((a, b) => (b.affectionScore || 0) - (a.affectionScore || 0));
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full h-[85vh] sm:h-[80vh] sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-slideUp flex flex-col overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-2 shrink-0 bg-white">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-black text-gray-800">建立关系</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold">✕</button>
                    </div>
                    <p className="text-sm text-gray-500">选择一位好感度达到 60 的对象，<br/>开启属于你们的唯一情侣空间。</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 custom-scrollbar">
                    {sortedContacts.length === 0 ? <div className="text-center text-gray-400 py-10">还没认识新朋友...</div> : sortedContacts.map((c) => {
                        const score = c.affectionScore || 0;
                        const isUnlocked = score >= 60; // 60分门槛
                        const isHighLove = score >= 80; // 80分显示AI主动意愿
                        return (
                            <div key={c.id} onClick={() => isUnlocked && onSelect(c)} className={`relative p-4 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 group ${isUnlocked ? 'border-rose-100 bg-white cursor-pointer hover:border-rose-400 hover:shadow-lg' : 'border-gray-100 bg-gray-50 opacity-60 grayscale cursor-not-allowed'}`}>
                                <div className="relative"><img src={c.avatar} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />{isHighLove && <div className="absolute -bottom-1 -right-1 text-lg animate-bounce">😍</div>}</div>
                                <div className="flex-1"><h4 className="font-bold text-gray-800 text-base flex items-center gap-2">{c.name}{isUnlocked && isHighLove && <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">想邀请你!</span>}</h4><div className="mt-2"><div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1"><span>心动值</span><span className={isUnlocked ? 'text-rose-500' : 'text-gray-400'}>{score}/60</span></div><div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${isUnlocked ? 'bg-gradient-to-r from-rose-400 to-pink-500' : 'bg-gray-400'}`} style={{ width: `${Math.min(100, (score / 60) * 100)}%` }}></div></div></div></div>
                                <div>{isUnlocked ? <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-xl font-bold">➜</div> : <div className="text-[10px] font-bold text-gray-400">未达标</div>}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};










// 4. 💌 密友邀请列表 (新增：邀请普通朋友进入基地)
const FriendInvitationModal: React.FC<{
    isOpen: boolean;
    contacts: Contact[];
    onClose: () => void;
    onInvite: (contact: Contact) => void;
}> = ({ isOpen, contacts, onClose, onInvite }) => {
    if (!isOpen) return null;
    // 筛选规则：不是恋人 且 还没进基地的 (假设 status='CloseFriend' 代表已进基地)
    const candidates = contacts.filter(c => !c.RelationShipUnlocked && c.relationshipStatus !== 'CloseFriend');
{/* ★★★ 新增：显示等待同意的邀请 ★★★ */}
                    {contacts.filter(c => c.invitationStatus === 'inviting').map(c => (
                        <div key={c.id} className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300 flex items-center justify-between opacity-70 mb-2">
                            <div className="flex items-center gap-3">
                                <img src={c.avatar} className="w-10 h-10 rounded-full grayscale" />
                                <div>
                                    <h4 className="font-bold text-gray-600">{c.name}</h4>
                                    <p className="text-[10px] text-orange-500 font-bold">⏳ 等待对方同意中...</p>
                                </div>
                            </div>
                        </div>
                    ))}
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full h-[70vh] sm:h-[60vh] sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-slideUp flex flex-col overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-2 shrink-0 bg-white border-b border-gray-50">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-black text-gray-800">邀请新成员</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold">✕</button>
                    </div>
                    <p className="text-xs text-gray-400">邀请朋友入驻密友基地，一起写信互动。</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {candidates.length === 0 ? (
                        <div className="text-center text-gray-400 py-10 text-xs">
                            暂无由可邀请的人选<br/>(快去创建更多联系人吧)
                        </div>
                    ) : candidates.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-3">
                                <img src={c.avatar} className="w-10 h-10 rounded-full object-cover" />
                                <div>
                                    <div className="font-bold text-sm text-gray-800">{c.name}</div>
                                    <div className="text-[9px] text-gray-400">{c.relationshipStatus || 'Acquaintance'}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => onInvite(c)}
                                className="bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm hover:bg-sky-600 transition"
                            >
                                邀请 +
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};












// 5. 🏠 创建多人空间弹窗 (New!)
const CreateGroupModal: React.FC<{
    isOpen: boolean;
    contacts: Contact[];
    onClose: () => void;
    onCreate: (name: string, selectedIds: string[]) => void;
}> = ({ isOpen, contacts, onClose, onCreate }) => {
    const [groupName, setGroupName] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    if (!isOpen) return null;
    
    // 排除恋人，只显示普通朋友
    const candidates = contacts.filter(c => !c.RelationShipUnlocked);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full h-[80vh] sm:h-[70vh] sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-slideUp flex flex-col overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="p-6 shrink-0 bg-white border-b border-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black text-gray-800">创建密友空间</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold">✕</button>
                    </div>
                    <input 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-sky-300 transition"
                        placeholder="给空间起个名 (如: 快乐星球)"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        autoFocus
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <p className="text-xs text-gray-400 font-bold mb-2 ml-1">选择入住成员 ({selectedIds.length})</p>
                    {candidates.map(c => (
                        <div key={c.id} onClick={() => toggleSelect(c.id)} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition ${selectedIds.includes(c.id) ? 'border-sky-400 bg-sky-50' : 'border-transparent bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <img src={c.avatar} className="w-10 h-10 rounded-full object-cover" />
                                <span className="font-bold text-sm text-gray-700">{c.name}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedIds.includes(c.id) ? 'bg-sky-500 border-sky-500' : 'border-gray-300 bg-white'}`}>
                                {selectedIds.includes(c.id) && <span className="text-white text-xs">✓</span>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-50">
                    <button 
                        disabled={!groupName.trim() || selectedIds.length === 0}
                        onClick={() => onCreate(groupName, selectedIds)}
                        className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition"
                    >
                        立即创建 ✨
                    </button>
                </div>
            </div>
        </div>
    );
};





// 6. 👥 群组成员管理弹窗 (新增：拉人/踢人)
const GroupManageModal: React.FC<{
    isOpen: boolean;
    group: FriendGroup;
    contacts: Contact[];
    onClose: () => void;
    onSave: (groupId: string, newMemberIds: string[]) => void;
}> = ({ isOpen, group, contacts, onClose, onSave }) => {
    // 初始状态：选中当前群里的人
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && group) {
            setSelectedIds(group.members);
        }
    }, [isOpen, group]);

    if (!isOpen || !group) return null;

    // 候选人：所有没确立恋人关系的普通朋友
    const candidates = contacts.filter(c => !c.RelationShipUnlocked);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full h-[80vh] sm:h-[70vh] sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-slideUp flex flex-col overflow-hidden relative z-10" onClick={e => e.stopPropagation()}>
                <div className="p-6 shrink-0 bg-white border-b border-gray-50">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-black text-gray-800">管理成员</h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold">✕</button>
                    </div>
                    <p className="text-xs text-gray-400">当前空间：{group.name}</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {candidates.map(c => {
                        const isSelected = selectedIds.includes(c.id);
                        return (
                            <div key={c.id} onClick={() => toggleSelect(c.id)} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition ${isSelected ? 'border-sky-400 bg-sky-50' : 'border-transparent bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                    <img src={c.avatar} className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <div className="font-bold text-sm text-gray-700">{c.name}</div>
                                        <div className="text-[9px] text-gray-400">{isSelected ? '已入驻' : '未加入'}</div>
                                    </div>
                                </div>
                                {/* 勾选框样式 */}
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${isSelected ? 'bg-sky-500 border-sky-500 scale-110' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-gray-50 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">取消</button>
                    <button 
                        onClick={() => onSave(group.id, selectedIds)}
                        className="flex-1 bg-sky-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition text-xs"
                    >
                        保存更改 ({selectedIds.length}人)
                    </button>
                </div>
            </div>
        </div>
    );
};






// ==================== [RelationshipSpace.tsx] 主组件逻辑重写 ====================
const RelationshipSpace: React.FC<RelationshipSpaceProps> = ({ contacts, setContacts, onClose, onRelationshipSpaceAction, globalSettings, setGlobalSettings, onJumpToMessage }) => {

    // ★★★ 核心修复：直接从全局设置里读取群组，没有就为空数组 ★★★
    const groups = globalSettings.friendGroups || [];

    // 定义一个辅助函数来保存群组，这样刷新也不会丢！
    const updateGroups = (newGroups: FriendGroup[]) => {
        setGlobalSettings(prev => ({ ...prev, friendGroups: newGroups }));
    };
    
    // 当前选中的空间
    const [targetGroup, setTargetGroup] = useState<FriendGroup | null>(null);
    const [showCreateGroup, setShowCreateGroup] = useState(false);

    // 群成员管理状态
    const [showGroupManage, setShowGroupManage] = useState(false);

    // 处理群成员变更
    const handleUpdateGroupMembers = (groupId: string, newMemberIds: string[]) => {
        const newGroups = groups.map(g => {
            if (g.id === groupId) {
                // 找出新增的人，发通知
                const addedIds = newMemberIds.filter(id => !g.members.includes(id));
                addedIds.forEach(id => onRelationshipSpaceAction(id, `[系统通知] 欢迎加入密友空间“${g.name}”！🎉`));
                return { ...g, members: newMemberIds };
            }
            return g;
        });
        updateGroups(newGroups); // 保存！
        
        if (targetGroup && targetGroup.id === groupId) {
            setTargetGroup(prev => prev ? { ...prev, members: newMemberIds } : null);
        }
        setShowGroupManage(false);
        alert("成员名单已更新！");
    };

  const [view, setView] = useState<'landing' | 'list' | 'space'>('landing'); // 默认进列表
 // ★★★ 补充状态：记住当前选中的群组 ★★★
    const [activeGroup, setActiveGroup] = useState<FriendGroup | null>(null);
    // (如果你的代码里是 setActiveContact，请确保它下面有这一行)
  const [targetId, setTargetId] = useState<string | null>(null);
  const [tab, setTab] = useState<'hub' | 'garden'>('hub');
  const [selectedLetter, setSelectedLetter] = useState<LoveLetter | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWriteLetter, setShowWriteLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState({ title: '', content: '' });
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");

  const [showCandidates, setShowCandidates] = useState(false); 
  const [showDatePicker, setShowDatePicker] = useState(false); 
  const [showBreakup, setShowBreakup] = useState(false);       
  const [showFriendInvite, setShowFriendInvite] = useState(false); 

  // ★★★ 核心：已删除那个自动跳转的 useEffect，现在一点进来就是列表！ ★★★

    // 处理邀请密友入驻 (群组邀请)
    const handleInviteFriend = (contact: Contact) => {
        // 这里只是简单的标记，真正的群组邀请在 CreateGroupModal 里
        setShowFriendInvite(false);
    };









// 这是一组代码：修改后的邀请逻辑 (只设置状态，不直接建成)
    const handleInvite = (contact: Contact) => {
        // 1. 发系统消息给AI (ChatApp 会监听并处理回复)
        onRelationshipSpaceAction(contact.id, `[系统通知] 用户邀请你加入【密友基地】。✨\n请回复“同意”或“拒绝”。`);
        
        // 2. 仅更新状态为“inviting (邀请中)”
        setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, invitationStatus: 'inviting' } : c));
        
        alert(`已向 ${contact.name} 发送邀请！\n请去聊天窗口等待 TA 的回复...`);
        setView('list'); 
    };










// 这是一组代码：修复后的 handleSendLetter (只存数据，不发通知，防止双重提示)
    const handleSendLetter = (targetId: string, title: string, content: string) => {
        const newLetter: LoveLetter = {
            id: Date.now().toString(),
            title, content, timestamp: Date.now(), isOpened: false, from: 'user', to: targetId
        };

        // 兼容群组和单人模式
        const currentGroup = typeof activeGroup !== 'undefined' ? activeGroup : (typeof targetGroup !== 'undefined' ? targetGroup : null);
        const currentContact = typeof activeContact !== 'undefined' ? activeContact : (typeof targetContact !== 'undefined' ? targetContact : null);

        if (currentGroup) {
            // --- 情况 A: 群组信件 ---
            const updatedGroup = { ...currentGroup, letters: [...currentGroup.letters, newLetter] };
            setGlobalSettings(prev => ({
                ...prev,
                friendGroups: prev.friendGroups?.map(g => g.id === currentGroup.id ? updatedGroup : g)
            }));
        } else if (currentContact) {
            // --- 情况 B: 单人信件 ---
            setContacts(prev => prev.map(c => c.id === currentContact.id ? { ...c, letters: [...(c.letters || []), newLetter] } : c));
        }
        
        // ★★★ 注意：这里删除了 onRelationshipSpaceAction，防止出现黄色的旧提示！ ★★★
    };











    // 处理解除关系
    const handleBreakUp = () => {
        if (!targetContact) return;
        const timestamp = Date.now();
        setContacts(prev => prev.map(c => {
            if (c.id === targetContact.id) {
                return {
                    ...c,
                    RelationShipUnlocked: false,
                    relationshipStatus: 'Friend',
                    invitationStatus: 'none', // 重置邀请状态
                    history: [...c.history, { id: `sys_${timestamp}`, role: 'system', content: '【系统通知】用户解除了关系。🥀', timestamp: timestamp, type: 'text' }]
                };
            }
            return c;
        }));
        onRelationshipSpaceAction(targetContact.id, `[系统通知] 用户决定结束这段关系。`);
        setShowBreakup(false); setShowSettings(false); setView('landing'); setTargetId(null);
    };

    // 处理日期修改
    const handleSaveAnniversary = (dateStr: string) => {
        if (!targetContact) return;
        const newTime = new Date(dateStr).getTime();
        setContacts(prev => prev.map(c => c.id === targetContact.id ? { ...c, created: newTime } : c));
    };

    // 拍立得照片上传处理
    const handlePolaroidUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        if (!e.target.files || !e.target.files[0] || !targetContact) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setContacts(prev => prev.map(c => {
                if (c.id === targetContact.id) {
                    const currentPhotos = c.couplePhotos || [null, null, null]; 
                    currentPhotos[index] = base64;
                    return { ...c, couplePhotos: currentPhotos };
                }
                return c;
            }));
        };
        reader.readAsDataURL(file);
    };

  const currentRelationship = contacts.find(c => c.RelationShipUnlocked);
  const targetContact = contacts.find(c => c.id === targetId);

  const getUnreadCount = (c: Contact) => (c.letters || []).filter(l => !l.isOpened && l.from === 'ai').length;
  const RelationshipUnread = currentRelationship ? getUnreadCount(currentRelationship) : 0;
  
  // 处理跳转逻辑
  const handleJump = (timestamp: number) => {
      onClose();
      if (onJumpToMessage && targetContact) {
          onJumpToMessage(targetContact.id, timestamp);
      }
  };
















// ==================== [RelationshipSpace.tsx] Landing (列表视图) 重写 ====================
    if (view === 'landing') {
        return (
            <div className="h-full w-full bg-slate-50 flex flex-col pt-[calc(env(safe-area-inset-top)+20px)]">
                {/* 顶部标题栏 */}
                <div className="px-6 flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">关系空间</h2>
                        <p className="text-xs text-slate-400">Relationship & Groups</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-white rounded-full text-gray-500 shadow-sm flex items-center justify-center">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-8 custom-scrollbar">
                    
                    {/* --- 区域 1: 唯一情侣空间 --- */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">💞 唯一挚爱</h3>
                            {!currentRelationship && (
                                <button 
                                    onClick={() => setShowCandidates(true)}
                                    className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1 rounded-full font-bold"
                                >
                                    + 邀请入住
                                </button>
                            )}
                        </div>

                        {currentRelationship ? (
                            <div 
                                onClick={() => { setTargetId(currentRelationship.id); setView('space'); }}
                                className="bg-gradient-to-br from-rose-400 to-pink-600 rounded-3xl p-6 shadow-xl shadow-rose-200 text-white relative overflow-hidden cursor-pointer active:scale-95 transition-transform"
                            >
                                <div className="absolute -right-4 -bottom-4 text-8xl opacity-20">❤</div>
                                <div className="flex items-center gap-3 mb-4">
                                    <img src={currentRelationship.avatar} className="w-12 h-12 rounded-full border-2 border-white/50" />
                                    <div>
                                        <h4 className="font-bold text-lg">{currentRelationship.name}</h4>
                                        <p className="text-[10px] opacity-80">Connected for {Math.floor((Date.now() - (currentRelationship.created||0)) / 86400000)} Days</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-white/20 pt-3">
                                    <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">进入空间 ➜</span>
                                    {RelationshipUnread > 0 && <span className="bg-white text-rose-500 text-[10px] font-bold px-2 py-1 rounded-full animate-bounce">{RelationshipUnread} 封信</span>}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-100 rounded-3xl p-6 text-center border-2 border-dashed border-gray-200">
                                <span className="text-3xl grayscale opacity-50 block mb-2">🌹</span>
                                <p className="text-xs text-gray-400">还没有确立关系的情侣...</p>
                            </div>
                        )}
                    </div>

                    {/* --- 区域 2: 密友群组列表 --- */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">✨ 密友基地</h3>
                            <button 
                                onClick={() => setShowCreateGroup(true)}
                                className="text-[10px] bg-blue-50 text-blue-500 px-3 py-1 rounded-full font-bold"
                            >
                                + 新建圈子
                            </button>
                        </div>

                        {groups.length === 0 ? (
                            <div className="text-center text-gray-400 py-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-xs">还没有创建任何圈子</p>
                            </div>
                        ) : (
                            groups.map(g => (
                                <div 
                                    key={g.id}
                                    onClick={() => { setTargetGroup(g); setView('space'); }}
                                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:border-blue-200 transition active:scale-95"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">🏡</div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">{g.name}</h4>
                                            <p className="text-[10px] text-gray-400">{g.members.length} 位成员</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-300">›</span>
                                </div>
                            ))
                        )}
                    </div>

                </div>

                {/* 弹窗挂载 */}
                <CandidateSelectionModal 
                    isOpen={showCandidates} 
                    contacts={contacts} 
                    onClose={() => setShowCandidates(false)} 
                    // ★★★ 这里改成了发送邀请，而不是直接确定关系 ★★★
                    onSelect={(c) => handleSendInvite(c, 'lover')} 
                />

                <CreateGroupModal 
                    isOpen={showCreateGroup}
                    contacts={contacts}
                    onClose={() => setShowCreateGroup(false)}
                    onCreate={(name, ids) => {
                        const newGroup: FriendGroup = {
                            id: `group_${Date.now()}`,
                            name,
                            members: ids,
                            letters: [],
                            questions: [],
                            garden: { seed: 'sunflower', level: 1, exp: 0 },
                            created: Date.now()
                        };
                        // ★★★ 使用 updateGroups 保存到全局 ★★★
                        updateGroups([...groups, newGroup]);
                        setShowCreateGroup(false);
                        
                        // 通知成员
                        ids.forEach(id => onRelationshipSpaceAction(id, `[系统通知] 我把你拉进了新的密友空间“${name}”！`));
                        alert("空间创建成功！🎉");
                    }}
                />
            </div>
        );
    }




    








// ==================== 视图 2: List (密友基地 - 空间大厅版) ====================
    if (view === 'list') {
        return (
            <div className="h-full w-full bg-slate-50 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
                <SafeAreaHeader 
                    title="密友基地" 
                    left={<button onClick={() => setView('landing')} className="text-blue-500 font-bold px-2">← 返回</button>} 
                    // 右上角改成：创建新空间
                    right={<button onClick={() => setShowCreateGroup(true)} className="text-blue-500 font-bold px-2 text-xl">+</button>}
                />
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                    {/* 顶部说明 */}
                    <div className="bg-gradient-to-r from-sky-100 to-blue-50 p-5 rounded-2xl shadow-sm border border-sky-100 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 text-6xl opacity-10">🏙️</div>
                        <h4 className="text-base font-black text-sky-800">我的共享空间</h4>
                        <p className="text-xs text-sky-600 mt-1 leading-relaxed opacity-80">
                            这里是一个个独立的小天地。<br/>邀请朋友入住，共享同一片花园和信箱。
                        </p>
                    </div>

                    {/* 空间列表 */}
                    {groups.length === 0 ? (
                        <div className="text-center text-gray-400 py-10">
                            <span className="text-4xl mb-2 block grayscale opacity-50">🏕️</span>
                            <p className="text-xs">还没有创建任何空间...</p>
                            <button onClick={() => setShowCreateGroup(true)} className="mt-4 text-sky-500 font-bold text-xs bg-white px-4 py-2 rounded-full shadow-sm">
                                + 创建第一个空间
                            </button>
                        </div>
                    ) : (
                        groups.map(g => {
                            // 获取这个空间里的成员头像
                            const memberAvatars = g.members.map(mid => contacts.find(c => c.id === mid)?.avatar).filter(Boolean);
                            const memberNames = g.members.map(mid => contacts.find(c => c.id === mid)?.name).join(', ');

                            return (
                                <div 
                                    key={g.id} 
                                    onClick={() => { setTargetGroup(g); setView('space'); }} // 点击进入空间模式
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition active:scale-98 relative group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                                {g.name}
                                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-normal">
                                                    {g.members.length}人
                                                </span>
                                            </h4>
                                            <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px]">成员: {memberNames || '等待入住...'}</p>
                                        </div>
                                        <div className="text-2xl opacity-80 group-hover:scale-110 transition">🏡</div>
                                    </div>

                                    {/* 头像堆叠 */}
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex -space-x-2 overflow-hidden py-1">
                                            {memberAvatars.length > 0 ? memberAvatars.slice(0, 5).map((src, i) => (
                                                <img key={i} src={src} className="w-8 h-8 rounded-full border-2 border-white object-cover bg-gray-100" />
                                            )) : (
                                                <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400">?</div>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-sky-500 bg-sky-50 px-3 py-1.5 rounded-full">进入 ➜</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 挂载创建弹窗 */}
                <CreateGroupModal 
                    isOpen={showCreateGroup}
                    contacts={contacts}
                    onClose={() => setShowCreateGroup(false)}
                    onCreate={(name, ids) => {
                        const newGroup: FriendGroup = {
                            id: `group_${Date.now()}`,
                            name,
                            members: ids,
                            letters: [],
                            questions: [],
                            garden: { seed: 'sunflower', level: 1, exp: 0 },
                            created: Date.now()
                        };
                        setGroups([...groups, newGroup]);
                        setShowCreateGroup(false);
                        // 通知副AI
                        const memberNames = ids.map(id => contacts.find(c => c.id === id)?.name).join('、');
                        ids.forEach(id => onRelationshipSpaceAction(id, `[系统通知] 我把你拉进了新的密友空间“${name}”！`));
                        alert("空间创建成功！🎉");
                    }}
                />
            </div>
        );
    }

















   // ==================== 视图 3: Space (智能适配：恋人/多人空间) ====================
    // 判断逻辑：如果有 targetGroup，就是多人空间；如果有 targetContact，就是恋人空间
    const isGroupMode = !!targetGroup;
    const activeData = isGroupMode ? targetGroup : targetContact;

    if (view === 'space' && activeData) {
        // --- 模式判定 ---
        const isRelationship = !isGroupMode && (targetContact?.RelationShipUnlocked || targetContact?.relationshipStatus === 'Honeymoon');
        
        // --- 主题配置 ---
        const theme = getTheme(isRelationship ? 'Honeymoon' : 'Friend'); // 朋友空间用蓝色主题
        
        // --- 数据源适配 (关键！) ---
        // 如果是群组，从 group 对象读数据；如果是恋人，从 contact 对象读数据
        const letters = isGroupMode ? (targetGroup!.letters || []) : (targetContact!.letters || []);
        const questions = isGroupMode ? (targetGroup!.questions || []) : (targetContact!.questions || []);
        // 群组暂无 Days，或者显示成立天数
        const days = isGroupMode 
            ? Math.floor((Date.now() - targetGroup!.created) / 86400000) + 1 
            : Math.floor((Date.now() - (targetContact!.created || Date.now())) / 86400000) + 1;

        // ... (信件详情 return 保持不变，可以直接复用) ...
        if (selectedLetter) { /* ... 原有信件详情代码 ... */ }

        return (
            <div className={`h-full w-full ${theme.bg} flex flex-col overflow-hidden relative`} style={theme.style}>
                {isRelationship && <FloatingHearts />}

                <SafeAreaHeader 
                    // 标题动态化：群名 / 恋人名
                    title={
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-gray-800">{isGroupMode ? targetGroup!.name : targetContact!.name}</span>
                            {isGroupMode && <span className="text-[9px] text-gray-400">共有 {targetGroup!.members.length} 位成员</span>}
                        </div>
                    }
                    left={<button onClick={() => { setView(isGroupMode ? 'list' : 'landing'); setTargetGroup(null); }} className={`text-xl ${theme.primary} pl-2 relative z-20`}>✕</button>}
                    // 只有恋人模式才显示那个复杂的设置菜单，群组模式暂时隐藏或简化
                   // 右侧菜单：现在群组模式也支持了！
              // 这是一组代码：修复设置菜单的层级，确保按钮可以点击
                    right={
                        <div className="relative z-[100]">
                            <button onClick={() => setShowSettings(!showSettings)} className={`text-xl ${theme.primary} pr-2 transition-transform ${showSettings ? 'rotate-90' : ''}`}>⚙️</button>
                            
                            {showSettings && (
                                <div className="absolute right-0 top-8 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 w-40 z-[999] animate-scaleIn origin-top-right pointer-events-auto">
                                    
                                    {/* === 情况A：恋人模式 === */}
                                    {!isGroupMode && (
                                        <>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setShowDatePicker(true); setShowSettings(false); }} 
                                                className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                                            >
                                                <span>📅</span> 修改纪念日
                                            </button>
                                            <div className="h-px bg-gray-100 my-1"></div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setShowBreakup(true); setShowSettings(false); }} 
                                                className="w-full text-left px-3 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                                            >
                                                <span>💔</span> 解除关系
                                            </button>
                                        </>
                                    )}

                                    {/* === 情况B：群组模式 === */}
                                    {isGroupMode && (
                                        <>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setShowGroupManage(true); setShowSettings(false); }} 
                                                className="w-full text-left px-3 py-3 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                                            >
                                                <span>👥</span> 管理成员
                                            </button>
                                            <div className="h-px bg-gray-100 my-1"></div>
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation();
                                                    if(confirm("确定要解散这个空间吗？所有回忆将丢失！")) {
                                                        setGroups(prev => prev.filter(g => g.id !== targetGroup!.id));
                                                        setView('list');
                                                        setTargetGroup(null);
                                                    }
                                                }} 
                                                className="w-full text-left px-3 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                                            >
                                                <span>🗑️</span> 解散空间
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    }
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 relative z-10">
                    {tab === 'hub' && (
                        <div className="p-4 space-y-2 animate-fadeIn pt-6">
                            
                            {/* ==================== 🅰️ 恋人模式 (原样保留) ==================== */}
                            {isRelationship && !isGroupMode && (
                                <>
                                    <HeartbeatTouch contact={targetContact!} days={days} />
                                    {/* ... 拍立得、清单等 ... */}
                                    <PolaroidWall photos={(targetContact as any).couplePhotos || [null,null,null]} onUpload={handlePolaroidUpload} />
                                    <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white/50 flex justify-between items-center mb-6 mx-2">
                                        <div className="flex flex-col"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Love For</span><div className="flex items-baseline gap-1"><span className="text-3xl font-black text-rose-500">{days}</span><span className="text-xs font-bold text-rose-300">Days</span></div></div>
                                        <div className="text-3xl animate-pulse">💞</div>
                                    </div>
                            {/* 修复后的调用代码：加上了暗号 [CoupleSystem] */}
                                    <CoupleBucketList 
                                        contact={targetContact!} theme={theme}
                                        onUpdate={(items) => setContacts(prev => prev.map(c => c.id === targetContact!.id ? { ...c, bucketList: items } : c))}
                                        // ★★★ 重点：加上 [CoupleSystem] 前缀 ★★★
                                        onShare={(item) => onRelationshipSpaceAction(targetContact!.id, `[CoupleSystem] 我们在恋爱清单里更新了愿望：${item.title} \n(我的想法: ${item.userContent})`)}
                                    />
                                </>
                            )}

                            {/* ==================== 🅱️ 多人空间模式 (新布局) ==================== */}
                            {isGroupMode && (
                                <div className="text-center mb-8 mt-2">
                                    {/* 群组头像堆叠 */}
                                    <div className="flex justify-center -space-x-4 mb-4">
                                        {targetGroup!.members.map(mid => {
                                            const m = contacts.find(c => c.id === mid);
                                            return m ? <img key={mid} src={m.avatar} className="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover" /> : null;
                                        })}
                                    </div>
                                    <h2 className="text-xl font-black text-gray-800">{targetGroup!.name}</h2>
                                    <div className="inline-flex items-center gap-2 bg-white/60 px-3 py-1 rounded-full mt-2 border border-sky-100 shadow-sm">
                                        <span className="text-[10px] text-sky-500 font-bold uppercase">Created For</span>
                                        <span className="text-sm font-black text-sky-600">{days} Days</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-4 px-8">
                                        这是一个共享空间。<br/>这里的花朵、信件和提问，所有成员都可见。
                                    </p>
                                </div>
                            )}

                            {/* ==================== 🟢 公共功能 (数据源已适配) ==================== */}
                            
{/* 更新后的信箱调用 (修复文案：显示“我寄出了”) */}
{/* 更新后的信箱调用 (传入用户头像 + 完美回信通知) */}
                    <MailboxSection 
                        letters={letters}
                        contacts={contacts}
                        members={isGroupMode ? targetGroup!.members : [targetContact!.id]}
                        isGroup={isGroupMode}
                        
                        // ★★★ 核心新增：传入用户真实数据 ★★★
                        userAvatar={globalSettings.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User"}
                        userName={globalSettings.userName || "我"}

                        // ★★★ 核心修复：接收 isReply 参数 ★★★
                        onSend={(targetId, title, content, isReply) => {
                            const systemPrefix = isGroupMode ? '[FriendSystem]' : '[CoupleSystem]';
                            
                            // 1. 保存数据
                            handleSendLetter(targetId, title, content); 

                            // 2. 根据 isReply 决定文案
                            let sysMsg = "";
                            if (isReply) {
                                // 回信：强制触发
                                sysMsg = `${systemPrefix} 【收到回信提醒】\n用户回复了你的信件《${title}》。\n\n${content}`; 
                            } else {
                                // 新信
                                sysMsg = `${systemPrefix} 【收到新信提醒】\n用户给你写了一封新信：《${title}》\n内容：${content}`;
                            }

                            // 3. 发送给 ChatApp
                            onRelationshipSpaceAction(targetId, sysMsg);
                        }}

                        onMarkAsRead={(letterId) => {
                            if (isGroupMode) {
                                setGlobalSettings(prev => ({ ...prev, friendGroups: prev.friendGroups?.map(g => g.id === targetGroup!.id ? { ...g, letters: g.letters.map(l => l.id === letterId ? { ...l, isOpened: true } : l) } : g) }));
                            } else {
                                setContacts(prev => prev.map(c => c.id === targetContact!.id ? { ...c, letters: (c.letters || []).map(l => l.id === letterId ? { ...l, isOpened: true } : l) } : c));
                            }
                        }}

                        onToggleStar={(letterId) => {
                            if (isGroupMode) {
                                setGlobalSettings(prev => ({ ...prev, friendGroups: prev.friendGroups?.map(g => g.id === targetGroup!.id ? { ...g, letters: g.letters.map(l => l.id === letterId ? { ...l, isFavorite: !l.isFavorite } : l) } : g) }));
                            } else {
                                setContacts(prev => prev.map(c => c.id === targetContact!.id ? { ...c, letters: (c.letters || []).map(l => l.id === letterId ? { ...l, isFavorite: !l.isFavorite } : l) } : c));
                            }
                        }}
                    />





                    

                            {/* 问答 */}
                            <div className="px-2 mt-6">
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                        {isGroupMode ? "📢 大家来回答" : "🧩 灵魂默契度"}
                                    </span>
                                    <button onClick={() => setShowQuestionModal(true)} className="text-[10px] bg-white text-gray-600 px-3 py-1.5 rounded-full font-bold hover:bg-gray-50 transition shadow-sm border border-gray-200">+ 提问</button>
                                </div>
                                <QACardStack 
                                    questions={questions} 
                                    theme={theme} 
                                    onAnswer={(id, ans) => { 
                                        if (isGroupMode) {
                                            // 更新群组数据
                                            setGroups(prev => prev.map(g => g.id === targetGroup!.id ? {
                                                ...g, questions: g.questions.map(q => q.id === id ? { ...q, userAnswer: ans } : q)
                                            } : g));
                                            // 广播给所有成员的副AI
                                            targetGroup!.members.forEach(mid => onRelationshipSpaceAction(mid, `[群空间:${targetGroup!.name}] 用户回答了问题: ${ans}`));
                                        } else {
                                            // 更新恋人数据 (原逻辑)
                                            setContacts(prev => prev.map(c => c.id === targetContact!.id ? { ...c, questions: (c.questions||[]).map(q => q.id === id ? {...q, userAnswer: ans} : q) } : c));
                                            onRelationshipSpaceAction(targetContact!.id, `[关系空间] 回答: ${ans}`);
                                        }
                                        alert("回答已存档！"); 
                                    }} 
                                />
                            </div>
                        </div>
                    )}

{/* 花园 Tab (修复：使用新名字 GardenSection) */}
                    {tab === 'garden' && (
                        <div className="h-full flex flex-col">
                            <GardenSection 
                                groupOrContact={isGroupMode ? targetGroup : targetContact}
                                contacts={contacts}
                                onUpdate={(updatedC, sysMsg) => {
                                    if (isGroupMode) {
                                        // 更新群组
                                        const newGroups = (globalSettings.friendGroups || []).map(g => g.id === targetGroup!.id ? updatedC : g);
                                        setGlobalSettings(prev => ({ ...prev, friendGroups: newGroups }));
                                    } else {
                                        // 更新单人
                                        setContacts(prev => prev.map(old => old.id === updatedC.id ? updatedC : old));
                                    }
                                    // 发通知
                                    if(sysMsg) {
                                        const targets = isGroupMode ? targetGroup!.members : [targetContact!.id];
                                        targets.forEach(mid => onRelationshipSpaceAction(mid, sysMsg));
                                    }
                                }}
                                isGroup={isGroupMode}
                            />
                        </div>
                    )}



                </div>

                {/* 底部 Tab 切换 (保持不变) */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-full px-2 py-1.5 shadow-2xl flex gap-1 pointer-events-auto">
                        <button onClick={() => setTab('hub')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${tab === 'hub' ? `${theme.accent} text-white shadow-md` : 'text-gray-400 hover:bg-gray-100'}`}>🏠 空间</button>
                        <button onClick={() => setTab('garden')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${tab === 'garden' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}>🌸 花园</button>
                    </div>
                </div>
                
                {/* 弹窗挂载 (写信/提问弹窗逻辑也需要适配群组，这里简化略过，核心是 onConfirm 里的逻辑要分流) */}
                {/* ... (请确保 WriteLetter 和 QuestionModal 的保存逻辑里，也加了 if (isGroupMode) 的判断，类似上面的 QACardStack) ... */}
            </div>
        );
    } 












  return <div className="h-full flex items-center justify-center text-gray-400">Loading...</div>;
};

export default RelationshipSpace;