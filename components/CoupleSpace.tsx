import React, { useState, useEffect } from 'react';
import { DiaryEntry, QAEntry, LoveLetter, Contact } from '../types'; 
import { generateDailyDiary, generateDailyQuestion } from '../services/geminiService';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）

interface CoupleSpaceProps {
  // 注意：App.tsx 传进来的是经过防御处理的 safeProfile，本质是 Contact 类型
  profile: any; 
  chatMemorySummary: string; 
  onClose: () => void;
  onUnlock: () => void;
}

const CoupleSpace: React.FC<CoupleSpaceProps> = ({ profile, chatMemorySummary, onClose, onUnlock }) => {
  const [activeTab, setActiveTab] = useState<'diary' | 'qa' | 'letters'>('diary');
  const [diaries, setDiaries] = useState<DiaryEntry[]>(profile.diaries || []);
  const [questions, setQuestions] = useState<QAEntry[]>(profile.questions || []);
  const [letters, setLetters] = useState<LoveLetter[]>(profile.letters || []);
  const [loading, setLoading] = useState(false);

  // 初始化检查
  useEffect(() => {
    if (!diaries || diaries.length === 0) {
      generateDailyContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. 未解锁状态的视图
  if (!profile.coupleSpaceUnlocked) {
    return (
      <div className="h-full w-full bg-pink-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
        <div className="text-6xl mb-4 drop-shadow-lg">🔒</div>
        <h2 className="text-2xl font-bold text-pink-600 mb-2">情侣空间</h2>
        <p className="text-gray-500 mb-8 max-w-xs text-sm leading-relaxed">
          这是属于你们两个人的私密领地。在这里，{profile.name} 会记录关于你的点点滴滴。
        </p>
        <button
          onClick={onUnlock}
          className="bg-pink-500 hover:bg-pink-600 text-white px-10 py-4 rounded-full shadow-xl transform transition active:scale-95 font-bold tracking-wide"
        >
          💌 向 {profile.name} 发送空间邀请
        </button>
        <button onClick={onClose} className="mt-6 text-gray-400 text-xs underline hover:text-pink-400 transition">
          返回桌面
        </button>
      </div>
    );
  }

  // 2. 生成每日内容逻辑
  // 在 CoupleSpace.tsx 里替换原来的 generateDailyContent

  const generateDailyContent = async () => {
    if (loading) return;
    setLoading(true);

    // ★★★ 暂时屏蔽真实 API，用假数据测试 UI 是否白屏 ★★★
    setTimeout(() => {
      const newDiary: DiaryEntry = {
        id: Date.now().toString(),
        author: 'ai',
        date: new Date().toLocaleDateString(),
        content: "这是测试日记。如果你能看到这条消息，说明你的 UI 没问题，是 Gemini API 报错导致的白屏！", 
        mood: profile.mood?.current || "Testing"
      };
      setDiaries(prev => [newDiary, ...prev]);

      const newQuestion: QAEntry = {
        id: (Date.now() + 1).toString(),
        question: "我们去吃火锅好不好？",
        aiAnswer: "只要和你一起，吃什么都开心！",
        date: new Date().toLocaleDateString()
      };
      setQuestions(prev => [newQuestion, ...prev]);
      
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden animate-slideUp">
      {/* 顶部导航 */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-4 flex justify-between items-center shadow-lg z-20">
        <button onClick={onClose} className="text-2xl font-bold hover:opacity-70 transition">←</button>
        <div className="text-center">
          <h1 className="font-bold text-base">❤️ 我们的秘密空间</h1>
          <p className="text-[10px] opacity-80">已陪伴 {Math.floor((Date.now() - (profile.created || Date.now())) / 86400000) + 1} 天</p>
        </div>
        <button 
          onClick={generateDailyContent} 
          disabled={loading}
          className={`text-xs bg-white/20 px-3 py-1.5 rounded-full backdrop-blur transition active:scale-90 ${loading ? 'animate-pulse' : ''}`}
        >
          {loading ? '撰写中...' : '同步心跳'}
        </button>
      </div>

      {/* 分类切换 */}
      <div className="flex bg-white border-b shadow-sm z-10">
        {(['diary', 'qa', 'letters'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-bold transition-all relative ${
              activeTab === tab ? 'text-pink-600' : 'text-gray-400'
            }`}
          >
            {tab === 'diary' ? '观察日记' : tab === 'qa' ? '每日一问' : '告白信'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-pink-500 rounded-full animate-scaleIn"></div>
            )}
          </button>
        ))}
      </div>

      {/* 内容展示区 */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-pink-50/50 to-white p-4">
        <div className="max-w-md mx-auto space-y-4">
          
          {/* --- Tab 1: 日记列表 --- */}
          {activeTab === 'diary' && (
            <div className="space-y-4 animate-fadeIn">
              {diaries.length === 0 ? (
                <div className="text-center py-20 text-gray-300 text-sm">
                  <div className="text-4xl mb-2">✍️</div>
                  还没开始记录呢，点点“同步心跳”试试
                </div>
              ) : (
                diaries.map(diary => (
                  <div key={diary.id} className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100 hover:shadow-md transition">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <img src={profile.avatar} className="w-6 h-6 rounded-full object-cover" alt="avt" />
                        <span className="text-xs font-bold text-pink-600">{profile.name} 的心情日记</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{diary.date}</span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                      {diary.content}
                    </p>
                    <div className="mt-3 pt-3 border-t border-dashed border-pink-50 flex justify-end">
                      <span className="text-[10px] bg-pink-50 text-pink-400 px-2 py-0.5 rounded-full"># 当前状态: {diary.mood}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* --- Tab 2: Q&A 列表 --- */}
          {activeTab === 'qa' && (
            <div className="space-y-6 animate-fadeIn">
              {questions.length === 0 ? (
                <div className="text-center py-20 text-gray-300 text-sm">暂无提问</div>
              ) : (
                questions.map(qa => (
                  <div key={qa.id} className="space-y-3">
                    <div className="bg-purple-100 text-purple-700 p-4 rounded-2xl rounded-tl-none mr-10 shadow-sm">
                      <p className="text-xs font-bold mb-1">今日问题：</p>
                      <p className="text-sm font-medium">{qa.question}</p>
                    </div>
                    <div className="bg-white border border-purple-100 p-4 rounded-2xl rounded-tr-none ml-10 shadow-sm">
                      <p className="text-xs font-bold text-pink-500 mb-1">{profile.name} 的想法：</p>
                      <p className="text-sm text-gray-600 italic">"{qa.aiAnswer}"</p>
                    </div>
                    <div className="text-center text-[10px] text-gray-300 font-mono">{qa.date}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* --- Tab 3: 信件列表 --- */}
          {activeTab === 'letters' && (
            <div className="space-y-4 animate-fadeIn">
               {letters.length === 0 ? (
                <div className="text-center py-20 text-gray-300 text-sm">
                  <div className="text-4xl mb-2">✉️</div>
                  那些藏在心底的话，还没落笔成信...
                </div>
              ) : (
                letters.map(letter => (
                  <div key={letter.id} className="bg-amber-50 p-6 rounded-sm shadow-inner border-l-4 border-amber-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10 text-6xl -rotate-12">💌</div>
                    <p className="text-sm text-amber-900 leading-loose font-serif italic">
                      {letter.content}
                    </p>
                    <div className="mt-4 text-right">
                      <p className="text-xs font-bold text-amber-700">— 永远爱你的 {profile.name}</p>
                      <p className="text-[9px] text-amber-600/50 mt-1">{letter.date}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
      
      {/* 底部装饰 */}
      <div className="h-2 bg-gradient-to-r from-pink-200 via-purple-200 to-pink-200"></div>
    </div>
  );
};

export default CoupleSpace;