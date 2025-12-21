// components/AppearanceApp.tsx
import React, { useState } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings, Widget } from '../types';

interface AppearanceAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
}

const AppearanceApp: React.FC<AppearanceAppProps> = ({ settings, setSettings, onClose }) => {
  const [activeTab, setActiveTab] = useState<'wallpaper' | 'widgets'>('wallpaper');
  const presets = [
    "https://images.unsplash.com/photo-1618331835717-801e976710b2",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986",
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853"
  ];

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setSettings(s => ({ ...s, wallpaper: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWidgetChange = (id: string, field: 'icon' | 'text', value: string) => {
    setSettings(prev => ({
      ...prev,
      photoFrames: prev.photoFrames || [],  // ← 加这行
      widgets: prev.widgets.map(w => w.id === id ? { ...w, [field]: value } : w)
    }));
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-gray-900 to-black flex flex-col">
      {/* 高级毛玻璃 Header */}
      <SafeAreaHeader
        title="外观设置"
        left={<button onClick={onClose} className="text-white text-2xl">✕</button>}
        backgroundClass="bg-black/40 backdrop-blur-xl border-b border-white/10"
      />

      {/* 标签切换 */}
      <div className="flex bg-black/30 backdrop-blur-md border-b border-white/10">
        <button
          onClick={() => setActiveTab('wallpaper')}
          className={`flex-1 py-4 font-medium transition ${activeTab === 'wallpaper' ? 'text-white border-b-2 border-white' : 'text-gray-400'}`}
        >
          壁纸
        </button>
        <button
          onClick={() => setActiveTab('widgets')}
          className={`flex-1 py-4 font-medium transition ${activeTab === 'widgets' ? 'text-white border-b-2 border-white' : 'text-gray-400'}`}
        >
          小组件
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'wallpaper' && (
          <>
            {/* 当前壁纸预览 */}
            <div className="aspect-[9/19] rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl relative">
              <img src={settings.wallpaper || presets[0]} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>

            {/* 预设 + 上传 */}
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
                <input type="file" onChange={handleWallpaperUpload} className="hidden" accept="image/*" />
              </label>
            </div>
          </>
        )}

        {activeTab === 'widgets' && (
          <div className="space-y-6">
            <p className="text-gray-400 text-sm">点击编辑每个小组件的图片和文字</p>
            <div className="grid grid-cols-2 gap-6">
              {settings.widgets.map(widget => (
                <div key={widget.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 shadow-lg">
                  <div className="flex flex-col items-center space-y-4">
                    <input
                      type="text"
                      value={widget.icon}
                      onChange={e => handleWidgetChange(widget.id, 'icon', e.target.value)}
                      className="w-16 h-16 text-4xl text-center bg-transparent border border-white/30 rounded-lg focus:outline-none focus:border-blue-400"
                      placeholder="图标 URL / emoji"
                    />
                    <input
                      type="text"
                      value={widget.text}
                      onChange={e => handleWidgetChange(widget.id, 'text', e.target.value)}
                      className="w-full text-center bg-transparent border-b border-white/30 focus:outline-none focus:border-blue-400 text-white text-lg font-medium"
                      placeholder="文字"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppearanceApp;