// ==================== src/components/LifeApp.tsx (双系统终极版) ====================
import React, { useState, useEffect, useRef } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings, TodoItem, TaskCategory, Transaction, FinanceCategory } from '../types';

// --- 辅助工具 ---
const formatLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Excel 导出引擎
const exportToExcel = (transactions: Transaction[], categories: FinanceCategory[]) => {
  // 1. 定义表头
  const headers = ["日期", "类型", "分类", "金额", "备注", "创建时间"];
  
  // 2. 转换数据行
  const rows = transactions.map(t => {
    const cat = categories.find(c => c.id === t.categoryId);
    return [
      t.date,
      t.type === 'expense' ? '支出' : '收入',
      cat ? cat.name : '未知',
      t.amount,
      `"${t.note || ''}"`, // 防止备注里有逗号
      new Date(t.createdAt).toLocaleString()
    ].join(",");
  });

  // 3. 组合内容 (加 BOM 头 \uFEFF 防止中文乱码)
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  
  // 4. 创建下载链接
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const fileName = `记账单_${new Date().toISOString().slice(0,10)}.csv`;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface LifeAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
  onOpenDiary: () => void;
}

// 默认 ToDo 分类
const DEFAULT_TASK_CATS: TaskCategory[] = [
  { id: '1', name: '紧急', color: '#EF4444' },
  { id: '2', name: '工作', color: '#3B82F6' },
  { id: '3', name: '生活', color: '#10B981' },
];

// 默认 记账 分类
const DEFAULT_FINANCE_CATS: FinanceCategory[] = [
  { id: 'f1', name: '餐饮', type: 'expense', icon: '🍔', color: '#F87171' },
  { id: 'f2', name: '购物', type: 'expense', icon: '🛍️', color: '#F472B6' },
  { id: 'f3', name: '交通', type: 'expense', icon: '🚗', color: '#60A5FA' },
  { id: 'f4', name: '娱乐', type: 'expense', icon: '🎬', color: '#A78BFA' },
  { id: 'f5', name: '工资', type: 'income', icon: '💰', color: '#34D399' },
  { id: 'f6', name: '理财', type: 'income', icon: '📈', color: '#FBBF24' },
];

// --- 通用左滑组件 ---
const SwipeRow = ({ children, actions, disabled = false }: { children: React.ReactNode; actions: React.ReactNode; disabled?: boolean }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const currentOffset = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;
    const touchX = e.touches[0].clientX;
    const diff = touchX - startX.current;
    if (diff < 0 && diff > -150) {
      currentOffset.current = diff;
      setOffset(diff);
    }
  };

  const onTouchEnd = () => {
    if (disabled) return;
    if (currentOffset.current < -60) {
      setOffset(-130);
      currentOffset.current = -130;
    } else {
      setOffset(0);
      currentOffset.current = 0;
    }
  };

  return (
    <div className="relative overflow-hidden h-auto w-full rounded-2xl mb-2 flex-shrink-0">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end px-2 gap-2 bg-gray-100 rounded-2xl w-full">
        {actions}
      </div>
      <div 
        className="relative bg-white z-10 w-full transition-transform duration-200 ease-out rounded-2xl shadow-sm border border-gray-100"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => offset < 0 && setOffset(0)}
      >
        {children}
      </div>
    </div>
  );
};

