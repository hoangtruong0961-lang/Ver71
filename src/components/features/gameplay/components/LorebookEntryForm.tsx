import React, { useState } from 'react';
import { LorebookEntry } from '../../../../services/ai/lorebook/types';
import { X, Check, Settings, FileText, Layout, Clock } from 'lucide-react';

interface LorebookEntryFormProps {
  initialData?: LorebookEntry;
  onSave: (entry: LorebookEntry) => void;
  onCancel: () => void;
}

const LorebookEntryForm: React.FC<LorebookEntryFormProps> = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<LorebookEntry>(() => ({
    uid: initialData?.uid || `entry_${Date.now()}`,
    key: initialData?.key || [],
    keysecondary: initialData?.keysecondary || [],
    content: initialData?.content || '',
    comment: initialData?.comment || '',
    constant: initialData?.constant || false,
    disable: initialData?.disable || false,
    order: initialData?.order || 100,
    position: initialData?.position || 0,
    depth: initialData?.depth || 0,
    selectiveLogic: initialData?.selectiveLogic ?? 0,
    probability: initialData?.probability ?? 100,
    group: initialData?.group || '',
    groupWeight: initialData?.groupWeight ?? 100,
    preventRecursion: initialData?.preventRecursion || false,
    delayUntilRecursive: initialData?.delayUntilRecursive || false,
    nonRecursive: initialData?.nonRecursive || false,
    caseSensitive: initialData?.caseSensitive || false,
    matchWholeWords: initialData?.matchWholeWords ?? true,
    sticky: initialData?.sticky ?? 0,
    cooldown: initialData?.cooldown ?? 0,
    delay: initialData?.delay ?? 0,
  }));

  const [keysInput, setKeysInput] = useState(formData.key.join(', '));
  const [secondaryKeysInput, setSecondaryKeysInput] = useState(formData.keysecondary?.join(', ') || '');
  const [activeTab, setActiveTab] = useState<'general' | 'placement' | 'matching' | 'advanced'>('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      key: keysInput.split(',').map(k => k.trim()).filter(k => k),
      keysecondary: secondaryKeysInput.split(',').map(k => k.trim()).filter(k => k)
    });
  };

  const tabs = [
    { id: 'general', label: 'Cơ bản', icon: FileText },
    { id: 'placement', label: 'Vị trí chèn', icon: Layout },
    { id: 'matching', label: 'Nhận diện', icon: SearchIcon },
    { id: 'advanced', label: 'Nâng cao', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 flex justify-center items-center p-4 sm:p-6 bg-stone-900/60 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 1010 }}>
      <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-center p-5 sm:px-6 border-b border-stone-100 dark:border-slate-800/60 bg-stone-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                <FileText size={18} />
             </div>
             <div>
                <h3 className="font-bold text-stone-800 dark:text-slate-200 text-base">
                  {initialData ? 'Chỉnh sửa Encyclopedia (Bách Khoa)' : 'Thêm Thẻ Encyclopedia Mới'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">Quản lý các thẻ quy ước thông tin thế giới.</p>
             </div>
          </div>
          <button onClick={onCancel} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950/40 px-4 pt-2 gap-1 overflow-x-auto custom-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'general' | 'placement' | 'matching' | 'advanced')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase transition-all whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-white dark:bg-slate-900 rounded-t-xl' 
                  : 'text-stone-500 hover:text-stone-800 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-stone-200/50 dark:hover:bg-slate-800/50 rounded-t-xl border-b-2 border-transparent'
                }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-6">
          {/* GENERAL TAB */}
          <div className={activeTab === 'general' ? 'block space-y-5 animate-in fade-in slide-in-from-left-2 duration-300' : 'hidden'}>
            <div className="space-y-1.5">
               <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Tên/Ghi chú (Comment)</label>
               <input 
                 type="text" 
                 className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                 value={formData.comment} 
                 onChange={e => setFormData({...formData, comment: e.target.value})} 
                 placeholder="VD: Mô tả thanh kiếm Excalibur..."
               />
            </div>

            <div className="space-y-1.5">
               <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Strategy: Keyword / Từ khóa</label>
               <input 
                 type="text" 
                 className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-mono"
                 value={keysInput} 
                 onChange={e => setKeysInput(e.target.value)} 
                 placeholder="sword, excalibur, king arthur..."
                 required={!formData.constant}
               />
            </div>

            <div className="space-y-1.5">
               <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Nội dung (Content)</label>
               <textarea 
                 className="w-full min-h-[160px] bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl p-3.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all custom-scrollbar resize-y"
                 value={formData.content} 
                 onChange={e => setFormData({...formData, content: e.target.value})} 
                 placeholder="Cốt truyện, thông tin về thế giới, nhân vật..."
                 required
               />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-stone-50 dark:bg-slate-900/50 rounded-xl border border-stone-200 dark:border-slate-800">
               <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className="relative">
                      <input type="checkbox" checked={formData.constant} onChange={e => setFormData({...formData, constant: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">Strategy: Constant</span>
                      <span className="text-[10px] text-stone-500 dark:text-slate-500">Bỏ qua từ khóa, luôn nhúng vào prompt. (Always active)</span>
                  </div>
               </label>

               <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className="relative">
                      <input type="checkbox" checked={formData.disable} onChange={e => setFormData({...formData, disable: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-rose-500"></div>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-sm font-bold text-rose-700 dark:text-rose-400 group-hover:text-rose-800 dark:group-hover:text-rose-300 transition-colors">Tạm tắt (Disabled)</span>
                      <span className="text-[10px] text-stone-500 dark:text-slate-500">Vô hiệu hóa thẻ này mà không cần xóa.</span>
                  </div>
               </label>
            </div>
          </div>

          {/* PLACEMENT TAB */}
          <div className={activeTab === 'placement' ? 'block space-y-5 animate-in fade-in slide-in-from-left-2 duration-300' : 'hidden'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                 <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Vị trí chèn (Insertion Position)</label>
                 <select 
                   className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%24%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] bg-[length:16px_16px]"
                   value={formData.position}
                   onChange={e => setFormData({...formData, position: parseInt(e.target.value)})}
                 >
                    <option value={0}>↑ Char</option>
                    <option value={1}>↓ Char</option>
                    <option value={2}>↑ Example Messages</option>
                    <option value={3}>↓ Example Messages</option>
                    <option value={4}>@Depth ⚙️ (System Role)</option>
                    <option value={5}>@Depth 👤 (User Role)</option>
                    <option value={6}>@Depth 🤖 (Assistant Role)</option>
                 </select>
              </div>
              <div className="space-y-1.5">
                 <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Thứ tự ưu tiên (Insertion Order)</label>
                 <input 
                   type="number" 
                   className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                   value={formData.order} 
                   onChange={e => setFormData({...formData, order: parseInt(e.target.value) || 0})} 
                 />
                 <p className="text-[10px] text-stone-500 mt-1">Số cao = Gần cuối hơn (có hiệu lực mạnh hơn với AI).</p>
              </div>
            </div>

            {formData.position >= 4 && (
              <div className="space-y-1.5 p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
                 <label className="block text-[11px] uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400">Độ sâu (Insertion Depth)</label>
                 <input 
                   type="number" 
                   className="w-full bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-700/50 rounded-lg px-3 py-2 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                   value={formData.depth} 
                   onChange={e => setFormData({...formData, depth: parseInt(e.target.value) || 0})} 
                 />
                 <p className="text-[10px] text-indigo-500 dark:text-indigo-400/80 mt-1">Độ sâu 0 = Cuối prompt (ảnh hưởng mạnh nhất).</p>
              </div>
            )}
          </div>

          {/* MATCHING TAB */}
          <div className={activeTab === 'matching' ? 'block space-y-5 animate-in fade-in slide-in-from-left-2 duration-300' : 'hidden'}>
            <div className="space-y-1.5">
               <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Từ khóa phụ (Secondary Keywords - Tùy chọn)</label>
               <input 
                 type="text" 
                 className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-mono"
                 value={secondaryKeysInput} 
                 onChange={e => setSecondaryKeysInput(e.target.value)} 
                 placeholder="VD: forest, magic, battle..."
               />
            </div>

            <div className="space-y-1.5">
               <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Logic chọn lọc (Selective Logic)</label>
               <select 
                 className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%24%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] bg-[length:16px_16px]"
                 value={formData.selectiveLogic}
                 onChange={e => setFormData({...formData, selectiveLogic: parseInt(e.target.value)})}
               >
                  <option value={0}>AND ANY: Có khóa chính VÀ ít nhất 1 khóa phụ</option>
                  <option value={1}>AND ALL: Có khóa chính VÀ TOÀN BỘ khóa phụ</option>
                  <option value={2}>NOT ANY: Có khóa chính VÀ KHÔNG có khóa phụ nào</option>
                  <option value={3}>NOT ALL: Chặn nếu có TẤT CẢ khóa phụ</option>
               </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-stone-50 dark:bg-slate-900/50 rounded-xl border border-stone-200 dark:border-slate-800">
               <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className="relative">
                      <input type="checkbox" checked={formData.caseSensitive} onChange={e => setFormData({...formData, caseSensitive: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-500"></div>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">Phân biệt Hoa/thường</span>
                  </div>
               </label>

               <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className="relative">
                      <input type="checkbox" checked={formData.matchWholeWords} onChange={e => setFormData({...formData, matchWholeWords: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-purple-500"></div>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">Khớp nguyên từ (Whole Words)</span>
                  </div>
               </label>
            </div>
          </div>

          {/* ADVANCED TAB */}
          <div className={activeTab === 'advanced' ? 'block space-y-5 animate-in fade-in slide-in-from-left-2 duration-300' : 'hidden'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                 <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Tỷ lệ kích hoạt (Probability %)</label>
                 <input 
                   type="number" 
                   min="0" max="100"
                   className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                   value={formData.probability} 
                   onChange={e => setFormData({...formData, probability: parseInt(e.target.value)})} 
                 />
                 <p className="text-[10px] text-stone-500 mt-1">100% = Luôn xuất hiện khi tìm thấy từ khóa.</p>
              </div>
              <div className="hidden md:block"></div>
              
              <div className="space-y-1.5">
                 <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Nhóm bao gộp (Inclusion Group)</label>
                 <input 
                   type="text" 
                   className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                   value={formData.group} 
                   onChange={e => setFormData({...formData, group: e.target.value})} 
                   placeholder="VD: weather, outfit"
                 />
              </div>
              <div className="space-y-1.5">
                 <label className="block text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-slate-400">Trọng số nhóm (Group Weight)</label>
                 <input 
                   type="number" 
                   className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                   value={formData.groupWeight} 
                   onChange={e => setFormData({...formData, groupWeight: parseInt(e.target.value) || 0})} 
                 />
              </div>
            </div>

            <div className="border border-stone-200 dark:border-slate-800 rounded-xl p-4 bg-stone-50 dark:bg-slate-900/30">
               <h4 className="text-[11px] uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5"><Clock size={14}/> Hiệu ứng thời gian</h4>
               <div className="grid grid-cols-3 gap-4">
                 <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-stone-600 dark:text-slate-400">Lưu giữ (Sticky)</label>
                    <input 
                      type="number" 
                      className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                      value={formData.sticky} 
                      onChange={e => setFormData({...formData, sticky: parseInt(e.target.value) || 0})} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-stone-600 dark:text-slate-400">Hồi chiêu (Cooldown)</label>
                    <input 
                      type="number" 
                      className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                      value={formData.cooldown} 
                      onChange={e => setFormData({...formData, cooldown: parseInt(e.target.value) || 0})} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-stone-600 dark:text-slate-400">Độ trễ (Delay)</label>
                    <input 
                      type="number" 
                      className="w-full bg-white dark:bg-slate-950 border border-stone-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-stone-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                      value={formData.delay} 
                      onChange={e => setFormData({...formData, delay: parseInt(e.target.value) || 0})} 
                    />
                 </div>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 p-4 bg-stone-50 dark:bg-slate-900/30 rounded-xl border border-stone-200 dark:border-slate-800">
               <label className="flex items-center gap-3 cursor-pointer group min-w-[200px]">
                  <div className="relative">
                      <input type="checkbox" checked={formData.nonRecursive} onChange={e => setFormData({...formData, nonRecursive: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-500"></div>
                  </div>
                  <span className="text-sm font-bold text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">Không cho Đệ quy<br/><span className="text-[10px] font-normal text-stone-500">Thẻ khác không kích hoạt được thẻ này</span></span>
               </label>
               <label className="flex items-center gap-3 cursor-pointer group min-w-[200px]">
                  <div className="relative">
                      <input type="checkbox" checked={formData.preventRecursion} onChange={e => setFormData({...formData, preventRecursion: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-500"></div>
                  </div>
                  <span className="text-sm font-bold text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">Ngăn Đệ quy<br/><span className="text-[10px] font-normal text-stone-500">Chặn thẻ này kích hoạt thẻ khác</span></span>
               </label>
               <label className="flex items-center gap-3 cursor-pointer group min-w-[200px]">
                  <div className="relative">
                      <input type="checkbox" checked={formData.delayUntilRecursive} onChange={e => setFormData({...formData, delayUntilRecursive: e.target.checked})} className="peer sr-only"/>
                      <div className="w-10 h-5.5 bg-stone-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-teal-500"></div>
                  </div>
                  <span className="text-sm font-bold text-stone-700 dark:text-slate-300 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">Đợi Đệ quy<br/><span className="text-[10px] font-normal text-stone-500">Đợi tới khi đệ quy mới kích hoạt</span></span>
               </label>
            </div>
          </div>
        </form>

        <div className="p-4 sm:px-6 sm:py-5 border-t border-stone-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
           <button 
             type="button" 
             onClick={onCancel}
             className="px-5 py-2.5 rounded-xl text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors uppercase cursor-pointer"
           >
             Hủy bỏ
           </button>
           <button 
             type="button" 
             onClick={handleSubmit} 
             className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all transform hover:scale-[1.02] active:scale-95 flex items-center gap-2 uppercase tracking-wider cursor-pointer shadow-lg shadow-indigo-600/20"
           >
             <Check size={16} /> Lưu Thông Tin
           </button>
        </div>
      </div>
    </div>
  );
};

export default LorebookEntryForm;

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}
