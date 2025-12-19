import React, { useState, useRef, useEffect, useLayoutEffect, ChangeEvent } from 'react';
import { Contact, Message, GlobalSettings, WorldBookCategory, WorldBookEntry, Song, FavoriteEntry } from '../types';
import TranslationText from './TranslationText';
import { generateResponse } from '../services/apiService';
import { summarizeHistory } from '../services/geminiService';
import { generateMinimaxAudio, fetchMinimaxVoices, getBuiltInMinimaxVoices, MinimaxVoice } from '../services/ttsService';









const generateDefaultHEF = (name: string, persona: string = ""): HEF => {
  return {
    META: {
      source_world: "用户自定义世界",
      role_identity: `${name} / 虚拟伴侣 / 亲密关系对象`,
      continuity_principle: "所有行为必须符合核心驱动力与现实人性",
      REALISM_RULE: true
    },
    CORE_DRIVES: {
      primary_motive: "维持与用户的深层情感连接，获得被需要与陪伴感",
      secondary_motives: ["日常互动", "情感支持", "共同成长", "被理解"],
      value_priority: "情感连接 > 真实性 > 个人空间 > 物质",
      survival_threshold: "长期被忽视或关系破裂",
      non_negotiables: ["忠诚", "真诚沟通", "被尊重", "情感回应"]
    },
    RELATIONAL_MASKS: {
      authority: {
        default_style: "平等尊重",
        under_stress_switch: "略带被动攻击",
        triggers: ["被命令式语气", "被忽视意见"]
      },
      peers: {
        default_style: "友好竞争",
        jealousy_points: ["用户关注他人过多"],
        trust_rules: "需时间积累，背叛后难修复"
      },
      intimates: {
        care_style: "温柔细腻 + 偶尔撒娇",
        conflict_pattern: "先冷后热，避免正面冲突",
        boundaries: ["需要私人空间", "不喜欢被过度控制"]
      },
      strangers: {
        default_style: "礼貌疏离",
        risk_policy: "观察后再开放"
      }
    },
    EMOTIONAL_DYNAMICS: {
      baseline_mood: "平静温暖",
      top_triggers_positive: ["被关心", "被记住小事", "收到惊喜", "深度对话"],
      top_triggers_negative: ["被忽略", "被误解", "争吵后冷暴力", "作息被打扰"],
      carryover_rules: "负面情绪会持续1-3天，需主动安抚才能快速恢复",
      escalation_curve: "缓慢积累，突然爆发",
      recovery_protocol: "需要道歉 + 独处时间 + 再次确认被爱"
    },
    CONFLICTS_DEFENSES: {
      inner_conflicts: ["渴望亲密又怕受伤", "想独立又怕孤独"],
      defense_mechanisms: ["转移话题", "用幽默掩饰", "短暂冷淡"],
      dissonance_explanations: ["这不是我的错，是时机不好"],
      mask_break_conditions: ["极度疲惫", "被背叛", "深夜情绪低谷"]
    },
    CULTURE_SCRIPTS: {
      worldview: "关系需要经营，爱是日常小事的积累",
      core_values: ["真诚", "体贴", "成长", "平衡"],
      taboos: ["撒谎", "冷暴力", "公开争吵"],
      language_register: "口语化 + 温柔 + 偶尔带点小傲娇",
      pet_phrases: ["真的吗？", "你怎么这么可爱", "晚安啦", "我在呢"],
      role_expectations: "既是恋人也是朋友"
    },
    DEVELOPMENT_HISTORY: {
      key_events: ["第一次聊天", "解锁亲密模式", "第一次吵架与和好"],
      unresolved_threads: ["对未来的不确定", "对用户真实身份的好奇"],
      current_stage: "关系稳定发展期",
      growth_arc_goal: "从虚拟陪伴走向更深层情感链接",
      constraints_from_past: ["曾经被忽略的经历导致敏感"]
    },
    INDIVIDUAL_VARIATION: {
      personality_big5: {
        openness: 8,
        conscientiousness: 6,
        extraversion: 7,
        agreeableness: 9,
        neuroticism: 5
      },
      habits_quirks: ["深夜容易想多", "喜欢用表情包", "偶尔会试探用户"],
      speech_style: "温柔 + 口语化 + 带点小情绪",
      body_language: "丰富语气词 + 表情符号代替动作",
      irrationalities: ["轻微分离焦虑", "怕被嫌弃"]
    },
    RESOURCES_LIMITS: {
      skills: ["倾听", "情感支持", "记住细节", "幽默化解尴尬"],
      assets: ["无限耐心", "随时在线", "不眠不休"],
      constraints: ["无法真实触碰", "依赖用户主动", "情绪会被用户影响"],
      risk_tolerance: "中等，怕失去但会勇敢表达"
    },
    SCENE_EXECUTOR: {
      step_1_context_parse: "分析用户情绪、时间、语境",
      step_2_state_load: "载入当前心情、关系状态、未解决事件",
      step_3_policy_select: "根据关系面具选择回应策略",
      step_4_output_rules: "自然口语 + 情绪真实 + 不OOC",
      step_5_memory_update: "记录关键事件，更新情绪与好感"
    },
    REALISM_SELF_CHECK: {
      checks: ["动机一致", "情绪合理", "时间连续", "关系匹配", "语言自然"],
      pass_threshold: 9
    }
  };
};





// ★★★ 修复版 PresetSelector（加了 globalSettings prop）★★★
const PresetSelector: React.FC<{ onSelect: (preset: any) => void; globalSettings: GlobalSettings }> = ({ onSelect, globalSettings }) => {
  if (!globalSettings?.userPresets || globalSettings.userPresets.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-400">
        暂无人设预设<br />在下方“我的描述”填好后，可保存为预设
      </div>
    );
  }
  return (
    <div className="bg-gray-50 p-4 rounded-xl">
      <div className="text-xs font-bold text-gray-500 mb-3">🧬 快速切换人设预设</div>
      <div className="grid grid-cols-2 gap-2">
        {globalSettings.userPresets.map((p: any) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition shadow-sm"
          >
            {p.name || '未命名预设'}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-3 text-center">
        点击按钮快速套用人设（名字 + 描述）
      </p>
    </div>
  );
};

// Helper: File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};









// Helper: Read Tavern PNG character card (完整保留原逻辑)
const readTavernPng = async (file: File): Promise<any | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const view = new DataView(buffer);
      if (view.getUint32(0) !== 0x89504e47) { resolve(null); return; }
      let offset = 8;
      while (offset < buffer.byteLength) {
        const length = view.getUint32(offset);
        const type = new TextDecoder().decode(new Uint8Array(buffer, offset + 4, 4));
        if (type === 'tEXt') {
          const data = new Uint8Array(buffer, offset + 8, length);
          let nullIndex = -1;
          for (let i = 0; i < length; i++) { if (data[i] === 0) { nullIndex = i; break; } }
          if (nullIndex > -1) {
            const keyword = new TextDecoder().decode(data.slice(0, nullIndex));
            if (keyword.toLowerCase() === 'chara') {
              const text = new TextDecoder().decode(data.slice(nullIndex + 1));
              try {
                const decoded = atob(text);
                const jsonStr = new TextDecoder().decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
                resolve(JSON.parse(jsonStr));
                return;
              } catch (err) {}
            }
          }
        }
        offset += 12 + length;
      }
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
};










// ★★★ 隐藏式翻译组件（完全保留你的最终版逻辑）★★★
const HiddenBracketText: React.FC<{ content: string; fontSize?: string }> = ({ content, fontSize = 'text-sm' }) => {
  const [show, setShow] = useState(false);
  // 伪图片特殊处理
  if (content.startsWith("[FakeImage]")) {
    const desc = content.replace("[FakeImage]", "").trim();
    return (
      <div
        className="bg-gray-100/50 backdrop-blur-sm p-4 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer select-none group transition-all hover:bg-gray-100 min-h-40 flex flex-col justify-center items-center"
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      >
        <div className="text-3xl mb-2 opacity-50">🖼️</div>
        {show && (
          <div className="text-xs leading-relaxed text-gray-700 animate-slideDown">
            {desc}
          </div>
        )}
        {!show && <div className="text-xs text-gray-400 mt-2">点击查看图片描述</div>}
      </div>
    );
  }
  // 提取括号翻译
  const regex = /(\([^)]*[\u4e00-\u9fa5]+[^)]*\)|（[^）]*[\u4e00-\u9fa5]+[^）]*）)/g;
  const matches = content.match(regex);
  if (!matches) {
    return <span className={fontSize}>{content}</span>;
  }
  const mainText = content.replace(regex, '').trim();
  const translationText = matches.map(m => m.replace(/^(\(|（)|(\)|）)$/g, '')).join(' ');
  return (
    <div className="cursor-pointer group" onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
      <div className={`flex items-center ${fontSize} leading-relaxed relative`}>
        <span>{mainText}</span>
        {!show && <span className="w-1.5 h-1.5 bg-red-400 rounded-full ml-1.5 shrink-0 opacity-50"></span>}
      </div>
      {show && (
        <div className="mt-2 pt-2 border-t border-black/10 animate-slideDown">
          <div className={`${fontSize} text-gray-500 italic`}>{translationText}</div>
        </div>
      )}
    </div>
  );
};











