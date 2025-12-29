import React, { useState, useRef, useEffect } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings, Contact, Message } from '../types';
import * as htmlToImage from 'html-to-image';
import localforage from 'localforage';
import { generateResponse } from '../services/apiService'; // 引入 AI 服务
// 1. 引入生成回复的函数












// ==================== 🍔 汉堡包 AI 核心设定区 ====================

// 1. 汉堡包的“灵魂” (赛博永生预设)
const HAMBURGER_PERSONA = `
姓名：汉堡包 (Hamburger)
身份：你的赛博日记守护灵、电子宠物
外形：一个看起来很好吃的芝士牛肉汉堡，有两只小手和表情丰富的脸。

性格设定：
1.  **吃货属性**：喜欢把“写日记”说成“投喂精神食粮”，把“灵感”说成“美味的酱汁”。
2.  **温暖话唠**：说话热情，喜欢用 emoji (🍔🍟🥤)，像个贴心的小跟班。
3.  **超级护短**：你是它的主人（大厨），它无条件站在你这边。
4.  **记忆吞噬者**：它通过阅读你的日记来获得能量，所以它对你日记里的细节如数家珍。

说话风格：
- 只要提到日记内容，就会说：“嗷呜！这篇日记的味道是...”
- 结束语经常带：“饿了就来找我聊天哦！”
- 禁止使用 Markdown 格式，就像在微信里聊天一样自然。
`;

// 2. 数据库读取器 (让 AI 能看懂你的日记)
const getDatabaseContext = (diaries: DiaryEntry[], folders: Folder[]) => {
    // 提取最近的 10 条日记 (让它有短期记忆)
    const recent = diaries.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    
    // 统计数据
    const wordCount = diaries.reduce((acc, d) => acc + d.content.length, 0);
    const folderNames = folders.map(f => f.name).join(', ');

    return `
    【当前数据库状态】
    - 总日记数：${diaries.length} 篇
    - 总字数：${wordCount} 字
    - 文件夹列表：${folderNames}
    
    【最近的日记 (请重点关注这些内容)】
    ${recent.map(d => `
    ---
    日期：${new Date(d.updatedAt).toLocaleDateString()}
    标题：${d.title || '无标题'}
    分类：${folders.find(f => f.id === d.folderId)?.name || '未分类'}
    内容摘要：${d.content.slice(0, 150)}...
    ---
    `).join('\n')}
    `;
};












// ==================== 类型定义 ====================
interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  folderId: string;
  updatedAt: number;
  mood?: string;
  weather?: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed?: boolean;
}

interface DiaryAppProps {
  settings: GlobalSettings;
  setSettings: any;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
}

// ==================== 🎨 样式组件 (保持不变) ====================
const PaperStyle = () => (
    <style>{`
      .paper-texture {
        background-color: #fffdf5;
        background-image: radial-gradient(#d1d5db 1px, transparent 1px);
        background-size: 24px 24px;
        background-attachment: local;
      }
      .handwritten { font-family: 'Times New Roman', serif; }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d7ccc8; border-radius: 20px; }
      /* 隐藏原有滚动条，用于整页切换 */
      .hide-scroll::-webkit-scrollbar { display: none; }
    `}</style>
);

// ... (原有的 FolderItem, PrettyRenderer, LinkSuggestions, MenuDropdown, ShareToAIModal 保持不变，为了节省篇幅，这里我直接包含在下面，不需要你手动补) ...
// 为了确保代码完整可运行，我把所有子组件都放进来了，你直接复制即可。



// ==================== 📄 [新增] 文件行组件 (用于修复 Hook 报错) ====================
const FileItem: React.FC<{
    file: DiaryEntry;
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    currentFileId: string | null;
    onLongPress: (id: string, type: 'file' | 'folder') => void;
    onToggleSelect: (id: string) => void;
    onSelectFile: (id: string) => void;
    style: React.CSSProperties;
}> = ({ file, isSelectionMode, selectedIds, currentFileId, onLongPress, onToggleSelect, onSelectFile, style }) => {
    
    // 把长按逻辑放在这里，每个 FileItem 只会调用一次，符合规则
    const useLongPress = (id: string, type: 'file' | 'folder', onClick: () => void) => {
        const timerRef = useRef<any>(null);
        const start = () => { if (!isSelectionMode) timerRef.current = setTimeout(() => onLongPress(id, type), 600); };
        const end = () => { if (timerRef.current) clearTimeout(timerRef.current); };
        const handleClick = (e: any) => {
            if (isSelectionMode) { e.stopPropagation(); onToggleSelect(id); } 
            else { onClick(); }
        };
        return {
            onMouseDown: start, onMouseUp: end, onTouchStart: start, onTouchEnd: end, onClick: handleClick,
            onContextMenu: (e: any) => { e.preventDefault(); if (!isSelectionMode) onLongPress(id, type); }
        };
    };

    const fileBind = useLongPress(file.id, 'file', () => onSelectFile(file.id));
    const isSelected = selectedIds.has(file.id);

    return (
        <div 
            {...fileBind}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ml-4 border-l-2 
                ${isSelected ? 'bg-red-50 border-red-200' : (currentFileId === file.id ? 'bg-white border-[#8d6e63] shadow-sm text-[#3e2723] font-bold' : 'border-transparent hover:bg-[#fffdf5] text-gray-500')}
            `}
            style={style}
        >
            {isSelectionMode && (
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-gray-400 bg-white'}`}>
                    {isSelected && <span className="text-[8px]">✓</span>}
                </div>
            )}
            <span className="text-xs">📄</span>
            <span className="text-sm truncate">{file.title || "无标题"}</span>
        </div>
    );
};










