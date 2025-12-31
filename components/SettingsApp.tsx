// 这是一组代码：【完全体】设置页面
// 包含：API修复(Gemini可填链接/拉取)、外观(壁纸/时区/状态栏)、备份(自动修复)
import React, { useState } from 'react';
import { GlobalSettings, ApiPreset, Contact, WorldBookCategory } from '../types';
import SafeAreaHeader from './SafeAreaHeader'; 
import { fetchModels } from '../services/apiService'; // 👈 确保这里引入了刚才改好的 apiService

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

  // 初始化 Minimax 设置
  const ensureMinimax = () => {
    if (!settings.minimax) {
      setSettings(prev => ({ ...prev, minimax: { groupId: '', apiKey: '', model: 'speech-01' } }));
    }
  };

  // 保存 API 预设
  const handleSavePreset = () => {
    if (!editingPreset?.name || !editingPreset?.apiKey) {
      alert('请填写 预设名称 和 API Key');
      return;
    }

    const newPreset: ApiPreset = {
      id: editingPreset.id || Date.now().toString(),
      name: editingPreset.name,
      type: editingPreset.type || 'gemini',
      // ★★★ 修复：无论什么模式，都允许保存 baseUrl ★★★
      baseUrl: editingPreset.baseUrl || '',
      apiKey: editingPreset.apiKey,
      model: editingPreset.model || models[0] || (editingPreset.type === 'gemini' ? 'gemini-1.5-flash' : 'gpt-3.5-turbo'),
      temperature: editingPreset.temperature || 1.0,
      maxTokens: editingPreset.maxTokens || 4096,
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

  // ★★★ 核心修复：通用一键拉取模型列表（支持 Gemini 填链接） ★★★
  const handleFetchModelsClick = async () => {
    if (!editingPreset?.apiKey) {
      alert('请先填写 API Key');
      return;
    }

    setLoadingModels(true);
    try {
      // 调用我们在 apiService.ts 里写的增强版函数
      // 它会自动处理 Gemini 官方、Gemini 代理、OpenAI 等各种情况
      const fetchedList = await fetchModels(
        editingPreset.type || 'gemini',
        editingPreset.baseUrl,
        editingPreset.apiKey
      );

      if (fetchedList.length > 0) {
        setModels(fetchedList);
        // 如果当前没选模型，默认选第一个
        if (!editingPreset.model) {
            setEditingPreset(prev => ({ ...prev, model: fetchedList[0] }));
        }
        alert(`成功拉取 ${fetchedList.length} 个模型！请在下拉框选择。`);
      } else {
        alert('拉取成功但列表为空，请手动输入模型名。');
      }
    } catch (err: any) {
      console.error(err);
      // 就算报错了，也给几个默认的，防止没得选
      const defaults = editingPreset.type === 'gemini' 
        ? ['gemini-1.5-flash', 'gemini-1.5-pro'] 
        : ['gpt-3.5-turbo', 'gpt-4o'];
      setModels(defaults);
      alert(`网络连接遇到问题，已加载默认模型列表供选择。\n(错误信息: ${err.message})`);
    } finally {
      setLoadingModels(false);
    }
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

  // 导入备份 (保留你原有的自动修复逻辑)
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.contacts && backup.globalSettings) {
          if (confirm('恢复备份将覆盖当前所有数据，确定吗？')) {

            // ★★★ 核心修复：保留你的清洗逻辑 ★★★
            const fixedContacts = backup.contacts.map((c: any) => ({
              ...c,
              // 补全 mood
              mood: c.mood || { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
              // 补全 history
              history: c.history || [],
              // 补全 voiceId
              voiceId: c.voiceId || "female-shaonv-jingpin",
              // 补全 id
              id: c.id || Date.now().toString() + Math.random()
            }));

            setSettings(backup.globalSettings);
            setContacts(fixedContacts);
            setWorldBooks(backup.worldBooks || []);

            // 导入后自动激活第一个 API 预设
            if (backup.globalSettings.apiPresets && backup.globalSettings.apiPresets.length > 0) {
              const firstPreset = backup.globalSettings.apiPresets[0];
              setSettings(prev => ({
                ...backup.globalSettings,
                activePresetId: backup.globalSettings.activePresetId || firstPreset.id
              }));
            }
            alert('恢复成功！数据已自动修复。');
          }
        }
      } catch (err) {
        console.error(err);
        alert("导入失败：文件格式错误或数据损坏");
      }
    };
    reader.readAsText(file);
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
              <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 animate-slideUp">
                <h3 className="font-bold text-lg mb-4 text-gray-800">
                  {editingPreset.id ? '编辑预设' : '新建预设'}
                </h3>

                {/* 名字 */}
                <input
                  type="text"
                  placeholder="预设名称（如：我的Gemini）"
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none font-bold"
                  value={editingPreset.name || ''}
                  onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                />

                {/* 类型选择 */}
                <select
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none"
                  value={editingPreset.type || 'gemini'}
                  onChange={e => {
                    setEditingPreset({ ...editingPreset, type: e.target.value as 'gemini' | 'openai', model: '' });
                    setModels([]);
                  }}
                >
                  <option value="gemini">Gemini 官方 / 代理</option>
                  <option value="openai">OpenAI 兼容 (GPT/Claude/DeepSeek)</option>
                </select>

                {/* ★★★ 核心修复：始终显示 Base URL 输入框，不管选什么类型！ ★★★ */}
                <div className="mb-3">
                    <label className="block text-xs font-bold text-gray-400 mb-1">
                        API Endpoint / Base URL (选填)
                    </label>
                    <input
                      type="text"
                      placeholder={editingPreset.type === 'gemini' ? "官方直连可留空，或填转发链接" : "https://api.openai.com/v1"}
                      className="w-full p-3 border rounded-lg focus:border-blue-500 outline-none font-mono text-sm"
                      value={editingPreset.baseUrl || ''}
                      onChange={e => setEditingPreset({ ...editingPreset, baseUrl: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        * 如果是 Gemini 官方直连，留空即可。如果有反代，请填入反代地址。
                    </p>
                </div>

                {/* API Key */}
                <input
                  type="password"
                  placeholder="API Key (sk-...)"
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none font-mono"
                  value={editingPreset.apiKey || ''}
                  onChange={e => setEditingPreset({ ...editingPreset, apiKey: e.target.value })}
                />

                {/* ★★★ 修复：拉取按钮现在对 Gemini 也生效 ★★★ */}
                <button
                  onClick={handleFetchModelsClick}
                  disabled={loadingModels}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-lg font-bold mb-4 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2"
                >
                  {loadingModels ? '⏳ 正在连接...' : '🔄 一键拉取模型列表'}
                </button>

                {/* 模型选择 */}
                <select
                  className="w-full p-3 border rounded-lg mb-4 focus:border-blue-500 outline-none bg-white"
                  value={editingPreset.model || ''}
                  onChange={e => setEditingPreset({ ...editingPreset, model: e.target.value })}
                >
                  <option value="">
                    {models.length === 0 ? '请先点击上方拉取按钮' : '-- 选择模型 --'}
                  </option>
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {/* 默认兜底选项 */}
                  <optgroup label="默认推荐">
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  </optgroup>
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
                    保存
                  </button>
                  <button onClick={() => { setEditingPreset(null); setModels([]); }} className="flex-1 bg-gray-300 py-3 rounded-lg font-bold hover:bg-gray-400 transition">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 预设列表 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">已保存预设</h3>
                <button
                  onClick={() => {
                    setEditingPreset({ type: 'openai' });
                    setModels([]);
                  }}
                  className="bg-blue-500 text-white w-10 h-10 rounded-full text-2xl shadow-lg hover:bg-blue-600 transition flex items-center justify-center"
                >
                  +
                </button>
              </div>

              {settings.apiPresets.length === 0 && (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <p>暂无配置</p>
                  <p className="text-sm mt-2">点击右上角 + 添加</p>
                </div>
              )}

              {settings.apiPresets.map(p => {
                const isActive = settings.activePresetId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSettings(s => ({ ...s, activePresetId: p.id }))}
                    className={`relative p-4 rounded-xl border-2 flex justify-between items-center transition cursor-pointer ${
                      isActive 
                        ? 'border-green-500 bg-green-50 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isActive ? 'text-green-800' : 'text-gray-800'}`}>
                          {p.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">
                            使用中
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        {p.type === 'gemini' ? 'Gemini' : 'OpenAI'} • {p.model}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[200px]">
                         {p.baseUrl || "默认地址"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingPreset(p); 
                          setModels([]); 
                        }} 
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100"
                      >
                        编辑
                      </button>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if(confirm(`确定删除 "${p.name}" 吗？`)) handleDeletePreset(p.id);
                        }} 
                        className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100"
                      >
                        删
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Minimax 配置 */}
            <div className="mt-8 border-t pt-6 pb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🗣️</span>
                <h3 className="font-bold text-lg text-gray-800">Minimax 语音 Key</h3>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-100 space-y-4">
                <input
                  type="text"
                  placeholder="Group ID"
                  className="w-full p-3 border border-gray-200 rounded-lg outline-none font-mono"
                  value={settings.minimax?.groupId || ''}
                  onChange={e => { ensureMinimax(); setSettings(prev => ({ ...prev, minimax: { ...prev.minimax!, groupId: e.target.value } })) }}
                />
                <input
                  type="password"
                  placeholder="API Key"
                  className="w-full p-3 border border-gray-200 rounded-lg outline-none font-mono"
                  value={settings.minimax?.apiKey || ''}
                  onChange={e => { ensureMinimax(); setSettings(prev => ({ ...prev, minimax: { ...prev.minimax!, apiKey: e.target.value } })) }}
                />
                <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg">
                  💡 只要填 Key，模型和音色去聊天界面里选。
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. 外观设置页面 (恢复了所有功能！) ==================== */}
        {activeTab === 'appearance' && (
          <div className="space-y-6 animate-slideUp">
            
            {/* 全局壁纸 */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-lg mb-3">🏠 桌面壁纸</h3>
               <div className="mb-4 aspect-video rounded-xl bg-gray-100 overflow-hidden border border-gray-200 relative">
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

            {/* ★★★ 恢复：时区设置 ★★★ */}
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

             {/* ★★★ 恢复：其他杂项 ★★★ */}
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