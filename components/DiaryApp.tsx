import React, { useState, useRef, useEffect } from 'react';
import SafeAreaHeader from './SafeAreaHeader';
// 这是一组什么代码：【类型导入修复】
// 作用：告诉 DiaryApp.tsx 文件，去哪里找 WorldBookCategory 和 WorldBookEntry 的“说明书”。
import { GlobalSettings, Contact, Message, WorldBookCategory, WorldBookEntry } from '../types';
import * as htmlToImage from 'html-to-image';
import localforage from 'localforage';
import { generateResponse } from '../services/apiService'; // 引入 AI 服务
// 1. 引入生成回复的函数
import WorldBookApp from './WorldBookApp'; // <--- 确保加了这行导入！










const getTimeGapAndBlame = (history: { role: 'user' | 'assistant', content: string, timestamp: number }[]) => {
    let maxGapMinutes = 0;
    let isDifferentDay = false;
    let isAiIgnoredUser = false;
    let isUserLateReply = false;
    const now = Date.now();
    const closureKeywords = ["晚安", "睡了", "睡觉", "bye", "再见", "去忙"];

    // 倒序检查最近15条消息
    for (let i = history.length - 2; i >= Math.max(0, history.length - 15); i--) {
        const currMsg = history[i + 1];
        const prevMsg = history[i];
        const gap = (currMsg.timestamp - prevMsg.timestamp) / 60000;

        if (gap > 120) { // 超过2小时算断层
            const isNaturalEnding = closureKeywords.some(k => prevMsg.content.toLowerCase().includes(k));
            if (isNaturalEnding) {
                // 是自然结束，不追责
            } else {
                if (prevMsg.role === 'user') isAiIgnoredUser = true;
                else isUserLateReply = true;
            }
            maxGapMinutes = Math.floor(gap);
            if (new Date(currMsg.timestamp).getDate() !== new Date(prevMsg.timestamp).getDate()) {
                isDifferentDay = true;
            }
            break; // 只找最近的一次断层
        }
    }

    // 如果没有历史断层，检查当前时间与最后一条消息的间隔
    if (maxGapMinutes === 0 && history.length > 0) {
        const lastMsg = history[history.length - 1];
        const silenceGap = (now - lastMsg.timestamp) / 60000;
        if (silenceGap > 120 && lastMsg.role === 'user') {
            maxGapMinutes = Math.floor(silenceGap);
            isAiIgnoredUser = true;
        }
    }
    
    let gapDescription = "刚刚";
    if (maxGapMinutes > 10) gapDescription = `${maxGapMinutes}分钟`;
    if (maxGapMinutes > 60) gapDescription = `${Math.floor(maxGapMinutes / 60)}小时`;
    if (maxGapMinutes > 1440) gapDescription = "好几天";
    if (isDifferentDay) gapDescription += " (已跨天)";

    let blameInstruction = "时间连贯，正常对话。";
    if (isAiIgnoredUser) {
        blameInstruction = `【⚠️ 严重警告：检测到“已读不回”行为 ⚠️】\n事实：用户在 ${gapDescription} 前发了消息，你(AI)一直没回。✅ 必须执行：必须先为你的“已读不回”道歉或找借口（如“刚睡醒”），态度要软化。`;
    } else if (isUserLateReply) {
        blameInstruction = `【时间流逝】距离上次对话已过 ${gapDescription}。是用户消失了这么久才回你。你可以表现出惊讶、撒娇或询问。`;
    } else if (maxGapMinutes > 360) {
        blameInstruction = `【新的一天/新的开始】距离上次对话已过 ${gapDescription}。请自然地开启新话题。`;
    }
    
    return { gapDescription, blameInstruction };
};

// 2. 精力状态描述
const getEnergyInstruction = (mood: any) => {
    const energy = mood?.energyLevel || 80;
    if (energy < 30) return "精神状态：疲惫 (Tired)，回复可能变慢、变短。";
    if (energy > 80) return "精神状态：精力充沛 (Energetic)，回复会更有活力。";
    return "精神状态：正常 (Normal)。";
}












// 这是一组什么代码：【终极强化版 AI 工具定义】
// 作用：强制AI必须调用工具创建总结笔记，杜绝空输出或自由聊天
const DIARY_AI_TOOLS = [
  {
    name: 'create_summary_note',
    description: '必须使用此工具将日记中属于某个主题的内容提炼成一篇独立总结笔记。只能在确认有值得总结的内容时调用。',
    parameters: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: '主题分类名称，必须是用户日记中明确出现过的类别，例如“工作”、“追星”、“家庭”、“朋友”。不能凭空发明新类别。',
        },
        title: {
          type: 'string',
          description: '总结笔记的标题，要吸引人、有概括性，控制在10个字以内。',
        },
        content: {
          type: 'string',
          description: '从原始日记中提取并深度提炼后的总结内容，使用 bullet points 形式，每条前加 - ，语言简洁深刻。结尾加一行空行。',
        },
      },
      required: ['category', 'title', 'content'],
    },
  },
];