const LifeApp: React.FC<LifeAppProps> = ({ settings, setSettings, onClose, onOpenDiary }) => {
  // --- 全局状态 ---
  const [activeTab, setActiveTab] = useState<'todo' | 'finance'>('todo'); // 当前页面
  const [showSettings, setShowSettings] = useState(false); // 通用设置弹窗

  // --- 初始化数据 ---
  useEffect(() => {
    let newSettings = { ...settings };
    let changed = false;
    if (!newSettings.categories || newSettings.categories.length === 0) {
      newSettings.categories = DEFAULT_TASK_CATS;
      changed = true;
    }
    if (!newSettings.financeCategories || newSettings.financeCategories.length === 0) {
      newSettings.financeCategories = DEFAULT_FINANCE_CATS;
      changed = true;
    }
    if (changed) setSettings(newSettings);
  }, []);

  // ==================== 1. ToDo 逻辑区域 ====================
  const [calendarDate, setCalendarDate] = useState(new Date());
  const todayStr = formatLocal(new Date());
  const [todoInputMode, setTodoInputMode] = useState(false);
  const [newTodo, setNewTodo] = useState<Partial<TodoItem>>({ text: '', date: todayStr, categoryId: '' });

  const currentSelectedDateStr = formatLocal(calendarDate);
  const taskCategories = settings.categories || DEFAULT_TASK_CATS;

  // 日历算法
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

  // ToDo 增删改
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

    if (newTodo.id) {
      setSettings(prev => ({ ...prev, todos: prev.todos.map(t => t.id === finalData.id ? finalData : t) }));
    } else {
      setSettings(prev => ({ ...prev, todos: [finalData, ...(prev.todos || [])] }));
    }
    setNewTodo({ text: '', date: currentSelectedDateStr, categoryId: '' });
    setTodoInputMode(false);
  };

  // ==================== 2. 记账逻辑区域 ====================
  const [finInputMode, setFinInputMode] = useState(false);
  const [newTrans, setNewTrans] = useState<{ amount: string; type: 'expense' | 'income'; categoryId: string; note: string; date: string }>({
    amount: '', type: 'expense', categoryId: '', note: '', date: todayStr
  });
  
  const financeCats = settings.financeCategories || DEFAULT_FINANCE_CATS;
  const transactions = settings.transactions || [];

  // 计算资产
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;
  
  // 计算本月收支
  const currentMonthPrefix = todayStr.slice(0, 7); // "2025-12"
  const monthExpense = transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + t.amount, 0);

  const handleSaveTrans = () => {
    if (!newTrans.amount || parseFloat(newTrans.amount) <= 0) return;
    const trans: Transaction = {
      id: Date.now().toString(),
      type: newTrans.type,
      amount: parseFloat(newTrans.amount),
      categoryId: newTrans.categoryId || financeCats.find(c => c.type === newTrans.type)?.id || financeCats[0].id,
      date: newTrans.date,
      note: newTrans.note,
      createdAt: Date.now()
    };
    setSettings(prev => ({ ...prev, transactions: [trans, ...(prev.transactions || [])] }));
    setNewTrans({ amount: '', type: 'expense', categoryId: '', note: '', date: todayStr });
    setFinInputMode(false);
  };

  const deleteTrans = (id: string) => {
    if (confirm('删除这条账单？')) {
      setSettings(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
    }
  };

  // ==================== 渲染 UI ====================
  return (
    <div className="h-full w-full bg-[#F5F5F7] flex flex-col">
      <SafeAreaHeader 
        title={activeTab === 'todo' ? "生活清单" : "财务中心"} 
        left={<button onClick={onClose} className="text-blue-500 font-medium">关闭</button>}
        right={
          activeTab === 'todo' 
            ? <button onClick={() => setShowSettings(true)} className="text-gray-600 font-bold text-xl px-2">⚙️</button>
            : <button onClick={() => exportToExcel(transactions, financeCats)} className="text-blue-500 text-sm font-bold bg-blue-100 px-3 py-1 rounded-full">导出Excel</button>
        }
      />

      {/* 主内容区域 (带 Padding 避开头部和底部) */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 no-scrollbar" style={{ paddingTop: 'calc(50px + env(safe-area-inset-top))' }}>
        
        {/* ———————————— 页面 1: ToDo 清单 ———————————— */}
        {activeTab === 'todo' && (
          <div className="animate-fadeIn">
            {/* 日历 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 select-none">
              <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="text-gray-400 p-2">◀</button>
                <span className="font-bold text-gray-800 text-lg">
                  {calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="text-gray-400 p-2">▶</button>
              </div>
              <div className="grid grid-cols-7 mb-2 text-center text-xs text-gray-400 font-bold">
                {['S','M','T','W','T','F','S'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-3">
                {calendarDays.map((day, index) => {
                   let dotColors: string[] = [];
                   if (day) {
                     const dStr = formatLocal(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day));
                     const tasks = (settings.todos || []).filter(t => t.date === dStr && !t.completed);
                     tasks.forEach(t => {
                       const c = taskCategories.find(cat => cat.id === t.categoryId);
                       if (c && !dotColors.includes(c.color)) dotColors.push(c.color);
                     });
                   }
                   return (
                    <div key={index} className="flex flex-col items-center justify-start h-10 cursor-pointer">
                      {day && (
                        <>
                        <button
                          onClick={() => {
                            const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                            setCalendarDate(d);
                            setNewTodo(prev => ({ ...prev, date: formatLocal(d) }));
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                            ${calendarDate.getDate() === day ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {day}
                        </button>
                        <div className="flex gap-0.5 mt-0.5 h-1.5 justify-center">
                          {dotColors.slice(0, 5).map((color, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />)}
                        </div>
                        </>
                      )}
                    </div>
                   );
                })}
              </div>
            </div>

            {/* ToDo 输入框 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm transition-all mb-4">
              {!todoInputMode ? (
                <div onClick={() => {
                    const emergency = taskCategories.find(c => c.name === '紧急');
                    setNewTodo({ text: '', date: currentSelectedDateStr, categoryId: emergency ? emergency.id : taskCategories[0].id });
                    setTodoInputMode(true);
                  }} 
                  className="flex items-center gap-3 text-gray-400 cursor-text p-2"
                >
                  <span className="text-xl text-blue-500">+</span>
                  <span>添加 {currentSelectedDateStr} 的任务...</span>
                </div>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                   <input autoFocus type="text" placeholder="要做什么？" className="w-full text-lg font-bold outline-none placeholder-gray-300"
                     value={newTodo.text || ''} onChange={e => setNewTodo({...newTodo, text: e.target.value})} />
                   
                   <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                     {taskCategories.map(cat => (
                       <button key={cat.id} onClick={() => setNewTodo({...newTodo, categoryId: cat.id})}
                         className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0
                           ${newTodo.categoryId === cat.id ? 'border-transparent text-white shadow-md transform scale-105' : 'border-gray-200 text-gray-500 bg-white'}`}
                         style={{ backgroundColor: newTodo.categoryId === cat.id ? cat.color : 'white' }}
                       >
                         {cat.name}
                       </button>
                     ))}
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                     <input type="date" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm" value={newTodo.date} onChange={e => setNewTodo({...newTodo, date: e.target.value})} />
                     <input type="time" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm" value={newTodo.time || ''} onChange={e => setNewTodo({...newTodo, time: e.target.value})} />
                   </div>
                   <input type="text" placeholder="地点?" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm w-full" value={newTodo.location || ''} onChange={e => setNewTodo({...newTodo, location: e.target.value})} />
                   <textarea placeholder="备注..." className="w-full bg-gray-100 rounded-xl p-3 text-sm outline-none resize-none h-16" value={newTodo.note || ''} onChange={e => setNewTodo({...newTodo, note: e.target.value})} />
                   
                   <div className="flex gap-3">
                     <button onClick={() => setTodoInputMode(false)} className="flex-1 text-gray-400">取消</button>
                     <button onClick={handleSaveTodo} className="flex-[2] bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg">保存</button>
                   </div>
                </div>
              )}
            </div>

            {/* ToDo 列表 */}
            <div className="space-y-0">
               {(settings.todos || [])
                 .filter(t => t.date === currentSelectedDateStr && !t.completed)
                 .sort((a, b) => {
                    const cA = taskCategories.find(c => c.id === a.categoryId);
                    const cB = taskCategories.find(c => c.id === b.categoryId);
                    if (cA?.name === '紧急') return -1;
                    if (cB?.name === '紧急') return 1;
                    return 0;
                 })
                 .map(todo => {
                   const cat = taskCategories.find(c => c.id === todo.categoryId);
                   return (
                     <SwipeRow key={todo.id} actions={
                       <>
                         <button onClick={() => { setNewTodo(todo); setTodoInputMode(true); }} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm">编辑</button>
                         <button onClick={() => { if(confirm('删除?')) setSettings(p => ({...p, todos: p.todos.filter(t => t.id !== todo.id)})) }} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">删除</button>
                       </>
                     }>
                       <div className="p-3.5 flex items-center gap-3">
                         <button onClick={() => setSettings(p => ({...p, todos: p.todos.map(t => t.id === todo.id ? {...t, completed: true} : t)}))} className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-blue-500 transition flex-shrink-0" />
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-gray-900 font-medium truncate">{todo.text}</span>
                              {cat && <span className="text-[10px] px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: cat.color }}>{cat.name}</span>}
                           </div>
                           {(todo.time || todo.location) && (
                             <div className="text-xs text-gray-400 flex gap-3">
                               {todo.time && <span>⏰ {todo.time}</span>}
                               {todo.location && <span>📍 {todo.location}</span>}
                             </div>
                           )}
                         </div>
                       </div>
                     </SwipeRow>
                   );
                 })}
            </div>

            {/* 已完成 */}
            {(settings.todos || []).filter(t => t.date === currentSelectedDateStr && t.completed).length > 0 && (
              <div className="mt-6 opacity-60">
                <h3 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-wider ml-1">已完成</h3>
                {(settings.todos || []).filter(t => t.date === currentSelectedDateStr && t.completed).map(todo => (
                  <div key={todo.id} className="bg-gray-100 p-3 rounded-xl flex items-center gap-3 mb-2">
                     <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                     <span className="text-gray-400 line-through text-sm flex-1">{todo.text}</span>
                     <button onClick={() => setSettings(p => ({...p, todos: p.todos.map(t => t.id === todo.id ? {...t, completed: false} : t)}))} className="text-xs text-blue-400 font-medium">撤销</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ———————————— 页面 2: 记账系统 ———————————— */}
        {activeTab === 'finance' && (
          <div className="animate-fadeIn">
            
            {/* 资产卡片 */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
               <div className="relative z-10">
                 <div className="text-gray-400 text-sm mb-1">总资产 (CNY)</div>
                 <div className="text-3xl font-bold mb-6 tracking-wide">¥ {balance.toFixed(2)}</div>
                 <div className="flex gap-8">
                   <div>
                     <div className="flex items-center gap-1 text-xs text-gray-400 mb-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> 本月支出</div>
                     <div className="font-bold text-lg">¥ {monthExpense.toFixed(2)}</div>
                   </div>
                   <div>
                     <div className="flex items-center gap-1 text-xs text-gray-400 mb-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> 本月收入</div>
                     <div className="font-bold text-lg">¥ {monthIncome.toFixed(2)}</div>
                   </div>
                 </div>
               </div>
            </div>

            {/* 记账输入框 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm transition-all mb-6">
              {!finInputMode ? (
                 <div onClick={() => setFinInputMode(true)} className="flex items-center gap-3 text-gray-400 cursor-text p-2">
                   <span className="text-xl text-blue-500">💰</span>
                   <span>记一笔...</span>
                 </div>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    {['expense', 'income'].map(type => (
                      <button key={type} onClick={() => setNewTrans({...newTrans, type: type as any})} 
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTrans.type === type ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}>
                        {type === 'expense' ? '支出' : '收入'}
                      </button>
                    ))}
                  </div>
                  
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500 font-bold">¥</span>
                    <input type="number" autoFocus className="w-full bg-gray-50 rounded-xl py-3 pl-8 pr-4 text-xl font-bold outline-none" 
                      placeholder="0.00" value={newTrans.amount} onChange={e => setNewTrans({...newTrans, amount: e.target.value})} />
                  </div>

                  <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                    {financeCats.filter(c => c.type === newTrans.type).map(cat => (
                      <button key={cat.id} onClick={() => setNewTrans({...newTrans, categoryId: cat.id})}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 min-w-[60px]
                          ${newTrans.categoryId === cat.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 text-gray-500'}`}>
                        <span className="text-lg">{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex gap-3">
                     <input type="date" className="bg-gray-50 rounded-xl px-3 py-2 outline-none text-sm" value={newTrans.date} onChange={e => setNewTrans({...newTrans, date: e.target.value})} />
                     <input type="text" placeholder="备注..." className="bg-gray-50 rounded-xl px-3 py-2 outline-none text-sm flex-1" value={newTrans.note} onChange={e => setNewTrans({...newTrans, note: e.target.value})} />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setFinInputMode(false)} className="flex-1 text-gray-400">取消</button>
                    <button onClick={handleSaveTrans} className="flex-[2] bg-black text-white py-3 rounded-xl font-bold shadow-lg">记账</button>
                  </div>
                </div>
              )}
            </div>

            {/* 账单列表 */}
            <div>
              <h3 className="text-gray-500 text-xs font-bold mb-3 uppercase tracking-wider ml-1">最近流水</h3>
              <div className="space-y-0">
                {transactions.length === 0 && <div className="text-center text-gray-300 text-sm py-4">暂无账单</div>}
                {transactions.sort((a,b) => b.createdAt - a.createdAt).map(t => {
                   const cat = financeCats.find(c => c.id === t.categoryId);
                   return (
                     <SwipeRow key={t.id} actions={<button onClick={() => deleteTrans(t.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">删除</button>}>
                       <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${t.type === 'expense' ? 'bg-red-50' : 'bg-green-50'}`}>
                               {cat ? cat.icon : '📄'}
                             </div>
                             <div>
                               <div className="font-bold text-gray-800">{cat ? cat.name : '未知'} <span className="text-xs text-gray-400 font-normal ml-2">{t.date}</span></div>
                               {t.note && <div className="text-xs text-gray-400">{t.note}</div>}
                             </div>
                          </div>
                          <div className={`font-bold text-lg ${t.type === 'expense' ? 'text-gray-900' : 'text-green-500'}`}>
                             {t.type === 'expense' ? '-' : '+'} {t.amount.toFixed(2)}
                          </div>
                       </div>
                     </SwipeRow>
                   );
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ———————————— 底部导航栏 ———————————— */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 pb-[env(safe-area-inset-bottom)] flex justify-around items-center z-50">
         <button onClick={() => setActiveTab('todo')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'todo' ? 'text-blue-500 scale-105' : 'text-gray-300'}`}>
           <span className="text-2xl">📝</span>
           <span className="text-[10px] font-bold">清单</span>
         </button>
         
         <div className="w-px h-8 bg-gray-100"></div>

         <button onClick={() => setActiveTab('finance')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'finance' ? 'text-blue-500 scale-105' : 'text-gray-300'}`}>
           <span className="text-2xl">💰</span>
           <span className="text-[10px] font-bold">记账</span>
         </button>
      </div>

      {/* 设置弹窗 (仅用于 ToDo 分类管理) */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn flex flex-col max-h-[80vh]">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">分类设置</h3>
               <button onClick={() => setShowSettings(false)} className="bg-gray-100 w-8 h-8 rounded-full text-gray-500">×</button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-1 no-scrollbar">
               {(settings.categories || DEFAULT_TASK_CATS).map(cat => (
                 <SwipeRow key={cat.id} disabled={cat.name === '紧急'} actions={cat.name !== '紧急' ? <button onClick={() => {if(confirm('删除?')) setSettings(p => ({...p, categories: p.categories.filter(c => c.id !== cat.id)}))}} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm">删除</button> : null}>
                   <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                     <div className="w-6 h-6 rounded-full shadow-sm border border-black/10 flex-shrink-0" style={{ backgroundColor: cat.color }} />
                     <div className="flex-1 font-medium text-gray-700">{cat.name}</div>
                     {cat.name !== '紧急' ? <span className="text-xs text-gray-300">← 左滑管理</span> : <span className="text-xs text-red-300">系统锁定</span>}
                   </div>
                 </SwipeRow>
               ))}
             </div>
             <button onClick={() => {
                const name = prompt("分类名:"); if(!name) return;
                const color = prompt("颜色:", "#000"); if(!color) return;
                setSettings(p => ({...p, categories: [...(p.categories||DEFAULT_TASK_CATS), {id:Date.now().toString(), name, color}]}));
             }} className="w-full bg-black text-white py-3 rounded-xl font-bold flex-shrink-0">+ 添加分类</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LifeApp;