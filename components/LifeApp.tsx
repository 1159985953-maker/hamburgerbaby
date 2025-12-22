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

  // --- AI 助手状态 ---
  const [showAI, setShowAI] = useState(false); // 是否打开AI浮窗
  const [aiMode, setAiMode] = useState<'chat' | 'settings'>('chat'); // AI界面模式
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
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
  const handleSaveTrans = () => {
    if (!newTrans.amount || newTrans.amount <= 0) { alert("请输入金额"); return; }
    if (!newTrans.categoryId) newTrans.categoryId = financeCats.find(c => c.type === newTrans.type)?.id;
    if (!newTrans.accountId) newTrans.accountId = accounts[0].id;
    const trans: Transaction = {
      id: Date.now().toString(),
      type: newTrans.type as any,
      amount: Number(newTrans.amount),
      categoryId: newTrans.categoryId!,
      accountId: newTrans.accountId!,
      date: newTrans.date || todayStr,
      note: newTrans.note,
      createdAt: Date.now()
    };
    setSettings(prev => ({ ...prev, transactions: [trans, ...(prev.transactions || [])] }));
    setNewTrans({ amount: 0, type: 'expense', categoryId: '', accountId: '', date: todayStr, note: '' });
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
const PresetSelector: React.FC<{ onSelect: (preset: any) => void; globalSettings: GlobalSettings }> = ({ onSelect, globalSettings }) => {
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
      // 1. 整理数据喂给AI
      const activePreset = settings.apiPresets.find(p => p.id === settings.activePresetId);
      const today = new Date().toISOString().slice(0, 10);
      
      // 数据摘要
      const todoSummary = (settings.todos || [])
        .filter(t => !t.completed)
        .map(t => `- [待办] ${t.text} (日期:${t.date}, 备注:${t.note||'无'})`)
        .join('\n');
      
      const financeSummary = transactions.slice(0, 20) // 只取最近20条
        .map(t => `- [${t.type==='expense'?'支出':'收入'}] ¥${t.amount} (${t.date}, 分类:${financeCats.find(c=>c.id===t.categoryId)?.name})`)
        .join('\n');
      
      const balanceSummary = accounts.map(a => `${a.name}: ¥${getAccountBalance(a.id, a.balance).toFixed(2)}`).join(', ');

// 2. 构造 Prompt
const systemPrompt = `
      你叫 ${settings.lifeAI?.name || 'Life Assistant'}。
${settings.lifeAI?.persona || '你是一个生活助手。'}
      【用户人设】${settings.userPersona || '用户是一个善良、支持性的伙伴。'}  // 请根据这个人设，辨别用户的身份和风格，提供个性化建议。
      【当前时间】${today}
      【我的资产状况】${balanceSummary}
      【我的待办事项】
${todoSummary || '暂无待办'}
      【最近20笔账单】
${financeSummary || '暂无账单'}
      请根据以上数据回答用户的问题。如果用户要求分析，请给出具体的建议。回答要简短有力，不要长篇大论。
      `;

      // 3. 调用 API (构造消息数组)
      const messages = [
        { role: 'system', content: systemPrompt },
        ...newHistory.map(m => ({ role: m.role, content: m.content }))
      ];

      // 这里的 generateResponse 需要你的 apiService 支持 system role 或者你手动把 system 拼到第一个 user message 里
      // 为了兼容，这里假设 apiService 会处理，或者我们把 system prompt 拼在前面
      // 如果你的 apiService 比较简单，可以这样：
      // const responseText = await generateResponse([{ role: 'user', content: systemPrompt + "\n\n用户说：" + userText }], activePreset);
      
      // 使用标准调用 (假设 apiService 升级了支持 system，如果没升级，请用上面的注释方案)
      let responseText = "";
      if (activePreset) {
         // 兼容处理：如果没有 system 支持，就硬塞进去
         const finalMessages = [
           { role: 'user', content: systemPrompt + "\n\n用户: " + userText }
         ]; 
         // 如果是连续对话，其实应该传整个 history，这里为了简单演示单轮或伪多轮
         // 更好的做法是把 history 传给 apiService
         responseText = await generateResponse(messages as any, activePreset);
     if (!responseText.trim()) {
  responseText = "抱歉，我暂时无法回应，请稍后再试。";
}
     
        } else {
         responseText = "请先在设置中配置 API Key。";
      }

     // 初始化加载历史


// 更新历史时保存
setAiHistory(prev => {
  const newHist = [...prev, { role: 'assistant', content: responseText }];
  setSettings(p => ({ ...p, lifeAIHistory: newHist }));
  return newHist;
});

    } catch (e: any) {
setAiHistory(prev => {
  const newHistory = [...prev, { role: 'assistant', content: responseText }];
  // 同时保存到全局 settings
  setSettings(s => ({ ...s, lifeAIHistory: newHistory }));
  return newHistory;
});
    } finally {
      setAiLoading(false);
    }
  }; // handleAISend 函数在这里结束

  // --- 记账统计数据准备 ---
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTrans = transactions.filter(t => t.date.startsWith(currentMonth));
  const totalIncome = monthTrans.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = monthTrans.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  
  const expenseByCat = financeCats
    .filter(c => c.type === 'expense')
    .map(c => ({
      name: c.name,
      color: c.color,
      value: monthTrans.filter(t => t.type === 'expense' && t.categoryId === c.id).reduce((s,t) => s + t.amount, 0)
    }))
    .filter(item => item.value > 0)
    .sort((a,b) => b.value - a.value);

  const groupedTrans = transactions.reduce((groups, t) => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
    return groups;
  }, {} as Record<string, Transaction[]>);


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
                <button onClick={() => setFinInputMode(true)} className="w-full bg-white py-3 rounded-xl shadow-sm font-bold text-blue-500 flex items-center justify-center gap-2"><span className="text-xl">+</span> 记一笔</button>
                <div className="space-y-4 mt-2">
                   {Object.keys(groupedTrans).sort((a,b) => b.localeCompare(a)).map(date => (
                     <div key={date}>
                        <div className="flex justify-between text-xs text-gray-400 px-2 mb-1"><span>{date === formatLocal(new Date()) ? '今天' : date}</span><span>支出: ¥ {groupedTrans[date].filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0).toFixed(1)}</span></div>
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                           {groupedTrans[date].sort((a,b) => b.createdAt - a.createdAt).map((t, idx) => {
                             const cat = financeCats.find(c => c.id === t.categoryId);
                             const acc = accounts.find(a => a.id === t.accountId);
                             return (<SwipeRow key={t.id} actions={<button onClick={() => deleteTrans(t.id)} className="bg-red-500 text-white px-6 py-4 font-bold text-sm h-full">删除</button>}>
                                 <div className={`p-4 flex items-center justify-between ${idx !== 0 ? 'border-t border-gray-50' : ''}`}><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-lg">{cat?.icon}</div><div><div className="font-bold text-gray-800 text-sm">{cat?.name}</div><div className="text-xs text-gray-400 flex gap-2">{acc && <span>{acc.name}</span>}{t.note && <span>| {t.note}</span>}</div></div></div><div className={`font-bold ${t.type === 'expense' ? 'text-gray-900' : 'text-green-500'}`}>{t.type === 'expense' ? '-' : '+'} {t.amount}</div></div>
                               </SwipeRow>)
                           })}
                        </div>
                     </div>
                   ))}
                </div>
              </>
            )}

            {financeTab === 'stats' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[400px]">
                 <h3 className="font-bold text-gray-800 mb-6 text-center">{currentMonth} 支出构成</h3>
                 <div className="flex justify-center mb-8"><DonutChart data={expenseByCat.map(c => ({ value: c.value, color: c.color }))} /></div>
                 <div className="space-y-3">{expenseByCat.map((item, i) => (
                     <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-gray-700">{item.name}</span></div><div className="flex items-center gap-4"><span className="text-xs text-gray-400">{((item.value / totalExpense) * 100).toFixed(1)}%</span><span className="font-bold text-gray-900">¥ {item.value.toFixed(1)}</span></div></div>
                   ))}</div>
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
             <button onClick={() => setShowAI(false)} className="w-8 h-8 flex items-center justify-center text-gray-500 text-xl">↓</button>
             <div className="font-bold flex flex-col items-center">
               <span>{settings.lifeAI?.name || 'Life Assistant'}</span>
               <span className="text-[10px] text-green-500">● 在线</span>
             </div>
             <button onClick={() => setAiMode(aiMode==='chat'?'settings':'chat')} className="w-8 h-8 flex items-center justify-center text-gray-500 text-sm">
               {aiMode==='chat' ? '设置' : '对话'}
             </button>
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
            <div className="flex-1 p-6 bg-white animate-fadeIn">
               <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl">🤖</div>
                 <h2 className="font-bold text-xl">AI 助手设置</h2>
               </div>
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-gray-400 uppercase">助手名字</label>
                   <input value={settings.lifeAI?.name} onChange={e => setSettings(p => ({...p, lifeAI: {...p.lifeAI!, name: e.target.value}}))} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold mt-1 outline-none focus:border-blue-500 transition" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-400 uppercase">人设 / 性格 Prompt</label>
                   <PresetSelector globalSettings={settings} onSelect={(p: any) => { if (!p) return; setSettings(prev => ({ ...prev, lifeAI: {...prev.lifeAI, persona: p.description || "" } })); alert(`已加载预设: ${p.name}`); }} />
                   <textarea value={settings.lifeAI?.persona} onChange={e => setSettings(p => ({...p, lifeAI: {...p.lifeAI!, persona: e.target.value}}))} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl mt-1 outline-none h-32 text-sm leading-relaxed focus:border-blue-500 transition" placeholder="例如：你是一个毒舌管家..." />
                   <p className="text-xs text-gray-400 mt-2">在这里定义它的说话风格。</p>
                 </div>
                 <button onClick={() => setAiMode('chat')} className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg mt-4">保存并返回</button>
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