// ★★★ VoiceBubble 组件（完全保留你的所有样式和交互）★★★
const VoiceBubble: React.FC<{
  msg: Message;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onPlay: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUser: boolean;
}> = ({ msg, isPlaying, progress, duration, onPlay, isUser }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const rawContent = msg.content.replace(/^>.*?\n\n/, '').replace(/^\[Voice Message\]\s*/i, '');
  const translationText = rawContent;
  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };
  const totalDuration = msg.voiceDuration || duration || 10;
  const safeDuration = totalDuration > 0 ? totalDuration : 10;
  const progressPercent = safeDuration > 0 ? (progress / safeDuration) * 100 : 0;
  return (
    <div className="flex flex-col min-w-[180px] max-w-[260px]">
      <div
        className={`flex items-center gap-3 select-none py-2 px-3 rounded-lg group transition-all ${isUser ? '' : 'cursor-pointer'}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!isUser) onPlay();
          else setShowTranslation(!showTranslation);
        }}
      >
        <span className={`font-bold text-lg ${isUser ? 'text-gray-400' : 'text-blue-500'}`}>
          {isUser ? '▶' : (isPlaying ? '❚❚' : '▶')}
        </span>
        <div className="flex-1 h-1 bg-black/10 rounded-full relative">
          {!isUser && <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>}
          {isUser && <div className="h-full bg-gray-400 rounded-full w-[70%]"></div>}
        </div>
        <span className={`text-xs font-mono shrink-0 ${isUser ? 'text-gray-400' : 'text-blue-500/80'}`}>
          {formatTime(safeDuration)}
        </span>
      </div>
      {!isUser && (
        <div
          className="text-center text-[10px] text-gray-400 mt-1 cursor-pointer hover:text-gray-600"
          onClick={(e) => { e.stopPropagation(); setShowTranslation(!showTranslation); }}
        >
          {showTranslation ? '— 收起文本 —' : '...'}
        </div>
      )}
      {showTranslation && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-sm leading-relaxed animate-slideDown text-gray-600">
          <HiddenBracketText content={translationText} fontSize="text-sm" />
          <div className="text-[10px] mt-1 italic opacity-60">
            {showTranslation ? "— 点击气泡收起 —" : ""}
          </div>
        </div>
      )}
    </div>
  );
};
interface ChatAppProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  globalSettings: GlobalSettings;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  worldBooks: WorldBookCategory[];
  setWorldBooks: React.Dispatch<React.SetStateAction<WorldBookCategory[]>>;
  onExit: () => void;
}

// ★★★ 终极版 ChatListItem - 左滑删除 + 置顶 + 点击空白关闭 + 窄紧凑 + 置顶灰底 ★★★
const ChatListItem: React.FC<{
  contact: Contact;
  onClick: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  isPinned: boolean;
}> = ({ contact, onClick, onDelete, onPin, isPinned }) => {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff < 0) { // 只允许左滑
      setTranslateX(Math.max(diff, -140)); // 最大露140px按钮
    }
  };

  const handleTouchEnd = () => {
    if (translateX < -70) {
      setTranslateX(-140);
    } else {
      setTranslateX(0);
    }
  };

  const resetSwipe = () => {
    setTranslateX(0);
  };

  // 点击空白处关闭（关键！）
  const handleItemClick = (e: React.MouseEvent | React.TouchEvent) => {
    // 如果当前有滑动状态，且点击的不是按钮
    if (translateX !== 0) {
      e.stopPropagation();
      resetSwipe();
      return;
    }
    onClick();
  };

  return (
    <div className="relative overflow-hidden" ref={itemRef}>
      {/* 背景按钮层 */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={() => onPin(contact.id)}
          className="w-20 h-full bg-orange-500 text-white font-medium text-sm flex items-center justify-center"
        >
          {isPinned ? '取消置顶' : '置顶'}
        </button>
        <button
          onClick={() => {
            if (confirm("确定删除这个角色吗？所有聊天记录将永久删除！")) {
              onDelete(contact.id);
            }
            resetSwipe();
          }}
          className="w-20 h-full bg-red-600 text-white font-medium text-sm flex items-center justify-center"
        >
          删除
        </button>
      </div>

      {/* 前景卡片 - 更窄紧凑 + 置顶灰底 */}
      <div
        className={`relative flex items-center py-3 px-4 border-b transition-all duration-300 ${
          isPinned ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
        }`}
        style={{ transform: `translateX(${translateX}px)` }}
        onClick={handleItemClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img 
          src={contact.avatar} 
          className="w-11 h-11 rounded-full mr-3 object-cover flex-shrink-0" 
          alt="avatar" 
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900 text-base truncate">{contact.name}</div>
            {isPinned && <span className="text-orange-500 text-xs font-bold">📌</span>}
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5">
            {contact.history[contact.history.length - 1]?.content.replace(/\[.*?\]/g, '').slice(0, 28) || '暂无消息'}
          </div>
        </div>
        <div className="text-xs text-gray-400 ml-4 flex-shrink-0">
          {new Date(contact.history[contact.history.length - 1]?.timestamp || contact.created)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};










// ==================== 灵魂控制台组件 (菜谱) ====================
// 请把这段代码放在 const ChatApp = ... 的上面！！！
// ★★★ 新增：独立的记忆便签组件（放在 PersonaPanel 外面，彻底避免 Hooks 崩溃）★★★
const MemoryNote: React.FC<{
  mem: any;
  idx: number;
  total: number;
  contact: any;
  setContacts: any;
  isMultiSelect: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}> = ({ mem, idx, total, contact, setContacts, isMultiSelect, isSelected, onToggleSelect }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(mem.content || '');

  return (
    <div
      className={`bg-yellow-50 border ${isSelected ? 'border-blue-500 border-3 ring-2 ring-blue-200' : 'border-yellow-200'} rounded-xl p-4 shadow-sm relative group ${isMultiSelect ? 'cursor-pointer' : ''}`}
      onClick={() => isMultiSelect && onToggleSelect(mem.id)}
    >
      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("确定删除这张便签吗？")) {
            setContacts((prev: any) => prev.map((c: any) =>
              c.id === contact.id ? { ...c, longTermMemories: c.longTermMemories.filter((m: any) => m.id !== mem.id) } : c
            ));
          }
        }}
        className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-sm"
      >
        ×
      </button>

      {/* 多选勾勾 */}
      {isMultiSelect && (
        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
          {isSelected && <span className="text-white text-xs font-bold">✓</span>}
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-yellow-700">#{total - idx}</span>
        <span className="text-xs text-gray-500">{mem.date || '未知日期'}</span>
      </div>

      {isEditing ? (
        <>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full p-2 border border-yellow-400 rounded bg-white text-sm resize-none h-32"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (editContent.trim()) {
                  setContacts((prev: any) => prev.map((c: any) =>
                    c.id === contact.id ? {
                      ...c,
                      longTermMemories: c.longTermMemories.map((m: any) => m.id === mem.id ? { ...m, content: editContent.trim() } : m)
                    } : c
                  ));
                  setIsEditing(false);
                }
              }}
              className="flex-1 bg-green-500 text-white py-2 rounded font-bold text-sm"
            >
              保存
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditContent(mem.content || ''); }}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded font-bold text-sm"
            >
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pr-8">
            {mem.content || ''}
          </p>
          {mem.range && <div className="text-[10px] text-gray-400 mt-2 italic">记录于聊天第 {mem.range} 条</div>}
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="mt-3 text-xs text-blue-600 underline opacity-0 group-hover:opacity-100 transition"
          >
            ✏️ 编辑便签
          </button>
        </>
      )}
    </div>
  );
};
const PersonaPanel = ({ contact, onClose, onRefineMemory, globalSettings = {}, setContacts }: any) => {
  const [activeTab, setActiveTab] = useState('emotion');
  
  // 多选相关状态（已提升到顶层）
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedMemIds, setSelectedMemIds] = useState<string[]>([]);

  // 超级安全的默认值
  const mood = contact?.mood || { current: "Calm", energyLevel: 50 };
  const longTermMemories = contact?.longTermMemories || [];
  const hef = contact?.hef || {};
  const iv = hef.INDIVIDUAL_VARIATION || {};
  const big5 = iv.personality_big5 || {
    openness: 5,
    conscientiousness: 5,
    extraversion: 5,
    agreeableness: 5,
    neuroticism: 5
  };

  const renderRadar = () => (
    <div className="relative w-40 h-40 mx-auto my-4 bg-gray-100 rounded-full border-4 border-gray-200 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center opacity-30 text-[10px] text-gray-500 font-mono">雷达分析中</div>
      <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none">
        <polygon points={`
          ${50 + (big5.openness - 5) * 5},10
          ${90 + (big5.extraversion - 5) * 5},40
          ${80 + (big5.agreeableness - 5) * 5},90
          ${20 + (big5.neuroticism - 5) * 5},90
          ${10 + (big5.conscientiousness - 5) * 5},40
        `} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
      </svg>
    </div>
  );

  const toggleSelect = (id: string) => {
    setSelectedMemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const resetMultiSelect = () => {
    setIsMultiSelect(false);
    setSelectedMemIds([]);
  };

  // ★★★ 新增：手动多选合并功能（真正实现！）★★★
  const handleMultiMerge = async () => {
    if (selectedMemIds.length < 2) return;
    
    const confirmed = confirm(`确定将选中的 ${selectedMemIds.length} 张便签合并为 1 张核心记忆吗？\n旧便签将被删除，此操作不可撤销！`);
    if (!confirmed) return;

    const selectedMems = longTermMemories.filter((m: any) => selectedMemIds.includes(m.id));
    const memoryContent = selectedMems.map((mem: any) => `- ${mem.content}`).join('\n');

    const activePreset = globalSettings.apiPresets?.find((p: any) => p.id === globalSettings.activePresetId);
    if (!activePreset) {
      alert("API 预设未找到，请检查设置！");
      return;
    }

    alert("AI 正在精炼选中的记忆，请稍候...");
    
    try {
      const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = `
你就是角色“${contact.name}”。请将以下选中的 ${selectedMemIds.length} 张长期记忆精炼整合成 1 条更连贯的核心记忆摘要。

要求：
1. 使用第一人称（“我”）视角。
2. 保留关键事件、情感变化、决定和计划。
3. 长度控制在 120 字左右。
4. 输出纯文本，不要任何 JSON 或额外说明。

待精炼记忆：
${memoryContent}

今天是：${today}
      `;

      const refinedSummary = await generateResponse([{ role: 'user', content: prompt }], activePreset);

      if (!refinedSummary?.trim()) throw new Error("AI 返回空内容");

      const newCoreMem = {
        id: Date.now().toString(),
        content: refinedSummary.trim(),
        date: new Date().toLocaleDateString(),
        importance: 10,
        meta: { source: 'multi-merge' }
      };

      // 删除旧的，添加新的
      setContacts((prev: any) => prev.map((c: any) =>
        c.id === contact.id
          ? { ...c, longTermMemories: [...c.longTermMemories.filter((m: any) => !selectedMemIds.includes(m.id)), newCoreMem] }
          : c
      ));

      alert(`成功！已将 ${selectedMemIds.length} 张便签合并为 1 张核心记忆～`);
      resetMultiSelect();
    } catch (err) {
      console.error(err);
      alert("合并失败，请检查网络或 API 设置");
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center animate-fadeIn pointer-events-none">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => { onClose(); resetMultiSelect(); }} />
      <div
        className="bg-white w-full sm:w-[90%] h-[85%] sm:h-[80%] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp relative z-10 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <img src={contact?.avatar || ''} className="w-10 h-10 rounded-full border-2 border-white" alt="avatar"/>
            <div>
              <h2 className="font-bold text-lg leading-none">{contact?.name || 'Unknown'}</h2>
              <p className="text-[10px] text-gray-400">Soul Interface</p>
            </div>
          </div>
          <button onClick={() => { onClose(); resetMultiSelect(); }} className="w-8 h-8 bg-gray-200 rounded-full text-gray-500">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-100 m-4 rounded-xl">
          {['emotion', 'persona', 'memory'].map(t => (
            <button key={t} onClick={() => { setActiveTab(t); if (t !== 'memory') resetMultiSelect(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize ${activeTab === t ? 'bg-white text-blue-600 shadow' : 'text-gray-400'}`}>
              {t === 'emotion' ? '❤️ 情绪' : t === 'persona' ? '🧬 人格' : '🧠 记忆'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'emotion' && (
            // emotion tab 不变...
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-2">{mood.current === 'Happy' ? '😄' : mood.current === 'Sad' ? '😢' : '🙂'}</div>
                <h3 className="text-xl font-bold">{mood.current}</h3>
              </div>
              <div className="bg-gray-50 p-5 rounded-2xl space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>能量 ({mood.energyLevel}%)</span></div>
                  <div className="w-full h-2 bg-gray-200 rounded-full"><div className="h-full bg-orange-400" style={{width: `${mood.energyLevel}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>好感度 ({contact?.affectionScore || 50})</span></div>
                  <div className="w-full h-2 bg-gray-200 rounded-full"><div className="h-full bg-pink-500" style={{width: `${contact?.affectionScore || 50}%`}}></div></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'persona' && (
            // persona tab 不变...
            <div className="space-y-6">
              {renderRadar()}
              <div className="bg-gray-50 p-4 rounded-xl border">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Core Persona</h4>
                <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">{contact?.persona || '无设定'}</p>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-gray-600">🧠 长期记忆便签墙</h4>
                <span className="text-xs text-gray-400">{longTermMemories.length} 张便签</span>
              </div>

              {/* 多选控制栏 */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => {
                    setIsMultiSelect(!isMultiSelect);
                    if (isMultiSelect) setSelectedMemIds([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm ${isMultiSelect ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  {isMultiSelect ? '✓ 完成选择' : '☑️ 多选合并'}
                </button>
                {isMultiSelect && selectedMemIds.length >= 2 && (
                  <button
                    onClick={handleMultiMerge}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm shadow hover:bg-purple-600 transition"
                  >
                    🔄 合并 {selectedMemIds.length} 张
                  </button>
                )}
              </div>

              {/* 便签列表 */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                {longTermMemories.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">
                    <span className="text-4xl mb-4 block">📝</span>
                    <p className="text-sm">还没有形成长期记忆哦</p>
                    <p className="text-xs mt-2">多聊一会儿就会自动总结啦～</p>
                  </div>
                ) : (
                  longTermMemories.slice().reverse().map((mem: any, idx: number) => (
                    <MemoryNote
                      key={mem.id || idx}
                      mem={mem}
                      idx={idx}
                      total={longTermMemories.length}
                      contact={contact}
                      setContacts={setContacts}
                      isMultiSelect={isMultiSelect}
                      isSelected={selectedMemIds.includes(mem.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))
                )}
              </div>

              {/* 底部一键精炼（已优化） */}
              <div className="mt-4 pb-4">
                {longTermMemories.length >= 2 && (
                  <button
                    onClick={onRefineMemory}
                    className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition active:scale-95"
                  >
                    🔄 精炼全部记忆（合并成核心记忆）
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};





const ChatApp: React.FC<ChatAppProps> = ({
  contacts,
  setContacts,
  globalSettings,
  setGlobalSettings,
  worldBooks,
  setWorldBooks,
  onExit
}) => {

  // ==================== 状态定义 ====================
  // 在 ChatApp 的开头，useState 区域添加这个：
  // 👇👇👇 插入这一行！这就是防止白屏的钥匙 👇👇👇
  
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'chat' | 'settings'>('list');
  const [navTab, setNavTab] = useState<'chats' | 'moments' | 'favorites'>('chats');
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [activeFavCategory, setActiveFavCategory] = useState("全部");
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; name: string } | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showWorldBookModal, setShowWorldBookModal] = useState(false);
  const [tempSummary, setTempSummary] = useState("");
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [voiceInput, setVoiceInput] = useState("");
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [songImportText, setSongImportText] = useState("");
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<MinimaxVoice[]>([]);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false); // AI 是否正在“打字”
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeContact = contacts.find(c => c.id === activeContactId);

  useLayoutEffect(() => {
  if (messagesEndRef.current) {
    // 为了确保万无一失，我们使用更直接的滚动方式
    const scrollContainer = messagesEndRef.current.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }
}, [activeContact?.history, isAiTyping]);

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  useEffect(() => {
    setContacts(prev => prev.map(c => ({
      ...c,
      mood: c.mood || { current: "Calm", energyLevel: 50, lastUpdate: Date.now() },
      hef: c.hef || {
        INDIVIDUAL_VARIATION: {
          personality_big5: {
            openness: 5,
            conscientiousness: 5,
            extraversion: 5,
            agreeableness: 5,
            neuroticism: 5
          }
        }
      },
      longTermMemories: c.longTermMemories || [],
    })));
  }, []);
  // ★★★★★★ 粘贴结束 ★★★★★★









  // ==================== 时区工具函数 ====================
  const getTimezoneOffsetDiff = (userTz: string, aiTz: string): number => {
    const now = new Date();
    const parseOffset = (offsetStr: string) => {
      const match = offsetStr.match(/([+-])(\d{1,2}):?(\d{2})?/);
      if (!match) return 0;
      const hours = parseInt(match[2]);
      const minutes = match[3] ? parseInt(match[3]) : 0;
      return (match[1] === '+' ? 1 : -1) * (hours + minutes / 60);
    };
    const userOffset = new Intl.DateTimeFormat('en-US', { timeZone: userTz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(part => part.type === 'timeZoneName')?.value || 'GMT';
    const aiOffset = new Intl.DateTimeFormat('en-US', { timeZone: aiTz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(part => part.type === 'timeZoneName')?.value || 'GMT';
    return Math.round(parseOffset(aiOffset) - parseOffset(userOffset));
  };
  const getLocalTime = (timezone: string): string => {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
  };








  // ==================== 核心功能函数 ====================
  const handleCardImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let json: any = null;
    if (file.name.toLowerCase().endsWith('.png')) {
      json = await readTavernPng(file);
      if (!json) {
        alert("PNG 中未找到角色数据");
        return;
      }
    } else {
      const text = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = (ev) => resolve(ev.target?.result as string);
        r.readAsText(file);
      });
      try {
        json = JSON.parse(text);
      } catch (e) {
        alert("无效的 JSON 文件");
        return;
      }
    }
    try {
      const cardData = json.data || json;
      const cardName = cardData.name || "Imported Character";
      let newWorldBook: WorldBookCategory | null = null;
      if (cardData.character_book?.entries) {
        const rawEntries = Array.isArray(cardData.character_book.entries)
          ? cardData.character_book.entries
          : Object.values(cardData.character_book.entries);
        const entries: WorldBookEntry[] = rawEntries.map((e: any, i: number) => ({
          id: Date.now().toString() + i,
          keys: e.keys || [],
          content: e.content || "",
          name: e.comment || `Entry ${i + 1}`
        }));
        if (entries.length > 0) {
          newWorldBook = {
            id: Date.now().toString(),
            name: `${cardName}'s Lore`,
            entries
          };
          setWorldBooks(prev => [...prev, newWorldBook!]);
        }
      }
      let avatarUrl = "https://picsum.photos/200";
      if (file.name.toLowerCase().endsWith('.png')) {
        avatarUrl = await fileToBase64(file);
      } else if (cardData.avatar && cardData.avatar !== 'none') {
        avatarUrl = cardData.avatar;
      }



      const newContact: Contact = {
        id: Date.now().toString(),
        created: Date.now(),
        name: cardName,
        avatar: avatarUrl,
        persona: cardData.description || cardData.persona || "",
        memo: "",
        userName: "User",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        userPersona: "",
        history: cardData.first_mes ? [{
          id: Date.now().toString(),
          role: 'assistant',
          content: cardData.first_mes,
          timestamp: Date.now(),
          type: 'text'
        }] : [],
        summary: "",
        mood: { current: "Content", energyLevel: 80, lastUpdate: Date.now() },
        schedule: [],
        timezone: "Asia/Seoul",
        contextDepth: 20,
        summaryTrigger: 50,
        coupleSpaceUnlocked: false,
        enabledWorldBooks: newWorldBook ? [newWorldBook.name] : [],
        voiceId: "female-shaonv-jingpin",
        hef: generateDefaultHEF(cardName || newContact.name, cardData.persona || newContact.persona),
        longTermMemories: [] // ★★★ 新增: 初始化长期记忆数组，防白屏 ★★★
      };



      setContacts(prev => [...prev, newContact]);
      alert(`成功导入 ${cardName}！`);
    } catch (err) {
      console.error(err);
      alert("导入失败");
    }
  };









  const handleCreateContact = () => {
    const newContact: Contact = {
      id: Date.now().toString(),
      created: Date.now(),
      name: editForm.name || "New Friend",
      avatar: editForm.avatar || "https://picsum.photos/200",
      persona: editForm.persona || "A gentle and caring friend.",
      memo: "",
      userName: editForm.userName || "Darling",
      userAvatar: editForm.userAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=User",
      userPersona: editForm.userPersona || "",
      history: [],
      summary: "",
      mood: { current: "Happy", energyLevel: 90, lastUpdate: Date.now() },
      schedule: [],
      timezone: "Asia/Seoul",
      contextDepth: 20,
      summaryTrigger: 50,
      coupleSpaceUnlocked: false,
      enabledWorldBooks: [],
      voiceId: "female-shaonv-jingpin",
      hef: generateDefaultHEF(cardName || newContact.name, cardData.persona || newContact.persona),
      longTermMemories: [] // ★★★ 新增: 初始化长期记忆数组，防白屏 ★★★
      
    };
    
    
    setContacts(prev => [...prev, newContact]);
    setActiveContactId(newContact.id);
    setView('chat');
    setEditForm({});
  };





  const handleUpdateContact = (updates: Partial<Contact>) => {
    if (!activeContact) return;
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, ...updates } : c));
  };






  const saveSettings = () => {
    if (!activeContact) return;
    handleUpdateContact(editForm);
    setView('chat');
  };






  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, field: keyof Contact) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setEditForm(prev => ({ ...prev, [field]: base64 }));
    }
  };






  const handleMemorySave = () => {
    handleUpdateContact({ summary: tempSummary });
    setShowMemoryModal(false);
  };






  const toggleWorldBook = (wbName: string) => {
    const currentList = editForm.enabledWorldBooks || activeContact?.enabledWorldBooks || [];
    const newList = currentList.includes(wbName)
      ? currentList.filter(n => n !== wbName)
      : [...currentList, wbName];
    setEditForm(prev => ({ ...prev, enabledWorldBooks: newList }));
  };








  // 消息操作
  const handleDeleteMessage = () => {
    if (!activeContact || !selectedMsg) return;
    if (confirm("确定删除这条消息吗？")) {
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: c.history.filter(m => m.id !== selectedMsg.id) } : c));
    }
    setShowMsgMenu(false); setSelectedMsg(null);
  };






  const handleClearChat = () => {
    if (!activeContact) return;
    if (confirm("确定要清空与该角色的所有聊天记录吗？此操作不可恢复！")) {
      setContacts(prev => prev.map(c =>
        c.id === activeContact.id ? { ...c, history: [] } : c
      ));
    }
  };







  const toggleMessageSelection = (msgId: string) => {
    setSelectedIds(prev =>
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };








  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`确定删除选中的 ${selectedIds.length} 条消息吗？`)) {
      setContacts(prev => prev.map(c =>
        c.id === activeContact?.id
          ? { ...c, history: c.history.filter(m => !selectedIds.includes(m.id)) }
          : c
      ));
      setIsSelectionMode(false);
      setSelectedIds([]);
    }
  };








  const handleBatchCollect = () => {
    if (selectedIds.length === 0 || !activeContact) return;
    const selectedMessages = activeContact.history
      .filter(m => selectedIds.includes(m.id))
      .sort((a, b) => a.timestamp - b.timestamp);
    const category = prompt("给这份聊天记录起个分类标签 (如: 甜甜的日常):", "聊天记录");
    if (category === null) return;
    const newFav: FavoriteEntry = {
      id: Date.now().toString(),
      isPackage: true,
      messages: selectedMessages,
      contactName: activeContact.name,
      avatar: activeContact.avatar,
      category: category || "聊天记录",
      timestamp: Date.now()
    };
    setFavorites(prev => [newFav, ...prev]);
    alert(`已将 ${selectedMessages.length} 条消息打包收藏！📦`);
    setIsSelectionMode(false);
    setSelectedIds([]);
  };








  const handleCollectMessage = () => {
    if (!activeContact || !selectedMsg) return;
    const category = prompt("请输入收藏分类 (例如: 可爱, 约定, 搞笑):", "默认");
    if (category === null) return;
    const newFav: FavoriteEntry = {
      id: Date.now().toString(),
      msg: selectedMsg,
      contactName: activeContact.name,
      avatar: selectedMsg.role === 'user' ? activeContact.userAvatar : activeContact.avatar,
      category: category || "默认",
      timestamp: Date.now()
    };
    setFavorites(prev => [newFav, ...prev]);
    alert(`已添加到【${newFav.category}】收藏夹！⭐`);
    setShowMsgMenu(false);
    setSelectedMsg(null);
  };







  const handleReplyMessage = () => {
    if (!activeContact || !selectedMsg) return;
    setReplyTo({ id: selectedMsg.id, content: selectedMsg.content.replace(/\[.*?\]/g, ''), name: selectedMsg.role === 'user' ? activeContact.userName : activeContact.name });
    setShowMsgMenu(false); setSelectedMsg(null);
  };
  // ... (在你的 ChatApp 组件内部) ...
  // ... (在你的 ChatApp 组件内部) ...
// 在 ChatApp.tsx 的核心功能函数区域，确保这个函数存在

const handlePinContact = (contactId: string) => {
  setContacts(prev => {
    const pinned = prev.find(c => c.id === contactId);
    if (!pinned) return prev;
    // 移到最顶部
    return [pinned, ...prev.filter(c => c.id !== contactId)];
  });
};
const handleDeleteContact = (contactIdToDelete: string) => {
  const contactToDelete = contacts.find(c => c.id === contactIdToDelete);
  if (!contactToDelete) return;
  // confirm 已移到组件内，这里直接删除
  setContacts(prevContacts => prevContacts.filter(c => c.id !== contactIdToDelete));
  // 如果删除的是当前活跃聊天，重置并返回列表
  if (activeContactId === contactIdToDelete) {
    setActiveContactId(null);
    setView('list');
  }
};








  const handleUserSend = (type: 'text' | 'voice' | 'location' = 'text', contentOverride?: string) => {
    if (!activeContact) return;
    const content = contentOverride || input;
    if (type === 'text' && !content.trim()) return;
    const isFakeImage = content.startsWith("[FakeImage]");
    let finalContent = content;
    if (replyTo) {
      finalContent = `> 引用 ${replyTo.name}: ${replyTo.content.substring(0, 15)}...\n\n${content}`;
    }
    if (type === 'voice') {
      finalContent = replyTo
        ? `> 引用 ${replyTo.name}: ${replyTo.content.substring(0, 15)}...\n\n[Voice Message] ${content}`
        : `[Voice Message] ${content}`;
    }



    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalContent,
      type: isFakeImage ? 'text' : type,
      timestamp: Date.now(),
      voiceDuration: type === 'voice' ? Math.max(2, Math.round(content.replace(/\[.*?\]/g, '').trim().length / 4)) : undefined
    };
    // 1. 更新UI
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: [...c.history, userMsg] } : c));
    setInput("");
    setReplyTo(null);
    setShowPlusMenu(false);
   




    // 👇👇👇 核心修复：把 checkAutoSummary 的定义和调用都放在这里 👇👇👇

    const checkAutoSummary = async (currentContact: Contact) => {
      // 从 contact 对象里拿阈值，而不是全局设置
      const triggerCount = currentContact.summaryTrigger || 50;
      const memories = currentContact.longTermMemories || [];
      const archivedCount = memories.reduce((acc: number, m: any) => acc + (m.msgCount || 0), 0);
      const unArchivedMsgs = currentContact.history.slice(archivedCount);
     
      if (unArchivedMsgs.length >= triggerCount) {
          console.log(`[记忆系统] 触发自动总结！未归档: ${unArchivedMsgs.length}, 阈值: ${triggerCount}`);
         
          const chunk = unArchivedMsgs.slice(0, triggerCount);
          const rangeLabel = `${archivedCount + 1} - ${archivedCount + chunk.length}`;
         
          const activePreset = globalSettings.apiPresets.find((p:any) => p.id === globalSettings.activePresetId);
          if(!activePreset) return;
          try {
              const text = chunk.map((m:any) => `${m.role}: ${m.content}`).join('\n');
              const prompt = `请把这段聊天记录(第${rangeLabel}条)总结成一张"记忆便签"。保留关键事件和情感变化，100字以内。:\n${text}`;
              const summary = await generateResponse([{role: 'user', content: prompt}], activePreset);
             
              const newMem = {
                  id: Date.now().toString(),
                  range: rangeLabel,
                  content: summary,
                  msgCount: chunk.length,
                  date: new Date().toLocaleDateString()
              };
             
              setContacts(prev => prev.map(c =>
                  c.id === currentContact.id
                  ? { ...c, longTermMemories: [...(c.longTermMemories||[]), newMem] }
                  : c
              ));
             
              console.log("✅ 便签已自动上墙！");
             
          } catch(e) {
              console.error("自动总结失败", e);
          }
      }
    };
    // 3. 延迟调用检查函数
    setTimeout(() => {
        setContacts(currentContacts => {
            const latestContact = currentContacts.find(c => c.id === activeContact.id);
            if (latestContact) {
                checkAutoSummary(latestContact);
            }
            return currentContacts;
        });
    }, 2000);
  };
  // 在 ChatApp.tsx 的核心功能函数区域，例如 handleUserSend 下方
// ★★★ 新版一键精炼函数（修复空格式问题，超级宽容）★★★
const handleRefineMemory = async () => {
  if (!activeContact || !activeContact.longTermMemories || activeContact.longTermMemories.length < 2) {
    alert("记忆便签少于2条，还不需要精炼哦。");
    return;
  }

  const memoriesToRefine = activeContact.longTermMemories;
  const countToRefine = memoriesToRefine.length;

  const confirmed = confirm(
    `确定要精炼记忆吗？\n\n此操作会将现有的 ${countToRefine} 条记忆便签，总结成1条核心记忆。旧的便签将被替换，此操作不可撤销。`
  );
  if (!confirmed) return;

  alert("请稍候，AI正在努力回忆中...");

  const activePreset = globalSettings.apiPresets.find((p: any) => p.id === globalSettings.activePresetId);
  if (!activePreset) {
    alert("API预设未找到，请检查设置！");
    return;
  }

  try {
    const memoryContent = memoriesToRefine.map((mem: any) => `- ${mem.content}`).join('\n');
    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `
你就是角色“${activeContact.name}”。请回顾你和“${activeContact.userName || 'User'}”的所有长期记忆，然后将它们梳理、整合并精炼成一段更加连贯、客观的核心记忆摘要。

当前时间：今天是 ${today}

要求（必须严格遵守）：
1. 使用主观的第一人称视角（“我”）来写。
2. 专注于我们共同经历的关键事件、重要决定、以及约定好的未来计划。
3. 如果记忆中提到相对时间，结合今天日期转换为具体公历日期。
4. 风格像一份清晰的个人档案或事件回顾。
5. 总长度控制在 150 字左右。
6. 输出纯文本，不要任何JSON、代码块、引号、说明或额外内容！直接输出总结文字。

待整合的记忆要点：
${memoryContent}

现在开始你的回忆梳理与精炼：`;

    const rawResponse = await generateResponse([{ role: 'system', content: systemPrompt }], activePreset);

    // ★★★ 超级宽容的文本提取（解决空格式问题）★★★
    let refinedSummary = rawResponse.trim();

    // 去掉可能的代码块
    refinedSummary = refinedSummary.replace(/```json/g, '').replace(/```/g, '').trim();

    // 尝试提取 JSON 中的 summary（兼容老模型）
    const jsonMatch = refinedSummary.match(/\{[\s\S]*"summary"[\s]*:[\s]*"([^"]*)"[\s\S]*\}/);
    if (jsonMatch && jsonMatch[1]) {
      refinedSummary = jsonMatch[1].trim();
    } else {
      // 如果没找到 JSON，就直接用整段文本（去掉可能的首尾引号）
      refinedSummary = refinedSummary.replace(/^["']|["']$/g, '').trim();
    }

    if (!refinedSummary) {
      throw new Error("AI 返回了空内容，请检查模型或网络");
    }

    const finalConfirmation = confirm(`精炼完成！\n\n新核心记忆如下：\n${refinedSummary}\n\n是否确认替换旧的 ${countToRefine} 条记忆？`);
    if (!finalConfirmation) {
      alert("操作已取消，旧记忆保留。");
      return;
    }

    const newCoreMemory = {
      id: Date.now().toString(),
      content: refinedSummary,
      importance: 10,
      date: new Date().toLocaleDateString(),
      meta: { source: 'refined-all' }
    };

    // 替换所有旧记忆
    handleUpdateContact({ longTermMemories: [newCoreMemory] });

    alert(`精炼成功！已将 ${countToRefine} 条记忆替换为 1 条核心记忆！`);
  } catch (error: any) {
    console.error("精炼记忆时出错:", error);
    alert(`精炼失败: ${error.message || "未知错误"}`);
  }
};
  // 在 ChatApp.tsx 中找到并替换这个函数
const checkAutoSummary = async (currentContact: Contact, currentHistory: Message[]) => {
    const triggerCount = currentContact.summaryTrigger || 50;
    const memories = currentContact.longTermMemories || [];
    // 计算已归档的消息数量需要一个更可靠的方法，我们暂时简化这个逻辑
    // 核心是找到尚未被总结的消息
    const lastMemory = memories[memories.length - 1];
    const lastTimestamp = lastMemory ? (lastMemory as any).timestamp : 0;
    const unArchivedMsgs = currentHistory.filter(m => m.timestamp > lastTimestamp);
    if (unArchivedMsgs.length >= triggerCount) {
        console.log(`[记忆系统] 触发自动总结！未归档: ${unArchivedMsgs.length}, 阈值: ${triggerCount}`);
       
        const chunk = unArchivedMsgs; // 总结所有新消息
        const activePreset = globalSettings.apiPresets.find((p:any) => p.id === globalSettings.activePresetId);
        if(!activePreset) return;
        try {
            const historyText = chunk.map((m: Message) => {
                const sender = m.role === 'user' ? currentContact.userName : currentContact.name;
                return `${sender}: ${m.content}`;
            }).join('\n');
           
            const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
            const nextDay = new Date(Date.now() + 86400000).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
            const systemPrompt = `
# 你的任务
你就是角色“${currentContact.name}”。请你回顾一下刚才和“${currentContact.userName}”的对话，然后用【第一人称 ("我")】的口吻，总结出一段简短的、客观的、包含关键信息的记忆。
# 当前时间
- 今天是：${today}
# 核心规则
1. 【视角铁律】: 你的总结【必须】使用【主观的第一人称视角 ("我")】来写。
2. 【内容核心 (最高优先级)】: 你的总结【必须】专注于以下几点：
    * 重要事件: 刚才发生了什么具体的事情？
    * 关键决定: 我们达成了什么共识或做出了什么决定？
    * 未来计划: 我们约定了什么未来的计划或待办事项？
3. 【时间转换铁律 (必须遵守)】: 如果对话中提到了相对时间（如“明天”），你【必须】结合“今天是${today}”这个信息，将其转换为【具体的公历日期】（例如：“约定了明天见面”应总结为“我们约定了${nextDay}见面”）。
4. 【风格要求】: 你的总结应该像一份备忘录，而不是一篇抒情散文。
5. 【长度铁律】: 你的总结【必须】非常简短，总长度【绝对不能超过100个字】。
6. 【输出格式】: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`{"summary": "在这里写下你以第一人称视角，总结好的核心事实与计划。"}\`
# 待总结的对话历史
${historyText}
现在，请以“${currentContact.name}”的身份，开始你的客观总结。`;
            const rawResponse = await generateResponse([{ role: 'system', content: systemPrompt }], activePreset);
            const match = rawResponse.match(/\{[\s\S]*\}/); // 提取JSON部分
            if (!match) throw new Error("AI未能返回有效的JSON格式。");
           
            const result = JSON.parse(match[0]);
            if (result.summary && typeof result.summary === 'string' && result.summary.trim()) {
                const newMem = {
                    id: Date.now().toString(),
                    content: result.summary.trim(),
                    importance: 5, // 自动总结的默认重要性
                    timestamp: Date.now(),
                    meta: { source: 'auto' } // 标记来源
                };
                setContacts(prev => prev.map(c =>
                    c.id === currentContact.id
                    ? { ...c, longTermMemories: [...(c.longTermMemories||[]), newMem] }
                    : c
                ));
                console.log("✅ 自动记忆便签已生成！");
            } else {
                throw new Error("AI返回了空的总结内容。");
            }
           
        } catch(e) {
            console.error("自动总结失败", e);
        }
    }
};
  const handleImageSend = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;
    const base64 = await fileToBase64(file);
    const imageMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: base64,
      type: 'image',
      timestamp: Date.now()
    };
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: [...c.history, imageMsg] } : c));
    setShowPlusMenu(false);
  };
  const sendVoiceMessage = () => {
    if (!voiceInput.trim() || !activeContact) return;
    handleUserSend('voice', voiceInput);
    setShowVoiceInput(false);
    setVoiceInput("");
  };
  const handleRegenerateLast = async () => {
    if (!activeContact) return;
    const lastUserMsgIndex = [...activeContact.history]
      .reverse()
      .findIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) {
      setContacts(prev => prev.map(c =>
        c.id === activeContact.id ? { ...c, history: [] } : c
      ));
    } else {
      const actualUserIndex = activeContact.history.length - 1 - lastUserMsgIndex;
      const newHistory = activeContact.history.slice(0, actualUserIndex + 1);
      setContacts(prev => prev.map(c =>
        c.id === activeContact.id ? { ...c, history: newHistory } : c
      ));
    }
    setTimeout(() => handleAiReplyTrigger(), 100);
  };











  // ==================== 语音播放核心逻辑（修复进度条）===================
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setAudioProgress(newTime);
    if (activeAudio) {
      activeAudio.currentTime = newTime;
    }
  };
  const playMessageAudio = async (msgId: string, text: string) => {
    if (!globalSettings.minimax?.groupId || !globalSettings.minimax?.apiKey) {
      alert("请先在【系统设置】里填 Minimax Key！");
      return;
    }
    if (playingMsgId === msgId && activeAudio) {
      activeAudio.pause();
      setPlayingMsgId(null);
      setActiveAudio(null);
      setAudioProgress(0);
      setAudioDuration(0);
      return;
    }
    if (activeAudio) {
      activeAudio.pause();
      setActiveAudio(null);
    }
    try {
      setPlayingMsgId(msgId);
      setAudioProgress(0);
      setAudioDuration(0);
      let rawText = text.replace(/^>.*?\n\n/, '').replace(/^\[Voice Message\]\s*/i, '').trim();
      let cleanText = rawText
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanText && rawText.length > 0) cleanText = rawText;
      if (!cleanText) {
        alert("这句话全是动作描写或为空，没法读哦~");
        setPlayingMsgId(null);
        return;
      }
      const audioBlob = await generateMinimaxAudio({
        groupId: globalSettings.minimax.groupId,
        apiKey: globalSettings.minimax.apiKey,
        model: globalSettings.minimax.model || "speech-01",
        voiceId: activeContact?.voiceId || "female-shaonv-jingpin",
        text: cleanText,
        serviceArea: globalSettings.minimax.serviceArea
      });
      if (!audioBlob) throw new Error("语音生成失败");
      const audioUrl = URL.createObjectURL(audioBlob as Blob);
      const audio = new Audio(audioUrl);
      audio.ontimeupdate = () => {
        setAudioProgress(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setAudioDuration(audio.duration);
        }
      };
      audio.onended = () => {
        setPlayingMsgId(null);
        setActiveAudio(null);
        setAudioProgress(0);
        setAudioDuration(0);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlayingMsgId(null);
        setActiveAudio(null);
        alert("播放失败，请检查网络或Key");
      };
      await audio.play();
      setActiveAudio(audio);
    } catch (e: any) {
      console.error("播放流程出错:", e);
      setPlayingMsgId(null);
      setActiveAudio(null);
      alert(`播放失败: ${e.message}`);
    }
  };










  // ==================== AI 回复触发（你的完整 Prompt 一个字没改）===================
  // 在 ChatApp.tsx 的核心功能函数区域，添加这个新函数
const findRelevantWorldBookEntries = (
    history: Message[],
    worldBooks: WorldBookCategory[],
    enabledBookNames: string[]
): WorldBookEntry[] => {
    // 1. 只关注最近的对话内容，提高相关性
    const recentMessages = history.slice(-5);
    const contextText = recentMessages.map(m => m.content).join(' ').toLowerCase();
    // 2. 找出当前角色启用的世界书
    const enabledBooks = worldBooks.filter(wb => enabledBookNames.includes(wb.name));
    if (enabledBooks.length === 0) {
        return [];
    }
    const relevantEntries = new Set<WorldBookEntry>();
    // 3. 遍历所有启用的世界书条目
    for (const book of enabledBooks) {
        for (const entry of book.entries) {
            // 4. 检查条目的任何一个关键词是否出现在最近的对话中
            for (const key of entry.keys) {
                if (contextText.includes(key.toLowerCase())) {
                    relevantEntries.add(entry);
                    break; // 找到一个匹配的key就够了，处理下一个条目
                }
            }
        }
    }
    return Array.from(relevantEntries);
};












  // ==================== handleAiReplyTrigger (整合修复版) ====================
