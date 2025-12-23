// --- 这是全新的、多页面沉浸式情侣空间组件 ---
import React, { useState, useEffect } from 'react';
import { Contact, DiaryEntry, QAEntry, LoveLetter, Message } from '../types';
import SafeAreaHeader from './SafeAreaHeader';

// ★ 新增：一个回调函数类型，用于通知ChatApp发生了什么
type CoupleSpaceActionCallback = (systemMessage: string) => void;

interface CoupleSpaceProps {
  profile: Contact;
  onClose: () => void;
  onUnlock: (contactId: string) => void;
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  // ★ 新增：接收这个回调函数
  onCoupleSpaceAction: CoupleSpaceActionCallback; 
}

const CoupleSpace: React.FC<CoupleSpaceProps> = ({ profile, onClose, onUnlock, setContacts, onCoupleSpaceAction }) => {
  // --- 核心状态：当前在哪个“房间” ---
  const [currentPage, setCurrentPage] = useState<'hub' | 'diary' | 'qa' | 'letters' | 'album'>('hub');
  const [qaTempAnswers, setQaTempAnswers] = useState<{ [qaId: string]: string }>({});

  // --- 渲染主页 (Hub) ---
  const renderHub = () => (
    <div className="p-6 pt-12 space-y-6 animate-fadeIn">
      <div className="text-center">
        <img src={profile.avatar} className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white shadow-lg" alt="avatar" />
        <h2 className="text-2xl font-bold text-gray-800">我们的空间</h2>
        <p className="text-sm text-gray-500">和 {profile.name} 在一起的第 {Math.floor((Date.now() - (profile.created || Date.now())) / 86400000) + 1} 天</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* 日记本入口 */}
        <div onClick={() => setCurrentPage('diary')} className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square cursor-pointer hover:shadow-lg hover:scale-105 transition-all">
          <span className="text-5xl">📖</span>
          <h3 className="font-bold mt-2 text-yellow-800">心情日记</h3>
        </div>
        
        {/* 问答信箱入口 */}
        <div onClick={() => setCurrentPage('qa')} className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square cursor-pointer hover:shadow-lg hover:scale-105 transition-all">
          <span className="text-5xl">❓</span>
          <h3 className="font-bold mt-2 text-blue-800">问答信箱</h3>
        </div>

        {/* 告白信入口 */}
        <div onClick={() => setCurrentPage('letters')} className="bg-pink-50 border-2 border-pink-200 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square cursor-pointer hover:shadow-lg hover:scale-105 transition-all">
          <span className="text-5xl">💌</span>
          <h3 className="font-bold mt-2 text-pink-800">告白信件</h3>
        </div>
        
        {/* 回忆相册入口 */}
        <div onClick={() => setCurrentPage('album')} className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square cursor-pointer hover:shadow-lg hover:scale-105 transition-all">
          <span className="text-5xl">🖼️</span>
          <h3 className="font-bold mt-2 text-purple-800">回忆相册</h3>
        </div>
      </div>
    </div>
  );

  // --- 渲染日记本页面 ---
  const renderDiary = () => (
    <div className="p-4 space-y-4 animate-fadeIn">
      {(profile.diaries || []).length === 0 ? (
        <div className="text-center py-20 text-gray-400">还没写过日记呢...</div>
      ) : (
        [...(profile.diaries || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(diary => (
          <div key={diary.id} className="bg-white p-5 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-600">{diary.date}</span>
              <span className="text-lg">{diary.weather} {diary.moodEmoji}</span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap font-serif">{diary.content}</p>
          </div>
        ))
      )}
    </div>
  );

  // --- 渲染问答卡片箱页面 ---
  const renderQACards = () => {
    const questions = [...(profile.questions || [])].sort((a,b) => b.timestamp - a.timestamp);
    return (
      <div className="p-4 h-full flex flex-col animate-fadeIn">
        <div className="flex-1 overflow-y-auto space-y-4">
          {questions.length === 0 ? (
             <div className="text-center py-20 text-gray-400">还没有提问过...</div>
          ) : (
            questions.map(qa => (
              <div key={qa.id} className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 space-y-3">
                <p className="font-bold text-gray-800">"{qa.question}"</p>
                {qa.userAnswer ? (
                  <div>
                    <p className="text-xs text-blue-500 font-bold mb-1">你的回答:</p>
                    <p className="text-sm italic bg-blue-50 p-3 rounded-lg text-blue-800">"{qa.userAnswer}"</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-end">
                    <textarea
                      placeholder="写下你的回答..."
                      value={qaTempAnswers[qa.id] || ''}
                      onChange={e => setQaTempAnswers(prev => ({ ...prev, [qa.id]: e.target.value }))}
                      className="w-full text-sm p-3 rounded-lg border focus:ring-2 focus:ring-blue-200 outline-none"
                      rows={3}
                    />
                    <button
                      onClick={() => {
                        const answer = qaTempAnswers[qa.id]?.trim();
                        if (!answer) return alert("回答不能为空！");
                        // 1. 更新数据
                        setContacts(prev => prev.map(c => 
                          c.id === profile.id ? { ...c, questions: (c.questions || []).map(q => q.id === qa.id ? {...q, userAnswer: answer} : q) } : c
                        ));
                        // 2. ★ 发送系统消息回传给聊天窗口！
                        onCoupleSpaceAction(`[情侣空间] 我回答了问题“${qa.question}”，我的答案是：“${answer}”`);
                        alert("回答已保存！AI稍后可能会在聊天里提到哦~");
                      }}
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs"
                    >
                      确认回答
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  
  // --- 渲染信箱页面 ---
  const renderMailbox = () => {
     const letters = [...(profile.letters || [])].sort((a,b) => b.timestamp - a.timestamp);
     return (
       <div className="p-4 space-y-3 animate-fadeIn">
          {letters.length === 0 ? (
             <div className="text-center py-20 text-gray-400">信箱是空的...</div>
          ) : (
            letters.map(letter => (
              <div key={letter.id} 
                onClick={() => {
                  if (!letter.isOpened) {
                    setContacts(prev => prev.map(c => c.id === profile.id ? {...c, letters: (c.letters || []).map(l => l.id === letter.id ? {...l, isOpened: true} : l) } : c));
                  }
                }}
                className={`p-4 rounded-lg shadow-md border flex items-start gap-4 cursor-pointer transition-all ${letter.isOpened ? 'bg-white' : 'bg-pink-100 animate-pulse'}`}>
                  <div className="text-3xl mt-1">{letter.isOpened ? '💌' : '✉️'}</div>
                  <div className="flex-1">
                      <h4 className="font-bold text-gray-800">{letter.title}</h4>
                      {letter.isOpened ? (
                        <p className="text-sm text-gray-600 mt-1">{letter.content}</p>
                      ) : (
                        <p className="text-sm text-pink-700 font-bold mt-1">点击拆开信件...</p>
                      )}
                      <p className="text-xs text-gray-400 text-right mt-2">{new Date(letter.timestamp).toLocaleDateString()}</p>
                  </div>
              </div>
            ))
          )}
       </div>
     );
  };

  // --- 渲染相册页面 ---
  const renderAlbum = () => {
    const images = (profile.history || []).filter(msg => msg.type === 'image' || (msg.content && msg.content.startsWith('data:image')));
    return (
      <div className="p-4 animate-fadeIn">
        {images.length === 0 ? (
          <div className="text-center py-20 text-gray-400">相册里还没有照片...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {images.map(img => (
              <div key={img.id} className="rounded-lg overflow-hidden shadow-md">
                <img src={img.content} className="w-full h-full object-cover aspect-square" alt="memory"/>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  };

  // --- 根据当前页面状态，决定渲染哪个页面 ---
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'hub': return renderHub();
      case 'diary': return renderDiary();
      case 'qa': return renderQACards();
      case 'letters': return renderMailbox();
      case 'album': return renderAlbum();
      default: return renderHub();
    }
  };

  // --- 未解锁视图 (保持不变) ---
  if (!profile.coupleSpaceUnlocked) {
    return (
      <div className="h-full w-full bg-pink-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
        <div className="text-6xl mb-4 drop-shadow-lg">🔒</div>
        <h2 className="text-2xl font-bold text-pink-600 mb-2">情侣空间</h2>
        <p className="text-gray-500 mb-8 max-w-xs text-sm leading-relaxed">
          这是属于你们两个人的私密领地。在这里，{profile.name} 会记录关于你的点点滴滴。
        </p>
        <button
          onClick={() => onUnlock(profile.id)}
          className="bg-pink-500 hover:bg-pink-600 text-white px-10 py-4 rounded-full shadow-xl"
        >
          💌 向 {profile.name} 发送空间邀请
        </button>
        <button onClick={onClose} className="mt-6 text-gray-400 text-xs underline">
          返回桌面
        </button>
      </div>
    );
  }

  // --- 已解锁主视图 ---
  return (
    <div className="h-full w-full bg-gray-50 flex flex-col overflow-hidden">
      <SafeAreaHeader
        title={
          <span className="font-bold text-white">
            {currentPage === 'hub' ? '我们的空间' : 
             currentPage === 'diary' ? '心情日记' :
             currentPage === 'qa' ? '问答信箱' :
             currentPage === 'letters' ? '告白信件' : '回忆相册'}
          </span>
        }
        left={
          currentPage === 'hub' ? 
          <button onClick={onClose} className="text-white text-2xl">←</button> :
          <button onClick={() => setCurrentPage('hub')} className="text-white text-sm">返回空间</button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {renderCurrentPage()}
      </div>
    </div>
  );
};

export default CoupleSpace;