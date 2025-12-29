import React, { useState, useEffect, useRef } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
import { GlobalSettings, Contact, Message } from '../types';
import { generateResponse } from '../services/apiService';
import * as htmlToImage from 'html-to-image';

// ==================== 类型定义 ====================
interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  folderId: string;
  updatedAt: number;
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

// ==================== 🎨 样式组件 (修复版) ====================

const PaperStyle = () => (
    <style>{`
      .paper-texture {
        background-color: #fffdf5;
        /* ★★★ 修复核心：去掉 local，使用默认 scroll，背景不动文字动，性能最稳！ ★★★ */
        background-image: radial-gradient(#d1d5db 1.5px, transparent 1.5px);
        background-size: 24px 24px;
      }
      .handwritten {
        font-family: 'Times New Roman', serif;
      }
      /* 隐藏滚动条 */
      .custom-scrollbar::-webkit-scrollbar { display: none; }
      .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
);

// 侧边栏文件夹组件
const FolderItem: React.FC<{
    folder: Folder;
    allFolders: Folder[];
    allFiles: DiaryEntry[];
    currentFileId: string | null;
    selectedFolderId: string | null;
    onToggle: (id: string) => void;
    onSelectFolder: (id: string) => void;
    onSelectFile: (id: string) => void;
    level?: number;
}> = ({ folder, allFolders, allFiles, currentFileId, selectedFolderId, onToggle, onSelectFolder, onSelectFile, level = 0 }) => {
    const subFolders = allFolders.filter(f => f.parentId === folder.id);
    const files = allFiles.filter(f => f.folderId === folder.id);
    const isOpen = !folder.collapsed;
    const isFolderSelected = selectedFolderId === folder.id;

    return (
        <div className="mb-1 select-none">
            <div 
                onClick={() => { onSelectFolder(folder.id); onToggle(folder.id); }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors text-gray-700 ${isFolderSelected ? 'bg-[#e2dfd2] font-bold text-[#3e2723]' : 'hover:bg-[#efece3]'}`}
                style={{ marginLeft: `${level * 10}px` }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm transition-transform duration-200 text-gray-400" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span className="text-lg">{isOpen ? '📂' : '📁'}</span>
                    <span className="text-sm truncate max-w-[120px]">{folder.name}</span>
                </div>
            </div>
            {isOpen && (
                <div className="mt-1 space-y-1">
                    {subFolders.map(sub => <FolderItem key={sub.id} folder={sub} allFolders={allFolders} allFiles={allFiles} currentFileId={currentFileId} selectedFolderId={selectedFolderId} onToggle={onToggle} onSelectFolder={onSelectFolder} onSelectFile={onSelectFile} level={level + 1} />)}
                    {files.map(file => (
                        <div 
                            key={file.id} 
                            onClick={() => onSelectFile(file.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ml-4 border-l-2 ${currentFileId === file.id ? 'bg-white border-[#8d6e63] shadow-sm text-[#3e2723] font-bold' : 'border-transparent hover:bg-[#fffdf5] text-gray-500'}`}
                            style={{ marginLeft: `${(level + 1) * 10 + 12}px` }}
                        >
                            <span className="text-xs">📄</span>
                            <span className="text-sm truncate">{file.title || "无标题"}</span>
                        </div>
                    ))}
                    {files.length === 0 && subFolders.length === 0 && <div className="text-[10px] text-gray-300 pl-8 py-1">（空）</div>}
                </div>
            )}
        </div>
    );
};

// Markdown 解析器
const PrettyRenderer: React.FC<{ content: string; onLinkClick: (t: string) => void }> = ({ content, onLinkClick }) => {
    if (!content) return <div className="text-gray-300 italic font-serif mt-4">（正文内容为空）</div>;
    const parts = content.split(/(\[\[.*?\]\]|#[a-zA-Z0-9\u4e00-\u9fa5]+)/g);
    return (
        // ★★★ 修复：添加 min-h-full 确保内容少时也能撑开背景 ★★★
        <div className="whitespace-pre-wrap break-words leading-loose text-gray-800 font-serif text-base pb-32 min-h-full">
            {parts.map((part, index) => {
                if (part.startsWith('[[') && part.endsWith(']]')) {
                    const title = part.slice(2, -2);
                    return <span key={index} onClick={(e) => { e.stopPropagation(); onLinkClick(title); }} className="text-[#8d6e63] font-bold cursor-pointer hover:underline border-b border-[#8d6e63]/30 mx-1 bg-[#8d6e63]/10 px-1 rounded transition">{title}</span>;
                }
                if (part.startsWith('#')) return <span key={index} className="text-[#e91e63] font-bold bg-pink-50 px-1 rounded mx-1 text-sm font-sans">{part}</span>;
                return <span key={index}>{part}</span>;
            })}
        </div>
    );
};

// 联想弹窗
const LinkSuggestions: React.FC<{ visible: boolean; query: string; allFiles: DiaryEntry[]; onSelect: (title: string) => void }> = ({ visible, query, allFiles, onSelect }) => {
    if (!visible) return null;
    const matches = allFiles.filter(f => f.title && f.title.toLowerCase().includes(query.toLowerCase()));
    return (
        <div className="absolute bottom-16 left-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] overflow-hidden animate-slideUp max-h-48 overflow-y-auto">
            <div className="bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-400 border-b border-gray-100 flex justify-between"><span>🔗 链接到...</span><span>{matches.length} 个结果</span></div>
            {matches.length > 0 ? matches.map(f => (
                <div key={f.id} onClick={() => onSelect(f.title)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <div className="flex flex-col"><span className="text-sm font-bold text-gray-800">{f.title}</span><span className="text-[10px] text-gray-400">ID: {f.id.slice(-4)}</span></div>
                </div>
            )) : <div className="p-4 text-center text-gray-400 text-xs">没有找到 "{query}"，点击空格继续输入...</div>}
        </div>
    );
};

// 菜单弹窗
const MenuDropdown: React.FC<{ isOpen: boolean; onClose: () => void; onShareClick: () => void; onSaveImageClick: () => void; onToggleAI: () => void }> = ({ isOpen, onClose, onShareClick, onSaveImageClick, onToggleAI }) => {
    if (!isOpen) return null;
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose}></div>
            <div className="absolute top-12 right-2 w-40 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/50 z-50 animate-scaleIn origin-top-right overflow-hidden p-1">
                <button onClick={() => { onShareClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-xl flex items-center gap-2 transition"><span>💌</span> 分享给 AI</button>
                <button onClick={() => { onSaveImageClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-500 rounded-xl flex items-center gap-2 transition"><span>📸</span> 保存图片</button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button onClick={() => { onToggleAI(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-purple-500 rounded-xl flex items-center gap-2 transition"><span>✨</span> 灵感助手</button>
            </div>
        </>
    );
};

// 分享弹窗
const ShareToAIModal: React.FC<{ isOpen: boolean; contacts: Contact[]; onClose: () => void; onShare: (contactId: string) => void }> = ({ isOpen, contacts, onClose, onShare }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-[#fffdf5] w-[85%] max-w-xs rounded-3xl p-5 shadow-2xl animate-scaleIn border-[6px] border-white" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4"><span className="text-2xl">💌</span><h3 className="font-bold text-[#5d4037] text-lg">分享给谁看？</h3><p className="text-xs text-gray-400 mt-1">TA 会读到这篇日记并产生记忆哦</p></div>
                <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-1">{(contacts || []).map(c => (<div key={c.id} onClick={() => onShare(c.id)} className="flex flex-col items-center gap-1 cursor-pointer hover:bg-[#efece3] p-2 rounded-xl transition active:scale-95"><img src={c.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" /><span className="text-[10px] text-gray-600 truncate w-full text-center font-bold">{c.name}</span></div>))}</div>
                <button onClick={onClose} className="w-full mt-4 py-2 bg-[#efece3] text-[#8d6e63] rounded-xl font-bold text-xs">取消</button>
            </div>
        </div>
    );
};

// ==================== 📔 DiaryApp 主程序 ====================
const DiaryApp: React.FC<DiaryAppProps> = ({ settings, setSettings, contacts, setContacts, onClose }) => {
    const [folders, setFolders] = useState<Folder[]>([
        { id: 'root', name: '我的手账本', parentId: null, collapsed: false },
        { id: 'f1', name: '日常碎碎念', parentId: 'root', collapsed: false },
        { id: 'f2', name: '灵感收集', parentId: 'root', collapsed: true },
    ]);
    const [diaries, setDiaries] = useState<DiaryEntry[]>([
        { id: 'd1', title: '我的灵感', content: '', folderId: 'f1', updatedAt: Date.now() },
    ]);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<string | null>('d1');
    const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
    const [editMode, setEditMode] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // 草稿状态
    const [draftContent, setDraftContent] = useState("");
    const [draftTitle, setDraftTitle] = useState("");

    // 联想状态
    const [suggestionQuery, setSuggestionQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);

    const contentRef = useRef<HTMLDivElement>(null); 
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<any>(null);

    // 切换文件逻辑
    useEffect(() => {
        const note = diaries.find(d => d.id === currentFileId);
        if (note) {
            setDraftContent(note.content);
            setDraftTitle(note.title);
        } else {
            setDraftContent("");
            setDraftTitle("");
        }
    }, [currentFileId, diaries]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const pos = e.target.selectionStart;
        setDraftContent(val);
        setCursorPos(pos);

        const textBeforeCursor = val.slice(0, pos);
        const match = textBeforeCursor.match(/\[\[([^\]\n]*)$/);
        if (match) {
            setSuggestionQuery(match[1]);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveToGlobalState(val, null);
        }, 500);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDraftTitle(val);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveToGlobalState(null, val);
        }, 500);
    };

    const saveToGlobalState = (newContent: string | null, newTitle: string | null) => {
        if (!currentFileId) return;
        setDiaries(prev => prev.map(d => {
            if (d.id === currentFileId) {
                return {
                    ...d,
                    content: newContent !== null ? newContent : d.content,
                    title: newTitle !== null ? newTitle : d.title,
                    updatedAt: Date.now()
                };
            }
            return d;
        }));
    };

    const handleSelectSuggestion = (title: string) => {
        const val = draftContent;
        const textBeforeCursor = val.slice(0, cursorPos);
        const textAfterCursor = val.slice(cursorPos);
        const lastBracketIndex = textBeforeCursor.lastIndexOf('[[');
        if (lastBracketIndex !== -1) {
            const newContent = val.slice(0, lastBracketIndex) + `[[${title}]]` + textAfterCursor;
            setDraftContent(newContent); 
            saveToGlobalState(newContent, null); 
            setShowSuggestions(false);
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    };

    const handleCreateFile = () => {
        const newNote: DiaryEntry = { id: Date.now().toString(), title: '', content: '', folderId: selectedFolderId, updatedAt: Date.now() };
        setDiaries([...diaries, newNote]);
        setCurrentFileId(newNote.id);
        setEditMode(true);
        if(window.innerWidth < 640) setSidebarOpen(false);
    };

    const handleCreateFolder = () => {
        const name = prompt("新建文件夹名称:");
        if(name) setFolders([...folders, { id: Date.now().toString(), name, parentId: selectedFolderId, collapsed: false }]);
    };

    const handleWikiLink = (title: string) => {
        const target = diaries.find(d => d.title === title);
        if (target) {
            setCurrentFileId(target.id);
            setEditMode(false);
        } else {
            if (confirm(`笔记 "[[${title}]]" 不存在。\n\n要立即创建它吗？`)) {
                const newNote: DiaryEntry = { id: Date.now().toString(), title, content: `# ${title}\n\n从 [[${draftTitle}]] 链接而来。\n`, folderId: selectedFolderId || 'root', updatedAt: Date.now() };
                setDiaries([...diaries, newNote]);
                setCurrentFileId(newNote.id);
                setEditMode(true);
            }
        }
    };

    const handleShareToAI = (contactId: string) => {
        const note = diaries.find(d => d.id === currentFileId);
        if (!note) return;
        const shareMessage = `[System] 用户分享了一篇日记给你：\n\n📄 **${note.title || '无标题'}**\n\n${note.content}`;
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, history: [...c.history, { id: Date.now().toString(), role: 'system', content: shareMessage, timestamp: Date.now(), type: 'text' } as Message], unread: (c.unread || 0) + 1 } : c));
        alert("✅ 已发送！快去聊天窗口看看 TA 的反应吧~");
        setShowShareModal(false);
    };

    const handleSaveImage = async () => {
        if (!contentRef.current || !currentFileId) return;
        setIsSaving(true);
        try {
            const originalStyle = contentRef.current.style.cssText;
            contentRef.current.style.height = 'auto';
            contentRef.current.style.overflow = 'visible';
            contentRef.current.style.padding = '40px'; 
            const dataUrl = await htmlToImage.toJpeg(contentRef.current, { quality: 0.95, backgroundColor: '#fffdf5' });
            const link = document.createElement('a');
            link.download = `Diary-${draftTitle || 'untitled'}.jpg`;
            link.href = dataUrl;
            link.click();
            contentRef.current.style.cssText = originalStyle;
        } catch (e) { console.error(e); alert("保存失败"); } finally { setIsSaving(false); }
    };

    const activeNoteMeta = diaries.find(d => d.id === currentFileId);

    return (
        <div className="h-full w-full bg-[#eeeae4] flex flex-col pt-[calc(44px+env(safe-area-inset-top))] relative overflow-hidden">
            <PaperStyle />
            
            <SafeAreaHeader 
                title={
                    <div className="flex flex-col items-center leading-tight">
                        <span className="font-bold text-[#5d4037] text-base tracking-widest uppercase">My Journal</span>
                        {selectedFolderId && <span className="text-[9px] text-[#a1887f]">in {folders.find(f=>f.id===selectedFolderId)?.name || 'Root'}</span>}
                    </div>
                }
                left={<button onClick={onClose} className="text-sm font-bold text-[#8d6e63] bg-white/50 px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition flex items-center gap-1">← 返回</button>}
                right={
                    <div className="flex gap-2 relative">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-xl text-[#8d6e63] p-2 hover:bg-black/5 rounded-full transition">{sidebarOpen ? '📖' : '🗂️'}</button>
                        <div className="relative">
                            <button onClick={() => setShowMenu(!showMenu)} className="text-xl text-[#8d6e63] px-3 py-2 hover:bg-black/5 rounded-full transition font-black">≡</button>
                            <MenuDropdown isOpen={showMenu} onClose={() => setShowMenu(false)} onShareClick={() => setShowShareModal(true)} onSaveImageClick={handleSaveImage} onToggleAI={() => setShowAI(!showAI)} />
                        </div>
                    </div>
                }
            />

            <div className="flex-1 flex overflow-hidden relative shadow-2xl mx-2 mb-4 rounded-3xl bg-[#fffdf5] paper-texture border border-[#d7ccc8]">
                {/* 主内容区 */}
                <div className="flex-1 flex flex-col relative w-full h-full">
                    {currentFileId ? (
                        <div ref={contentRef} className="flex-1 flex flex-col h-full relative">
                            {/* 标题区 */}
                            <div className="px-8 pt-8 pb-2 shrink-0">
                                <input 
                                    value={draftTitle}
                                    onChange={handleTitleChange}
                                    placeholder="无标题"
                                    className="w-full bg-transparent text-3xl font-black text-[#3e2723] font-serif outline-none placeholder-gray-300/50"
                                />
                                <div className="flex gap-2 text-[10px] text-[#a1887f] uppercase tracking-wider mt-2 border-b-2 border-dashed border-[#d7ccc8] pb-4 w-full">
                                    <span>{new Date(activeNoteMeta?.updatedAt || Date.now()).toLocaleString()}</span>
                                    <span>• {editMode ? 'WRITING' : 'READING'}</span>
                                    <span>• {draftContent.length} WORDS</span>
                                </div>
                            </div>

                            {/* 正文区 */}
                            <div className="flex-1 relative overflow-hidden">
                                {editMode ? (
                                    <textarea 
                                        ref={textareaRef}
                                        // ★★★ 修复：pb-32 确保底部有足够空间，h-full 撑满容器 ★★★
                                        className="w-full h-full p-8 pt-2 text-base leading-loose text-gray-800 outline-none resize-none font-serif bg-transparent custom-scrollbar pb-32"
                                        value={draftContent}
                                        onChange={handleContentChange}
                                        placeholder="在此处落笔... 输入 [[ 触发链接"
                                        autoFocus
                                    />
                                ) : (
                                    <div 
                                        className="w-full h-full p-8 pt-2 overflow-y-auto custom-scrollbar pb-32" 
                                        onClick={() => setEditMode(true)}
                                    >
                                        <PrettyRenderer content={draftContent} onLinkClick={handleWikiLink} />
                                    </div>
                                )}
                                <LinkSuggestions visible={showSuggestions} query={suggestionQuery} allFiles={diaries} onSelect={handleSelectSuggestion} />
                            </div>

                            {/* 模式切换按钮 */}
                            <div className="absolute bottom-6 right-6 z-20">
                                <button onClick={() => setEditMode(!editMode)} className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition active:scale-95 border-2 ${editMode ? 'bg-[#3e2723] text-white border-[#3e2723]' : 'bg-[#fffdf5] text-[#3e2723] border-[#3e2723]'}`}>
                                    {editMode ? '👁️' : '✎'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-[#d7ccc8] flex-col"><div className="text-4xl mb-4 opacity-50">🍂</div><p className="font-serif">在侧边栏选中文件夹，开始书写...</p></div>
                    )}
                </div>

                {/* 侧边栏 */}
                <div className={`absolute top-0 bottom-0 right-0 z-30 w-72 bg-[#f5f5f0] border-l border-[#e0e0e0] transform transition-transform duration-300 ease-out flex flex-col shadow-2xl ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-4 bg-[#ebe8e0] border-b border-[#dedede] flex flex-col gap-3">
                        <div className="flex justify-between items-center"><span className="text-xs font-bold text-[#8d6e63] uppercase">Explorer</span><button onClick={() => setSidebarOpen(false)} className="text-gray-400">✕</button></div>
                        <div className="flex gap-2">
                            <button onClick={handleCreateFile} className="flex-1 bg-[#8d6e63] text-white py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-[#6d4c41] active:scale-95 transition">+ 新建笔记</button>
                            <button onClick={handleCreateFolder} className="px-3 bg-white border border-[#d7ccc8] text-[#5d4037] rounded-lg shadow-sm hover:bg-[#fffdf5] active:scale-95 transition">📂+</button>
                        </div>
                        <div className="text-[9px] text-gray-400 text-center">当前选中: {folders.find(f => f.id === selectedFolderId)?.name || '根目录'}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {folders.filter(f=>f.parentId==='root').map(f => (
                            <FolderItem key={f.id} folder={f} allFolders={folders} allFiles={diaries} currentFileId={currentFileId} selectedFolderId={selectedFolderId} onToggle={(id) => setFolders(folders.map(x=>x.id===id?{...x, collapsed:!x.collapsed}:x))} onSelectFolder={(id) => setSelectedFolderId(id)} onSelectFile={(id) => { setCurrentFileId(id); if(window.innerWidth < 640) setSidebarOpen(false); }} />
                        ))}
                    </div>
                </div>
                {sidebarOpen && <div className="absolute inset-0 bg-black/20 z-20 backdrop-blur-[1px]" onClick={() => setSidebarOpen(false)}></div>}
            </div>

            {/* AI 助手 */}
            {showAI && (
                <div className="absolute bottom-24 right-6 left-6 bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white z-40 animate-slideUp">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-purple-600">✨ 灵感缪斯</span><button onClick={() => setShowAI(false)} className="text-gray-400">✕</button></div>
                    <div className="bg-purple-50 p-3 rounded-xl text-xs text-purple-900 mb-2 leading-relaxed">需要我帮你润色这段文字，还是提供一些写作灵感？</div>
                    <div className="flex gap-2">
                        <button onClick={() => alert("润色功能开发中...")} className="flex-1 bg-white border border-purple-100 py-1.5 rounded-lg text-xs font-bold text-purple-600">🖋️ 润色</button>
                        <button onClick={() => alert("续写功能开发中...")} className="flex-1 bg-white border border-purple-100 py-1.5 rounded-lg text-xs font-bold text-purple-600">💡 续写</button>
                    </div>
                </div>
            )}

            {isSaving && (<div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center backdrop-blur-sm"><div className="bg-white p-4 rounded-xl shadow-lg flex flex-col items-center"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-2"></div><span className="text-xs font-bold text-gray-600">正在冲印照片...</span></div></div>)}
            <ShareToAIModal isOpen={showShareModal} contacts={contacts || []} onClose={() => setShowShareModal(false)} onShare={handleShareToAI} />
        </div>
    );
};

export default DiaryApp;