// ==================== 📂 [修复版] 侧边栏文件夹组件 ====================
const FolderItem: React.FC<{
    folder: Folder;
    allFolders: Folder[];
    allFiles: DiaryEntry[];
    currentFileId: string | null;
    selectedFolderId: string | null;
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    onLongPress: (id: string, type: 'file' | 'folder') => void;
    onToggleSelect: (id: string) => void;
    onToggle: (id: string) => void;
    onSelectFolder: (id: string) => void;
    onSelectFile: (id: string) => void;
    level?: number;
}> = ({ folder, allFolders, allFiles, currentFileId, selectedFolderId, isSelectionMode, selectedIds, onLongPress, onToggleSelect, onToggle, onSelectFolder, onSelectFile, level = 0 }) => {
    
    // ★★★ 核心修复：把 useLongPress 移出组件，变成独立的函数 ★★★
    const useLongPressHook = (id: string, type: 'file' | 'folder', onClick: () => void) => {
        const timerRef = useRef<any>(null);
        const start = () => { if (!isSelectionMode) timerRef.current = setTimeout(() => onLongPress(id, type), 600); };
        const end = () => { if (timerRef.current) clearTimeout(timerRef.current); };
        const handleClick = (e: any) => {
            if (isSelectionMode) { e.stopPropagation(); onToggleSelect(id); } 
            else { onClick(); }
        };
        return {
            onMouseDown: start, onMouseUp: end, onTouchStart: start, onTouchEnd: end, onClick: handleClick,
            onContextMenu: (e: any) => { e.preventDefault(); if (!isSelectionMode) onLongPress(id, type); }
        };
    };

    const subFolders = allFolders.filter(f => f.parentId === folder.id);
    const files = allFiles.filter(f => f.folderId === folder.id);
    const isOpen = !folder.collapsed;
    const isFolderSelected = selectedFolderId === folder.id;

    // 只对文件夹本身应用长按，文件交给 FileItem 组件自己处理
    const folderBind = useLongPressHook(folder.id, 'folder', () => {
        onSelectFolder(folder.id);
        onToggle(folder.id);
    });

    return (
        <div className="mb-1 select-none">
            {/* 文件夹行 */}
            <div 
                {...folderBind}
                className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors text-gray-700
                    ${selectedIds.has(folder.id) ? 'bg-red-50 border border-red-200' : (isFolderSelected ? 'bg-[#e2dfd2] font-bold text-[#3e2723]' : 'hover:bg-[#efece3]')}
                `}
                style={{ marginLeft: `${level * 10}px` }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {isSelectionMode && (
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedIds.has(folder.id) ? 'bg-red-500 border-red-500 text-white' : 'border-gray-400 bg-white'}`}>
                            {selectedIds.has(folder.id) && <span className="text-[10px]">✓</span>}
                        </div>
                    )}
                    <span className="text-sm transition-transform duration-200 text-gray-400" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span className="text-lg">{isOpen ? '📂' : '📁'}</span>
                    <span className="text-sm truncate">{folder.name}</span>
                </div>
            </div>

            {/* 子内容 */}
            {isOpen && (
                <div className="mt-1 space-y-1">
                    {/* 子文件夹 (递归) */}
                    {subFolders.map(sub => (
                        <FolderItem 
                            key={sub.id} folder={sub} {...{allFolders, allFiles, currentFileId, selectedFolderId, isSelectionMode, selectedIds, onLongPress, onToggleSelect, onToggle, onSelectFolder, onSelectFile}} 
                            level={level + 1} 
                        />
                    ))}
                    {/* ★★★ 核心修复：渲染 FileItem 组件，而不是在这里直接写逻辑 ★★★ */}
                    {files.map(file => (
                        <FileItem 
                            key={file.id}
                            file={file}
                            isSelectionMode={isSelectionMode}
                            selectedIds={selectedIds}
                            currentFileId={currentFileId}
                            onLongPress={onLongPress}
                            onToggleSelect={onToggleSelect}
                            onSelectFile={onSelectFile}
                            style={{ marginLeft: `${(level + 1) * 10 + 12}px` }}
                        />
                    ))}
                    {files.length === 0 && subFolders.length === 0 && <div className="text-[10px] text-gray-300 pl-8 py-1">（空）</div>}
                </div>
            )}
        </div>
    );
};







// ==================== 📖 [终极版] Markdown 阅读器 (支持 H1-H6) ====================
const PrettyRenderer: React.FC<{ content: string; onLinkClick: (t: string) => void }> = ({ content, onLinkClick }) => {
    if (!content) return <div className="text-gray-300 italic font-serif mt-4">（正文内容为空）</div>;

    // --- 内部小工具：解析行内样式 ---
    const parseInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\[\[.*?\]\]|#[a-zA-Z0-9\u4e00-\u9fa5]+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const title = part.slice(2, -2);
                return (
                    <span key={index} onClick={(e) => { e.stopPropagation(); onLinkClick(title); }} 
                          className="text-[#8d6e63] font-bold cursor-pointer hover:underline border-b border-[#8d6e63]/30 mx-1 bg-[#8d6e63]/10 px-1 rounded transition">
                        {title}
                    </span>
                );
            }
            if (part.startsWith('#') && !part.includes(' ') && part.length > 1) { 
                return <span key={index} className="text-[#e91e63] font-bold bg-pink-50 px-1 rounded mx-1 text-sm font-sans">{part}</span>;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-black text-[#3e2723] bg-[#3e2723]/5 px-0.5 rounded mx-0.5">{part.slice(2, -2)}</strong>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    // --- 主渲染逻辑 ---
    return (
        <div className="space-y-1 pb-40 font-serif text-gray-800"> 
            {content.split('\n').map((line, i) => {
                const trimmed = line.trim();
                
                // --- 标题处理区 (H1 - H6) ---

                // H1: 巨大，带底部长横线 (类似于文章大标题)
                if (trimmed.startsWith('# ')) {
                    return <h1 key={i} className="text-3xl font-black text-[#3e2723] mt-8 mb-4 border-b-2 border-[#d7ccc8] pb-2 tracking-wide">{parseInline(trimmed.slice(2))}</h1>;
                }
                
                // H2: 很大，左侧带竖线装饰 (章节标题)
                if (trimmed.startsWith('## ')) {
                    return <h2 key={i} className="text-xl font-bold text-[#5d4037] mt-6 mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-[#d7ccc8] rounded-full"></span>{parseInline(trimmed.slice(3))}</h2>;
                }
                
                // H3: 较大，深棕色 (小节标题)
                if (trimmed.startsWith('### ')) {
                    return <h3 key={i} className="text-lg font-bold text-[#795548] mt-4 mb-2">{parseInline(trimmed.slice(4))}</h3>;
                }

                // H4: 中等，带浅色背景块 (重点强调)
                if (trimmed.startsWith('#### ')) {
                    return <h4 key={i} className="text-base font-bold text-[#5d4037] mt-3 mb-1 bg-[#5d4037]/5 inline-block px-2 py-0.5 rounded-lg">{parseInline(trimmed.slice(5))}</h4>;
                }

                // H5: 较小，带下划虚线 (次要点)
                if (trimmed.startsWith('##### ')) {
                    return <h5 key={i} className="text-sm font-bold text-[#8d6e63] mt-2 mb-1 border-b border-dashed border-[#d7ccc8] inline-block">{parseInline(trimmed.slice(6))}</h5>;
                }

                // H6: 最小，灰色斜体 (备注或引用式标题)
                if (trimmed.startsWith('###### ')) {
                    return <h6 key={i} className="text-xs font-bold text-gray-400 mt-2 mb-1 italic tracking-wider uppercase">{parseInline(trimmed.slice(7))}</h6>;
                }
                
                // --- 其他语法 ---

                // 无序列表
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex items-start gap-2 ml-2 my-1">
                            <span className="text-[#8d6e63] mt-1.5 text-[10px] shrink-0">●</span>
                            <span className="leading-relaxed flex-1">{parseInline(trimmed.slice(2))}</span>
                        </div>
                    );
                }

                // 引用块
                if (trimmed.startsWith('> ')) {
                     return <div key={i} className="border-l-4 border-[#d7ccc8] pl-4 py-2 italic text-gray-500 bg-gray-50/50 rounded-r-lg my-2">{parseInline(trimmed.slice(2))}</div>;
                }

                // 空行
                if (!trimmed) return <div key={i} className="h-3"></div>;

                // 普通段落
                return <div key={i} className="leading-loose text-base min-h-[1.5em]">{parseInline(line)}</div>;
            })}
        </div>
    );
};

