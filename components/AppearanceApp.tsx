// ==================== 从这里开始完整复制，覆盖旧的 AppearanceApp.tsx 文件 ====================
import React, { useState } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings } from '../types';

interface AppearanceAppProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  onClose: () => void;
}

const AppearanceApp: React.FC<AppearanceAppProps> = ({ settings, setSettings, onClose }) => {
  // 状态定义，保持不变
  const [activeTab, setActiveTab] = useState<'wallpaper' | 'frames' | 'avatar' | 'icons'>('wallpaper');
 
  // 预设壁纸数据，保持不变
  const presets = [
    "https://images.unsplash.com/photo-1557683316-973673baf926",
    "https://images.unsplash.com/photo-1618331835717-801e976710b2",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986"
  ];

  // 图片上传逻辑，保持不变
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'wallpaper' | 'top' | 'left' | 'avatar' | string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const dataUrl = ev.target!.result as string;
        if (key === 'wallpaper') {
          setSettings(prev => ({ ...prev, wallpaper: dataUrl }));
        } else if (key === 'avatar') {
          setSettings(prev => ({ ...prev, avatar: dataUrl }));
        } else if (key.startsWith('widget-')) {
          const widgetId = key.replace('widget-', '');
          setSettings(prev => ({
            ...prev,
            widgets: (prev.widgets || []).map(w => 
                w.id === widgetId ? { ...w, customIcon: dataUrl } : w
            )
          }));
        } else {
          setSettings(prev => {
            const currentFrames = prev.photoFrames || [
              { id: 'top', photo: "https://picsum.photos/800/300?random=1" },
              { id: 'left', photo: "https://picsum.photos/400/400?random=2" }
            ];
            return {
              ...prev,
              photoFrames: currentFrames.map(f =>
                f.id === key ? { ...f, photo: dataUrl } : f
              )
            };
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    // --- 新代码说明：1. 修复头部遮挡；2. 把背景从黑色渐变改为了浅灰色 ---
    <div className="h-full w-full bg-gray-100 flex flex-col pt-[calc(44px+env(safe-area-inset-top))]">
      
      {/* --- 新代码说明：1. 关闭按钮颜色从白色改为蓝色；2. 删除了自定义的黑色背景样式 --- */}
      <SafeAreaHeader
        title="外观设置"
        left={<button onClick={onClose} className="text-blue-500 font-medium">关闭</button>}
      />

      {/* --- 新代码说明：修改了标签栏的背景和文字颜色，使其与浅色主题统一 --- */}
      <div className="flex bg-white border-b">
        <button
          onClick={() => setActiveTab('wallpaper')}
          className={`flex-1 py-3 font-medium ${activeTab === 'wallpaper' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          壁纸
        </button>
        <button
          onClick={() => setActiveTab('frames')}
          className={`flex-1 py-3 font-medium ${activeTab === 'frames' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          照片框
        </button>
        <button
          onClick={() => setActiveTab('avatar')}
          className={`flex-1 py-3 font-medium ${activeTab === 'avatar' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          头像
        </button>
        <button
          onClick={() => setActiveTab('icons')}
          className={`flex-1 py-3 font-medium ${activeTab === 'icons' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          图标
        </button>
      </div>

      {/* --- 新代码说明：滚动内容区的外边距和内边距也做了微调，使其更好看 --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'wallpaper' && (
          // --- 新代码说明：把卡片背景改成了白色，上传按钮也改成了浅灰色 ---
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="grid grid-cols-3 gap-4">
              {presets.map((url, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${settings.wallpaper === url ? 'border-blue-500' : 'border-transparent'}`}
                  onClick={() => setSettings(s => ({ ...s, wallpaper: url }))}
                >
                  <img src={url} className="w-full h-full object-cover" />
                </div>
              ))}
              <label className="aspect-square bg-gray-100 rounded-lg flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 transition-all">
                <span className="text-2xl text-gray-400">📷</span>
                <span className="text-xs mt-1 text-gray-500">上传</span>
                <input type="file" onChange={e => handleUpload(e, 'wallpaper')} className="hidden" accept="image/*" />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'frames' && (
          <div className="space-y-6">
            {/* --- 新代码说明：把卡片背景和文字都改成了浅色样式 --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-3">顶部大照片框</h3>
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
                <img src={settings.photoFrames?.find(f => f.id === 'top')?.photo || "https://picsum.photos/800/300?random=1"} className="w-full h-full object-cover"/>
                <label className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-lg">📷 更换</span>
                  <input type="file" onChange={e => handleUpload(e, 'top')} className="hidden" accept="image/*" />
                </label>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-3">左侧照片框</h3>
              <div className="aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
                <img src={settings.photoFrames?.find(f => f.id === 'left')?.photo || "https://picsum.photos/400/400?random=2"} className="w-full h-full object-cover"/>
                <label className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-lg">📷 更换</span>
                  <input type="file" onChange={e => handleUpload(e, 'left')} className="hidden" accept="image/*" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'avatar' && (
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="font-bold text-gray-800 text-lg mb-3">全局头像</h3>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg mx-auto relative">
              <img src={settings.avatar} className="w-full h-full object-cover" alt="Avatar" />
              <label className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-lg">📷 更换</span>
                <input type="file" onChange={e => handleUpload(e, 'avatar')} className="hidden" accept="image/*" />
              </label>
            </div>
          </div>
        )}
        
        {activeTab === 'icons' && (
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="font-bold text-gray-800 text-lg mb-3">自定义桌面图标</h3>
            <div className="grid grid-cols-4 gap-4">
              {(settings.widgets || []).filter(w => ['chat', 'book', 'couple', 'diary'].includes(w.id)).map(widget => (
                <div key={widget.id} className="flex flex-col items-center gap-2">
                  <label className="w-16 h-16 rounded-2xl overflow-hidden cursor-pointer relative group bg-gray-100 border">
                    {widget.customIcon ? (
                      <img src={widget.customIcon} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-3xl">{widget.icon}</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs">更换</span>
                    </div>
                    <input type="file" onChange={e => handleUpload(e, `widget-${widget.id}`)} className="hidden" accept="image/*" />
                  </label>
                  <span className="text-xs text-gray-600">{widget.text}</span>
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
// ==================== 复制粘贴到这里结束 ====================