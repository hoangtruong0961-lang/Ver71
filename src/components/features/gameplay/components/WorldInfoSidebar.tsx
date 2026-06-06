import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Edit2, Trash2, Search, ToggleRight, ToggleLeft, X } from 'lucide-react';
import { Lorebook, LorebookEntry } from '../../../../services/ai/lorebook/types';
import LorebookEntryForm from './LorebookEntryForm';

interface WorldInfoSidebarProps {
  lorebook: Lorebook | undefined;
  onUpdateLorebook: (lorebook: Lorebook) => void;
}

const WorldInfoSidebar: React.FC<WorldInfoSidebarProps> = ({ lorebook, onUpdateLorebook }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LorebookEntry | null | undefined>(undefined);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const entries = lorebook?.entries ? Object.values(lorebook.entries) : [];

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const lowerSearch = searchTerm.toLowerCase();
    return entries.filter(entry => 
      (entry.comment && entry.comment.toLowerCase().includes(lowerSearch)) ||
      (entry.key && entry.key.join(', ').toLowerCase().includes(lowerSearch)) ||
      (entry.content && entry.content.toLowerCase().includes(lowerSearch))
    );
   
  }, [entries, searchTerm]);

  const handleSaveEntry = (entry: LorebookEntry) => {
    const newEntries = { ...(lorebook?.entries || {}) };
    newEntries[entry.uid] = entry;
    
    onUpdateLorebook({
      ...lorebook,
      entries: newEntries
    });
    setEditingEntry(undefined);
    setIsAdding(false);
  };

  const handleDelete = (uid: string | number) => {
    if(window.confirm("Bạn có chắc chắn muốn xóa thẻ thế giới này?")) {
        const newEntries = { ...(lorebook?.entries || {}) };
        delete newEntries[uid];
        onUpdateLorebook({
          ...lorebook,
          entries: newEntries
        });
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-stone-400 dark:hover:bg-slate-700/50 transition-colors group rounded-lg border border-stone-400 dark:border-slate-700 bg-stone-300 dark:bg-slate-800/30 mb-3"
      >
          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors uppercase">
             <BookOpen size={14} />
             Quản lý Thông tin Thế giới
          </div>
          <div className="text-[10px] text-stone-500 bg-stone-400 dark:bg-slate-800 px-2 py-0.5 rounded border border-stone-400 dark:border-slate-700">
              {entries.length} Thẻ
          </div>
      </button>

      <AnimatePresence>
  {isOpen && (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" 
        style={{ zIndex: 1000 }}
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-400 dark:border-slate-800 bg-stone-300 dark:bg-slate-900/80 shrink-0 shadow-sm relative z-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-stone-800 dark:text-slate-200 flex items-center gap-2 tracking-tight">
              <BookOpen size={24} className="text-amber-600 dark:text-amber-500" /> Quản lý Thông tin Thế giới
            </h2>
            <button onClick={() => setIsOpen(false)} className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white p-1 rounded-full hover:bg-stone-400 dark:hover:bg-slate-800 transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
               <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
               <input 
                  type="text" 
                  placeholder="Tìm kiếm thẻ..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-stone-100 dark:bg-mystic-950 border-2 border-stone-300 dark:border-mystic-accent/30 text-stone-800 dark:text-slate-200 font-medium rounded-lg appearance-none focus:outline-none focus:border-amber-500 transition-colors"
                />
            </div>
            <button 
                onClick={() => setIsAdding(true)}
                className="px-3 py-2 flex items-center justify-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-2 border-amber-200 dark:border-amber-800/50 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 transition-colors group whitespace-nowrap"
            >
                <Plus size={14} className="group-hover:scale-110 transition-transform" /> Tạo Thẻ
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8 bg-stone-100 dark:bg-mystic-900 relative">
            <section className="bg-white dark:bg-slate-800/40 p-5 rounded-xl border-l-[4px] border-l-amber-500 border-t border-r border-b border-stone-300 dark:border-slate-700 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-5 pointer-events-none p-4">
                    <BookOpen size={100} />
                </div>
                
                <div className="flex items-start justify-between mb-4 relative z-10">
                    <div>
                        <h3 className="text-base font-bold drop-shadow-sm flex items-center gap-2 text-amber-600 dark:text-amber-500">
                            Danh sách Thẻ (Entries)
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-slate-400 mt-1">
                            {filteredEntries.length} thẻ đang hiển thị.
                        </p>
                    </div>
                </div>

                <div className="space-y-3 relative z-10">
                    {filteredEntries.map(entry => (
                        <div key={entry.uid} className={`rounded-xl border transition-all ${!entry.disable ? 'bg-white dark:bg-slate-800/80 border-stone-300 dark:border-slate-600 shadow-sm' : 'bg-stone-50 dark:bg-slate-900/40 border-stone-200 dark:border-slate-800 opacity-60'}`}>
                            <div className="p-3 flex justify-between items-center group">
                                <div className="flex items-center flex-1 mr-4 gap-3">
                                     <div className="flex-1">
                                         <div className="flex items-center gap-2 mb-0.5">
                                             <span className={`text-sm font-bold truncate max-w-[200px] sm:max-w-[300px] ${!entry.disable ? 'text-stone-800 dark:text-slate-200' : 'text-stone-400 dark:text-slate-500 line-through'}`}>
                                                 {entry.comment || entry.key[0] || 'Chưa đặt tên'}
                                             </span>
                                             {entry.constant && (
                                                 <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded">
                                                     LUÔN BẬT
                                                 </span>
                                             )}
                                             <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 bg-stone-200 dark:bg-slate-700 text-stone-500 dark:text-slate-400 rounded">
                                                 {entry.key.length} Keywords
                                             </span>
                                         </div>
                                         <div className="flex items-center gap-3 mt-1.5">
                                             <button
                                                 onClick={(e) => { e.stopPropagation(); setEditingEntry(entry); }}
                                                 className="text-xs flex items-center gap-1 font-medium transition-colors text-stone-500 hover:text-stone-800 dark:hover:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-700 px-1 -ml-1 rounded"
                                             >
                                                 <Edit2 size={12} /> Chỉnh sửa
                                             </button>
                                             <button
                                                 onClick={(e) => { e.stopPropagation(); handleDelete(entry.uid); }}
                                                 className="text-[10px] text-red-500/70 hover:text-red-500 flex items-center gap-1 transition-colors"
                                             >
                                                 <Trash2 size={10} /> Xóa
                                             </button>
                                         </div>
                                     </div>
                                </div>
                                <button 
                                   onClick={(e) => {
                                       e.stopPropagation();
                                       const newEntry = {...entry, disable: !entry.disable};
                                       handleSaveEntry(newEntry);
                                   }}
                                   className={`${!entry.disable ? 'text-green-500 drop-shadow-md' : 'text-stone-300 dark:text-slate-600'} hover:scale-[1.15] transition-transform`}
                                   title={!entry.disable ? "Đang BẬT" : "Đang TẮT"}
                               >
                                   {!entry.disable ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                               </button>
                            </div>
                        </div>
                    ))}
                    {entries.length > 0 && filteredEntries.length === 0 && (
                        <div className="text-center py-10 text-sm text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-stone-300 dark:border-slate-700">Không tìm thấy thẻ nào phù hợp <b>"{searchTerm}"</b>.</div>
                    )}
                    {entries.length === 0 && (
                        <div className="text-center py-12 text-sm text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-stone-300 dark:border-slate-700 flex flex-col items-center gap-3">
                            <BookOpen size={32} className="text-stone-300 dark:text-slate-600" />
                            <p className="max-w-xs text-balance leading-relaxed">Bách khoa thế giới đang trống.<br/>Hãy tạo thẻ mới để định nghĩa thế giới của bạn!</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

      {(isAdding || editingEntry) && (
        <LorebookEntryForm 
           initialData={editingEntry || undefined}
           onSave={handleSaveEntry}
           onCancel={() => { setIsAdding(false); setEditingEntry(undefined); }}
        />
      )}
    </>
  );
};

export default WorldInfoSidebar;
