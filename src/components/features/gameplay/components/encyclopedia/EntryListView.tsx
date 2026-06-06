import React from 'react';
import { Search, Plus, BrainCircuit, Type, ChevronRight, Pin, Database, HelpCircle } from 'lucide-react';
import { VectorData } from '../../../../../services/db/indexedDB';

export interface EntryListViewProps {
    entries: VectorData[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: () => void;
    
    searchTerm: string;
    onSearchChange: (val: string) => void;
    
    viewMode: 'keyword' | 'semantic';
    onViewModeChange: (val: 'keyword' | 'semantic') => void;
    
    onSemanticSearch: () => void;
    isSearchingSemantic: boolean;
    
    activeCategoryFilter: string | null;
    onCategoryFilterChange: (cat: string | null) => void;
    
    filteredEntries: VectorData[];
    
    CATEGORY_MAP: any;
    
    renderTool?: () => React.ReactNode;
}

export const EntryListView: React.FC<EntryListViewProps> = ({
    entries, selectedId, onSelect, onAdd,
    searchTerm, onSearchChange,
    viewMode, onViewModeChange,
    onSemanticSearch, isSearchingSemantic,
    activeCategoryFilter, onCategoryFilterChange,
    filteredEntries, CATEGORY_MAP,
    renderTool
}) => {
    return (
        <div id="entry-list-view-root" className="flex flex-col h-full bg-[#0d1220] text-slate-100 border-r border-[#141b2c]/30 relative select-none font-sans p-4">
            <div className="absolute inset-0 bg-repeat bg-center opacity-[0.015] pointer-events-none mix-blend-color-burn" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} />
            
            {/* Top Command Toolbar - Styled with Tactile Neumorphism */}
            <div className="pb-4 shrink-0 space-y-4 bg-[#0d1220] relative z-10">
                
                {/* 2-way Custom Search Mode Toggle */}
                <div className="flex flex-col gap-1.5 shrink-0 text-left">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest font-mono">
                        Mã hóa Truy vết Thần thức
                    </span>
                    {/* Inner Sunken Dock Container */}
                    <div className="flex bg-[#090d18] rounded-xl p-1 w-full border border-[#0d1220]/50 gap-1 shadow-[inset_3px_3px_6px_rgba(3,4,8,0.7),_inset_-3px_-3px_6px_rgba(25,35,58,0.15)]">
                        <button 
                            type="button"
                            onClick={() => onViewModeChange('keyword')} 
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[9px] font-mono font-bold uppercase rounded-lg transition-all whitespace-nowrap ${
                                viewMode === 'keyword' 
                                ? 'bg-[#0d1220] text-sky-400 shadow-[2px_2px_4px_rgba(0,0,0,0.65),_-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#141b2c]/10' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Type size={10} /> Từ khóa cũ
                        </button>
                        <button 
                            type="button"
                            onClick={() => onViewModeChange('semantic')} 
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[9px] font-mono font-bold uppercase rounded-lg transition-all whitespace-nowrap ${
                                viewMode === 'semantic' 
                                ? 'bg-[#0d1220] text-sky-404 shadow-[2px_2px_4px_rgba(0,0,0,0.65),_-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#141b2c]/10' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <BrainCircuit size={10} /> Vector Ý niệm
                        </button>
                    </div>
                </div>

                {/* Sub Search Container */}
                {(viewMode === 'keyword' || viewMode === 'semantic') && (
                    <div className="space-y-3.5 animate-fadeIn">
                        {/* Sunken entry box */}
                        <div className="relative flex gap-2 w-full">
                            <div className="relative flex-1 bg-[#090d18] rounded-xl shadow-[inset_3px_3px_6px_rgba(3,4,8,0.75),_inset_-3px_-3px_5px_rgba(25,35,58,0.15)] border border-[#0d1220]/50 flex items-center px-3.5 py-2">
                                <Search size={13} className="text-sky-400/80 mr-2.5 shrink-0" />
                                <input 
                                    type="text" 
                                    placeholder={viewMode === 'semantic' ? "Ý niệm bối cảnh để quét..." : "Nhập từ khóa lẻ..."}
                                    className="w-full bg-transparent outline-none border-none text-xs text-slate-100 placeholder-slate-500 font-sans transition-all font-medium"
                                    value={searchTerm}
                                    onChange={e => onSearchChange(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && viewMode === 'semantic') onSemanticSearch();
                                    }}
                                />
                            </div>
                            {viewMode === 'semantic' && (
                                <button 
                                    onClick={onSemanticSearch}
                                    disabled={isSearchingSemantic || !searchTerm.trim()}
                                    className="px-3.5 py-2 bg-[#0d1220] text-sky-400 font-bold rounded-xl text-xs shadow-[3px_3px_6px_rgba(3,4,8,0.65),_-3px_-3px_6px_rgba(25,35,58,0.18)] hover:text-sky-305 border border-[#141b2c]/10 active:shadow-inner disabled:opacity-40 transition-all shrink-0 flex items-center justify-center select-none"
                                    title="Quét đối sánh"
                                >
                                    {isSearchingSemantic ? "Quét..." : "Tìm"}
                                </button>
                            )}
                        </div>

                        {/* Staggered category filter list - miniature capsules */}
                        <div className="flex gap-2 pb-1.5 overflow-x-auto custom-scrollbar items-center select-none text-left">
                            <button 
                                type="button"
                                onClick={() => onCategoryFilterChange(null)}
                                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[8px] font-mono font-extrabold uppercase tracking-wider transition-all border ${
                                    activeCategoryFilter === null 
                                    ? 'bg-[#090d18] text-sky-400 border-[#090d18] shadow-[inset_2px_2px_4px_rgba(3,4,8,0.85)]' 
                                    : 'bg-[#0d1220] text-slate-400 border-[#141c30]/15 shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.22)] hover:text-slate-200'
                                }`}
                            >
                                Tất cả
                            </button>
                            {Object.entries(CATEGORY_MAP).map(([catValue, catInfo]: any) => {
                                const isSelected = activeCategoryFilter === catValue;
                                return (
                                    <button 
                                        key={catValue}
                                        type="button"
                                        onClick={() => onCategoryFilterChange(catValue)}
                                        className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[8px] font-mono font-extrabold uppercase tracking-wider transition-all border flex items-center gap-1 ${
                                            isSelected 
                                            ? 'bg-[#090d18] text-sky-400 border-[#090d18] shadow-[inset_2px_2px_4px_rgba(3,4,8,0.85)]' 
                                            : 'bg-[#0d1220] text-slate-400 border-[#141c30]/15 shadow-[2px_2px_4px_rgba(3,4,8,0.6),_-2px_-2px_4px_rgba(25,35,58,0.22)] hover:text-slate-200'
                                        }`}
                                    >
                                        {React.createElement(catInfo.icon, { size: 9 })} {catInfo.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0d1220] relative z-10">
                {(viewMode === 'keyword' || viewMode === 'semantic') ? (
                    <div className="space-y-3">
                        {/* Count bar */}
                        <div className="flex items-center justify-between px-1 py-1 text-left select-none">
                            <span className="text-[9px] font-mono font-bold text-slate-405 tracking-widest uppercase flex items-center gap-1">
                                <Database size={10} className="text-sky-400" /> Danh mục {filteredEntries.length}
                            </span>
                            <button 
                                onClick={onAdd} 
                                className="text-sky-400 bg-[#0d1220] p-1.5 rounded-lg border border-[#141b2c]/15 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-3px_-3px_6px_rgba(25,35,58,0.2)] hover:text-sky-300 active:shadow-inner flex items-center justify-center transition-all" 
                                title="Đăng ký Thư mới"
                            >
                                <Plus size={12} />
                            </button>
                        </div>

                        {/* List entries */}
                        {filteredEntries.length === 0 ? (
                            <div className="text-center text-slate-450 py-16 text-xs flex flex-col items-center gap-3">
                                <div className="p-3 bg-[#0d1220] rounded-[18px] border border-[#141c30]/10 shadow-[3px_3px_6px_rgba(3,4,8,0.6),_-3px_-3px_6px_rgba(25,35,58,0.2)]">
                                    <Search size={18} className="opacity-40 text-sky-400" />
                                </div>
                                <span className="font-mono text-[9px] tracking-widest uppercase font-bold text-slate-500">
                                    {searchTerm ? "Thư tịch chưa mở..." : "Khố tạng rỗng"}
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredEntries.map(entry => {
                                    const isSelected = selectedId === entry.id;
                                    const isEnabled = entry.isEnabled !== false;
                                    const catInfo = CATEGORY_MAP[entry.category || 'world'];
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => onSelect(entry.id)}
                                            className={`w-full text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden flex flex-col gap-1.5 ${
                                                isSelected 
                                                ? 'bg-[#090d18] border-[#090d18] shadow-[inset_3px_3px_6px_rgba(3,4,8,0.8),_inset_-3px_-3px_5px_rgba(25,35,58,0.15)]' 
                                                : 'bg-[#0d1220] border-[#141c30]/15 shadow-[3px_3px_6px_rgba(3,4,8,0.65),_-3px_-3px_6px_rgba(25,35,58,0.22)] hover:border-sky-500/20'
                                            } ${!isEnabled ? 'opacity-40 grayscale' : ''}`}
                                        >
                                            {/* Left glow indicator for selected row */}
                                            {isSelected && (
                                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-sky-500/80 shadow-[1px_0_6px_rgba(56,189,248,0.4)] rounded-r-md"></div>
                                            )}
                                            
                                            {/* Entry title and category ribbon */}
                                            <div className="flex items-center justify-between gap-2 w-full">
                                                <div className="flex items-center gap-1.5 select-none min-w-0 flex-1 font-bold">
                                                    {catInfo && (
                                                        <span className="text-sky-450 shrink-0 opacity-80">
                                                            {React.createElement(catInfo.icon, { size: 10 })}
                                                        </span>
                                                    )}
                                                    <h5 className={`font-sans font-black text-slate-100 tracking-wide capitalize text-xs truncate group-hover:text-sky-305 ${!isEnabled ? 'line-through' : ''}`}>
                                                        {entry.keyword || 'Vô danh thư'}
                                                    </h5>
                                                </div>

                                                <div className="flex gap-1 shrink-0">
                                                    {entry.isSticky && (
                                                        <span className="p-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold text-[7px]" title="Luôn găm">
                                                            <Pin size={6} />
                                                        </span>
                                                    )}
                                                    {entry.triggerMode === 'always' && (
                                                        <span className="px-1 py-0.5 bg-[#090d18] border border-[#141b2c]/20 text-sky-400 rounded font-bold text-[7px] uppercase tracking-wider select-none h-3 leading-none flex items-center justify-center">
                                                            Always
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Content snippet */}
                                            <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed font-semibold">
                                                {entry.category === 'character' ? (() => {
                                                    try {
                                                        const cData = JSON.parse(entry.text || "{}");
                                                        return [cData.narrativeRole, cData.personality, cData.appearance].filter(Boolean).join(" • ").replace(/[#*`~>]/g, '');
                                                    } catch {
                                                        return (entry.text || '').replace(/[#*`~>]/g, '');
                                                    }
                                                })() : (entry.text || '').replace(/[#*`~>]/g, '')}
                                            </p>

                                            {/* Footer Metadata */}
                                            <div className="flex items-center justify-between border-t border-[#141b2c]/10 pt-1.5 mt-0.5 text-[8px] text-slate-405 font-mono font-bold tracking-widest uppercase">
                                                <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span>{Math.round((entry.text?.length || 0)/3.8)} Tokens</span>
                                                    <ChevronRight size={10} className={`transition-transform text-sky-400 ${isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'}`} />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full p-1 relative animate-fadeIn">
                        {renderTool?.()}
                    </div>
                )}
            </div>
        </div>
    );
};
