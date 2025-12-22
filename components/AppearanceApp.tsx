// components/AppearanceApp.tsx
import React, { useState } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings } from '../types';

interface AppearanceAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
}


const AppearanceApp: React.FC<AppearanceAppProps> = ({ settings, setSettings, onClose }) => {
 // 在 AppearanceApp 函数内部最顶上添加这行
const [activeTab, setActiveTab] = useState<'wallpaper' | 'frames' | 'avatar' | 'icons'>('wallpaper');
 
 
  const presets = [
    "https://images.unsplash.com/photo-1557683316-973673baf926",
    "https://images.unsplash.com/photo-1618331835717-801e976710b2",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986"
  ];

const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'wallpaper' | 'top' | 'left' | 'avatar') => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    if (ev.target?.result) {
      if (key === 'wallpaper') {
        setSettings(prev => ({ ...prev, wallpaper: ev.target!.result as string }));
      } else if (key === 'avatar') {
        } else if (key.startsWith('widget-')) { // <-- 新增的 else if
            const widgetId = key.replace('widget-', '');
            setSettings(prev => ({
                ...prev,
                widgets: prev.widgets.map(w => 
                    w.id === widgetId ? { ...w, customIcon: ev.target!.result as string } : w
                )
            }));
        } else {
        

        setSettings(prev => {
          const currentFrames = prev.photoFrames || [  // ← 超级兜底：如果 undefined，就用默认数组
            { id: 'top', photo: "https://picsum.photos/800/300?random=1" },
            { id: 'left', photo: "https://picsum.photos/400/400?random=2" }
          ];
          return {
            ...prev,
            photoFrames: currentFrames.map(f =>
              f.id === key ? { ...f, photo: ev.target!.result as string } : f
            )
          };
        });
      }
    }
  };
  reader.readAsDataURL(file);
};

  return (
    <div className="h-full w-full bg-gradient-to-br from-gray-900 to-black flex flex-col">
      <SafeAreaHeader
        title="外观设置"
        left={<button onClick={onClose} className="text-white text-2xl">✕</button>}
        backgroundClass="bg-black/40 backdrop-blur-xl border-b border-white/10"
      />

      <div className="flex bg-black/30 backdrop-blur-md border-b border-white/10">
        <button
          onClick={() => setActiveTab('wallpaper')}
          className={`flex-1 py-4 font-medium transition ${activeTab === 'wallpaper' ? 'text-white border-b-2 border-white' : 'text-gray-400'}`}
        >
          壁纸
        </button>
        <button
          onClick={() => setActiveTab('frames')}
          className={`flex-1 py-4 font-medium transition ${activeTab === 'frames' ? 'text-white border-b-2 border-white' : 'text-gray-400'}`}
        >
          照片框
        </button>
        <button
          onClick={() => setActiveTab('avatar')}
          className={`flex-1 py-4 font-medium transition ${activeTab === 'avatar' ? 'text-white border-b-2 border-white' : 'text-gray-400'}`}
        >
          头像
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'wallpaper' && (
          <div className="grid grid-cols-3 gap-4">
            {presets.map((url, i) => (
              <div
                key={i}
                className={`aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${
                  settings.wallpaper === url ? 'border-blue-400 shadow-lg shadow-blue-500/50' : 'border-transparent'
                }`}
                onClick={() => setSettings(s => ({ ...s, wallpaper: url }))}
              >
                <img src={url} className="w-full h-full object-cover" />
              </div>
            ))}
            <label className="aspect-square bg-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white/30 hover:border-white/60 transition-all backdrop-blur-sm">
              <span className="text-3xl">📷</span>
              <span className="text-xs mt-2 text-white/70">上传</span>
              <input type="file" onChange={e => handleUpload(e, 'wallpaper')} className="hidden" accept="image/*" />
            </label>
          </div>
        )}

        {activeTab === 'frames' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-white text-lg mb-2">顶部大照片框</h3>
              <div className="aspect-[4/3] rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl relative">
               <img 
  src={
    settings.photoFrames?.find(f => f.id === 'top')?.photo 
    || "https://picsum.photos/800/300?random=1"
  } 
  className="w-full h-full object-cover"/>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer">
                  <span className="text-white text-2xl">📷 更换</span>
                  <input type="file" onChange={e => handleUpload(e, 'top')} className="hidden" accept="image/*" />
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-white text-lg mb-2">左下小照片框</h3>
              <div className="aspect-square rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl relative">
              <img 
  src={
    settings.photoFrames?.find(f => f.id === 'left')?.photo 
    || "https://picsum.photos/400/400?random=2"
  } 
  className="w-full h-full object-cover"/>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer">
                  <span className="text-white text-2xl">📷 更换</span>
                  <input type="file" onChange={e => handleUpload(e, 'left')} className="hidden" accept="image/*" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'avatar' && (
          <div>
            <h3 className="text-white text-lg mb-2">小头像</h3>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl mx-auto relative">
              <img src={settings.avatar} className="w-full h-full object-cover" alt="Avatar" />
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer">
                <span className="text-white text-2xl">📷 更换</span>
                <input type="file" onChange={e => handleUpload(e, 'avatar')} className="hidden" accept="image/*" />
              </label>
            </div>
          </div>
        )}
        
{/* ==================== 把这段新代码加在最后一个 {activeTab === 'avatar' && ...} 的后面 ==================== */}
{activeTab === 'icons' && (
  <div className="space-y-6">
    <h3 className="text-white text-lg">自定义桌面图标</h3>
    <div className="grid grid-cols-4 gap-4">
      {settings.widgets.filter(w => ['chat', 'book', 'couple', 'diary'].includes(w.id)).map(widget => (
        <div key={widget.id} className="flex flex-col items-center gap-2">
          <label className="w-16 h-16 rounded-2xl overflow-hidden cursor-pointer relative group bg-black/20">
            {widget.customIcon ? (
              <img src={widget.customIcon} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-3xl">{widget.icon}</span>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs">更换</span>
            </div>
            <input type="file" onChange={e => handleUpload(e, `widget-${widget.id}`)} className="hidden" accept="image/*" />
          </label>
          <span className="text-xs text-white/70">{widget.text}</span>
        </div>
      ))}
    </div>
  </div>
)}


        {/* ... Avatar 按钮后面 ... */}
 <button
    onClick={() => setActiveTab('icons')}
    className={`flex-1 py-4 font-medium transition ${activeTab === 'icons' ? 'text-white border-b-2 border-white' : 'text-gray-400'}`}
  >
    图标
  </button>


      </div>
    </div>
  );
};

export default AppearanceApp;