// 这是一组什么代码：【新增】从 ChatApp 移植过来的、标准版的世界书检索函数
// 它可以智能判断“常驻”和“关键词”两种模式
const findRelevantWorldBookEntries = (
  textToScan: string, // 要扫描的文本
  worldBooks: WorldBookCategory[],
  enabledBookIds: Set<string> // 改为接收 Set，效率更高
): WorldBookEntry[] => {
  const contextText = textToScan.toLowerCase();

  // 1. 找出当前角色启用的世界书
  const enabledBooks = worldBooks.filter(wb => enabledBookIds.has(wb.id));
  if (enabledBooks.length === 0) {
      return [];
  }

  const relevantEntries = new Set<WorldBookEntry>();

  // 2. 遍历所有启用的世界书
  for (const book of enabledBooks) {
      for (const entry of book.entries) {
          
          // 模式 A: 常驻/基本模式 (constant)
          // 只要这一项被标记为 constant，无论说什么，AI 都要读！
          if (entry.strategy === 'constant') {
              relevantEntries.add(entry);
              continue; 
          }

          // 模式 B: 关键词模式 (keyword)
          // 只有当 entry.keys 里的词出现在对话中时，才读取
          if (entry.keys && entry.keys.length > 0) {
              for (const key of entry.keys) {
                  if (contextText.includes(key.toLowerCase())) {
                      relevantEntries.add(entry);
                      break; // 只要命中一个关键词就够了
                  }
              }
          }
      }
  }
  
  return Array.from(relevantEntries);
};










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
  worldBooks: WorldBookCategory[]; // <--- 加上这一行！
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
    if (!content) return <div className="text-gray-300 italic font-serif mt-4"></div>;

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
                    return <h1 key={i} className="text-2xl font-black text-[#3e2723] mt-8 mb-4 border-b-2 border-[#d7ccc8] pb-2 tracking-wide">{parseInline(trimmed.slice(2))}</h1>;
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

