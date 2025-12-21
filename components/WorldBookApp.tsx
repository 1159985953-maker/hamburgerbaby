import React, { useState } from 'react';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）
import { WorldBookCategory, WorldBookEntry } from '../types';

interface WorldBookAppProps {
  worldBooks: WorldBookCategory[];
  setWorldBooks: React.Dispatch<React.SetStateAction<WorldBookCategory[]>>;
  onClose: () => void;
}

const WorldBookApp: React.FC<WorldBookAppProps> = ({ worldBooks, setWorldBooks, onClose }) => {
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [manageMode, setManageMode] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<{ [catId: string]: string[] }>({});
  const [editingEntry, setEditingEntry] = useState<{ catId: string; entry: WorldBookEntry } | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [newEntryCatName, setNewEntryCatName] = useState("");
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);


  
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

  // 删除选中分类
  const deleteSelected = () => {
    if (selectedCats.length === 0) return;
    if (!confirm(`确定删除 ${selectedCats.length} 个分类吗？所有条目将被删除！`)) return;
    setWorldBooks(prev => prev.filter(c => !selectedCats.includes(c.id)));
    setExpandedCats(prev => prev.filter(id => !selectedCats.includes(id)));
    exitManage();
  };

  // 删除选中条目
  const deleteEntriesInCat = (catId: string) => {
    const count = selectedEntries[catId]?.length || 0;
    if (count === 0) return;
    if (!confirm(`确定删除 ${count} 条目吗？`)) return;
    setWorldBooks(prev => prev.map(c =>
      c.id === catId ? { ...c, entries: c.entries.filter(e => !selectedEntries[catId]?.includes(e.id)) } : c
    ));
    setSelectedEntries(prev => ({ ...prev, [catId]: [] }));
  };

  // 打包导出选中内容
  const exportSelected = () => {
    const exportData: any = {
      name: "世界书打包导出",
      entries: {}
    };
    let index = 0;
    selectedCats.forEach(catId => {
      const cat = worldBooks.find(c => c.id === catId);
      if (!cat) return;
      cat.entries.forEach(entry => {
        exportData.entries[index++] = {
          comment: `[分类:${cat.name}] ${entry.name || "未命名"}`,
          content: entry.content,
          keys: entry.keys
        };
      });
    });
    Object.keys(selectedEntries).forEach(catId => {
      const cat = worldBooks.find(c => c.id === catId);
      if (!cat) return;
      selectedEntries[catId].forEach(entryId => {
        const entry = cat.entries.find(e => e.id === entryId);
        if (!entry) return;
        exportData.entries[index++] = {
          comment: `[分类:${cat.name}] ${entry.name || "未命名"}`,
          content: entry.content,
          keys: entry.keys
        };
      });
    });
    if (index === 0) {
      alert("没有选中任何内容");
      return;
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `世界书打包_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`成功打包导出 ${index} 条目！`);
  };

  const openEdit = (catId: string, entry: WorldBookEntry) => {
    setEditingEntry({ catId, entry });
    setEditName(entry.name || "");
    setEditContent(entry.content);
  };

  const saveEdit = () => {
    if (!editingEntry) return;
    setWorldBooks(prev => prev.map(c =>
      c.id === editingEntry.catId ? {
        ...c,
        entries: c.entries.map(e =>
          e.id === editingEntry.entry.id
            ? { ...e, name: editName.trim() || "未命名条目", content: editContent }
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
        entries: []
      };
      setWorldBooks(prev => [...prev, targetCat]);
    }
    const newEntry: WorldBookEntry = {
      id: Date.now().toString(),
      keys: [],
      content: newEntryContent.trim(),
      name: newEntryName.trim() || "未命名条目"
    };
    setWorldBooks(prev => prev.map(c =>
      c.id === targetCat!.id ? { ...c, entries: [...c.entries, newEntry] } : c
    ));
    setShowNewEntryModal(false);
    setNewEntryCatName("");
    setNewEntryName("");
    setNewEntryContent("");
    alert(`条目已添加到分类 "${targetCat.name}"`);
  };

  // 你的原导入逻辑（保留占位）
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 这里放你原来的导入逻辑
    console.log("导入文件", e.target.files);
  };

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col">
      {/* 统一的沉浸式 Header */}
      <SafeAreaHeader
        title="世界书"
        left={<button onClick={onClose} className="text-gray-700 font-medium">关闭</button>}
       right={
  <div className="flex items-center !mr-auto gap-1 pr-2">  {/* pr-2 = padding-right: 0.5rem = 8px */}
    <label className="cursor-pointer  text-gray-600 text-lg hover:text-gray-900">
      📥
      <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
    </label>
    <button onClick={() => setManageMode(!manageMode)} className="text-gray-700 font-medium hover:text-gray-900">
      {manageMode ? '完成' : '管理'}
    </button>
    {!manageMode && (
      <button onClick={() => setShowNewEntryModal(true)} className="text-gray-700 text-2xl hover:text-gray-900">
        +
      </button>
    )}
  </div>
}
      />

      {/* 多选操作栏（保持原样，但位置下移） */}
      {manageMode && getSelectedCount() > 0 && (
        <div className="bg-gray-800 text-white px-5 py-4 flex items-center justify-between z-10 shadow-lg">
          <span className="font-medium">已选 {getSelectedCount()} 项</span>
          <div className="flex gap-4">
            <button onClick={exportSelected} className="bg-white text-gray-800 px-5 py-2 rounded font-medium hover:bg-gray-100">
              ⬇️ 打包导出
            </button>
            <button onClick={deleteSelected} className="bg-red-600 px-5 py-2 rounded font-medium hover:bg-red-700">
              🗑️ 删除
            </button>
            <button onClick={exitManage} className="text-white opacity-70 hover:opacity-100">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 分类列表内容区：顶部留出 Header 高度 */}
      <div className="flex-1 overflow-y-auto p-5 pt-20">  {/* pt-20 防止内容被 Header 遮挡 */}
        {worldBooks.length === 0 ? (
          <div className="text-center text-gray-500 py-24">
            暂无世界书分类
          </div>
        ) : (
          worldBooks.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 mb-5 shadow-sm">
              <div
                onClick={() => toggleCat(cat.id)}
                className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-all rounded-t-xl ${
                  selectedCats.includes(cat.id) ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xl">{expandedCats.includes(cat.id) ? '▼' : '▶'}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{cat.name}</h3>
                    <p className="text-sm text-gray-500">{cat.entries.length} 条目</p>
                  </div>
                </div>
                {manageMode && selectedCats.includes(cat.id) && (
                  <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">✓</div>
                )}
              </div>

              {expandedCats.includes(cat.id) && (
                <div className="border-t border-gray-200">
                  {cat.entries.length === 0 ? (
                    <div className="px-5 py-12 text-center text-gray-400 text-sm">
                      暂无条目
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {cat.entries.map(entry => (
                        <div
                          key={entry.id}
                          onClick={() => manageMode ? toggleEntry(cat.id, entry.id) : openEdit(cat.id, entry)}
                          className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-all ${
                            selectedEntries[cat.id]?.includes(entry.id) ? 'bg-gray-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-gray-800">{entry.name || "未命名条目"}</span>
                          {manageMode && selectedEntries[cat.id]?.includes(entry.id) && (
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                          )}
                        </div>
                      ))}
                      {manageMode && (selectedEntries[cat.id]?.length || 0) > 0 && (
                        <div className="px-5 py-3 border-t border-gray-200">
                          <button
                            onClick={() => deleteEntriesInCat(cat.id)}
                            className="w-full bg-red-600 text-white py-3 rounded font-medium hover:bg-red-700"
                          >
                            🗑️ 删除 {selectedEntries[cat.id]?.length} 条
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 新建条目弹窗（保持不变） */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="font-bold text-lg text-gray-900">新建世界书条目</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm text-gray-600 font-medium">分类名称（已有会自动归类，新建会自动创建）</label>
                <input
                  type="text"
                  value={newEntryCatName}
                  onChange={e => setNewEntryCatName(e.target.value)}
                  placeholder="例如：文件夹"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 mt-2 outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium">条目标题（可选）</label>
                <input
                  type="text"
                  value={newEntryName}
                  onChange={e => setNewEntryName(e.target.value)}
                  placeholder="例如：世界书"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 mt-2 outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium">条目内容</label>
                <textarea
                  value={newEntryContent}
                  onChange={e => setNewEntryContent(e.target.value)}
                  placeholder="输入详细内容..."
                  className="w-full h-48 border border-gray-300 rounded-lg px-4 py-3 mt-2 outline-none focus:border-gray-500 resize-none"
                />
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex gap-4">
              <button onClick={createNewEntry} className="flex-1 bg-gray-900 text-white py-4 rounded font-medium hover:bg-gray-800">
                创建
              </button>
              <button onClick={() => setShowNewEntryModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-4 rounded font-medium hover:bg-gray-300">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑条目弹窗（保持不变） */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">编辑条目</h3>
              <button onClick={() => setEditingEntry(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="条目标题"
                className="w-full text-xl font-semibold border-b-2 border-gray-300 pb-3 mb-6 outline-none focus:border-gray-500"
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="条目内容..."
                className="w-full h-full resize-none outline-none text-gray-800 leading-relaxed min-h-96"
              />
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex gap-4">
              <button onClick={saveEdit} className="flex-1 bg-gray-900 text-white py-4 rounded font-medium hover:bg-gray-800">
                保存
              </button>
              <button onClick={() => setEditingEntry(null)} className="flex-1 bg-gray-200 text-gray-700 py-4 rounded font-medium hover:bg-gray-300">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldBookApp;