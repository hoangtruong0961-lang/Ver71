import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegexScript } from '../../../../types';
import { 
    Settings, X, Plus, Edit2, Trash2, Play, ToggleRight, ToggleLeft, 
    ArrowUp, ArrowDown, AlertTriangle, Search, Loader2, Send, Sparkles, 
    FileUp, FileDown, Code2, Bot, Check, Copy, Laptop, RefreshCw 
} from 'lucide-react';
import { runRegexScript, extractFlags } from '../../../../utils/regex';
import { MarkdownRenderer } from '../../../common/MarkdownRenderer';
import { toast } from 'sonner';

interface RegexScriptsManagerProps {
    presetName: string;
    scripts: RegexScript[];
    onChange: (scripts: RegexScript[]) => void;
    playerName?: string;
    charName?: string;
}

const renderPreviewHTML = (html: string) => {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "<div class='text-[10px] text-rose-500 font-bold bg-rose-500/5 p-1 rounded border border-rose-500/20'>[Vô hiệu hóa Script trong Bản xem trước]</div>")
               .replace(/\bon\w+\s*=\s*(['"])(.*?)\1/gi, "on[Event]='removed'")
               .replace(/\bon\w+\s*=\s*([^>\s]+)/gi, "on[Event]=removed");
};

const MARKETPLACE_PLUGINS = [
    {
        id: 'marketplace-dropdown-select',
        scriptName: '🧩 Tavo Choice Trigger (showSelect)',
        findRegex: '/\\[Lựa Chọn:(.*?)\\]/gi',
        replaceString: `<div class="custom-widget-select p-4 bg-slate-950 border border-indigo-500/30 rounded-xl flex flex-col gap-3 my-2 shadow-lg font-sans">
  <div class="flex items-center gap-2 text-indigo-400 font-bold text-[11px] uppercase tracking-wider">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="animate-pulse"><circle cx="12" cy="12" r="10"/><path d="m4.9 19.1 14.2-14.2"/></svg>
    <span>Quyết định rẽ ranh cốt truyện</span>
  </div>
  <p class="text-xs text-slate-300 leading-relaxed font-sans">$1</p>
  <button id="trigger-select-btn" class="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-2 block shadow-md uppercase border-none outline-none cursor-pointer">
    <span>Khai mở sự lựa chọn</span>
  </button>
  <script>
    document.getElementById('trigger-select-btn').addEventListener('click', async () => {
      const opts = [
        { value: 'investigate', label: '1. Điều tra vết nứt thời gian', subtitle: 'Phân tích tàn tích cổ đại', description: 'Có thể đối mặt tula quỷ' },
        { value: 'retreat', label: '2. Ẩn mình sau tảng đá lớn', subtitle: 'Tránh ánh mắt của tà tinh', description: 'Chờ đợi cơ hội phục kích' },
        { value: 'confront', label: '3. Bước ra đối kháng trực diện', subtitle: 'Nêu cao chí khí dũng giả', description: 'Tận dụng tuyệt kỹ Đao Pháp' }
      ];
      try {
        const result = await window.TawaAPI.showSelect(opts, 'Quyết định hành động tối mật:', 'investigate');
        if (result) {
          window.TawaAPI.sendAction('TOAST', 'Hệ thống: Lựa chọn thành công ' + result);
          window.TawaAPI.sendAction('SEND_MESSAGE', 'Lựa chọn phương án hành động: ' + (result === 'investigate' ? 'Điều tra vết nứt thời gian' : result === 'retreat' ? 'Ẩn mình sau tảng đá lớn' : 'Bước ra đối kháng trực diện'));
        }
      } catch(e) {
        console.error(e);
      }
    });
  </script>
</div>`,
        description: 'Tích hợp hệ thống native dropdown choices giúp người chơi ra quyết định trực quan ngay trên chatbox.',
        forceIframe: true,
        disabled: false,
        placement: [2],
        markdownOnly: true
    },
    {
        id: 'marketplace-tts-widget',
        scriptName: '🔊 Tavo Audio Narrator (TTS Proxy)',
        findRegex: '/\\[Kể Chuyện\\]:(.*)/gi',
        replaceString: `<div class="p-3.5 bg-slate-950 border border-emerald-500/20 rounded-xl flex items-center justify-between my-2 shadow-md">
  <div class="flex items-center gap-3">
    <div class="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
    </div>
    <div>
      <span class="block text-xs font-black text-slate-200 font-sans">Lời thoại Sống động</span>
      <span class="block text-[10px] text-slate-400 font-sans">Đọc phát âm chân thực bằng giọng máy Việt VN</span>
    </div>
  </div>
  <button id="tts-play-btn" class="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] rounded-lg transition-all flex items-center gap-1 uppercase border-none outline-none cursor-pointer">
    <span>Đọc Diễn Cảm</span>
  </button>
  <script>
    var isPlaying = false;
    var rawText = "$1";
    document.getElementById('tts-play-btn').addEventListener('click', () => {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        isPlaying = false;
        document.getElementById('tts-play-btn').querySelector('span').textContent = 'Đọc Diễn Cảm';
      } else {
        var cleanText = rawText.replace(/<[^>]*>/gi, '').trim() || 'Tuyệt cú không lời đại từ nhân vật!';
        var msg = new SpeechSynthesisUtterance(cleanText);
        msg.lang = 'vi-VN';
        msg.rate = 1.0;
        msg.onend = function() {
          isPlaying = false;
          document.getElementById('tts-play-btn').querySelector('span').textContent = 'Đọc Diễn Cảm';
        };
        window.speechSynthesis.speak(msg);
        isPlaying = true;
        document.getElementById('tts-play-btn').querySelector('span').textContent = 'Tắt Đọc';
      }
    });
  </script>
</div>`,
        description: 'Phát âm lời thoại kịch tính thông qua SpeechSynthesis cho nhân vật ảo tự động kịch bản hóa cực hay.',
        forceIframe: true,
        disabled: false,
        placement: [2],
        markdownOnly: true
    },
    {
        id: 'marketplace-dice-anim',
        scriptName: '🎲 Fate Roll Dramatic Dice Decorator',
        findRegex: '/\\[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH\\]:(.*)/gi',
        replaceString: `<div class="my-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 shadow-inner flex flex-col gap-2 relative overflow-hidden font-sans">
  <div class="absolute -right-6 -bottom-6 text-amber-500/10 opacity-30">
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 8h.01"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16h.01"/></svg>
  </div>
  <div class="flex items-center gap-2">
    <div class="p-1.5 bg-amber-500/20 text-amber-500 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 8h.01"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16h.01"/></svg>
    </div>
    <span class="text-[11px] font-black uppercase tracking-wider text-amber-500 font-mono">Bản Tin Định Mệnh (Fate Outcome)</span>
  </div>
  <p class="text-xs text-slate-300 leading-relaxed font-mono">$1</p>
</div>`,
        description: 'Trang hoàng các bảng tin định mệnh từ d20 d100 của Fate Roll thành khung thông báo huyền bí vô cùng ảo diệu.',
        forceIframe: false,
        disabled: false,
        placement: [1, 2],
        markdownOnly: true
    }
];

const RegexScriptsManager: React.FC<RegexScriptsManagerProps> = ({ presetName, scripts, onChange, playerName, charName }) => {
    // UI states
    const [managerTab, setManagerTab] = useState<'scripts' | 'marketplace'>('scripts');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingScript, setEditingScript] = useState<RegexScript | null>(null);
    const [testInput, setTestInput] = useState('Dữ liệu mẫu để kiểm tra Regex...');
    const [regexError, setRegexError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // AI Debugging states inside RegexScriptsManager
    const [aiChat, setAiChat] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [aiInput, setAiInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const aiChatBottomRef = useRef<HTMLDivElement>(null);

    // Scroll AI chat to bottom automatically
    useEffect(() => {
        if (aiChatBottomRef.current) {
            aiChatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [aiChat, isAiLoading]);

    const askAiAssistant = async (customPrompt?: string | null, freshStarted = false) => {
        setIsAiLoading(true);
        setAiError(null);
        const userMsgText = customPrompt !== undefined ? customPrompt : aiInput;
        if (userMsgText === '' && customPrompt === undefined) {
            setIsAiLoading(false);
            return;
        }

        if (customPrompt === undefined) {
            setAiInput('');
        }

        const nextChatHistory = [...aiChat];
        if (userMsgText) {
            nextChatHistory.push({ role: 'user', text: userMsgText });
            setAiChat(nextChatHistory);
        }

        try {
            const currentOutput = runRegexScript(editingScript, testInput || ' ', { 
                userName: playerName || 'User', 
                charName: charName || 'Character' 
            }) || testInput;

            const response = await fetch('/api/ai/debug-regex', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scriptName: editingScript?.scriptName || 'ST Regex Script',
                    findRegex: editingScript?.findRegex || '',
                    replaceString: editingScript?.replaceString || '',
                    testInput: testInput,
                    testOutput: currentOutput,
                    prompt: userMsgText || "Hãy phân tích kịch bản Regex hiện tại của tôi.",
                    chatHistory: freshStarted ? [] : aiChat
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.details || 'Không thể kết nối với máy chủ AI.');
            }

            setAiChat(prev => [...prev, { role: 'model', text: data.text }]);
        } catch (err: any) {
            setAiError(err.message || 'Lỗi không xác định khi kết nối với máy chủ AI.');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Auto-analysis on open
    useEffect(() => {
        if (isEditorOpen && editingScript && aiChat.length === 0 && !isAiLoading) {
            askAiAssistant(`Chào bạn, tôi vừa mở Trợ lý AI Gỡ lỗi Regex. Hãy phân tích Regex Pattern "${editingScript.findRegex || ''}" và chuỗi thay thế của kịch bản "${editingScript.scriptName || 'Chưa đặt'}" xem có vấn đề logic, cú pháp hay ký tự escape nào chưa chuẩn không.`, true);
        }
    }, [isEditorOpen, editingScript?.id]);

    const handleRegexChange = (val: string) => {
        if (!editingScript) return;
        setEditingScript({...editingScript, findRegex: val});
        try {
            const extracted = extractFlags(val);
            new RegExp(extracted.regex || val, extracted.flags || "g");
            setRegexError(null);
        } catch (e) {
            setRegexError((e as Error).message);
        }
    };

    const handleToggleDisable = (scriptId: string) => {
        const newList = scripts.map(s => s.id === scriptId ? { ...s, disabled: !s.disabled } : s);
        onChange(newList);
        toast.info('Đã cập nhật trạng thái hoạt động của kịch bản.');
    };

    const handleDelete = (scriptId: string) => {
        setDeletingId(scriptId);
    };
    
    const confirmDelete = (scriptId: string) => {
        onChange(scripts.filter(s => s.id !== scriptId));
        setDeletingId(null);
        toast.success('Đã xóa kịch bản rule thành công.');
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const list = [...scripts];
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === list.length - 1)) return;
        const temp = list[index];
        if (direction === 'up') {
            list[index] = list[index - 1];
            list[index - 1] = temp;
        } else {
            list[index] = list[index + 1];
            list[index + 1] = temp;
        }
        
        const updatedList = list.map((s, idx) => ({ ...s, order: idx }));
        onChange(updatedList);
    };

    const openEditor = (script: RegexScript | null) => {
        setAiChat([]);
        setAiError(null);
        setAiInput('');
        if (script) {
            setEditingScript({ 
                ...script,
                markdownOnly: script.markdownOnly ?? script.alterChatDisplay ?? false,
                promptOnly: script.promptOnly ?? script.alterOutgoingPrompt ?? false,
                forceIframe: script.forceIframe ?? false
            });
        } else {
            setEditingScript({
                id: crypto.randomUUID(),
                scriptName: 'Kịch bản Mới',
                findRegex: '',
                replaceString: '',
                trimStrings: [],
                placement: [1, 2], 
                substituteRegex: 0,
                markdownOnly: false,
                promptOnly: false,
                forceIframe: false,
                minDepth: null,
                maxDepth: null,
                disabled: false,
                runOnEdit: false
            });
        }
        setIsEditorOpen(true);
    };

    const saveEditor = () => {
        if (!editingScript) return;
        
        const scriptToSave = {
            ...editingScript,
            alterChatDisplay: editingScript.markdownOnly,
            alterOutgoingPrompt: editingScript.promptOnly
        };

        const idx = scripts.findIndex(s => s.id === editingScript.id);
        const list = [...scripts];
        if (idx >= 0) {
            list[idx] = scriptToSave;
        } else {
            list.push(scriptToSave);
        }
        
        const updatedList = list.map((s, index) => ({
            ...s,
            order: s.order !== undefined && s.order !== null ? s.order : index
        }));

        onChange(updatedList);
        setIsEditorOpen(false);
        toast.success(`Đã lưu thay đổi kịch bản "${editingScript.scriptName}"!`);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('Đã sao chép mã liên kết vào khay nhớ tạm!');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredScripts = scripts.filter(s => 
        (s.scriptName?.toLowerCase().includes(searchQuery.toLowerCase()) || '') ||
        (s.findRegex?.toLowerCase().includes(searchQuery.toLowerCase()) || '')
    );

    const getPlacementBadge = (p: number) => {
        switch (p) {
            case 1: return { text: 'User', style: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
            case 2: return { text: 'Character', style: 'bg-pink-500/10 text-pink-400 border border-pink-500/20' };
            case 3: return { text: 'Slash', style: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
            case 4: return { text: 'World Info', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
            case 5: return { text: 'Reasoning', style: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' };
            default: return { text: 'Unknown', style: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
        }
    };

    return (
        <div id="regex-scripts-manager" className="flex flex-col h-full bg-[#090d16] text-slate-100 rounded-2xl border border-slate-800/80 p-6 shadow-2xl transition-all duration-300">
            {/* TOP HEADER PANELS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 mb-5 border-b border-slate-800/80">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-400/20 text-sky-400 animate-pulse-slow">
                            <Settings size={20} className="stroke-[1.8]" />
                        </div>
                        <div>
                            <span className="text-[10px] tracking-widest text-sky-400 font-extrabold uppercase font-sans">Advanced Configuration Engine</span>
                            <h3 className="text-lg font-bold text-slate-100 font-sans tracking-tight flex items-center gap-2">
                                Regex Workscripts của <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-450 via-sky-300 to-indigo-400">{presetName}</span>
                            </h3>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
                        Tải, biên tập và gỡ lỗi kịch bản biểu thức chính quy (Regular Expressions) để trang hoàng hoặc bẻ lái dữ liệu hội thoại nâng cao.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0 shrink-0 select-none">
                    <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800 hover:border-slate-700/60 cursor-pointer transition-all duration-200 shadow-md">
                        <FileUp size={14} className="text-slate-400" />
                        Nhập JSON
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    try {
                                        const parsed = JSON.parse(ev.target?.result as string);
                                        if (Array.isArray(parsed)) {
                                            const newScripts = parsed.map(p => ({...p, id: globalThis.crypto.randomUUID()}));
                                            onChange([...scripts, ...newScripts]);
                                        } else if (parsed && typeof parsed === 'object') {
                                            const newScript = {...parsed, id: globalThis.crypto.randomUUID()};
                                            onChange([...scripts, newScript as RegexScript]);
                                        }
                                        toast.success('Nhập JSON tập tin kịch bản mới thành công!');
                                    } catch (err) {
                                        console.error('Failed to parse JSON', err);
                                        toast.error('Nhập tập tin JSON thất bại!');
                                    }
                                };
                                reader.readAsText(file);
                                e.target.value = ''; 
                            }}
                        />
                    </label>
                    <button 
                        onClick={() => {
                            const jsonStr = JSON.stringify(scripts, null, 2);
                            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const downloadAnchorNode = document.createElement('a');
                            downloadAnchorNode.href = url;
                            downloadAnchorNode.setAttribute("download", `regex_scripts_${presetName.replace(/\s+/g, '_')}.json`);
                            document.body.appendChild(downloadAnchorNode);
                            downloadAnchorNode.click();
                            downloadAnchorNode.remove();
                            URL.revokeObjectURL(url);
                            toast.success('Xuất tập tin cấu hình JSON thành công!');
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800 hover:border-slate-700/60 transition-all duration-200 shadow-md"
                    >
                        <FileDown size={14} className="text-slate-400" />
                        Xuất JSON
                    </button>
                    <button 
                        onClick={() => openEditor(null)} 
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all border shadow-sm outline-none bg-sky-500 text-slate-950 font-sans border-sky-450 hover:bg-sky-400 active:scale-[0.98] cursor-pointer"
                    >
                        <Plus size={15} className="stroke-[2.5]" /> Thêm Kịch Bản
                    </button>
                </div>
            </div>

            {/* TAB SELECTION BAR */}
            <div className="flex items-center justify-between gap-4 mb-4 select-none">
                <div className="flex border border-slate-800/80 p-1 bg-slate-950/45 rounded-xl max-w-sm">
                    <button
                        onClick={() => setManagerTab('scripts')}
                        className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all uppercase tracking-wider ${managerTab === 'scripts' ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Danh sách ({scripts.length})
                    </button>
                    <button
                        onClick={() => setManagerTab('marketplace')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${managerTab === 'marketplace' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Sparkles size={11} className="text-emerald-400 animate-pulse" /> Chợ Plugin
                    </button>
                </div>
                
                <span className="text-[11px] font-mono text-slate-500 bg-slate-900/40 border border-slate-800/40 px-2.5 py-1 rounded-lg">
                    Active Preset: <span className="text-sky-400 font-semibold">{presetName}</span>
                </span>
            </div>

            {managerTab === 'scripts' ? (
                <>
                    {/* SEARCH INTERFACE */}
                    <div className="relative mb-4 select-none animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-500" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm kịch bản quy tắc nâng cao theo tên, biểu thức chính quy..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/40 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/30 shadow-inner transition-all duration-200 placeholder:text-slate-600"
                        />
                    </div>

                    {/* INTERACTIVE WORK-LIST */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pb-8">
                        {filteredScripts.length === 0 ? (
                            <div className="text-center text-slate-500 py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                                <Code2 size={24} className="mx-auto text-slate-700 mb-2.5" />
                                <span className="text-xs font-sans">
                                    {scripts.length === 0 ? 'Chưa có kịch bản (script) nào được thiết lập. Hãy nhấn nút "+ Thêm Kịch Bản" để kiến tạo mới!' : 'Không tìm thấy quy tắc Regex lọc trùng khớp.'}
                                </span>
                            </div>
                        ) : filteredScripts.map((script, idx) => (
                            <div 
                                key={script.id || idx} 
                                className={`rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                                    !script.disabled 
                                        ? 'bg-[#0f1422]/70 border-slate-800 text-slate-200 hover:border-slate-700/60 shadow-lg' 
                                        : 'bg-slate-950/20 border-slate-900 opacity-55 text-slate-500 hover:opacity-75'
                                }`}
                            >
                                {/* Left Glow Indicator on Active */}
                                <div className={`absolute top-0 bottom-0 left-0 w-1 ${!script.disabled ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-slate-800'}`} />

                                <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        {/* Physical drag re-order buttons */}
                                        <div className="flex flex-col gap-1 shrink-0 bg-slate-900/60 p-1.5 border border-slate-800/80 rounded-xl select-none group-hover:bg-slate-900 text-slate-500 transition-colors">
                                            <button 
                                                onClick={() => handleMove(idx, 'up')}
                                                disabled={idx === 0}
                                                className="p-1 hover:bg-slate-800 rounded-lg disabled:opacity-35 disabled:hover:bg-transparent text-slate-400 hover:text-sky-400 transition-colors"
                                                title="Di chuyển lên"
                                            >
                                                <ArrowUp size={13} className="stroke-[2.5]" />
                                            </button>
                                            <button 
                                                onClick={() => handleMove(idx, 'down')}
                                                disabled={idx === scripts.length - 1}
                                                className="p-1 hover:bg-slate-800 rounded-lg disabled:opacity-35 disabled:hover:bg-transparent text-slate-400 hover:text-sky-400 transition-colors"
                                                title="Di chuyển xuống"
                                            >
                                                <ArrowDown size={13} className="stroke-[2.5]" />
                                            </button>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <h4 className={`text-sm font-bold tracking-tight truncate ${!script.disabled ? 'text-slate-105' : 'text-slate-500'}`}>
                                                    {script.scriptName || 'Kịch bản Regex'}
                                                </h4>
                                                
                                                {/* Placements visual indicators */}
                                                <div className="flex flex-wrap gap-1">
                                                    {(script.placement || []).map(pVal => {
                                                        const badge = getPlacementBadge(pVal);
                                                        return (
                                                            <span key={pVal} className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md tracking-wider ${badge.style}`}>
                                                                {badge.text}
                                                            </span>
                                                        );
                                                    })}
                                                </div>

                                                {script.forceIframe && (
                                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 tracking-wider">
                                                        Sandbox iFrame
                                                    </span>
                                                )}
                                            </div>

                                            {/* Code Container */}
                                            <div className="flex items-center gap-2 group/code select-all">
                                                <code className="text-xs font-mono px-2.5 py-1 bg-slate-950/80 border border-slate-900 rounded-lg text-pink-400 max-w-full truncate block shadow-inner">
                                                    {script.findRegex || '// No find template'}
                                                </code>
                                                <button 
                                                    onClick={() => copyToClipboard(script.findRegex || '', script.id || '')}
                                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-sky-400 shrink-0 opacity-0 group-hover/code:opacity-100 transition-opacity cursor-pointer duration-150"
                                                    title="Sao chép biểu thức"
                                                >
                                                    {copiedId === script.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                </button>
                                            </div>

                                            {/* Advanced Action triggers */}
                                            <div className="flex flex-wrap items-center gap-3.5 mt-3 select-none">
                                                <button
                                                    onClick={() => openEditor(script)}
                                                    className="text-xs flex items-center gap-1.5 font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 px-2.5 py-1 rounded-lg transition-all outline-none"
                                                >
                                                    <Edit2 size={11} className="text-sky-400" /> Biên tập cấu hình
                                                </button>
                                                
                                                <button
                                                    onClick={() => {
                                                        const jsonStr = JSON.stringify(script, null, 2);
                                                        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
                                                        const url = URL.createObjectURL(blob);
                                                        const downloadAnchorNode = document.createElement('a');
                                                        downloadAnchorNode.href = url;
                                                        const safeName = (script.scriptName || 'regex_script').replace(/\s+/g, '_').toLowerCase();
                                                        downloadAnchorNode.setAttribute("download", `regex_${safeName}.json`);
                                                        document.body.appendChild(downloadAnchorNode);
                                                        downloadAnchorNode.click();
                                                        downloadAnchorNode.remove();
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    className="text-xs flex items-center gap-1.5 font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 px-2.5 py-1 rounded-lg transition-all outline-none"
                                                >
                                                    <FileDown size={11} className="text-emerald-400" /> Trích xuất
                                                </button>
                                                
                                                {deletingId === script.id ? (
                                                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-lg">
                                                        <span className="text-[10px] text-rose-400 font-extrabold uppercase select-none">Chắc chắn xóa?</span>
                                                        <button onClick={() => confirmDelete(script.id!)} className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded-md font-extrabold uppercase transition-colors">Vâng</button>
                                                        <button onClick={() => setDeletingId(null)} className="text-[10px] bg-slate-850 hover:bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md transition-colors">Không</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDelete(script.id!)}
                                                        className="text-xs text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all outline-none"
                                                    >
                                                        <Trash2 size={11} /> Gột bỏ
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ON STATE ACTIVE TOGGLE BUTTON */}
                                    <button 
                                        onClick={() => handleToggleDisable(script.id!)}
                                        className={`transition-all duration-200 outline-none cursor-pointer focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-950 rounded-full ${
                                            !script.disabled ? 'text-sky-400 drop-shadow-[0_0_8px_#38bdf8]' : 'text-slate-700 hover:text-slate-650'
                                        }`}
                                        title={!script.disabled ? "Đang hoạt động" : "Tạm ngắt"}
                                    >
                                        {!script.disabled ? <ToggleRight size={40} className="stroke-[1.35]" /> : <ToggleLeft size={40} className="stroke-[1.35]" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                /* COMMUNITY INTERACTIVE PLUGIN PACK */
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pb-8 animate-in fade-in duration-300">
                    <div className="p-5 rounded-2xl border border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 to-transparent flex items-start gap-3.5 shadow-md">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 rounded-xl">
                            <Sparkles className="animate-pulse stroke-[1.85]" size={18} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-200">SillyTavern Community Plugins</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Cài đặt một chạm các template và cấu trúc tương tác đã đóng gói sẵn để vẽ nhanh các thành phần đặc biệt (Interactive choice selects, audio readers, text styles) ngay trên giao diện chatbox.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MARKETPLACE_PLUGINS.map(plugin => {
                            const isInstalled = scripts.some(s => s.scriptName === plugin.scriptName);
                            return (
                                <div key={plugin.id} className="p-5 bg-slate-900/15 border border-slate-800/80 rounded-2xl flex flex-col justify-between hover:border-slate-700/60 hover:bg-slate-900/35 transition-all duration-200 shadow-md">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-sm font-bold text-slate-100">{plugin.scriptName}</h4>
                                            <span className="text-[9px] bg-slate-950 border border-indigo-950/40 text-sky-400 font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                                {plugin.forceIframe ? 'iFrame Widget' : 'CSS Class'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">{plugin.description}</p>
                                        <div className="pt-1.5 select-all">
                                            <span className="text-[9.5px] font-mono bg-slate-950/80 text-indigo-400 px-2.5 py-1.5 rounded-lg border border-slate-900 block truncate" title={plugin.findRegex}>
                                                Pattern: {plugin.findRegex}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-4 border-t border-[#3b3d4d]/20 flex items-center justify-between select-none">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tavo Library</span>
                                        <button
                                            onClick={() => {
                                                const newScript = {
                                                    ...plugin,
                                                    id: crypto.randomUUID()
                                                };
                                                onChange([...scripts, newScript]);
                                                toast.success(`Đã cài đặt & kích hoạt plugin "${plugin.scriptName}"!`);
                                            }}
                                            disabled={isInstalled}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                isInstalled 
                                                    ? 'border-sky-500/10 bg-sky-500/5 text-sky-400/60 cursor-default' 
                                                    : 'bg-emerald-500 text-slate-950 border-emerald-450 hover:bg-emerald-400 cursor-pointer active:scale-95 shadow-sm'
                                            }`}
                                        >
                                            {isInstalled ? '✓ Đã sở hữu' : 'Cơ cấu Cài đặt'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* DUAL-PANE POPUP EDITOR & INTERACTIVE SUITE */}
            <AnimatePresence>
                {isEditorOpen && editingScript && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" 
                        style={{ zIndex: 1010 }}
                    >
                        <motion.div 
                            initial={{ scale: 0.96, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0b0f19] border border-slate-800/80 w-full max-w-6xl max-h-[96vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden text-slate-100"
                        >
                            {/* HEADER */}
                            <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md shadow-inner relative z-10 select-none">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-400">
                                        <Code2 size={20} className="stroke-[1.8]" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-lg text-slate-100 font-sans tracking-tight">
                                            Regex Workscript Lab
                                        </h2>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            Biên tập biểu thức chính quy cho preset <span className="text-sky-400 font-bold">{presetName}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-850 hover:text-rose-400 rounded-xl text-slate-500 transition-all cursor-pointer">
                                    <X size={20}/>
                                </button>
                            </div>

                            {/* BODY CONTENT - SCROLL SPLIT */}
                            <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-slate-950/20">
                                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
                                    
                                    {/* LEFT COLUMN - PARAMS CONFIG (ACCORDION & TEXTAREAS) */}
                                    <div className="flex-1 p-6 space-y-5.5 overflow-y-auto custom-scrollbar">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/30 p-4 border border-slate-800/40 rounded-xl">
                                            <div className="flex-1 space-y-1.5 w-full">
                                                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans">Tên quy tắc (Script Name)</label>
                                                <input 
                                                    className="w-full p-2.5 bg-slate-950 rounded-lg border border-slate-800 outline-none focus:border-sky-500/70 text-slate-200 font-medium transition-colors text-xs" 
                                                    value={editingScript.scriptName} 
                                                    onChange={e => setEditingScript({...editingScript, scriptName: e.target.value})} 
                                                    placeholder="Tên kịch bản quy tắc..."
                                                />
                                            </div>
                                            <label className="flex items-center gap-2.5 cursor-pointer shrink-0 pt-0 sm:pt-4 select-none">
                                                <span className="text-xs font-bold text-slate-400">Hoạt động:</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => setEditingScript({...editingScript, disabled: !editingScript.disabled})}
                                                    className="outline-none"
                                                >
                                                    {!editingScript.disabled 
                                                        ? <ToggleRight className="text-sky-400 transition-transform scale-110 cursor-pointer" size={32} /> 
                                                        : <ToggleLeft className="text-slate-600 transition-transform scale-110 cursor-pointer" size={32} />
                                                    }
                                                </button>
                                            </label>
                                        </div>

                                        {/* PATTERN SECTION */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between select-none">
                                                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans flex items-center gap-2">
                                                    Pattern Regex (Mẫu tìm kiếm)
                                                    {regexError && (
                                                        <span className="text-[9px] text-rose-400 normal-case flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                            <AlertTriangle size={11} /> Biểu thức lỗi
                                                        </span>
                                                    )}
                                                </label>
                                                <span className="text-[9.5px] bg-slate-950 text-slate-500 px-2 py-0.5 rounded border border-slate-900">Format: /regex/flags (vd: /match/gi)</span>
                                            </div>
                                            <textarea 
                                                className={`w-full p-3 font-mono text-xs bg-slate-950 rounded-xl border min-h-[65px] outline-none transition-colors resize-y custom-scrollbar tracking-wide ${
                                                    regexError ? 'border-rose-500/30 focus:border-rose-500 text-rose-400' : 'border-slate-800 focus:border-sky-500/70 text-sky-400'
                                                }`} 
                                                placeholder="/(lời_thoại|nghĩ|hành|dong)/gi" 
                                                value={editingScript.findRegex} 
                                                onChange={e => handleRegexChange(e.target.value)} 
                                            />
                                            {regexError && (
                                                <code className="text-[9.5px] text-rose-400 font-mono break-all mt-1 bg-rose-950/20 p-1.5 rounded border border-rose-900/30 block leading-tight">{regexError}</code>
                                            )}
                                        </div>

                                        {/* REPLACEMENT SECTION */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between select-none">
                                                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans flex items-center gap-2">
                                                    Mã/Chuỗi Thay Thế (Replace With)
                                                </label>
                                                <div className="flex gap-1.5">
                                                    <span className="text-[9.5px] bg-emerald-500/5 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/10">Regex Variables: $1, $2</span>
                                                    <span className="text-[9.5px] bg-sky-500/5 text-sky-450 px-2 py-0.5 rounded-lg border border-sky-500/10">UI Macro Variables: {'{{user}}'}, {'{{char}}'}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Macro Pill Injectors */}
                                            <div className="flex flex-wrap gap-1.5 bg-slate-900/30 p-2 border border-slate-800/30 rounded-xl select-none">
                                                <span className="text-[9.5px] text-slate-500 font-bold leading-normal pt-1 px-1.5">Inject:</span>
                                                {[
                                                    { label: '$1 (Group 1)', value: '$1' },
                                                    { label: '$2 (Group 2)', value: '$2' },
                                                    { label: '{{user}}', value: '{{user}}' },
                                                    { label: '{{char}}', value: '{{char}}' },
                                                    { label: '<div class="widget">', value: '<div class="custom-card p-3 my-1 bg-slate-950 border border-slate-800 rounded-xl">\n  $1\n</div>' }
                                                ].map(pill => (
                                                    <button
                                                        key={pill.label}
                                                        type="button"
                                                        onClick={() => {
                                                            const currentVal = editingScript.replaceString || '';
                                                            setEditingScript({
                                                                ...editingScript,
                                                                replaceString: currentVal + pill.value
                                                            });
                                                        }}
                                                        className="text-[9.5px] font-mono bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded transition-all cursor-pointer shadow-sm active:scale-95"
                                                    >
                                                        {pill.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <textarea 
                                                className="w-full p-4 font-mono text-xs text-slate-200 bg-slate-950 rounded-xl border border-slate-800 min-h-[190px] outline-none focus:border-sky-500/70 resize-y custom-scrollbar shadow-inner leading-relaxed" 
                                                value={editingScript.replaceString} 
                                                onChange={e => setEditingScript({...editingScript, replaceString: e.target.value})} 
                                                placeholder="Sử dụng text thuần hoặc mã khối HTML/CSS bọc biến để biến đổi hiển thị tin nhắn.\nVí dụ:\n<span class='text-sky-400 font-extrabold font-mono'>$1</span>" 
                                            />
                                        </div>
                                        
                                        {/* ADVANCED TRIGGERS (MIN ACTIVATION & SUBSTRINGS) */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between select-none">
                                                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans">Regex Kích Hoạt Tối Thiểu</label>
                                                    <span className="text-[9.5px] text-slate-600">ST Compatible</span>
                                                </div>
                                                <input 
                                                    className="w-full p-2.5 bg-slate-950 rounded-lg border border-slate-800 outline-none focus:border-sky-500/70 font-mono text-xs text-slate-300" 
                                                    placeholder="/(chỉ chạy khi câu có từ này)/i" 
                                                    value={editingScript.minActivationRegex || ''} 
                                                    onChange={e => setEditingScript({...editingScript, minActivationRegex: e.target.value})} 
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between select-none">
                                                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans">Xóa chuỗi con (Trim Substrings)</label>
                                                    <span className="text-[9.5px] text-slate-600">Mỗi chuỗi 1 dòng</span>
                                                </div>
                                                <textarea 
                                                    className="w-full p-2 bg-slate-950 rounded-lg border border-slate-800 outline-none focus:border-sky-500/70 text-xs h-[38px] text-slate-300 resize-none custom-scrollbar" 
                                                    placeholder="Ví dụ: <br>"
                                                    value={editingScript.trimStrings?.join('\n') || ''} 
                                                    onChange={e => setEditingScript({...editingScript, trimStrings: e.target.value.split('\n')})} 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT COLUMN - LIVE STAGING (SCOPE, TESTER & ASSISTANT) */}
                                    <div className="flex flex-col w-full lg:max-w-md bg-slate-950/25">
                                        <div className="p-6 space-y-5.5 border-b border-slate-800/80">
                                            
                                            {/* SCOPES CHECKBOX CHIPS */}
                                            <div className="space-y-2.5">
                                                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-800/80 pb-1.5 select-none font-sans">Vị Trí Áp Dụng (Scope Placement)</h4>
                                                <div className="grid grid-cols-2 gap-1.5 select-none">
                                                    {[
                                                        {v: 1, l: 'User Messages'},
                                                        {v: 2, l: 'Character Messages'},
                                                        {v: 3, l: 'Slash Command'},
                                                        {v: 4, l: 'World Info'},
                                                        {v: 5, l: 'Thinking Reasoning'}
                                                    ].map(p => (
                                                        <label key={p.v} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${editingScript.placement?.includes(p.v) ? 'bg-sky-500/10 border-sky-500/40 text-sky-300' : 'bg-slate-950 border-slate-900/60 text-slate-400 hover:border-slate-800'}`}>
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-950 border-slate-800" 
                                                                checked={editingScript.placement?.includes(p.v) || false} 
                                                                onChange={e => {
                                                                    const arr = editingScript.placement || [];
                                                                    setEditingScript({
                                                                        ...editingScript, 
                                                                        placement: e.target.checked ? [...arr, p.v] : arr.filter(x => x !== p.v)
                                                                    });
                                                                }}
                                                            /> 
                                                            <span className="text-[10px] font-bold">{p.l}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* EXECUTION TIMING SHIELD */}
                                            <div className="space-y-2.5 select-none">
                                                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-800/80 pb-1.5 font-sans">Thời Điểm Xử Lý (Execution)</h4>
                                                <div className="space-y-1.5 bg-slate-900/20 p-2 border border-slate-800/30 rounded-xl">
                                                    <label className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors">
                                                        <input type="checkbox" checked={editingScript.markdownOnly || false} onChange={e => setEditingScript({...editingScript, markdownOnly: e.target.checked})} className="mt-0.5 w-3.5 h-3.5 rounded text-sky-500 bg-slate-950"/> 
                                                        <div>
                                                            <p className="text-[11px] font-bold text-slate-200">On Display</p>
                                                            <p className="text-[9.5px] text-slate-500">Áp dụng trực tiếp khi vẽ tin nhắn chatbox.</p>
                                                        </div>
                                                    </label>
                                                    <label className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors">
                                                        <input type="checkbox" checked={editingScript.promptOnly || false} onChange={e => setEditingScript({...editingScript, promptOnly: e.target.checked})} className="mt-0.5 w-3.5 h-3.5 rounded text-amber-500 bg-slate-950"/> 
                                                        <div>
                                                            <p className="text-[11px] font-bold text-slate-200">On Send</p>
                                                            <p className="text-[9.5px] text-slate-500">Xử lý văn bản trước khi gửi cho mô hình AI.</p>
                                                        </div>
                                                    </label>
                                                    <label className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors">
                                                        <input type="checkbox" checked={editingScript.runOnEdit || false} onChange={e => setEditingScript({...editingScript, runOnEdit: e.target.checked})} className="mt-0.5 w-3.5 h-3.5 rounded text-emerald-500 bg-slate-950"/> 
                                                        <div>
                                                            <p className="text-[11px] font-bold text-slate-200">Receive and Edit</p>
                                                            <p className="text-[9.5px] text-slate-500">Chạy liên hồi cả khi chỉnh sửa tin nhắn cũ.</p>
                                                        </div>
                                                    </label>
                                                    <label className="flex items-start gap-2 p-1.5 rounded-lg bg-rose-500/5 border border-dashed border-rose-500/10 cursor-pointer transition-colors">
                                                        <input type="checkbox" checked={editingScript.forceIframe || false} onChange={e => setEditingScript({...editingScript, forceIframe: e.target.checked})} className="mt-0.5 w-3.5 h-3.5 rounded text-rose-500 bg-slate-950"/> 
                                                        <div>
                                                            <p className="text-[11px] font-bold text-rose-400">Cô lập Sandbox iFrame</p>
                                                            <p className="text-[9.5px] text-slate-400">Ép buộc nhét kết quả vào iframe riêng để tránh xung đột mã css.</p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* DEPTH RANGE LIMITS */}
                                            <div className="grid grid-cols-2 gap-3.5">
                                                <div className="space-y-1 bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-xl">
                                                    <label className="text-[9.5px] font-extrabold uppercase text-slate-550 block select-none">Min Depth Context</label>
                                                    <input 
                                                        type="number" 
                                                        placeholder="0 = Mới nhất" 
                                                        className="w-full p-2 text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-250 outline-none" 
                                                        value={(editingScript.minDepth === null || editingScript.minDepth === undefined || isNaN(editingScript.minDepth as any)) ? '' : editingScript.minDepth} 
                                                        onChange={e => setEditingScript({...editingScript, minDepth: e.target.value === '' ? null : Number(e.target.value)})} 
                                                    />
                                                </div>
                                                <div className="space-y-1 bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-xl">
                                                    <label className="text-[9.5px] font-extrabold uppercase text-slate-550 block select-none">Max Depth Context</label>
                                                    <input 
                                                        type="number" 
                                                        placeholder="Sâu nhất (null)" 
                                                        className="w-full p-2 text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-250 outline-none" 
                                                        value={(editingScript.maxDepth === null || editingScript.maxDepth === undefined || isNaN(editingScript.maxDepth as any)) ? '' : editingScript.maxDepth} 
                                                        onChange={e => setEditingScript({...editingScript, maxDepth: e.target.value === '' ? null : Number(e.target.value)})} 
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 select-none">
                                                <label className="text-[10px] font-extrabold uppercase text-slate-400 font-sans">Mẫu chuyển đổi Macro Template</label>
                                                <select className="w-full p-2.5 text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-250 outline-none" value={editingScript.substituteRegex || 0} onChange={e => setEditingScript({...editingScript, substituteRegex: Number(e.target.value)})}>
                                                    <option value={0}>0 - Không áp dụng thay thế thô</option>
                                                    <option value={1}>1 - Thay thế thô các thẻ SillyTavern</option>
                                                    <option value={2}>2 - Thay thế thẻ an toàn ký tự đặc biệt</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* AI REGEX DEBUGGER & SIMULATION UNIT */}
                                        <div className="flex flex-col h-[50vh] min-h-[480px] bg-slate-950/80">
                                            {/* SIMULATION AND MATCH SCREEN-MOCK PREVIEW */}
                                            <div className="p-4 bg-slate-950 border-b border-slate-800/85">
                                                <div className="space-y-2.5">
                                                    <div>
                                                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-sans flex items-center gap-1.5 select-none">
                                                            <Laptop size={11} className="text-slate-400" /> Interactive Simulator
                                                        </span>
                                                        <textarea 
                                                            className="w-full p-2 mt-1.5 text-xs bg-slate-900 rounded border border-slate-800/80 h-[40px] outline-none resize-none text-slate-300 custom-scrollbar shadow-inner font-sans leading-tight" 
                                                            value={testInput} 
                                                            onChange={e => setTestInput(e.target.value)} 
                                                            placeholder="Viết mẩu nội dung giả lập để test biểu thức regex bên dưới..."
                                                        />
                                                    </div>
                                                    
                                                    {/* Smart view window mockup frame */}
                                                    <div className="flex flex-col min-h-0">
                                                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#94a3b8] font-mono select-none block mb-1">Cấu trúc hiển thị HTML Rendered</span>
                                                        <div className="p-1.5 bg-slate-900 rounded-xl border border-slate-800/60 overflow-hidden shadow-inner flex flex-col justify-end">
                                                            <iframe 
                                                                className="w-full h-[52px] bg-slate-950 border-none overflow-y-auto custom-scrollbar" 
                                                                sandbox=""
                                                                srcDoc={`<html><head><style>body { margin: 0; padding: 4px; font-family: ui-sans-serif, system-ui, sans-serif, 'Lora', serif; color: #cbd5e1; font-size: 11px; word-break: break-all; white-space: pre-wrap; }</style></head><body>${renderPreviewHTML(runRegexScript(editingScript, testInput || ' ', { userName: playerName || 'User', charName: charName || 'Character' }) || testInput)}</body></html>`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ASSISTANT SHELL INTEGRATED CHAT */}
                                            <div className="flex flex-col flex-1 min-h-0 bg-slate-950/30 overflow-hidden relative">
                                                
                                                {/* Header banner */}
                                                <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-900 bg-slate-950 select-none">
                                                    <span className="text-[10px] font-extrabold tracking-wider text-sky-450 uppercase flex items-center gap-1.5">
                                                        <Bot size={13} className="text-sky-500 animate-bounce" /> Scribe AI Assistant
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            type="button"
                                                            onClick={() => askAiAssistant("Hãy phân tích xem Regex Pattern của tôi có vấn đề gì về cú pháp, cú pháp escape hay logic không.")}
                                                            className="text-[9px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded transition-all font-sans cursor-pointer font-bold"
                                                            disabled={isAiLoading}
                                                        >
                                                            🛡️ Check lỗi
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => askAiAssistant("Giải thích chi tiết các nhóm gom cụm (groups) và cách thức hoạt giải hóa mẫu regex này.")}
                                                            className="text-[9px] bg-slate-900 border border-slate-800 text-slate-350 hover:bg-slate-800 hover:text-white px-2 py-0.5 rounded transition-all font-sans cursor-pointer font-bold"
                                                            disabled={isAiLoading}
                                                        >
                                                            📋 Giải thích
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setAiChat([]);
                                                                askAiAssistant("Hãy phân tích lại và tư vấn tối ưu nhé.", true);
                                                            }}
                                                            className="text-[9px] text-slate-500 hover:text-slate-200 border border-transparent hover:border-slate-800 px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5 cursor-pointer font-sans font-bold"
                                                            title="Từ đầu"
                                                        >
                                                            <RefreshCw size={10} /> Reset
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* dialogue core scrollbar */}
                                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3.5 bg-slate-900/10">
                                                    {aiChat.length === 0 && (
                                                        <div className="text-center text-slate-650 py-12 text-xs font-sans">
                                                            <Loader2 className="animate-spin text-sky-500 mx-auto mb-2 opacity-50" size={20} />
                                                            Đang mời AI gỡ lỗi phân tích cú pháp quy tắc...
                                                        </div>
                                                    )}

                                                    {aiChat.map((msg, idxMatch) => {
                                                        const isUser = msg.role === 'user';
                                                        return (
                                                            <div key={idxMatch} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}>
                                                                <span className="text-[8.5px] text-slate-600 mb-0.5 tracking-widest font-mono uppercase">
                                                                    {isUser ? 'DEVELOPER' : 'AI CO-PILOT'}
                                                                </span>
                                                                <div className={`rounded-xl p-3 text-[11px] max-w-[92%] leading-relaxed ${
                                                                    isUser 
                                                                        ? 'bg-sky-500/15 border border-sky-500/20 text-sky-100 font-sans' 
                                                                        : 'bg-[#151c2d]/90 border border-slate-800/80 text-slate-200 font-sans shadow-md'
                                                                }`}>
                                                                    {isUser ? (
                                                                        <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                                                                    ) : (
                                                                        <div className="prose prose-sm prose-invert max-w-none space-y-1 font-sans text-slate-300">
                                                                            <MarkdownRenderer content={msg.text} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {isAiLoading && (
                                                        <div className="flex items-start select-none">
                                                            <div className="bg-[#151c2d]/40 border border-slate-800/40 rounded-xl p-3 text-[11px] text-slate-400 flex items-center gap-2">
                                                                <Loader2 className="animate-spin text-sky-400" size={12} />
                                                                <span className="font-mono">AI đang gỡ rối và cải tiến kịch bản...</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {aiError && (
                                                        <div className="p-2.5 bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-sans font-medium">
                                                            ⚠️ {aiError}
                                                        </div>
                                                    )}
                                                    <div ref={aiChatBottomRef} />
                                                </div>

                                                {/* Submit Form */}
                                                <form 
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        askAiAssistant();
                                                    }}
                                                    className="p-2 border-t border-slate-900 bg-slate-950 flex gap-2 shrink-0 items-center select-none"
                                                >
                                                    <input 
                                                        type="text"
                                                        value={aiInput}
                                                        onChange={e => setAiInput(e.target.value)}
                                                        placeholder="Mô tả sự cố hoặc yêu cầu AI tối ưu cú pháp..."
                                                        className="flex-1 bg-slate-900 border border-slate-800 focus:border-sky-500/60 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-sans"
                                                        disabled={isAiLoading}
                                                    />
                                                    <button 
                                                        type="submit"
                                                        className="h-8 w-8 rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
                                                        disabled={isAiLoading || !aiInput.trim()}
                                                    >
                                                        <Send size={12} className="stroke-[2.5]" />
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER ACTION PANEL */}
                            <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/80 select-none flex justify-between items-center shrink-0 shadow-2xl relative z-10">
                                <button className="px-5 py-2 font-bold rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all text-xs border border-transparent hover:border-slate-800/40 cursor-pointer" onClick={() => setIsEditorOpen(false)}>Quay lại</button>
                                <button className="px-6 py-2.5 font-sans font-extrabold rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 transition-all text-xs flex items-center gap-2 cursor-pointer shadow-lg active:scale-98" onClick={saveEditor}>
                                    <Play size={13} className="fill-slate-950 stroke-[0.5]" /> Đồng Bộ Quyết Định
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RegexScriptsManager;
