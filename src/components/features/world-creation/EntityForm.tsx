import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Sparkles, Eye, EyeOff } from 'lucide-react';
import { CharacterSheet, Entity, EntityType } from '../../../types';
import Button from '../../ui/Button';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { CharacterSheetEditor } from './CharacterSheetEditor';

interface EntityFormProps {
  initialData?: Entity;
  onSave: (entity: Omit<Entity, 'id'>) => void;
  onCancel: () => void;
  settings?: any;
}

const EntityForm: React.FC<EntityFormProps> = ({ initialData, onSave, onCancel, settings }) => {
  const [type, setType] = useState<EntityType>(initialData?.type || 'NPC');
  
  // Normal state
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [rarity, setRarity] = useState(initialData?.rarity || '');
  const [price, setPrice] = useState(initialData?.price || '');
  const [customType, setCustomType] = useState(initialData?.customType || '');

  // NPC / Character state
  const [npcData, setNpcData] = useState<Partial<CharacterSheet>>(() => {
     if (initialData?.type === 'NPC') return { ...initialData };
     return {};
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  
  const handleSave = () => {
    if (type === 'NPC') {
       if (!npcData.name?.trim()) return;
       const entity: Omit<Entity, 'id'> = {
         type,
         name: npcData.name || '',
         description: npcData.description || npcData.appearance || '',
         ...npcData
       };
       onSave(entity);
       return;
    }

    if (!name.trim()) return;
    
    const entity: Omit<Entity, 'id'> = {
      type,
      name,
      description,
      ...(type === 'ITEM' && { rarity, price }),
      ...(type === 'CUSTOM' && { customType })
    };
    onSave(entity);
  };

  const handleAiSuggest = async (field: 'description' | 'personality') => {
    if (!name.trim()) {
        return;
    }

    setIsGenerating(true);
    try {
      const contextData = { name, type, genre: '' };
      
      let currentValue = "";
      if (field === 'description') currentValue = description;
      if (field === 'personality') currentValue = npcData.personality || '';

      const modelToUse = settings?.aiModel || 'gemini-3.1-pro-preview';
      const content = await worldAiService.generateFieldContent('entity', field, contextData, modelToUse, currentValue, settings);
      
      if (field === 'description') {
          setDescription(content);
      } else {
          setNpcData(prev => ({...prev, personality: content}));
      }
    } catch (error) {
        console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiGenKnowledge = async () => {
    if (!npcData.knowledge_train?.trim()) {
        alert("Vui lòng nhập dữ liệu gốc (Knowledge Base) trước.");
        return;
    }

    setIsGenerating(true);
    try {
      const modelToUse = settings?.aiModel || 'gemini-3.1-pro-preview';
      const generatedSheet = await worldAiService.generateCharacterSheetFromKnowledge(npcData.knowledge_train, modelToUse, settings);
      setNpcData(prev => ({
        ...prev,
        ...generatedSheet,
        knowledge_train: prev.knowledge_train
      }));
    } catch (error) {
      console.error(error);
      alert("Lỗi khi tạo hình nhân vật từ Knowledge.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 dark:bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        className={`bg-[#e6ebf4] dark:bg-[#0b1329] w-full ${type === 'NPC' ? 'max-w-4xl' : 'max-w-lg'} rounded-3xl border border-[#cbd2df]/30 dark:border-[#142042]/15 shadow-[12px_12px_24px_#cbd2df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#030610,-12px_-12px_24px_#142042] overflow-hidden my-auto max-h-[85vh] flex flex-col`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 px-6 border-b border-[#cbd2df]/30 dark:border-[#142042]/20 bg-[#e6ebf4]/50 dark:bg-[#0b1329]/50 shrink-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={14} className="text-mystic-accent" />
            <span>{initialData ? 'Chỉnh Sửa Thực Thể Bách Khoa' : 'Thêm Thực Thể Bách Khoa Mới'}</span>
          </h3>
          <button 
            type="button"
            onClick={onCancel} 
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-slate-500 hover:text-red-500 transition-all cursor-pointer border border-[#cbd2df]/20"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Category SELECT with Neumorphism style */}
          <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phân loại bách khoa (Category)</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as EntityType)}
              className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-black uppercase tracking-wide focus:ring-0 cursor-pointer"
            >
              <option value="NPC" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-900 dark:text-slate-150">Nhân vật (NPC)</option>
              <option value="LOCATION" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-900 dark:text-slate-150">Địa điểm / Địa danh</option>
              <option value="ITEM" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-900 dark:text-slate-150">Vật phẩm & Cổ vật</option>
              <option value="FACTION" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-900 dark:text-slate-150">Phe phái & Tổ chức</option>
              <option value="CUSTOM" className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-900 dark:text-slate-150">Tri thức & Khái niệm (Lore)</option>
            </select>
          </div>

          {type === 'NPC' ? (
              <div className="relative border border-[#cbd2df]/30 dark:border-[#142042]/15 p-5 rounded-2xl bg-[#e6ebf4]/40 dark:bg-[#0b1329]/40 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-[#cbd2df]/20 dark:border-[#142042]/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">
                        Cung cấp tệp hồ sơ lý lịch gốc để AI tự động trích lọc gieo mầm cấu trúc nhân vật.
                      </span>
                      <button
                          type="button"
                          onClick={handleAiGenKnowledge}
                          disabled={isGenerating || !npcData.knowledge_train?.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] text-emerald-600 dark:text-emerald-400 border border-transparent rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] disabled:opacity-40"
                      >
                          {isGenerating ? (
                            <span className="animate-spin block w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full" />
                          ) : (
                            <Sparkles size={12} className="text-emerald-550 animate-pulse" />
                          )}
                          <span>AI Tự Điền Thẻ</span>
                      </button>
                  </div>

                  {/* Knowledge base textwell */}
                  <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                      <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Tư liệu thính lực gốc (Knowledge Base)</label>
                      <textarea
                          value={npcData.knowledge_train || ''}
                          onChange={(e) => setNpcData(prev => ({ ...prev, knowledge_train: e.target.value }))}
                          placeholder="Ví dụ: Lê Lợi (1385 – 1433) thủ lĩnh khởi nghĩa Lam Sơn chống quân Minh..."
                          className="w-full h-16 bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 resize-none custom-scrollbar"
                      />
                  </div>

                  <CharacterSheetEditor 
                      data={npcData} 
                      onChange={(field, value) => setNpcData(prev => ({...prev, [field]: value}))} 
                  />
              </div>
          ) : (
            <div className="space-y-4">
              {/* Name field */}
              <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Tên thực thể / bách khoa</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder={
                    type === 'LOCATION' ? "Ví dụ: Ải Chi Lăng, Tây Đô..." :
                    type === 'ITEM' ? "Ví dụ: Kiếm Thuận Thiên, Sách Lập Cực..." :
                    type === 'FACTION' ? "Ví dụ: Nghĩa quân Lam Sơn, Hội Tao Đàn..." :
                    "Ví dụ: Luật âm dương, Thuật bói toán..."
                  }
                />
              </div>

              {/* Description field */}
              <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                <div className="flex justify-between items-center pb-1 border-b border-[#cbd2df]/15 dark:border-[#142042]/5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Nội dung mục từ (Entry Content)</label>
                    <button 
                      type="button"
                      onClick={() => setIsPreview(!isPreview)}
                      className="text-slate-450 hover:text-mystic-accent transition-colors cursor-pointer"
                      title={isPreview ? "Chỉnh sửa" : "Xem trước Markdown"}
                    >
                      {isPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleAiSuggest('description')} 
                    disabled={isGenerating || !name.trim()}
                    className="flex items-center gap-1 text-[9px] font-extrabold uppercase text-mystic-accent hover:text-blue-500 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {isGenerating ? (
                      <span className="animate-spin block w-2.5 h-2.5 border-2 border-mystic-accent border-t-transparent rounded-full" />
                    ) : (
                      <Sparkles size={11} className="text-mystic-accent animate-pulse" />
                    )} 
                    <span>{description ? "AI Cải tiến" : "AI Gợi ý"}</span>
                  </button>
                </div>

                {isPreview ? (
                  <div className="w-full h-44 bg-transparent outline-none overflow-y-auto custom-scrollbar text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                    <MarkdownRenderer content={description || "*Chưa có nội dung mô tả.*"} />
                  </div>
                ) : (
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-44 bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium resize-none focus:ring-0 custom-scrollbar leading-relaxed"
                    placeholder={
                      type === 'LOCATION' ? "Mô tả chi tiết địa hình, vai trò phòng hiểm, cảnh sắc đặc trưng..." :
                      type === 'ITEM' ? "Mô tả nguồn gốc, sức mạnh bí mật hay tác dụng phi thường của bảo vật..." :
                      type === 'FACTION' ? "Mô tả cơ cấu tổ chức, tôn chỉ hành động, thế lực hay mục tiêu cốt lõi..." :
                      "Giải nghĩa khái niệm, quy tắc vận hành hay nguồn tri thức độc đáo tồn tại trong bối cảnh thế giới..."
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Neumorphic subtle actions */}
        <div className="p-4 px-6 border-t border-[#cbd2df]/30 dark:border-[#142042]/20 bg-[#e6ebf4]/80 dark:bg-[#0b1329]/80 flex justify-end gap-3 shrink-0">
          <button 
            type="button"
            onClick={onCancel}
            className="py-2 px-4 text-xs font-black bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/35 dark:border-[#142042]/20 rounded-2xl text-slate-600 dark:text-slate-350 hover:text-mystic-accent transition-all cursor-pointer"
          >
            Hủy
          </button>
          
          <button 
            type="button"
            onClick={handleSave}
            className="text-white bg-gradient-to-br from-mystic-accent to-blue-600 hover:from-blue-500 hover:to-mystic-accent font-black uppercase tracking-wider text-xs py-2 px-5 rounded-2xl shadow-[4px_4px_8px_rgba(56,189,248,0.25)] hover:shadow-[5px_5px_12px_rgba(56,189,248,0.4)] transition-all cursor-pointer border border-transparent flex items-center gap-1.5"
          >
            <Save size={13} className="fill-white" /> <span>Lưu Thẻ</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EntityForm;
