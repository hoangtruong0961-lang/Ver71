import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Database, X, ChevronDown, Clock, Edit2, Check, ArrowLeftRight, Trash2, 
    Plus, Copy, Search, FileDown, FileUp, Sparkles, AlertCircle 
} from 'lucide-react';
import { LsrTableDefinition, LsrParser } from '../../../../services/lsr/LsrParser';
import { useResponsive } from '../../../../hooks/useResponsive';
import { toast } from 'sonner';

interface LsrDatabaseModalProps {
    show: boolean;
    onClose: () => void;
    lsrTables: LsrTableDefinition[];
    lsrRuntimeData: Record<string, any[]>;
    handleUpdateLsrData?: (data: Record<string, any[]>) => void;
    activeLsrTableId: string | null;
    setActiveLsrTableId: (id: string) => void;
    lsrViewMode: 'table' | 'timeline';
    setLsrViewMode: (mode: 'table' | 'timeline') => void;
}

const LsrDatabaseModal: React.FC<LsrDatabaseModalProps> = ({
    show,
    onClose,
    lsrTables,
    lsrRuntimeData,
    handleUpdateLsrData,
    activeLsrTableId,
    setActiveLsrTableId,
    lsrViewMode,
    setLsrViewMode
}) => {
    const { isMobile } = useResponsive();
    
    // Search query
    const [searchQuery, setSearchQuery] = useState('');
    
    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Local copy of data for pristine transactional saves
    const [localData, setLocalData] = useState<Record<string, any[]>>({});
    
    // Import/Export panel toggle
    const [showImportExport, setShowImportExport] = useState(false);
    const [importText, setImportText] = useState('');
    
    // State of copy confirmation
    const [copied, setCopied] = useState(false);

    // Synchronize local clone with props on open
    useEffect(() => {
        if (show) {
            setLocalData(JSON.parse(JSON.stringify(lsrRuntimeData || {})));
            setIsEditMode(false);
            setSearchQuery('');
            setShowImportExport(false);
            setImportText('');
        }
    }, [lsrRuntimeData, show]);

    // Active table object
    const activeTable = useMemo(() => {
        return lsrTables.find(t => t.id === activeLsrTableId) || lsrTables[0] || null;
    }, [lsrTables, activeLsrTableId]);

    // Current rows for active table, filtered by search query
    const currentRows = useMemo(() => {
        if (!activeTable) return [];
        const rows = localData[activeTable.id] || [];
        
        if (!searchQuery.trim()) return rows;
        
        const query = searchQuery.toLowerCase();
        return rows.filter((row: any) => {
            return Object.values(row).some(val => 
                String(val).toLowerCase().includes(query)
            );
        });
    }, [localData, activeTable, searchQuery]);

    // Copy LSR standard format to Clipboard
    const handleCopyLsrString = () => {
        try {
            const lsrStr = LsrParser.stringifyLsrData(localData, lsrTables);
            navigator.clipboard.writeText(lsrStr);
            setCopied(true);
            toast.success("Đã sao chép định dạng LSR!", { description: "Có thể dán trực tiếp vào game hoặc SillyTavern" });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Lỗi khi sao chép");
        }
    };

    // Export as raw JSON
    const handleCopyJson = () => {
        try {
            navigator.clipboard.writeText(JSON.stringify(localData, null, 2));
            toast.success("Đã sao chép định dạng JSON!");
        } catch (err) {
            toast.error("Lỗi khi sao chép JSON");
        }
    };

    // Direct Import Action: Merging or Overwriting
    const handleImport = (mode: 'replace' | 'merge') => {
        if (!importText.trim()) {
            toast.warning("Vui lòng nhập dữ liệu nguồn để import!");
            return;
        }

        try {
            let parsed: Record<string, any[]> = {};
            
            // Check if user pasted JSON or LSR raw lines
            if (importText.trim().startsWith('{')) {
                parsed = JSON.parse(importText);
            } else {
                parsed = LsrParser.parseLsrString(importText);
            }

            if (Object.keys(parsed).length === 0) {
                toast.error("Không tìm thấy dữ liệu LSR hợp lệ!");
                return;
            }

            let nextData = { ...localData };
            
            if (mode === 'replace') {
                nextData = parsed;
                setLocalData(nextData);
                toast.success("Đã thay thế toàn bộ dữ liệu thành công!");
            } else {
                nextData = LsrParser.mergeLsrData(localData, parsed);
                setLocalData(nextData);
                toast.success("Trộn dữ liệu thông minh thành công!");
            }

            setImportText('');
            setShowImportExport(false);
        } catch (err) {
            toast.error("Không thể phân tích dữ liệu nhập vào. Kiểm tra lại cú pháp!");
        }
    };

    // Cell editing in local copy
    const handleCellChange = (rowIndex: number, colIndexKey: string, newValue: string) => {
        if (!activeTable) return;
        const targetTableId = activeTable.id;
        
        setLocalData(prev => {
            const rows = prev[targetTableId] ? [...prev[targetTableId]] : [];
            if (rows[rowIndex]) {
                rows[rowIndex] = {
                    ...rows[rowIndex],
                    [colIndexKey]: newValue
                };
            }
            return {
                ...prev,
                [targetTableId]: rows
            };
        });
    };

    // Delete table row manually
    const handleDeleteRow = (rowIndex: number) => {
        if (!activeTable) return;
        const targetTableId = activeTable.id;
        
        setLocalData(prev => {
            const rows = prev[targetTableId] ? [...prev[targetTableId]] : [];
            const deletedRow = rows[rowIndex];
            const primaryKey = deletedRow ? (deletedRow["0"] || `dòng thứ ${rowIndex + 1}`) : "";
            
            rows.splice(rowIndex, 1);
            toast.info(`⚠️ Đã xóa dòng: ${primaryKey}`);
            return {
                ...prev,
                [targetTableId]: rows
            };
        });
    };

    // Add empty row
    const handleAddNewRow = () => {
        if (!activeTable) return;
        const targetTableId = activeTable.id;
        
        setLocalData(prev => {
            const rows = prev[targetTableId] ? [...prev[targetTableId]] : [];
            // Create an empty row with default index space
            const newRow: Record<string, string> = {};
            activeTable.columns.forEach((_, idx) => {
                newRow[idx.toString()] = "";
            });
            rows.push(newRow);
            return {
                ...prev,
                [targetTableId]: rows
            };
        });
    };

    // Save final state changes and update store
    const handleSaveChanges = () => {
        if (handleUpdateLsrData) {
            handleUpdateLsrData(localData);
            toast.success("💾 Đã lưu thay đổi vào cơ sở dữ liệu!");
            setIsEditMode(false);
        } else {
            toast.error("Lỗi: Không tìm thấy trình xử lý lưu trữ.");
        }
    };

    // Revert changes
    const handleCancelChanges = () => {
        setLocalData(JSON.parse(JSON.stringify(lsrRuntimeData || {})));
        setIsEditMode(false);
        toast("🔄 Đã khôi phục các thay đổi chưa lưu.");
    };

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-6 select-none dynamic-hud-wrapper">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        className="bg-stone-200 dark:bg-mystic-900 border-2 border-stone-400 dark:border-slate-700 w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header Bar */}
                        <div className="p-3 border-b-2 border-stone-400 dark:border-slate-800 flex justify-between items-center bg-stone-300 dark:bg-slate-900/60 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-600 dark:text-green-400 shadow-inner">
                                    <Database size={18} className="animate-pulse" />
                                </div>
                                <div className="space-y-0.5">
                                    <h2 className="text-sm font-black uppercase text-stone-800 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                                        LSR Realtime Database Suite
                                    </h2>
                                    <p className="text-[10px] text-stone-600 dark:text-slate-400 font-bold uppercase tracking-wider leading-none">
                                        Bảng Đồng bộ Trạng thái Chương truyện & AI World State
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Close Button */}
                                <button 
                                    onClick={onClose} 
                                    className="text-stone-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:scale-115 p-1 rounded-lg hover:bg-stone-400/30 dark:hover:bg-slate-800 transition-all font-bold"
                                    title="Đóng (Esc)"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Top Control Bar (Search, Edit/Save toggles, Import/Export) */}
                        <div className="p-3 border-b border-stone-400/80 dark:border-slate-800 bg-stone-250 dark:bg-slate-900/30 shrink-0 flex flex-col gap-3">
                            <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
                                {/* Search and Filtering */}
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 dark:text-slate-400" size={14} />
                                    <input 
                                        type="text"
                                        placeholder="Tìm kiếm dòng, tên, trạng thái chi tiết..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-stone-300 dark:bg-slate-800 border-2 border-stone-400/50 dark:border-slate-700/80 rounded-xl text-xs font-bold font-sans outline-none text-stone-800 dark:text-slate-250 focus:border-green-500 placeholder-stone-500 dark:placeholder-slate-500 transition-all shadow-inner"
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-white"
                                        >
                                            Xóa
                                        </button>
                                    )}
                                </div>

                                {/* Controls Suite */}
                                <div className="flex flex-wrap gap-2 items-center">
                                    {/* Import/Export Tab Toggle */}
                                    <button
                                        onClick={() => setShowImportExport(!showImportExport)}
                                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                                            showImportExport 
                                            ? 'bg-amber-500/20 text-amber-600 border-amber-500/40' 
                                            : 'bg-stone-300 dark:bg-slate-800 border-stone-400/80 dark:border-slate-700 hover:border-amber-500/40 text-stone-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <ArrowLeftRight size={14} />
                                        <span>Giao thức / CLI Tool</span>
                                    </button>

                                    {/* Editable Workspace Toggle */}
                                    {isEditMode ? (
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={handleSaveChanges}
                                                className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1 border-none shadow-md shadow-green-500/10 cursor-pointer transition-all"
                                            >
                                                <Check size={14} />
                                                <span>Lưu thay đổi</span>
                                            </button>
                                            <button
                                                onClick={handleCancelChanges}
                                                className="px-3 py-1.5 rounded-xl bg-stone-400 hover:bg-stone-500 text-stone-800 text-xs font-bold border-none cursor-pointer transition-all"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setIsEditMode(true);
                                                setShowImportExport(false);
                                                toast.info("Chế độ Chỉnh sửa đang Bật", { description: "Bạn có thể chỉnh sửa trực tiếp các ô thông tin hoặc thêm dòng." });
                                            }}
                                            className="px-3 py-1.5 rounded-xl bg-stone-300 dark:bg-slate-800 hover:bg-slate-450 dark:hover:bg-slate-700 border border-stone-400/80 dark:border-slate-700 text-stone-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                                        >
                                            <Edit2 size={14} />
                                            <span>Bật Sửa Thủ Công</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Collapsible Giao thức CLI Panel */}
                            <AnimatePresence>
                                {showImportExport && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden bg-stone-300/40 dark:bg-slate-850/60 p-3 rounded-2xl border border-stone-400/40 dark:border-slate-700 structure-diagnostic mt-1"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Left Column: Export Standard Representation */}
                                            <div className="space-y-2 flex flex-col justify-between">
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-black text-stone-800 dark:text-slate-300 uppercase flex items-center gap-1">
                                                        <FileDown size={14} className="text-green-500" /> Xuất chuẩn mã nguồn LSR
                                                    </h4>
                                                    <p className="text-[10px] text-stone-500 dark:text-slate-400 leading-normal">
                                                        Chuỗi định dạng nén tối giản được truyền truyền trực tiếp trong System Prompt hỗ trợ xây dựng ngữ cảnh trí tuệ nhân tạo (AI).
                                                    </p>
                                                </div>
                                                <div className="bg-stone-300/80 dark:bg-slate-900 border border-stone-400/50 dark:border-slate-800 p-2.5 rounded-xl font-mono text-[9px] text-stone-700 dark:text-slate-300 max-h-[140px] overflow-y-auto select-all whitespace-pre-wrap leading-relaxed">
                                                    {LsrParser.stringifyLsrData(localData, lsrTables) || "// Không có dữ liệu để chuyển đổi."}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={handleCopyLsrString}
                                                        className="px-3 py-1 bg-stone-400/30 dark:bg-slate-800 text-stone-750 dark:text-slate-300 border border-stone-400 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-stone-400/50 dark:hover:bg-slate-750 active:scale-95 flex items-center gap-1 transition-all cursor-pointer"
                                                    >
                                                        <Copy size={12}/> {copied ? "Đã chép!" : "Chép mã LSR"}
                                                    </button>
                                                    <button 
                                                        onClick={handleCopyJson}
                                                        className="px-3 py-1 bg-transparent hover:bg-stone-400/30 text-stone-500 dark:text-slate-450 rounded-lg text-xs font-bold active:scale-95 transition-all cursor-pointer"
                                                    >
                                                        Sao chép JSON
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Right Column: Fast Import Panel */}
                                            <div className="space-y-2 flex flex-col justify-between">
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-black text-stone-800 dark:text-slate-300 uppercase flex items-center gap-1">
                                                        <FileUp size={14} className="text-amber-500" /> Nhập và Trộn dữ liệu thông minh
                                                    </h4>
                                                    <p className="text-[10px] text-stone-500 dark:text-slate-400 leading-normal">
                                                        Dán văn bản thuần LSR (được AI phản hồi dưới các thẻ <code className="dark:text-amber-400">&lt;table_stored&gt;</code>) hoặc JSON để cập nhật bảng.
                                                    </p>
                                                </div>
                                                <textarea
                                                    rows={4}
                                                    placeholder="Ví dụ dán: #6 Túi đồ|0:Thần khí Long Phụng|1:1"
                                                    value={importText}
                                                    onChange={(e) => setImportText(e.target.value)}
                                                    className="w-full p-2.5 bg-stone-300/80 dark:bg-slate-900 border border-stone-400/50 dark:border-slate-800 rounded-xl font-mono text-[10px] text-stone-800 dark:text-slate-200 focus:border-amber-500 outline-none placeholder-stone-500 transition-all resize-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleImport('merge')}
                                                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95 flex items-center gap-1 transition-all cursor-pointer border-none shadow-sm"
                                                    >
                                                        <Sparkles size={12}/> Trộn Thông Minh
                                                    </button>
                                                    <button 
                                                        onClick={() => handleImport('replace')}
                                                        className="px-3 py-1 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-bold active:scale-95 transition-all cursor-pointer border-none"
                                                    >
                                                        Chép Đè Toàn Bộ
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Middle Area: Sidebar (Table Selection) and Content Area */}
                        <div className="flex-1 flex min-h-0 overflow-hidden relative">
                            {/* Desktop Sidebar: Tables Selection */}
                            {!isMobile && (
                                <div className="w-64 border-r-2 border-stone-400 dark:border-slate-800 bg-stone-250 dark:bg-slate-900/40 p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar shrink-0 select-none">
                                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-stone-500 dark:text-slate-500 px-3 py-1 bg-stone-300/10 rounded">
                                        Chọn Cơ sở Dữ liệu
                                    </div>
                                    <div className="space-y-1 mt-1">
                                        {lsrTables.map((table) => {
                                            const isActive = activeLsrTableId === table.id;
                                            const rowCount = (localData[table.id] || []).length;
                                            
                                            return (
                                                <button
                                                    key={table.id}
                                                    onClick={() => {
                                                        setActiveLsrTableId(table.id);
                                                        if (table.id === '10' || table.id === '4' || table.id === '15') {
                                                            setLsrViewMode('timeline');
                                                        } else {
                                                            setLsrViewMode('table');
                                                        }
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-between ${
                                                        isActive
                                                        ? 'bg-mystic-accent text-mystic-950 font-black shadow-md'
                                                        : 'text-stone-500 dark:text-slate-450 hover:text-stone-900 dark:hover:text-slate-200 hover:bg-stone-300/60 dark:hover:bg-slate-800/60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className={`text-[10px] font-mono shrink-0 font-extrabold px-1 py-0.5 rounded ${isActive ? 'bg-mystic-950/20 text-mystic-950' : 'bg-stone-300/80 dark:bg-slate-800 text-stone-600'}`}>
                                                            #{table.id}
                                                        </span>
                                                        <span className="truncate">{table.name}</span>
                                                    </div>
                                                    {rowCount > 0 && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-mystic-950 text-mystic-accent' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                                                            {rowCount}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Main Display Area */}
                            <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar bg-stone-200 dark:bg-mystic-900 min-w-0 select-text">
                                {/* Mobile Select Header */}
                                {isMobile && activeTable && (
                                    <div className="mb-4 shrink-0">
                                        <div className="relative">
                                            <select 
                                                value={activeLsrTableId || ''} 
                                                onChange={(e) => {
                                                    setActiveLsrTableId(e.target.value);
                                                    if (e.target.value === '10' || e.target.value === '4' || e.target.value === '15') {
                                                        setLsrViewMode('timeline');
                                                    } else {
                                                        setLsrViewMode('table');
                                                    }
                                                }}
                                                className="w-full text-xs font-bold p-2.5 bg-stone-300 dark:bg-slate-800 border-2 border-stone-400 dark:border-slate-700 rounded-xl text-stone-800 dark:text-slate-200 outline-none appearance-none font-sans"
                                            >
                                                {lsrTables.map((table) => {
                                                    const rowCount = (localData[table.id] || []).length;
                                                    return (
                                                        <option key={table.id} value={table.id}>
                                                            #{table.id} {table.name} {rowCount > 0 ? `(${rowCount} dòng)` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                                                <ChevronDown size={14} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Table Meta Control Details */}
                                {activeTable && (
                                    <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                        {/* Table details bar */}
                                        <div className="flex items-center justify-between gap-2 shrink-0 border-b border-stone-400/40 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="bg-stone-300 dark:bg-slate-800 text-stone-600 dark:text-slate-400 text-xs font-black font-mono px-2 py-0.5 rounded-lg border border-stone-400/50 dark:border-slate-700">
                                                    #{activeTable.id}
                                                </span>
                                                <h3 className="text-sm font-black text-stone-800 dark:text-slate-200">
                                                    {activeTable.name}
                                                </h3>
                                            </div>
                                            
                                            {/* Swap Modes View */}
                                            <div className="flex bg-stone-300 dark:bg-slate-800 p-0.5 rounded-xl border border-stone-400/80 dark:border-slate-700 select-none shrink-0">
                                                <button 
                                                    onClick={() => setLsrViewMode('table')}
                                                    className={`px-3 py-1 outline-none text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                                                        lsrViewMode === 'table' 
                                                        ? 'bg-mystic-accent text-mystic-950 shadow-sm' 
                                                        : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    Mô hình Bảng
                                                </button>
                                                <button 
                                                    onClick={() => setLsrViewMode('timeline')}
                                                    className={`px-3 py-1 outline-none text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                                                        lsrViewMode === 'timeline' 
                                                        ? 'bg-mystic-accent text-mystic-950 shadow-sm' 
                                                        : 'text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    Mô hình Dòng sự kiện
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content Display: Timeline vs Grid Table */}
                                        <div className="flex-1 overflow-x-auto min-h-0 custom-scrollbar relative pr-1">
                                            {lsrViewMode === 'timeline' ? (
                                                /* Elegant Dynamic Timeline View */
                                                <div className="relative pl-5 border-l-2 border-stone-300 dark:border-slate-850 space-y-4 py-2 mt-2 ml-2">
                                                    {currentRows.length === 0 ? (
                                                        <div className="text-xs text-stone-500 dark:text-slate-500 flex items-center gap-1.5 py-4 font-bold uppercase">
                                                            <AlertCircle size={14} /> (Không chứa tuyến sự kiện / dòng thời gian phù hợp)
                                                        </div>
                                                    ) : (
                                                        currentRows.map((row: any, rIdx: number) => {
                                                            const timeVal = row["0"] || "Unknown Time";
                                                            let secBadgeVal = "";
                                                            let titleVal = "";
                                                            let descVal = "";
                                                            
                                                            if (activeTable.columns.length >= 4) {
                                                                secBadgeVal = row["1"] || "";
                                                                titleVal = row["2"] || "";
                                                                descVal = row["3"] || "";
                                                                for (let i = 4; i < activeTable.columns.length; i++) {
                                                                    if (row[i.toString()]) {
                                                                        descVal += `\n[${activeTable.columns[i]}]: ${row[i.toString()]}`;
                                                                    }
                                                                }
                                                            } else if (activeTable.columns.length === 3) {
                                                                titleVal = row["1"] || "";
                                                                descVal = row["2"] || "";
                                                            } else {
                                                                titleVal = row["1"] || "";
                                                                descVal = "";
                                                            }

                                                            return (
                                                                <div key={rIdx} className="relative group w-full">
                                                                    {/* Dot Node Icon */}
                                                                    <div className="absolute -left-[24.5px] top-2 w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-mystic-900 border-2 border-mystic-accent z-10 shadow-[0_0_8px_rgba(56,189,248,0.5)]"></div>
                                                                    <div className="bg-stone-100 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-stone-300 dark:border-slate-700/80 shadow-sm group-hover:border-mystic-accent/50 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all">
                                                                        <div className="flex flex-col sm:flex-row gap-2 mb-2 sm:items-center justify-between">
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-stone-300/80 dark:bg-slate-900 text-[11px] font-mono font-bold text-mystic-accent border border-stone-400/40 dark:border-slate-750 shrink-0 w-fit">
                                                                                <Clock size={12} className="shrink-0" />
                                                                                {timeVal}
                                                                            </span>
                                                                            {secBadgeVal && (
                                                                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-500 dark:text-slate-400 px-2.5 py-0.5 rounded-lg bg-stone-300/50 dark:bg-slate-800 border border-stone-300 dark:border-slate-700/80 shrink-0 w-fit">
                                                                                    {activeTable.columns[1]}: {secBadgeVal}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {titleVal && (
                                                                            <h4 className="text-xs font-black text-stone-850 dark:text-slate-105 mb-1 bg-gradient-to-r from-stone-800 to-stone-600 dark:from-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-relaxed">
                                                                                {titleVal}
                                                                            </h4>
                                                                        )}
                                                                        {descVal && (
                                                                            <p className="text-[12px] text-stone-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                                                                {descVal}
                                                                            </p>
                                                                        )}

                                                                        {/* Edit overlay action if editmode is active */}
                                                                        {isEditMode && (
                                                                            <div className="absolute right-3 top-3 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        toast.info("Vui lòng chỉnh sửa trực tiếp thông qua 'Mô hình Bảng' cho mọi ô một cách chính xác nhất!");
                                                                                        setLsrViewMode('table');
                                                                                    }}
                                                                                    className="p-1 px-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-550 dark:text-sky-400 font-bold text-[10px] rounded border border-sky-500/20"
                                                                                >
                                                                                    Sửa ô này
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteRow(rIdx)}
                                                                                    className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded bg-red-400/10 hover:bg-red-500/25 transition-all border border-red-500/20"
                                                                                    title="Xóa dòng"
                                                                                >
                                                                                    <Trash2 size={13} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            ) : (
                                                /* Pro-Grade Grid Table View with Inline Editing Hooks */
                                                <div className="rounded-2xl border-2 border-stone-400/60 dark:border-slate-800 overflow-hidden shadow-md">
                                                    <table className="w-full text-xs text-left text-stone-750 dark:text-slate-350 border-collapse">
                                                        <thead className="text-[10px] tracking-wider text-stone-800 dark:text-slate-300 uppercase bg-stone-300 dark:bg-slate-800 border-b border-stone-450 dark:border-slate-700 font-black">
                                                            <tr>
                                                                {activeTable.columns.map((col, idx) => (
                                                                    <th key={idx} scope="col" className="px-3 py-2 border-r border-stone-400/60 dark:border-slate-700 last:border-r-0 whitespace-nowrap">
                                                                        {col}
                                                                    </th>
                                                                ))}
                                                                {isEditMode && (
                                                                    <th scope="col" className="px-3 py-2 text-center bg-red-500/10 text-red-600 dark:text-red-400 border-l border-stone-450 dark:border-slate-700 w-16 whitespace-nowrap">
                                                                        Hành động
                                                                    </th>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-350 dark:divide-slate-800">
                                                            {currentRows.length === 0 ? (
                                                                <tr className="bg-stone-200 dark:bg-slate-900/40 hover:bg-stone-250 transition-colors">
                                                                    <td colSpan={activeTable.columns.length + (isEditMode ? 1 : 0)} className="px-3 py-6 italic text-stone-500 dark:text-slate-550 text-center font-bold font-sans">
                                                                        (Không tìm thấy dữ liệu dòng nào khớp yêu cầu)
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                currentRows.map((row: any, rIdx: number) => (
                                                                    <tr key={rIdx} className="bg-stone-200 dark:bg-slate-900/30 hover:bg-stone-250/50 dark:hover:bg-slate-800/10 transition-colors">
                                                                        {activeTable.columns.map((_, cIdx) => (
                                                                            <td key={cIdx} className="p-1 px-3 border-r border-stone-350 dark:border-slate-800 last:border-r-0 text-stone-700 dark:text-slate-200 leading-relaxed min-w-[124px]">
                                                                                {isEditMode ? (
                                                                                    <input
                                                                                        type="text"
                                                                                        value={row[cIdx.toString()] !== undefined ? row[cIdx.toString()] : ""}
                                                                                        onChange={(e) => handleCellChange(rIdx, cIdx.toString(), e.target.value)}
                                                                                        className="w-full bg-white dark:bg-slate-900 text-stone-800 dark:text-slate-100 p-1.5 px-2.5 border border-stone-400/80 dark:border-slate-705 rounded-xl font-sans text-xs outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition-all shadow-inner"
                                                                                        placeholder="..."
                                                                                    />
                                                                                ) : (
                                                                                    <span className="block whitespace-pre-wrap py-1 text-xs">
                                                                                        {row[cIdx.toString()] !== undefined && row[cIdx.toString()] !== "" ? row[cIdx.toString()] : "-"}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        ))}
                                                                        {isEditMode && (
                                                                            <td className="p-1 text-center bg-red-500/5 border-l border-stone-350 dark:border-slate-800">
                                                                                <button
                                                                                    onClick={() => handleDeleteRow(rIdx)}
                                                                                    className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:scale-110 rounded-lg hover:bg-red-500/15 transition-all outline-none border-none cursor-pointer"
                                                                                    title="Xóa dòng"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bottom Action Bar: Row Counter & "+ Add Row" Action */}
                                        <div className="shrink-0 flex justify-between items-center bg-stone-300/40 dark:bg-slate-900/20 p-2.5 rounded-2xl border border-stone-400/30 dark:border-slate-800 select-none">
                                            <div className="text-[10px] text-stone-500 dark:text-slate-450 uppercase font-bold md:pl-1">
                                                Tổng quy mô: {currentRows.length} / {(localData[activeTable.id] || []).length} dòng phù hợp
                                            </div>

                                            {isEditMode && (
                                                <button
                                                    onClick={handleAddNewRow}
                                                    className="px-3.5 py-1.5 bg-green-500/15 hover:bg-green-500/25 border-2 border-green-500/30 text-green-700 dark:text-green-400 hover:text-green-850 dark:hover:text-green-300 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                                                >
                                                    <Plus size={14} />
                                                    <span>Thêm Dòng Mới</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LsrDatabaseModal;
