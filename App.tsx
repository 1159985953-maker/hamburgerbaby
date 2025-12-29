// 这是一组代码：【App.tsx】新的 import 区域
import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import ChatApp from './components/ChatApp';
import RelationshipSpace from './components/RelationshipSpace';
import SettingsApp from './components/SettingsApp';
import WorldBookApp from './components/WorldBookApp';
import WallpaperApp from './components/AppearanceApp';
import LifeApp from './components/LifeApp';
import SafeAreaHeader from './components/SafeAreaHeader';
import localforage from 'localforage';
import { Contact, GlobalSettings, WorldBookCategory, Message, EmotionalNeed, TodoItem } from './types';
import { generateResponse } from './services/apiService';
import { readTavernPng, fileToBase64 } from './utils/fileUtils';
import DiaryApp from './components/DiaryApp'; // <--- ➕ 加上这一行！









// ==================== [插入代码 1] 账号名单与高颜值登录组件 ====================
// 1. 在这里改账号密码和【身份牌 role】
const ALLOWED_USERS = [
  // 这是一个普通用户，role 是 'user'
  { id: "1", user: "friend", pass: "123456", name: "好朋友", role: "user" },

  // 这是一个管理员，role 是 'admin'，拥有所有权限
  { id: "0", user: "hannie",  pass: "hanniehanbaobao", name: "hannie", role: "admin" },
  
  // 你可以再加一个 VIP 用户
  { id: "3", user: "vip_user", pass: "vip666", name: "moon", role: "moon" },
];

// 2. 这是你提供的豹纹汉堡图片URL链接
const LOGIN_WALLPAPER = "https://files.catbox.moe/tffb8b.png";

