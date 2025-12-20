import React from 'react';
import SafeAreaHeader from './SafeAreaHeader';  // ← 确保路径正确（如果组件在 components 同级目录）
import { GlobalSettings } from '../types';
import SafeAreaHeader from '@/components/SafeAreaHeader';

interface WallpaperAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
}

const WallpaperApp: React.FC<WallpaperAppProps> = ({ settings, setSettings, onClose }) => {
  const presets = [
    "https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=1000&auto=format&fit=crop", // Default
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop", // Abstract
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop", // Landscape
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000&auto=format&fit=crop", // Night
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop"  // Cyberpunk
  ];

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="h-full w-full bg-black flex flex-col">
      {/* 统一的沉浸式 Header */}
      <SafeAreaHeader
        title="Wallpapers"
        left={<button onClick={onClose} className="text-white text-2xl">✕</button>}
        backgroundClass="bg-black/70 backdrop-blur-md text-white border-b border-white/10"
      />

      {/* 内容区：顶部留出安全区 + Header 高度 */}
      <div className="flex-1 overflow-y-auto p-4 pt-20">  {/* pt-20 保证内容不被 Header 遮挡 */}
        <div className="grid grid-cols-2 gap-4">
          {presets.map((url, i) => (
            <div
              key={i}
              className={`aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border-4 transition-all ${
                settings.wallpaper === url ? 'border-blue-500 shadow-lg' : 'border-transparent'
              }`}
              onClick={() => setSettings(s => ({ ...s, wallpaper: url }))}
            >
              <img src={url} className="w-full h-full object-cover" alt={`Preset ${i + 1}`} />
            </div>
          ))}

          {/* 上传自定义壁纸 */}
          <label className="aspect-[9/16] bg-gray-800 rounded-xl flex flex-col items-center justify-center cursor-pointer border-4 border-dashed border-gray-600 hover:border-gray-400 transition-all">
            <span className="text-3xl mb-2">📷</span>
            <span className="text-xs text-gray-400">Upload</span>
            <input type="file" onChange={handleUpload} className="hidden" accept="image/*" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default WallpaperApp;