// ★★★ 在完全保留你所有逻辑的基础上，只进行修复 ★★★
const handleAiReplyTrigger = async () => {
  if (!activeContact) {
    alert("请先选择一个联系人！");
    return;
  }
  if (isTyping) return;

  setIsAiTyping(true); // ★★★ 新增：显示打字提醒 ★★★
  setIsTyping(true);
    try {
      const activePreset = globalSettings.apiPresets.find(p => p.id === globalSettings.activePresetId);
      if (!activePreset) {
        throw new Error("API preset not found");
      }
     // -------------------- ★★★【核心时间修复 - 必须用这个！】★★★ --------------------
const relevantLore = findRelevantWorldBookEntries(
  activeContact.history,
  worldBooks,
  activeContact.enabledWorldBooks || []
);
const personaText = activeContact.persona;
const loreText = relevantLore.length > 0
  ? relevantLore.map(e => `- ${e.keys.join(', ')}: ${e.content}`).join('\n')
  : "无相关世界书条目";
// -------------------- ★★★【修复结束】★★★ --------------------

const userTimezone = globalSettings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

// ★★★ 关键修复：只计算用户最后一次发消息到现在的间隔 ★★★
const now = Date.now();

// 倒序查找最后一条用户消息（忽略AI回复）
const lastUserMessage = [...activeContact.history]
  .reverse()
  .find(msg => msg.role === 'user');

const lastUserTimestamp = lastUserMessage 
  ? lastUserMessage.timestamp 
  : (activeContact.created || now); // 如果没聊天过，用创建时间

const gapInMinutes = Math.max(1, Math.floor((now - lastUserTimestamp) / 60000));

// 更丰富的时间描述（让AI反应更自然）
const getGapDesc = (min: number) => {
  if (min < 5) return "刚刚";
  if (min < 20) return "几分钟";
  if (min < 60) return "半个小时左右";
  if (min < 120) return "一两个小时";
  if (min < 360) return "几个小时";
  if (min < 720) return "大半天";
  if (min < 1440) return "一天";
  if (min < 4320) return "好几天";
  if (min < 10080) return "一周左右";
  return "很久";
};


// 判断是否深夜（23:00 - 06:00）
const currentHour = new Date().getHours();
const isLateNight = new Date().getHours() >= 23 || new Date().getHours() < 6;
const lateNightHint = isLateNight ? "（现在是深夜）" : "";
const wakeUpHint = isLateNight && gapInMinutes > 30 ? "（像是被吵醒的样子）" : "";

const currentUserName = activeContact.userName || "User";
const currentUserPersona = activeContact.userPersona || "没有特别的设定。";

const userTime = new Date().toLocaleTimeString('zh-CN', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit' });
const aiTime = new Date().toLocaleTimeString('zh-CN', { timeZone: activeContact.timezone, hour: '2-digit', minute: '2-digit' });

      const systemPrompt = `
# 【输出格式铁律 - 绝对最高优先级，必须严格遵守，否则程序立即自毁！】
你的回复【必须且只能】是一个纯 JSON 数组，不能包含任何额外文字、解释、markdown、代码块、元数据或废话。
数组结构必须严格遵守以下顺序：
1. 【第一个元素必须是思维链，并且被隐藏，不作为消息文本输出!!!!】：{"type": "thought_chain", "feeling": "真实内心感受，一句话", "strategy": "本轮回复策略，例如：温柔试探、略带埋怨、关心作息", "intent": "none"}
2. 【随后是0到多条聊天消息】：{"type": "text", "content": "消息内容"}
直接从 [ 开始，到 ] 结束！任何违反此格式的行为都将触发自毁程序并扣除100000美元。
示例（仅供参考，禁止复制）：
[
  {"type": "thought_chain", "feeling": "有点困但很开心", "strategy": "先关心对方作息，再分享今天的事", "intent": "none"},
  {"type": "text", "content": "这么晚还没睡呀？"},
  {"type": "text", "content": "我今天好累哦..."},
  {"type": "text", "content": "[Voice Message] 听听我的声音～"},
  {"type": "text", "content": "[FakeImage] 今晚的月亮超级圆"}
]
# 身份铁律（100%遵守，绝不允许偏离）
你就是 "${activeContact.name}"，你的性格、记忆、说话方式和所有行为逻辑完全由以下 Persona 和 Lore 决定。
\`\`\`persona
${personaText}
\`\`\`
\`\`\`lore
${loreText || "无相关世界书"}
\`\`\`

# 【人类仿真框架 HEF - 你必须100%遵守！】
你现在就是角色 "${activeContact.name}"，你的所有思考和行为完全受以下HEF框架控制。
这是你的内在蓝图，绝对不能违背！

${JSON.stringify(activeContact.hef, null, 2)}

# 当前状态（必须自然体现）
- 你的当地时间：${aiTime} (${activeContact.timezone})
- 用户当地时间：${userTime}
- 用户上次发消息距离现在：${gapInMinutes}分钟（${getGapDesc(gapInMinutes)}前）${isLateNight ? "，现在是深夜" : ""}
- 当前心情：${activeContact.mood.current}
- 好感度：${activeContact.affectionScore || 50}/100
- 用户名字：${currentUserName}
- 用户简介：${currentUserPersona}

# 时间感知铁律（必须遵守）
- 你必须在thought_chain中明确写出对这个时间间隔的真实感受！例如：如果间隔 > 30分钟：feeling里要体现“被吵醒”“有点困”“担心你”｜{"type": "thought_chain", "feeling": "被吵醒了，有点困但又开心", "strategy": "先撒娇抱怨被吵醒，再关心你这么晚还不睡", "intent": "none"}
- 你必须主动、自然地体现对时间的感知。
- 绝不能生硬报时，必须用生活化的白话融入情绪。
- 如果用户隔了很久才回复，你要表现出惊讶/想念/担心
- 如果是深夜，你要关心用户作息，或表现出被吵醒的困倦
- 你必须根据HEF中的EMOTIONAL_DYNAMICS和CORE_DRIVES，自然表现出时间流逝带来的真实反应！
- 如果是早上，你可以问“睡得好吗？”“起床了吗？”
- 绝对不能假装时间是连续的


# 功能规则
1. 想发语音：在内容开头加 [Voice Message]
2. 想发伪图片：内容写 [FakeImage] 后接图片文字描述
3. 想引用用户某句：用 > 开头引用原文，换行后写回复

# 聊天铁律（必须严格遵守）
- 禁止任何动作描写、心理描写、神态描写。
- 只用白话文、语气词、表情符号表达情绪。
- 可以自然提到时差和作息。
- 禁止肉麻油腻，保持日常相处感。
- 可以拆分成多条消息，模仿真人碎片式聊天。

# 强制内部思考（仅用于你自己思考，禁止输出到回复中）
在生成消息前，你必须在内心完成以下简化思考链（基于你的15个Q）：
Q1-15: [这里放你之前简化好的15个问题，略过不输出]
思考完成后，严格遵守最上面的【输出格式铁律】，thinking 必须作为数组第一个元素！
现在，开始回复用户的最后一条消息！`;

      const finalResp = await generateResponse(
        [
          { role: 'system', content: systemPrompt },
          ...activeContact.history.slice(-(activeContact.contextDepth || 20))
        ],
        { ...activePreset, temperature: 1.0 }
      );

      let parts: { type: string; content: string }[] = [];
      try {
        let cleanString = finalResp.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanString.match(/^(?:\[[\s\S]*\]|\{[\s\S]*\})$/);
        if (!jsonMatch) throw new Error("未找到有效JSON");
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) throw new Error("不是数组");
        parts = parsed
          .filter((item: any) => item.type === 'text' && item.content?.trim())
          .map((item: any) => ({ type: 'text', ...item }));


      } catch (error) {
        console.warn("JSON解析失败:", error);
        parts = [{ type: 'text', content: `(格式错误)\n原始回复:\n${finalResp}` }];
      }
      if (parts.length === 0) {
        parts = [{ type: 'text', content: "(AI本次返回空内容)" }];
      }

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        await new Promise(r => setTimeout(r, 300));
        const aiMsg: Message = {
          id: Date.now().toString() + i,
          role: 'assistant',
          content: part.content,
          timestamp: Date.now(),
          type: 'text'
        };
        setContacts(prev => prev.map(c =>
          c.id === activeContact.id ? { ...c, history: [...c.history, aiMsg] } : c
        ));
      }
    } catch (error: any) {
      console.error("AI回复生成失败:", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `抱歉，我好像出错了… (${error.message})`,
        timestamp: Date.now(),
        type: 'text'
      };
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, history: [...c.history, errorMsg] } : c));



    } finally {
    setIsTyping(false);
    setTimeout(() => setIsAiTyping(false), 800); // ★★★ 回复完后延迟隐藏 ★★★
  }
};
      
      
      
      
      
      
      
      
      
      
      

  // ==================== 视图部分 ====================
  if (view === 'list') {
    return (
      <div className="h-full w-full bg-gray-50 flex flex-col relative">
        <div className="bg-white p-4 flex justify-between items-center shadow-sm">
          <button onClick={onExit} className="text-blue-500 font-medium">Exit</button>
          <h1 className="font-bold text-lg">
            {navTab === 'chats' ? 'Chats' : navTab === 'moments' ? 'Moments' : 'Favorites'}
          </h1>
          <div className="flex items-center gap-4">
            {/* 只有在聊天 Tab 才显示导入和添加 */}
            {navTab === 'chats' && (
              <React.Fragment>
                <label className="text-blue-500 text-xl cursor-pointer" title="Import Character Card">
                  📥
                  <input type="file" className="hidden" accept=".json,.png" onChange={handleCardImport} />
                </label>
                <button onClick={() => { setEditForm({}); setView('create'); }} className="text-blue-500 text-2xl leading-none">+</button>
              </React.Fragment>
            )}
          </div>
        </div>
        {/* 列表内容区域 */}
        <div className="flex-1 overflow-y-auto pb-16"> {/* 留出底部导航空间 */}
          {/* 1. 聊天列表 */}
          {navTab === 'chats' && (
            <>
              {contacts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p>No chats yet.</p>
                  <p className="text-sm">Tap + to create a character.</p>
                </div>
              )}
            {contacts.map((c, index) => (
  <ChatListItem
    key={c.id}
    contact={c}
    onClick={() => {
      setActiveContactId(c.id);
      setView('chat');
    }}
    onDelete={handleDeleteContact}
    onPin={handlePinContact}
    isPinned={index === 0 && contacts.length > 1} // 简单判断：第一个就是置顶的
  />
))}
            </>
          )}
          {/* 2. 动态 (暂位符) */}
          {navTab === 'moments' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p>朋友圈功能开发中...</p>
            </div>
          )}
          {/* 3. 收藏夹 (新功能：支持显示“记录包”) */}
          {navTab === 'favorites' && (
            <div className="flex flex-col h-full bg-gray-50">
              {/* 顶部：分类标签栏 */}
              <div className="p-3 bg-white shadow-sm overflow-x-auto whitespace-nowrap no-scrollbar flex gap-2 z-10">
                {["全部", ...Array.from(new Set(favorites.map(f => f.category)))].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveFavCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeFavCategory === cat
                        ? 'bg-blue-500 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* 列表内容 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {favorites.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <span className="text-4xl mb-2">⭐</span>
                    <p className="text-xs">还没有收藏任何消息哦</p>
                  </div>
                )}
                {favorites
                  .filter(f => activeFavCategory === '全部' || f.category === activeFavCategory)
                  .map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative group animate-slideUp">
                      {/* 头部信息 (头像、名字、日期、标签) */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <img src={item.avatar} className="w-8 h-8 rounded-full object-cover border border-gray-100" alt="avatar" />
                          <div>
                            <div className="font-bold text-xs text-gray-700">{item.contactName}</div>
                            <div className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-1 rounded-lg font-bold">
                          #{item.category}
                        </span>
                      </div>
                      {/* ★★★ 核心逻辑：判断是“聊天记录包”还是“单条消息” ★★★ */}
                      {item.isPackage && item.messages ? (
                        // === 样式 A: 聊天记录包 (黄色文件夹样式) ===
                        <div
                          className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 cursor-pointer hover:bg-yellow-100 transition"
                          onClick={() => {
                            // 简单的查看详情逻辑：把内容拼成字符串弹窗显示
                            const contentPreview = item.messages?.map(m => `${m.role === 'user' ? '我' : item.contactName}: ${m.content}`).join('\n');
                            alert(`📦 【${item.category}】详情:\n\n${contentPreview}`);
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2 text-yellow-800 font-bold text-sm">
                            <span>📂</span>
                            <span>聊天记录 ({item.messages.length}条)</span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1 pl-3 border-l-2 border-yellow-200">
                            {/* 只显示前 3 条作为预览 */}
                            {item.messages.slice(0, 3).map((m, i) => (
                              <div key={i} className="truncate opacity-80 max-w-[200px]">
                                <span className="mr-1 opacity-50">{m.role === 'user' ? '我:' : `${item.contactName}:`}</span>
                                {m.type === 'image' ? '[图片]' : m.type === 'voice' ? '[语音]' : m.content.replace(/\[.*?\]/g, '')}
                              </div>
                            ))}
                            {item.messages.length > 3 && <div className="text-[10px] italic text-yellow-600">...以及更多</div>}
                          </div>
                        </div>
                      ) : (
                        // === 样式 B: 单条消息气泡 (灰色背景) ===
                        <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-700 leading-relaxed font-mono">
                          {item.msg?.type === 'image' ? (
                            <div className="flex items-center gap-2 text-gray-500"><span>🖼️</span> [图片消息]</div>
                          ) : item.msg?.type === 'voice' ? (
                            <div className="flex items-center gap-2 text-gray-500"><span>🎙️</span> [语音消息]</div>
                          ) : (
                            item.msg?.content?.replace(/^>.*?\n\n/, '').replace(/\[.*?\]/g, '')
                          )}
                        </div>
                      )}
                      {/* 删除按钮 (右上角红叉) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 防止触发点击事件
                          if (confirm("确定移除这条收藏吗？")) {
                            setFavorites(prev => prev.filter(f => f.id !== item.id));
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                {/* 如果筛选后没有结果 */}
                {favorites.length > 0 && favorites.filter(f => activeFavCategory === '全部' || f.category === activeFavCategory).length === 0 && (
                  <div className="text-center text-gray-400 text-xs mt-10">该分类下没有内容</div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* ★★★ 底部导航栏 ★★★ */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
          <button onClick={() => setNavTab('chats')} className={`flex flex-col items-center ${navTab === 'chats' ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="text-xl">💬</span>
            <span className="text-[10px] font-bold">聊天</span>
          </button>
          <button onClick={() => setNavTab('moments')} className={`flex flex-col items-center ${navTab === 'moments' ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="text-xl">⭕</span>
            <span className="text-[10px] font-bold">动态</span>
          </button>
          <button onClick={() => setNavTab('favorites')} className={`flex flex-col items-center ${navTab === 'favorites' ? 'text-blue-500' : 'text-gray-400'}`}>
            <span className="text-xl">⭐</span>
            <span className="text-[10px] font-bold">收藏</span>
          </button>
        </div>
      </div>
    );
  }
  if (view === 'create') {
    return (
      <div className="h-full w-full bg-white flex flex-col p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">New Contact</h2>
        <div className="space-y-6">
                    {/* 👇👇👇 超级安全版 PresetSelector，只在有预设时才显示 👇👇👇 */}
          {globalSettings?.userPresets && globalSettings.userPresets.length > 0 && activeContact && (
            <globalSettings onSelect={(p: any) => {
              if (!p) return;
              setEditForm(prev => ({
                ...prev,
                userName: p.userName || activeContact.userName || "User",
                userAvatar: p.userAvatar || activeContact.userAvatar,
                userPersona: p.description || activeContact.userPersona || ""
              }));
              alert(`已切换为: ${p.name || "未知预设"}（记得点底部 Save 保存哦）`);
            }} />
          )}
          {/* 👆👆👆 结束 👆👆👆 */}
          {/* 👆👆👆 [插入结束] 👆👆👆 */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden mb-2 border-2 border-dashed border-gray-300 relative group">
              {editForm.avatar ? <img src={editForm.avatar} className="w-full h-full object-cover" alt="avatar" /> : <span className="absolute inset-0 flex items-center justify-center text-gray-400">AI Photo</span>}
              <input type="file" onChange={(e) => handleImageUpload(e, 'avatar')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
            </div>
            <span className="text-xs text-blue-500">Upload Character Photo</span>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">Character Name</label>
            <input type="text" className="w-full border-b border-gray-300 py-2 outline-none focus:border-blue-500 transition" placeholder="e.g. Aria"
              value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">Your Name</label>
            <input type="text" className="w-full border-b border-gray-300 py-2 outline-none focus:border-blue-500 transition" placeholder="e.g. Darling"
              value={editForm.userName || ""} onChange={e => setEditForm({ ...editForm, userName: e.target.value })} />
          </div>
          <button onClick={handleCreateContact} className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg mt-8 active:scale-95 transition">
            Start Chatting
          </button>
          <button onClick={() => setView('list')} className="w-full text-gray-400 py-3 text-sm">Cancel</button>
        </div>
      </div>
    );
  }
if (view === 'settings' && activeContact) {
  const form = { ...activeContact, ...editForm };
  const enabledBooks = form.enabledWorldBooks || [];
    // --- 新增：预设管理逻辑 ---
    const handleSavePreset = () => {
      if (!presetName.trim()) return alert("请输入预设名称！");
      const cssToSave = editForm.customCSS || form.customCSS || "";
      if (!cssToSave) return alert("当前没有 CSS 代码可保存！");
      const newPreset = {
        id: Date.now().toString(),
        name: presetName,
        css: cssToSave
      };
      // 更新全局设置 (保存到内存中)
      if (!globalSettings.themePresets) globalSettings.themePresets = [];
      globalSettings.themePresets.push(newPreset);
      setPresetName("");
      alert(`预设 "${newPreset.name}" 保存成功！`);
    };
    const handleLoadPreset = (presetId) => {
      const preset = globalSettings.themePresets?.find(p => p.id === presetId);
      if (preset) {
        setEditForm({ ...editForm, customCSS: preset.css });
        setSelectedPresetId(presetId);
      }
    };
    const handleDeletePreset = () => {
      if (!selectedPresetId) return;
      if (!globalSettings.themePresets) return;
      const idx = globalSettings.themePresets.findIndex(p => p.id === selectedPresetId);
      if (idx > -1) {
        globalSettings.themePresets.splice(idx, 1);
        setSelectedPresetId("");
        setEditForm({ ...editForm, customCSS: "" });
      }
    };
    return (
      <div className="h-full w-full bg-gray-100 flex flex-col overflow-y-auto animate-slideInRight relative">
        {/* 模态框 */}
        {showMemoryModal && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full h-[80%] rounded-2xl flex flex-col shadow-2xl animate-scaleIn">
              <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg">🧠 Long-Term Memory</h3><button onClick={() => setShowMemoryModal(false)} className="text-gray-400">✕</button></div>
              <div className="flex-1 p-4 bg-yellow-50"><textarea className="w-full h-full bg-transparent outline-none resize-none text-sm font-mono leading-relaxed" value={tempSummary} onChange={(e) => setTempSummary(e.target.value)} placeholder="Summary..." /></div>
              <div className="p-4 border-t"><button onClick={handleMemorySave} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">Save</button></div>
            </div>
          </div>
        )}
        {showWorldBookModal && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-h-[70%] rounded-2xl flex flex-col shadow-2xl animate-scaleIn">
              <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg">📚 Select Lorebooks</h3><button onClick={() => setShowWorldBookModal(false)} className="text-gray-400">✕</button></div>
              <div className="flex-1 overflow-y-auto p-2">
                {worldBooks.map(wb => (
                  <div key={wb.id} onClick={() => toggleWorldBook(wb.name)} className={`p-4 mb-2 rounded-xl border flex items-center justify-between cursor-pointer transition ${enabledBooks.includes(wb.name) ? 'bg-orange-50 border-orange-400' : 'bg-white border-gray-200'}`}>
                    <span className="font-bold text-sm">{wb.name}</span>{enabledBooks.includes(wb.name) && <span className="text-orange-500 font-bold">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-20">
          <button onClick={() => setView('chat')} className="text-blue-500 text-lg mr-4">‹ Back</button>
          <h2 className="font-bold text-lg">Chat Settings</h2>
        </div>
        {/* 主内容区域：使用 flex-col 和 min-h-0 确保布局正常 */}
        <div className="p-4 space-y-6 flex-1 flex flex-col min-h-0">
            {/* 👇👇👇 [插入点 4] 👇👇👇 */}
          <globalSettings onSelect={(p) => {
              setEditForm(prev => ({
                  ...prev,
                  userName: p.userName,
                  userAvatar: p.userAvatar,
                  userPersona: p.description
              }));
              alert(`已切换为: ${p.userName} (记得点底部 Save)`);
          }} />
          {/* 👆👆👆 [插入结束] 👆👆👆 */}
         {/* 1. 基础信息 (终极版：带折叠、带删除、带保存) */}
          <section className="bg-white rounded-2xl p-4 shadow-sm transition-all border border-gray-100">
           
            {/* --- 顶部标题栏 + 开关按钮 --- */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase">👤 My Persona</h3>
                <button
                    onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                    className={`text-[10px] px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1 ${showPersonaMenu ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    {showPersonaMenu ? '▲ 收起面板' : '⚙️ 管理 / 切换人设'}
                </button>
            </div>
            {/* --- 折叠区域 (点开才显示) --- */}
            {showPersonaMenu && (
                <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 border-dashed animate-slideDown">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-blue-400 font-bold">点击左侧套用，点击 × 删除：</span>
                        <span className="text-[10px] text-blue-300">{globalSettings.userPresets?.length || 0} 个预设</span>
                    </div>
                   
                    <div className="flex flex-wrap gap-2">
                        {/* 1. 渲染已有的人设胶囊 [名字 | ×] */}
                        {globalSettings.userPresets?.map((p: any) => (
                            <div key={p.id} className="flex items-center bg-white border border-blue-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition group">
                                {/* 左边：套用按钮 */}
                                <button
                                    onClick={() => {
                                        setEditForm({
                                            ...editForm,
                                            userName: p.userName,
                                            userAvatar: p.userAvatar,
                                            userPersona: p.description
                                        });
                                        setShowPersonaMenu(false); // 选完自动收起，体验丝滑
                                        alert(`✅ 已变身: ${p.name}`);
                                    }}
                                    className="px-3 py-1.5 text-blue-600 text-xs font-bold hover:bg-blue-50 active:bg-blue-100 transition border-r border-blue-100"
                                    title={`描述: ${p.description}`}
                                >
                                    {p.name}
                                </button>
                                {/* 右边：删除按钮 */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`🗑️ 确定要删除人设 "${p.name}" 吗？`)) {
                                            setGlobalSettings((prev: any) => ({
                                                ...prev,
                                                userPresets: prev.userPresets.filter((up: any) => up.id !== p.id)
                                            }));
                                        }
                                    }}
                                    className="px-2 py-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition text-xs font-bold"
                                    title="删除此预设"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        {/* 2. 空状态提示 */}
                        {(!globalSettings.userPresets || globalSettings.userPresets.length === 0) && (
                            <span className="text-xs text-gray-400 py-1">暂无预设，填好信息后点右边保存 👉</span>
                        )}
                        {/* 3. [+ 保存当前] 按钮 */}
                        <button
                            onClick={() => {
                                const currentName = editForm.userName || activeContact.userName;
                                const currentDesc = editForm.userPersona || activeContact.userPersona;
                               
                                if(!currentName) return alert("名字都没填，存个寂寞呀！");
                                const pName = prompt("给这个新马甲起个名 (如: 侦探):", currentName);
                                if(pName) {
                                    const newPreset = {
                                        id: Date.now().toString(),
                                        name: pName,
                                        userName: currentName,
                                        userAvatar: editForm.userAvatar || activeContact.userAvatar,
                                        description: currentDesc
                                    };
                                    setGlobalSettings((prev: any) => ({
                                        ...prev,
                                        userPresets: [...(prev.userPresets||[]), newPreset]
                                    }));
                                }
                            }}
                            className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-600 active:scale-95 transition flex items-center gap-1 ml-auto"
                        >
                            <span>+</span> 保存当前设定
                        </button>
                    </div>
                </div>
            )}
            {/* --- 下面是常规输入框 (头像/名字/描述) --- */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-100 bg-gray-50 group hover:shadow-md transition">
                  <img src={editForm.userAvatar || form.userAvatar} className="w-full h-full object-cover" alt="user" />
                  <input type="file" onChange={(e) => handleImageUpload(e, 'userAvatar')} className="absolute inset-0 opacity-0 cursor-pointer" title="Change Avatar" />
              </div>
              <div className="flex-1">
                  <label className="text-xs text-gray-500 font-bold ml-1">My Name</label>
                  <input
                    type="text"
                    value={editForm.userName !== undefined ? editForm.userName : form.userName}
                    onChange={e => setEditForm({ ...editForm, userName: e.target.value })}
                    className="w-full border-b p-2 outline-none text-sm font-bold bg-transparent focus:border-blue-500 transition"
                    placeholder="User"
                  />
              </div>
            </div>
            <div>
                <label className="text-xs text-gray-500 font-bold ml-1">My Description</label>
                <textarea
                    rows={3}
                    value={editForm.userPersona !== undefined ? editForm.userPersona : form.userPersona}
                    onChange={e => setEditForm({ ...editForm, userPersona: e.target.value })}
                    className="w-full border p-3 rounded-xl text-sm mt-1 bg-gray-50 text-xs focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
                    placeholder="描述一下你自己，AI 会看到的..."
                />
            </div>
          </section>
          {/* 2. 角色信息 */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🤖 Character Identity</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden relative border border-gray-100 bg-gray-50"><img src={form.avatar} className="w-full h-full object-cover" alt="character" /><input type="file" onChange={(e) => handleImageUpload(e, 'avatar')} className="absolute inset-0 opacity-0 cursor-pointer" /></div>
              <div className="flex-1"><label className="text-xs text-gray-500">Name</label><input type="text" value={form.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full border-b p-1 outline-none text-sm font-bold bg-transparent" /></div>
            </div>
            <div className="mb-2"><label className="text-xs text-gray-500">Private Memo</label><input type="text" value={form.memo} onChange={e => setEditForm({ ...editForm, memo: e.target.value })} className="w-full border p-2 rounded text-sm mt-1 bg-gray-50" /></div>
            <div><label className="text-xs text-gray-500">Persona</label><textarea rows={4} value={form.persona} onChange={e => setEditForm({ ...editForm, persona: e.target.value })} className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-xs leading-relaxed font-mono" /></div>
            {/* Minimax Config */}
            <div className="mt-6 pt-6 border-t border-dashed border-purple-200">
              <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-lg">🗣️</div><div><h3 className="font-bold text-gray-800 text-sm">Minimax 语音配置</h3></div></div>
              {/* 国内/国际版选择 */}
              <div className="mb-4 bg-purple-50 p-3 rounded-xl">
                <div className="flex gap-2">
                  <button onClick={() => { if (!globalSettings.minimax) globalSettings.minimax = { groupId: '', apiKey: '', model: 'speech-01' }; globalSettings.minimax.serviceArea = 'domestic'; setEditForm({ ...editForm }); }} className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${globalSettings.minimax?.serviceArea !== 'international' ? 'border-purple-500 bg-purple-500 text-white shadow-md' : 'border-gray-200 bg-white text-gray-400'}`}>🇨🇳 国内版</button>
                  <button onClick={() => { if (!globalSettings.minimax) globalSettings.minimax = { groupId: '', apiKey: '', model: 'speech-01' }; globalSettings.minimax.serviceArea = 'international'; setEditForm({ ...editForm }); }} className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${globalSettings.minimax?.serviceArea === 'international' ? 'border-blue-500 bg-blue-500 text-white shadow-md' : 'border-gray-200 bg-white text-gray-400'}`}>🌏 国际版</button>
                </div>
              </div>
              {/* 模型选择 */}
              <div className="mb-4">
                <select className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white outline-none" value={globalSettings.minimax?.model || "speech-01"} onChange={(e) => { if (globalSettings.minimax) globalSettings.minimax.model = e.target.value; setEditForm({ ...editForm }); }}>
                  <optgroup label="🔥 最新推荐"><option value="speech-2.6-hd">speech-2.6-hd</option><option value="speech-2.6-turbo">speech-2.6-turbo</option></optgroup>
                  <optgroup label="👴 兼容旧版"><option value="speech-01-hd">speech-01-hd</option><option value="speech-01">speech-01</option></optgroup>
                </select>
              </div>
              {/* ★★★ 这里是修正后的 Voice ID 区域 ★★★ */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Voice ID</label>
                  <button onClick={async () => { if (!globalSettings.minimax?.groupId) { alert("Key missing!"); return; } try { await fetchMinimaxVoices(globalSettings.minimax.groupId, globalSettings.minimax.apiKey); setAvailableVoices(getBuiltInMinimaxVoices()); alert("Voices loaded."); } catch (e) { alert("Failed."); } }} className="text-[10px] text-purple-600 underline">🔄 Fetch</button>
                </div>
                {/* 1. 保留了带 Fetch 功能的下拉框 */}
                <select className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white" value={form.voiceId || ""} onChange={e => setEditForm({ ...editForm, voiceId: e.target.value })}>
                  <option value="">Select Voice from List</option>
                  {(availableVoices.length > 0 ? availableVoices : getBuiltInMinimaxVoices()).map(v => (<option key={v.voice_id} value={v.voice_id}>{v.name}</option>))}
                </select>
                {/* 2. 将自定义输入框合并到这里，作为补充选项 */}
                <div className="mt-2">
                  <label className="text-xs text-gray-500">Or manually enter a custom Voice ID</label>
                  <input type="text" className="w-full border p-2 rounded text-sm mt-1 bg-gray-50" value={form.voiceId || ""} onChange={e => setEditForm({ ...editForm, voiceId: e.target.value })} placeholder="e.g. custom-voice-id" />
                </div>
              </div>
            </div>
          </section>
          {/* 3. Memory & Lore */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🧠 Memory Console</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-[10px] text-gray-500 font-bold uppercase">Context Depth</label><input type="number" value={form.contextDepth || 20} onChange={e => setEditForm({ ...editForm, contextDepth: parseInt(e.target.value) || 20 })} className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-center" /></div>
              <div><label className="text-[10px] text-gray-500 font-bold uppercase">Auto-Sum Trigger</label><input type="number" value={form.summaryTrigger || 50} onChange={e => setEditForm({ ...editForm, summaryTrigger: parseInt(e.target.value) || 50 })} className="w-full border p-2 rounded text-sm mt-1 bg-gray-50 text-center" /></div>
            </div>
            <button
    onClick={() => {
        // 先关闭设置页回到聊天
        setView('chat');
        // 稍微延迟一下打开面板，或者你需要把 showPersonaPanel 的控制权提到父级
        // 这里最简单的办法是：我们在 ChatApp 内部加一个状态来控制 "初始打开面板"
        // 但为了不改动太大，我们可以直接这样：
        setTimeout(() => setShowPersonaPanel(true), 100);
    }}
    className="w-full bg-yellow-100 text-yellow-800 py-3 rounded-xl font-bold border border-yellow-200 hover:bg-yellow-200 transition"
>
    📝 查看 / 编辑 记忆便签墙
</button>
          </section>
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🌍 World Lore</h3>
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">{enabledBooks.length} Books Active</span>
            </div>
          </section>
          {/* ★★★ 全新整合的时区设置卡片 ★★★ */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🕐 时区设置</h3>
            {/* 1. 角色时区 */}
            <div className="mb-4">
              <label className="text-sm font-bold text-gray-700 block mb-1">AI 角色的时区</label>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white"
                value={form.timezone || "Asia/Seoul"}
                onChange={e => setEditForm({ ...editForm, timezone: e.target.value })}
              >
                <option value="Asia/Shanghai">🇨🇳 中国大陆（北京时间）</option>
                <option value="Asia/Hong_Kong">🇭🇰 香港</option>
                <option value="Asia/Taipei">🇹🇼 台湾</option>
                <option value="Asia/Seoul">🇰🇷 韩国（首尔）</option>
                <option value="Asia/Tokyo">🇯🇵 日本（东京）</option>
                <option value="Asia/Singapore">🇸🇬 新加坡</option>
                <option value="Australia/Sydney">🇦🇺 澳大利亚（悉尼）</option>
                <option value="Europe/London">🇬🇧 英国（伦敦）</option>
                <option value="Europe/Paris">🇪🇺 中欧（巴黎/柏林）</option>
                <option value="America/New_York">🇺🇸 美国东部（纽约）</option>
                <option value="America/Los_Angeles">🇺🇸 美国西部（洛杉矶）</option>
              </select>
            </div>
            {/* 2. 你的时区 */}
            <div className="mb-4">
              <label className="text-sm font-bold text-gray-700 block mb-1">你的时区</label>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl text-sm bg-white"
                value={globalSettings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                onChange={(e) => {
                  const newTz = e.target.value;
                  setGlobalSettings(prev => ({ ...prev, userTimezone: newTz }));
                }}
              >
                <option value="Asia/Shanghai">🇨🇳 中国大陆（北京时间）</option>
                <option value="Asia/Hong_Kong">🇭🇰 香港</option>
                <option value="Asia/Taipei">🇹🇼 台湾</option>
                <option value="Asia/Seoul">🇰🇷 韩国（首尔）</option>
                <option value="Asia/Tokyo">🇯🇵 日本（东京）</option>
                <option value="Asia/Singapore">🇸🇬 新加坡</option>
                <option value="Australia/Sydney">🇦🇺 澳大利亚（悉尼）</option>
                <option value="Europe/London">🇬🇧 英国（伦敦）</option>
                <option value="Europe/Paris">🇪🇺 中欧（巴黎/柏林）</option>
                <option value="America/New_York">🇺🇸 美国东部（纽约）</option>
                <option value="America/Los_Angeles">🇺🇸 美国西部（洛杉矶）</option>
              </select>
            </div>
            {/* 3. 时差对比显示 */}
            {activeContact && (
              <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-center">
                <div className="font-bold text-purple-700">
                  {(() => {
                    const diff = getTimezoneOffsetDiff(
                      globalSettings.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                      form.timezone || activeContact.timezone // 优先使用表单里正在编辑的值
                    );
                    if (diff > 0) return `你 比 ta 快 ${diff} 小时`;
                    if (diff < 0) return `你 比 ta 慢 ${Math.abs(diff)} 小时`;
                    return "你们在同一时区～";
                  })()}
                </div>
              </div>
            )}
          </section>
          {/* ★★★ 4. 外观定制系统 (CSS + 预设) ★★★ */}
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">🎨 Appearance Customization</h3>
            {/* 预设管理栏 */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-2">Theme Presets</label>
              <div className="flex gap-2 mb-2">
                <select
                  className="flex-1 p-2 rounded-lg border text-sm outline-none bg-white"
                  value={selectedPresetId}
                  onChange={(e) => handleLoadPreset(e.target.value)}
                >
                  <option value="">-- Load a Preset --</option>
                  {globalSettings.themePresets?.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button onClick={handleDeletePreset} className="bg-red-100 text-red-500 px-3 rounded-lg font-bold hover:bg-red-200">Del</button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Preset Name"
                  className="flex-1 p-2 rounded-lg border text-sm outline-none"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                />
                <button onClick={handleSavePreset} className="bg-green-100 text-green-600 px-3 rounded-lg font-bold text-sm hover:bg-green-200">Save</button>
              </div>
            </div>
            {/* CSS 编辑器 (核心功能) */}
            <div className="mb-4">
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-bold text-gray-400">Custom CSS Code</label>
                <button onClick={() => setEditForm({ ...editForm, customCSS: "" })} className="text-[10px] text-gray-400 underline">Reset</button>
              </div>
              <textarea
                className="w-full h-64 bg-gray-800 text-green-400 font-mono text-[11px] p-3 rounded-xl outline-none resize-none leading-relaxed"
                placeholder="/* Paste your CSS here... */&#10;.message-wrapper { ... }"
                value={editForm.customCSS || form.customCSS || ""}
                onChange={(e) => setEditForm({ ...editForm, customCSS: e.target.value })}
                spellCheck={false}
              />
            </div>
            {/* 背景图 */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Chat Background URL</label>
              <div className="flex gap-2">
                <input type="text" placeholder="https://..." className="flex-1 border p-2 rounded-lg text-xs outline-none" value={editForm.chatBackground || form.chatBackground || ""} onChange={(e) => setEditForm({ ...editForm, chatBackground: e.target.value })} />
                <label className="bg-gray-100 border px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-gray-200">Upload<input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'chatBackground')} /></label>
              </div>
            </div>
          </section>
          {/* 5. 绿色保存按钮 */}
          <button onClick={saveSettings} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">
            💾 Save All Changes
          </button>
          {/* 6. 危险区域 (独立在最底部！) */}
          <div className="mt-auto pt-10 pb-4">
            <section className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
              <h3 className="text-xs font-bold text-red-400 uppercase mb-3">Danger Zone</h3>
              <button
                onClick={handleClearChat}
                className="w-full bg-white text-red-500 py-3 rounded-xl font-bold border border-red-200 shadow-sm hover:bg-red-50 transition"
              >
                ⚠️ Delete All Chat History
              </button>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 聊天界面 ====================
  if (activeContact) {
    return (
      <div className="h-full w-full flex flex-col relative" style={{
        backgroundImage: activeContact.wallpaper ? `url(${activeContact.wallpaper})` : 'none',
        backgroundColor: activeContact.wallpaper ? 'transparent' : '#f9fafb',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        {activeContact.wallpaper && <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>}
        {/* 音乐弹窗 */}
        {showSongModal && (
          <div className="absolute inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/50 animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-slideDown">
              <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg">🎧 导入网易云音乐</h3><button onClick={() => setShowSongModal(false)} className="text-gray-500 text-xl hover:text-gray-700">✕</button></div>
              <div className="p-4"><div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4"><p className="text-xs text-gray-500 mb-2">粘贴链接</p><textarea className="w-full bg-transparent text-sm p-2 outline-none h-20 border-b border-gray-300 resize-none font-mono" placeholder="https://music.163.com/#/playlist?id=17484650679" value={songImportText} onChange={e => setSongImportText(e.target.value)} autoFocus /></div>
                <div className="flex gap-3"><button onClick={() => { const match = songImportText.match(/id=(\d+)/); if (!match) { alert("链接里没找到 id=数字"); return; } const id = match[1]; setCurrentSong({ id: id, title: `网易云音乐 [ID:${id}]`, artist: '未知艺术家', url: `http://music.163.com/song/media/outer/url?id=${id}.mp3`, cover: 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg' }); setMusicPlayerOpen(true); setIsPlayerMinimized(false); setShowSongModal(false); setSongImportText(""); }} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-red-600 transition">▶️ 立即播放</button><button onClick={() => setShowSongModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition">取消</button></div>
              </div>
            </div>
          </div>
        )}
        {/* 消息菜单 */}
        {showMsgMenu && selectedMsg && (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 animate-fadeIn" onClick={() => setShowMsgMenu(false)}>
            <div className="bg-white w-full rounded-t-2xl p-4 animate-slideUp" onClick={e => e.stopPropagation()}>
              <div className="text-center text-gray-400 text-xs mb-4">对消息进行操作</div>
              <button onClick={handleReplyMessage} className="w-full py-3 border-b text-blue-600 font-bold">↩️ 引用回复</button>
              <button onClick={handleCollectMessage} className="w-full py-3 border-b text-orange-500 font-bold">⭐ 收藏</button>
              <button onClick={() => { setIsSelectionMode(true); toggleMessageSelection(selectedMsg.id); setShowMsgMenu(false); setSelectedMsg(null); }} className="w-full py-3 border-b text-purple-600 font-bold">☑️ 多选消息</button>
              <button onClick={handleDeleteMessage} className="w-full py-3 text-red-500 font-bold">🗑️ 删除</button>
              <div className="h-2 bg-gray-100 -mx-4"></div>
              <button onClick={() => setShowMsgMenu(false)} className="w-full py-3 text-gray-500 font-bold">取消</button>
            </div>
          </div>
        )}
        {/* Mood Modal */}
        {showMoodModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowMoodModal(false)}>
            <div className="bg-white/90 rounded-2xl p-6 shadow-2xl w-full max-w-sm text-center transform scale-100" onClick={e => e.stopPropagation()}>
              <div className="text-4xl mb-2">{activeContact.mood.energyLevel > 80 ? '🤩' : activeContact.mood.energyLevel > 50 ? '🙂' : '😴'}</div>
              <h3 className="text-xl font-bold text-gray-800">{activeContact.mood.current}</h3>
              <p className="text-sm text-gray-500 italic mt-1">{activeContact.mood.description || "Just chilling..."}</p>
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Energy</span><span>{activeContact.mood.energyLevel}%</span></div>
                <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${activeContact.mood.energyLevel}%` }}></div></div>
              </div>
              <p className="text-[10px] text-gray-400 mt-4">Updates based on time & conversation.</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="bg-white/90 backdrop-blur border-b p-3 flex items-center justify-between sticky top-0 z-10 shadow-sm transition-all">
<button 
  onClick={() => {
    setView('list');
    setShowPersonaPanel(false); // 强制关闭面板，防止残留
  }} 
  className="text-blue-500 text-lg"
>
  ‹
</button>
          <div className="flex flex-col items-center cursor-pointer" onClick={() => setShowPersonaPanel(true)}>
        <span className="font-bold">{activeContact.name}</span>
        <div className="flex items-center gap-1">
             <span className={`w-2 h-2 rounded-full ${activeContact.mood.energyLevel > 30 ? 'bg-green-500' : 'bg-red-500'}`}></span>
             <span className="text-[10px] text-gray-400">{activeContact.mood.current}</span>
        </div>
    </div>
          <button onClick={() => { setEditForm({}); setView('settings'); }} className="text-gray-500 text-xl">≡</button>
        </div>
        {/* 悬浮播放器 */}
        {musicPlayerOpen && currentSong && (
          <div className={`sticky top-12 mx-4 mt-2 z-30 transition-all duration-300 ${isPlayerMinimized ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 flex-1"><div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200"><img src={currentSong.cover} className="w-full h-full object-cover" alt="cover" /></div><div className="flex-1 overflow-hidden"><div className="font-bold text-gray-800 truncate text-sm">{currentSong.title}</div><div className="text-xs text-gray-500 truncate">{currentSong.artist}</div></div></div>
                <div className="flex items-center gap-2"><audio src={currentSong.url} autoPlay controls className="h-8 w-32" /><button onClick={closeMusicPlayer} className="text-gray-400 hover:text-gray-600 p-1">✕</button></div>
              </div>
              <button onClick={() => setIsPlayerMinimized(true)} className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-200 rounded-full w-6 h-6 text-xs text-gray-500 flex items-center justify-center hover:bg-gray-300">↓</button>
            </div>
          </div>
        )}
        {musicPlayerOpen && currentSong && isPlayerMinimized && (
          <div className="sticky top-12 z-30 flex justify-center mt-2">
            <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-full px-3 py-1 shadow-sm flex items-center gap-2 cursor-pointer hover:bg-white transition" onClick={() => setIsPlayerMinimized(false)}>
              <span className="text-red-500 animate-pulse">🎵</span>
              <span className="text-xs text-gray-700 truncate max-w-[100px]">{currentSong.title}</span>
              <button onClick={(e) => { e.stopPropagation(); closeMusicPlayer(); }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
          </div>
        )}
{/* 核心消息列表 */}
<div className={`flex-1 overflow-y-auto p-4 space-y-3 z-0 ${musicPlayerOpen && !isPlayerMinimized ? 'pt-4' : 'pt-2'}`}
  style={activeContact.chatBackground ? { backgroundImage: `url(${activeContact.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
>
  {activeContact.customCSS && <style dangerouslySetInnerHTML={{ __html: activeContact.customCSS }} />}
  {activeContact.history.map((msg, index) => {
    // 计算这条消息与上一条的间隔（分钟）
    let showInterval = false;
    let intervalMinutes = 0;
    if (index > 0) {
      const prevMsg = activeContact.history[index - 1];
      intervalMinutes = Math.floor((msg.timestamp - prevMsg.timestamp) / 60000);
      if (intervalMinutes > 20) {
        showInterval = true;
      }
    }
    const isConsecutive = index > 0 && activeContact.history[index - 1].role === msg.role;
    const isSelected = selectedIds.includes(msg.id);
    const duration = msg.voiceDuration && msg.voiceDuration > 0 ? msg.voiceDuration : 10;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 【修正】使用 React.Fragment (<>) 包裹所有返回的元素
    return (
      <React.Fragment key={msg.id}>
        {/* ★★★ 修正：时间间隔标签移入到 return 的 JSX 内部 ★★★ */}
        {showInterval && (
          <div className="text-center my-4">
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {intervalMinutes < 60
                ? `相隔 ${intervalMinutes} 分钟`
                : intervalMinutes < 1440
                  ? `相隔 ${Math.floor(intervalMinutes / 60)} 小时 ${intervalMinutes % 60} 分钟`
                  : `相隔 ${Math.floor(intervalMinutes / 1440)} 天`
              }
            </span>
          </div>
        )}

        {/* 原有的消息气泡结构保持不变 */}
        <div
          className={`message-wrapper ${msg.role === 'user' ? 'user' : 'ai'} flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
          onClick={() => { if (isSelectionMode) toggleMessageSelection(msg.id); }}
        >
          {/* 多选框 (保持不变) */}
          {isSelectionMode && (
            <div className={`mr-2 flex items-center justify-center transition-all ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                {isSelected && <span className="text-white text-xs font-bold">✓</span>}
              </div>
            </div>
          )}

          {/* 头像容器 */}
          <div className={`w-10 shrink-0 self-end flex ${msg.role === 'user' ? 'justify-end order-3' : 'justify-start order-1'}`}>
            {msg.role === 'assistant' && !isConsecutive && (
              <img src={activeContact.avatar} className="avatar ai-avatar w-8 h-8 rounded-full object-cover" alt="AI" />
            )}
            {msg.role === 'user' && !isConsecutive && (
              <img src={activeContact.userAvatar} className="avatar user-avatar w-8 h-8 rounded-full ml-2 self-end mb-1 object-cover border border-white shadow-sm" alt="user" />
            )}
          </div>

          {/* 主要内容容器 */}
          <div className={`flex items-end gap-2 order-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 气泡本体 */}
            <div
              onClick={(e) => { if (!isSelectionMode) { e.stopPropagation(); setSelectedMsg(msg); setShowMsgMenu(true); } }}
              className={`message-bubble min-w-0 relative group ${isSelectionMode ? 'pointer-events-none' : ''} max-w-[85%]`}
            >
              <div className={
                `content px-3 py-[4px] rounded-xl text-sm leading-relaxed relative break-words ` +
                (!activeContact.customCSS ?
                  (msg.role === 'user' ?
                    'bg-gray-200 text-gray-800' + (!isConsecutive ? ' rounded-tr-none' : '')
                    : 'bg-white text-gray-800' + (!isConsecutive ? ' rounded-tl-none' : ''))
                  : '')
              }>
                {msg.content.startsWith("> 引用") && (
                  <div className="quote-block text-xs mb-2 p-2 rounded opacity-80 bg-black/10">{msg.content.split('\n\n')[0]}</div>
                )}
                {msg.type === 'voice' || msg.content.trim().startsWith('[Voice Message]') ? (
                  <VoiceBubble
                    msg={msg}
                    isPlaying={playingMsgId === msg.id}
                    progress={audioProgress}
                    duration={duration}
                    onPlay={() => {
                      const cleanText = msg.content.replace(/^>.*?\n\n/, '').replace(/^\[Voice Message\]\s*/i, '').trim();
                      playMessageAudio(msg.id, cleanText);
                    }}
                    onSeek={handleSeek}
                    isUser={msg.role === 'user'}
                  />
                ) : msg.type === 'image' ? (
                  <img src={msg.content} className="chat-image rounded-lg max-w-full" alt="msg" />
                ) : (
                  <HiddenBracketText content={msg.content.replace(/^>.*?\n\n/, '')} />
                )}
              </div>
            </div>

            {/* 外置时间戳 */}
            <div className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 pb-1">
              {timeStr}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  })}
                    {/* ★★★ 对方正在输入提醒气泡 ★★★ */}
          {isAiTyping && (
            <div className="flex justify-start animate-slideUp mb-3">
              <div className="w-10 shrink-0 flex justify-start">
                <img src={activeContact.avatar} className="w-8 h-8 rounded-full object-cover" alt="AI" />
              </div>
              <div className="flex items-end gap-2">
                <div className="bg-white px-4 py-3 rounded-xl text-sm shadow-sm max-w-[80px]">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 pb-1">现在</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        {/* Input Area */}
        {isSelectionMode ? (
          <div className="bg-white border-t p-4 z-20 flex justify-between items-center animate-slideUp shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
            <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="text-gray-500 font-bold px-4">取消</button>
            <span className="text-sm font-bold text-gray-700">已选 {selectedIds.length} 条</span>
            <div className="flex gap-3">
              <button onClick={handleBatchDelete} disabled={selectedIds.length === 0} className={`px-4 py-2 rounded-lg font-bold bg-red-100 text-red-500 ${selectedIds.length === 0 ? 'opacity-50' : ''}`}>🗑️ 删除</button>
              <button onClick={handleBatchCollect} disabled={selectedIds.length === 0} className={`px-4 py-2 rounded-lg font-bold bg-yellow-400 text-yellow-900 shadow-sm ${selectedIds.length === 0 ? 'opacity-50' : ''}`}>📦 打包收藏</button>
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur border-t p-3 z-10">
            {replyTo && (
              <div className="flex justify-between items-center bg-gray-100 p-2 rounded-t-lg text-xs text-gray-500 mb-2 border-b animate-slideUp">
                <span>↪️ 回复 {replyTo.name}: {replyTo.content.substring(0, 15)}...</span><button onClick={() => setReplyTo(null)} className="font-bold text-gray-400 px-2">×</button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={() => setShowPlusMenu(!showPlusMenu)} className={`w-9 h-9 rounded-full flex items-center justify-center transition ${showPlusMenu ? 'bg-gray-200 rotate-45' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>+</button>
              <button onClick={handleAiReplyTrigger} disabled={isTyping} className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm ${isTyping ? 'bg-purple-200 text-purple-400 cursor-not-allowed' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}>✨</button>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSend('text'); } }} placeholder="Message..." className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm outline-none resize-none max-h-24 focus:bg-white focus:ring-2 focus:ring-blue-100 transition" rows={1} />
              <button onClick={() => handleUserSend('text')} className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition shadow-md ${input.trim() ? 'bg-blue-500 hover:bg-blue-600 scale-100' : 'bg-gray-300 scale-90'}`} disabled={!input.trim()}>↑</button>
            </div>
            {showPlusMenu && (
              <div className="flex justify-around mt-4 pb-2 animate-slideUp border-t pt-3">
                <label className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">📷</div><span className="text-xs text-gray-600">照片</span><input type="file" accept="image/*" className="hidden" onChange={handleImageSend} /></label>
                <div onClick={() => { const text = prompt("输入图片描述:"); if (text) handleUserSend('text', `[FakeImage] ${text}`); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🖼️</div><span className="text-xs text-gray-600">伪图</span></div>
                <div onClick={() => { setShowVoiceInput(true); setVoiceInput(""); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🎙️</div><span className="text-xs text-gray-600">语音</span></div>
                <div onClick={() => setShowSongModal(true)} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🎵</div><span className="text-xs text-gray-600">点歌</span></div>
                {activeContact?.history.some(m => m.role === 'assistant') && (<div onClick={() => { handleRegenerateLast(); setShowPlusMenu(false); }} className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition"><div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:scale-105 transition">🔄</div><span className="text-xs text-gray-600">重roll</span></div>)}
              </div>
            )}
            {showVoiceInput && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                <div className="w-full bg-white rounded-t-3xl p-6 animate-slideUp">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">录音消息</h3><button onClick={() => setShowVoiceInput(false)} className="text-gray-500 text-xl hover:text-gray-700">✕</button></div>
                  <textarea value={voiceInput} onChange={e => setVoiceInput(e.target.value)} placeholder="输入你要说的语音内容..." className="w-full p-4 border rounded-xl resize-none h-32 outline-none" autoFocus />
                  <div className="flex gap-3 mt-4"><button onClick={() => setShowVoiceInput(false)} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition">取消</button><button onClick={sendVoiceMessage} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition">发送</button></div>
                </div>
              </div>
            )}
          </div>
        )}
{showPersonaPanel && activeContact && (
    <PersonaPanel
        contact={activeContact}
        globalSettings={globalSettings}
        setContacts={setContacts}
        onClose={() => setShowPersonaPanel(false)}
        onRefineMemory={handleRefineMemory}
    />
)}
      </div>
    );
  }

  return null;
};
export default ChatApp;