// 这是一组什么代码：【新增单篇AI整理按钮的菜单】
// 直接找到原来的 MenuDropdown 组件，整段替换成下面这个
const MenuDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onShareClick: () => void;
  onSaveImageClick: () => void;
  onToggleAI: () => void;
  onDeleteClick: () => void;
  onOrganizeCurrentNote: () => void;  // <--- 新增的整理单篇笔记函数
}> = ({ isOpen, onClose, onShareClick, onSaveImageClick, onToggleAI, onDeleteClick, onOrganizeCurrentNote }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute top-12 right-2 w-44 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/50 z-50 animate-scaleIn origin-top-right overflow-hidden p-1">
        <button onClick={() => { onShareClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-xl flex items-center gap-2 transition"><span>💌</span> 分享给 AI</button>
        <button onClick={() => { onSaveImageClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-500 rounded-xl flex items-center gap-2 transition"><span>📸</span> 保存图片</button>
        <button onClick={() => { onToggleAI(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-purple-500 rounded-xl flex items-center gap-2 transition"><span>✨</span> 灵感助手</button>
        
        {/* 👇 新增的单篇整理按钮 👇 */}
        <button 
          onClick={() => { 
            onOrganizeCurrentNote(); 
            onClose(); 
          }} 
          className="w-full text-left px-3 py-2.5 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl flex items-center gap-2 transition"
        >
          <span>🗂️</span> AI整理这篇笔记
        </button>

        <div className="h-px bg-gray-100 my-1"></div>
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

const AIAdminChat: React.FC<{
    diaries: DiaryEntry[],
    folders: Folder[],
    settings: GlobalSettings,
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>,
    worldBooks: WorldBookCategory[], // ChatApp 的大脑需要世界书
    diaryAIWorldBookIds: Set<string>,
    setDiaryAIWorldBookIds: React.Dispatch<React.SetStateAction<Set<string>>>,
}> = ({ diaries, folders, settings, setSettings, worldBooks, diaryAIWorldBookIds, setDiaryAIWorldBookIds }) => {
    
    const [mode, setMode] = useState<'chat' | 'settings'>('chat');
    const [input, setInput] = useState("");
    const [isAiTyping, setIsAiTyping] = useState(false); // AI是否正在思考+生成
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [history, setHistory] = useState<{role: 'user'|'assistant', content: string, timestamp: number}[]>([]);

    const aiConfig = settings.diaryAIConfig || { name: '汉堡包', persona: '' };
    const userPersona = settings.diaryUserPersona || "";

    // 加载/保存聊天记录
    useEffect(() => {
        const loadHistory = async () => {
            const savedHistory = await localforage.getItem<any[]>('diary_ai_history');
            if (savedHistory) setHistory(savedHistory);
            else setHistory([{ role: 'assistant', content: "大厨你好！我是汉堡包🍔！", timestamp: Date.now() }]);
        };
        loadHistory();
    }, []);

    useEffect(() => {
        if(history.length > 0) localforage.setItem('diary_ai_history', history);
    }, [history]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, mode, isAiTyping]);

    // =======================================================
    // 核心改造区：拆分 handleSend 和 handleAiReplyTrigger
    // =======================================================

    // 1. 新的 handleSend 函数：只负责把你的消息放进聊天记录
    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = { role: 'user' as const, content: input, timestamp: Date.now() };
        setHistory(prev => [...prev, userMsg]);
        setInput("");
    };

// 这是一组什么代码：【修复版】AI回复触发器 (单气泡回复模式)
// 作用：我们移除了“温柔分句”的逻辑。现在，当您点击“✨”按钮后，AI会将它的
// 完整回复一次性显示在一个聊天气泡里，不再“一节一节”地出现。
const handleAiReplyTrigger = async () => {
    if (isAiTyping) return;
    setIsAiTyping(true);

    try {
        const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
        if (!activePreset) {
            alert("错误：API 预设未找到");
            setIsAiTyping(false);
            return;
        }

        // --- 准备 Prompt 所需的各种“材料” (这部分逻辑保持不变) ---
        const now = new Date();
        const userTime = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const { gapDescription, blameInstruction } = getTimeGapAndBlame(history);
        const energyInstruction = getEnergyInstruction({ energyLevel: 80 });
        const diaryContext = getDatabaseContext(diaries, folders);
        const relationshipInstruction = "【🙂处于朋友状态】\n态度：轻松、自然、友好。";
        
        // --- 构建强大的 System Prompt (保持不变) ---
        const systemPrompt = `
# 🕶️ [绝对机密] 角色扮演核心指令
你的核心身份和性格，完全由下面的 [Persona] 决定。你必须100%模仿它。

[Persona]
${aiConfig.persona}
---

# 🧠 [记忆库]
这是你主人的日记摘要，你必须参考这些内容来回应，假装你都记得：
${diaryContext}
---

# ⏰ [强制时空坐标]
- 系统检测到，距离上一条消息已过去：>>> ${gapDescription} <<<
- >>> 责任判定指令：${blameInstruction} <<<
- 你当前的精力状态: ${energyInstruction}
- 用户当地时间: ${userTime}
---

# ❤️ [关系感知]
${relationshipInstruction}
---

# 🚫 聊天铁律
- 你的回复必须是【纯粹的口语】，像真人一样自然。
- 严禁出现 ()、（）、[]、【】 包含的动作描写或心理活动。
- 使用换行符 (\\n) 来分割段落，不要发一大坨文字。
- 专注于回应用户最新的消息，并结合你的 Persona 和记忆库。
`;

        const messagesForAPI = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10).map(m => ({ role: m.role, content: m.content }))
        ];
        
        const aiResponse = await generateResponse(messagesForAPI, activePreset);
        const aiContent = aiResponse.content || "我好像有点卡住了...";

        // ★★★ 核心修改点在这里！★★★
        // 我们不再使用循环来分句发送，而是直接把完整的 aiContent 作为一个消息。
        const newMsg = {
            role: 'assistant' as const,
            content: aiContent, // 直接使用完整内容
            timestamp: Date.now()
        };

        // 模拟一个短暂的打字延迟，然后一次性显示
        await new Promise(resolve => setTimeout(resolve, 1200));
        setHistory(prev => [...prev, newMsg]);

    } catch (error: any) {
        const errorMsg = { role: 'assistant' as const, content: `糟糕，出错了: ${error.message}`, timestamp: Date.now() };
        setHistory(prev => [...prev, errorMsg]);
    } finally {
        setIsAiTyping(false);
    }
};


    // 快捷指令（保持不变）
    const promptSuggestions = [
      { label: '🧐 分析近期情感', command: '请帮我深入分析一下最近的日记内容，总结一下我近期的主要情感和心理状态。'},
      { label: '📊 分析心情状况', command: '请基于我的日记，分析我最近的心情分布情况，比如哪种情绪出现的比较多？'},
      { label: '💡 提炼核心主题', command: '帮我看看我最近都在关心些什么？请从日记里提炼出几个核心主题。'},
      { label: '✍️ 生成一段总结', command: '请根据我最近的日记，为我生成一段简短的周报或总结。'},
    ];

    return (
        <div className="flex flex-col h-full bg-[#f5f5f0]">
            {/* 顶部栏 (保持不变) */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <span className="text-2xl animate-bounce">🍔</span>
                    <div>
                        <span className="text-xs font-bold text-gray-800">{aiConfig.name}</span>
                        <span className={`text-[9px] font-bold block ${isAiTyping ? 'text-blue-500 animate-pulse' : 'text-orange-500'}`}>
                            {isAiTyping ? '正在输入...' : 'Online'}
                        </span>
                    </div>
                </div>
                <button onClick={() => setMode(mode === 'chat' ? 'settings' : 'chat')} className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-200 transition">
                    {mode === 'chat' ? '⚙️ 调味' : '💬 喂食'}
                </button>
            </div>

            {/* 聊天界面 */}
            {mode === 'chat' && (
                 <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-[#5d4037] text-white' : 'bg-white text-gray-800'}`}>{msg.content}</div>
                            </div>
                        ))}
                        {isAiTyping && <div className="text-xs text-blue-500 animate-pulse ml-2">正在输入...</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 底部输入区域 (核心改造) */}
                    <div className="p-3 bg-white border-t border-gray-200">
                        <div className="flex gap-2 pb-2 overflow-x-auto">
                            {promptSuggestions.map(s => (
                                <button key={s.label} onClick={() => { setInput(s.command); }} className="flex-shrink-0 px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full border hover:bg-gray-200 transition">
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {/* 输入框和两个按钮 */}
                        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2 mt-2">
                            <textarea 
                                className="flex-1 bg-transparent text-sm outline-none resize-none" 
                                rows={1} 
                                placeholder={`和 ${aiConfig.name} 聊聊...`} 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                            />
                            {/* ★★★ 新增：AI回复触发按钮 ★★★ */}
                            <button onClick={handleAiReplyTrigger} disabled={isAiTyping} className="bg-blue-500 text-white w-8 h-8 rounded-full font-bold text-lg disabled:opacity-50 disabled:animate-pulse transition-transform active:scale-90">
                                ✨
                            </button>
                            {/* 发送按钮 */}
                            <button onClick={handleSend} disabled={isAiTyping} className="bg-[#5d4037] text-white w-8 h-8 rounded-full font-bold disabled:opacity-50">↑</button>
                        </div>
                    </div>
                </>
            )}

            {/* 设置界面 (保持不变) */}
            {mode === 'settings' && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar animate-fadeIn space-y-6">
                    {/* ... (这里是调味页面的全部代码，无需改动，保持原样) ... */}
                    <div className="bg-white p-5 rounded-3xl shadow-sm border">
                        <h3 className="text-sm font-bold text-orange-500 mb-4">1. 选择你的日记伴侣</h3>
                        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
                            {(settings.diaryAIPresets || []).map((p, idx) => (
                                <button key={idx} onClick={() => setSettings(prev => ({ ...prev, diaryAIConfig: { name: p.name, persona: p.persona } }))}
                                    className={`flex-shrink-0 px-3 py-2 text-xs font-bold rounded-xl border transition ${aiConfig.name === p.name ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-800 border-orange-100'}`}>
                                    {p.name.includes('汉堡') ? '🍔' : p.name.includes('密友') ? '💖' : '🤖'} {p.name}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400">当前名字</label>
                            <input value={aiConfig.name} onChange={e => setSettings(prev => ({ ...prev, diaryAIConfig: { ...(prev.diaryAIConfig || {}), name: e.target.value } }))} className="w-full bg-gray-50 p-3 rounded-xl text-sm font-bold" />
                            <label className="text-[10px] font-bold text-gray-400">性格 Prompt</label>
                            <textarea value={aiConfig.persona} onChange={e => setSettings(prev => ({ ...prev, diaryAIConfig: { ...(prev.diaryAIConfig || {}), persona: e.target.value } }))} className="w-full bg-gray-50 p-3 rounded-xl text-xs h-32 resize-none" />
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl shadow-sm border">
                        <h3 className="text-sm font-bold text-blue-500 mb-2">📚 知识库授权 (让 AI 更懂你)</h3>
                        <div className="space-y-2 max-h-24 overflow-y-auto">
                            {(worldBooks || []).map(book => (
                                <label key={book.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50">
                                    <span className="text-sm font-bold">{book.name}</span>
                                    <input type="checkbox" checked={diaryAIWorldBookIds.has(book.id)}
                                        onChange={(e) => {
                                            const newSet = new Set(diaryAIWorldBookIds);
                                            e.target.checked ? newSet.add(book.id) : newSet.delete(book.id);
                                            setDiaryAIWorldBookIds(newSet);
                                        }} className="h-4 w-4 text-blue-600" />
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="bg-[#fff3e0] p-5 rounded-3xl shadow-sm border">
                        <h3 className="text-sm font-bold text-orange-600">2. 你是谁?</h3>
                        <textarea value={userPersona} onChange={e => setSettings(prev => ({ ...prev, diaryUserPersona: e.target.value }))} className="w-full bg-white p-3 rounded-xl text-sm border h-24 resize-none" placeholder="在这里写下你的名字和喜好..." />
                    </div>
                    <button onClick={() => setMode('chat')} className="w-full bg-[#3e2723] text-white py-4 rounded-2xl font-bold">返回聊天</button>
                </div>
            )}
        </div>
    );
};












// ==================== 📔 DiaryApp 主程序 ====================
// 改成这样
const DiaryApp: React.FC<DiaryAppProps> = ({ settings, setSettings, contacts, setContacts, worldBooks, onClose }) => {
   


   
   
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
const [diaryAIWorldBookIds, setDiaryAIWorldBookIds] = useState<Set<string>>(new Set());
    // 1. 加载数据
    useEffect(() => {
        const loadData = async () => {
            try {
                const savedFolders = await localforage.getItem<Folder[]>('diary_folders_db');
                const savedEntries = await localforage.getItem<DiaryEntry[]>('diary_entries_db');
                if (savedFolders) setFolders(savedFolders);
                if (savedEntries) setDiaries(savedEntries);
// 这是一组什么代码：【新增】加载已保存的日记 AI 世界书设置
const savedDiaryWB = await localforage.getItem<string[]>('diary_ai_wb_ids');
if (savedDiaryWB) setDiaryAIWorldBookIds(new Set(savedDiaryWB));

            } catch (err) { console.error(err); } finally { setIsLoaded(true); }
        };
        loadData();
    }, []);

// 这是一组什么代码：【修复版】自动保存逻辑，将嵌套的 useEffect 分离
// 2. 自动保存
useEffect(() => {
    if (isLoaded) {
        localforage.setItem('diary_folders_db', folders);
        localforage.setItem('diary_entries_db', diaries).catch(console.error);
    }
}, [folders, diaries, isLoaded]);

// 把这个 useEffect 从上面的 useEffect 里拿出来，变成独立的
useEffect(() => {
    if (isLoaded) {
        // 我们把 Set 转回数组再存储，因为 JSON 不支持 Set
        localforage.setItem('diary_ai_wb_ids', Array.from(diaryAIWorldBookIds));
    }
}, [diaryAIWorldBookIds, isLoaded]);


    // UI 状态
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('root');

    const [showMenu, setShowMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showAI, setShowAI] = useState(false); // 这是旧的浮窗AI，可以保留或移除
const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    
    // 编辑器相关
    const [suggestionQuery, setSuggestionQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null); 
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const activeNote = diaries.find(d => d.id === currentFileId);
    const [editMode, setEditMode] = useState(false); 









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


useEffect(() => {
    if (editMode && activeNote) {
        // 延迟一小下，确保 textarea 已经显示出来了
        setTimeout(() => {
            textareaRef.current?.focus();
            // 并且把光标移动到文字末尾
            const len = textareaRef.current?.value.length || 0;
            textareaRef.current?.setSelectionRange(len, len);
        }, 50);
    }
}, [editMode, activeNote]);






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

// 这是一组什么代码：【修改】新建文件后，自动进入编辑模式
const handleCreateFile = () => {
    const newNote: DiaryEntry = { 
        id: Date.now().toString(), 
        title: '', 
        content: '', 
        folderId: selectedFolderId || 'root', 
        updatedAt: Date.now() 
    };
    setDiaries([...diaries, newNote]);
    setCurrentFileId(newNote.id);
    setEditMode(true); // <-- 新增：新建文件后，直接进入编辑模式
    setTimeout(() => textareaRef.current?.focus(), 50); 
    if(window.innerWidth < 640) setSidebarOpen(false);
};

    const handleCreateFolder = () => {
        const name = prompt("新建文件夹名称:");
        if(name) { setFolders([...folders, { id: Date.now().toString(), name, parentId: selectedFolderId, collapsed: false }]); }
    };

// 这是一组什么代码：【修改】点击双链创建新文件时，也自动进入编辑模式
const handleWikiLink = (title: string) => {
    const target = diaries.find(d => d.title === title);
    if (target) { 
        setCurrentFileId(target.id); 
        setEditMode(false); // <-- 修改：跳转到旧文件，进入阅读模式
    } else if (confirm(`笔记 "[[${title}]]" 不存在。\n\n要立即创建它吗？`)) {
        const newNote: DiaryEntry = { id: Date.now().toString(), title, content: `# ${title}\n\n从 [[${activeNote?.title || '上一页'}]] 链接而来。\n`, folderId: activeNote?.folderId || 'root', updatedAt: Date.now() };
        setDiaries([...diaries, newNote]);
        setCurrentFileId(newNote.id);
        setEditMode(true); // <-- 新增：创建新文件，进入编辑模式
       setTimeout(() => textareaRef.current?.focus(), 50);
    }
};

    const handleShareToAI = (contactId: string) => {
        if (!activeNote) return;
        const shareMessage = `[System] 用户分享了一篇日记给你：\n\n📄 **${activeNote.title || '无标题'}**\n\n${activeNote.content}`;
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, history: [...c.history, { id: Date.now().toString(), role: 'system', content: shareMessage, timestamp: Date.now(), type: 'text' } as Message], unread: (c.unread || 0) + 1 } : c));
        alert("✅ 已发送！");
        setShowShareModal(false);
    };









// 这是一组什么代码：【修改】删除笔记后，确保退出编辑模式
const handleDeleteFile = () => {
    if (!activeNote) return;
    if (confirm(`确定要删除 "${activeNote.title || '未命名'}" 吗？此操作无法撤销。`)) {
        const newDiaries = diaries.filter(d => d.id !== activeNote.id);
        setDiaries(newDiaries);
        const nextNote = newDiaries.find(d => d.folderId === selectedFolderId) || newDiaries[0];
        setCurrentFileId(nextNote ? nextNote.id : null);
        setEditMode(false); // <-- 修改：删除后总是退回阅读模式
    }
};










// 这是一组什么代码：【适配版】截图功能，现在会正确地设置加载消息
const handleSaveImage = async () => {
    if (editMode) {
        alert("请先点击【完成编辑】，回到阅读模式后再保存图片哦！");
        return;
    }

    if (!contentRef.current || !activeNote) return;
    setLoadingMessage('正在冲印照片...'); // <-- 修改点

    const filter = (node: HTMLElement) => {
        return !node.classList?.contains('ignore-in-screenshot');
    };
    
    const scrollElement = document.getElementById('diary-scroll-view');
    const wrapperOldStyle = contentRef.current.style.cssText;
    let scrollOldStyle = '';
    if (scrollElement) scrollOldStyle = scrollElement.style.cssText;

    const watermark = document.createElement('div');
    watermark.id = 'temp-watermark'; 
    
    try {
        const authorName = settings.userName || 'hannie & 安乾铺';
        const now = new Date();
        const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        watermark.innerHTML = `...`; // (水印的 innerHTML 内容不变，为节省篇幅省略)
        watermark.style.cssText = `...`; // (水印的 style.cssText 内容不变，为节省篇幅省略)

        if (scrollElement) { /* ... */ }
        contentRef.current.style.height = 'auto';
        contentRef.current.style.overflow = 'visible';
        contentRef.current.appendChild(watermark);

        const dataUrl = await htmlToImage.toJpeg(contentRef.current, { quality: 0.95, backgroundColor: '#fffdf5', width: contentRef.current.offsetWidth, filter: filter });

        const link = document.createElement('a');
        link.download = `Diary-${activeNote.title || 'untitled'}.jpg`;
        link.href = dataUrl;
        link.click();

    } catch (e) { 
        console.error(e); 
        alert("保存失败，请重试"); 
    } finally { 
        contentRef.current.style.cssText = wrapperOldStyle;
        if (scrollElement) scrollElement.style.cssText = scrollOldStyle;
        
        const watermarkElement = document.getElementById('temp-watermark');
        if (watermarkElement) {
            watermarkElement.remove();
        }

        setLoadingMessage(null); // <-- 修改点
    }
};










// 这是一组什么代码：【终极版 · 汉堡包直接整理到文件，不再聊天回复】
const handleOrganizeCurrentNote = async () => {
  if (!activeNote) {
    alert("请先打开一篇笔记！");
    return;
  }

  const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
  if (!activePreset || !activePreset.apiKey) {
    alert("请先在设置里配置好 API Key 哦！");
    return;
  }

  setLoadingMessage("汉堡包正在整理这篇笔记...🍔");

  try {
    const content = activeNote.content;
    if (!content.trim()) {
      alert("这篇笔记为空哦~ 先写点东西再整理吧！");
      return;
    }

    // ★★★ 关键修改：告诉AI“不要回复我，直接整理到文件” ★★★
    const prompt = `你现在是“汉堡包🍔”，日记整理大师。
你的任务是：阅读下面这篇日记，提炼出不同主题，直接整理到对应分类笔记中。

铁律：
- 你不需要和我聊天
- 你不需要输出任何解释、分析、问候
- 你只需要输出整理结果，按下面格式：

### 工作
- 提炼的内容1
- 提炼的内容2

### 追星
- 提炼的内容1

### 家庭
- 提炼的内容1

（每个主题用 ### 开头，内容用 - 开头。如果没有某个主题就跳过。一定要提炼出至少1个主题，哪怕用“日常心情”兜底）

现在直接开始整理这篇日记，不要说任何废话：

${content}`;

    const messages = [{ role: 'user', content: prompt }];

    const aiResponse = await generateResponse(messages, activePreset);

    if (!aiResponse.content?.trim()) {
      alert("汉堡包没说话...可能网络问题，稍后再试~");
      return;
    }

    // 解析AI输出的整理结果
    const lines = aiResponse.content.split('\n');
    let currentCategory = "";
    let currentBullets: string[] = [];
    const categories: { name: string; bullets: string[] }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        if (currentCategory && currentBullets.length > 0) {
          categories.push({ name: currentCategory, bullets: currentBullets });
        }
        currentCategory = trimmed.slice(4).trim();
        currentBullets = [];
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        currentBullets.push(trimmed.slice(2).trim());
      }
    }
    if (currentCategory && currentBullets.length > 0) {
      categories.push({ name: currentCategory, bullets: currentBullets });
    }

    if (categories.length === 0) {
      alert("汉堡包看完了但没整理出内容...\n再写多点细节试试吧~");
      return;
    }

    // ★★★ 直接写入文件 ★★★
    let newFolders = [...folders];
    let newDiaries = [...diaries];
    let created = 0;

    for (const cat of categories) {
      // 创建或找分类文件夹
      let catFolder = newFolders.find(f => f.name === cat.name);
      if (!catFolder) {
        catFolder = {
          id: "cat_" + Date.now() + Math.random(),
          name: cat.name,
          parentId: 'root',
          collapsed: false,
        };
        newFolders.push(catFolder);
      }

      // 创建或追加到分类总笔记（标题就是分类名）
      let summaryNote = newDiaries.find(
        d => d.folderId === catFolder.id && d.title === cat.name
      );

      const timestamp = new Date().toLocaleDateString('zh-CN');
      const bulletText = cat.bullets.map(b => `- ${b}`).join('\n');
      const appendText = `\n\n---\n${timestamp}（来自《${activeNote.title || '无标题'}》）\n\n${bulletText}`;

      if (summaryNote) {
        // 追加
        summaryNote.content += appendText;
        summaryNote.updatedAt = Date.now();
      } else {
        // 新建
        summaryNote = {
          id: "org_" + Date.now() + Math.random(),
          title: cat.name,
          content: `# ${cat.name}\n\n${bulletText}`,
          folderId: catFolder.id,
          updatedAt: Date.now(),
        };
        newDiaries.push(summaryNote);
      }
      created++;
    }

    setFolders(newFolders);
    setDiaries(newDiaries);

    alert(`🍔 整理成功！汉堡包直接帮你归类了 ${created} 个主题到对应笔记里啦！\n快去看看吧~`);

  } catch (err: any) {
    console.error(err);
    alert("整理失败了：" + err.message);
  } finally {
    setLoadingMessage(null);
  }
};











// 这是一个数学辅助工具，用来计算两个“思想坐标”有多接近。
// 你不需要理解它的细节，只需要知道它能告诉我们哪两篇日记在思想上是相似的。
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// 这是我们的“星云发现器”，它会在“星图”中自动找出聚集在一起的日记群（主题）。
const clusterDiaries = (index: {id: string, vector: number[]}[], similarityThreshold = 0.75) => {
    const clusters: string[][] = [];
    const visited = new Set<string>();

    for (const entry of index) {
        if (visited.has(entry.id)) continue;

        const currentCluster = [entry.id];
        visited.add(entry.id);

        for (const otherEntry of index) {
            if (visited.has(otherEntry.id)) continue;
            
            const similarity = cosineSimilarity(entry.vector, otherEntry.vector);
            if (similarity > similarityThreshold) {
                currentCluster.push(otherEntry.id);
                visited.add(otherEntry.id);
            }
        }
        clusters.push(currentCluster);
    }
    return clusters;
};



























// 这是一组什么代码：【最终版 · 总AI整理逻辑】
// 作用：我们重写了整个总AI的整理逻辑，让它和“单篇笔记AI”的工作模式完全一样。
// 现在，当你点击“整理最近7天”等按钮时，它会非常可靠地分析你的日记，
// 然后像单篇整理一样，直接创建或更新对应的总结笔记文件，而不会再只输出文本聊天了。
const handleAIAction = async (action: string, payload: any) => {
  if (action !== 'EXECUTE_AI_COMMAND') return;

  const { diariesToProcess, aiConfig } = payload;
  
  if (!diariesToProcess || diariesToProcess.length === 0) {
    alert(`${aiConfig.name} 🍔 说：“大厨，这个范围暂时没有日记可以整理哦~”`);
    return;
  }
  
  const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
  if (!activePreset) {
    alert("请先在设置中配置有效的 API Key！");
    return;
  }

  setLoadingMessage(`${aiConfig.name} 正在努力阅读和整理...`);

  try {
    // 1. 把所有要处理的日记拼接成一份长长的“原材料”
    const diaryMaterials = diariesToProcess
      .map(d => `---
日期：${new Date(d.updatedAt).toLocaleDateString('zh-CN')}
标题：${d.title || '无标题'}
内容：
${d.content}
---`)
      .join('\n\n');

    // 2. 核心改造：使用和单篇整理完全一致的“格式化输出”指令
    const prompt = `你现在是“汉堡包🍔”，一个能力超强的日记整理大师。
你的任务是：深度阅读下面提供的所有日记材料，从中提炼出不同的主题，然后将每个主题的内容以 bullet points 的形式总结出来。

**铁律：**
1.  你不需要和我聊天或进行任何解释。
2.  你的回复必须、也只能包含整理好的内容。
3.  必须严格按照下面的格式输出，一个字都不能多，一个字都不能少。

**输出格式:**
### 主题名称1 (例如：工作心得)
- 从日记里提炼的要点1
- 从日记里提炼的要点2

### 主题名称2 (例如：追星日记)
- 提炼的要点1

（每个主题必须以 ### 开头，每个要点必须以 - 开头。如果材料里没有任何值得总结的内容，就什么都不要输出。）

现在，请直接开始整理以下所有日记材料，不要说任何无关的话：

${diaryMaterials}`;

    const messages = [{ role: 'user', content: prompt }];
    
    // 3. 调用 AI，获取纯文本回复 (不再使用复杂的 tool_calls)
    const aiResponse = await generateResponse(messages, activePreset);

    if (!aiResponse.content?.trim() || !aiResponse.content.includes('###')) {
      alert("汉堡包看完了但没整理出内容...\n可能日记太少或主题不明确，再多写点细节试试？");
      return;
    }

    // 4. 核心改造：复用单篇整理的“解析+写入文件”逻辑
    const lines = aiResponse.content.split('\n');
    let currentCategory = "";
    let currentBullets: string[] = [];
    const categories: { name: string; bullets: string[] }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        if (currentCategory && currentBullets.length > 0) {
          categories.push({ name: currentCategory, bullets: currentBullets });
        }
        currentCategory = trimmed.slice(4).trim();
        currentBullets = [];
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        if (currentCategory) {
          currentBullets.push(trimmed.slice(2).trim());
        }
      }
    }
    if (currentCategory && currentBullets.length > 0) {
      categories.push({ name: currentCategory, bullets: currentBullets });
    }

    if (categories.length === 0) {
      alert("汉堡包好像没找到可以总结的主题...");
      return;
    }

    // 5. 直接写入文件系统
    let newFoldersState = [...folders];
    let newDiariesState = [...diaries];
    let fragmentsCreated = 0;

    for (const cat of categories) {
      let categoryFolder = newFoldersState.find(f => f.name === cat.name);
      if (!categoryFolder) {
        const newFolderId = "auto_cat_" + Date.now() + Math.random();
        categoryFolder = {
          id: newFolderId,
          name: cat.name,
          parentId: 'root',
          collapsed: false,
        };
        newFoldersState.push(categoryFolder);
      }

      let summaryNote = newDiariesState.find(
        d => d.folderId === categoryFolder.id && d.title === cat.name
      );

      const timestamp = new Date().toLocaleDateString('zh-CN');
      const bulletText = cat.bullets.map(b => `- ${b}`).join('\n');
      const appendText = `\n\n---\n${timestamp}（AI总整理）\n\n${bulletText}`;

      if (summaryNote) {
        summaryNote.content += appendText;
        summaryNote.updatedAt = Date.now();
      } else {
        const newNote: DiaryEntry = {
          id: "ai_total_" + Date.now() + Math.random(),
          title: cat.name,
          content: `# ${cat.name}\n\n${bulletText}`,
          folderId: categoryFolder.id,
          updatedAt: Date.now(),
        };
        newDiariesState.push(newNote);
      }
      fragmentsCreated++;
    }

    // 6. 批量更新状态并提示成功
    setFolders(newFoldersState);
    setDiaries(newDiariesState);

    alert(`🍔 整理完成！\n${aiConfig.name} 帮你提炼了 ${fragmentsCreated} 个主题，并直接归档到对应的笔记里啦！\n快去看看吧~`);

  } catch (error: any) {
    console.error("总AI整理失败:", error);
    alert(`出错了：${error.message}\n可以检查网络或重试哦~`);
  } finally {
    setLoadingMessage(null);
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
    left={
        // ★★★ 我们所有的希望，都在这个小小的按钮上 ★★★
        <div className="flex items-center">
            <button onClick={onClose} className="text-sm font-bold text-[#8d6e63] bg-white/50 px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition flex items-center gap-1">
                ← 返回
            </button>
        
        </div>
        // ★★★ 请确保你的 left prop 看起来像上面这样 ★★★
    }
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
  onDeleteClick={handleDeleteFile}
  onOrganizeCurrentNote={handleOrganizeCurrentNote}  // <--- 新增这一行
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
                                        <div className="flex gap-2 text-[10px] text-[#a1887f] uppercase tracking-wider mt-2 border-b-2 border-dashed border-[#d7ccc8] pb-4 w-full"><span>{new Date(activeNote.updatedAt).toLocaleString()}</span>
<span>• WRITING</span><span>• {activeNote.content.length} WORDS</span></div>
                                    </div>

<div 
    className="flex-1 relative w-full overflow-hidden"
>
    {/* 
        💡 核心逻辑：
        1. 如果是编辑模式 (editMode is true)，就显示原始的 textarea。
        2. 如果是阅读模式 (editMode is false)，就显示漂亮的 PrettyRenderer。
        3. 点击 PrettyRenderer 区域，就会切换到编辑模式。
    */}

    {editMode ? (
        <>
            {/* 编辑模式：只显示输入框 */}
            <textarea 
                id="diary-editor-textarea"
                ref={textareaRef} 
                className="absolute inset-0 w-full h-full p-8 pt-2 pb-40 text-base leading-loose font-serif resize-none outline-none custom-scrollbar bg-transparent caret-stone-800"
                value={activeNote.content} 
                onChange={handleContentChange} 
                placeholder="在此处落笔..." 
            />
            {/* 点击完成按钮，退出编辑模式 */}

<button 
    onClick={() => setEditMode(false)}
    className="ignore-in-screenshot absolute bottom-5 right-5 z-50 bg-[#3e2723] text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition"
>
    完成编辑
</button>
        </>
    ) : (
        <>
            {/* 阅读模式：只显示渲染器 */}
            <div 
                id="diary-scroll-view"
                // 点击这个区域就进入编辑模式
                onClick={() => setEditMode(true)}
                className="absolute inset-0 w-full h-full p-8 pt-2 pb-40 overflow-y-auto custom-scrollbar z-10 cursor-text"
            >
                <PrettyRenderer 
                    content={activeNote.content} 
                    onLinkClick={handleWikiLink} 
                />
            </div>
            {/* 阅读模式下，加一个提示 */}

<div className="ignore-in-screenshot absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-300 bg-gray-50 px-2 py-1 rounded-full pointer-events-none">
    点击任意位置开始编辑
</div>
        </>
    )}
    
    {/* 智能补全 (只在编辑模式下显示) */}
    {editMode && (
        <LinkSuggestions 
            visible={showSuggestions} 
            query={suggestionQuery} 
            allFiles={diaries} 
            onSelect={handleSelectSuggestion} 
        />
    )}
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
                                       // 这是一组什么代码：【修改】切换文件时，默认进入阅读模式
onSelectFile={(id) => { 
    setCurrentFileId(id); 
    setEditMode(false); // <-- 新增：切换文件时，设置为阅读模式
    if (window.innerWidth < 640) setSidebarOpen(false); 
}}
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
// 这是一组什么代码：【完整版】AIAdminChat 组件调用，已传入所有必需的世界书数据
<AIAdminChat 
    diaries={diaries} 
    folders={folders} 
    settings={settings}
    setSettings={setSettings} // <--- 新增的这一行！
    worldBooks={worldBooks} 
    diaryAIWorldBookIds={diaryAIWorldBookIds}
    setDiaryAIWorldBookIds={setDiaryAIWorldBookIds} 
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

        


{loadingMessage && (
    <div className="fixed inset-0 z-[999] bg-white/20 flex items-center justify-center backdrop-blur-xl animate-fadeIn">
        <div className="bg-white/80 text-gray-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-scaleIn border border-white/50">
            {/* 呼吸灯动画本体 (由三个小点组成) */}
            <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
            </div>
            {/* 加载文字 */}
            <span className="text-sm font-bold tracking-wider">{loadingMessage}</span>
        </div>
    </div>
)}
            {ShareToAIModal && <ShareToAIModal isOpen={showShareModal} contacts={contacts || []} onClose={() => setShowShareModal(false)} onShare={handleShareToAI} />}
        </div>
    );
};




export default DiaryApp;