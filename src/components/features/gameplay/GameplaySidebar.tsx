import React, { useState, useEffect } from 'react';
import { User, Globe, History, ImageIcon, Terminal, Zap, ToggleRight, ToggleLeft, Database, Settings, Save, LogOut, Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronsUp, ChevronsDown, RefreshCw, Bug, Edit2, ChevronUp, ChevronDown, Sparkles, Heart, Compass, Shield, Brain, Calendar, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorldData, AppSettings, ChatMessage } from '../../../types';
import Button from '../../ui/Button';
import TawaPresetManager from './components/TawaPresetManager';
import WorldInfoSidebar from './components/WorldInfoSidebar';
import { Mem0Sidebar } from './components/Mem0Sidebar';
import StoryBibleSidebar from './components/StoryBibleSidebar';
import { dbService } from '../../../services/db/indexedDB';

import ContextWindowModal from './modals/ContextWindowModal';

interface GameplaySidebarProps {
    activeWorld: WorldData;
    history: ChatMessage[];
    MESSAGES_PER_PAGE: number;
    setShowCharModal: (v: boolean) => void;
    setShowGlobalModal: (v: boolean) => void;
    setShowHistoryModal: (v: boolean) => void;
    setShowImageLibrary: (v: boolean) => void;
    setShowLogConsole: (v: boolean) => void;
    setShowContextModal: (v: boolean) => void;
    showRuleModal?: boolean;
    setShowRuleModal?: (v: boolean) => void;
    setShowRegexModal: (v: boolean) => void;
    setShowCalendarModal: (v: boolean) => void;
    setShowStoryDebugModal: (v: boolean) => void;
    setShowFateSettingsModal?: (v: boolean) => void;
    isInputCollapsed: boolean;
    setIsInputCollapsed: (v: boolean) => void;
    currentPage: number;
    setCurrentPage: (v: number) => void;
    scrollToTop: () => void;
    scrollToBottom: () => void;
    settings: AppSettings | null;
    toggleStreamResponse: () => void;
    onUpdateWorld?: (updates: Partial<WorldData>) => void;
    handleTawaConfigChange: (config: any) => void;
    isLoading: boolean;
    handleRegenerate: (idx: number) => void;
    handleGoToSettings: () => void;
    handleManualSave: () => void;
    isSaving: boolean;
    handleExit: () => void;
    AIMonitor: React.FC;
    activeSidebarTab?: 'main' | 'rules';
    setActiveSidebarTab?: (v: 'main' | 'rules') => void;
    handleUpdateContextConfig?: (config: any) => void;
    turnCount?: number;
    tawaPresetConfig?: any;
    gameTime?: any;
    lastAction?: string;
    dynamicRules?: string[];
    setDynamicRules?: (rules: string[]) => void;
}

