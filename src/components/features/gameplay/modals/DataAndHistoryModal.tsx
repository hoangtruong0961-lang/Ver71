import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, X, History, Save, Clock, Shield, Zap, BookOpen, Trash2 } from 'lucide-react';
import Button from '../../../ui/Button';
import { ChatMessage } from '../../../../types';

interface SaveFile {
    id: string;
    name: string;
    updatedAt: number;
    data?: any;
}

interface DataAndHistoryModalProps {
    show: boolean;
    onClose: () => void;
    activeSaveTab: 'manual' | 'autosave' | 'history' | 'initial';
    setActiveSaveTab: (tab: 'manual' | 'autosave' | 'history' | 'initial') => void;
    isMobile: boolean;
    history: ChatMessage[];
    manualSaveList: SaveFile[];
    autosaveList: SaveFile[];
    initialSaveList: SaveFile[];
    handleLoadSave: (save: SaveFile) => void;
    handleDeleteSave: (id: string) => void;
}

const DataAndHistoryModal: React.FC<DataAndHistoryModalProps> = ({
    show, onClose, activeSaveTab, setActiveSaveTab, isMobile, history,
    manualSaveList, autosaveList, initialSaveList, handleLoadSave, handleDeleteSave
}) => {
    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-sm p-2">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-stone-200/90 dark:bg-mystic-950/90 border border-stone-300 dark:border-slate-800 w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl"
                    >
                        <div className="p-4 border-b border-stone-400 dark:border-slate-800 flex justify-between items-center bg-stone-300/60 dark:bg-slate-900/40">
                            <h2 className="text-lg md:text-xl font-black text-stone-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                                <Database size={22} className="text-mystic-accent"/> Dữ Liệu & Lịch Sử
                            </h2>
                            <button onClick={onClose} className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white p-1.5 rounded hover:bg-stone-400 dark:hover:bg-slate-800 transition-colors">
                                <X size={26} />
                            </button>
                        </div>
                                         {/* Tab Navigation */}
                        <div className="flex bg-stone-300/40 dark:bg-slate-900/40 p-1 md:p-2 gap-2 border-b border-stone-400 dark:border-slate-800">
                            {[
                                { id: 'history', label: 'Cốt truyện', icon: <History size={16} /> },
                                { id: 'manual', label: 'Lưu Thủ Công', icon: <Save size={16} /> },
                                { id: 'autosave', label: 'Lưu Tự Động', icon: <Clock size={16} /> },
                                { id: 'initial', label: 'Khôi Phục', icon: <Shield size={16} /> }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveSaveTab(tab.id as 'manual' | 'autosave' | 'history' | 'initial')}
                                    className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all rounded-xl ${
                                        activeSaveTab === tab.id 
                                        ? 'bg-mystic-accent text-mystic-900 shadow-lg' 
                                        : 'text-stone-500 hover:bg-stone-400/20 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {tab.icon}
                                    <span className="font-bold">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-hidden bg-stone-100/40 dark:bg-mystic-950/40">
                            {activeSaveTab === 'history' ? (
                                <div className="h-full flex flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                        {history.filter(m => m.role === 'model').length === 0 ? (
                                            <div className="text-center text-stone-400 dark:text-slate-500 py-20">
                                                Chưa có tóm tắt cốt truyện.
                                            </div>
                                        ) : (
                                            [...history].filter(m => m.role === 'model').reverse().map((msg, idx) => (
                                                <div key={`${msg.timestamp}-${idx}`} className="bg-stone-300 dark:bg-slate-800/50 p-5 rounded-xl border border-stone-400 dark:border-slate-700 shadow-sm hover:border-blue-500/50 transition-all group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold bg-blue-600/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md uppercase tracking-wider">
                                                                Lượt {msg.turnNumber}
                                                            </span>
                                                            <span className="text-xs text-stone-500 dark:text-slate-500 font-mono">
                                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {msg.userAction && (
                                                        <div className="mb-3 p-2 bg-stone-400/10 dark:bg-slate-900/30 rounded border-l-2 border-stone-400 dark:border-slate-700 italic text-sm text-stone-600 dark:text-slate-400">
                                                            "{msg.userAction}"
                                                        </div>
                                                    )}

                                                    <div className="text-base text-stone-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                                        {msg.incrementalSummary || <span className="text-stone-400 italic">Không có tóm tắt.</span>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        {(activeSaveTab === 'manual' ? manualSaveList : activeSaveTab === 'autosave' ? autosaveList : initialSaveList).length === 0 ? (
                                            <div className="text-center text-stone-400 dark:text-slate-500 py-20">
                                                Chưa có tệp lưu {activeSaveTab === 'manual' ? 'thủ công' : activeSaveTab === 'autosave' ? 'tự động' : 'lượt 0'}.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 animate-fadeIn">
                                                {(activeSaveTab === 'manual' ? manualSaveList : activeSaveTab === 'autosave' ? autosaveList : initialSaveList).map((save: SaveFile) => (
                                                    <div 
                                                        key={save.id} 
                                                        className="bg-stone-300 dark:bg-slate-800/50 p-5 md:p-6 rounded-2xl border border-stone-400 dark:border-slate-700 shadow-sm hover:border-mystic-accent transition-all group flex flex-col gap-5 justify-between"
                                                    >
                                                        <div className="flex-1">
                                                            <h4 className="text-sm sm:text-base md:text-lg font-black text-stone-800 dark:text-slate-200 mb-2 group-hover:text-mystic-accent transition-colors tracking-wide leading-snug">
                                                                {save.name}
                                                            </h4>
                                                            <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-stone-500 dark:text-slate-500 font-semibold">
                                                                <span className="flex items-center gap-1.5"><Clock size={13}/> {new Date(save.updatedAt).toLocaleString()}</span>
                                                                <span className="opacity-45">|</span>
                                                                <span className="flex items-center gap-1.5"><Zap size={13}/> Lượt: {save.data?.savedState?.turnCount || 0}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex gap-3 pt-3 border-t border-stone-400/30 dark:border-slate-800/50">
                                                            <Button 
                                                                variant="primary" 
                                                                size="lg" 
                                                                onClick={() => handleLoadSave(save)}
                                                                className="flex-1 h-11 md:h-12 text-xs md:text-sm font-black uppercase tracking-widest shadow-lg shadow-mystic-accent/10 rounded-xl"
                                                                icon={<BookOpen size={16} />}
                                                            >
                                                                Tải Dữ Liệu
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="lg" 
                                                                onClick={() => handleDeleteSave(save.id)}
                                                                className="h-11 md:h-12 px-4 text-red-500 hover:bg-red-500/10 border border-stone-400/50 dark:border-slate-700 hover:border-red-500/50 transition-all rounded-xl"
                                                                title="Xóa tệp lưu"
                                                            >
                                                                <Trash2 size={18} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export default DataAndHistoryModal;
