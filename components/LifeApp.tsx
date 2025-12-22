// ==================== src/components/LifeApp.tsx (紧凑修复版) ====================
import React, { useState, useEffect, useRef } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings, TodoItem, TaskCategory } from '../types';

// 日期格式化辅助
const formatLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface LifeAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
  onOpenDiary: () => void;
}

const DEFAULT_CATEGORIES: TaskCategory[] = [
  { id: '1', name: '工作', color: '#3B82F6' },
  { id: '2', name: '生活', color: '#10B981' },
  { id: '3', name: '紧急', color: '#EF4444' },
  { id: '4', name: '娱乐', color: '#8B5CF6' },
  { id: '5', name: '约会', color: '#D946EF' },
];

// --- 左滑组件 (高度自适应修复版) ---
const SwipeRow = ({ 
  children, 
  actions 
}: { 
  children: React.ReactNode; 
  actions: React.ReactNode; 
}) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const currentOffset = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX;
    const diff = touchX - startX.current;
    if (diff < 0 && diff > -150) {
      currentOffset.current = diff;
      setOffset(diff);
    }
  };

  const onTouchEnd = () => {
    if (currentOffset.current < -60) {
      setOffset(-130);
      currentOffset.current = -130;
    } else {
      setOffset(0);
      currentOffset.current = 0;
    }
  };

  return (
    // ★★★ 关键修改：这里的 h-auto 和 py-0 保证了它绝对不会乱撑高度 ★★★
    <div className="relative overflow-hidden h-auto w-full rounded-2xl mb-2 flex-shrink-0">
      {/* 底层按钮 */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end px-2 gap-2 bg-gray-100 rounded-2xl w-full">
        {actions}
      </div>
      {/* 顶层内容 */}
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
  const [calendarDate, setCalendarDate] = useState(new Date());
  const todayStr = formatLocal(new Date());
  
  const [inputMode, setInputMode] = useState(false); 
  const [newTask, setNewTask] = useState<{
    id?: string;
    text: string; 
    date: string; 
    time: string; 
    location: string; 
    note: string;
    categoryId: string;
  }>({
    text: '', date: todayStr, time: '', location: '', note: '', categoryId: ''
  });

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!settings.categories || settings.categories.length === 0) {
      setSettings(prev => ({ ...prev, categories: DEFAULT_CATEGORIES }));
    }
  }, []);

  const categories = settings.categories && settings.categories.length > 0 ? settings.categories : DEFAULT_CATEGORIES;

  // --- 日历逻辑 ---
  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const days = getCalendarDays(calendarDate);
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const currentSelectedDateStr = formatLocal(calendarDate);

  // --- 增删改查 ---
  const handleSaveTodo = () => {
    if (!newTask.text.trim()) return;
    const todoData = {
      text: newTask.text,
      date: newTask.date || todayStr, 
      time: newTask.time,
      location: newTask.location,
      note: newTask.note,
      categoryId: newTask.categoryId || categories[0].id
    };

    if (newTask.id) {
      setSettings(prev => ({
        ...prev,
        todos: prev.todos.map(t => t.id === newTask.id ? { ...t, ...todoData } : t)
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        todos: [{ id: Date.now().toString(), completed: false, createdAt: Date.now(), ...todoData }, ...(prev.todos || [])]
      }));
    }
    resetInput();
  };

  const resetInput = () => {
    setNewTask({ id: undefined, text: '', date: currentSelectedDateStr, time: '', location: '', note: '', categoryId: '' });
    setInputMode(false);
  };

  const handleEditClick = (todo: TodoItem) => {
    setNewTask({
      id: todo.id,
      text: todo.text,
      date: todo.date,
      time: todo.time || '',
      location: todo.location || '',
      note: todo.note || '',
      categoryId: todo.categoryId || categories[0].id
    });
    setInputMode(true);
  };

  const deleteTodo = (id: string) => {
    if (confirm('确定要删除吗？')) {
      setSettings(prev => ({ ...prev, todos: (prev.todos || []).filter(t => t.id !== id) }));
      if (newTask.id === id) resetInput();
    }
  };

  const toggleTodo = (id: string) => {
    setSettings(prev => ({
      ...prev,
      todos: (prev.todos || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  // --- 分类管理 ---
  const handleAddCategory = () => {
    const name = prompt("新分类名称：");
    if (!name) return;
    const color = prompt("颜色 (如 #FF0000)：", "#000000");
    if (!color) return;
    setSettings(prev => ({ ...prev, categories: [...(prev.categories || []), { id: Date.now().toString(), name, color }] }));
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('删除此分类？')) {
      setSettings(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
    }
  };

  const dayTodos = (settings.todos || []).filter(t => t.date === currentSelectedDateStr);
  const pendingTodos = dayTodos.filter(t => !t.completed);
  const completedTodos = dayTodos.filter(t => t.completed);

  return (
    <div className="h-full w-full bg-[#F5F5F7] flex flex-col">
      <SafeAreaHeader 
        title="生活空间" 
        left={<button onClick={onClose} className="text-blue-500 font-medium">关闭</button>}
        right={<button onClick={() => setShowSettings(true)} className="text-gray-600 font-bold text-xl px-2">⚙️</button>}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-10 no-scrollbar" style={{ paddingTop: 'calc(50px + env(safe-area-inset-top))' }}>
        
        {/* 日历 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 select-none">
          <div className="flex justify-between items-center mb-4 px-2">
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="text-gray-400 p-2 hover:text-blue-500">◀</button>
            <span className="font-bold text-gray-800 text-lg">
              {calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="text-gray-400 p-2 hover:text-blue-500">▶</button>
          </div>
          
          <div className="grid grid-cols-7 mb-2 text-center text-xs text-gray-400 font-bold">
            {weekDays.map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-y-3">
            {days.map((day, index) => {
               let dotColors: string[] = [];
               if (day) {
                 const thisDateStr = formatLocal(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day));
                 const tasks = (settings.todos || []).filter(t => t.date === thisDateStr && !t.completed);
                 tasks.forEach(t => {
                   const cat = categories.find(c => c.id === t.categoryId);
                   if (cat && !dotColors.includes(cat.color)) dotColors.push(cat.color);
                 });
               }
               return (
                <div key={index} className="flex flex-col items-center justify-start h-10 cursor-pointer">
                  {day && (
                    <>
                    <button
                      onClick={() => {
                        const clicked = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                        setCalendarDate(clicked);
                        setNewTask(prev => ({ ...prev, date: formatLocal(clicked) }));
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                        ${calendarDate.getDate() === day ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {day}
                    </button>
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dotColors.slice(0, 3).map((color, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />)}
                      {dotColors.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                    </div>
                    </>
                  )}
                </div>
               );
            })}
          </div>
        </div>

        {/* 输入框 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm transition-all mb-4">
          {!inputMode ? (
            <div 
              onClick={() => {
                setNewTask({ ...newTask, id: undefined, text: '', date: currentSelectedDateStr });
                setInputMode(true);
              }}
              className="flex items-center gap-3 text-gray-400 cursor-text p-2"
            >
              <span className="text-xl text-blue-500">+</span>
              <span>{currentSelectedDateStr === todayStr ? "添加今日任务..." : `添加 ${currentSelectedDateStr} 的任务...`}</span>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center text-xs text-gray-400 uppercase font-bold tracking-wider">
                 <span>{newTask.id ? "编辑任务" : "新任务"}</span>
                 <button onClick={resetInput} className="text-gray-400 hover:text-gray-600">取消</button>
              </div>
              <input 
                autoFocus type="text" placeholder="要做什么？" className="w-full text-lg font-bold outline-none placeholder-gray-300"
                value={newTask.text} onChange={e => setNewTask({...newTask, text: e.target.value})}
              />
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                 {categories.map(cat => (
                   <button key={cat.id} onClick={() => setNewTask({...newTask, categoryId: cat.id})}
                     className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0
                       ${newTask.categoryId === cat.id ? 'border-transparent text-white shadow-md transform scale-105' : 'border-gray-200 text-gray-500 bg-white'}`}
                     style={{ backgroundColor: newTask.categoryId === cat.id ? cat.color : 'white' }}
                   >
                     {cat.name} {newTask.categoryId === cat.id && " ✓"}
                   </button>
                 ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm" value={newTask.date} onChange={e => setNewTask({...newTask, date: e.target.value})} />
                <input type="time" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm" value={newTask.time} onChange={e => setNewTask({...newTask, time: e.target.value})} />
              </div>
              <input type="text" placeholder="地点?" className="bg-gray-100 rounded-xl px-3 py-2 outline-none text-sm w-full" value={newTask.location} onChange={e => setNewTask({...newTask, location: e.target.value})} />
              <textarea placeholder="备注..." className="w-full bg-gray-100 rounded-xl p-3 text-sm outline-none resize-none h-20" value={newTask.note} onChange={e => setNewTask({...newTask, note: e.target.value})} />
              <button onClick={handleSaveTodo} className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200">{newTask.id ? "保存修改" : "确认添加"}</button>
            </div>
          )}
        </div>

        {/* 待办列表 - 紧凑版 */}
        <div>
          <h3 className="text-gray-500 text-xs font-bold mb-3 uppercase tracking-wider ml-1">
            {currentSelectedDateStr} 的待办
          </h3>
          <div className="space-y-0"> {/* 间距设为0，靠 SwipeRow 自身的 margin 撑开 */}
            {pendingTodos.length === 0 && <div className="text-center text-gray-300 text-sm py-4">无待办任务</div>}
            {pendingTodos.map(todo => {
              const cat = categories.find(c => c.id === todo.categoryId);
              return (
                <SwipeRow 
                  key={todo.id}
                  actions={
                    <>
                      <button onClick={() => handleEditClick(todo)} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm">编辑</button>
                      <button onClick={() => deleteTodo(todo.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">删除</button>
                    </>
                  }
                >
                  <div className="p-3.5 flex items-center gap-3"> {/* 这里的 padding 调小了一点 */}
                    <button onClick={() => toggleTodo(todo.id)} className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-blue-500 transition flex-shrink-0" />
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
        </div>

        {/* 已完成 */}
        {completedTodos.length > 0 && (
          <div className="mt-6 opacity-60">
            <h3 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-wider ml-1">已完成</h3>
            <div className="space-y-2">
              {completedTodos.map(todo => (
                <div key={todo.id} className="bg-gray-100 p-3 rounded-xl flex items-center gap-3">
                   <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                   <span className="text-gray-400 line-through text-sm flex-1">{todo.text}</span>
                   <button onClick={() => toggleTodo(todo.id)} className="text-xs text-blue-400 font-medium">撤销</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-scaleIn flex flex-col max-h-[80vh]">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">分类设置</h3>
               <button onClick={() => setShowSettings(false)} className="bg-gray-100 w-8 h-8 rounded-full text-gray-500">×</button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-1 no-scrollbar">
               {categories.map(cat => (
                 <SwipeRow key={cat.id} actions={<button onClick={() => handleDeleteCategory(cat.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm">删除</button>}>
                   <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                     <div className="w-6 h-6 rounded-full shadow-sm border border-black/10 flex-shrink-0" style={{ backgroundColor: cat.color }} />
                     <div className="flex-1 font-medium text-gray-700">{cat.name}</div>
                     <span className="text-xs text-gray-300">← 左滑管理</span>
                   </div>
                 </SwipeRow>
               ))}
             </div>
             <button onClick={handleAddCategory} className="w-full bg-black text-white py-3 rounded-xl font-bold flex-shrink-0">+ 添加分类</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LifeApp;