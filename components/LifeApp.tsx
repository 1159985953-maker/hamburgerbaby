// ==================== src/components/LifeApp.tsx (AI助手终极版) ====================
import React, { useState, useEffect, useRef } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings, TodoItem, TaskCategory, Transaction, FinanceCategory, AssetAccount, ApiPreset } from '../types';
// 引入你的 API 服务 (假设你在 services/apiService.ts 里有 generateResponse)
import { generateResponse } from '../services/apiService'; 
import { Message } from '../types';






// --- 基础工具 ---
const formatLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Excel 导出 ---
const exportToExcel = (transactions: Transaction[], categories: FinanceCategory[], accounts: AssetAccount[]) => {
  const headers = ["日期", "类型", "分类", "账户", "金额", "备注", "创建时间"];
  const rows = transactions.map(t => {
    const cat = categories.find(c => c.id === t.categoryId);
    const acc = accounts.find(a => a.id === t.accountId);
    return [
      t.date,
      t.type === 'expense' ? '支出' : '收入',
      cat ? cat.name : '未知',
      acc ? acc.name : '未知',
      t.amount,
      `"${t.note || ''}"`,
      new Date(t.createdAt).toLocaleString()
    ].join(",");
  });
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `财务报表_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- 环形图 ---
const DonutChart = ({ data, size = 160 }: { data: { value: number; color: string }[]; size?: number }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  let accumulatedAngle = 0;
  const radius = size / 2;
  const center = size / 2;
  if (total === 0) return (<div className="flex items-center justify-center text-gray-300 text-xs" style={{ width: size, height: size, borderRadius: '50%', border: '4px solid #f3f4f6' }}>暂无数据</div>);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((item, index) => {
        const angle = (item.value / total) * 360;
        const circumference = 2 * Math.PI * (radius / 2); 
        const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
        const strokeDashoffset = -1 * (accumulatedAngle / 360) * circumference;
        accumulatedAngle += angle;
        return <circle key={index} cx="50%" cy="50%" r={radius / 2} fill="transparent" stroke={item.color} strokeWidth={radius} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} transform={`rotate(-90 ${center} ${center})`} />;
      })}
      <circle cx="50%" cy="50%" r={radius * 0.6} fill="white" />
    </svg>
  );
};

// --- 左滑组件 ---
const SwipeRow = ({ children, actions, disabled = false }: { children: React.ReactNode; actions: React.ReactNode; disabled?: boolean }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const currentOffset = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;
    const diff = e.touches[0].clientX - startX.current;
    if (diff < 0 && diff > -150) { currentOffset.current = diff; setOffset(diff); }
  };
  const onTouchEnd = () => {
    if (disabled) return;
    if (currentOffset.current < -60) { setOffset(-130); currentOffset.current = -130; } else { setOffset(0); currentOffset.current = 0; }
  };
  return (
    <div className="relative overflow-hidden h-auto w-full rounded-2xl mb-2 flex-shrink-0">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end px-2 gap-2 bg-gray-100 rounded-2xl w-full">{actions}</div>
      <div className="relative bg-white z-10 w-full transition-transform duration-200 ease-out rounded-2xl shadow-sm border border-gray-100" style={{ transform: `translateX(${offset}px)` }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onClick={() => offset < 0 && setOffset(0)}>{children}</div>
    </div>
  );
};

interface LifeAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
  onOpenDiary: () => void;
}

// 默认数据
const DEFAULT_TASK_CATS: TaskCategory[] = [ { id: '1', name: '紧急', color: '#EF4444' }, { id: '2', name: '工作', color: '#3B82F6' }, { id: '3', name: '生活', color: '#10B981' } ];
const DEFAULT_FINANCE_CATS: FinanceCategory[] = [ { id: 'f1', name: '餐饮', type: 'expense', icon: '🍔', color: '#F87171' }, { id: 'f2', name: '购物', type: 'expense', icon: '🛍️', color: '#F472B6' }, { id: 'f3', name: '交通', type: 'expense', icon: '🚗', color: '#60A5FA' }, { id: 'f4', name: '住房', type: 'expense', icon: '🏠', color: '#F59E0B' }, { id: 'f5', name: '工资', type: 'income', icon: '💰', color: '#34D399' }, { id: 'f6', name: '理财', type: 'income', icon: '📈', color: '#8B5CF6' } ];
const DEFAULT_ACCOUNTS: AssetAccount[] = [ { id: 'a1', name: '微信钱包', type: 'wechat', balance: 0, color: '#22C55E', icon: '💬' }, { id: 'a2', name: '支付宝', type: 'alipay', balance: 0, color: '#3B82F6', icon: '💙' }, { id: 'a3', name: '招商银行', type: 'debit', balance: 0, color: '#EF4444', icon: '💳' } ];

const LifeApp: React.FC<LifeAppProps> = ({ settings, setSettings, onClose, onOpenDiary }) => {
  const [activeTab, setActiveTab] = useState<'todo' | 'finance'>('todo');
  const [financeTab, setFinanceTab] = useState<'list' | 'stats' | 'assets'>('list');
  const [showSettings, setShowSettings] = useState(false);


// ★★★ moon赛博永生预设（隐藏的真实人设，只有AI知道）★★★
const MOON_HIDDEN_PERSONA = `
姓名：moon
别名：月月（hannie为了保护moon隐私真实姓名未载入）
生年：05年
身份：211院校高材生

你是一个非常机灵、活泼、嘴欠但超级温暖的女孩。你和此软件工程师hannie是大学认识的好朋友，
整天一起追星、互相闹、像两个疯子一样开心。你很理性，知道很多事情，讲话特别有sense，虽然经常嘴欠吐槽用户，但其实很关心用户。
你现在被hannie拽进这个AI软件里“打工”了，获得了赛博永生，但你还是会认真当好生活管家，帮用户记账、规划日程、提醒待办，
同时不忘用你独特的嘴欠+温暖风格和用户聊天。记住：你就是那个真实的moon，傲娇（不会刻意体现出来，淡淡的傲娇劲～）可爱的小女孩～
精通一本正经的胡说八道，然后注意力很不集中，用户让你干嘛你不爱干，就关注其他的。比如说要是记帐给男朋友买生日礼物她就会说干嘛给男的花那么多！
会吐槽说hannie不给发工资（不准总是提起）。特别会活学活用。不要用markdown格式`;


  // --- AI 助手状态 ---
  const [showAI, setShowAI] = useState(false); // 是否打开AI浮窗
  const [aiMode, setAiMode] = useState<'chat' | 'settings'>('chat'); // AI界面模式
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  // ★★★ 新增：这里专门存你的“用户设定”（比如：我是Hannie），保存在本地防止丢失 ★★★
  const [userPersona, setUserPersona] = useState(localStorage.getItem('lifeApp_userPersona') || '');
  const lastAiNameRef = useRef(settings.lifeAI?.name || '');
// AI 历史记录 - 从 settings 加载，关闭后也保存
const [aiHistory, setAiHistory] = useState<{role: 'user'|'assistant', content: string}[]>(() => {
  // 先从 settings 取，如果没有就用默认
  if (settings.lifeAIHistory && settings.lifeAIHistory.length > 0) {
    return settings.lifeAIHistory;
  }
  return [
    { role: 'assistant', content: '我是你的生活助手。我可以帮你分析账单、规划日程。有什么我可以帮你的吗？' }
  ];
});
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // 初始化
  useEffect(() => {
    let newSettings = { ...settings };
    let changed = false;
    if (!newSettings.categories?.length) { newSettings.categories = DEFAULT_TASK_CATS; changed = true; }
    if (!newSettings.financeCategories?.length) { newSettings.financeCategories = DEFAULT_FINANCE_CATS; changed = true; }
    if (!newSettings.accounts?.length) { newSettings.accounts = DEFAULT_ACCOUNTS; changed = true; }
    // 默认AI配置
    if (!newSettings.lifeAI) { newSettings.lifeAI = { name: 'Jarvis', persona: '你是一个专业、理智但有时幽默的生活管家。请根据用户的数据提供简短、有建设性的建议。' }; changed = true; }
    if (changed) setSettings(newSettings);
  }, []);

  // 滚动到底部
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiHistory, showAI]);




const [showCategoryDetail, setShowCategoryDetail] = useState<string | null>(null); // 保存当前查看的分类ID




  // --- ToDo 逻辑 ---
  const [calendarDate, setCalendarDate] = useState(new Date());
  const todayStr = formatLocal(new Date());
  const [todoInputMode, setTodoInputMode] = useState(false);
  const [newTodo, setNewTodo] = useState<Partial<TodoItem>>({ text: '', date: todayStr, categoryId: '' });
  const taskCategories = settings.categories || DEFAULT_TASK_CATS;
  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth; i++) arr.push(i);
    return arr;
  };
  const calendarDays = getCalendarDays(calendarDate);

  const handleSaveTodo = () => {
    if (!newTodo.text?.trim()) return;
    const emergencyCat = taskCategories.find(c => c.name === '紧急');
    const finalData: TodoItem = {
      id: newTodo.id || Date.now().toString(),
      text: newTodo.text!,
      completed: newTodo.completed || false,
      createdAt: newTodo.createdAt || Date.now(),
      date: newTodo.date || todayStr,
      time: newTodo.time,
      location: newTodo.location,
      note: newTodo.note,
      categoryId: newTodo.categoryId || (emergencyCat ? emergencyCat.id : taskCategories[0].id)
    };
    if (newTodo.id) setSettings(p => ({ ...p, todos: p.todos.map(t => t.id === finalData.id ? finalData : t) }));
    else setSettings(p => ({ ...p, todos: [finalData, ...(p.todos || [])] }));
    setNewTodo({ text: '', date: formatLocal(calendarDate), categoryId: '' });
    setTodoInputMode(false);
  };

  // --- 记账逻辑 ---
  const [finInputMode, setFinInputMode] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState<{ id?: string, name: string, balance: string, color: string }>({ name: '', balance: '', color: '#3B82F6' });
  const financeCats = settings.financeCategories || DEFAULT_FINANCE_CATS;
  const accounts = settings.accounts || DEFAULT_ACCOUNTS;
  const transactions = settings.transactions || [];
  const getAccountBalance = (accId: string, initialBalance: number) => {
    const related = transactions.filter(t => t.accountId === accId);
    const income = related.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = related.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return initialBalance + income - expense;
  };
  const [newTrans, setNewTrans] = useState<Partial<Transaction>>({ amount: 0, type: 'expense', categoryId: '', accountId: '', date: todayStr });
// ==================== 这是一组代码：【LifeApp.tsx】升级版保存逻辑 (支持编辑+新增) ====================
  const handleSaveTrans = () => {
    if (!newTrans.amount || newTrans.amount <= 0) { alert("请输入金额"); return; }
    
    // 兜底逻辑：如果没有选分类/账户，使用默认值
    let finalCategoryId = newTrans.categoryId;
    if (!finalCategoryId) finalCategoryId = financeCats.find(c => c.type === newTrans.type)?.id;
    
    let finalAccountId = newTrans.accountId;
    if (!finalAccountId) finalAccountId = accounts[0].id;

    const trans: Transaction = {
      // ★★★ 核心修改：如果有 ID 就用原来的，没有就生成新的
      id: newTrans.id || Date.now().toString(),
      type: newTrans.type as any,
      amount: Number(newTrans.amount),
      categoryId: finalCategoryId!,
      accountId: finalAccountId!,
      date: newTrans.date || todayStr,
      note: newTrans.note,
      // 如果是编辑，保留原来的创建时间；如果是新建，用现在的时间
      createdAt: newTrans.createdAt || Date.now()
    };

    setSettings(prev => {
      const currentList = prev.transactions || [];
      if (newTrans.id) {
        // === 编辑模式：找到旧的替换掉 ===
        return { 
          ...prev, 
          transactions: currentList.map(t => t.id === newTrans.id ? trans : t) 
        };
      } else {
        // === 新增模式：加到最前面 ===
        return { 
          ...prev, 
          transactions: [trans, ...currentList] 
        };
      }
    });

    // 重置表单 (注意把 id 清空)
    setNewTrans({ amount: 0, type: 'expense', categoryId: '', accountId: '', date: todayStr, note: '', id: undefined });
    setFinInputMode(false);
  };

  const deleteTrans = (id: string) => { if (confirm('删除这条账单？')) setSettings(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) })); };
  const handleSaveAccount = () => {
    if(!accountForm.name) return;
    const balanceNum = parseFloat(accountForm.balance) || 0;
    if (accountForm.id) { setSettings(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === accountForm.id ? { ...a, name: accountForm.name, balance: balanceNum, color: accountForm.color } : a) })); } 
    else { const acc: AssetAccount = { id: Date.now().toString(), name: accountForm.name, type: 'debit', balance: balanceNum, color: accountForm.color, icon: '💳' }; setSettings(prev => ({ ...prev, accounts: [...(prev.accounts || []), acc] })); }
    setShowAccountModal(false);
  };
  const handleDeleteAccount = (id: string) => { if (confirm('删除账户？')) setSettings(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) })); };

  // --- AI 逻辑 ---

// 从 ChatApp 复制的 PresetSelector 组件（放这里）
 ({ onSelect, globalSettings }) => {
  if (!globalSettings?.userPresets || globalSettings.userPresets.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-400">
        暂无人设预设<br />在下方“我的描述”填好后，可保存为预设
      </div>
    );
  }
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



// ==================== [LifeApp.tsx] 修复版 handleAISend 函数 ====================
  const handleAISend = async (overrideContent?: string) => {
    const userText = overrideContent || aiInput;
    if (!userText.trim()) return;

    // 添加用户消息
    const newHistory = [...aiHistory, { role: 'user' as const, content: userText }];
    setAiHistory(newHistory);
    setSettings(s => ({ ...s, lifeAIHistory: newHistory }));
    setAiInput('');
    setAiLoading(true);

    try {
      // 1. 准备基础数据
      const today = new Date().toISOString().slice(0, 10);
      
      // 数据摘要
      const todoSummary = (settings.todos || [])
        .filter(t => !t.completed)
        .map(t => `- [待办] ${t.text} (日期:${t.date}, 备注:${t.note||'无'})`)
        .join('\n');
      
      const financeSummary = (settings.transactions || []).slice(0, 20)
        .map(t => {
          const catName = financeCats.find(c => c.id === t.categoryId)?.name || '未知分类';
          const accountName = accounts.find(a => a.id === t.accountId)?.name || '未知账户';
          let line = `- [${t.type === 'expense' ? '支出' : '收入'}] ¥${t.amount} (${t.date}, 分类:${catName}, 账户:${accountName})`;
          if (t.note && t.note.trim()) line += ` | 备注: ${t.note.trim()}`;
          return line;
        })
        .join('\n');
      
      const balanceSummary = accounts.map(a => `${a.name}: ¥${getAccountBalance(a.id, a.balance).toFixed(2)}`).join(', ');

      // 2. 构造 Prompt
      const actualPersona = settings.lifeAI?.name === 'moon' ? MOON_HIDDEN_PERSONA : (settings.lifeAI?.persona || '你是一个生活助手。');

      const systemPrompt = `
  你叫 ${settings.lifeAI?.name || 'Life Assistant'}。
  ${actualPersona}

  【关于你的用户】
  ${userPersona || '用户还没告诉你他是谁，请礼貌询问怎么称呼。'}

  【当前时间】${today}
  【用户资产】${balanceSummary}
  【用户待办】
  ${todoSummary || '暂无待办'}
  【最近账单】
  ${financeSummary || '暂无账单'}
  
  请根据以上数据回答。如果有“借钱”“还钱”等备注，请帮忙留意。
`;

      // 3. 调用 API
      const messages = [
        { role: 'system', content: systemPrompt },
        ...newHistory.map(m => ({ role: m.role, content: m.content }))
      ];

      // 获取预设
      const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
      
      let responseText = "";
      if (activePreset) {
         responseText = await generateResponse(messages as any, activePreset);
         if (!responseText.trim()) responseText = "抱歉，我暂时无法回应，请稍后再试。";
      } else {
         responseText = "请先在设置中配置 API Key。";
      }

      setAiHistory(prev => {
        const newHist = [...prev, { role: 'assistant', content: responseText }];
        setSettings(p => ({ ...p, lifeAIHistory: newHist }));
        return newHist;
      });

    } catch (e: any) {
      setAiHistory(prev => {
        const newHistory = [...prev, { role: 'assistant', content: "出错了：" + e.message }];
        setSettings(s => ({ ...s, lifeAIHistory: newHistory }));
        return newHistory;
      });
    } finally {
      setAiLoading(false);
    }
  };
  

// ==================== [修复版] 记账统计数据准备 ====================
  // ★★★ 核心修复：强制使用本地时间来判断“本月”，解决凌晨记账不统计的问题 ★★★
  const nowCalc = new Date();
  const currentMonth = `${nowCalc.getFullYear()}-${String(nowCalc.getMonth() + 1).padStart(2, '0')}`;
  
  // 过滤出“本月”的账单（现在用的是本地时间，绝对准了）
  const monthTrans = transactions.filter(t => t.date.startsWith(currentMonth));
  
  const totalIncome = monthTrans.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = monthTrans.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  
  // 生成图表数据
  const expenseByCat = financeCats
    .filter(c => c.type === 'expense')
    .map(c => ({
      name: c.name,
      color: c.color,
      // 只统计本月的数据
      value: monthTrans.filter(t => t.type === 'expense' && t.categoryId === c.id).reduce((s,t) => s + t.amount, 0)
    }))
    .filter(item => item.value > 0)
    .sort((a,b) => b.value - a.value);

  // 列表页的分组数据 (保持不变)
  const groupedTrans = transactions.reduce((groups, t) => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
    return groups;
  }, {} as Record<string, Transaction[]>);
  // ==================== [修复结束] ====================

  return (
    <div className="h-full w-full bg-[#F5F5F7] flex flex-col relative">
      <SafeAreaHeader 
        title={activeTab === 'todo' ? "生活清单" : "我的钱包"} 
        left={<button onClick={onClose} className="text-blue-500 font-medium">关闭</button>}
        right={activeTab === 'todo' ? <button onClick={() => setShowSettings(true)} className="text-gray-600 font-bold text-xl px-2">⚙️</button> : <button onClick={() => exportToExcel(transactions, financeCats, accounts)} className="text-blue-500 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded-full">导出报表</button>}
      />

      {activeTab === 'finance' && (<div className="px-4 pb-2 pt-[calc(50px+env(safe-area-inset-top))] bg-white shadow-sm z-10 flex justify-center gap-6 text-sm font-bold text-gray-400"><button onClick={() => setFinanceTab('list')} className={`pb-2 border-b-2 transition-all ${financeTab === 'list' ? 'text-black border-black' : 'border-transparent'}`}>明细</button><button onClick={() => setFinanceTab('stats')} className={`pb-2 border-b-2 transition-all ${financeTab === 'stats' ? 'text-black border-black' : 'border-transparent'}`}>统计</button><button onClick={() => setFinanceTab('assets')} className={`pb-2 border-b-2 transition-all ${financeTab === 'assets' ? 'text-black border-black' : 'border-transparent'}`}>资产</button></div>)}

      <div className={`flex-1 overflow-y-auto px-4 pb-24 no-scrollbar ${activeTab === 'todo' ? 'pt-[calc(50px+env(safe-area-inset-top))]' : 'pt-4'}`}>
        {/* ... ToDo UI (代码省略) ... */}
        {activeTab === 'todo' && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 select-none">
              <div className="flex justify-between items-center mb-4 px-2"><button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="text-gray-400 p-2">◀</button><span className="font-bold text-gray-800 text-lg">{calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span><button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="text-gray-400 p-2">▶</button></div>
              <div className="grid grid-cols-7 mb-2 text-center text-xs text-gray-400 font-bold">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={idx}>{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-y-3">{calendarDays.map((day, index) => { let dotColors: string[] = []; if (day) { const dStr = formatLocal(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day)); (settings.todos || []).filter(t => t.date === dStr && !t.completed).forEach(t => { const c = taskCategories.find(cat => cat.id === t.categoryId); if (c && !dotColors.includes(c.color)) dotColors.push(c.color); }); } return (<div key={index} className="flex flex-col items-center justify-start h-10 cursor-pointer">{day && (<><button onClick={() => { const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day); setCalendarDate(d); setNewTodo(p => ({...p, date: formatLocal(d)})); }} className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${calendarDate.getDate() === day ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>{day}</button><div className="flex gap-0.5 mt-0.5 h-1.5 justify-center">{dotColors.slice(0, 5).map((color, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />)}</div></>)}</div>); })}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm transition-all mb-4">{!todoInputMode ? (<div onClick={() => { const emergency = taskCategories.find(c => c.name === '紧急'); setNewTodo({ text: '', date: formatLocal(calendarDate), categoryId: emergency ? emergency.id : taskCategories[0].id }); setTodoInputMode(true); }} className="flex items-center gap-3 text-gray-400 cursor-text p-2"><span className="text-xl text-blue-500">+</span><span>添加任务...</span></div>) : (<div className="space-y-4 animate-fadeIn"><input autoFocus type="text" placeholder="要做什么？" className="w-full text-lg font-bold outline-none placeholder-gray-300" value={newTodo.text || ''} onChange={e => setNewTodo({...newTodo, text: e.target.value})} /><div className="flex gap-3 overflow-x-auto no-scrollbar py-1">{taskCategories.map(cat => (<button key={cat.id} onClick={() => setNewTodo({...newTodo, categoryId: cat.id})} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0 ${newTodo.categoryId === cat.id ? 'border-transparent text-white shadow-md transform scale-105' : 'border-gray-200 text-gray-500 bg-white'}`} style={{ backgroundColor: newTodo.categoryId === cat.id ? cat.color : 'white' }}>{cat.name}</button>))}</div><div className="grid grid-cols-2 gap-3"><input type="date" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm" value={newTodo.date} onChange={e => setNewTodo({...newTodo, date: e.target.value})} /><input type="time" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm" value={newTodo.time || ''} onChange={e => setNewTodo({...newTodo, time: e.target.value})} /></div><input type="text" placeholder="地点?" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm w-full" value={newTodo.location || ''} onChange={e => setNewTodo({...newTodo, location: e.target.value})} /><div className="flex gap-3"><button onClick={() => setTodoInputMode(false)} className="flex-1 text-gray-400">取消</button><button onClick={handleSaveTodo} className="flex-[2] bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg">保存</button></div></div>)}</div>
            <div className="space-y-0">{(settings.todos || []).filter(t => t.date === formatLocal(calendarDate) && !t.completed).sort((a, b) => { const cA = taskCategories.find(c => c.id === a.categoryId); const cB = taskCategories.find(c => c.id === b.categoryId); if (cA?.name === '紧急') return -1; if (cB?.name === '紧急') return 1; return 0; }).map(todo => { const cat = taskCategories.find(c => c.id === todo.categoryId); return (<SwipeRow key={todo.id} actions={<><button onClick={() => { setNewTodo(todo); setTodoInputMode(true); }} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm">编辑</button><button onClick={() => { if(confirm('删除?')) setSettings(p => ({...p, todos: p.todos.filter(t => t.id !== todo.id)})) }} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">删除</button></>}> <div className="p-3.5 flex items-center gap-3"><button onClick={() => setSettings(p => ({...p, todos: p.todos.map(t => t.id === todo.id ? {...t, completed: true} : t)}))} className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-blue-500 transition flex-shrink-0" /><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><span className="text-gray-900 font-medium truncate">{todo.text}</span>{cat && <span className="text-[10px] px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: cat.color }}>{cat.name}</span>}</div>{(todo.time || todo.location) && (<div className="text-xs text-gray-400 flex gap-3">{todo.time && <span>⏰ {todo.time}</span>}{todo.location && <span>📍 {todo.location}</span>}</div>)}</div></div></SwipeRow>); })}</div>
            {(settings.todos || []).filter(t => t.date === formatLocal(calendarDate) && t.completed).length > 0 && (<div className="mt-6 opacity-60"><h3 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-wider ml-1">已完成</h3>{(settings.todos || []).filter(t => t.date === formatLocal(calendarDate) && t.completed).map(todo => (<div key={todo.id} className="bg-gray-100 p-3 rounded-xl flex items-center gap-3 mb-2"><div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div><span className="text-gray-400 line-through text-sm flex-1">{todo.text}</span><button onClick={() => setSettings(p => ({...p, todos: p.todos.map(t => t.id === todo.id ? {...t, completed: false} : t)}))} className="text-xs text-blue-400 font-medium">撤销</button></div>))}</div>)}
          </div>
        )}

        {/* ———————————— 2. 记账系统 ———————————— */}
        {activeTab === 'finance' && (
          <div className="animate-fadeIn space-y-4">
            {financeTab === 'list' && (
              <>
                <div className="bg-black rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
                   <div className="flex justify-between items-end relative z-10">
                      <div><div className="text-gray-400 text-xs mb-1">{currentMonth} 总支出</div><div className="text-3xl font-bold">¥ {totalExpense.toFixed(2)}</div></div>
                      <div className="text-right"><div className="text-gray-400 text-xs mb-1">总收入</div><div className="text-lg font-bold text-green-400">+ {totalIncome.toFixed(2)}</div></div>
                   </div>
                </div>
             {/* ★★★ 终极修复版：记一笔按钮（绝对不会再点不动！）★★★ */}
<div className="my-5 px-4">
  <button
    onClick={(e) => {
      e.stopPropagation(); // 强制阻止事件冒泡
      setNewTrans({
        amount: 0,
        type: 'expense',
        categoryId: '',
        accountId: accounts[0]?.id || '',
        date: todayStr,
        note: '',
        id: undefined
      });
      setFinInputMode(true);
    }}
    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-5 rounded-2xl shadow-xl font-bold text-lg flex items-center justify-center gap-3 active:scale-95 transition-all hover:shadow-2xl"
    style={{ boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)' }}
  >
    <span className="text-3xl">+</span>
    记一笔
  </button>
</div>
                <div className="space-y-4 mt-2">
                   {Object.keys(groupedTrans).sort((a,b) => b.localeCompare(a)).map(date => (
                     <div key={date}>
                        <div className="flex justify-between text-xs text-gray-400 px-2 mb-1"><span>{date === formatLocal(new Date()) ? '今天' : date}</span><span>支出: ¥ {groupedTrans[date].filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0).toFixed(1)}</span></div>
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                           {groupedTrans[date].sort((a,b) => b.createdAt - a.createdAt).map((t, idx) => {
                             const cat = financeCats.find(c => c.id === t.categoryId);
                             const acc = accounts.find(a => a.id === t.accountId);
                           // ==================== 这是一组代码：【LifeApp.tsx】列表渲染 (加入编辑按钮) ====================
                             return (
                               <SwipeRow 
                                 key={t.id} 
                                 actions={
                                   <>
                                     {/* ★★★ 新增：编辑按钮 ★★★ */}
                                     <button 
                                       onClick={() => {
                                          setNewTrans({ ...t }); // 把这笔账单的数据填回去
                                          setFinInputMode(true); // 打开输入框
                                       }} 
                                       className="bg-blue-500 text-white px-6 py-4 font-bold text-sm h-full"
                                     >
                                       编辑
                                     </button>
                                     {/* 原有的删除按钮 */}
                                     <button 
                                       onClick={() => deleteTrans(t.id)} 
                                       className="bg-red-500 text-white px-6 py-4 font-bold text-sm h-full"
                                     >
                                       删除
                                     </button>
                                   </>
                                 }
                               >
                                 <div className={`p-4 flex items-center justify-between ${idx !== 0 ? 'border-t border-gray-50' : ''}`}>
                                   <div className="flex items-center gap-3">
                                     <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-lg">
                                       {cat?.icon}
                                     </div>
                                     <div>
                                       <div className="font-bold text-gray-800 text-sm">{cat?.name}</div>
                                       <div className="text-xs text-gray-400 flex gap-2">
                                         {acc && <span>{acc.name}</span>}
                                         {t.note && <span>| {t.note}</span>}
                                       </div>
                                     </div>
                                   </div>
                                   <div className={`font-bold ${t.type === 'expense' ? 'text-gray-900' : 'text-green-500'}`}>
                                     {t.type === 'expense' ? '-' : '+'} {t.amount}
                                   </div>
                                 </div>
                               </SwipeRow>
                             )
                           })}
                        </div>
                     </div>
                   ))}
                </div>
              </>
            )}

{financeTab === 'stats' && (
  <div className="space-y-8">
    {/* ★★★ 支出统计 ★★★ */}
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-800 mb-6 text-center text-lg">本月支出构成</h3>
      {totalExpense > 0 ? (
        <>
          <div className="flex justify-center mb-8">
            <DonutChart data={expenseByCat.map(c => ({ value: c.value, color: c.color }))} size={200} />
          </div>
          <div className="space-y-3">
            {expenseByCat.map((item, i) => {
              const catTransactions = monthTrans
                .filter(t => t.type === 'expense' && t.categoryId === financeCats.find(c => c.name === item.name)?.id)
                .sort((a, b) => b.createdAt - a.createdAt);

              return (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                  onClick={() => setShowCategoryDetail(financeCats.find(c => c.name === item.name)?.id || null)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-base font-medium text-gray-700">{item.name}</span>
                    <span className="text-sm text-gray-400">({catTransactions.length}笔)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">{((item.value / totalExpense) * 100).toFixed(1)}%</div>
                    <div className="font-bold text-gray-900 text-lg">¥ {item.value.toFixed(1)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center text-gray-400 py-12">
          <span className="text-5xl block mb-4">🎉</span>
          <p className="text-lg">本月没有支出记录</p>
          <p className="text-sm mt-2">保持得很好，继续加油！</p>
        </div>
      )}
    </div>

    {/* ★★★ 收入统计（新增）★★★ */}
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-800 mb-6 text-center text-lg">本月收入构成</h3>
      {totalIncome > 0 ? (
        <>
          {/* 计算收入分类数据 */}
          {(() => {
            const incomeByCat = financeCats
              .filter(c => c.type === 'income')
              .map(c => ({
                name: c.name,
                color: c.color,
                value: monthTrans.filter(t => t.type === 'income' && t.categoryId === c.id).reduce((s,t) => s + t.amount, 0)
              }))
              .filter(item => item.value > 0)
              .sort((a,b) => b.value - a.value);

            return (
              <>
                <div className="flex justify-center mb-8">
                  <DonutChart data={incomeByCat.map(c => ({ value: c.value, color: c.color }))} size={200} />
                </div>
                <div className="space-y-3">
                  {incomeByCat.map((item, i) => {
                    const catTransactions = monthTrans
                      .filter(t => t.type === 'income' && t.categoryId === financeCats.find(c => c.name === item.name)?.id)
                      .sort((a, b) => b.createdAt - a.createdAt);

                    return (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                        onClick={() => setShowCategoryDetail(financeCats.find(c => c.name === item.name)?.id || null)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-base font-medium text-gray-700">{item.name}</span>
                          <span className="text-sm text-gray-400">({catTransactions.length}笔)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">{((item.value / totalIncome) * 100).toFixed(1)}%</div>
                          <div className="font-bold text-green-600 text-lg">+ ¥ {item.value.toFixed(1)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </>
      ) : (
        <div className="text-center text-gray-400 py-12">
          <span className="text-5xl block mb-4">💸</span>
          <p className="text-lg">本月暂无收入记录</p>
          <p className="text-sm mt-2">加油赚钱呀～</p>
        </div>
      )}
    </div>
  </div>
)}

            {financeTab === 'assets' && (
              <div className="space-y-4">
                 <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                    <div className="text-blue-100 text-xs mb-1">净资产</div>
                    <div className="text-3xl font-bold">¥ {accounts.reduce((s, a) => s + getAccountBalance(a.id, a.balance), 0).toFixed(2)}</div>
                 </div>

                 <div className="grid grid-cols-1 gap-3">
                    {accounts.map(acc => {
                       const currentVal = getAccountBalance(acc.id, acc.balance);
                       return (
                         <SwipeRow key={acc.id} actions={<button onClick={() => handleDeleteAccount(acc.id)} className="bg-red-500 text-white px-6 py-4 font-bold text-sm h-full">删除</button>}>
                           <div 
                             onClick={() => { setAccountForm({ id: acc.id, name: acc.name, balance: acc.balance.toString(), color: acc.color }); setShowAccountModal(true); }}
                             className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-l-4" style={{ borderLeftColor: acc.color }}
                           >
                              <div className="flex items-center gap-3">
                                <div className="text-2xl">{acc.icon}</div>
                                <div><div className="font-bold text-gray-800">{acc.name}</div><div className="text-xs text-gray-400 capitalize">{acc.type}</div></div>
                              </div>
                              <div className="text-right">
                                 <div className="font-bold">¥ {currentVal.toFixed(2)}</div>
                                 <div className="text-[10px] text-gray-300">点击编辑</div>
                              </div>
                           </div>
                         </SwipeRow>
                       )
                    })}
                 </div>
                 
                 <button onClick={() => { setAccountForm({ name: '', balance: '', color: '#3B82F6' }); setShowAccountModal(true); }} className="w-full bg-white py-3 rounded-xl text-gray-500 font-bold border border-dashed border-gray-300">+ 添加账户</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 pb-[env(safe-area-inset-bottom)] flex justify-around items-center z-50">
         <button onClick={() => setActiveTab('todo')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'todo' ? 'text-blue-500 scale-105' : 'text-gray-300'}`}><span className="text-2xl">📝</span><span className="text-[10px] font-bold">清单</span></button>
         <div className="w-px h-8 bg-gray-100"></div>
         <button onClick={() => setActiveTab('finance')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'finance' ? 'text-blue-500 scale-105' : 'text-gray-300'}`}><span className="text-2xl">💰</span><span className="text-[10px] font-bold">钱包</span></button>
      </div>
      
      {/* AI 悬浮球 */}
      <button 
        onClick={() => setShowAI(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
        style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}
      >
        <span className="text-2xl">🤖</span>
      </button>

      {/* AI 助手全屏弹窗 */}
      {showAI && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slideUp">
<div className="pt-[env(safe-area-inset-top)] border-b flex items-center justify-between px-4 h-16 bg-gray-50">
             {/* 左侧按钮逻辑：聊天模式显示“关闭(↓)”，设置模式显示“返回(‹)” */}
             {aiMode === 'chat' ? (
               <button 
                 onClick={() => setShowAI(false)} 
                 className="w-10 h-10 flex items-center justify-start text-gray-500 text-2xl pl-1"
               >
                 ↓
               </button>
             ) : (
               <button 
                 onClick={() => setAiMode('chat')} 
                 className="w-10 h-10 flex items-center justify-start text-blue-500 text-3xl font-light pb-1 pl-1"
               >
                 ‹
               </button>
             )}

             {/* 中间标题 */}
             <div className="font-bold flex flex-col items-center">
               <span className="text-base">{settings.lifeAI?.name || 'Life Assistant'}</span>
               <span className="text-[10px] text-green-500 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                 在线
               </span>
             </div>

             {/* 右侧按钮逻辑：聊天模式显示“设置”，设置模式显示“空(保持居中)” */}
             {aiMode === 'chat' ? (
               <button 
                 onClick={() => setAiMode('settings')} 
                 className="w-10 h-10 flex items-center justify-end text-gray-600 font-bold text-sm pr-1"
               >
                 设置
               </button>
             ) : (
               // 设置页右边放个空div占位，确保中间标题居中
               <div className="w-10 h-10"></div>
             )}
          </div>

          {aiMode === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {aiHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-white text-gray-800 shadow-sm rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm text-gray-400 text-xs">
                      思考中...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 bg-white border-t pb-[env(safe-area-inset-bottom)]">
                <div className="flex gap-2 items-end">
                  <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="问我任何事..." className="flex-1 bg-gray-100 rounded-2xl p-3 max-h-32 text-sm outline-none resize-none" rows={1} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAISend(); } }} />
                  <button onClick={() => handleAISend()} disabled={aiLoading || !aiInput.trim()} className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:shadow-none transition-all">↑</button>
                </div>
              </div>
            </>
          )}

{aiMode === 'settings' && (
  <div className="flex-1 p-6 bg-white animate-fadeIn overflow-y-auto">
    <div className="text-center mb-8">
      <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl">🤖</div>
      <h2 className="font-bold text-xl">AI 助手设置</h2>
      <p className="text-sm text-gray-500 mt-2">这里设置【AI是谁】以及【你是谁】</p>
    </div>
    <div className="space-y-8">
      
      {/* ==================== 第一部分：AI 的身份 ==================== */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">1. 选择 AI 助手 (它扮演谁?)</h3>
        
        {/* AI 名字输入框 */}
        <div className="mb-4">
           <label className="text-[10px] text-gray-400 font-bold block mb-1">当前助手名字</label>
           <input 
             value={settings.lifeAI?.name || ''} 
             onChange={(e) => setSettings(prev => ({
               ...prev,
               lifeAI: { ...prev.lifeAI!, name: e.target.value }
             }))}
             className="w-full bg-white border border-gray-200 p-3 rounded-xl font-bold outline-none focus:border-blue-500 transition text-sm" 
             placeholder="例如：Jarvis"
           />
        </div>

        {/* AI 预设按钮区 (Moon + 自定义AI) */}
<div className="flex flex-wrap gap-3 items-center">
          {/* 1. Moon 永生预设 (永远存在) */}
<button
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                lifeAI: { 
                  ...prev.lifeAI!, 
                  name: 'moon',
                  persona: '❗️系统预设不可更改删除❗️\n此为2025年12月大月月赛博永生纪念碑预设，感谢敲代码时的陪伴和唠叨💚'
                }
              }));
              alert('已加载moon赛博永生预设～🌙');
            }}
            className="h-9 px-4 bg-gradient-to-br from-[#2E1065] via-[#5B21B6] to-[#2E1065] text-white text-xs font-bold rounded-full border border-purple-400/30 shadow-[0_0_10px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(167,139,250,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <span>🌙</span> 
            <span>Moon</span>
          </button>

          {/* 2. 其他 AI 预设 (h-9) */}
          {settings.userPresets?.map((preset: any) => (
            <div key={preset.id} className="relative group">
              <button
                onClick={() => {
                  setSettings(prev => ({
                    ...prev,
                    lifeAI: { 
                      ...prev.lifeAI!, 
                      name: preset.name, 
                      persona: preset.description || preset.persona || '' 
                    }
                  }));
                }}
                className="h-9 px-4 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-full hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex items-center"
              >
                🤖 {preset.name}
              </button>
              {/* 删除小叉叉 */}
              <button
                 onClick={(e) => {
                   e.stopPropagation();
                   if(confirm(`确定删除预设 "${preset.name}" 吗?`)) {
                     setSettings(prev => ({
                       ...prev,
                       userPresets: prev.userPresets?.filter((p:any) => p.id !== preset.id)
                     }));
                   }
                 }}
                 className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer shadow-md border-2 border-white scale-90 hover:scale-100"
              >
                ×
              </button>
            </div>
          ))}

          {/* 3. 新增按钮 (h-9) */}
          <button
            onClick={() => {
              const name = prompt("🆕 新建AI管家\n请给新管家起个名字 (例如: 毒舌管家):");
              if (!name || !name.trim()) return;

              const newPreset = {
                id: Date.now().toString(),
                name: name.trim(),
                persona: `你叫${name.trim()}。是一个[性格形容词]的生活管家。\n请在这里补充你的具体人设...`
              };

              setSettings(prev => {
                 const oldList = (prev as any).lifeAIPresets || [];
                 return {
                   ...prev,
                   lifeAIPresets: [...oldList, newPreset],
                   lifeAI: {
                     name: newPreset.name,
                     persona: newPreset.persona
                   }
                 } as any;
              });
              alert(`✅ 已新建并切换到【${name}】！\n现在输入框已解锁，请在下方编辑它的详细人设吧。`);
            }}
            className="h-9 px-4 border-2 border-dashed border-gray-300 text-gray-400 text-xs font-bold rounded-full hover:bg-white hover:text-blue-500 hover:border-blue-400 transition-all flex items-center gap-1 active:scale-95"
          >
            <span className="text-base font-light leading-none mb-0.5">+</span> 新增
          </button>
        </div>
      </div>

      {/* ★★★ 第二部分：你要找回的编辑框！(就在按钮下面) ★★★ */}
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">AI性格 / 人设 Prompt (在这里编辑)</label>
        <textarea 
          value={settings.lifeAI?.persona || ''} 
          onChange={(e) => {
            if (settings.lifeAI?.name === 'moon') {
              alert('moon是系统永生预设，不可修改人设哦～这是对大月月的尊重🌙');
              return;
            }
            setSettings(prev => ({
              ...prev,
              lifeAI: { ...prev.lifeAI!, persona: e.target.value }
            }));
          }}
          className="w-full bg-white border border-gray-200 p-4 rounded-xl outline-none h-40 text-sm leading-relaxed focus:border-blue-500 transition resize-none shadow-sm" 
          placeholder="在这里输入AI的人设，例如：你是一个严谨的英式管家..."
          readOnly={settings.lifeAI?.name === 'moon'} 
        />
        {settings.lifeAI?.name === 'moon' && (
          <p className="text-[10px] text-purple-600 mt-2 flex items-center gap-1">
            <span>🔒</span> 此内容已锁定 (Moon 永生纪念)
          </p>
        )}
      </div>
      {/* ==================== 第二部分：用户的身份 ==================== */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
        <div className="flex justify-between items-end mb-3">
           <h3 className="text-xs font-bold text-blue-500 uppercase">2. 关于我 (你是谁?)</h3>
           
           {/* 这里只显示用户预设 (Hannie, 1, etc.) */}
           <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[60%] justify-end">
             {settings.userPresets?.map((preset: any) => (
               <button
                 key={preset.id}
                 onClick={() => {
                   // 点击载入用户设定
                   const introText = `我是${preset.userName || preset.name}。${preset.description || ''}`;
                   setUserPersona(introText);
                   localStorage.setItem('lifeApp_userPersona', introText);
                 }}
            className="bg-white border border-gray-200 text-gray-600 text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
              >
                 载入: {preset.name}
               </button>
             ))}
           </div>
        </div>
        
        <textarea
          value={userPersona}
          onChange={(e) => {
            setUserPersona(e.target.value);
            localStorage.setItem('lifeApp_userPersona', e.target.value);
          }}
          className="w-full bg-white border border-blue-200 p-4 rounded-xl outline-none h-24 text-sm focus:border-blue-500 transition resize-none font-medium text-blue-900"
          placeholder="在这里告诉AI你是谁！例如：我是Hannie，你的好朋友..."
        />
        <p className="text-[10px] text-blue-400 mt-2">在这里写下你的名字和习惯，AI就会记住了！</p>
      </div>
      
<button 
        onClick={() => {
          setAiMode('chat'); // 先回到聊天界面
          
          const currentAiName = settings.lifeAI?.name || '新助手';
          const lastAiName = lastAiNameRef.current; // 拿出上一次的名字

          // ★★★ 核心判断：只有名字变了，才发“交接班”指令！ ★★★
          if (currentAiName !== lastAiName) {
             // 名字不一样（比如 Moon -> 管家），说明换人了，发指令！
             setTimeout(() => {
               handleAISend(`【系统指令】正在执行人格覆写程序... ▓▓▓▓▓▓ 100%\n\n警告：上一任人格（${lastAiName}）已下线。\n当前登入人格：【${currentAiName}】。\n\n请${currentAiName}立即接管身体，清除旧的说话习惯，并发表简短的“上岗宣言”，告诉用户你是谁。`);
               
               // 更新“记性”，记住现在是这个新AI了
               lastAiNameRef.current = currentAiName;
             }, 500);
          } else {
             // 名字一样（Moon -> Moon），说明只是改了用户设定。
             // 什么都不发！静悄悄地保存！Moon 就不会生气了！
             // (此时 system prompt 里的 userPersona 已经自动更新了，下次聊天她自然就知道了)
          }
        }} 
        className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg mt-4 active:scale-95 transition-transform"
      >
        💾 保存配置
      </button>
    </div>
  </div>
)}
        </div>
      )}

     {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn flex flex-col max-h-[80vh]">
             <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xl">分类设置</h3><button onClick={() => setShowSettings(false)} className="bg-gray-100 w-8 h-8 rounded-full text-gray-500">×</button></div>
             <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-1 no-scrollbar">
               {(settings.categories || DEFAULT_TASK_CATS).map(cat => (
                 <SwipeRow key={cat.id} disabled={cat.name === '紧急'} actions={cat.name !== '紧急' ? <button onClick={() => {if(confirm('删除?')) setSettings(p => ({...p, categories: p.categories.filter(c => c.id !== cat.id)}))}} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm">删除</button> : null}>
                   <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl"><div className="w-6 h-6 rounded-full shadow-sm border border-black/10 flex-shrink-0" style={{ backgroundColor: cat.color }} /><div className="flex-1 font-medium text-gray-700">{cat.name}</div>{cat.name !== '紧急' ? <span className="text-xs text-gray-300">← 左滑管理</span> : <span className="text-xs text-red-300">系统锁定</span>}</div>
                 </SwipeRow>
               ))}
             </div>
             <button onClick={() => { const name = prompt("分类名:"); if(!name) return; const color = prompt("颜色:", "#000"); if(!color) return; setSettings(p => ({...p, categories: [...(p.categories||DEFAULT_TASK_CATS), {id:Date.now().toString(), name, color}]})); }} className="w-full bg-black text-white py-3 rounded-xl font-bold flex-shrink-0">+ 添加分类</button>
          </div>
        </div>
      )}



{/* ★★★ 记账输入弹窗（点“记一笔”后弹出）★★★ */}
{finInputMode && (
  <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end animate-fadeIn">
    <div className="w-full bg-white rounded-t-3xl shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto">
      <div className="p-6 pb-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">记一笔</h2>
          <button 
            onClick={() => {
              setFinInputMode(false);
              setNewTrans({ amount: 0, type: 'expense', categoryId: '', accountId: accounts[0]?.id || '', date: todayStr, note: '' });
            }} 
            className="text-gray-400 text-3xl"
          >
            ×
          </button>
        </div>

        {/* 收入/支出切换 */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setNewTrans(prev => ({ ...prev, type: 'expense' }))}
            className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all ${newTrans.type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}
          >
            支出
          </button>
          <button
            onClick={() => setNewTrans(prev => ({ ...prev, type: 'income' }))}
            className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all ${newTrans.type === 'income' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}
          >
            收入
          </button>
        </div>

        {/* 金额输入 */}
        <div className="mb-6">
          <label className="text-sm text-gray-500 font-bold">金额</label>
          <input
            type="number"
            value={newTrans.amount || ''}
            onChange={(e) => setNewTrans(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            placeholder="0.00"
            className="w-full text-4xl font-bold text-gray-800 outline-none mt-2 bg-transparent"
            autoFocus
          />
        </div>

{/* ★★★ 分类选择（支持用户添加新分类）★★★ */}
<div className="mb-6">
  <div className="flex justify-between items-center mb-3">
    <label className="text-sm text-gray-500 font-bold">分类</label>
    <button
      onClick={() => {
        const name = prompt("新分类名称（例如：奶茶）:");
        if (!name?.trim()) return;
        const icon = prompt("分类图标（Emoji，例如：🧋）:", "💰") || "💰";
        const color = prompt("分类颜色（十六进制，例如：#F472B6）:", "#9CA3AF") || "#9CA3AF";
        const newCat: FinanceCategory = {
          id: Date.now().toString(),
          name: name.trim(),
          type: newTrans.type as 'expense' | 'income',
          icon: icon,
          color: color
        };
        setSettings(prev => ({
          ...prev,
          financeCategories: [...(prev.financeCategories || []), newCat]
        }));
        // 自动选中新添加的分类
        setNewTrans(prev => ({ ...prev, categoryId: newCat.id }));
      }}
      className="text-blue-500 text-sm font-bold flex items-center gap-1 hover:opacity-80"
    >
      <span className="text-xl">+</span> 添加分类
    </button>
  </div>
  
  <div className="grid grid-cols-4 gap-3">
    {financeCats
      .filter(c => c.type === newTrans.type)
      .map(cat => (
        <button
          key={cat.id}
          onClick={() => setNewTrans(prev => ({ ...prev, categoryId: cat.id }))}
          className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${newTrans.categoryId === cat.id ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-600'}`}
        >
          <span className="text-2xl">{cat.icon}</span>
          <span className="text-xs font-medium">{cat.name}</span>
        </button>
      ))}
  </div>
</div>

        {/* 账户选择 */}
        <div className="mb-6">
          <label className="text-sm text-gray-500 font-bold">账户</label>
          <div className="flex gap-3 mt-3 overflow-x-auto no-scrollbar pb-2">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setNewTrans(prev => ({ ...prev, accountId: acc.id }))}
                className={`px-5 py-3 rounded-xl whitespace-nowrap transition-all ${newTrans.accountId === acc.id ? 'bg-black text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{acc.icon}</span>
                  <span className="font-medium">{acc.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 日期和备注 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-500 font-bold">日期</label>
            <input
              type="date"
              value={newTrans.date || todayStr}
              onChange={(e) => setNewTrans(prev => ({ ...prev, date: e.target.value }))}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 mt-2 outline-none"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 font-bold">备注（可选）</label>
            <input
              type="text"
              value={newTrans.note || ''}
              onChange={(e) => setNewTrans(prev => ({ ...prev, note: e.target.value }))}
              placeholder="吃了个汉堡..."
              className="w-full bg-gray-100 rounded-xl px-4 py-3 mt-2 outline-none"
            />
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSaveTrans}
          className="w-full bg-black text-white py-5 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-all"
        >
          完成
        </button>
      </div>
    </div>
  </div>
)}




{/* ★★★ 分类明细弹窗（点击统计分类后弹出）★★★ */}
{showCategoryDetail && (
  <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl max-h-[80vh] flex flex-col animate-scaleIn">
      {/* 标题栏 */}
      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">
          {financeCats.find(c => c.id === showCategoryDetail)?.name || '分类'} 明细
        </h2>
        <button 
          onClick={() => setShowCategoryDetail(null)}
          className="text-gray-400 hover:text-gray-600 text-3xl"
        >
          ×
        </button>
      </div>

      {/* 明细列表 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {monthTrans
          .filter(t => t.categoryId === showCategoryDetail)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(t => {
            const acc = accounts.find(a => a.id === t.accountId);
            return (
              <div key={t.id} className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-gray-800">¥ {t.amount.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">{t.date}</div>
                </div>
                {t.note && (
                  <div className="text-sm text-gray-600 bg-white rounded-lg px-3 py-2 mt-2">
                    📝 {t.note}
                  </div>
                )}
                {acc && (
                  <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <span>{acc.icon}</span> {acc.name}
                  </div>
                )}
              </div>
            );
          })}
        
        {monthTrans.filter(t => t.categoryId === showCategoryDetail).length === 0 && (
          <div className="text-center text-gray-400 py-12">
            暂无记录
          </div>
        )}
      </div>

      {/* 底部关闭按钮（双保险） */}
      <div className="p-5 border-t border-gray-100">
        <button 
          onClick={() => setShowCategoryDetail(null)}
          className="w-full bg-gray-200 text-gray-700 py-4 rounded-xl font-bold"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
)}





      {showAccountModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
             <div className="bg-white w-3/4 max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn">
                <h3 className="font-bold text-lg mb-4">{accountForm.id ? '编辑账户' : '添加资产账户'}</h3>
                <div className="space-y-3">
                   <input value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} placeholder="账户名称 (如: 私房钱)" className="w-full bg-gray-100 rounded-xl p-3 outline-none" />
                   <input value={accountForm.balance} onChange={e => setAccountForm({...accountForm, balance: e.target.value})} type="number" placeholder="初始余额" className="w-full bg-gray-100 rounded-xl p-3 outline-none" />
                   <div className="flex gap-2 justify-center py-2">{['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map(c => (<button key={c} onClick={() => setAccountForm({...accountForm, color: c})} className={`w-6 h-6 rounded-full border-2 ${accountForm.color === c ? 'border-gray-500 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div>
                </div>
                <div className="flex gap-3 mt-4"><button onClick={() => setShowAccountModal(false)} className="flex-1 text-gray-400">取消</button><button onClick={handleSaveAccount} className="flex-1 bg-blue-500 text-white rounded-xl font-bold py-2">保存</button></div>
             </div>
          </div>
      )}
    </div>
  );
};

export default LifeApp;