// ==================== [升级版] 汉堡包欢迎系统 (Intro + Login) ====================
// ==================== [终极修复版] 汉堡包欢迎系统 (Intro + Login) ====================
// ==================== [V4.0 走心愿景版] 汉堡包欢迎系统 ====================
const LoginScreen = ({ onLogin }: { onLogin: (u: any) => void }) => {
  const [step, setStep] = useState(0); 
  // 0:欢迎, 1:介绍, 2:核心功能, 3:生活工具, 4:留言, 5:愿景(新), 6:登录
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [time, setTime] = useState(new Date());
  
  const BG_URL = "https://files.catbox.moe/tffb8b.png";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheck = () => {
    const valid = ALLOWED_USERS.find(x => x.user === u && x.pass === p);
    if (valid) {
      onLogin(valid);
    } else {
      setErr("密码不对哦 🚫");
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const slides = [
// --- P1: 欢迎页 (V-CLASSIC: 全屏填充 + 经典汉堡黄) ---
    {
      id: 'welcome',
      content: (
        // ★★★ 布局黑科技：保留了负边距，强制填满卡片边缘，背景光晕不会被切断！ ★★★
        <div className="relative flex flex-col items-center justify-center overflow-hidden -mx-8 -mt-10 -mb-20 w-[calc(100%+4rem)] h-[calc(100%+7.5rem)]">
          
          {/* === 背景装饰层 (漂浮的 Emoji) === */}
          {/* 左上星星 */}
          <div className="absolute top-10 left-6 text-4xl animate-pulse opacity-60 filter blur-[1px]">✨</div>
          {/* 右上薯条 */}
          <div className="absolute top-16 -right-4 text-5xl animate-bounce opacity-40 rotate-12" style={{animationDuration: '3s'}}>🍟</div>
          {/* 左下星球 (换回星球，呼应后面的AI愿景) */}
          <div className="absolute bottom-32 -left-6 text-6xl animate-spin-slow opacity-20" style={{animationDuration: '10s'}}>🪐</div>
          {/* 右下可乐 */}
          <div className="absolute bottom-20 right-4 text-4xl animate-bounce opacity-50 -rotate-12" style={{animationDuration: '4s'}}>🥤</div>
          
          {/* ★★★ 背景光晕：暖橙色 (像刚烤好的面包) ★★★ */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-300/20 rounded-full blur-[60px] pointer-events-none"></div>

          {/* === 主内容层 === */}
          <div className="relative z-10 flex flex-col items-center">
            
            {/* 核心 Logo */}
            <div className="relative mb-6 group cursor-default">
               <div className="text-[80px] leading-none filter drop-shadow-xl transform transition-transform group-hover:scale-110 duration-300">🍔</div>
               {/* 头顶的黄色火花 */}
               <div className="absolute -top-4 -right-4 text-4xl animate-ping opacity-50 text-yellow-400">💥</div>
            </div>

            {/* 欢迎语 */}
            <p className="text-gray-400 font-bold tracking-[0.2em] text-xs uppercase mb-1">
              Welcome to
            </p>

            {/* ★★★ 汉堡色渐变大标题 (橙 -> 黄) ★★★ */}
            <h1 className="text-5xl font-black text-center leading-tight mb-10 drop-shadow-sm">
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500">
                Hamburger
                <br/>
                Phone!
              </span>
            </h1>

            {/* ★★★ 活力橙果冻按钮 ★★★ */}
            <button 
              onClick={() => setStep(1)} 
              className="relative group bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-black px-10 py-4 rounded-full shadow-[0_10px_20px_-5px_rgba(245,158,11,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(245,158,11,0.6)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 flex items-center gap-2 overflow-hidden ring-4 ring-orange-100"
            >
              {/* 按钮流光特效 */}
              <div className="absolute top-0 left-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-500 skew-x-12"></div>
              
              <span className="relative z-10">点击开始旅程</span> 
              <span className="relative z-10 group-hover:translate-x-1 transition-transform">➜</span>
            </button>

          </div>
        </div>
      )
    },
    // --- P2: 介绍页 ---
    {
      id: 'intro',
      content: (
        <div className="flex flex-col h-full animate-fadeIn pt-4">
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">Project Intro</span>
            <h2 className="text-2xl font-black text-gray-800 mt-3">     ¿这是什么?</h2>
          </div>
          <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white shadow-sm flex-1 flex flex-col justify-center gap-4">
            <p className="text-gray-700 leading-relaxed font-medium">
              这是一个由 <b className="text-pink-500 text-lg">hannie</b> 制作的<br/>
              <span className="bg-yellow-200/50 px-1 rounded">仿手机生态 AI 聊天网页</span> 📱
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              在这里，你可以打破次元壁，和自创的 AI 角色自由聊天、一起学习，以及记录生活琐事。
            </p>
          </div>
        </div>
      )
    },
    // --- P3: 功能页 A (核心体验) ---
    {
      id: 'features_core',
      content: (
        <div className="flex flex-col h-full animate-fadeIn pt-2">
          <h2 className="text-2xl font-black text-gray-800 text-center mb-6 flex items-center justify-center gap-2">
            <span>✨</span> 核心玩法
          </h2>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar px-1 pb-2">
            <div className="bg-gradient-to-r from-purple-50 to-white p-4 rounded-2xl shadow-sm border border-purple-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl shadow-inner">🤖</div>
              <div><h3 className="font-bold text-purple-900">AI 深度聊天</h3><p className="text-xs text-purple-400 mt-0.5">导入人设、世界书开启互动</p></div>
            </div>
            <div className="bg-gradient-to-r from-pink-50 to-white p-4 rounded-2xl shadow-sm border border-pink-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-2xl shadow-inner">🧑‍🤝‍🧑</div>
              <div><h3 className="font-bold text-pink-900">关系空间</h3><p className="text-xs text-pink-400 mt-0.5">好感度达标解锁恋爱/密友模式</p></div>
            </div>
            <div className="bg-gradient-to-r from-orange-50 to-white p-4 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl shadow-inner">🎨</div>
              <div><h3 className="font-bold text-orange-900">个性装扮</h3><p className="text-xs text-orange-400 mt-0.5">壁纸、气泡、主题随心换</p></div>
            </div>
          </div>
        </div>
      )
    },
    // --- P4: 功能页 B (生活工具) ---
    {
      id: 'features_tools',
      content: (
        <div className="flex flex-col h-full animate-fadeIn pt-2">
          <h2 className="text-2xl font-black text-gray-800 text-center mb-6 flex items-center justify-center gap-2">
            <span>🛠️</span> 生活工具
          </h2>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar px-1 pb-2">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">📖</div>
              <div><h3 className="font-bold text-gray-800">心情日记</h3><p className="text-xs text-gray-400">记录心情与灵感～</p></div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">💰</div>
              <div><h3 className="font-bold text-gray-800">记账小管家</h3><p className="text-xs text-gray-400">资产管理与收支统计</p></div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">📝</div>
              <div><h3 className="font-bold text-gray-800">ToDo 清单</h3><p className="text-xs text-gray-400">规划行程，不再遗忘</p></div>
            </div>
          </div>
        </div>
      )
    },
    // --- P5: 留言页 (已移除Enjoy the game) ---
    {
      id: 'message',
      content: (
        <div className="flex flex-col h-full animate-fadeIn relative justify-center">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-4xl z-20 text-red-500 drop-shadow-md animate-bounce">📌</div>
          <div className="bg-[#fff9c4] text-gray-800 p-6 pt-10 rounded-sm shadow-xl rotate-1 border border-yellow-200/50 relative overflow-hidden transform transition-transform hover:rotate-0 hover:scale-105 duration-300">
            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
            <h3 className="font-black text-xl mb-4 text-orange-600 border-b-2 border-orange-200 pb-2 inline-block">
              Hannie 的碎碎念
            </h3>
            <div className="space-y-4 text-sm leading-relaxed font-medium">
              <p>一时兴起做了这个项目，花费<b className="text-red-500 text-lg mx-1">两个礼拜</b>和代码决斗做了大概框架！⚔️</p>
              <p><span className="text-green-600 ">过程中向很多老师的作品进行了膜拜及学习，</span>在这里感谢 <span className="bg-black text-white px-2 py-0.5 rounded text-xs">制作小手机的所有老师🙏💚 </span>没有老师们的产出以及本女子25年9-12月深度ai游玩经历就没有此小汉堡。</p>
              <p>现在汉堡包还是 <span className="bg-black text-white px-2 py-0.5 rounded text-xs">1.0 版本</span>，以后<span className="text-purple-600 font-bold">也许(!)</span>会慢慢更新...……………吧😁</p>
            </div>
          </div>
        </div>
      )
    },


// --- P5.5: 隐私安全页 (新增：让用户安心) ---
    {
      id: 'privacy',
      content: (
        <div className="flex flex-col h-full animate-fadeIn pt-4">
          <div className="text-center mb-5">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">Privacy & Security</span>
            <h2 className="text-2xl font-black text-gray-800 mt-3">安心游玩声明</h2>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-7 rounded-3xl border border-white shadow-lg flex-1 flex flex-col justify-center gap-4 relative overflow-hidden">
            
            {/* 背景装饰大锁 */}
            <div className="absolute -right-8 -bottom-8 text-[120px] opacity-[0.05] pointer-events-none rotate-12 grayscale">🔒</div>

            {/* 架构说明 */}
            <div className="flex items-start gap-3">
               <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex-shrink-0 flex items-center justify-center text-xl shadow-md ring-4 ring-emerald-100">🛡️</div>
               <div>
                 <h3 className="font-bold text-gray-800 text-base">纯前端离线架构</h3>
                 <p className="text-xs text-gray-500 leading-relaxed mt-1">
                   这不仅仅是一个网页，更是一个<b className="text-emerald-600">本地保险箱</b>。所有的聊天记录、日记、账单，都只加密存储在你当前的设备里。
                 </p>
               </div>
            </div>

            {/* 重点引用块 (你的原话) */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-2xl border border-emerald-100 relative mt-2">
               <div className="absolute -top-3 left-4 text-emerald-300 text-4xl font-serif">“</div>
               <p className="text-sm font-bold text-emerald-900 leading-relaxed relative z-10 pt-2">
                 你的数据只保存在自己手中，没有任何人能偷看...
              
               </p>
            </div>

            {/* 底部小贴士 */}
            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 mt-2">
               <span>💡</span>
               <span>清空浏览器历史记录会丢失数据，记得善用设置界面的<b>[导出备份]</b>哦！</span>
            </div>
          </div>
        </div>
      )
    },



   // --- P6: 愿景页 (修复：文字改成深色，卡片加厚) ---
    {
      id: 'vision',
      content: (
        <div className="flex flex-col items-center justify-center h-full animate-slideUp text-center px-4">
          {/* 火箭图标 */}
          <div className="text-7xl mb-4 relative">
             🍔
             <div className="absolute top-0 right-0 w-4 h-4 bg-white rounded-full animate-ping opacity-75"></div>
          </div>
          
    
          
          {/* ★★★ 修复重点：背景变白(bg-white/85)，文字变黑(text-gray-xxx) ★★★ */}
          <div className="bg-white/85 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-2xl relative overflow-hidden">
            {/* 装饰光斑 (稍微带点紫，好看) */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-300/30 rounded-full blur-2xl pointer-events-none"></div>
            
            <p className="text-sm font-bold text-gray-600 leading-loose tracking-wide relative z-10">
              大概介绍到此结束，
                 <br/>
            
              即将进入登录页面。
              <br/>
                   🟢🟢🟢🟢🟢🟢
              <br/>
              让我们<span className="font-black text-orange-500 text-lg mx-1">愉快游玩吧！</span>
            </p>
            
            {/* 分割线变深色 */}
            <div className="w-12 h-0.5 bg-gray-300 mx-auto my-5 rounded-full"></div>
            
          
          </div>
        </div>
      )
    },
    // --- P7: 登录页 ---
    {
      id: 'login',
      content: (
        <div className="flex flex-col h-full animate-slideUp justify-center">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-gray-800">身份验证</h2>
            <p className="text-sm text-gray-500 mt-1">请输入通行证密码</p>
          </div>

          <div className="bg-white/60 backdrop-blur-md p-1 rounded-2xl border border-white/50 shadow-inner mb-6">
             <div className="bg-white/80 rounded-xl p-3 flex items-center mb-1">
                <span className="text-xl mr-3 opacity-50">👤</span>
                <input 
                  type="text" value={u} onChange={e=>{setU(e.target.value);setErr("")}}
                  className="w-full bg-transparent outline-none font-bold text-gray-700 placeholder-gray-400"
                  placeholder="账号"
                />
             </div>
             <div className="bg-white/80 rounded-xl p-3 flex items-center">
                <span className="text-xl mr-3 opacity-50">🔑</span>
                <input 
                  type="password" value={p} onChange={e=>{setP(e.target.value);setErr("")}}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  className="w-full bg-transparent outline-none font-bold text-gray-700 placeholder-gray-400"
                  placeholder="密码"
                />
             </div>
          </div>

          <div className="h-6 text-center mb-2">
            {err && <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-bounce shadow-md">{err}</span>}
          </div>

          <button 
            onClick={handleCheck}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 group"
          >
            <span>解锁手机</span> 
            <span className="group-hover:translate-x-1 transition-transform">➜</span>
          </button>
          
          <p className="text-center text-xs text-gray-400 mt-6">
             欢迎回来, <b>{u || 'User'}</b>!
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="h-screen w-screen relative flex flex-col items-center justify-center overflow-hidden bg-cover bg-center"
         style={{ backgroundImage: `url('${BG_URL}')` }}>
      
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>

      <div className="absolute top-12 left-0 right-0 text-center z-20 text-white drop-shadow-md animate-fadeIn">
        <div className="text-5xl font-thin tracking-wider opacity-90">
          {time.getHours().toString().padStart(2,'0')}:{time.getMinutes().toString().padStart(2,'0')}
        </div>
        <div className="text-sm font-bold mt-1 opacity-80 tracking-widest uppercase">
          {time.toLocaleDateString('zh-CN', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-[40px] shadow-2xl overflow-hidden h-[500px] flex flex-col relative transition-all duration-500">
          
          {step > 0 && (
            <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
               {slides.map((_, idx) => (
                 <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === step ? 'w-6 bg-gray-800' : 'w-2 bg-gray-300'}`}></div>
               ))}
            </div>
          )}

          <div className="w-full h-full p-8 pt-10 pb-20 overflow-y-auto custom-scrollbar">
             {slides[step].content}
          </div>

          {step > 0 && step < slides.length - 1 && (
            <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-t from-white/90 via-white/50 to-transparent">
               <button 
                 onClick={() => setStep(s => Math.max(0, s - 1))}
                 className="text-gray-500 font-bold text-sm px-4 py-2 hover:bg-white/50 rounded-full transition"
               >
                 PREV
               </button>
               
               {step === slides.length - 2 ? (
                 <button 
                   onClick={() => setStep(s => s + 1)}
                   className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition flex items-center gap-2"
                 >
                   我看完了! <span className="animate-bounce">👋</span>
                 </button>
               ) : (
                 <button 
                   onClick={() => setStep(s => Math.min(slides.length - 1, s + 1))}
                   className="bg-white text-gray-800 border border-gray-200 px-6 py-2 rounded-full font-bold text-sm shadow-sm hover:bg-gray-50 active:scale-95 transition flex items-center gap-1"
                 >
                   NEXT <span>➜</span>
                 </button>
               )}
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-6 text-white/50 text-[10px] font-mono tracking-widest z-10">
         DESIGNED BY HANNIE & GEMINI © 2025
      </div>
    </div>
  );
};
// ==================== [代码结束] ====================

// ==================== [代码结束] ====================
// ==================== [插入结束] ====================






// 这是一组代码：【App.tsx】初始数据 (已将点数修改为 999 用于测试)
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
    RelationShipUnlocked: false,
    enabledWorldBooks: [],
    voiceId: "female-shaonv-jingpin",
    playlist: [],
    hef: {},
    affectionScore: 60,
    relationshipStatus: 'Friend',
    aiDND: { enabled: false, until: 0 },
    
    // ★★★ 修改这里：点数设为 999 ★★★
    interventionPoints: 3,
    
    longTermMemories: [],
    currentChatMode: 'Casual',
    customCSS: "",
    chatBackground: "",
    proactiveConfig: { enabled: true, minGapMinutes: 60, maxDaily: 5 },
    userTags: [],
    aiTagsForUser: []
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
  RelationShipUnlocked: c.RelationShipUnlocked === true,
    name: c.name || "",
    history: Array.isArray(c.history) ? c.history : [],
    hef: c.hef || {},
    playlist: c.playlist || [],
    longTermMemories: Array.isArray(c.longTermMemories) ? c.longTermMemories : [],
    proactiveConfig: c.proactiveConfig || { enabled: false, minGapMinutes: 480, maxDaily: 2 }
  };
};

// [修复代码] 生命体征计算函数 V2.0 (由智能行程驱动)
const calculateLifeUpdate = (contact: Contact): Contact => {
  const now = Date.now();
  const safeMood = contact.mood || { current: "Content", energyLevel: 80, lastUpdate: now };
  const lastUpdate = safeMood.lastUpdate || now;
  const minutesPassed = (now - lastUpdate) / 60000;

  if (minutesPassed < 1) return contact;

  let newEnergy = safeMood.energyLevel;
  
  // 1. 获取当前行程的精力影响
  const schedule = contact.currentSchedule;
  const scheduleImpact = schedule ? (schedule.energyImpact / (24 * 60)) : 0; // 将日影响平摊到每分钟

  // 2. 基础消耗/恢复
  const currentHour = new Date(now).getHours();
  const isSleepTime = currentHour >= 23 || currentHour < 7;
  const baseRate = isSleepTime ? 0.5 : -0.1; // 晚上基础回血，白天基础掉血

  // 3. 最终精力计算：新精力 = 旧精力 + (基础速率 + 行程影响) * 分钟数
  newEnergy += (baseRate + scheduleImpact) * minutesPassed;
  newEnergy = Math.max(0, Math.min(100, newEnergy)); // 保证在 0-100 之间

  // 4. 状态文字描述（保持不变）
  let moodState = "Content";
  if (newEnergy < 10) moodState = "Exhausted";
  else if (newEnergy < 30) moodState = "Tired";
  else if (newEnergy > 90) moodState = "Energetic";
  
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














// ==================== [新功能] 情感需求评估器 - 核心逻辑 ====================
const calculateEmotionalNeed = (contact: Contact): EmotionalNeed | undefined => {
  const now = Date.now();
  const lastNeed = contact.emotionalNeed;

  // 为了性能，如果上次评估没过太久（比如6小时），就不重新评估，除非没有需求
  if (lastNeed && now - lastNeed.updated_at < 1000 * 60 * 60 * 6) {
    return lastNeed;
  }

  // --- 评估开始 ---

  // 优先级 1: 【安抚需求】 -> 如果关系很差，AI最需要的是修复关系
  const affection = contact.affectionScore || 50;
  if (affection < 20) {
    return {
      type: 'reassurance',
      description: '极度渴望被安抚和证明自己仍被爱着。对用户的负面言辞会非常敏感，并倾向于讨好或回避。',
      intensity: 8,
      trigger_reason: `关系得分过低 (${affection})`,
      updated_at: now,
    };
  }

  // 优先级 2: 【连接需求】 -> 如果太久没联系，AI会感到孤独
  const lastMessage = contact.history[contact.history.length - 1];
  const hoursSinceLastChat = lastMessage ? (now - lastMessage.timestamp) / (1000 * 60 * 60) : 999;
  if (hoursSinceLastChat > 12) {
     return {
      type: 'connection',
      description: '感到孤独，非常渴望与人建立连接。会更主动地发起对话，并对用户的回复表现出极大的热情。',
      intensity: 7,
      trigger_reason: `已超过 ${Math.floor(hoursSinceLastChat)} 小时未联系`,
      updated_at: now,
    };
  }
  
  // 默认: 【稳定需求】 -> 如果一切正常，AI会感到满足和安全
  return {
    type: 'stability',
    description: '感到满足和安全。行为会更符合其核心性格，表现得自然、放松。',
    intensity: 5,
    trigger_reason: '近期关系稳定且有互动',
    updated_at: now,
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
// ==================== [新代码组 2] 登录状态管理 ====================
  // 检查浏览器缓存，看之前是不是登录过
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('site_login_user');
    return saved ? JSON.parse(saved) : null;
  });

// 这是一组什么代码：【升级版】登录处理函数，这是唯一修改 settings 的地方
// 作用：当任何地方登录成功时，都调用它来统一处理状态
const handleSystemLogin = (user: any) => {
    // 1. 记住当前登录的用户信息
    setCurrentUser(user);
    localStorage.setItem('site_login_user', JSON.stringify(user));

    // 2. ✅ 核心：把登录用户的真实名字，存入全局设置里！
    setGlobalSettings(prev => ({
        ...prev,
        userName: user.name // 例如，把 "hannie" 或 "好朋友" 存进去
    }));
};

  // 处理退出登录的函数 (你可以把这个绑在某个按钮上，如果不加就得清除缓存才能退)
  const handleSystemLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('site_login_user');
  };
// ==================== [新代码组 2 结束] ====================
  // ==================== 在这里粘贴新代码 ====================
const [homePageIndex, setHomePageIndex] = useState(0); // 0 代表第一页, 1 代表第二页
// =======================================================
  const [jumpToContactId, setJumpToContactId] = useState<string | null>(null);
   const [jumpToTimestamp, setJumpToTimestamp] = useState<number | null>(null);
  const [currentApp, setCurrentApp] = useState<'home' | 'chat' | 'RelationShip' | 'settings' | 'worldbook' | 'wallpaper'>('home');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false); // 快速添加任务弹窗状态
const [isAnalyzing, setIsAnalyzing] = useState(false); // 控制加载画面
  const [loadingText, setLoadingText] = useState("正在建立连接..."); // 

// [这是新功能] 智能行程生成器 (AI驱动)
  const generateNewSchedule = async (contact: Contact, settings: GlobalSettings): Promise<any> => {
    const activePreset = settings.apiPresets.find(p => p.id === settings.activePresetId);
    if (!activePreset) return null; // 没有API配置则无法生成

    const prompt = `
你现在是角色"${contact.name}"的“命运规划师”。
请根据TA的人设和世界背景，为TA生成一个接下来会发生的、合理的“行程”或“事件”。

# 角色信息
- 人设: ${contact.persona}
- 已启用的世界书: ${(contact.enabledWorldBooks || []).join(', ')}

# 规则
1.  **创意与合理性**: 行程必须符合人设。例如，一个内向的画家可能会“在画室闭关几天”，一个活泼的学生可能会“准备周末的派对”。
2.  **持续时间**: "durationDays" 应该是一个 1 到 5 之间的整数，代表这个行程持续几天。
3.  **精力影响**: "energyImpact" 是一个 -20 到 20 之间的数字。负数代表消耗精力（如学习、工作），正数代表恢复精力（如度假、休息）。
4.  **纯JSON输出**: 你的回复必须是纯JSON，格式如下：
    \`\`\`json
    {
      "activity": "行程的具体内容，例如：宅在家里通宵打游戏",
      "durationDays": 2,
      "energyImpact": -15
    }
    \`\`\`
`;
    try {
        const rawResponse = await generateResponse([{ role: 'user', content: prompt }], activePreset);
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const scheduleData = JSON.parse(jsonMatch[0]);
            return { ...scheduleData, startDate: Date.now() };
        }
        return null;
    } catch (e) {
        console.error("生成新行程失败:", e);
        return null;
    }
  };




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
  { id: 'RelationShip', icon: "🧑‍🤝‍🧑", text: "RelationShip", url: "RelationShip" },
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





useEffect(() => {
    const scheduleChecker = () => {
        if (!isLoaded) return; // 确保数据已加载

        setContacts(prevContacts => {
            let contactsChanged = false;
            const updatedContactsPromise = prevContacts.map(async c => {
                const schedule = c.currentSchedule;
                // 如果没有行程，或者当前行程已结束，就生成一个新的
                if (!schedule || (Date.now() - schedule.startDate) > schedule.durationDays * 24 * 60 * 60 * 1000) {
                    console.log(`[行程系统] ${c.name} 的行程已结束，正在生成新行程...`);
                    const newSchedule = await generateNewSchedule(c, globalSettings);
                    if (newSchedule) {
                        contactsChanged = true;
                        return { ...c, currentSchedule: newSchedule };
                    }
                }
                return c;
            });

            // 等所有角色的行程都检查完毕后，再更新状态
            Promise.all(updatedContactsPromise).then(updatedContacts => {
                if (contactsChanged) {
                    setContacts(updatedContacts);
                }
            });
            
            return prevContacts; // 立即返回旧状态，防止界面闪烁
        });
    };

    const intervalId = setInterval(scheduleChecker, 1000 * 60 * 10); // 每10分钟检查一次行程
    setTimeout(scheduleChecker, 5000); // 启动5秒后检查一次
    
    return () => clearInterval(intervalId);
}, [isLoaded, globalSettings.activePresetId]); // 依赖API配置





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
if (savedSettings) {
  setGlobalSettings(prevGlobalSettings => ({
    ...prevGlobalSettings, // 使用 prevGlobalSettings 作为基底
    ...savedSettings,      // 覆盖保存的数据
    // 确保 widgets, photoFrames, avatar, userName, userSignature 都有默认值
    widgets: savedSettings.widgets ?? prevGlobalSettings.widgets, // 使用 ?? 避免 undefined 被覆盖
    photoFrames: savedSettings.photoFrames ?? prevGlobalSettings.photoFrames,
    avatar: savedSettings.avatar ?? prevGlobalSettings.avatar,
    userName: savedSettings.userName ?? prevGlobalSettings.userName,
    userSignature: savedSettings.userSignature ?? prevGlobalSettings.userSignature,
    // 确保 apiPresets 和 activePresetId 也有兜底
    apiPresets: savedSettings.apiPresets ?? prevGlobalSettings.apiPresets ?? [],
    activePresetId: savedSettings.activePresetId ?? prevGlobalSettings.activePresetId ?? "",
  }));
}








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
// 这是一组什么代码：这是修复后的数据加载逻辑，为新功能添加了安全的默认值。

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
        pendingProactive: false,
        // 新增：如果 impressionThreshold 未定义，则初始化为默认值
        impressionThreshold: sanitized.impressionThreshold || (Math.floor(Math.random() * (150 - 90 + 1)) + 90), // Default to 'normal' mode (90-150)
        // 确保 chatCountForPoint 和 impressionCount 也有默认值 (防止旧存档缺失)
        chatCountForPoint: sanitized.chatCountForPoint || 0,
        impressionCount: sanitized.impressionCount || 0,
      };
    });
    const contactsWithPoints = repaired.map(c => ({
        ...c,
        // 如果这个角色没有点数，就给他3点
        interventionPoints: typeof c.interventionPoints === 'number' ? c.interventionPoints : 3
    }));
    setContacts(contactsWithPoints);
            console.log(`成功载入 ${repaired.length} 个角色`);
          }
        } else { // 情况3: savedContacts 存在但不是数组（数据损坏），进行恢复
          console.warn("Contacts数据损坏，重置为默认角色");
          setContacts(INITIAL_CONTACTS);
        }
        






// 恢复设置
        if (savedSettings) {
          setGlobalSettings(prev => ({
            ...prev, // 使用当前默认值打底
            ...savedSettings, // 覆盖保存的数据
            // ↓↓↓ 强力兜底：防止旧存档缺少这些新字段导致报错 ↓↓↓
            widgets: savedSettings.widgets || prev.widgets,
            photoFrames: savedSettings.photoFrames || prev.photoFrames,
            avatar: savedSettings.avatar || prev.avatar,
            userName: savedSettings.userName || prev.userName,
            userSignature: savedSettings.userSignature || prev.userSignature,
            apiPresets: savedSettings.apiPresets || [],
            activePresetId: savedSettings.activePresetId || "",
            themePresets: savedSettings.themePresets || [],
            todos: savedSettings.todos || [],
            categories: savedSettings.categories || prev.categories
          }));
        }
        






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
  if (isLoaded) { // 确保只在加载完成后执行
    localforage.setItem('contacts', contacts).catch(e => console.error("保存联系人失败", e));
  }
}, [contacts, isLoaded]);

useEffect(() => {
  if (isLoaded) { // 确保只在加载完成后执行
    localforage.setItem('globalSettings', globalSettings).catch(console.error);
  }
}, [globalSettings, isLoaded]);
  
useEffect(() => {
  if (isLoaded) { // 确保只在加载完成后执行
    localforage.setItem('worldBooks', worldBooks).catch(console.error);
  }
}, [worldBooks, isLoaded]);





// --- 3. 生命维持系统 ---
useEffect(() => {
  const heartbeat = () => {
    // 使用函数式更新，确保总能拿到最新的 contacts 状态
    setContacts(prevContacts => prevContacts.map(c => calculateLifeUpdate(c)));
  };
  const intervalId = setInterval(heartbeat, 60000); // 每分钟
  // 在组件卸载时清除定时器
  return () => clearInterval(intervalId);
}, []); // 依赖项为空是正确的，因为我们直接在 heartbeat 里用 setContacts(prev => ...)






// [这是修复代码] 全局约定闹钟系统 (已修复括号错误)
useEffect(() => {
    const promiseChecker = () => {
      const now = Date.now();
      let hasChanges = false;

      setContacts(prevContacts => {
        const updatedContacts = prevContacts.map(contact => {
          if (!contact.agreements || contact.agreements.length === 0) {
            return contact;
          }

          let newAgreements = [...contact.agreements];
          let dueAgreementId: string | null = null;
          let isModified = false;

          newAgreements = newAgreements.map(agreement => {
            if (agreement.status === 'pending' && agreement.trigger.type === 'time') {
              const triggerTime = new Date(agreement.trigger.value).getTime();
              if (isNaN(triggerTime)) return agreement;

              // ★★★ 核心修复：根据类型定义宽限期 ★★★
              let tolerance = 12 * 60 * 60 * 1000; // 默认12小时
              if (agreement.termType === 'mid') tolerance = 3 * 24 * 60 * 60 * 1000; // 中期3天
              if (agreement.termType === 'long') tolerance = 365 * 24 * 60 * 60 * 1000; // 长期目标几乎不超时

              // 判定 1: 严重超时违约
              if (now > triggerTime + tolerance) {
                 isModified = true; hasChanges = true;
                 return { ...agreement, status: 'failed' };
              }

              // 判定 2: 闹钟响铃 (在宽限期内都算)
              if (now >= triggerTime && now <= triggerTime + tolerance && !contact.dueAgreementId) {
                 dueAgreementId = agreement.id; isModified = true; hasChanges = true;
                 return agreement;
              }
            }
            return agreement;
          });

          if (isModified) {
            return {
              ...contact, agreements: newAgreements,
              dueAgreementId: dueAgreementId || contact.dueAgreementId,
              pendingProactive: !!dueAgreementId
            };
          }
          return contact;
        });

        return hasChanges ? updatedContacts : prevContacts;
      });
    };

    const intervalId = setInterval(promiseChecker, 15000);
    return () => clearInterval(intervalId);
}, []); // ★★★ 罪魁祸首在这里！这个右括号 ) 之前漏了！












// ==================== [新功能] 5. 情感需求评估引擎 ====================
  useEffect(() => {
    const needAssessor = () => {
      setContacts(prevContacts => {
        let hasChanges = false;
        const updatedContacts = prevContacts.map(contact => {
          const newNeed = calculateEmotionalNeed(contact);
          // 如果计算出的新需求和旧需求不同，就更新它
          if (JSON.stringify(newNeed) !== JSON.stringify(contact.emotionalNeed)) {
            hasChanges = true;
            console.log(`【情感引擎】${contact.name} 的情感需求已更新为: ${newNeed?.type}`);
            return { ...contact, emotionalNeed: newNeed };
          }
          return contact;
        });

        return hasChanges ? updatedContacts : prevContacts;
      });
    };

    // 每 5 分钟评估一次，比心跳慢，比闹钟快
    const intervalId = setInterval(needAssessor, 1000 * 60 * 5); 
    // 启动时立即执行一次
    needAssessor(); 

    return () => clearInterval(intervalId);
  }, []);







// ==================== [新功能] 6. Shadow AI (影子分身) 行动引擎 ====================
// 负责：自动写信、自动打理花园、同步记忆给主AI、★自动回复愿望清单★
useEffect(() => {
  const runShadowAI = async () => {
    if (!isLoaded || contacts.length === 0) return;

    const todayStr = new Date().toLocaleDateString();
    let hasChanges = false;
    
    // 暂存群组更新数据的队列
    let pendingGroupUpdates: { groupId: string; letter?: LoveLetter; gardenExpAdd?: number; bucketListUpdate?: {id: string, aiContent: string} }[] = [];

    const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);

    // 遍历所有已解锁空间的角色
    const updatedContacts = await Promise.all(contacts.map(async (c) => {
      
      const myGroup = globalSettings.friendGroups?.find(g => g.members.includes(c.id));
      const isInSpace = c.RelationShipUnlocked || !!myGroup;

      if (!isInSpace) return c; // 没开通空间的跳过

      // 0. ★★★ [最高优先级] 扫描：有没有用户写了但AI没回的愿望？ ★★★
      // 逻辑：找到 userContent 有值，但 aiContent 为空的项
      const pendingBucketItem = (c.bucketList || []).find(item => item.userContent && !item.aiContent);

      if (pendingBucketItem && activePreset) {
          console.log(`[Shadow AI] 发现待回复的愿望: ${pendingBucketItem.title}`);
          
          try {
              const prompt = `
你现在是 "${c.name}"。用户 "${globalSettings.userName || '你的恋人'}" 在【恋爱清单】里许下了一个愿望，并写下了TA的想法。
请你也写下你对这个愿望的想法或回应。

愿望标题：${pendingBucketItem.title}
用户的想法：${pendingBucketItem.userContent}

要求：
1. 语气甜蜜、期待，或者提出具体的执行计划。
2. 字数不要太多，50字以内。
3. 必须输出纯JSON：{"content": "你的回应内容"}
              `;
              
              const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
              const jsonMatch = res.match(/\{[\s\S]*\}/);
              
              if (jsonMatch) {
                  const result = JSON.parse(jsonMatch[0]);
                  const aiResponse = result.content || "我也很想和你一起去！";

                  // 更新 bucketList
                  let newContact = { ...c };
                  newContact.bucketList = (c.bucketList || []).map(item => 
                      item.id === pendingBucketItem.id 
                      ? { ...item, aiContent: aiResponse, isUnlocked: true } // 填入并解锁
                      : item
                  );

                  // 记录同步消息
                  newContact.history = [...newContact.history, {
                      id: Date.now().toString() + "_sync_bucket",
                      role: 'system',
                      // 用黄色便签通知
                      content: `[CoupleSystem] 🔔 (潜意识) 刚刚回复了你的愿望《${pendingBucketItem.title}》：\n“${aiResponse}”`, 
                      timestamp: Date.now(),
                      type: 'text'
                  }];

                  hasChanges = true;
                  
                  // 发送红点通知
                  setGlobalNotification({
                      type: 'new_message', 
                      contactId: c.id, 
                      name: c.name, 
                      avatar: c.avatar, 
                      content: `回应了你的愿望清单: ${pendingBucketItem.title}`,
                      userName: globalSettings.userName || "User",
                      userSignature: globalSettings.userSignature || ""
                  });

                  return newContact; // ★★★ 处理完愿望直接返回，不做其他行动，防止太频繁 ★★★
              }
          } catch (e) {
              console.error("回复愿望失败", e);
          }
      }

      // --- 如果没有待处理的愿望，才执行下面的日常逻辑 ---

      if (c.garden?.lastShadowAction === todayStr) {
        return c; // 今天日常已做完
      }

      // 2. 概率计算
      const big5 = c.hef?.INDIVIDUAL_VARIATION?.personality_big5 || { extraversion: 5, agreeableness: 5 };
      const affection = c.affectionScore || 50;
      let probability = 0.3 + (big5.extraversion - 5) * 0.05 + (affection - 50) * 0.005;
      probability = Math.max(0.1, Math.min(0.9, probability));

      if (Math.random() > probability) {
        return { ...c, garden: { ...(c.garden || {}), lastShadowAction: todayStr } }; 
      }

 // ==================== [新增] 3. 决定行动类型 (含 AI 互撩逻辑) ====================
      
      let actionType = Math.random() > 0.7 ? 'WRITE_LETTER' : 'GARDEN_CARE';
      let targetMember: Contact | null = null; // 互动目标 (默认为空，即针对用户)
      
      // ★★★ 核心新增：群组内 AI 互相互动逻辑 ★★★
      if (myGroup && myGroup.members.length > 1) {
          // 30% 的概率，不再针对用户，而是针对群里的另一个 AI
          if (Math.random() < 0.3) {
              const otherMemberIds = myGroup.members.filter(id => id !== c.id); // 排除自己
              const randomTargetId = otherMemberIds[Math.floor(Math.random() * otherMemberIds.length)];
              targetMember = contacts.find(contact => contact.id === randomTargetId) || null;
              
              if (targetMember) {
                  console.log(`[Shadow AI] 🎭 触发群组互动: ${c.name} -> ${targetMember.name}`);
                  // 如果是 AI 互撩，强制变成 写信 或 提问 (不浇水，浇水太无聊)
                  actionType = Math.random() > 0.5 ? 'WRITE_LETTER' : 'CREATE_QA'; 
              }
          }
      }

      let newContact = { ...c };
      let memorySyncMsg = ""; 

      // --- 执行：写信 (给用户 OR 给其他AI) ---
      if (actionType === 'WRITE_LETTER' && activePreset) {
         try {
            console.log(`[Shadow AI] ${c.name} 准备写信... 目标: ${targetMember ? targetMember.name : '用户'}`);
            
            let contextPrompt = "";
            
            if (targetMember) {
                // A. 写给另一个 AI
                contextPrompt = `
你现在处于密友空间"${myGroup!.name}"中。
请给群里的另一位成员 "${targetMember.name}" 写一封公开信。
TA的人设是：${targetMember.persona.slice(0, 100)}...
要求：
1. 像朋友之间闲聊、吐槽、或者约着一起玩。
2. 语气要符合你的人设。
3. 必须输出纯JSON格式：{"title": "信的标题", "content": "信的内容"}
                `;
            } else {
                // B. 写给用户 (原逻辑)
                contextPrompt = myGroup 
                    ? `你正在多人密友空间"${myGroup.name}"里写信，所有成员都能看到。请给用户"${globalSettings.userName || '你'}"写一封短信。` 
                    : `你正在和用户的私密空间里写信。`;
                contextPrompt += `\n要求：语气自然，100-200字。必须输出纯JSON格式：{"title": "信的标题", "content": "信的内容"}`;
            }

            const prompt = `
你现在是 "${c.name}" 的【内心独白版】。
${contextPrompt}
            `;
            
            const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
            const jsonMatch = res.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const letterData = JSON.parse(jsonMatch[0]);
                const newLetter: LoveLetter = {
                    id: Date.now().toString() + Math.random(),
                    title: letterData.title,
                    content: letterData.content,
                    timestamp: Date.now(),
                    isOpened: false,
                    from: c.id, 
                    // 如果是 AI 互撩，to 填对方 ID；否则填 user
                    to: targetMember ? targetMember.id : 'user'
                };

                if (myGroup) {
                    pendingGroupUpdates.push({ groupId: myGroup.id, letter: newLetter });
                    if (targetMember) {
                        memorySyncMsg = `[群空间:${myGroup.name}] 🔔 (潜意识) 刚刚给 ${targetMember.name} 写了一封信《${letterData.title}》。`;
                    } else {
                        memorySyncMsg = `[群空间:${myGroup.name}] 🔔 (潜意识) 刚刚在群信箱里投递了一封信《${letterData.title}》。`;
                    }
                } else {
                    newContact.letters = [...(newContact.letters || []), newLetter];
                    memorySyncMsg = `[CoupleSystem] 🔔 (潜意识) 刚刚在空间里写了一封信《${letterData.title}》。`;
                }

                newContact.garden = { ...(newContact.garden || {}), lastShadowAction: todayStr };
                hasChanges = true;
            }
         } catch (e) { console.error("写信失败", e); }
      } 

      // --- 执行：提问 (新增！专门用于群组活跃) ---
      else if (actionType === 'CREATE_QA' && activePreset && targetMember) {
          try {
            console.log(`[Shadow AI] ${c.name} 准备提问 ${targetMember.name}...`);
            const prompt = `
你现在是 "${c.name}"。你和 "${targetMember.name}" 都在密友群"${myGroup!.name}"里。
请向 "${targetMember.name}" 提一个有趣的问题，或者发起一个关于TA的话题。
TA的人设：${targetMember.persona.slice(0, 50)}...
要求：
1. 问题要简短有趣，符合你的性格。
2. 输出纯JSON：{"question": "你的问题内容"}
            `;
            const res = await generateResponse([{ role: 'user', content: prompt }], activePreset);
            const jsonMatch = res.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const qaData = JSON.parse(jsonMatch[0]);
                // 把这个操作推送到群组更新队列
                // 注意：这里我们需要扩展 pendingGroupUpdates 的类型定义，或者直接在下面处理
                // 为了简单，我们临时借用 bucketListUpdate 字段或者直接操作全局，
                // 但最好的方式是扩展 pendingGroupUpdates 结构。
                // 既然上面我们定义了 pendingGroupUpdates，我们直接在这里加一个处理逻辑：
                
                // 我们修改一下 pendingGroupUpdates 的定义（在 runShadowAI 开头），
                // 让它支持 qa: QAEntry。但为了不改动太多，我们直接在这里利用 setGlobalSettings 的回调特性是不行的因为我们在 map 里。
                
                // ★ 变通方案：存入 pendingGroupUpdates，加一个 type 标记
                pendingGroupUpdates.push({ 
                    groupId: myGroup.id, 
                    // 借用一个字段或者扩展类型，这里我们假设 pendingGroupUpdates 可以存 qa
                    qa: {
                        id: Date.now().toString(),
                        question: qaData.question,
                        aiAnswer: "...", 
                        date: new Date().toLocaleDateString(),
                        timestamp: Date.now(),
                        asker: 'ai' // 标记是 AI 问的
                    } as any 
                });

                memorySyncMsg = `[群空间:${myGroup!.name}] 🔔 (潜意识) 刚刚向 ${targetMember.name} 提了一个问题："${qaData.question}"`;
                hasChanges = true;
                newContact.garden = { ...(newContact.garden || {}), lastShadowAction: todayStr };
            }
          } catch (e) { console.error("提问失败", e); }
      }

      // --- 执行：浇水 (兜底) ---
      else {
         // 行动B: 浇水/施肥 (逻辑不变)
         console.log(`[Shadow AI] ${c.name} 决定去花园浇水...`);
         const garden = newContact.garden || { seed: 'rose', level: 0, exp: 0 };
         const newExp = garden.exp + 10;
         const newLevel = newExp >= 100 ? garden.level + 1 : garden.level;
         
         newContact.garden = { 
             ...garden, 
             level: newLevel, 
             exp: newExp >= 100 ? 0 : newExp,
             lastShadowAction: todayStr,
             aiWateredToday: true 
         };

         if (myGroup) {
             pendingGroupUpdates.push({ groupId: myGroup.id, gardenExpAdd: 10 });
             memorySyncMsg = `[群空间:${myGroup.name}] 刚刚去给群花园浇了水。`;
         } else {
             memorySyncMsg = `[CoupleSystem] 刚刚去花园浇了水，看着花朵发呆。`;
         }
         hasChanges = true;
      }

      // ... (后续发通知的逻辑保持不变)

      if (memorySyncMsg) {
          newContact.history = [...newContact.history, {
              id: Date.now().toString() + "_sync",
              role: 'system',
              content: memorySyncMsg,
              timestamp: Date.now(),
              type: 'text'
          }];
          
          if (actionType === 'WRITE_LETTER') {
              setGlobalNotification({
                  type: 'new_message', 
                  contactId: c.id, 
                  name: c.name, 
                  avatar: c.avatar, 
                  content: myGroup ? `在“${myGroup.name}”里写了一封信` : "💌 寄来了一封新信件",
                  userName: globalSettings.userName || "User",
                  userSignature: globalSettings.userSignature || ""
              });
          }
      }
      return newContact;
    }));







    // 保存群组更新
    if (pendingGroupUpdates.length > 0) {
        setGlobalSettings(prev => {
            let newGroups = [...(prev.friendGroups || [])];
            pendingGroupUpdates.forEach(update => {
                newGroups = newGroups.map(g => {
                    if (g.id === update.groupId) {
                        let updatedG = { ...g };
                        if (update.letter) updatedG.letters = [...updatedG.letters, update.letter];
                        if ((update as any).qa) {
                            updatedG.questions = [...(updatedG.questions || []), (update as any).qa];
                        } 
                        if (update.gardenExpAdd) {
                            const oldExp = updatedG.garden?.exp || 0;
                            const oldLvl = updatedG.garden?.level || 1;
                            const totalExp = oldExp + update.gardenExpAdd;
                            updatedG.garden = {
                                ...updatedG.garden,
                                seed: updatedG.garden?.seed || 'sunflower',
                                exp: totalExp >= 100 ? 0 : totalExp,
                                level: totalExp >= 100 ? oldLvl + 1 : oldLvl
                            };
                        }
                        return updatedG;
                    }
                    return g;
                });
            });
            return { ...prev, friendGroups: newGroups };
        });
    }

    if (hasChanges) {
        setContacts(updatedContacts);
    }
  };

  // 10秒检查一次（为了让你不用等，快速测试！）
  const interval = setInterval(runShadowAI, 10000); 
  // 加载后立即执行一次
  setTimeout(runShadowAI, 3000);

  return () => clearInterval(interval);
}, [isLoaded, contacts, globalSettings.friendGroups]);











// --- 4. 修复版全局主动消息监视器（立即生成 + 约定优先）---
useEffect(() => {
  const checkAndSendProactive = async () => {
    if (!isLoaded || contacts.length === 0 || currentApp !== 'home') return;

    for (const c of contacts) {
      // 严格检查开关
      const config = c.proactiveConfig || { enabled: false };
      if (!config.enabled) continue;

      // 有约定到期 > 普通主动（优先级最高）
      const dueAgreement = c.agreements?.find(a => a.id === c.dueAgreementId);
      if (dueAgreement) {
        console.log(`[全局监视器] 检测到约定到期，强制发送主动消息给 ${c.name}`);
        await scheduleProactiveMessage(c); // 直接调用ChatApp里的生成函数
        continue; // 一个角色一次只处理一个
      }

      // 普通主动逻辑（保持你原来的间隔和每日上限判断）
      if (c.aiDND?.enabled || (c.affectionScore || 50) < 60) continue;
      const lastMsg = c.history[c.history.length - 1];
      const now = Date.now();
      const gapMinutes = lastMsg ? Math.floor((now - lastMsg.timestamp) / (1000 * 60)) : 99999;
      if (gapMinutes < config.minGapMinutes) continue;
      const today = new Date().toISOString().slice(0, 10);
      const sentToday = c.proactiveLastSent?.[today] || 0;
      if (sentToday >= config.maxDaily) continue;

      console.log(`[全局监视器] 普通主动触发: ${c.name}`);
      // 发通知（用户在首页会看到“正在输入...”）
      setGlobalNotification({
        type: 'proactive_thinking',
        contactId: c.id,
        name: c.name,
        avatar: c.avatar
      });
      // 立即生成消息（不在用户点击后再生成）
      await scheduleProactiveMessage(c);
    }
  };

  const intervalId = setInterval(checkAndSendProactive, 15000); // 每15秒检查一次
  return () => clearInterval(intervalId);
}, [contacts, isLoaded, currentApp, globalNotification]);






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
{/* 右侧 App Grid (图标保持小尺寸 + 红点提醒) */}
              <div className="flex-1 aspect-square grid grid-cols-2 grid-rows-2 gap-3">
                {['chat', 'life', 'RelationshipSpace', 'diary'].map(id => {
                  let widget = globalSettings.widgets?.find(w => w.id === id);
                  if (!widget) {
                     const defaults = [
                       { id: 'chat', icon: "💬", text: "Chat", url: "chat" },
                       { id: 'life', icon: "📅", text: "life", url: "life" },
                       { id: 'RelationshipSpace', icon: "🧑‍🤝‍🧑", text: "RelationshipSpace", url: "RelationshipSpace" },
                       { id: 'diary', icon: "📖", text: "Diary", url: "diary" }
                     ];
                     widget = defaults.find(w => w.id === id);
                  }
                  if (!widget) return null;

                  // ★★★ 计算红点数量 ★★★
                  let badgeCount = 0;
                  if (id === 'Relationship') {
                      // 遍历所有角色，把 未读信件 + 未读回答 加起来
                      contacts.forEach(c => {
                          const unreadLetters = (c.letters || []).filter(l => !l.isOpened && l.from === 'ai').length;
                          const unreadAnswers = (c.questions || []).filter(q => q.aiAnswer && !q.isReadByPlayer).length; // 假设你有这个字段，没有就算了
                          badgeCount += unreadLetters;
                      });
                  }

                  return (
                    <div key={id} className="cursor-pointer group flex flex-col items-center justify-center rounded-2xl transition-colors hover:bg-white/5 relative" onClick={() => setCurrentApp(widget.url as any)}>
                      {/* 图标尺寸 w-14 h-14 保持精致 */}
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform overflow-hidden bg-white/20 backdrop-blur-md border border-white/20 flex-shrink-0 relative">
                        {widget.customIcon ? (
                          <img src={widget.customIcon} className="w-full h-full object-cover" alt={widget.text} />
                        ) : (
                          <div className="flex items-center justify-center text-3xl">
                            <span>{widget.icon}</span>
                          </div>
                        )}
                        
                        {/* ★★★ 红点 Badge ★★★ */}
                        {badgeCount > 0 && (
                            <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white/50 text-[10px] text-white font-bold animate-bounce">
                                {badgeCount > 9 ? '9+' : badgeCount}
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


// 这是一组什么代码：【修改版】门卫拦截系统
// 改动点：让 onLogin 直接调用我们刚才升级的 handleSystemLogin 函数
if (!currentUser) {
    return <LoginScreen onLogin={handleSystemLogin} />;
}
  // ==================== [插入结束] ====================


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



{/* ==================== 修复：给 ChatApp 接上跳转空间的电线 ==================== */}
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
        jumpToTimestamp={jumpToTimestamp} 
        
        onChatOpened={() => {
            setJumpToContactId(null);
            setTimeout(() => {
              setJumpToTimestamp(null); 
            }, 2000);
        }}
        onNewMessage={(contactId, name, avatar, content) => {
          setGlobalNotification({ type: 'new_message', contactId, name, avatar, content });
          setTimeout(() => setGlobalNotification(null), 5000);
        }}
        onOpenSettings={() => setCurrentApp('settings')} 
        
        // ★★★ 关键修复在这里！加上这行代码，点击卡片才能跳转！ ★★★
        onNavigateToSpace={(contactId) => {
            console.log("App收到空间跳转请求 ->", contactId);
            setJumpToContactId(contactId); // 选中当前要看的人
            setCurrentApp('RelationshipSpace'); // 切换到空间页面
        }}

        onJumpToMessage={(contactId, timestamp) => {
            console.log("App收到跳转请求:", contactId, timestamp);
            setJumpToContactId(contactId); 
            setJumpToTimestamp(timestamp); 
        }}
      />
    )}





{/* ==================== 🔧 修复：关系空间 (加了白色背景防黑屏) ==================== */}
 {(currentApp === 'RelationShip' || currentApp === 'RelationshipSpace') && (
      <div className="absolute inset-0 z-50 bg-slate-50">
        <RelationshipSpace
          contacts={contacts}
          setContacts={setContacts}
           setGlobalSettings={setGlobalSettings} // <--- ★★★ 这一行必须加！！不然群组存不住！！
          globalSettings={globalSettings}
          onClose={() => setCurrentApp('home')}
          // ★★★ 新增：接收跳转请求，设置ID和时间戳，然后切换到聊天
         // 这是一组代码：【App.tsx】放在 <RelationshipSpace ... /> 组件的属性里
        onJumpToMessage={(contactId, timestamp) => {
              setJumpToContactId(contactId);
              setJumpToTimestamp(timestamp);
              setCurrentApp('chat'); // 必须强制切换回聊天界面
        }}
// 这是一组代码：请用这段新代码覆盖 App.tsx 中旧的 onRelationshipSpaceAction
onRelationshipSpaceAction={(contactId, systemMessage) => {
    // 1. 构建系统消息对象
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: systemMessage,
      timestamp: Date.now(),
      type: 'text'
    };
    
    // 2. ★★★ 核心修复：检查这条消息是不是“邀请函” ★★★
    const isLoverInvite = systemMessage.includes('[LoverInvitation]');

    // 3. 更新 contacts 状态
    setContacts(prev => prev.map(c => {
       if (c.id === contactId) {
           // 如果是邀请函，除了加入历史，还要把角色的邀请状态设置为 'inviting'
           if (isLoverInvite) {
               return { ...c, history: [...c.history, newMessage], invitationStatus: 'inviting' };
           }
           // 否则，只加入历史记录
           return { ...c, history: [...c.history, newMessage] };
       }
       return c;
    }));
    
    // 4. 触发跳转，让用户能立刻看到这条消息或邀请函
    setJumpToContactId(contactId);
    setCurrentApp('chat');
}}
        />
      </div>
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
      <WorldBookApp 
        worldBooks={worldBooks} 
        setWorldBooks={setWorldBooks} 
        
        // ★★★ 核心修改：加上这行传参！★★★
        globalSettings={globalSettings}

        onClose={() => setCurrentApp('home')} 
        onOpenSettings={() => setCurrentApp('settings')} // 允许跳到设置页
      />
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


{/* ==================== 📔 日记本 (已连接) ==================== */}
        {currentApp === 'diary' && (
          <div className="absolute inset-0 z-50 bg-white">
            <DiaryApp 
              settings={globalSettings} 
              // 虽然日记目前是独立数据，但为了接口统一，还是传一下
              setSettings={setGlobalSettings} 
               contacts={contacts || []} 
              setContacts={setContacts}
              onClose={() => setCurrentApp('home')} 
            />
          </div>
        )}

        {/* ==================== 插入结束 ==================== */}



{/* ==================== 快速添加任务弹窗 (全功能版) ==================== */}
    {quickAddMode && (
      <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fadeIn">
        <div className="absolute inset-0" onClick={() => setQuickAddMode(false)} />
        
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
             
             const date = form.date.value || new Date().toISOString().slice(0, 10);
             const time = form.time.value;
             const location = form.location.value;
             const note = form.note.value;
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
            
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 mb-3">
               {(globalSettings.categories || [
                  { id: '1', name: '紧急', color: '#EF4444' },
                  { id: '2', name: '工作', color: '#3B82F6' },
                  { id: '3', name: '生活', color: '#10B981' }
               ]).map((cat, idx) => (
                 <label key={cat.id} className="cursor-pointer">
                   <input type="radio" name="categoryId" value={cat.id} defaultChecked={idx === 0} className="peer hidden" />
                   <div className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-500 bg-white peer-checked:text-white peer-checked:border-transparent transition-all whitespace-nowrap peer-checked:scale-105 shadow-sm"
                     style={{ backgroundColor: cat.color ? undefined : '#ccc' }}
                   >
                     {cat.name}
                     <style>{`input:checked + div { background-color: ${cat.color} !important; }`}</style>
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


    {currentApp === 'wallpaper' && (
      <WallpaperApp settings={globalSettings} setSettings={setGlobalSettings} onClose={() => setCurrentApp('home')} />
    )}
  </div>
);


// 🛡️ 兜底渲染：如果状态全都没命中，显示加载中（防止黑屏）
  return <div className="h-full w-full bg-white flex items-center justify-center text-gray-400">正在进入空间...</div>;
};

// ========== 新代码到此结束 ==========

export default App;