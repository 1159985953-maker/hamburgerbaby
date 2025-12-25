// 【WorldBookApp.tsx】全选覆盖
import React, { useState } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { WorldBookCategory, WorldBookEntry, GlobalSettings } from '../types';
import { generateResponse } from '../services/apiService'; 

// ★★★ 1. 这里加了 globalSettings，因为 AI 需要 API Key ★★★
interface WorldBookAppProps {
  worldBooks: WorldBookCategory[];
  setWorldBooks: React.Dispatch<React.SetStateAction<WorldBookCategory[]>>;
  globalSettings: GlobalSettings; 
  onClose: () => void;
  onOpenSettings?: () => void; // 用于跳转去设置页配 Key
}

const WorldBookApp: React.FC<WorldBookAppProps> = ({ worldBooks, setWorldBooks, globalSettings, onClose, onOpenSettings }) => {
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [manageMode, setManageMode] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<{ [catId: string]: string[] }>({});
  
  // 编辑状态
  const [editingEntry, setEditingEntry] = useState<{ catId: string; entry: WorldBookEntry } | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editKeys, setEditKeys] = useState(""); 
  const [editStrategy, setEditStrategy] = useState<'constant' | 'keyword'>('keyword');

  // 新建状态
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntryCatName, setNewEntryCatName] = useState("");
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [newEntryKeys, setNewEntryKeys] = useState(""); 
  const [newEntryStrategy, setNewEntryStrategy] = useState<'constant' | 'keyword'>('keyword');

  // ★★★ AI 分析状态 ★★★
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const toggleCat = (catId: string) => {
    if (manageMode) {
      setSelectedCats(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
    } else {
      setExpandedCats(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
    }
  };

  const toggleEntry = (catId: string, entryId: string) => {
    if (manageMode) {
      setSelectedEntries(prev => ({
        ...prev,
        [catId]: prev[catId]?.includes(entryId)
          ? prev[catId].filter(id => id !== entryId)
          : [...(prev[catId] || []), entryId]
      }));
    }
  };

  const getSelectedCount = () => selectedCats.length + Object.values(selectedEntries).reduce((a, b) => a + b.length, 0);

  const exitManage = () => {
    setManageMode(false);
    setSelectedCats([]);
    setSelectedEntries({});
  };

  const deleteSelected = () => {
    if (selectedCats.length === 0) return;
    if (!confirm(`确定删除 ${selectedCats.length} 个分类吗？所有条目将被删除！`)) return;
    setWorldBooks(prev => prev.filter(c => !selectedCats.includes(c.id)));
    setExpandedCats(prev => prev.filter(id => !selectedCats.includes(id)));
    exitManage();
  };

  const deleteEntriesInCat = (catId: string) => {
    const count = selectedEntries[catId]?.length || 0;
    if (count === 0) return;
    if (!confirm(`确定删除 ${count} 条目吗？`)) return;
    setWorldBooks(prev => prev.map(c =>
      c.id === catId ? { ...c, entries: c.entries.filter(e => !selectedEntries[catId]?.includes(e.id)) } : c
    ));
    setSelectedEntries(prev => ({ ...prev, [catId]: [] }));
  };

  const exportSelected = () => {
    alert("导出功能开发中...");
  };
// 【WorldBookApp.tsx】找到 handleAiAutoSort，替换为这个【超强容错版】：







// 【WorldBookApp.tsx】找到 handleAiAutoSort，用这个【“杠-精”预判版】替换：

// 【WorldBookApp.tsx】找到 handleAiAutoSort，用这个【专有名词优先版】替换：

  const handleAiAutoSort = async (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
    if (!activePreset) {
      if(confirm("⚠️ 未配置 API！\n要去设置页配置吗？")) {
        if(onOpenSettings) onOpenSettings();
      }
      return;
    }

    const targetBook = worldBooks.find(b => b.id === catId);
    if (!targetBook || targetBook.entries.length === 0) {
      alert("这本书是空的，不用整理啦~");
      return;
    }

    if (!confirm(`🔮 (终极加强版) AI 将优先提取所有【专有名词】，并结合聊天语境进行联想，以生成最有效的关键词。确定开始吗？`)) return;

    setIsAnalyzing(true);
    let finalResults: { id: string; strategy: 'constant' | 'keyword'; keys: string[] }[] = [];
    const CHUNK_SIZE = 3; 
    const allEntries = targetBook.entries;
    const totalBatches = Math.ceil(allEntries.length / CHUNK_SIZE);

    try {
      for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
        const currentBatchIndex = Math.floor(i / CHUNK_SIZE) + 1;
        setLoadingText(`正在进行终极分析 (${currentBatchIndex}/${totalBatches})...`);

        const batchEntries = allEntries.slice(i, i + CHUNK_SIZE).map(ent => ({
          id: ent.id,
          name: ent.name,
          content: ent.content.slice(0, 500).replace(/\n/g, " ")
        }));

        // ★★★ 终极 Prompt V2：专有名词优先 + 语境联想 ★★★
        const prompt = `
你现在是【RPG 游戏的核心规则引擎】。你需要为设定集配置触发器。

【核心任务】：
1.  **判断类型**：
    -   **CONSTANT (常驻)**：底层规则、角色核心性格、AI回复风格。必须时刻生效。
    -   **KEYWORD (关键词)**：具体的物品、地点、NPC、事件。

2.  **关键词提取双重铁律（至关重要！）**：
    -   **铁律一 (实体提取)**：【最高优先级】必须无条件提取条目内容中所有的【专有名词】（人名、地名、物品名、组织名、技能名等）。
    -   **铁律二 (语境联想)**：在提取完专有名词的基础上，再扮演玩家，联想出2-3个最可能触发此设定的【语境词】（如：公司, 行程, 工作, 事业）。
    -   **最终结果**：KEYS 列表 = 【所有专有名词】 + 【语境词】。

【绝对格式 (每行一条)】：
ID:条目ID || TYPE:类型 || KEYS:关键词1,关键词2

【数据】：
${JSON.stringify(batchEntries)}

【正确思考过程 & 输出示例】：
---
**设定**：《K-POP产业法则》内容是“练习生田柾国被公司HYBE严格管控，不能取消行程...”
**你的思考**：
1.  **实体提取**：专有名词有 “田柾国”、“HYBE”。必须提取。
2.  **语境联想**：玩家会抱怨“公司”、要求“取消行程”、关心“事业”、“恋情”。
3.  **合并**：田柾国, HYBE, 公司, 行程, 事业, 恋情, 工作
**最终输出**：ID:kpop_rule || TYPE:KEYWORD || KEYS:田柾国,HYBE,公司,行程,工作,事业,恋情
---
**设定**：《回复格式》内容是“必须用emoji结尾...”
**你的思考**：
1.  这是底层规则，不是实体。
2.  必须是 CONSTANT。
**最终输出**：ID:reply_format || TYPE:CONSTANT || KEYS:
---
`;

        const response = await generateResponse([{ role: 'user', content: prompt }], activePreset);
        
        if (!response || response.includes("AI 返回了空内容")) {
             console.warn(`第 ${currentBatchIndex} 批次 AI 罢工，跳过...`);
             continue; 
        }

        const lines = response.split('\n');
        lines.forEach(line => {
            const match = line.match(/ID\s*:\s*(.*?)\s*\|\|\s*TYPE\s*:\s*(.*?)\s*\|\|\s*KEYS\s*:\s*(.*)/i);
            if (match) {
                const id = match[1].trim();
                const rawType = match[2].trim().toUpperCase();
                const rawKeys = match[3].trim();
                
                let strategy: 'constant' | 'keyword' = 'keyword';
                if (rawType.includes('CONSTANT')) strategy = 'constant';
                
                // ★★★ 去重处理 ★★★
                // 防止 AI 提取的专有名词和语境词重复
                const keySet = new Set<string>();
                if (rawKeys) {
                    rawKeys.split(/[,，]/).forEach(k => {
                        const trimmedKey = k.trim();
                        if (trimmedKey) {
                            keySet.add(trimmedKey);
                        }
                    });
                }
                const keys = Array.from(keySet);
                
                finalResults.push({ id, strategy, keys });
            }
        });
        
        await new Promise(r => setTimeout(r, 800));
      }

      if (finalResults.length === 0) {
        throw new Error("AI 未返回有效结果，请检查 API 或重试。");
      }

      setLoadingText(`分析完毕，正在应用 ${finalResults.length} 条智能策略...`);

      setWorldBooks(prev => prev.map(book => {
        if (book.id !== catId) return book;
        
        const newEntries = book.entries.map(entry => {
            const aiResult = finalResults.find(r => r.id === entry.id);
            if (aiResult) {
                return { ...entry, strategy: aiResult.strategy, keys: aiResult.keys };
            }
            return entry;
        });

        return { ...book, entries: newEntries };
      }));

      await new Promise(r => setTimeout(r, 800)); 
      alert(`✅ 终极整理完成！\nAI 已为 ${finalResults.length} 个条目生成了“专有名词+语境”双重关键词。`);

    } catch (e: any) {
      console.error(e);
      alert(`整理中断：${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };








  const openEdit = (catId: string, entry: WorldBookEntry) => {
    setEditingEntry({ catId, entry });
    setEditName(entry.name || "");
    setEditContent(entry.content);
    setEditKeys(entry.keys.join(", "));
    setEditStrategy(entry.strategy || 'keyword'); 
  };







  const saveEdit = () => {
    if (!editingEntry) return;
    setWorldBooks(prev => prev.map(c =>
      c.id === editingEntry.catId ? {
        ...c,
        entries: c.entries.map(e =>
          e.id === editingEntry.entry.id
            ? { 
                ...e, 
                name: editName.trim() || "未命名条目", 
                content: editContent,
                keys: editKeys.split(/[,，]/).map(k => k.trim()).filter(k => k), 
                strategy: editStrategy 
              }
            : e
        )
      } : c
    ));
    setEditingEntry(null);
  };





  const createNewEntry = () => {
    if (!newEntryContent.trim()) return;
    let targetCat = worldBooks.find(c => c.name.toLowerCase() === newEntryCatName.toLowerCase().trim());
    if (!targetCat) {
      targetCat = {
        id: Date.now().toString(),
        name: newEntryCatName.trim(),
        entries: [],
        type: 'selective'
      };
      setWorldBooks(prev => [...prev, targetCat]);
    }
    const newEntry: WorldBookEntry = {
      id: Date.now().toString(),
      keys: newEntryKeys.split(/[,，]/).map(k => k.trim()).filter(k => k),
      content: newEntryContent.trim(),
      name: newEntryName.trim() || "未命名条目",
      strategy: newEntryStrategy 
    };
    setWorldBooks(prev => prev.map(c =>
      c.id === targetCat!.id ? { ...c, entries: [...c.entries, newEntry] } : c
    ));
    
    setShowNewEntryModal(false);
    setNewEntryCatName("");
    setNewEntryName("");
    setNewEntryContent("");
    setNewEntryKeys("");
    setNewEntryStrategy('keyword');
    alert(`条目已添加到分类 "${targetCat.name}"`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("导入文件", e.target.files);
  };

  // 辅助组件：模式选择器
  const StrategySelector = ({ value, onChange }: { value: 'constant' | 'keyword', onChange: (v: 'constant' | 'keyword') => void }) => (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div 
        onClick={() => onChange('keyword')}
        className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center justify-center transition-all ${value === 'keyword' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
      >
        <span className="text-2xl mb-1">🔍</span>
        <span className="text-sm font-bold">关键词模式</span>
        <span className="text-[10px] opacity-70">检测到词才生效 (省Token)</span>
      </div>
      <div 
        onClick={() => onChange('constant')}
        className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center justify-center transition-all ${value === 'constant' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
      >
        <span className="text-2xl mb-1">📌</span>
        <span className="text-sm font-bold">常驻模式</span>
        <span className="text-[10px] opacity-70">永远生效 (基本世界书)</span>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
<SafeAreaHeader
        title="世界书管理"
        left={<button onClick={onClose} className="text-gray-700 font-medium px-3">关闭</button>}
        right={
          // ★★★ 核心修改：
          // 1. pr-4: 右边距加大，不再贴着屏幕边缘
          // 2. gap-4: 图标之间间距加大，不再挤在一起
          // 3. min-w-max: 确保宽度足够，不会把加号挤下去
          <div className="flex items-center justify-end gap-4 pr-4 min-w-max">
            
            {/* 导入按钮 */}
            <label className="cursor-pointer text-gray-600 text-lg hover:text-gray-900 flex items-center">
              📥 <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
            
            {/* 管理按钮 */}
            <button 
              onClick={() => setManageMode(!manageMode)} 
              className="text-gray-700 font-medium hover:text-gray-900 whitespace-nowrap"
            >
              {manageMode ? '完成' : '管理'}
            </button>
            
            {/* 加号按钮 (只在非管理模式显示) */}
            {!manageMode && (
              <button 
                onClick={() => setShowNewEntryModal(true)} 
                className="text-blue-600 text-3xl leading-none pb-1 font-light hover:text-blue-800 transition flex items-center"
              >
                +
              </button>
            )}
          </div>
        }
      />

      {/* 多选操作栏 */}
      {manageMode && getSelectedCount() > 0 && (
        <div className="bg-gray-800 text-white px-5 py-4 flex items-center justify-between z-10 shadow-lg animate-slideDown">
          <span className="font-medium">已选 {getSelectedCount()} 项</span>
          <div className="flex gap-2">
            <button onClick={exportSelected} className="bg-white text-gray-800 px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-100">打包</button>
            <button onClick={deleteSelected} className="bg-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700">删除</button>
            <button onClick={exitManage} className="text-white opacity-70 px-2 text-xs">取消</button>
          </div>
        </div>
      )}

      {/* 列表区域 */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {worldBooks.length === 0 ? (
          <div className="text-center text-gray-500 py-24 flex flex-col items-center">
            <span className="text-4xl mb-4">📖</span>
            <p>暂无世界书</p>
            <p className="text-xs mt-2">点击右上角 + 号添加你的第一条设定</p>
          </div>
        ) : (
          worldBooks.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 mb-4 shadow-sm overflow-hidden">
              <div
                onClick={() => toggleCat(cat.id)}
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all ${selectedCats.includes(cat.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs transition-transform duration-200 ${expandedCats.includes(cat.id) ? 'rotate-90' : ''}`}>▶</span>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">{cat.name}</h3>
                    <p className="text-[10px] text-gray-400">{cat.entries.length} 条目</p>
                  </div>
                </div>
                
                {/* ★★★ 按钮在这里：只有非管理模式下显示 ★★★ */}
                {manageMode ? (
                  selectedCats.includes(cat.id) && <div className="text-blue-500 font-bold">✓</div>
                ) : (
                  <button 
                     onClick={(e) => handleAiAutoSort(cat.id, e)}
                     className="text-[10px] bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-1 rounded-full shadow-sm hover:opacity-80 transition flex items-center gap-1"
                     title="AI 智能分类整理"
                  >
                     <span>⚡</span> 智能整理
                  </button>
                )}
              </div>

              {/* 展开的条目列表 */}
{/* 展开的条目列表 */}
              {expandedCats.includes(cat.id) && (
                <div className="bg-gray-50/50 border-t border-gray-100">
                  {cat.entries.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">空分类</div>
                  ) : (
                    // ★★★ 核心修改：这里加了 .sort() 自动排序 ★★★
                    // 逻辑：如果是 constant (常驻) 给 0 分，否则给 1 分。
                    // 分数小的排前面，所以常驻会跑去上面，关键词会跑去下面。
                    [...cat.entries]
                      .sort((a, b) => {
                        const scoreA = a.strategy === 'constant' ? 0 : 1;
                        const scoreB = b.strategy === 'constant' ? 0 : 1;
                        return scoreA - scoreB;
                      })
                      .map(entry => {
                        const isConstant = entry.strategy === 'constant';
                        return (
                          <div
                            key={entry.id}
                            onClick={() => manageMode ? toggleEntry(cat.id, entry.id) : openEdit(cat.id, entry)}
                            className={`px-4 py-3 border-b border-gray-100 last:border-0 flex items-center justify-between cursor-pointer transition-all ${
                              selectedEntries[cat.id]?.includes(entry.id) ? 'bg-blue-50' : 'hover:bg-white'
                            }`}
                          >
                            <div className="flex flex-col gap-1 overflow-hidden">
                              <div className="flex items-center gap-2">
                                {/* 状态徽章 */}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold border shrink-0 ${isConstant ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                  {isConstant ? '常驻' : '关键词'}
                                </span>
                                <span className="text-sm font-medium text-gray-700 truncate">{entry.name || "未命名"}</span>
                              </div>
                              {/* 显示关键词摘要 (仅关键词模式) */}
                              {!isConstant && entry.keys.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                   {entry.keys.slice(0, 3).map((k, i) => (
                                       <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-1 rounded border border-gray-200">
                                          {k}
                                       </span>
                                   ))}
                                   {entry.keys.length > 3 && <span className="text-[9px] text-gray-400">...</span>}
                                </div>
                              )}
                            </div>
                            
                            {manageMode && selectedEntries[cat.id]?.includes(entry.id) && (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ml-2">✓</div>
                            )}
                          </div>
                        );
                      })
                  )}
                  {manageMode && (selectedEntries[cat.id]?.length || 0) > 0 && (
                    <button onClick={() => deleteEntriesInCat(cat.id)} className="w-full py-2 bg-red-50 text-red-500 text-xs font-bold border-t border-red-100">
                      删除选中的 {selectedEntries[cat.id]?.length} 条
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ==================== 新建条目弹窗 ==================== */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-scaleIn">
            <div className="border-b px-5 py-4 bg-gray-50 rounded-t-2xl">
              <h3 className="font-bold text-gray-800">✨ 新建世界书条目</h3>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
              <StrategySelector value={newEntryStrategy} onChange={setNewEntryStrategy} />

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">归属分类</label>
                    <input
                      type="text"
                      value={newEntryCatName}
                      onChange={e => setNewEntryCatName(e.target.value)}
                      placeholder="如: 世界观"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">条目名称</label>
                    <input
                      type="text"
                      value={newEntryName}
                      onChange={e => setNewEntryName(e.target.value)}
                      placeholder="如: 魔法法则"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                 </div>
              </div>

              <div>
                <label className={`text-xs font-bold mb-1 block ${newEntryStrategy === 'constant' ? 'text-gray-300' : 'text-blue-500'}`}>
                  {newEntryStrategy === 'constant' ? '触发关键词 (常驻模式下无需填写)' : '触发关键词 (多个用逗号分隔)'}
                </label>
                <input
                  type="text"
                  value={newEntryKeys}
                  onChange={e => setNewEntryKeys(e.target.value)}
                  disabled={newEntryStrategy === 'constant'}
                  placeholder={newEntryStrategy === 'constant' ? "无需关键词，始终生效" : "例如: 魔法, 魔力, 法术"}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${
                    newEntryStrategy === 'constant' ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">详细设定内容</label>
                <textarea
                  value={newEntryContent}
                  onChange={e => setNewEntryContent(e.target.value)}
                  placeholder="在此输入详细的世界设定、规则或描述..."
                  className="w-full h-32 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="border-t px-5 py-4 flex gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowNewEntryModal(false)} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition">
                取消
              </button>
              <button onClick={createNewEntry} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition">
                创建条目
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 编辑条目弹窗 ==================== */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-scaleIn">
            <div className="border-b px-5 py-4 bg-gray-50 flex justify-between items-center rounded-t-2xl">
              <h3 className="font-bold text-gray-800">编辑条目</h3>
              <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <StrategySelector value={editStrategy} onChange={setEditStrategy} />
              
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">标题</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border-b border-gray-200 px-1 py-2 text-lg font-bold text-gray-800 outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className={`text-xs font-bold mb-1 block ${editStrategy === 'constant' ? 'text-gray-300' : 'text-blue-500'}`}>
                  {editStrategy === 'constant' ? '触发关键词 (未启用)' : '触发关键词'}
                </label>
                <input
                  type="text"
                  value={editKeys}
                  onChange={e => setEditKeys(e.target.value)}
                  disabled={editStrategy === 'constant'}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${
                    editStrategy === 'constant' ? 'bg-gray-100 text-gray-400' : 'bg-white border-blue-200 focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                 <label className="text-xs font-bold text-gray-500 mb-1 block">内容</label>
                 <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-48 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none leading-relaxed font-mono"
                />
              </div>
            </div>

            <div className="border-t px-5 py-4 flex gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingEntry(null)} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition">
                取消
              </button>
              <button onClick={saveEdit} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition">
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== AI 分析中遮罩 ==================== */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fadeIn cursor-wait">
          <div className="relative mb-6">
             <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
               ⚡
             </div>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2 animate-pulse">
            AI 正在整理世界书
          </h3>
          <p className="text-xs text-indigo-500 font-mono bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 transition-all duration-300">
            {loadingText}
          </p>
        </div>
      )}
    </div>
  );
};

export default WorldBookApp;