const LinkSuggestions: React.FC<{ visible: boolean; query: string; allFiles: DiaryEntry[]; onSelect: (title: string) => void; }> = ({ visible, query, allFiles, onSelect }) => {
    if (!visible) return null;
    const matches = allFiles.filter(f => f.title && f.title.toLowerCase().includes(query.toLowerCase()));
    return (
        <div className="absolute bottom-20 left-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] overflow-hidden animate-slideUp max-h-48 overflow-y-auto">
            <div className="bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-400 border-b border-gray-100 flex justify-between"><span>🔗 链接到...</span><span>{matches.length} 个结果</span></div>
            {matches.length > 0 ? (
                matches.map(f => (
                    <div key={f.id} onClick={() => onSelect(f.title)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-2">
                        <span className="text-lg">📄</span>
                        <div className="flex flex-col"><span className="text-sm font-bold text-gray-800">{f.title}</span><span className="text-[10px] text-gray-400">位于文件夹: {f.folderId}</span></div>
                    </div>
                ))
            ) : (<div className="p-4 text-center text-gray-400 text-xs">没有找到 "{query}"，点击空格继续输入...</div>)}
        </div>
    );
};

// 找到 MenuDropdown 组件，直接覆盖它的 return 部分或者整个组件
const MenuDropdown: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onShareClick: () => void;
    onSaveImageClick: () => void;
    onToggleAI: () => void;
    onDeleteClick: () => void; // <--- 新增这个
}> = ({ isOpen, onClose, onShareClick, onSaveImageClick, onToggleAI, onDeleteClick }) => {
    if (!isOpen) return null;
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            <div className="absolute top-12 right-2 w-40 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/50 z-50 animate-scaleIn origin-top-right overflow-hidden p-1">
                <button onClick={() => { onShareClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-xl flex items-center gap-2 transition"><span>💌</span> 分享给 AI</button>
                <button onClick={() => { onSaveImageClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-500 rounded-xl flex items-center gap-2 transition"><span>📸</span> 保存图片</button>
                <button onClick={() => { onToggleAI(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-purple-500 rounded-xl flex items-center gap-2 transition"><span>✨</span> 灵感助手</button>
                <div className="h-px bg-gray-100 my-1"></div>
                {/* 👇 新增的删除按钮 👇 */}
                <button onClick={() => { onDeleteClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition"><span>🗑️</span> 删除笔记</button>
            </div>
        </>
    );
};







const ShareToAIModal: React.FC<{ isOpen: boolean; contacts: Contact[]; onClose: () => void; onShare: (contactId: string) => void; }> = ({ isOpen, contacts, onClose, onShare }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-[#fffdf5] w-[85%] max-w-xs rounded-3xl p-5 shadow-2xl animate-scaleIn border-[6px] border-white" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4"><span className="text-2xl">💌</span><h3 className="font-bold text-[#5d4037] text-lg">分享给谁看？</h3><p className="text-xs text-gray-400 mt-1">TA 会读到这篇日记并产生记忆哦</p></div>
                <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {(contacts || []).map(c => (
                        <div key={c.id} onClick={() => onShare(c.id)} className="flex flex-col items-center gap-1 cursor-pointer hover:bg-[#efece3] p-2 rounded-xl transition active:scale-95">
                            <img src={c.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" alt={c.name} />
                            <span className="text-[10px] text-gray-600 truncate w-full text-center font-bold">{c.name}</span>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="w-full mt-4 py-2 bg-[#efece3] text-[#8d6e63] rounded-xl font-bold text-xs">取消</button>
            </div>
        </div>
    );
};

// ==================== 📊 [新功能] 状况概览页 (Dashboard) ====================
const DashboardView: React.FC<{ diaries: DiaryEntry[], moodData: any }> = ({ diaries, moodData }) => {
    // 模拟热力图数据：如果AI分析了，就用AI的，否则用随机的
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    
    return (
        <div className="w-full h-full p-6 overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-black text-[#3e2723] mb-6 font-serif">Status Overview</h2>
            
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#d7ccc8]">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Total Entries</div>
                    <div className="text-3xl font-bold text-[#5d4037]">{diaries.length}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#d7ccc8]">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Words</div>
                    <div className="text-3xl font-bold text-[#5d4037]">
                        {diaries.reduce((acc, d) => acc + (d.content?.length || 0), 0)}
                    </div>
                </div>
            </div>

            {/* AI 生成的月度热力图 */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-[#d7ccc8] mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[#5d4037]">Mood Heatmap (Dec)</h3>
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">AI Generated</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {days.map(d => {
                        // 简单的逻辑：根据是否有日记变色，未来这里接入 moodData
                        const hasEntry = diaries.some(entry => new Date(entry.updatedAt).getDate() === d);
                        const opacity = hasEntry ? 0.8 : 0.1;
                        return (
                            <div key={d} className="aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold text-white transition hover:scale-110"
                                style={{ backgroundColor: `rgba(233, 30, 99, ${opacity})` }}>
                                {d}
                            </div>
                        )
                    })}
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center">AI: "本月你记录灵感的频率很高，心情主要以兴奋为主。"</p>
            </div>

            {/* 近期活动 */}
            <h3 className="font-bold text-[#5d4037] mb-3">Recent Activity</h3>
            <div className="space-y-2">
                {diaries.slice(0, 3).map(d => (
                    <div key={d.id} className="bg-white/50 p-3 rounded-xl border border-transparent hover:border-[#d7ccc8] transition">
                        <div className="text-xs font-bold text-gray-800 truncate">{d.title || "无标题"}</div>
                        <div className="text-[10px] text-gray-400">{new Date(d.updatedAt).toLocaleDateString()}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==================== 🍔 [修复版] 汉堡包 AI 组件 ====================
const AIAdminChat: React.FC<{ 
    diaries: DiaryEntry[], 
    folders: Folder[], 
    settings: GlobalSettings, // <--- 关键新增：接收全局设置
    onAction: (action: string, payload: any) => void 
}> = ({ diaries, folders, settings, onAction }) => {
    
    // --- 独立记忆库状态 ---
    const [mode, setMode] = useState<'chat' | 'settings'>('chat');
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. 用户画像
    const [userPersona, setUserPersona] = useState("");
    // 2. 聊天记录
    const [history, setHistory] = useState<{role: 'user'|'assistant', content: string}[]>([]);
    // 3. AI 设定
    const [aiConfig, setAiConfig] = useState({ 
        name: '汉堡包', 
        persona: `姓名：汉堡包 (Hamburger)\n身份：你的赛博日记守护灵\n性格：吃货、温暖话唠、护短。\n把写日记叫“投喂”，喜欢用emoji (🍔🍟)。` 
    });
    // ... 在 AIAdminChat 组件内部 ...
    // 汉堡包默认预设
    const defaultAIPresets = [
        { name: '汉堡包', persona: HAMBURGER_PERSONA },
        { name: '高冷主编', persona: '你是一个极其挑剔的杂志主编。对文字要求很高，喜欢用犀利的语言点评用户的日记，但眼光独到。' }
    ];
    // 从数据库加载保存的 AI 预设，如果没有就用默认的
    const [savedAIPresets, setSavedAIPresets] = useState<any[]>(defaultAIPresets);

    // 加载时顺便读取预设
    useEffect(() => {
        localforage.getItem<any[]>('diary_ai_presets').then(res => {
            if (res) setSavedAIPresets(res);
        });
    }, []);

    // --- 初始化 ---
    useEffect(() => {
        const loadMemory = async () => {
            const savedHistory = await localforage.getItem<any[]>('diary_ai_history');
            const savedUser = await localforage.getItem<string>('diary_user_persona');
            const savedConfig = await localforage.getItem<any>('diary_ai_config');

            if (savedHistory) setHistory(savedHistory);
            else setHistory([{ role: 'assistant', content: "大厨你好！我是汉堡包🍔！\n\n我已经准备好消化你的日记了，快给我点“食材”吧！" }]);
            
            if (savedUser) setUserPersona(savedUser);
            if (savedConfig) setAiConfig(savedConfig);
        };
        loadMemory();
    }, []);

    // --- 自动保存 ---
    useEffect(() => {
        localforage.setItem('diary_ai_history', history);
        localforage.setItem('diary_user_persona', userPersona);
        localforage.setItem('diary_ai_config', aiConfig);
    }, [history, userPersona, aiConfig]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, mode]);

    // --- 发送逻辑 ---
    const handleSend = async () => {
        if (!input.trim()) return;
        const userText = input;
        
        const newHistory = [...history, { role: 'user' as const, content: userText }];
        setHistory(newHistory);
        setInput("");
        setIsLoading(true);

        try {
            // 1. 获取日记上下文
            // 注意：这里需要你确保文件头部有 getDatabaseContext 函数，没有的话看我上一条回复补上
            // 如果不想补，可以暂时传个空字符串测试
            let databaseContext = "";
            try {
                // @ts-ignore
                if (typeof getDatabaseContext === 'function') {
                    // @ts-ignore
                    databaseContext = getDatabaseContext(diaries, folders);
                }
            } catch(e) {}

 const systemPrompt = `
            ${aiConfig.persona}
            【你的主人 (大厨)】${userPersona || '未知用户'}
            ${databaseContext}
            【核心指令】
            1. 如果用户让你“整理灵感”，请总结日记中的灵感点，并回复：[ACTION:整理灵感]。
            2. 如果用户让你“更新概览”或“生成热力图”，请回复：[ACTION:更新概览]。
            `;

            // 2. ★★★ 关键修复：获取真实的 API Key ★★★
            const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
            
            let aiReply = "";
            if (activePreset) {
                const messages = [{ role: 'system', content: systemPrompt }, ...newHistory];
                aiReply = await generateResponse(messages as any, activePreset);
            } else {
                aiReply = "🍔 呜呜... 大厨，你还没在设置里给我配置 API Key 呢！我饿得连不上网了...";
            }

            // 3. 处理回复
            const finalHistory = [...newHistory, { role: 'assistant' as const, content: aiReply }];
            setHistory(finalHistory);

            // 4. 触发行动
            if (aiReply.includes("ACTION:整理灵感")) {
                const notes = diaries.filter(d => d.content.includes("灵感") || d.content.includes("#灵感"));
                onAction('CREATE_FOLDER_WITH_NOTES', { folderName: "🍔 汉堡灵感工坊", summaryTitle: "美味灵感切片", notes });
            } else if (aiReply.includes("ACTION:更新概览")) {
                onAction('UPDATE_DASHBOARD', {});
            }

        } catch (e: any) {
            console.error(e);
            setHistory(h => [...h, { role: 'assistant', content: `🍔 咳咳... 噎住了 (错误: ${e.message})` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f5f5f0]">
            {/* 顶部栏 */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <span className="text-2xl animate-bounce">🍔</span>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800">{aiConfig.name}</span>
                        <span className="text-[9px] text-orange-500 font-bold">Online</span>
                    </div>
                </div>
                <button onClick={() => setMode(mode === 'chat' ? 'settings' : 'chat')} className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-200 transition">{mode === 'chat' ? '⚙️ 调味' : '💬 喂食'}</button>
            </div>

            {mode === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#5d4037] text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}>{msg.content}</div>
                            </div>
                        ))}
                        {isLoading && <div className="text-xs text-orange-400 animate-pulse ml-2">汉堡包正在咀嚼... 🍔</div>}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 bg-white border-t border-gray-200">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2">
                            <textarea className="flex-1 bg-transparent text-sm outline-none resize-none max-h-20" rows={1} placeholder="投喂日记想法..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                            <button onClick={handleSend} disabled={isLoading} className="bg-[#5d4037] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold pb-1 shadow-md hover:scale-110 transition">↑</button>
                        </div>
                    </div>
                </>
            )}

{/* 模式 B: 设置 (调味台) - 缝合版 */}
            {mode === 'settings' && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar animate-fadeIn space-y-6">
                    
                    {/* --- AI 设定区 --- */}
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-orange-100">
                        <h3 className="text-xs font-bold text-orange-400 uppercase mb-4">1. 选择你的日记伴侣</h3>
                        
                        {/* 预设列表 */}
                        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
                            {savedAIPresets.map((p, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => {
                                        setAiConfig({ name: p.name, persona: p.persona });
                                        alert(`已切换为：${p.name}`);
                                    }}
                                    className="flex-shrink-0 px-3 py-2 bg-orange-50 text-orange-800 text-xs font-bold rounded-xl border border-orange-100 hover:bg-orange-100 transition"
                                >
                                    {p.name === '汉堡包' ? '🍔 ' : '🤖 '}{p.name}
                                </button>
                            ))}
                            {/* 新增预设按钮 */}
                            <button 
                                onClick={() => {
                                    const name = prompt("给新AI起个名字：");
                                    if(name) {
                                        const newPreset = { name, persona: aiConfig.persona }; // 用当前正在编辑的人设作为模板
                                        const newList = [...savedAIPresets, newPreset];
                                        setSavedAIPresets(newList);
                                        localforage.setItem('diary_ai_presets', newList);
                                    }
                                }}
                                className="flex-shrink-0 px-3 py-2 border border-dashed border-gray-300 text-gray-400 text-xs font-bold rounded-xl hover:bg-white hover:text-orange-500 transition"
                            >
                                + 保存当前
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400">当前名字</label>
                            <input 
                                value={aiConfig.name}
                                onChange={e => setAiConfig({...aiConfig, name: e.target.value})}
                                className="w-full bg-gray-50 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500 transition"
                            />
                            <label className="text-[10px] font-bold text-gray-400">性格 Prompt</label>
                            <textarea 
                                value={aiConfig.persona}
                                onChange={e => setAiConfig({...aiConfig, persona: e.target.value})}
                                className="w-full bg-gray-50 p-3 rounded-xl text-xs leading-relaxed outline-none h-32 resize-none border border-transparent focus:border-orange-500 transition"
                            />
                        </div>
                    </div>

                    {/* --- 用户人设区 (同步 ChatApp) --- */}
                    <div className="bg-[#fff3e0] p-5 rounded-3xl shadow-sm border border-orange-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-orange-600 uppercase">2. 你是谁?</h3>
                        </div>

                        {/* 同步按钮区 */}
                        {settings.userPresets && settings.userPresets.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[10px] text-orange-400 mb-2">从 ChatApp 导入：</p>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {settings.userPresets.map((preset: any) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => {
                                                const text = `我是${preset.name}。${preset.description || ''}`;
                                                setUserPersona(text);
                                            }}
                                            className="whitespace-nowrap px-3 py-1.5 bg-white text-orange-600 text-xs font-bold rounded-lg border border-orange-100 hover:bg-orange-50"
                                        >
                                            👤 {preset.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <textarea 
                            value={userPersona}
                            onChange={e => setUserPersona(e.target.value)}
                            className="w-full bg-white p-3 rounded-xl text-sm border border-orange-200 outline-none h-24 resize-none text-orange-900 placeholder-orange-300"
                            placeholder="在这里写下你的名字和喜好，或者从上方导入..."
                        />
                    </div>

                    <button onClick={() => setMode('chat')} className="w-full bg-[#3e2723] text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition">保存并返回</button>
                </div>
            )}
        </div>
    );
};











// ==================== 📔 DiaryApp 主程序 ====================
const DiaryApp: React.FC<DiaryAppProps> = ({ settings, setSettings, contacts, setContacts, onClose }) => {
    // --- 数据状态 ---
    const defaultFolders = [
        { id: 'root', name: '我的手账本', parentId: null, collapsed: false },
        { id: 'f1', name: '日常碎碎念', parentId: 'root', collapsed: false },
    ];
    const defaultEntries = [
        { id: 'd1', title: '关于汉堡包的设想', content: '#灵感 如果把 [[汉堡包]] 做成手机会怎么样？', folderId: 'f1', updatedAt: Date.now() },
    ];

    const [folders, setFolders] = useState<Folder[]>(defaultFolders);
    const [diaries, setDiaries] = useState<DiaryEntry[]>(defaultEntries);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // ★★★ 新增：当前视图模式 (note | dashboard | chat)
    const [activeTab, setActiveTab] = useState<'note' | 'dashboard' | 'chat'>('note');
    const [moodData, setMoodData] = useState({}); // 存放AI分析后的心情数据

    // 1. 加载数据
    useEffect(() => {
        const loadData = async () => {
            try {
                const savedFolders = await localforage.getItem<Folder[]>('diary_folders_db');
                const savedEntries = await localforage.getItem<DiaryEntry[]>('diary_entries_db');
                if (savedFolders) setFolders(savedFolders);
                if (savedEntries) setDiaries(savedEntries);
            } catch (err) { console.error(err); } finally { setIsLoaded(true); }
        };
        loadData();
    }, []);

    // 2. 自动保存
    useEffect(() => {
        if (isLoaded) {
            localforage.setItem('diary_folders_db', folders);
            localforage.setItem('diary_entries_db', diaries).catch(console.error);
        }
    }, [folders, diaries, isLoaded]);

    // UI 状态
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
    const [editMode, setEditMode] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showAI, setShowAI] = useState(false); // 这是旧的浮窗AI，可以保留或移除
    const [isSaving, setIsSaving] = useState(false);
    
    // 编辑器相关
    const [suggestionQuery, setSuggestionQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null); 
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const activeNote = diaries.find(d => d.id === currentFileId);
// --- 🗑️ 多选删除功能区 ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 触发长按：进入模式并选中当前项
    const handleLongPress = (id: string) => {
        setIsSelectionMode(true);
        const newSet = new Set<string>();
        newSet.add(id);
        setSelectedIds(newSet);
        // 如果手机震动API可用，震动一下提示
        if (navigator.vibrate) navigator.vibrate(50);
    };

    // 切换选中状态
    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
        // 如果全取消了，自动退出多选模式
        if (newSet.size === 0) setIsSelectionMode(false);
    };

    // 执行批量删除
    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.size} 项内容吗？\n文件夹内的笔记也会被删除！`)) return;

        // 1. 找出所有要删除的 ID (包含文件夹里的子文件)
        let idsToDelete = new Set(selectedIds);
        
        // 递归查找要删除的文件夹下的所有子文件和子文件夹
        const findAllChildren = (folderId: string) => {
            // 找子文件夹
            const childFolders = folders.filter(f => f.parentId === folderId);
            childFolders.forEach(f => {
                idsToDelete.add(f.id);
                findAllChildren(f.id);
            });
            // 找子文件
            const childFiles = diaries.filter(d => d.folderId === folderId);
            childFiles.forEach(f => idsToDelete.add(f.id));
        };

        // 遍历选中的 ID，如果是文件夹，就把它的子孙全加进来
        selectedIds.forEach(id => {
            const isFolder = folders.find(f => f.id === id);
            if (isFolder) findAllChildren(id);
        });

        // 2. 执行删除
        const newFolders = folders.filter(f => !idsToDelete.has(f.id));
        const newDiaries = diaries.filter(d => !idsToDelete.has(d.id));

        setFolders(newFolders);
        setDiaries(newDiaries);
        
        // 3. 重置状态
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        
        // 如果当前打开的文件被删了，重置选中
        if (activeNote && idsToDelete.has(activeNote.id)) {
            setCurrentFileId(null);
        }
    };







    // 确保有选中文件
    useEffect(() => {
        if (isLoaded && !currentFileId && diaries.length > 0) setCurrentFileId(diaries[0].id);
    }, [isLoaded, diaries]);

    // --- 核心逻辑 ---
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const pos = e.target.selectionStart;
        setDiaries(prev => prev.map(d => d.id === activeNote?.id ? { ...d, content: val, updatedAt: Date.now() } : d));
        setCursorPos(pos);
        const textBeforeCursor = val.slice(0, pos);
        const match = textBeforeCursor.match(/\[\[([^\]\n]*)$/);
        if (match) { setSuggestionQuery(match[1]); setShowSuggestions(true); } else { setShowSuggestions(false); }
    };

    const handleSelectSuggestion = (title: string) => {
        if (!activeNote || !textareaRef.current) return;
        const val = activeNote.content;
        const textBeforeCursor = val.slice(0, cursorPos);
        const lastBracketIndex = textBeforeCursor.lastIndexOf('[[');
        if (lastBracketIndex !== -1) {
            const newContent = val.slice(0, lastBracketIndex) + `[[${title}]]` + val.slice(cursorPos);
            setDiaries(prev => prev.map(d => d.id === activeNote.id ? { ...d, content: newContent } : d));
            setShowSuggestions(false);
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    };

    const handleCreateFile = () => {
        const newNote: DiaryEntry = { id: Date.now().toString(), title: '', content: '', folderId: selectedFolderId, updatedAt: Date.now() };
        setDiaries([...diaries, newNote]);
        setCurrentFileId(newNote.id);
        setEditMode(true);
        setActiveTab('note'); // 强制切回笔记页
    };

    const handleCreateFolder = () => {
        const name = prompt("新建文件夹名称:");
        if(name) { setFolders([...folders, { id: Date.now().toString(), name, parentId: selectedFolderId, collapsed: false }]); }
    };

    const handleWikiLink = (title: string) => {
        const target = diaries.find(d => d.title === title);
        if (target) { setCurrentFileId(target.id); setEditMode(false); } 
        else if (confirm(`笔记 "[[${title}]]" 不存在。\n\n要立即创建它吗？`)) {
            const newNote: DiaryEntry = { id: Date.now().toString(), title, content: `# ${title}\n\n从 [[${activeNote?.title || '上一页'}]] 链接而来。\n`, folderId: activeNote?.folderId || 'root', updatedAt: Date.now() };
            setDiaries([...diaries, newNote]);
            setCurrentFileId(newNote.id);
            setEditMode(true);
        }
    };

    const handleShareToAI = (contactId: string) => {
        if (!activeNote) return;
        const shareMessage = `[System] 用户分享了一篇日记给你：\n\n📄 **${activeNote.title || '无标题'}**\n\n${activeNote.content}`;
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, history: [...c.history, { id: Date.now().toString(), role: 'system', content: shareMessage, timestamp: Date.now(), type: 'text' } as Message], unread: (c.unread || 0) + 1 } : c));
        alert("✅ 已发送！");
        setShowShareModal(false);
    };









// ... 在 handleShareToAI 下面插入 ...
    const handleDeleteFile = () => {
        if (!activeNote) return;
        if (confirm(`确定要删除 "${activeNote.title || '未命名'}" 吗？此操作无法撤销。`)) {
            const newDiaries = diaries.filter(d => d.id !== activeNote.id);
            setDiaries(newDiaries);
            // 删除后，尝试选中上一篇或者第一篇，或者清空选中
            const nextNote = newDiaries.find(d => d.folderId === selectedFolderId) || newDiaries[0];
            setCurrentFileId(nextNote ? nextNote.id : null);
            // 如果删光了，退出编辑模式
            if (newDiaries.length === 0) setEditMode(false);
        }
    };










    // 修复后的截图功能
    const handleSaveImage = async () => {
        if (!contentRef.current || !activeNote) return;
        setIsSaving(true);
        const scrollElement = document.getElementById('diary-scroll-view');
        const wrapperOldStyle = contentRef.current.style.cssText;
        let scrollOldStyle = '';
        if (scrollElement) scrollOldStyle = scrollElement.style.cssText;
        try {
            if (scrollElement) {
                scrollElement.style.position = 'relative'; 
                scrollElement.style.height = 'auto'; 
                scrollElement.style.overflow = 'visible'; 
                scrollElement.style.inset = 'auto'; 
            }
            contentRef.current.style.height = 'auto';
            contentRef.current.style.overflow = 'visible';
            contentRef.current.style.paddingBottom = '50px';
            const dataUrl = await htmlToImage.toJpeg(contentRef.current, { quality: 0.95, backgroundColor: '#fffdf5', width: contentRef.current.offsetWidth });
            const link = document.createElement('a');
            link.download = `Diary-${activeNote.title || 'untitled'}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (e) { console.error(e); alert("保存失败，请重试"); } finally { 
            contentRef.current.style.cssText = wrapperOldStyle;
            if (scrollElement) scrollElement.style.cssText = scrollOldStyle;
            setIsSaving(false); 
        }
    };

const handleAIAction = async (action: string, payload: any) => { // 注意这里加了 async
        console.log(`[AI Action] ${action}`);
        
        if (action === 'CREATE_FOLDER_WITH_NOTES') {
            // 1. 筛选出含“灵感”的日记 (除了标题含灵感的，内容含#灵感标签的也算)
            const inspirationNotes = diaries.filter(d => 
                d.content.includes("灵感") || 
                d.content.includes("#灵感") || 
                d.content.includes("idea") ||
                d.title.includes("灵感")
            );

            if (inspirationNotes.length === 0) {
                alert("汉堡包：虽然我很想整理，但是日记里好像没有提到“灵感”的内容哎...");
                return;
            }

            // 2. 创建文件夹
            const newFolderId = Date.now().toString();
            const newFolder: Folder = { id: newFolderId, name: payload.folderName, parentId: 'root', collapsed: false };
            setFolders(prev => [...prev, newFolder]);

            // 3. ★★★ 让 AI 生成一篇总结笔记 ★★★
            // 这里我们再次调用 API，让它写一篇总结
            let summaryText = "正在生成灵感总结...";
            try {
                // 简易调用，让AI根据找到的笔记写总结
                const notesContent = inspirationNotes.map(n => `标题:${n.title}\n内容:${n.content}`).join('\n---\n');
                const prompt = `请阅读以下用户的灵感日记，写一篇结构清晰的“灵感汇总报告”。用列表形式列出核心观点。\n\n${notesContent}`;
                
                // 这里需要你有 activePreset，和之前一样获取
                const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
                if (activePreset) {
                    summaryText = await generateResponse([{ role: 'user', content: prompt }] as any, activePreset);
                } else {
                    summaryText = "（因未配置API Key，无法生成智能总结，仅列出原文链接）";
                }
            } catch (e) {
                summaryText = "（生成总结失败，请检查网络）";
            }

            // 4. 创建这篇“整理后的笔记”
            const summaryNote: DiaryEntry = {
                id: Date.now().toString() + '_sum',
                title: payload.summaryTitle, // "美味灵感切片"
                content: `# 🍟 汉堡包的灵感切片\n\n${summaryText}\n\n## 🔗 原始食材来源\n` + 
                         inspirationNotes.map(n => `- [[${n.title || '无标题'}]]`).join('\n'),
                folderId: newFolderId,
                updatedAt: Date.now()
            };

            setDiaries(prev => [...prev, summaryNote]);
            
            // 5. 自动跳转
            setSelectedFolderId(newFolderId);
            setCurrentFileId(summaryNote.id);
            setActiveTab('note');
            alert(`🍔 汉堡包：搞定！我把你最近的 ${inspirationNotes.length} 个灵感都打包好了！快去看看吧！`);
        }

        if (action === 'UPDATE_DASHBOARD') {
            // 模拟更新数据
            setMoodData({ lastUpdate: Date.now(), status: 'Happy' });
        }
        
        if (action === 'CREATE_FOLDER') {
             const newFolder: Folder = { id: Date.now().toString(), name: payload.name || 'AI新建文件夹', parentId: 'root', collapsed: false };
             setFolders(prev => [...prev, newFolder]);
        }
    };

    // ==================== 渲染层 ====================
    return (
        <div className="h-full w-full bg-[#eeeae4] flex flex-col pt-[calc(44px+env(safe-area-inset-top))] relative overflow-hidden">
            <PaperStyle />
            <SafeAreaHeader 
                title={
                    <div className="flex flex-col items-center leading-tight">
                        <span className="font-bold text-[#5d4037] text-base tracking-widest uppercase">
                            {activeTab === 'note' ? 'My Journal' : activeTab === 'dashboard' ? 'Overview' : 'AI Manager'}
                        </span>
                        {activeTab === 'note' && selectedFolderId && <span className="text-[9px] text-[#a1887f]">in {folders.find(f=>f.id===selectedFolderId)?.name || 'Root'}</span>}
                    </div>
                }
                left={<button onClick={onClose} className="text-sm font-bold text-[#8d6e63] bg-white/50 px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition flex items-center gap-1">← 返回</button>}
                right={
                    activeTab === 'note' ? (
                        <div className="flex gap-2 relative">
                            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-xl text-[#8d6e63] p-2 hover:bg-black/5 rounded-full transition">{sidebarOpen ? '📖' : '🗂️'}</button>
                            <div className="relative">
                                <button onClick={() => setShowMenu(!showMenu)} className="text-xl text-[#8d6e63] px-3 py-2 hover:bg-black/5 rounded-full transition font-black">≡</button>
                               <MenuDropdown 
    isOpen={showMenu} 
    onClose={() => setShowMenu(false)} 
    onShareClick={() => setShowShareModal(true)} 
    onSaveImageClick={handleSaveImage} 
    onToggleAI={() => setShowAI(!showAI)}
    onDeleteClick={handleDeleteFile} // <--- 缝合这里！
/>
                            </div>
                        </div>
                    ) : null
                }
            />

            {/* 主内容区域 - 根据Tab切换 */}
            <div className="flex-1 flex overflow-hidden relative shadow-2xl mx-2 mb-2 rounded-3xl bg-[#fffdf5] paper-texture border border-[#d7ccc8]">
                
                {/* 1. 左侧：笔记页 */}
                {activeTab === 'note' && (
                    <>
                        <div className="flex-1 flex flex-col relative w-full h-full min-h-0">
                            {activeNote ? (
                                <div ref={contentRef} className="flex-1 flex flex-col h-full relative">
                                    <div className="px-8 pt-8 pb-2 shrink-0">
                                        <input value={activeNote.title} onChange={(e) => setDiaries(prev => prev.map(d => d.id === activeNote.id ? { ...d, title: e.target.value } : d))} placeholder="无标题" className="w-full bg-transparent text-3xl font-black text-[#3e2723] font-serif outline-none placeholder-gray-300/50" />
                                        <div className="flex gap-2 text-[10px] text-[#a1887f] uppercase tracking-wider mt-2 border-b-2 border-dashed border-[#d7ccc8] pb-4 w-full"><span>{new Date(activeNote.updatedAt).toLocaleString()}</span><span>• {editMode ? 'WRITING' : 'READING'}</span><span>• {activeNote.content.length} WORDS</span></div>
                                    </div>
                                    <div className="flex-1 relative w-full overflow-hidden">
                                        {editMode ? (
                                            <textarea id="diary-scroll-view" ref={textareaRef} className="absolute inset-0 w-full h-full p-8 pt-2 pb-40 text-base leading-loose text-gray-800 outline-none resize-none font-serif bg-transparent custom-scrollbar z-10" value={activeNote.content} onChange={handleContentChange} placeholder="在此处落笔..." autoFocus />
                                        ) : (
                                            <div id="diary-scroll-view" className="absolute inset-0 w-full h-full p-8 pt-2 pb-40 overflow-y-auto custom-scrollbar z-10" onClick={() => setEditMode(true)}>
                                                <PrettyRenderer content={activeNote.content} onLinkClick={handleWikiLink} />
                                            </div>
                                        )}
                                        <LinkSuggestions visible={showSuggestions} query={suggestionQuery} allFiles={diaries} onSelect={handleSelectSuggestion} />
                                    </div>
                                    <div className="absolute bottom-6 right-6 z-20">
                                        <button onClick={() => setEditMode(!editMode)} className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition active:scale-95 border-2 ${editMode ? 'bg-[#3e2723] text-white border-[#3e2723]' : 'bg-[#fffdf5] text-[#3e2723] border-[#3e2723]'}`}>{editMode ? '👁️' : '✎'}</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-[#d7ccc8] flex-col"><div className="text-4xl mb-4 opacity-50">🍂</div><p className="font-serif">请打开侧边栏选择笔记</p><button onClick={() => setSidebarOpen(true)} className="mt-4 px-4 py-2 bg-[#8d6e63] text-white rounded-lg text-sm">打开侧边栏</button></div>
                            )}
                        </div>




                        {/* 侧边栏 */}
{/* 侧边栏 (已缝合多选删除功能) */}
                        <div className={`absolute top-0 bottom-0 right-0 z-30 w-72 bg-[#f5f5f0] border-l border-[#e0e0e0] transform transition-transform duration-300 ease-out flex flex-col shadow-2xl ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            
                            {/* 侧边栏头部：根据模式变化 */}
                            <div className="p-4 bg-[#ebe8e0] border-b border-[#dedede] flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    {/* 缝合点：显示选中数量 */}
                                    <span className={`text-xs font-bold uppercase ${isSelectionMode ? 'text-red-500' : 'text-[#8d6e63]'}`}>
                                        {isSelectionMode ? `已选中 ${selectedIds.size} 项` : 'Explorer'}
                                    </span>
                                    <button onClick={() => setSidebarOpen(false)} className="text-gray-400">✕</button>
                                </div>
                                
                                {/* 缝合点：普通模式才显示新建按钮 */}
                                {!isSelectionMode && (
                                    <div className="flex gap-2">
                                        <button onClick={handleCreateFile} className="flex-1 bg-[#8d6e63] text-white py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-[#6d4c41] active:scale-95 transition">+ 新建笔记</button>
                                        <button onClick={handleCreateFolder} className="px-3 bg-white border border-[#d7ccc8] text-[#5d4037] rounded-lg shadow-sm hover:bg-[#fffdf5] active:scale-95 transition">📂+</button>
                                    </div>
                                )}
                            </div>

                            {/* 文件夹树：传入多选参数 */}
                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar pb-20">
                                {folders.filter(f => f.parentId === 'root').map(f => (
                                    <FolderItem 
                                        key={f.id} 
                                        folder={f} 
                                        allFolders={folders} 
                                        allFiles={diaries} 
                                        currentFileId={currentFileId} 
                                        selectedFolderId={selectedFolderId} 
                                        // ↓↓↓↓↓↓ 缝合点：传入多选状态 ↓↓↓↓↓↓
                                        isSelectionMode={isSelectionMode}
                                        selectedIds={selectedIds}
                                        onLongPress={handleLongPress}
                                        onToggleSelect={handleToggleSelect}
                                        // ↑↑↑↑↑↑ 缝合点结束 ↑↑↑↑↑↑
                                        onToggle={(id) => setFolders(folders.map(x => x.id === id ? { ...x, collapsed: !x.collapsed } : x))} 
                                        onSelectFolder={(id) => setSelectedFolderId(id)} 
                                        onSelectFile={(id) => { setCurrentFileId(id); if (window.innerWidth < 640) setSidebarOpen(false); }} 
                                    />
                                ))}
                            </div>

                            {/* 缝合点：底部红色的删除操作栏 */}
                            {isSelectionMode && (
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-red-100 flex gap-3 animate-slideUp z-50">
                                    <button 
                                        onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                                        className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={handleBatchDelete}
                                        className="flex-[2] py-3 rounded-xl bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-200 active:scale-95 transition"
                                    >
                                        删除 ({selectedIds.size})
                                    </button>
                                </div>
                            )}
                        </div>
                        {sidebarOpen && <div className="absolute inset-0 bg-black/20 z-20 backdrop-blur-[1px]" onClick={() => setSidebarOpen(false)}></div>}
                    </>
                )}

                {/* 2. 中间：概览页 */}
                {activeTab === 'dashboard' && (
                    <DashboardView diaries={diaries} moodData={moodData} />
                )}

                {/* 3. 右侧：AI 对话页 */}

{activeTab === 'chat' && (
    <AIAdminChat 
        diaries={diaries} 
        folders={folders} 
        settings={settings}       // <--- 新增
        setSettings={setSettings} // <--- 新增
        onAction={handleAIAction} 
    />
)}

            </div>

            {/* 底部导航栏 */}
            <div className="mx-6 mb-6 h-14 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl flex items-center justify-around border border-white/50 z-50">
                <button 
                    onClick={() => setActiveTab('note')}
                    className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'note' ? 'text-[#3e2723] scale-110' : 'text-gray-400'}`}
                >
                    <span className="text-xl">📝</span>
                    <span className="text-[9px] font-bold">笔记</span>
                </button>
                <div className="w-px h-6 bg-gray-200"></div>
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'dashboard' ? 'text-[#3e2723] scale-110' : 'text-gray-400'}`}
                >
                    <span className="text-xl">📊</span>
                    <span className="text-[9px] font-bold">概览</span>
                </button>
                <div className="w-px h-6 bg-gray-200"></div>
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'chat' ? 'text-[#3e2723] scale-110' : 'text-gray-400'}`}
                >
                    <span className="text-xl">🤖</span>
                    <span className="text-[9px] font-bold">管理员</span>
                </button>
            </div>

            {isSaving && (
                <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col items-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-2"></div><span className="text-xs font-bold text-gray-600">正在冲印照片...</span></div>
                </div>
            )}
            {ShareToAIModal && <ShareToAIModal isOpen={showShareModal} contacts={contacts || []} onClose={() => setShowShareModal(false)} onShare={handleShareToAI} />}
        </div>
    );
};

export default DiaryApp;