export const GameplaySidebar: React.FC<GameplaySidebarProps> = ({
    activeWorld, history, MESSAGES_PER_PAGE, setShowCharModal, setShowGlobalModal, setShowHistoryModal, setShowImageLibrary, setShowLogConsole, setShowContextModal, showRuleModal, setShowRuleModal, setShowRegexModal, setShowCalendarModal, setShowStoryDebugModal, setShowFateSettingsModal,
    isInputCollapsed, setIsInputCollapsed, currentPage, setCurrentPage, scrollToTop, scrollToBottom, settings, toggleStreamResponse, onUpdateWorld, handleTawaConfigChange,
    isLoading, handleRegenerate, handleGoToSettings, handleManualSave, isSaving, handleExit, AIMonitor,
    activeSidebarTab = 'main', setActiveSidebarTab,
    handleUpdateContextConfig, turnCount = 0, tawaPresetConfig = null, gameTime, lastAction = '', dynamicRules = [], setDynamicRules
}) => {
    const totalPages = history.length <= 11 ? 1 : 1 + Math.ceil((history.length - 11) / MESSAGES_PER_PAGE);
    
    // Character Profile interactive states
    const [isCardExpanded, setIsCardExpanded] = useState(false);
    const [sidebarCardTab, setSidebarCardTab] = useState<'status' | 'traits' | 'story'>('status');
    const [isQuickEditing, setIsQuickEditing] = useState(false);
    const [editName, setEditName] = useState(activeWorld.player.name);
    const [editAge, setEditAge] = useState(activeWorld.player.age);
    const [editGender, setEditGender] = useState(activeWorld.player.gender);
    const [editMood, setEditMood] = useState(activeWorld.player.currentMood || '');
    const [editGoal, setEditGoal] = useState(activeWorld.player.goal || '');
    const [editCustomFields, setEditCustomFields] = useState<{ label: string; value: string }[]>([]);

    useEffect(() => {
        setEditName(activeWorld.player.name);
        setEditAge(activeWorld.player.age);
        setEditGender(activeWorld.player.gender);
        setEditMood(activeWorld.player.currentMood || '');
        setEditGoal(activeWorld.player.goal || '');
        setEditCustomFields(activeWorld.player.customFields || []);
    }, [activeWorld.player]);

    
    return (
        <div className="h-full flex flex-col bg-stone-300 dark:bg-[#090f1d] shadow-xl">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-3 min-h-0">
                    <div className="p-2.5 neu-sm-inset rounded-2xl space-y-2.5 border-none mb-1">
                {/* Interactive Premium Character Card */}
                <div className="neu-flat rounded-xl p-4 transition-all duration-300 relative overflow-hidden group-card-hud border-none">
                    {/* Glowing effect inside card */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-mystic-accent/15 to-transparent rounded-full blur-2xl pointer-events-none" />
                    
                    {!isQuickEditing ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                {/* Avatar Frame with glowing gradient */}
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-mystic-accent to-indigo-500 rounded-full blur opacity-30 group-hover:opacity-75 transition duration-500 animate-pulse"></div>
                                    <button 
                                        onClick={() => setShowCharModal(true)}
                                        className="relative w-14 h-14 rounded-full bg-stone-300 dark:bg-slate-950 border-2 border-white dark:border-slate-800 overflow-hidden flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform shadow-md"
                                        title="Xem hồ sơ chi tiết"
                                    >
                                        {activeWorld.player.avatar ? (
                                            <img src={activeWorld.player.avatar} alt={activeWorld.player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <User className="text-mystic-accent" size={24}/>
                                        )}
                                    </button>
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-mystic-accent text-[8px] font-bold border-2 border-stone-100 dark:border-slate-900 px-1 py-0.5 rounded-full flex items-center justify-center text-white scale-90 shadow-md">
                                        PC
                                    </div>
                                </div>

                                {/* Name & Quick Stats */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <h4 
                                            className="font-extrabold text-stone-900 dark:text-slate-100 text-sm leading-tight truncate hover:text-mystic-accent transition-colors cursor-pointer flex items-center gap-1" 
                                            onClick={() => setShowCharModal(true)}
                                        >
                                            {activeWorld.player.name}
                                            <Sparkles size={11} className="text-mystic-accent shrink-0 animate-pulse" />
                                        </h4>
                                        <button 
                                            onClick={() => setIsQuickEditing(true)} 
                                            className="p-1 rounded-md text-stone-500 hover:text-mystic-accent hover:bg-stone-300/70 dark:hover:bg-slate-800/80 transition-colors"
                                            title="Sửa nhanh thông tin"
                                        >
                                            <Edit2 size={11} />
                                        </button>
                                    </div>
                                    
                                    {/* Badges */}
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        <span className="text-[8px] font-bold uppercase py-0.5 px-2 bg-mystic-accent/10 text-mystic-accent border border-mystic-accent/20 rounded-md">
                                            {activeWorld.player.gender || "Chưa rõ"}
                                        </span>
                                        <span className="text-[8px] font-mono py-0.5 px-2 bg-stone-350 dark:bg-slate-950 text-stone-600 dark:text-slate-300 border-none rounded-md shadow-inner">
                                            {activeWorld.player.age ? `${activeWorld.player.age} tuổi` : "- tuổi"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Tabbed Hub within Card */}
                            <div className="mt-2.5 text-slate-400 flex gap-1 p-1 bg-stone-300 dark:bg-slate-950 neu-sm-inset rounded-xl border-none">
                                {[
                                    { id: 'status', label: 'Chỉ số', icon: Heart },
                                    { id: 'traits', label: 'Tính chất', icon: Brain },
                                    { id: 'story', label: 'Cốt chuyện', icon: Compass }
                                ].map((tb) => {
                                    const Icon = tb.icon;
                                    const isActive = sidebarCardTab === tb.id;
                                    return (
                                        <button
                                            key={tb.id}
                                            onClick={() => {
                                                setSidebarCardTab(tb.id as any);
                                                setIsCardExpanded(true); // Automatically expand when exploring tabs
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                                                isActive 
                                                    ? 'neu-sm-flat text-mystic-accent font-black border-none' 
                                                    : 'text-stone-600 dark:text-slate-500 hover:text-mystic-accent font-bold'
                                            }`}
                                        >
                                            <Icon size={9} />
                                            <span>{tb.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Brief View / Content Switch */}
                            <div className="space-y-2">
                                {sidebarCardTab === 'status' && (
                                    <div className="space-y-2.5 pt-1">
                                        {/* Mental health / Mood Bar */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-stone-500 dark:text-slate-400 font-extrabold flex items-center gap-1">
                                                    <Heart size={10} className="text-red-500 animate-pulse" /> Trạng thái tâm lý
                                                </span>
                                                <span className="text-stone-800 dark:text-slate-200 font-mono italic font-bold">
                                                    {activeWorld.player.currentMood || "Bình thường"}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-stone-300 dark:bg-slate-950 rounded-full overflow-hidden border border-stone-400/10 dark:border-slate-800">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-emerald-500 via-mystic-accent to-pink-500 transition-all duration-500"
                                                    style={{ 
                                                        width: activeWorld.player.currentMood ? '75%' : '90%' 
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Sức mạnh ý chí (生存意志) */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-stone-500 dark:text-slate-400 font-extrabold flex items-center gap-1">
                                                    <Shield size={10} className="text-sky-400" /> Ý chí sinh tồn
                                                </span>
                                                <span className="text-stone-800 dark:text-slate-200 font-mono font-bold">
                                                    95%
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-stone-300 dark:bg-slate-950 rounded-full overflow-hidden border border-stone-400/10 dark:border-slate-800">
                                                <div className="h-full bg-sky-500 transition-all duration-300 w-[95%]" />
                                            </div>
                                        </div>

                                        {/* Custom Character Schema / thăng tiến dần */}
                                        {activeWorld.player.customFields && activeWorld.player.customFields.length > 0 && (
                                            <div className="mt-2.5 pt-2 border-t border-stone-350 dark:border-slate-800/60 space-y-1.5">
                                                <div className="text-[9px] font-black uppercase text-mystic-accent tracking-wider flex items-center gap-1 font-mono">
                                                    <Sparkles size={9} /> BỘ CHỈ SỐ SƠ ĐỒ / THĂNG TIẾN
                                                </div>
                                                <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {activeWorld.player.customFields.map((cf, i) => (
                                                        <div key={i} className="flex justify-between items-center bg-stone-300/40 dark:bg-slate-950/40 px-2 py-1.5 rounded-lg border border-stone-400/10 dark:border-slate-850">
                                                            <span className="text-[9.5px] font-bold text-stone-605 dark:text-slate-400 truncate mr-2" title={cf.label}>
                                                                {cf.label}
                                                            </span>
                                                            <span className="text-[10px] font-mono font-black text-stone-850 dark:text-slate-200 bg-stone-300/60 dark:bg-slate-900/60 px-1.5 py-0.5 rounded border border-stone-400/10 dark:border-slate-800 shrink-0">
                                                                {cf.value || "-"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {sidebarCardTab === 'traits' && (
                                    <div className="space-y-2 text-[10.5px]">
                                        <div className="bg-stone-300/30 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/15 dark:border-slate-800/50">
                                            <span className="text-[9px] font-bold text-mystic-accent uppercase block mb-1">Ngoại hình đặc trưng</span>
                                            <p className="text-stone-700 dark:text-slate-300 leading-normal truncate font-sans">
                                                {activeWorld.player.appearance || "Chưa thiết lập ngoại hình cụ thể."}
                                            </p>
                                        </div>
                                        <div className="bg-stone-300/30 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/15 dark:border-slate-800/50">
                                            <span className="text-[9px] font-bold text-pink-400 uppercase block mb-1">Cá tính đặc trưng</span>
                                            <p className="text-stone-700 dark:text-slate-300 leading-normal truncate font-sans">
                                                {activeWorld.player.personality || "Chưa thiết lập cá tính cụ thể."}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {sidebarCardTab === 'story' && (
                                    <div className="space-y-2 text-[10.5px] pt-1">
                                        <div className="flex items-start gap-1 p-1">
                                            <span className="font-extrabold text-stone-500 dark:text-slate-400 shrink-0 w-14">Mục tiêu:</span>
                                            <span className="text-stone-700 dark:text-slate-200 truncate flex-1 font-medium italic" title={activeWorld.player.goal}>
                                                {activeWorld.player.goal || "Chưa xác định"}
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-1 p-1">
                                            <span className="font-extrabold text-stone-500 dark:text-slate-400 shrink-0 w-14">Vai trò:</span>
                                            <span className="text-stone-700 dark:text-slate-200 truncate flex-1 font-mono uppercase tracking-wider text-[9.5px] text-indigo-400">
                                                {activeWorld.player.narrativeRole || "Protagonist (Nhân vật Chính)"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Details Expand Window */}
                            <AnimatePresence>
                                {isCardExpanded && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden space-y-2 pt-2 border-t border-stone-400/40 dark:border-slate-800/60 max-h-48 overflow-y-auto custom-scrollbar"
                                    >
                                        {sidebarCardTab === 'status' && (
                                            <div className="space-y-2">
                                                {activeWorld.player.skills && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Kỹ năng đặc biệt</span>
                                                        <p className="text-[10px] text-stone-600 dark:text-slate-400 bg-stone-300/40 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/10 dark:border-slate-800/60 leading-normal whitespace-pre-wrap font-sans">
                                                            {activeWorld.player.skills}
                                                        </p>
                                                    </div>
                                                )}
                                                {activeWorld.player.voiceAndTone && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-400">Giọng điệu / Văn phong</span>
                                                        <p className="text-[10px] text-stone-600 dark:text-slate-400 bg-stone-300/40 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/10 dark:border-slate-800/60 leading-normal whitespace-pre-wrap font-sans">
                                                            {activeWorld.player.voiceAndTone}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {sidebarCardTab === 'traits' && (
                                            <div className="space-y-2">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-mystic-accent">Chi tiết ngoại hình</span>
                                                    <p className="text-[10px] text-stone-600 dark:text-slate-400 bg-stone-300/40 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/10 dark:border-slate-800/60 leading-normal whitespace-pre-wrap font-sans">
                                                        {activeWorld.player.appearance || "Trống."}
                                                    </p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-pink-400">Chi tiết tính cách</span>
                                                    <p className="text-[10px] text-stone-600 dark:text-slate-400 bg-stone-300/40 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/10 dark:border-slate-800/60 leading-normal whitespace-pre-wrap font-sans">
                                                        {activeWorld.player.personality || "Trống."}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {sidebarCardTab === 'story' && (
                                            <div className="space-y-2">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">Mục tiêu cốt lõi</span>
                                                    <p className="text-[10px] text-stone-600 dark:text-slate-400 bg-stone-300/40 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/10 dark:border-slate-800/60 leading-normal whitespace-pre-wrap font-sans">
                                                        {activeWorld.player.goal || "Chưa xác định mục tiêu."}
                                                    </p>
                                                </div>
                                                {activeWorld.player.background && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">Lý lịch / Background</span>
                                                        <p className="text-[10px] text-stone-600 dark:text-slate-400 bg-stone-300/40 dark:bg-slate-950/40 p-2 rounded-xl border border-stone-400/10 dark:border-slate-800/60 leading-normal whitespace-pre-wrap font-sans">
                                                            {activeWorld.player.background}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Details Toggle Button */}
                            <div className="pt-1 flex justify-center">
                                <button 
                                    onClick={() => setIsCardExpanded(!isCardExpanded)}
                                    className="w-full flex items-center justify-center gap-1 py-1 text-[9px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider bg-stone-300/40 dark:bg-slate-950/50 hover:bg-stone-300/80 dark:hover:bg-slate-800/80 rounded-lg border border-stone-400/30 dark:border-slate-800/50 transition-all font-mono shadow-sm"
                                >
                                    {isCardExpanded ? (
                                        <>Thu gọn <ChevronUp size={10} /></>
                                    ) : (
                                        <>Mở rộng Chi tiết <ChevronDown size={10} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Sửa Nhanh Panel */
                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-stone-400/40 dark:border-slate-800/60 pb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-mystic-accent flex items-center gap-1 font-mono">
                                    <Edit2 size={10} /> Sửa nhanh nhân vật
                                </span>
                                <button 
                                    onClick={() => setIsQuickEditing(false)}
                                    className="text-[10px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-slate-200"
                                >
                                    Đóng
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                <div>
                                    <label className="text-[8.5px] uppercase tracking-wider text-stone-500 dark:text-slate-500 block mb-1">Họ và Tên</label>
                                    <input 
                                        type="text" 
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full text-xs p-2 bg-stone-300/50 dark:bg-slate-950 border border-stone-405 dark:border-slate-800 rounded-xl text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent font-sans"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[8.5px] uppercase tracking-wider text-stone-500 dark:text-slate-500 block mb-1">Giới tính</label>
                                        <input 
                                            type="text" 
                                            value={editGender}
                                            onChange={(e) => setEditGender(e.target.value)}
                                            className="w-full text-xs p-2 bg-stone-300/50 dark:bg-slate-950 border border-stone-405 dark:border-slate-800 rounded-xl text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[8.5px] uppercase tracking-wider text-stone-500 dark:text-slate-500 block mb-1">Tuổi</label>
                                        <input 
                                            type="text" 
                                            value={editAge}
                                            onChange={(e) => setEditAge(e.target.value)}
                                            className="w-full text-xs p-2 bg-stone-300/50 dark:bg-slate-950 border border-stone-405 dark:border-slate-800 rounded-xl text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[8.5px] uppercase tracking-wider text-stone-500 block mb-1">Tâm trạng</label>
                                    <input 
                                        type="text" 
                                        value={editMood}
                                        onChange={(e) => setEditMood(e.target.value)}
                                        placeholder="Bình thường, mệt mỏi..."
                                        className="w-full text-xs p-2 bg-stone-300/50 dark:bg-slate-950 border border-stone-405 dark:border-slate-800 rounded-xl text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                    />
                                </div>

                                <div>
                                    <label className="text-[8.5px] uppercase tracking-wider text-stone-500 block mb-1">Mục tiêu cốt truyện</label>
                                    <textarea 
                                        value={editGoal}
                                        onChange={(e) => setEditGoal(e.target.value)}
                                        placeholder="Mục tiêu hiện tại..."
                                        rows={2}
                                        className="w-full text-xs p-2 bg-stone-300/50 dark:bg-slate-950 border border-stone-405 dark:border-slate-800 rounded-xl text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent resize-none custom-scrollbar font-sans"
                                    />
                                </div>

                                {editCustomFields.length > 0 && (
                                    <div className="space-y-1.5 pt-2 border-t border-stone-400/30 dark:border-slate-800/60 mt-1">
                                        <span className="text-[8.5px] uppercase tracking-wider text-stone-500 dark:text-slate-500 font-bold block">
                                            Chỉ số Sơ đồ (Custom Schema)
                                        </span>
                                        <div className="grid grid-cols-1 gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                            {editCustomFields.map((cf, idx) => (
                                                <div key={idx} className="flex justify-between items-center gap-2 bg-stone-300/30 dark:bg-slate-950/20 px-2 py-1.5 rounded-lg border border-stone-400/10 dark:border-slate-855">
                                                    <span className="text-[9px] font-bold text-stone-605 dark:text-slate-400 truncate w-24">{cf.label}</span>
                                                    <input 
                                                        type="text" 
                                                        value={cf.value}
                                                        onChange={(e) => {
                                                            const next = [...editCustomFields];
                                                            next[idx] = { ...next[idx], value: e.target.value };
                                                            setEditCustomFields(next);
                                                        }}
                                                        className="flex-1 text-[11px] px-2 py-1 bg-white dark:bg-slate-900 border border-stone-400/40 dark:border-slate-800 rounded text-stone-850 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-1.5 flex gap-2">
                                <Button 
                                    className="flex-1 py-1.5 h-9 flex items-center justify-center text-xs bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold border-none transition-all shadow-md cursor-pointer" 
                                    onClick={() => {
                                        if (onUpdateWorld) {
                                            onUpdateWorld({
                                                player: {
                                                    ...activeWorld.player,
                                                    name: editName,
                                                    age: editAge,
                                                    gender: editGender,
                                                    currentMood: editMood,
                                                    goal: editGoal,
                                                    customFields: editCustomFields
                                                }
                                            });
                                        }
                                        setIsQuickEditing(false);
                                    }}
                                >
                                    Lưu Lại
                                </Button>
                                <Button 
                                    variant="ghost"
                                    className="flex-1 py-1.5 h-9 flex items-center justify-center text-xs border border-stone-400 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-stone-100 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer shadow-sm" 
                                    onClick={() => setIsQuickEditing(false)}
                                >
                                    Hủy
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setShowGlobalModal(true)} className="flex items-center gap-2 p-1.5 px-3 text-[10.5px] font-bold text-stone-700 dark:text-slate-300 neu-btn hover:text-green-500 rounded-xl transition-all group shrink-0 border-none">
                        <div className="w-5 h-5 rounded-full bg-stone-100 dark:bg-slate-950 flex items-center justify-center shrink-0 shadow-inner"><Globe className="text-green-600 dark:text-green-400" size={10}/></div>
                        <span className="truncate">Thế giới</span>
                    </button>
                    <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 p-1.5 px-3 text-[10.5px] font-bold text-stone-700 dark:text-slate-300 neu-btn hover:text-blue-500 rounded-xl transition-all group shrink-0 border-none">
                        <div className="w-5 h-5 rounded-full bg-stone-100 dark:bg-slate-950 flex items-center justify-center shrink-0 shadow-inner"><History className="text-blue-600 dark:text-blue-400" size={10}/></div>
                        <span className="truncate">Load Save</span>
                    </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                    <button onClick={() => setShowImageLibrary(true)} className="neu-btn rounded-xl p-1 py-2 gap-1 text-[9px] font-black text-stone-700 dark:text-slate-300 hover:text-mystic-accent border-none transition-all group">
                        <ImageIcon className="text-mystic-accent" size={12}/>
                        <span className="truncate text-[8px] tracking-tight">Ảnh</span>
                    </button>
                    <button onClick={() => setShowLogConsole(true)} className="neu-btn rounded-xl p-1 py-2 gap-1 text-[9px] font-black text-stone-700 dark:text-slate-300 hover:text-mystic-accent border-none transition-all group">
                        <Terminal className="text-mystic-accent" size={12}/>
                        <span className="truncate text-[8px] tracking-tight">Console</span>
                    </button>
                    <button onClick={() => setShowRegexModal(true)} className="neu-btn rounded-xl p-1 py-2 gap-1 text-[9px] font-black text-stone-700 dark:text-slate-300 hover:text-mystic-accent border-none transition-all group">
                        <Settings className="text-indigo-600 dark:text-indigo-400" size={12}/>
                        <span className="truncate text-[8px] tracking-tight">Regex</span>
                    </button>
                    <button onClick={() => setShowCalendarModal(true)} className="neu-btn rounded-xl p-1 py-2 gap-1 text-[9px] font-black text-stone-700 dark:text-slate-300 hover:text-mystic-accent border-none transition-all group" title="Sổ lịch trình 7 ngày">
                        <Calendar className="text-amber-500" size={12}/>
                        <span className="truncate text-[8px] tracking-tight">Lịch trình</span>
                    </button>
                    <button onClick={() => setShowFateSettingsModal?.(true)} className="neu-btn rounded-xl p-1 py-2 gap-1 text-[9px] font-black text-stone-700 dark:text-slate-300 hover:text-mystic-accent border-none transition-all group" title="Cấu hình Xúc xắc Định mệnh D&D">
                        <Dices className="text-orange-500" size={12}/>
                        <span className="truncate text-[8px] tracking-tight">Số phận</span>
                    </button>
                </div>
                <button onClick={() => setShowStoryDebugModal(true)} className="w-full h-9 flex items-center justify-center gap-1.5 p-1 px-4 text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 neu-btn rounded-xl transition-all group text-[10.5px] font-black uppercase tracking-wider border-none">
                    <Bug className="text-cyan-600 dark:text-cyan-400 animate-pulse" size={12}/>
                    <span className="text-cyan-700 dark:text-cyan-400">AI Gỡ Lỗi Chính Văn</span>
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1 space-y-2">
                {/* Mobile Controls Section */}
                <div className="md:hidden p-2 space-y-3 bg-stone-400/20 dark:bg-slate-800/20 rounded-lg border border-stone-400/50 dark:border-slate-700/50 mb-2">
                    <div className="text-[10px] font-bold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <Zap size={12} /> Điều khiển nhanh
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Thử Lại Button */}
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                const lastModelIdx = [...history].reverse().findIndex(m => m.role === 'model');
                                if (lastModelIdx !== -1) {
                                    const actualIdx = history.length - 1 - lastModelIdx;
                                    handleRegenerate(actualIdx);
                                }
                            }} 
                            disabled={isLoading || !history.some(m => m.role === 'model')} 
                            className="h-10 text-[10px] font-bold uppercase tracking-tighter border border-stone-400 dark:border-slate-700 hover:border-mystic-accent/50 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                            Thử Lại
                        </Button>

                        {/* Toggle Input Button */}
                        <button 
                            onClick={() => setIsInputCollapsed(!isInputCollapsed)}
                            className={`h-10 rounded border transition-all flex items-center justify-center gap-2 shadow-sm ${
                                isInputCollapsed 
                                ? 'bg-mystic-accent/10 border-mystic-accent/30 text-mystic-accent' 
                                : 'bg-stone-200 dark:bg-slate-800 border-stone-400 dark:border-slate-700 text-stone-500'
                            }`}
                        >
                            {isInputCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                            <span className="text-[10px] font-bold uppercase">
                                {isInputCollapsed ? 'Mở Rộng' : 'Thu Gọn'}
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        {/* Pagination Group */}
                        <div className="flex items-center h-10 bg-stone-200 dark:bg-slate-800 border border-stone-400 dark:border-slate-700 rounded overflow-hidden flex-1">
                            <button 
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="h-full px-3 text-stone-500 hover:text-mystic-accent disabled:opacity-30 transition-colors border-r border-stone-400 dark:border-slate-700"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <span className="text-[10px] font-bold text-stone-600 dark:text-slate-400 leading-none">
                                    {currentPage}/{totalPages}
                                </span>
                                <span className="text-[7px] uppercase opacity-50 font-bold">Trang</span>
                            </div>
                            <button 
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="h-full px-3 text-stone-500 hover:text-mystic-accent disabled:opacity-30 transition-colors border-l border-stone-400 dark:border-slate-700"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Scroll Controls */}
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={scrollToTop}
                                className="h-10 w-10 flex items-center justify-center rounded bg-stone-200 dark:bg-slate-800 border border-stone-400 dark:border-slate-700 text-stone-500 hover:text-mystic-accent transition-all"
                            >
                                <ChevronsUp size={18} />
                            </button>
                            <button 
                                onClick={scrollToBottom}
                                className="h-10 w-10 flex items-center justify-center rounded bg-stone-200 dark:bg-slate-800 border border-stone-400 dark:border-slate-700 text-stone-500 hover:text-mystic-accent transition-all"
                            >
                                <ChevronsDown size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stream Toggle */}
                <button 
                    onClick={toggleStreamResponse}
                    className="w-full p-2 flex justify-between items-center text-left hover:bg-stone-400 dark:hover:bg-slate-700/50 transition-colors bg-stone-200 dark:bg-slate-800/30 rounded border border-stone-400 dark:border-slate-700 mb-2"
                >
                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-700 dark:text-slate-300">
                         <Zap size={14} className={settings?.streamResponse ? "text-yellow-500 dark:text-yellow-400" : "text-stone-400 dark:text-slate-500"} />
                         Streaming
                    </div>
                    <div className={settings?.streamResponse ? "text-green-600 dark:text-green-400" : "text-stone-300 dark:text-slate-600"}>
                         {settings?.streamResponse ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}
                    </div>
                </button>

                <WorldInfoSidebar 
                   lorebook={activeWorld.lorebook} 
                   onUpdateLorebook={(l) => onUpdateWorld && onUpdateWorld({ lorebook: l })} 
                />
                <Mem0Sidebar activeWorld={activeWorld} settings={settings} />
                <StoryBibleSidebar worldData={activeWorld} />

                {/* ADVANCED RULES BUTTON */}
                <button 
                  onClick={() => setShowRuleModal && setShowRuleModal(true)}
                  className="w-full p-3 flex items-center justify-between text-left transition-all group rounded-xl border-none neu-btn mb-3"
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold text-stone-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors uppercase">
                    <Database size={14} />
                    Advanced Rule
                  </div>
                  <div className="text-[10px] text-stone-600 dark:text-slate-300 font-mono py-0.5 px-2 bg-stone-350 dark:bg-slate-950 border-none rounded shadow-inner font-extrabold">
                    Rules
                  </div>
                </button>
                
                <button 
                  onClick={() => setShowContextModal(true)}
                  className="w-full p-3 flex justify-between items-center text-left transition-all neu-btn rounded-xl border-none group mb-3"
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold text-mystic-accent uppercase">
                    <Database size={14} className="group-hover:scale-110 transition-transform" />
                    Cửa sổ Ngữ cảnh
                  </div>
                  <div className="text-[8px] bg-mystic-accent/20 px-1.5 py-0.5 rounded text-mystic-accent font-bold">Config</div>
                </button>

                <TawaPresetManager 
                  onConfigChange={handleTawaConfigChange} 
                  initialPreset={activeWorld?.config?.tawaPreset}
                  playerName={activeWorld.player?.name || "User"}
                  charName={activeWorld.entities?.[0]?.name || "Character"}
                  activeWorld={activeWorld}
                />
                <AIMonitor />
            </div>
            </div>
            <div className="p-2.5 border-t border-stone-400/20 dark:border-slate-800/10 bg-stone-300 dark:bg-[#090f1d] flex flex-row gap-2 mt-auto shrink-0 shadow-lg">
                <Button variant="ghost" className="flex-1 text-[11px] h-9 px-1 justify-center border-none neu-btn font-mono font-black uppercase text-stone-700 dark:text-slate-300 transition-all" icon={<Settings size={12}/>} onClick={handleGoToSettings} title="Cài đặt hệ thống">Cài đặt</Button>
                <Button variant="outline" className="flex-1 text-[11px] h-9 px-1 justify-center border-none neu-btn font-mono font-black uppercase text-stone-700 dark:text-slate-300 transition-all" icon={<Save size={12}/>} onClick={handleManualSave} isLoading={isSaving} disabled={isLoading} title="Lưu thủ công và tải file (.json)">Lưu</Button>
                <Button variant="danger" className="flex-1 text-[11px] h-9 px-1 justify-center border-none bg-rose-600 dark:bg-rose-950/60 hover:bg-rose-500 hover:text-white text-rose-200 rounded-xl font-mono font-black uppercase transition-all shadow-md" icon={<LogOut size={12}/>} onClick={handleExit} title="Thoát ra Menu chính">Thoát</Button>
            </div>
        </div>
    );
};
