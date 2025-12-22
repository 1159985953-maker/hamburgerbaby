import React, { useState } from 'react';
import { GlobalSettings, ApiPreset, Contact, WorldBookCategory } from '../types';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果在 components 同级）

interface SettingsAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  worldBooks: WorldBookCategory[];
  setWorldBooks: React.Dispatch<React.SetStateAction<WorldBookCategory[]>>;
  onClose: () => void;
}

const SettingsApp: React.FC<SettingsAppProps> = ({
  settings, setSettings, contacts, setContacts, worldBooks, setWorldBooks, onClose
}) => {
  const [activeTab, setActiveTab] = useState<'api' | 'appearance' | 'backup'>('api');
  const [editingPreset, setEditingPreset] = useState<Partial<ApiPreset> | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 初始化 Minimax 设置（防止空指针）
  const ensureMinimax = () => {
    if (!settings.minimax) {
      setSettings(prev => ({ ...prev, minimax: { groupId: '', apiKey: '', model: 'speech-01' } }));
    }
  };

  // 保存 API 预设
  const handleSavePreset = () => {
    if (!editingPreset?.name || !editingPreset?.apiKey || !editingPreset?.type) {
      alert('请填写完整信息');
      return;
    }

    const newPreset: ApiPreset = {
      id: editingPreset.id || Date.now().toString(),
      name: editingPreset.name,
      type: editingPreset.type,
      baseUrl: editingPreset.baseUrl || '',
      apiKey: editingPreset.apiKey,
      model: editingPreset.model || models[0] || (editingPreset.type === 'gemini' ? 'gemini-1.5-flash' : 'gpt-3.5-turbo'),
      temperature: editingPreset.temperature || 1.0,
      maxTokens: editingPreset.maxTokens || 2048,
      topP: editingPreset.topP || 1
    };

    setSettings(prev => {
      const existingIndex = prev.apiPresets.findIndex(p => p.id === newPreset.id);
      let newPresets = [...prev.apiPresets];
      if (existingIndex >= 0) {
        newPresets[existingIndex] = newPreset;
      } else {
        newPresets.push(newPreset);
      }
      return {
        ...prev,
        apiPresets: newPresets,
        activePresetId: prev.activePresetId || newPreset.id
      };
    });

    setEditingPreset(null);
    setModels([]);
  };

  // 删除预设
  const handleDeletePreset = (id: string) => {
    setSettings(prev => ({
      ...prev,
      apiPresets: prev.apiPresets.filter(p => p.id !== id),
      activePresetId: prev.activePresetId === id ? prev.apiPresets.find(p => p.id !== id)?.id || '' : prev.activePresetId
    }));
  };

  // 导出备份
  const handleExport = () => {
    const backup = {
      version: 1,
      date: new Date().toISOString(),
      globalSettings: settings,
      contacts,
      worldBooks
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hamburgerphone_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  // 导入备份 (自动修复版)
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.contacts && backup.globalSettings) {
          if (confirm('恢复备份将覆盖当前所有数据，确定吗？')) {

            // ★★★ 核心修复：在保存之前，清洗并修复每一个角色数据 ★★★
            const fixedContacts = backup.contacts.map((c: any) => ({
              ...c,
              // 如果缺少 mood，补全默认值
              mood: c.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
              // 如果缺少 history，补全空数组
              history: c.history || [],
              // 如果缺少 voiceId，补全默认值
              voiceId: c.voiceId || "female-shaonv-jingpin",
              // 如果缺少 id，补全随机数
              id: c.id || Date.now().toString() + Math.random()

            }));

            setSettings(backup.globalSettings);
            setContacts(fixedContacts); // <--- 存入修复好的数据
            setWorldBooks(backup.worldBooks || []);

            // ★★★ 新增：导入后自动激活第一个 API 预设（防止回复按钮没反应）★★★
            if (backup.globalSettings.apiPresets && backup.globalSettings.apiPresets.length > 0) {
              const firstPreset = backup.globalSettings.apiPresets[0];
              setSettings(prev => ({
                ...backup.globalSettings,
                activePresetId: backup.globalSettings.activePresetId || firstPreset.id
              }));
            } else {
              setSettings(backup.globalSettings);
            }
            alert('恢复成功！数据已自动修复，请刷新页面');
          }
        }
      } catch (err) {
        console.error(err);
        alert("导入失败：文件格式错误或数据损坏");
      }
    };
    reader.readAsText(file);
  };
  // 一键拉取模型列表
  const handleFetchModels = async () => {
    if (!editingPreset?.baseUrl || !editingPreset?.apiKey) {
      alert('请先填写 Base URL 和 API Key');
      return;
    }

    setLoadingModels(true);
    try {
      const res = await fetch(`${editingPreset.baseUrl.replace(/\/$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${editingPreset.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText || '连接失败'}`);
      }

      const data = await res.json();
      const modelList = data.data?.map((m: any) => m.id) || [];

      if (modelList.length === 0) {
        alert('拉取成功但未找到模型，请手动填写模型名');
      } else {
        setModels(modelList);
        alert(`成功拉取 ${modelList.length} 个模型！`);
      }
    } catch (err: any) {
      alert(`拉取模型失败：${err.message}`);
      console.error(err);
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
      {/* 顶部标题栏 */}
      <SafeAreaHeader
  title="系统设置"
  left={<button onClick={onClose} className="text-blue-500 text-2xl -ml-2">‹</button>}
/>

      {/* 标签页切换 */}
      <div className="flex bg-white border-b">
        <button onClick={() => setActiveTab('api')} className={`flex-1 py-3 font-medium ${activeTab === 'api' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          API 配置
        </button>
        <button onClick={() => setActiveTab('appearance')} className={`flex-1 py-3 font-medium ${activeTab === 'appearance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          外观美化
        </button>
        <button onClick={() => setActiveTab('backup')} className={`flex-1 py-3 font-medium ${activeTab === 'backup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
          备份恢复
        </button>
      </div>
      
<div className="flex-1 overflow-y-auto p-4">


        {/* ==================== 1. API 配置页面 ==================== */}
        {activeTab === 'api' && (
          <div className="space-y-6">

            {/* 新建/编辑预设表单 */}
            {editingPreset && (
              <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-200">
                <h3 className="font-bold text-lg mb-4 text-gray-800">
                  {editingPreset.id ? '编辑预设' : '新建预设'}
                </h3>

                <input
                  type="text"
                  placeholder="预设名称（如：gcli反代）"
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none"
                  value={editingPreset.name || ''}
                  onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                />

                <select
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none"
                  value={editingPreset.type || 'gemini'}
                  onChange={e => {
                    setEditingPreset({ ...editingPreset, type: e.target.value as 'gemini' | 'openai', baseUrl: '', model: '' });
                    setModels([]);
                  }}
                >
                  <option value="gemini">Gemini 官方</option>
                  <option value="openai">OpenAI 兼容（反代）</option>
                </select>

                {editingPreset.type === 'openai' && (
                  <>
                    <input
                      type="text"
                      placeholder="Base URL（如 https://gcli.ggchan.dev/v1）"
                      className="w-full p-3 border rounded-lg mb-3 focus:border-blue-500 outline-none"
                      value={editingPreset.baseUrl || ''}
                      onChange={e => setEditingPreset({ ...editingPreset, baseUrl: e.target.value })}
                    />

                    {/* 一键拉取模型按钮 */}
                    <button
                      onClick={handleFetchModels}
                      disabled={loadingModels}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-bold mb-4 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition shadow-md"
                    >
                      {loadingModels ? '拉取中...' : '🔄 一键拉取模型列表'}
                    </button>
                  </>
                )}

                <input
                  type="password"
                  placeholder="API Key"
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none"
                  value={editingPreset.apiKey || ''}
                  onChange={e => setEditingPreset({ ...editingPreset, apiKey: e.target.value })}
                />

                <select
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none"
                  disabled={loadingModels}
                  value={editingPreset.model || ''}
                  onChange={e => setEditingPreset({ ...editingPreset, model: e.target.value })}
                >
                  <option value="">
                    {models.length === 0
                      ? (editingPreset.type === 'gemini' ? '默认 gemini-1.5-flash' : '请拉取模型或手动填写')
                      : '选择模型'}
                  </option>
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <div className="mb-4">
                  <label className="text-sm text-gray-600 block mb-2">
                    温度 (Temperature): {editingPreset.temperature || 1.0}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    value={editingPreset.temperature || 1.0}
                    onChange={e => setEditingPreset({ ...editingPreset, temperature: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={handleSavePreset} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                    保存预设
                  </button>
                  <button onClick={() => { setEditingPreset(null); setModels([]); }} className="flex-1 bg-gray-300 py-3 rounded-lg font-bold hover:bg-gray-400 transition">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 已保存预设列表 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">已保存预设</h3>
                <button
                  onClick={() => setEditingPreset({ type: 'openai' })}
                  className="bg-blue-500 text-white w-10 h-10 rounded-full text-2xl shadow-lg hover:bg-blue-600 transition"
                >
                  +
                </button>
              </div>

              {settings.apiPresets.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg">还没有预设</p>
                  <p className="text-sm mt-2">点右上角 + 添加你的第一个API配置吧～</p>
                </div>
              )}

              {settings.apiPresets.map(p => (
                <div
                  key={p.id}
                  className={`bg-white p-4 rounded-xl border-2 flex justify-between items-center transition ${settings.activePresetId === p.id ? 'border-green-500 shadow-green-100' : 'border-gray-200'
                    }`}
                  onClick={() => setSettings(s => ({ ...s, activePresetId: p.id }))}
                >
                  <div className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{p.name}</span>
                      {settings.activePresetId === p.id && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">激活</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {p.type === 'gemini' ? 'Gemini 官方' : '反代'} • {p.model}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditingPreset(p); setModels([]); }} className="text-blue-500 text-sm font-medium">
                      编辑
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.id); }} className="text-red-500 text-sm font-medium">
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Minimax 基础配置 */}
            <div className="mt-8 border-t pt-6 pb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🗣️</span>
                <h3 className="font-bold text-lg text-gray-800">Minimax 语音 Key</h3>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-100 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">Group ID</label>
                  <input
                    type="text"
                    placeholder="输入 Group ID"
                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-purple-500 focus:bg-purple-50 transition font-mono"
                    value={settings.minimax?.groupId || ''}
                    onChange={e => { ensureMinimax(); setSettings(prev => ({ ...prev, minimax: { ...prev.minimax!, groupId: e.target.value } })) }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">API Key</label>
                  <input
                    type="password"
                    placeholder="输入 API Key"
                    className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:border-purple-500 focus:bg-purple-50 transition font-mono"
                    value={settings.minimax?.apiKey || ''}
                    onChange={e => { ensureMinimax(); setSettings(prev => ({ ...prev, minimax: { ...prev.minimax!, apiKey: e.target.value } })) }}
                  />
                </div>

                <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg">
                  💡 这里只填 Key。去 <b>聊天界面 → 设置 → Minimax 配置</b> 里选择国内版/模型/音色。
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ==================== 2. 外观设置页面 (修复了这里！) ==================== */}
        {activeTab === 'appearance' && (
          <div className="space-y-6 animate-slideUp">
            
            {/* 全局壁纸 */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-lg mb-3">🏠 桌面壁纸</h3>
               <div className="mb-4 aspect-video rounded-xl bg-gray-100 overflow-hidden border border-gray-200">
                  {settings.wallpaper ? (
                    <img src={settings.wallpaper} className="w-full h-full object-cover" alt="Wallpaper" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">暂无壁纸</div>
                  )}
               </div>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   className="flex-1 p-3 border rounded-lg text-sm outline-none focus:border-blue-500" 
                   placeholder="输入图片 URL..." 
                   value={settings.wallpaper}
                   onChange={e => setSettings(s => ({...s, wallpaper: e.target.value}))}
                 />
                 <label className="bg-gray-100 border px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-200 flex items-center justify-center">
                   📂
                   <input 
                     type="file" 
                     className="hidden" 
                     accept="image/*"
                     onChange={(e) => {
                       const file = e.target.files?.[0];
                       if(file) {
                         const reader = new FileReader();
                         reader.onload = (ev) => setSettings(s => ({...s, wallpaper: ev.target?.result as string}));
                         reader.readAsDataURL(file);
                       }
                     }} 
                   />
                 </label>
               </div>
            </div>

            {/* 时区设置 */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-3">🕒 时区设置</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">系统时区 (AI参考)</label>
                   <select 
                     className="w-full p-2 border rounded-lg bg-white"
                     value={settings.systemTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                     onChange={e => setSettings(s => ({...s, systemTimezone: e.target.value}))}
                   >
                     <option value="Asia/Shanghai">Asia/Shanghai (北京时间)</option>
                     <option value="Asia/Tokyo">Asia/Tokyo (东京)</option>
                     <option value="Asia/Seoul">Asia/Seoul (首尔)</option>
                     <option value="America/New_York">America/New_York (纽约)</option>
                     <option value="Europe/London">Europe/London (伦敦)</option>
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">你的本地时区</label>
                   <select 
                     className="w-full p-2 border rounded-lg bg-white"
                     value={settings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                     onChange={e => setSettings(s => ({...s, userTimezone: e.target.value}))}
                   >
                     <option value="Asia/Shanghai">Asia/Shanghai (北京时间)</option>
                     <option value="Asia/Tokyo">Asia/Tokyo (东京)</option>
                     <option value="Asia/Seoul">Asia/Seoul (首尔)</option>
                     <option value="America/New_York">America/New_York (纽约)</option>
                     <option value="Europe/London">Europe/London (伦敦)</option>
                   </select>
                </div>
              </div>
            </div>

             {/* 其他杂项 */}
             <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-lg mb-3">✨ 其他设置</h3>
               <div className="flex items-center justify-between p-2">
                 <span className="text-gray-700">显示状态栏 (时间/电量)</span>
                 <input 
                   type="checkbox" 
                   className="w-5 h-5 accent-blue-500"
                   checked={settings.appearance?.showStatusBar ?? true}
                   onChange={e => setSettings(s => ({...s, appearance: {...s.appearance, showStatusBar: e.target.checked}}))}
                 />
               </div>
             </div>
          </div>
        )}

        {/* ==================== 3. 备份恢复页面 ==================== */}
        {activeTab === 'backup' && (
          <div className="space-y-8 animate-slideUp">
            <div className="bg-white p-8 rounded-2xl text-center shadow-lg">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="font-bold text-2xl mb-3">导出备份</h3>
              <p className="text-gray-600 mb-6">保存所有聊天记录、角色、世界书、设置</p>
              <button onClick={handleExport} className="w-full bg-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition shadow-md">
                下载备份文件
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl text-center shadow-lg">
              <div className="text-6xl mb-4">📥</div>
              <h3 className="font-bold text-2xl mb-3">导入备份</h3>
              <p className="text-gray-600 mb-6">恢复之前保存的数据（会覆盖当前）</p>
              <label className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold block cursor-pointer hover:bg-blue-700 transition shadow-md">
                选择备份文件 (.json)
                <input type="file" onChange={handleImport} className="hidden" accept=".json" />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsApp;