import React, { useState, useRef, useEffect, useMemo } from 'react';
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

// 这是一组什么代码：【升级版】数据库上下文提供器
// 作用：现在它会把日记的【全文】而不是【摘要】喂给AI，并且在开头强调“标题和内容同等重要”，
// 强制AI在分析时必须同时考虑两者，彻底解决“AI不看标题”的问题。
const getDatabaseContext = (diaries: DiaryEntry[], folders: Folder[], targetDiaries?: DiaryEntry[]) => {
    // 如果指定了目标日记（比如关键词搜索的结果），就用指定的；否则用最近的10篇
    const diariesToProcess = targetDiaries || diaries.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    
    // 统计数据
    const wordCount = diaries.reduce((acc, d) => acc + d.content.length, 0);
    const folderNames = folders.map(f => f.name).join(', ');

    return `
【当前数据库状态】
- 总日记数：${diaries.length} 篇
- 总字数：${wordCount} 字
- 文件夹列表：${folderNames}

【需要你重点分析的日记材料（注意：标题和内容同等重要！）】
${diariesToProcess.map(d => `
---
日期：${new Date(d.updatedAt).toLocaleDateString()}
标题：${d.title || '无标题'}
分类：${folders.find(f => f.id === d.folderId)?.name || '未分类'}
内容全文：
${d.content}
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
// 这是一组什么代码：【类型定义增强】
// 作用：在文件夹的“说明书”里，增加一个 color 属性，让每个文件夹都可以拥有自己的颜色。
interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed?: boolean;
  color?: string; // <--- 我们在这里加了一行，? 代表这个颜色不是必须的
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



// 这是一组什么代码：【紧凑版】文件行组件
// 作用：上下高度变窄了 (py-1)，看起来更精致，能放下更多文件。
// 这是一组什么代码：【印章版】文件行组件
// 作用：如果笔记被 AI 整理过（moos? 属性或特定标记），就会在标题后面盖一个淡灰色的【已整理】戳。
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
    
    // 👇 判断是否被整理过 (我们稍微扩展一下 DiaryEntry 的类型，暂用 any 规避，或者你在 handleOrganize 里加个标记)
    const isOrganized = (file as any).isOrganized;

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
            className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-all ml-3 border-l-2 
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
            <div className="flex items-center gap-1 min-w-0">
                <span className="text-xs truncate">{file.title || "无标题"}</span>
                {/* 👇 这就是你要的印章！ */}
                {isOrganized && <span className="text-[8px] bg-gray-100 text-gray-400 px-1 rounded-sm flex-shrink-0">已整理</span>}
            </div>
        </div>
    );
};










// 这是一组什么代码：【修复颜色+紧凑版】文件夹组件
// 作用：既保持了紧凑的列表，又修复了“颜色消失”的Bug。
// 原理：直接读取 folder.color，只要有值就渲染背景色。
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
    
    // 颜色转换工具
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

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
    
    // 👇 核心修复：只要有颜色，就认定为有颜色，不看是不是根目录
    const hasColor = !!folder.color;

    const folderBind = useLongPressHook(folder.id, 'folder', () => {
        onSelectFolder(folder.id);
        onToggle(folder.id);
    });

    const folderStyle: React.CSSProperties = {
        marginLeft: `${level * 10}px`
    };
    
    let folderClassName = `flex items-center justify-between px-2 py-0.5 rounded-lg cursor-pointer transition-all `; 

    if (selectedIds.has(folder.id)) {
        folderClassName += 'bg-red-50 border border-red-200';
    } else if (isFolderSelected) {
        folderClassName += 'bg-[#e2dfd2] font-bold text-[#3e2723] shadow-inner';
    } else if (hasColor) {
        // 👇 只要有颜色，就渲染背景色
        folderStyle.backgroundColor = hexToRgba(folder.color!, 0.15); 
        folderStyle.borderColor = hexToRgba(folder.color!, 0.3);
        folderStyle.borderWidth = '1px';
        folderClassName += ' font-bold ';
    } else {
        folderClassName += 'hover:bg-[#efece3] text-gray-700';
    }
    
    const textColor = hasColor ? folder.color : (isFolderSelected ? '#3e2723' : '#5a5a5a');

    return (
        <div className="mb-0.5 select-none">
            <div {...folderBind} className={folderClassName} style={folderStyle}>
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {isSelectionMode && (
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${selectedIds.has(folder.id) ? 'bg-red-500 border-red-500 text-white' : 'border-gray-400 bg-white'}`}>
                            {selectedIds.has(folder.id) && <span className="text-[8px]">✓</span>}
                        </div>
                    )}
                    <span className="text-[8px] transition-transform duration-200 text-gray-400" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span className="text-sm" style={{ color: hasColor ? folder.color : 'inherit' }}>{hasColor ? '🗂️' : (isOpen ? '📂' : '📁')}</span>
                    <span className="text-xs truncate font-bold" style={{ color: textColor }}>{folder.name}</span>
                </div>
            </div>

            {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                    {subFolders.map(sub => (
                        <FolderItem key={sub.id} folder={sub} {...{allFolders, allFiles, currentFileId, selectedFolderId, isSelectionMode, selectedIds, onLongPress, onToggleSelect, onToggle, onSelectFolder, onSelectFile}} level={level + 1} />
                    ))}
                    {files.map(file => (
                        <FileItem key={file.id} file={file} isSelectionMode={isSelectionMode} selectedIds={selectedIds} currentFileId={currentFileId} onLongPress={onLongPress} onToggleSelect={onToggleSelect} onSelectFile={onSelectFile} style={{ marginLeft: `${(level + 1) * 10 + 12}px` }} />
                    ))}
                    {files.length === 0 && subFolders.length === 0 && <div className="text-[10px] text-gray-300 pl-8 py-0.5">（空）</div>}
                </div>
            )}
        </div>
    );
};












// 这是一组什么代码：【终极融合版】PrettyRenderer
// 作用：
// 1. 完美复刻 H1-H6 全套样式（找回了你丢失的漂亮标题）。
// 2. 智能双模式：AI整理的内容显示为“小白卡”，你自己写的保持“原生排版”。
// 3. 语法全开：高亮、双链、图片、待办、代码块全都有。
const PrettyRenderer: React.FC<{ content: string; onLinkClick: (t: string) => void }> = ({ content, onLinkClick }) => {
    if (!content) return <div className="text-gray-300 italic font-serif mt-4"></div>;

    // --- 🛠️ 内部工具：行内样式解析 (图片、高亮、双链等) ---
    const parseInline = (text: string) => {
        const regex = /(!\[.*?\]\(.*?\)|\[\[.*?\]\]|==.*?==|\*\*.*?\*\*|`.*?`|~~.*?~~|#[a-zA-Z0-9\u4e00-\u9fa5]+)/g;
        const parts = text.split(regex);
        return parts.map((part, index) => {
            // 图片
            if (part.startsWith('![') && part.includes('](') && part.endsWith(')')) {
                const match = part.match(/!\[(.*?)\]\((.*?)\)/);
                if (match) return <img key={index} src={match[2]} alt={match[1]} className="w-full h-auto rounded-xl my-3 shadow-md border border-gray-100" />;
            }
            // 双链
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const title = part.slice(2, -2);
                return <span key={index} onClick={(e) => { e.stopPropagation(); onLinkClick(title); }} className="text-[#8d6e63] font-bold cursor-pointer hover:underline border-b-2 border-[#8d6e63]/20 mx-1 px-1 rounded transition hover:bg-[#8d6e63]/10">{title}</span>;
            }
            // 高亮
            if (part.startsWith('==') && part.endsWith('==')) return <mark key={index} className="bg-[#fff59d] text-[#3e2723] px-1 rounded-sm mx-0.5">{part.slice(2, -2)}</mark>;
            // 代码
            if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="bg-gray-100 text-[#d81b60] px-1.5 py-0.5 rounded mx-1 font-mono text-xs border border-gray-200">{part.slice(1, -1)}</code>;
            // 删除线
            if (part.startsWith('~~') && part.endsWith('~~')) return <del key={index} className="text-gray-400 decoration-2 mx-0.5">{part.slice(2, -2)}</del>;
            // 标签
            if (part.startsWith('#') && !part.includes(' ') && part.length > 1) return <span key={index} className="text-[#e91e63] font-bold bg-pink-50 px-2 py-0.5 rounded-full mx-1 text-xs border border-pink-100">#{part.slice(1)}</span>;
            // 加粗
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-black text-[#3e2723]">{part.slice(2, -2)}</strong>;
            
            return <span key={index}>{part}</span>;
        });
    };

    // --- 🎨 核心逻辑：渲染块级元素 (找回了 H1-H6 的灵魂！) ---
    const renderBlock = (blockContent: string) => {
        return blockContent.split('\n').map((line, i) => {
            const trimmed = line.trim();
            
            // === 👑 标题样式复活区 ===
            // H1: 巨大，带底部长横线
            if (trimmed.startsWith('# ')) {
                return <h1 key={i} className="text-2xl font-black text-[#3e2723] mt-8 mb-4 border-b-2 border-[#d7ccc8] pb-2 tracking-wide">{parseInline(trimmed.slice(2))}</h1>;
            }
            // H2: 很大，左侧带竖线装饰
            if (trimmed.startsWith('## ')) {
                return <h2 key={i} className="text-xl font-bold text-[#5d4037] mt-6 mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-[#d7ccc8] rounded-full"></span>{parseInline(trimmed.slice(3))}</h2>;
            }
            // H3: 较大，深棕色
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
            // H6: 最小，灰色斜体 (备注)
            if (trimmed.startsWith('###### ')) {
                return <h6 key={i} className="text-xs font-bold text-gray-400 mt-2 mb-1 italic tracking-wider uppercase">{parseInline(trimmed.slice(7))}</h6>;
            }

            // === 其他元素 ===
            // 待办事项
            if (trimmed.startsWith('- [ ] ')) return <div key={i} className="flex items-start gap-3 ml-1 my-2 bg-gray-50 p-2 rounded-lg border border-gray-100"><input type="checkbox" readOnly className="mt-1 w-4 h-4 accent-[#8d6e63]" /><span className="text-gray-700 text-sm flex-1">{parseInline(trimmed.slice(6))}</span></div>;
            if (trimmed.startsWith('- [x] ')) return <div key={i} className="flex items-start gap-3 ml-1 my-2 bg-gray-50/50 p-2 rounded-lg border border-transparent"><input type="checkbox" checked readOnly className="mt-1 w-4 h-4 accent-[#8d6e63] opacity-50" /><span className="text-gray-400 text-sm flex-1 line-through">{parseInline(trimmed.slice(6))}</span></div>;

            // 无序列表
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return <div key={i} className="flex items-start gap-2 ml-1 my-1.5"><span className="text-[#8d6e63] mt-2 text-[6px] shrink-0">●</span><span className="leading-relaxed flex-1 text-[#4e342e]">{parseInline(trimmed.slice(2))}</span></div>;
            }
            
            // 来源行
            if (trimmed.startsWith('*来源:') || trimmed.startsWith('*归档来源:')) {
                return (
                    <div key={i} className="flex justify-end mt-6 pt-2">
                        <div className="text-[10px] text-[#90a4ae] bg-[#eceff1] px-3 py-1.5 rounded-full font-mono flex items-center gap-1.5 select-none">
                            <span>📎</span> {parseInline(trimmed.replace(/\*/g, ''))}
                        </div>
                    </div>
                );
            }

            // 引用块
            if (trimmed.startsWith('> ')) return <div key={i} className="border-l-[3px] border-[#d7ccc8] bg-[#fdfbf7] p-3 rounded-r-xl my-3 text-sm text-[#6d4c41] italic">{parseInline(trimmed.slice(2))}</div>;

            // 分割线
            if (trimmed === '---' || trimmed === '***') return <div key={i} className="h-px bg-gradient-to-r from-transparent via-[#d7ccc8] to-transparent my-6 opacity-50"></div>;

            // 空行
            if (!trimmed) return <div key={i} className="h-3"></div>;

            // 普通段落
            return <div key={i} className="leading-7 text-[15px] text-[#3e2723]/90 min-h-[1.5em] tracking-wide text-justify">{parseInline(line)}</div>;
        });
    };

    // === 🕵️‍♀️ 智能侦探：判断是否为 AI 整理后的卡片 ===
    // 依据：有 "======" 或者 有 "*来源: [[" 的就是 AI 整理的
    const isOrganizedCard = content.includes('======') || content.includes('*来源: [[');

    if (isOrganizedCard) {
        // === 🅰️ 模式：小白卡模式 (AI整理内容) ===
        const cards = content.split('======');
        return (
            <div className="space-y-8 pb-40">
                {cards.map((card, idx) => {
                    if (!card.trim()) return null;
                    return (
                        <div key={idx} className="bg-white p-7 rounded-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] border border-gray-100 relative group transition-transform hover:scale-[1.005]">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-8 bg-[#fffdf5]/50 backdrop-blur-sm border-x border-white/50 rotate-[-1deg] shadow-sm pointer-events-none"></div>
                            <div className="relative">
                                {/* 在卡片里也用那套精美的 H1-H6 渲染逻辑 */}
                                {renderBlock(card.trim())}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    } else {
        // === 🅱️ 模式：原生笔记模式 (你的碎碎念) ===
        return (
            <div className="pb-40 font-serif text-gray-800"> 
                {renderBlock(content)}
            </div>
        );
    }
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

// 这是一组什么代码：【升级版】菜单，增加了“偏好设置”入口
// 直接找到原来的 MenuDropdown 组件，整段替换成下面这个
const MenuDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onShareClick: () => void;
  onSaveImageClick: () => void;
  onToggleAI: () => void;
  onDeleteClick: () => void;
  onOrganizeCurrentNote: () => void;
  onOpenSettings: () => void; // <--- 新增的打开设置函数
}> = ({ isOpen, onClose, onShareClick, onSaveImageClick, onToggleAI, onDeleteClick, onOrganizeCurrentNote, onOpenSettings }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute top-12 right-2 w-44 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/50 z-50 animate-scaleIn origin-top-right overflow-hidden p-1">
        <button onClick={() => { onShareClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-pink-50 hover:text-pink-500 rounded-xl flex items-center gap-2 transition"><span>💌</span> 分享给 AI</button>
        <button onClick={() => { onSaveImageClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-500 rounded-xl flex items-center gap-2 transition"><span>📸</span> 保存图片</button>
        <button 
          onClick={() => { 
            onOrganizeCurrentNote(); 
            onClose(); 
          }} 
          className="w-full text-left px-3 py-2.5 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl flex items-center gap-2 transition"
        >
          <span>🗂️</span> AI整理这篇笔记
        </button>

        {/* 👇 新增的“偏好设置”按钮，这是新的入口！👇 */}
        <button 
          onClick={() => { 
            onOpenSettings(); 
            onClose(); 
          }} 
          className="w-full text-left px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl flex items-center gap-2 transition"
        >
          <span>⚙️</span> 偏好设置
        </button>

        <div className="h-px bg-gray-100 my-1"></div>
        <button onClick={() => { onDeleteClick(); onClose(); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition"><span>🗑️</span> 删除笔记</button>
      </div>
    </>
  );
};








// 这是一组什么代码：【全新】偏好设置弹窗
// 作用：这是一个独立的、可重复使用的弹窗组件，专门用来显示应用的各种设置项。
// 我们将把“分类颜色定制”功能从 AI 页面彻底搬到这里来。
const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: GlobalSettings;
    // 👇 注意：我们把 handleColorChange 函数作为参数传进来
    onColorChange: (categoryName: string, color: string) => void; 
}> = ({ isOpen, onClose, settings, onColorChange }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div className="bg-[#fffdf5] w-[90%] max-w-md rounded-3xl p-5 shadow-2xl animate-scaleIn border-[6px] border-white" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4">
                    <span className="text-2xl">⚙️</span>
                    <h3 className="font-bold text-[#5d4037] text-lg">偏好设置</h3>
                    <p className="text-xs text-gray-400 mt-1">在这里定制你的专属日记本</p>
                </div>
                
                {/* 👇 我们把颜色设置的UI代码，完整地从 AI 页面搬到了这里 👇 */}
                <div className="bg-white/50 p-5 rounded-2xl shadow-inner border border-gray-200/50">
                    <h3 className="text-sm font-bold text-green-600 mb-3">🎨 分类颜色定制</h3>
                    <p className="text-xs text-gray-400 mb-4">为你的顶级分类选择专属颜色，让侧边栏一目了然。</p>
                    <div className="space-y-3">
                        {Object.entries(settings.categoryColors || {'生活':'#f39c12', '工作':'#3498db', '学习':'#9b59b6', '个人':'#2ecc71'}).map(([name, color]) => (
                            <div key={name} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md border" style={{ backgroundColor: color as string }}></div>
                                    <span className="font-bold text-sm text-gray-700">{name}</span>
                                </div>
                                <input 
                                    type="color" 
                                    value={color as string}
                                    // 👇 现在它调用的是从外部传进来的 onColorChange 函数
                                    onChange={(e) => onColorChange(name, e.target.value)}
                                    className="w-8 h-8 p-0 border-none rounded-md cursor-pointer bg-transparent"
                                    style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={onClose} className="w-full mt-5 py-3 bg-[#efece3] text-[#8d6e63] rounded-xl font-bold text-sm">关闭</button>
            </div>
        </div>
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
    // 👇 注意：我们不再需要 setFolders 了，因为颜色设置功能已经移走
    // setFolders: React.Dispatch<React.SetStateAction<Folder[]>>, 
    settings: GlobalSettings,
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>,
    worldBooks: WorldBookCategory[], 
    diaryAIWorldBookIds: Set<string>,
    setDiaryAIWorldBookIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    onAction: (action: string, payload: any) => void;
}>= ({ diaries, folders, settings, setSettings, worldBooks, diaryAIWorldBookIds, setDiaryAIWorldBookIds, onAction }) => {
    
    const [mode, setMode] = useState<'chat' | 'settings'>('chat');
    const [input, setInput] = useState("");
    const [isAiTyping, setIsAiTyping] = useState(false); 
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [history, setHistory] = useState<{role: 'user'|'assistant', content: string, timestamp: number}[]>([]);

    const userPersona = settings.diaryUserPersona || '';
    const aiConfig = settings.diaryAIConfig || { name: '汉堡包', persona: '' };

    // ... (这里的所有 useEffect 和 handleSend, handleAiReplyTrigger 函数都保持不变, 无需改动) ...
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
    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = { role: 'user' as const, content: input, timestamp: Date.now() };
        setHistory(prev => [...prev, userMsg]);
        setInput("");
    };




// 这是一组什么代码：【稳健版】历史记录追踪
    // 作用：自动记录你的浏览足迹。修复了“按钮没用”的 Bug。
    useEffect(() => {
        if (!currentFileId) return;

        // 1. 如果是点击“PREV/NEXT”按钮触发的，不要重复记录
        if (isNavigatingHistory.current) {
            isNavigatingHistory.current = false; // 重置标记
            return;
        }

        // 2. 正常的点击跳转：把“未来”的历史剪掉，压入新历史
        setHistoryStack(prev => {
            const newStack = prev.slice(0, historyIndex + 1);
            // 只有当这篇和上一篇不一样时才记录 (去重)
            if (newStack[newStack.length - 1] !== currentFileId) {
                newStack.push(currentFileId);
            }
            return newStack;
        });

        // 3. 更新指针到最新位置
        setHistoryIndex(prev => {
             // 这里有个小逻辑：因为 setHistoryStack 是异步的，我们直接计算新的 index
             // 如果是第一次加载，index 设为 0
             if (historyStack.length === 0) return 0;
             return historyIndex + 1;
        });

    }, [currentFileId]); // 监听当前文件变化









// 这是一组什么代码：【最终版】AI回复触发器 (集成关键词检索)
// 作用：这是AI的“超级大脑”。它现在能听懂两种指令：
// 1. 普通聊天：像之前一样，参考最近的日记进行回复。
// 2. 关键词总结：当你发送“总结一下关于【xxx】的日记”时，它会自动找出所有包含“xxx”的日记，
//    并只针对这些日记进行深度分析和总结，实现精准打击！
const handleAiReplyTrigger = async () => {
        if (isAiTyping) return; const lastUserMessage = history.findLast(m => m.role === 'user'); if (!lastUserMessage) return; setIsAiTyping(true); try { const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId); if (!activePreset) { alert("错误：API 预设未找到"); setIsAiTyping(false); return; } let targetDiaries: DiaryEntry[] | undefined = undefined; let analysisTopic = "近期内容"; const keywordMatch = lastUserMessage.content.match(/总结一下关于【(.*?)】/); if (keywordMatch && keywordMatch[1]) { const keyword = keywordMatch[1].trim(); analysisTopic = `关于“${keyword}”`; targetDiaries = diaries.filter(d => (d.title && d.title.includes(keyword)) || d.content.includes(keyword)); if (targetDiaries.length === 0) { const noResultMessage = { role: 'assistant' as const, content: `抱歉，我翻遍了你的日记，没有找到任何关于“${keyword}”的内容哦。`, timestamp: Date.now() }; setHistory(prev => [...prev, noResultMessage]); setIsAiTyping(false); return; } } const now = new Date(); const userTime = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); const { gapDescription, blameInstruction } = getTimeGapAndBlame(history); const energyInstruction = getEnergyInstruction({ energyLevel: 80 }); const diaryContext = getDatabaseContext(diaries, folders, targetDiaries); const relationshipInstruction = "【🙂处于朋友状态】\n态度：轻松、自然、友好。"; const systemPrompt = `# 🕶️ 角色扮演核心指令\n你的核心身份和性格，完全由下面的 [Persona] 决定。\n\n[Persona]\n${aiConfig.persona}\n---\n\n# 🧠 记忆库 (你正在分析 ${analysisTopic})\n这是你主人关于【${analysisTopic}】的日记全文，你必须仔细阅读所有细节，特别是标题！\n\n${diaryContext}\n---\n\n# ⏰ 强制时空坐标\n- 距离上一条消息已过去：>>> ${gapDescription} <<<\n- 责任判定指令：${blameInstruction}\n- 你当前的精力状态: ${energyInstruction}\n- 用户当地时间: ${userTime}\n---\n\n# ❤️ 关系感知\n${relationshipInstruction}\n---\n\n# 🚫 聊天铁律\n- **标题和内容同等重要！** 在分析时绝对不能忽略标题里的信息。\n- 专注于回应用户最新的消息，并结合你正在分析的日记内容给出深刻、准确的见解。\n- 你的回复必须是【纯粹的口语】，像真人一样自然。`; const messagesForAPI = [{ role: 'system', content: systemPrompt }, { role: 'user', content: lastUserMessage.content }]; const aiResponse = await generateResponse(messagesForAPI, activePreset); const aiContent = aiResponse.content || "我好像有点卡住了..."; const newMsg = { role: 'assistant' as const, content: aiContent, timestamp: Date.now() }; await new Promise(resolve => setTimeout(resolve, 1200)); setHistory(prev => [...prev, newMsg]); } catch (error: any) { const errorMsg = { role: 'assistant' as const, content: `糟糕，出错了: ${error.message}`, timestamp: Date.now() }; setHistory(prev => [...prev, errorMsg]); } finally { setIsAiTyping(false); }
    };
    const promptSuggestions = [ { label: '🧐 分析近期情感', command: '请帮我深入分析一下最近的日记内容，总结一下我近期的主要情感和心理状态。'}, { label: '📊 分析心情状况', command: '请基于我的日记，分析我最近的心情分布情况，比如哪种情绪出现的比较多？'}, { label: '💡 提炼核心主题', command: '帮我看看我最近都在关心些什么？请从日记里提炼出几个核心主题。'}, { label: '✍️ 生成一段总结', command: '请根据我最近的日记，为我生成一段简短的周报或总结。'}, ];

    // 👇 【核心升级】处理颜色变化的函数，现在对所有顶级文件夹生效
    const handleColorChange = (categoryName: string, color: string) => {
        // 1. 更新全局设置
        setSettings(prev => {
            const newColors = { ...(prev.categoryColors || {}), [categoryName]: color };
            return { ...prev, categoryColors: newColors };
        });

        // 2. 直接更新当前文件夹列表里对应文件夹的颜色，实现立即生效
        setFolders(prevFolders => {
            return prevFolders.map(folder => {
                // 关键改动：只要是顶级文件夹（parentId === 'root'）且名字匹配，就更新颜色
                if (folder.parentId === 'root' && folder.name === categoryName) {
                    return { ...folder, color: color };
                }
                return folder;
            });
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#f5f5f0]">
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-200">
                <div className="flex items-center gap-2"> <span className="text-2xl animate-bounce">🍔</span> <div> <span className="text-xs font-bold text-gray-800">{aiConfig.name}</span> <span className={`text-[9px] font-bold block ${isAiTyping ? 'text-blue-500 animate-pulse' : 'text-orange-500'}`}> {isAiTyping ? '正在输入...' : 'Online'} </span> </div> </div>
                <button onClick={() => setMode(mode === 'chat' ? 'settings' : 'chat')} className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-200 transition"> {mode === 'chat' ? '⚙️ 调味' : '💬 喂食'} </button>
            </div>

            {mode === 'chat' && ( <> <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"> {history.map((msg, i) => ( <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}> <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-[#5d4037] text-white' : 'bg-white text-gray-800'}`}>{msg.content}</div> </div> ))} {isAiTyping && <div className="text-xs text-blue-500 animate-pulse ml-2">正在输入...</div>} <div ref={messagesEndRef} /> </div> <div className="p-3 bg-white border-t border-gray-200"> <div className="flex gap-2 pb-2 overflow-x-auto"> {promptSuggestions.map(s => ( <button key={s.label} onClick={() => { setInput(s.command); }} className="flex-shrink-0 px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full border hover:bg-gray-200 transition"> {s.label} </button> ))} </div> <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2 mt-2"> <textarea className="flex-1 bg-transparent text-sm outline-none resize-none" rows={1} placeholder={`和 ${aiConfig.name} 聊聊...`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} /> <button onClick={handleAiReplyTrigger} disabled={isAiTyping} className="bg-blue-500 text-white w-8 h-8 rounded-full font-bold text-lg disabled:opacity-50 disabled:animate-pulse transition-transform active:scale-90"> ✨ </button> <button onClick={handleSend} disabled={isAiTyping} className="bg-[#5d4037] text-white w-8 h-8 rounded-full font-bold disabled:opacity-50">↑</button> </div> </div> </>
            )}

            {/* 设置界面 (已修复) */}
            {mode === 'settings' && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar animate-fadeIn space-y-6">
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
										}}
                                        className="h-4 w-4 text-blue-600"
                                    />
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
// ==================== 📔 DiaryApp 主程序 ====================
// 改成这样
const DiaryApp: React.FC<DiaryAppProps> = ({ settings, setSettings, contacts, setContacts, worldBooks, onClose }) => {
   
    // --- 1. 数据状态 (State) ---
    // 所有的 useState 都应该放在组件的最顶层，作为“数据仓库”
    const defaultFolders = [
        { id: 'root', name: '我的手账本', parentId: null, collapsed: false },
        { id: 'f1', name: '日常碎碎念', parentId: 'root', collapsed: false },
    ];
    const defaultEntries = [
        { id: 'd1', title: '关于汉堡包的设想', content: '#灵感 如果把 [[汉堡包]] 做成手机会怎么样？', folderId: 'f1', updatedAt: Date.now() },
    ];

    const [folders, setFolders] = useState<Folder[]>(defaultFolders);
    const [diaries, setDiaries] = useState<DiaryEntry[]>(defaultEntries);
   // --- 🌍 浏览历史记录状态 ---
 const [showSearch, setShowSearch] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState("");

    // --- 🕰️ [修复] 历史记录系统 (使用 Ref 防止逻辑冲突) ---
    const [historyStack, setHistoryStack] = useState<string[]>([]); 
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isNavigatingHistory = useRef(false); // 👈 使用 Ref 来标记“正在翻页”，这比 State 更准
    const [isLoaded, setIsLoaded] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'note' | 'dashboard' | 'chat'>('note');
    const [moodData, setMoodData] = useState({});
    const [diaryAIWorldBookIds, setDiaryAIWorldBookIds] = useState<Set<string>>(new Set());
    





    // UI 状态
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentFileId, setCurrentFileId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
    const [showMenu, setShowMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    
    // 编辑器相关
    const [suggestionQuery, setSuggestionQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null); 
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const activeNote = diaries.find(d => d.id === currentFileId);
    const [editMode, setEditMode] = useState(false); 

    // 多选相关状态
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const prevEditMode = usePrevious(editMode);
    const [showSettingsModal, setShowSettingsModal] = useState(false); // <--- 添加这一行
const searchResults = useMemo(() => {
        if (!searchKeyword.trim()) return [];
        return diaries.filter(d => 
            (d.title && d.title.toLowerCase().includes(searchKeyword.toLowerCase())) || 
            (d.content && d.content.toLowerCase().includes(searchKeyword.toLowerCase()))
        );
    }, [searchKeyword, diaries]);










    // --- 2. 效果钩子 (Effects) ---
    // 所有的 useEffect 都应该放在 useState 的后面，作为“自动运行”的指令

    // 这是一组什么代码：【默认颜色初始化】
    useEffect(() => {
        // App启动时，检查并设置默认的分类颜色
        if (!settings.categoryColors) {
            setSettings((prev: GlobalSettings) => ({
                ...prev,
                categoryColors: { '生活': '#f39c12', '工作': '#3498db', '学习': '#9b59b6', '个人': '#2ecc71' }
            }));
        }
    }, []);

    // 作用：不管文件夹藏在第几层，只要名字是你设置过的（比如“生活”、“个人”），就强制给它上色。
    useEffect(() => {
        if (!isLoaded || !settings.categoryColors) return;

        let needsUpdate = false;
        const colorSettings = settings.categoryColors as any;

        const updatedFolders = folders.map(folder => {
            // 👇 修改点：直接检查文件夹名字，不关心它在哪里 (parentId)
            const expectedColor = colorSettings[folder.name];
            
            // 如果名字匹配，且当前颜色不对，就更新它
            if (expectedColor && folder.color !== expectedColor) {
                needsUpdate = true;
                return { ...folder, color: expectedColor };
            }
            // 如果名字不匹配（用户删除了颜色配置），但它身上还有颜色，就去掉
            if (!expectedColor && folder.color) {
                needsUpdate = true;
                return { ...folder, color: undefined };
            }
            return folder;
        });

        if (needsUpdate) {
            setFolders(updatedFolders);
        }
    }, [isLoaded, folders, settings.categoryColors, setSettings]);

    // 加载数据
    useEffect(() => {
        const loadData = async () => {
            try {
                const savedFolders = await localforage.getItem<Folder[]>('diary_folders_db');
                const savedEntries = await localforage.getItem<DiaryEntry[]>('diary_entries_db');
                if (savedFolders) setFolders(savedFolders);
                if (savedEntries) setDiaries(savedEntries);
                const savedDiaryWB = await localforage.getItem<string[]>('diary_ai_wb_ids');
                if (savedDiaryWB) setDiaryAIWorldBookIds(new Set(savedDiaryWB));
            } catch (err) { console.error(err); } finally { setIsLoaded(true); }
        };
        loadData();
    }, []);

    // 自动保存
    useEffect(() => {
        if (isLoaded) {
            localforage.setItem('diary_folders_db', folders);
            localforage.setItem('diary_entries_db', diaries).catch(console.error);
        }
    }, [folders, diaries, isLoaded]);

    useEffect(() => {
        if (isLoaded) {
            localforage.setItem('diary_ai_wb_ids', Array.from(diaryAIWorldBookIds));
        }
    }, [diaryAIWorldBookIds, isLoaded]);
// 这是一组什么代码：【初始化选中文件】(安全版)
    // 作用：只在刚打开APP且没有选中文件时执行一次。
    // ⚠️ 绝对不要在这里写 focus()，否则每打一个字光标都会跑！
    useEffect(() => {
        if (isLoaded && !currentFileId && diaries.length > 0) setCurrentFileId(diaries[0].id);
    }, [isLoaded, diaries, currentFileId]);

// 这是一组什么代码：【最终版·智能聚焦指令】
// 作用：这是我们从根源上修复问题的最终方案。这段代码现在拥有了“记忆”，
// 它只会在“编辑模式”刚刚从 false 变为 true 的那一瞬间触发一次，
// 将光标放到内容区。在之后的所有操作中，它都会保持沉默，绝对不会再抢夺你的光标！
useEffect(() => {
    // 核心条件：只有当【现在是编辑模式】并且【刚才还不是编辑模式】时，才执行！
    if (editMode && !prevEditMode) {
        setTimeout(() => {
            textareaRef.current?.focus();
            // 顺便把光标移动到文字末尾
            const len = textareaRef.current?.value.length || 0;
            textareaRef.current?.setSelectionRange(len, len);
        }, 100); // 稍微增加一点延迟，确保UI渲染完成
    }
}, [editMode, prevEditMode]); // 这个指令现在只关心“编辑模式”的变化














// 这是一组什么代码：【颜色设置总指挥】
// 作用：这个函数现在被移动到了主程序 DiaryApp 中，负责接收从“偏好设置”弹窗传来的颜色变化指令，
// 并直接更新全局的 settings 和 folders 数据，确保颜色设置能影响到整个 App。
const handleColorChange = (categoryName: string, color: string) => {
    setSettings(prev => {
        const newColors = { ...(prev.categoryColors || {}), [categoryName]: color };
        return { ...prev, categoryColors: newColors };
    });
    setFolders(prevFolders => {
        return prevFolders.map(folder => {
            if (folder.parentId === 'root' && folder.name === categoryName) {
                return { ...folder, color: color };
            }
            return folder;
        });
    });
};

// --- 🗑️ 多选删除功能区 ---
// ... 后续代码 ...








// --- 🗑️ 多选删除功能区 ---

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









// 这是一组什么代码：【防崩溃版】批量智能移动
// 作用：增加了安全检查，防止 AI 返回的数据格式不对导致程序白屏报错 (match error)。
const handleBatchSmartMove = async () => {
    if (selectedIds.size === 0) return;
    const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
    if (!activePreset) { alert("请先配置 API Key！"); return; }
   
    if (!confirm(`🤖 AI 即将接管并移动选中的 ${selectedIds.size} 篇笔记。\n\n它会根据内容自动将笔记放入最合适的文件夹。\n\n确定要继续吗？`)) return;
    setLoadingMessage(`AI 正在分析 ${selectedIds.size} 篇笔记的去向...`);
    
    // 1. 准备文件夹地图
    const folderMap = folders.filter(f => f.parentId !== 'root').map(f => {
        const parent = folders.find(p => p.id === f.parentId);
        const parentName = parent ? parent.name : '根目录';
        return `ID: "${f.id}", 路径: "${parentName}/${f.name}"`;
    }).join('\n');
    
    // 2. 准备笔记内容
    const notesToMove: DiaryEntry[] = [];
    selectedIds.forEach(id => {
        const note = diaries.find(d => d.id === id);
        if (note) notesToMove.push(note);
    });
    const notesContent = notesToMove.map(n => `笔记ID: "${n.id}", 内容摘要: "${n.title} - ${n.content.slice(0, 100).replace(/\n/g, ' ')}..."`).join('\n');
    
    try {
        const prompt = `
# 任务
你是一个文件整理助手。请将下方的【笔记】移动到最匹配的【文件夹】中。
# 候选文件夹列表
${folderMap}
# 待移动笔记
${notesContent}
# 规则
1. 根据笔记内容，找到语义最接近的文件夹。
2. 如果完全找不到合适的，请返回 ID: "Unsorted"。
3. 输出格式必须是 JSON 数组：[{"noteId": "xxx", "targetFolderId": "xxx"}, ...]
4. 只输出 JSON，不要废话。
`;
        const aiResponse = await generateResponse([{ role: 'user', content: prompt }], activePreset);
       
        // --- 🛡️ 安全防御代码开始 ---
        // 如果 AI 返回的 content 是空的或者不是字符串，直接报错，不要往下执行 .match
        if (!aiResponse || typeof aiResponse.content !== 'string') {
            throw new Error("AI 返回了无效的数据格式，请重试。");
        }
        // --- 🛡️ 安全防御代码结束 ---

        // 尝试解析 JSON
        const jsonStr = aiResponse.content.match(/\[.*\]/s)?.[0];
        if (!jsonStr) throw new Error("AI 没有返回有效的 JSON 格式");
       
        const moveInstructions: {noteId: string, targetFolderId: string}[] = JSON.parse(jsonStr);
       
        let movedCount = 0;
        let newDiaries = [...diaries];
        let newFolders = [...folders];
        
        // 确保有一个暂未分类文件夹
        let unsortedFolderId = folders.find(f => f.name === '暂未分类')?.id;
        if (!unsortedFolderId) {
             if (moveInstructions.some(i => i.targetFolderId === 'Unsorted')) {
                 const newFolder = { id: "ai_unsorted_move_" + Date.now(), name: '暂未分类', parentId: 'root', collapsed: false, color: '#95a5a6' };
                 newFolders.push(newFolder);
                 unsortedFolderId = newFolder.id;
                 setFolders(newFolders);
             }
        }
        
        moveInstructions.forEach(inst => {
            const targetId = inst.targetFolderId === 'Unsorted' ? unsortedFolderId : inst.targetFolderId;
            if (targetId) {
                const noteIndex = newDiaries.findIndex(d => d.id === inst.noteId);
                if (noteIndex > -1) {
                    newDiaries[noteIndex] = { ...newDiaries[noteIndex], folderId: targetId };
                    movedCount++;
                }
            }
        });
        setDiaries(newDiaries);
        setIsSelectionMode(false);
        setSelectedIds(new Set());
       
        alert(`🎉 成功移动了 ${movedCount} 篇笔记！`);
    } catch (e: any) {
        console.error(e); // 在控制台打印详细错误
        alert("移动失败: " + (e.message || "未知错误"));
    } finally {
        setLoadingMessage(null);
    }
};











// 这是一组什么代码：【初始化选中文件】(安全版)
    // 作用：只在刚打开APP且没有选中文件时执行一次。
    // ⚠️ 绝对不要在这里写 focus()，否则每打一个字光标都会跑！
    useEffect(() => {
        if (isLoaded && !currentFileId && diaries.length > 0) setCurrentFileId(diaries[0].id);
    }, [isLoaded, diaries, currentFileId]);

// 这是一组什么代码：【乖巧版】智能聚焦
    // 作用：只在“刚进入编辑模式”的那一瞬间聚焦一次。
    // 之后不管你怎么打字，它都绝对不会再动你的光标！
    useEffect(() => {
        // 只有当 editMode 变成 true 的一瞬间执行
        if (editMode) {
            const timer = setTimeout(() => {
                // 如果光标没在里面，才聚焦（防止抢标题的光标）
                if (document.activeElement !== textareaRef.current) {
                    textareaRef.current?.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [editMode]); // <--- 注意：这里只监听 editMode，不监听 content！




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














// 这是一组什么代码：【智能新建笔记】
// 作用：这是升级版的新建笔记功能。当你点击“+ 新建笔记”时，它会进行智能判断：
// 1. 如果你正选中一个具体的文件夹（比如“学习”），新笔记就会被创建在这个文件夹里。
// 2. 如果你没有选中任何文件夹（即选中了最顶层的“我的手账本”），新笔记会自动被创建到“日常碎碎念”这个默认文件夹里。
// 3. 如果“日常碎碎念”文件夹被删了，它会安全地退回到在根目录创建，防止程序出错。
const handleCreateFile = () => {
    // --- 1. 智能判断目标文件夹 ---
    let targetFolderId = selectedFolderId;
    
    // 如果当前选中的是根目录...
    if (selectedFolderId === 'root') {
        // ...就去寻找根目录下的“日常碎碎念”文件夹
        const defaultFolder = folders.find(f => f.name === '日常碎碎念' && f.parentId === 'root');
        
        // 如果找到了，就把目标文件夹ID设置为它的ID
        if (defaultFolder) {
            targetFolderId = defaultFolder.id;
        } 
        // 如果没找到（比如被删了或改名了），targetFolderId 就会保持为 'root'，笔记会安全地创建在根目录
    }

    // --- 2. 创建新笔记 ---
    const newNote: DiaryEntry = { 
        id: Date.now().toString(), 
        title: '', 
        content: '', 
        folderId: targetFolderId || 'root', // 使用我们计算出的目标ID，并确保有备用方案
        updatedAt: Date.now() 
    };
    
    setDiaries([...diaries, newNote]);
    setCurrentFileId(newNote.id);
    setEditMode(true); // 新建后直接进入编辑模式
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










// 这是一组什么代码：【最终排版修复版】截图功能
// 作用：生成底部栏左边Logo、右边（上名字/下时间）双行对齐的长图
const handleSaveImage = async () => {
    // 1. 防止在编辑模式下误操作
    if (editMode) {
        alert("请先点击【完成编辑】，回到阅读模式后再保存图片哦！");
        return;
    }

    if (!contentRef.current || !activeNote) return;
    setLoadingMessage('正在冲印照片...'); 

    // 2. 准备工作
    const scrollElement = document.getElementById('diary-scroll-view');
    const wrapperOldStyle = contentRef.current.style.cssText;
    let scrollOldStyle = '';
    let scrollParentOldStyle = '';
    
    if (scrollElement) {
        scrollOldStyle = scrollElement.style.cssText;
        if (scrollElement.parentElement) {
            scrollParentOldStyle = scrollElement.parentElement.style.cssText;
        }
    }

    // 3. 制作你的专属水印
    const watermark = document.createElement('div');
    watermark.id = 'temp-watermark'; 
    
    // 获取名字
    const authorName = settings.userName || 'hannie';
    
    // 获取时间
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    // 👇【核心修改】这里修复了布局，强制让右边变成垂直分布（上下两行）
    watermark.innerHTML = `
        <div style="
            width: 100%; 
            background: #fffdf5; 
            padding: 40px 30px 30px 30px; 
            box-sizing: border-box; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-top: 20px;
        ">
            <!-- 左边：汉堡包 Logo -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">🍔</span>
                <span style="
                    font-family: sans-serif; 
                    font-weight: 900; 
                    color: #90a4ae; 
                    font-size: 13px; 
                    letter-spacing: 1px;
                    text-transform: uppercase;
                ">HAMBURGER PHONE</span>
            </div>

            <!-- 右边：你的名字和时间（强制垂直排列） -->
            <div style="
                display: flex; 
                flex-direction: column; /* 👈 关键修复：让它们垂直排列 */
                align-items: flex-end;  /* 👈 让文字靠右对齐 */
                gap: 4px;               /* 两行之间留点缝隙 */
            ">
                <div style="
                    font-weight: bold; 
                    color: #546e7a; 
                    font-size: 14px; 
                ">@${authorName}</div>
                
                <div style="
                    color: #b0bec5; 
                    font-size: 10px; 
                    font-family: monospace;
                    letter-spacing: 0.5px;
                ">${timeStr}</div>
            </div>
        </div>
    `;

    try {
        // === 展开滚动条逻辑 (保持不变) ===
        if (scrollElement) {
            scrollElement.style.position = 'relative';
            scrollElement.style.height = 'auto';
            scrollElement.style.overflow = 'visible';
            scrollElement.style.inset = 'auto';
            if (scrollElement.parentElement) {
                scrollElement.parentElement.style.height = 'auto';
                scrollElement.parentElement.style.overflow = 'visible';
                scrollElement.parentElement.style.flex = 'none';
            }
        }
        contentRef.current.style.height = 'auto';
        contentRef.current.style.overflow = 'visible';
        contentRef.current.appendChild(watermark);

        const dataUrl = await htmlToImage.toJpeg(contentRef.current, { 
            quality: 0.95, 
            backgroundColor: '#fffdf5', 
            width: contentRef.current.offsetWidth, 
            filter: (node) => !node.classList?.contains('ignore-in-screenshot')
        });

        const link = document.createElement('a');
        link.download = `Diary-${activeNote.title || 'untitled'}.jpg`;
        link.href = dataUrl;
        link.click();

    } catch (e) { 
        console.error(e); 
        alert("保存失败，请重试"); 
    } finally { 
        // === 恢复现场 ===
        contentRef.current.style.cssText = wrapperOldStyle;
        if (scrollElement) {
            scrollElement.style.cssText = scrollOldStyle;
            if (scrollElement.parentElement) {
                scrollElement.parentElement.style.cssText = scrollParentOldStyle;
            }
        }
        const w = document.getElementById('temp-watermark');
        if (w) w.remove();
        setLoadingMessage(null); 
    }
};









// 这是一组什么代码：【最终版·TKV驱动的智能分割归档系统】
// 作用：这是您亲自设计的、由TKV格式驱动的终极整理系统！它彻底抛弃了脆弱的JSON，
// 采用您提供的“关键词:值 + %%分隔”的强大格式。AI现在会像一个真正的架构师，
// 将一篇日记分割成多个主题，为每个主题创建嵌套的文件夹和干净的笔记，其稳定性和
// 智能程度都达到了前所未有的高度。

// 1. 【核心】为日记整理量身定制的 TKV 解析器
const parseDiaryTKV = (text: string) => {
    const results: { master_category: string; sub_folder: string; summary_title: string; summary_points: string; }[] = [];
    const entries = text.split('%%');

    for (const entryText of entries) {
        if (!entryText.trim()) continue;

        const lines = entryText.trim().split('\n');
        const entryData: any = { summary_points: '' }; // 初始化，特别是要点
        let isParsingPoints = false;

        for (const line of lines) {
            if (!line.trim()) continue;

            const separatorIndex = line.indexOf(':');
            if (separatorIndex > -1 && !isParsingPoints) {
                const key = line.substring(0, separatorIndex).trim();
                const value = line.substring(separatorIndex + 1).trim();

                if (key === '主干分类') entryData.master_category = value;
                else if (key === '分支文件夹') entryData.sub_folder = value;
                else if (key === '笔记标题') entryData.summary_title = value;
                else if (key === '总结要点') {
                    isParsingPoints = true; // 开始进入多行解析模式
                    const pointsValue = line.substring(separatorIndex + 1).trim();
                    if (pointsValue) entryData.summary_points += pointsValue + '\n';
                }
            } else {
                // 如果已经开始解析要点，或者某行没有冒号，都追加到要点里
                entryData.summary_points += line.trim() + '\n';
            }
        }
        
        // 确保所有必需字段都存在
        if (entryData.master_category && entryData.sub_folder && entryData.summary_title) {
            entryData.summary_points = entryData.summary_points.trim();
            results.push(entryData);
        }
    }
    return results;
};

// 这是一组什么代码：【强制来源格式版】单篇笔记整理
// 作用：我们删掉了 Prompt 里让 AI 写来源的要求（因为它老写错），
// 改为由代码在最后强制拼接“*来源: [[标题]] 日期*”，这样双链和时间戳绝对不会丢！
const handleOrganizeCurrentNote = async () => {
  if (!activeNote) return;
 
  // 1. 检查字数
  if (activeNote.content.length < 5) {
      alert("内容太短了，没法整理哦。");
      return;
  }
  const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
  if (!activePreset) { alert("请先配置 API Key！"); return; }
  setLoadingMessage("AI 正在静默归档...");

  // --- 🛠️ 内部工具 ---
  const cleanName = (name: string) => name ? name.replace(/[\[\]【】\s]/g, '') : '未命名';
  
  // 2. 获取现有分类结构 (帮助AI决策)
  const aiRootId = folders.find(f => f.name === 'AI 自动整理区' && f.parentId === 'root')?.id;
  let existingStructure = "";
  if (aiRootId) {
      const subFolders = folders.filter(f => f.parentId === aiRootId);
      existingStructure = subFolders.map(f => {
          const grandChildren = folders.filter(gf => gf.parentId === f.id).map(gf => gf.name).join(', ');
          return `- ${f.name}: [${grandChildren}]`;
      }).join('\n');
  }

  try {
    // 🌟 核心升级：Prompt 里删掉了“来源”的要求，禁止 AI 乱写
    const systemPrompt = `
你是一个**后台数据处理程序**。
你的任务是将输入的日记转换为 TKV 格式。

# 🚫 绝对禁令
1. **禁止**输出来源、日期或原始标题引用（我们会由代码自动添加）。
2. **禁止**任何开场白或结束语。
3. **输出必须直接以 "主干分类:" 开头**。

# 🛠️ 处理逻辑
如果文本包含多个不同主题，必须拆分为多个 TKV 块，用 %% 分隔。

# 🌰 标准输出示例 (严格模仿)
主干分类: 生活
分支路径: 休闲充电
笔记标题: 观影《黑客帝国》
总结要点:
- 观看黑客帝国，感叹其哲学隐喻深刻。
- 视觉效果震撼。
%%
主干分类: 工作
分支路径: 沟通协作
笔记标题: 需求变更复盘
总结要点:
- 会议中老板修改需求。

# 归档参考
现有分类：
${existingStructure || "(暂无)"}
标准体系：
- 学习 (输入/输出/复盘)
- 工作 (项目/沟通/作品)
- 生活 (休闲/事务/状态/恋爱/爱好/追星)
- 个人 (愿景/情绪/灵感)

# 输出格式 (TKV)
主干分类: ...
分支路径: ...
笔记标题: ...
总结要点:
- ...
%%
(如有拆分，必须用 %% 分隔)
`;

    const userPrompt = `
待处理文本：
${activeNote.content}
`;

    const aiResponse = await generateResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ], activePreset);
   
    // --- 🛡️ 安全防御：防止 AI 返回空导致崩溃 ---
    if (!aiResponse || typeof aiResponse.content !== 'string' || aiResponse.content.trim() === "") {
        throw new Error("AI 返回内容为空或格式错误，请重试。");
    }

    // --- TKV 解析器 ---
    const parseDiaryTKV = (text: string) => {
        const results: { master_category: string; folder_path: string; summary_title: string; summary_points: string; }[] = [];
        const entries = text.split('%%');
        for (const entryText of entries) {
            if (!entryText.trim()) continue;
            const entryData: any = { summary_points: '' };
            let isParsingPoints = false;
           
            const lines = entryText.trim().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                const cleanLine = line.replace(/：/g, ':').replace(/\*\*/g, '').trim();
               
                const separatorIndex = cleanLine.indexOf(':');
                if (separatorIndex > -1 && !isParsingPoints) {
                    const key = cleanLine.substring(0, separatorIndex).trim();
                    const value = cleanLine.substring(separatorIndex + 1).trim();
                    
                    if (key === '主干分类') entryData.master_category = value;
                    else if (key === '分支路径') entryData.folder_path = value;
                    else if (key === '笔记标题') entryData.summary_title = value;
                    else if (key === '总结要点') {
                        isParsingPoints = true;
                        if(value) entryData.summary_points += value + '\n';
                    }
                } else if (isParsingPoints) {
                    entryData.summary_points += line.trim() + '\n';
                }
            }
            if (entryData.master_category && entryData.folder_path && entryData.summary_title) {
                entryData.summary_points = entryData.summary_points.trim();
                results.push(entryData);
            }
        }
        return results;
    };
   
    const parsedResults = parseDiaryTKV(aiResponse.content);
   
    if (parsedResults.length === 0) {
        console.warn("AI原文:", aiResponse.content);
        alert(`整理失败。AI 可能又说废话了，没识别到 TKV 格式。`);
        return;
    }

    let newFolders = [...folders];
    let newDiaries = [...diaries];
    const alertMessages: string[] = [];
   
    // 确保根目录存在
    let aiRoot = newFolders.find(f => f.name === 'AI 自动整理区' && f.parentId === 'root');
    if (!aiRoot) {
        aiRoot = { id: "ai_root_" + Date.now(), name: 'AI 自动整理区', parentId: 'root', collapsed: false };
        newFolders.push(aiRoot);
    }
   
    // 🌟 这里是重点：无论 AI 怎么想，我们强制生成标准来源格式！
    // 格式：*来源: [[标题]] 2025/x/x*
    const dateStr = new Date().toLocaleDateString('zh-CN'); 
    const sourceTitle = activeNote.title ? `[[${activeNote.title}]]` : '[[无标题]]';
    const sourceLine = `\n\n*来源: ${sourceTitle} ${dateStr}*`;

    for (const topic of parsedResults) {
        const { master_category, folder_path, summary_title, summary_points } = topic;
        
        // 1. 创建/查找文件夹
        const cleanMasterName = cleanName(master_category);
        let masterFolder = newFolders.find(f => f.parentId === aiRoot!.id && cleanName(f.name) === cleanMasterName);
        if (!masterFolder) {
            const colors: any = settings.categoryColors || { '生活': '#f39c12', '工作': '#3498db', '学习': '#9b59b6', '个人': '#2ecc71' };
            masterFolder = {
                id: "ai_master_" + Date.now() + Math.random(),
                name: cleanMasterName,
                parentId: aiRoot!.id, collapsed: false,
                color: colors[cleanMasterName] || '#a1887f'
            };
            newFolders.push(masterFolder);
        }
       
        let currentParentId = masterFolder.id;
        const pathParts = folder_path.split('/').filter(p => p.trim() !== '');
        for (const part of pathParts) {
            const cleanPartName = cleanName(part);
            let subFolder = newFolders.find(f => f.parentId === currentParentId && cleanName(f.name) === cleanPartName);
            if (!subFolder) {
                subFolder = { id: "ai_sub_" + Date.now() + Math.random(), name: cleanPartName, parentId: currentParentId, collapsed: false };
                newFolders.push(subFolder);
            }
            currentParentId = subFolder.id;
        }

        // 2. 笔记内容组装
        const CARD_SEPARATOR = "\n\n======\n\n";
        
        // 🌟 清洗：万一 AI 不听话自己写了来源，我们把它删掉，用我们自己的
        let cleanPoints = summary_points.replace(/\*来源:.*\*/g, '').trim();

        let summaryNote = newDiaries.find(d => d.folderId === currentParentId && d.title === summary_title);
       
        if (summaryNote) {
          // 追加模式：分隔符 + 内容 + 强制来源行
          summaryNote.content += CARD_SEPARATOR + cleanPoints + sourceLine;
          summaryNote.updatedAt = Date.now();
        } else {
          // 新建模式：内容 + 强制来源行
          summaryNote = {
            id: "sum_note_" + Date.now() + Math.random(),
            title: summary_title,
            content: cleanPoints + sourceLine,
            folderId: currentParentId,
            updatedAt: Date.now(),
          };
          newDiaries.push(summaryNote);
        }
       
        alertMessages.push(`- ${summary_title} -> ${cleanName(master_category)}/${folder_path}`);
    }

    // 标记原笔记
    const currentNoteIndex = newDiaries.findIndex(d => d.id === activeNote.id);
    if (currentNoteIndex !== -1) {
        newDiaries[currentNoteIndex] = { ...newDiaries[currentNoteIndex], isOrganized: true } as any;
    }
   
    setFolders(newFolders);
    setDiaries(newDiaries);
    alert(`✨ 归档完成！来源已强制包含时间戳。\n\n${alertMessages.join('\n')}`);

  } catch (err: any) {
    console.error(err);
    alert("整理出错: " + err.message);
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



























// 这是一组什么代码：【人机协作版·总AI整理】
// 作用：总AI的整理逻辑与单篇整理完全同步。它现在会严格遵守您建立的分类体系，
// 将批量整理的内容优先放入您指定的文件夹，未知内容则统一放入“✨新发现”，
// 彻底解决了文件夹泛滥的问题。
const handleAIAction = async (action: string, payload: any) => {
  if (action !== 'EXECUTE_AI_COMMAND') return;

  const { diariesToProcess, aiConfig } = payload;
  if (!diariesToProcess || diariesToProcess.length === 0) {
    alert(`${aiConfig.name} 说：“这个范围没有日记可以整理哦~”`);
    return;
  }
  const activePreset = settings.apiPresets?.find(p => p.id === settings.activePresetId);
  if (!activePreset) { alert("请先配置 API Key！"); return; }

  setLoadingMessage(`${aiConfig.name} 正在努力阅读和整理...`);

  try {
    const diaryMaterials = diariesToProcess.map(d => `---
标题：${d.title || '无标题'}
内容：
${d.content}
---`).join('\n\n');

    const prompt = `你是一个日记整理大师。阅读以下所有日记材料，提炼出不同主题，并严格按照“### 主题名”和“- 要点”的格式输出总结，不要说任何废话：\n\n${diaryMaterials}`;
    const aiResponse = await generateResponse([{ role: 'user', content: prompt }], activePreset);

    if (!aiResponse.content?.trim() || !aiResponse.content.includes('###')) {
      alert("汉堡包看完了但没整理出内容...");
      return;
    }

    // 1. 解析AI提炼出的所有分类 (与单篇整理完全一致)
    const categories: { name: string; bullets: string[] }[] = [];
    let currentCategory = "";
    let currentBullets: string[] = [];
    aiResponse.content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
            if (currentCategory) categories.push({ name: currentCategory, bullets: currentBullets });
            currentCategory = trimmed.slice(4).trim();
            currentBullets = [];
        } else if (trimmed.startsWith('- ') && currentCategory) {
            currentBullets.push(trimmed.slice(2).trim());
        }
    });
    if (currentCategory) categories.push({ name: currentCategory, bullets: currentBullets });

    if (categories.length === 0) { alert("AI分析完成但未找到可归类的清晰主题。"); return; }

    // 2. 准备文件夹并开始整理 (与单篇整理完全一致)
    let newFolders = [...folders];
    let newDiaries = [...diaries];
    const alertMessages: string[] = [];

    let aiRootFolder = newFolders.find(f => f.name === 'AI 自动整理区' && f.parentId === 'root');
    if (!aiRootFolder) {
        aiRootFolder = { id: "ai_root_" + Date.now(), name: 'AI 自动整理区', parentId: 'root', collapsed: false };
        newFolders.push(aiRootFolder);
    }
    const approvedFolders = newFolders.filter(f => f.parentId === aiRootFolder!.id);
    let newDiscoveriesFolder = approvedFolders.find(f => f.name === '✨新发现');
    if (!newDiscoveriesFolder) {
        newDiscoveriesFolder = { id: "ai_discover_" + Date.now(), name: '✨新发现', parentId: aiRootFolder.id, collapsed: false };
        newFolders.push(newDiscoveriesFolder);
    }
    
    // 3. 遍历AI提炼的每个主题，进行智能归档 (与单篇整理完全一致)
    for (const cat of categories) {
        let targetFolder = approvedFolders.find(f => f.name === cat.name);
        const usedFallback = !targetFolder;
        if (!targetFolder) {
            targetFolder = newDiscoveriesFolder;
        }

        let summaryNote = newDiaries.find(d => d.folderId === targetFolder.id && d.title === cat.name);
        const timestamp = new Date().toLocaleDateString('zh-CN');
        const bulletText = cat.bullets.map(b => `- ${b}`).join('\n');
        const appendText = `\n\n---\n${timestamp}（AI总整理）\n\n${bulletText}`;

        if (summaryNote) {
            summaryNote.content += appendText;
            summaryNote.updatedAt = Date.now();
        } else {
            summaryNote = {
                id: "ai_total_" + Date.now() + Math.random(),
                title: cat.name,
                content: `# ${cat.name}\n\n${bulletText}`,
                folderId: targetFolder.id,
                updatedAt: Date.now(),
            };
            newDiaries.push(summaryNote);
        }

        if (usedFallback) {
            alertMessages.push(`- 新主题“${cat.name}”已存入“✨新发现”。`);
        } else {
            alertMessages.push(`- “${cat.name}”已归档至“${targetFolder.name}”。`);
        }
    }

    setFolders(newFolders);
    setDiaries(newDiaries);

    alert(`🍔 批量整理完成！\n\n${alertMessages.join('\n')}`);

  } catch (error: any) {
    alert(`出错了：${error.message}`);
  } finally {
    setLoadingMessage(null);
  }
};











const aiRootFolder = folders.find(f => f.name === 'AI 自动整理区' && f.parentId === 'root');









// ... 其他函数，比如 handleBatchDelete, handleSaveImage 等 ...

    // ==================== 辅助工具：获取上一轮的状态 ====================
    // 这是一个小工具，能帮助我们记住 editMode 在变化前的状态是 true 还是 false。
    // 你不需要理解它的内部原理，只需要知道它能提供“短期记忆”就行。
    function usePrevious(value: any) {
        const ref = useRef();
        useEffect(() => {
            ref.current = value;
        });
        return ref.current;
    }










   // ==================== 渲染层 ====================
    return (
        <div className="h-full w-full bg-[#eeeae4] flex flex-col pt-[calc(44px+env(safe-area-inset-top))] relative overflow-hidden">
            <PaperStyle />
       <SafeAreaHeader 
                title={
                    // 👇 如果正在搜索，显示搜索框；否则显示标题和翻页
                    showSearch ? (
                        <div className="flex items-center bg-white rounded-full px-3 py-1 shadow-inner border border-[#d7ccc8] w-full max-w-[200px] animate-fadeIn">
                            <span className="text-xs mr-2">🔍</span>
                            <input 
                                autoFocus
                                value={searchKeyword}
                                onChange={e => setSearchKeyword(e.target.value)}
                                placeholder="搜索笔记..."
                                className="bg-transparent border-none outline-none text-xs text-[#5d4037] w-full placeholder-gray-300"
                            />
                            <button onClick={() => { setShowSearch(false); setSearchKeyword(""); }} className="text-[#a1887f] ml-1 text-xs font-bold">✕</button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center leading-tight">
                            <span className="font-bold text-[#5d4037] text-base tracking-widest uppercase">
                                {activeTab === 'note' ? 'My Journal' : activeTab === 'dashboard' ? 'Overview' : 'AI Manager'}
                            </span>
                            
                            {/* 👇 修复后的历史导航 👇 */}
                            {activeTab === 'note' && (
                                <div className="flex items-center gap-4 mt-1">
                                    <button 
                                        disabled={historyIndex <= 0}
                                        onClick={() => {
                                            if (historyIndex > 0) {
                                                isNavigatingHistory.current = true; // 标记：这是在翻页
                                                const prevId = historyStack[historyIndex - 1];
                                                setHistoryIndex(prev => prev - 1);
                                                setCurrentFileId(prevId);
                                            }
                                        }}
                                        className={`text-[10px] px-2 py-0.5 rounded-full transition ${historyIndex > 0 ? 'text-[#a1887f] hover:text-[#5d4037] hover:bg-black/5 cursor-pointer' : 'text-gray-200 cursor-not-allowed'}`}
                                    >
                                        ← PREV
                                    </button>
                                    
                                    {/* 显示当前是第几篇 */}
                                    <span className="text-[9px] text-[#d7ccc8] font-mono">
                                        {historyStack.length > 0 ? `${historyIndex + 1}/${historyStack.length}` : '-/-'}
                                    </span>

                                    <button 
                                        disabled={historyIndex >= historyStack.length - 1}
                                        onClick={() => {
                                            if (historyIndex < historyStack.length - 1) {
                                                isNavigatingHistory.current = true; // 标记：这是在翻页
                                                const nextId = historyStack[historyIndex + 1];
                                                setHistoryIndex(prev => prev + 1);
                                                setCurrentFileId(nextId);
                                            }
                                        }}
                                        className={`text-[10px] px-2 py-0.5 rounded-full transition ${historyIndex < historyStack.length - 1 ? 'text-[#a1887f] hover:text-[#5d4037] hover:bg-black/5 cursor-pointer' : 'text-gray-200 cursor-not-allowed'}`}
                                    >
                                        NEXT →
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                }
                left={
                    <div className="flex items-center gap-2">
                        {/* 返回按钮 */}
                        <button onClick={onClose} className="text-sm font-bold text-[#8d6e63] bg-white/50 px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition flex items-center gap-1">
                            ← 返回
                        </button>

                        {/* 👇 [新增] 搜索按钮 👇 */}
                        {activeTab === 'note' && !showSearch && (
                            <button 
                                onClick={() => setShowSearch(true)} 
                                className="w-8 h-8 rounded-full bg-white/50 text-[#8d6e63] flex items-center justify-center shadow-sm hover:bg-white transition"
                            >
                                🔍
                            </button>
                        )}
                    </div>
                }
                right={
                    activeTab === 'note' ? (
                        <div className="flex gap-2 relative items-center">
                            <button onClick={handleCreateFile} className="text-2xl font-light text-[#8d6e63] w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded-full transition">+</button>
                            
                            <div className="relative">
                                <button onClick={() => setShowMenu(!showMenu)} className="text-xl text-[#8d6e63] px-3 py-2 hover:bg-black/5 rounded-full transition font-black">≡</button>
                                <MenuDropdown 
                                    isOpen={showMenu} onClose={() => setShowMenu(false)} onShareClick={() => setShowShareModal(true)} onSaveImageClick={handleSaveImage} onToggleAI={() => setShowAI(!showAI)} onDeleteClick={handleDeleteFile} onOrganizeCurrentNote={handleOrganizeCurrentNote} onOpenSettings={() => setShowSettingsModal(true)}
                                />
                            </div>

                            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-xl text-[#8d6e63] p-2 hover:bg-black/5 rounded-full transition">{sidebarOpen ? '📖' : '🗂️'}</button>
                            
                            {/* 👇 搜索结果下拉框 (悬浮在右上角附近) 👇 */}
                            {showSearch && searchKeyword && (
                                <div className="absolute top-12 left-[-180px] w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 z-[60] max-h-60 overflow-y-auto custom-scrollbar animate-scaleIn">
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 border-b border-gray-100 flex justify-between">
                                        <span>🔍 找到 {searchResults.length} 篇</span>
                                    </div>
                                    {searchResults.length > 0 ? (
                                        searchResults.map(res => (
                                            <div 
                                                key={res.id} 
                                                onClick={() => { 
                                                    setCurrentFileId(res.id); 
                                                    setShowSearch(false); 
                                                    setSearchKeyword("");
                                                    // 搜索跳转也算一次历史记录
                                                    // (useEffect 会自动处理)
                                                }} 
                                                className="px-4 py-3 hover:bg-[#fffdf5] cursor-pointer border-b border-gray-50 last:border-0"
                                            >
                                                <div className="text-xs font-bold text-[#3e2723] truncate">{res.title || "无标题"}</div>
                                                <div className="text-[10px] text-gray-400 truncate mt-0.5">{res.content.slice(0, 20)}...</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-gray-400 text-xs">没有找到相关笔记</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : null
                }
            />

            {/* 主内容区域 - 根据Tab切换 */}
            <div className="flex-1 flex overflow-hidden relative shadow-2xl mx-2 mb-2 rounded-3xl bg-[#fffdf5] paper-texture border border-[#d7ccc8]">
                
                {/* 1. 笔记页 */}
                {activeTab === 'note' && (
                    <>
                        <div className="flex-1 flex flex-col relative w-full h-full min-h-0">
                            {activeNote ? (
                                <div ref={contentRef} className="flex-1 flex flex-col h-full relative">
                                    <div className="px-8 pt-8 pb-2 shrink-0">
                                        <input value={activeNote.title} onChange={(e) => setDiaries(prev => prev.map(d => d.id === activeNote.id ? { ...d, title: e.target.value } : d))} placeholder="无标题" className="w-full bg-transparent text-3xl font-black text-[#3e2723] font-serif outline-none placeholder-gray-300/50" />
                                        <div className="flex gap-2 text-[10px] text-[#a1887f] uppercase tracking-wider mt-2 border-b-2 border-dashed border-[#d7ccc8] pb-4 w-full"><span>{new Date(activeNote.updatedAt).toLocaleString()}</span>
                                        <span>• {activeNote.content.length} WORDS</span></div>
                                    </div>

                                    <div className="flex-1 relative w-full overflow-hidden">
                                        {editMode ? (
                                            <>
                                                <textarea 
                                                    id="diary-editor-textarea"
                                                    ref={textareaRef} 
                                                    className="absolute inset-0 w-full h-full p-8 pt-2 pb-40 text-base leading-loose font-serif resize-none outline-none custom-scrollbar bg-transparent caret-stone-800"
                                                    value={activeNote.content} 
                                                    onChange={handleContentChange} 
                                                    placeholder="在此处落笔..." 
                                                />
                                                <button onClick={() => setEditMode(false)} className="ignore-in-screenshot absolute bottom-5 right-5 z-50 bg-[#3e2723] text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition">
                                                    完成编辑
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div onClick={() => setEditMode(true)} className="absolute inset-0 w-full h-full p-8 pt-2 pb-40 overflow-y-auto custom-scrollbar z-10 cursor-text" id="diary-scroll-view">
                                                    <PrettyRenderer content={activeNote.content} onLinkClick={handleWikiLink} />
                                                </div>
                                                <div className="ignore-in-screenshot absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-300 bg-gray-50 px-2 py-1 rounded-full pointer-events-none">
                                                    点击任意位置开始编辑
                                                </div>
                                            </>
                                        )}
                                        {editMode && (
                                            <LinkSuggestions visible={showSuggestions} query={suggestionQuery} allFiles={diaries} onSelect={handleSelectSuggestion} />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-[#d7ccc8] flex-col"><div className="text-4xl mb-4 opacity-50">🍂</div><p className="font-serif">请打开侧边栏选择笔记</p><button onClick={() => setSidebarOpen(true)} className="mt-4 px-4 py-2 bg-[#8d6e63] text-white rounded-lg text-sm">打开侧边栏</button></div>
                            )}
                        </div>

                        {/* 侧边栏 (已修复) */}
                        <div className={`absolute top-0 bottom-0 right-0 z-30 w-72 bg-[#f5f5f0] border-l border-[#e0e0e0] transform transition-transform duration-300 ease-out flex flex-col shadow-2xl ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="p-4 bg-[#ebe8e0] border-b border-[#dedede] flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs font-bold uppercase ${isSelectionMode ? 'text-red-500' : 'text-[#8d6e63]'}`}>
                                        {isSelectionMode ? `已选中 ${selectedIds.size} 项` : 'Explorer'}
                                    </span>
                                    <button onClick={() => setSidebarOpen(false)} className="text-gray-400">✕</button>
                                </div>
                                {!isSelectionMode && (
                                    <div className="flex gap-2">
                                        <button onClick={handleCreateFile} className="flex-1 bg-[#8d6e63] text-white py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-[#6d4c41] active:scale-95 transition">+ 新建笔记</button>
                                        <button onClick={handleCreateFolder} className="px-3 bg-white border border-[#d7ccc8] text-[#5d4037] rounded-lg shadow-sm hover:bg-[#fffdf5] active:scale-95 transition">📂+</button>
                                    </div>
                                )}
                            </div>

                <div 
    className="flex-1 overflow-y-auto p-2 custom-scrollbar pb-20"
    // 👇 核心改动：就是在这里加上了 onClick 事件 👇
    // 作用：当用户点击这个滚动区域的空白处时，自动将选中的文件夹ID设为'root'，
    // 也就是取消了对具体文件夹的选择，回到了“我的手账本”这个总视图。
    onClick={(e) => {
        if (e.target === e.currentTarget) {
            setSelectedFolderId('root');
        }
    }}
>
    {/* --- 简化版渲染逻辑：直接渲染所有顶级文件夹 --- */}
    {folders.filter(f => f.parentId === 'root').map(f => (
        <div key={f.id} className="mb-2">
            {/* 如果是AI区，可以加一个小标题 */}
            {f.name === 'AI 自动整理区' && <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1">🗂️ AI 整理区</div>}
            
            <FolderItem 
                folder={f} 
                allFolders={folders} 
                allFiles={diaries} 
                currentFileId={currentFileId} 
                selectedFolderId={selectedFolderId} 
                isSelectionMode={isSelectionMode}
                selectedIds={selectedIds}
                onLongPress={handleLongPress}
                onToggleSelect={handleToggleSelect}
                onToggle={(id) => setFolders(folders.map(x => x.id === id ? { ...x, collapsed: !x.collapsed } : x))} 
                onSelectFolder={(id) => setSelectedFolderId(id)} 
                onSelectFile={(id) => { 
                    setCurrentFileId(id); 
                    setEditMode(false);
                    if (window.innerWidth < 640) setSidebarOpen(false); 
                }}
            />
        </div>
    ))}

    {/* 如果根目录下没有任何文件夹，显示一个提示 */}
    {folders.filter(f => f.parentId === 'root').length === 0 && (
        <div className="text-xs text-gray-300 px-4 py-2">（请新建文件夹）</div>
    )}
</div>

                 {isSelectionMode && (
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-red-100 flex gap-2 animate-slideUp z-50">
                                    <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs">取消</button>
                                    
                                    {/* 👇 新增的 AI 智能移动按钮 */}
                                    <button onClick={handleBatchSmartMove} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-xs shadow-lg active:scale-95 transition flex items-center justify-center gap-1">
                                        <span>🤖</span> AI 自动归类
                                    </button>

                                    <button onClick={handleBatchDelete} className="px-4 py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs shadow-sm active:scale-95 transition">删除</button>
                                </div>
                            )}
                        </div>
                        {sidebarOpen && <div className="absolute inset-0 bg-black/20 z-20 backdrop-blur-[1px]" onClick={() => setSidebarOpen(false)}></div>}
                    </>
                )}

                {/* 2. 概览页 */}
                {activeTab === 'dashboard' && <DashboardView diaries={diaries} moodData={moodData} />}

                {/* 3. AI 对话页 */}
                {activeTab === 'chat' && <AIAdminChat diaries={diaries} folders={folders} settings={settings} setSettings={setSettings} worldBooks={worldBooks} diaryAIWorldBookIds={diaryAIWorldBookIds} setDiaryAIWorldBookIds={setDiaryAIWorldBookIds} onAction={handleAIAction} />}
            </div>

            {/* 底部导航栏 */}
            <div className="mx-6 mb-6 h-14 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl flex items-center justify-around border border-white/50 z-50">
                <button onClick={() => setActiveTab('note')} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'note' ? 'text-[#3e2723] scale-110' : 'text-gray-400'}`}><span className="text-xl">📝</span><span className="text-[9px] font-bold">笔记</span></button>
                <div className="w-px h-6 bg-gray-200"></div>
                <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'dashboard' ? 'text-[#3e2723] scale-110' : 'text-gray-400'}`}><span className="text-xl">📊</span><span className="text-[9px] font-bold">概览</span></button>
                <div className="w-px h-6 bg-gray-200"></div>
                <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-0.5 transition ${activeTab === 'chat' ? 'text-[#3e2723] scale-110' : 'text-gray-400'}`}><span className="text-xl">🤖</span><span className="text-[9px] font-bold">管理员</span></button>
            </div>

            {loadingMessage && (
                <div className="fixed inset-0 z-[999] bg-white/20 flex items-center justify-center backdrop-blur-xl animate-fadeIn">
                    <div className="bg-white/80 text-gray-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-scaleIn border border-white/50">
                        <div className="flex gap-1.5"><span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span></div>
                        <span className="text-sm font-bold tracking-wider">{loadingMessage}</span>
                    </div>
                </div>
            )}
            
            {ShareToAIModal && <ShareToAIModal isOpen={showShareModal} contacts={contacts || []} onClose={() => setShowShareModal(false)} onShare={handleShareToAI} />}
            {SettingsModal && <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} settings={settings} onColorChange={handleColorChange} />}
        </div>
    );
};




export default DiaryApp;