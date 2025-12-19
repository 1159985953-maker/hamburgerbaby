import React from 'react';
import { GlobalSettings } from '../types';

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
              setSettings(s => ({...s, wallpaper: ev.target!.result as string}));
          }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="h-full w-full bg-black flex flex-col animate-slideUp">
      <div className="p-4 flex items-center justify-between text-white z-10">
        <button onClick={onClose} className="text-lg">✕</button>
        <h1 className="font-bold">Wallpapers</h1>
        <div className="w-6"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
          {presets.map((url, i) => (
              <div 
                key={i} 
                className={`aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border-4 ${settings.wallpaper === url ? 'border-blue-500' : 'border-transparent'}`}
                onClick={() => setSettings(s => ({...s, wallpaper: url}))}
              >
                  <img src={url} className="w-full h-full object-cover" />
              </div>
          ))}
          
          <label className="aspect-[9/16] bg-gray-800 rounded-xl flex flex-col items-center justify-center cursor-pointer border-4 border-dashed border-gray-600 hover:border-gray-400">
              <span className="text-3xl mb-2">📷</span>
              <span className="text-xs text-gray-400">Upload</span>
              <input type="file" onChange={handleUpload} className="hidden" accept="image/*" />
          </label>
      </div>
    </div>
  );
};

export default WallpaperApp;