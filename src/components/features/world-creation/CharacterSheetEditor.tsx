import React, { useState } from 'react';
import { CharacterSheet } from '../../../types';
import { useWorldCreationStore } from '../../../store/worldCreationStore';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { dbService } from '../../../services/db/indexedDB';
import { 
    User, Smile, BookOpen, Volume2, Sparkles, Check, Trash2, Tags, Info, ChevronDown, ChevronUp, Edit2
} from 'lucide-react';

export interface CustomFieldDefinition {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select';
    options?: string[];
    placeholder?: string;
    description?: string;
    section?: 'identity' | 'concept' | 'psyche' | 'skills_limits' | 'meta';
}

export interface CustomSchemaTemplate {
    id: string;
    name: string;
    description?: string;
    fields: CustomFieldDefinition[];
}

const DEFAULT_TEMPLATES: CustomSchemaTemplate[] = [
    {
        id: 'rpg-kiem-hiep',
        name: 'RPG Kiếm Hiệp/Tu Tiên',
        description: 'Phù hợp với bối cảnh kiếm hiệp, huyền huyễn, tu chân tiên hiệp.',
        fields: [
            { id: 'tu_vi', label: 'Cấp độ Tu Vi / Cảnh Giới', type: 'select', options: ['Phàm Nhân', 'Luyện Khí Kỳ', 'Trúc Cơ Kỳ', 'Kim Đan Kỳ', 'Nguyên Anh Kỳ', 'Hóa Thần Kỳ', 'Thượng Cảnh'], description: 'Trình độ cảnh giới sức mạnh nội tại.', section: 'skills_limits' },
            { id: 'mon_phai', label: 'Môn Phái / Thế Lực', type: 'text', placeholder: 'Võ Đang, Đường Môn, Tinh Thần Điện...', description: 'Nguồn gốc gốc võ học, hệ phái.', section: 'identity' },
            { id: 'linh_can', label: 'Linh Căn Nguyên Tố', type: 'text', placeholder: 'Hỏa hệ Thiên Linh Căn, Lôi linh căn...', description: 'Tư chất nguyên tố bẩm sinh.', section: 'skills_limits' }
        ]
    },
    {
        id: 'rpg-fantasy-status',
        name: 'RPG Fantasy Bản Thần Thoại',
        description: 'Mẫu chỉ số RPG cổ điển lớp nhân vật thần thoại phương Tây.',
        fields: [
            { id: 'job_class', label: 'Lớp Nhân Vật (Class)', type: 'select', options: ['Đấu Sĩ', 'Pháp Sư', 'Sát Thủ', 'Trị Liệu', 'Cung Thủ'], placeholder: 'Chọn chức nghiệp...', description: 'Ưu thế bổ trợ chiến đấu.', section: 'identity' },
            { id: 'stats_primary', label: 'Chỉ Số Chiến Lực', type: 'text', placeholder: 'HP: 1500 / MP: 500 / ATK: 150', description: 'Các thông số trị giá sinh mệnh thể hiện sức chiến đấu.', section: 'skills_limits' }
        ]
    }
];

interface CharacterSheetEditorProps {
    data: Partial<CharacterSheet>;
    onChange: (field: keyof CharacterSheet, value: any) => void;
}

const ARCHETYPES = [
    { id: 'Protagonist', label: 'Nhân vật chính', desc: 'Trung tâm câu chuyện, đối mặt xung đột chủ đạo.' },
    { id: 'Antagonist', label: 'Nhân vật phản diện', desc: 'Thế lực phản nghịch, tạo chướng ngại cho nhân chính.' },
    { id: 'Mentor & Ally', label: 'Đồng minh & Chỉ bảo', desc: 'Đồng hành, cung cấp tri thức hỗ trợ hành trình.' },
    { id: 'Foil', label: 'Đối trọng (Foil)', desc: 'Tính cách tương phản để làm rực rỡ nét riêng nhân vật.' }
];

export const CharacterSheetEditor: React.FC<CharacterSheetEditorProps> = ({ data, onChange }) => {
    const worldGenre = useWorldCreationStore(state => state.world.genre);
    const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [templates] = useState<CustomSchemaTemplate[]>(() => {
        const saved = dbService.getKeyValueSync('tawa_custom_schemas_v2');
        if (saved) {
            try {
                return typeof saved === "string" ? JSON.parse(saved) : saved;
            } catch (e) {
                console.error("Failed to parse custom schemas in creator:", e);
            }
        }
        return DEFAULT_TEMPLATES;
    });

    const handleSchemaChange = (schemaId: string) => {
        onChange('customSchemaId', schemaId);
        if (schemaId === 'none') {
            onChange('customFields', []);
            return;
        }
        
        const template = templates.find(t => t.id === schemaId);
        if (!template) return;
        
        const existingMap = new Map((data.customFields || []).map(f => [f.label, f.value]));
        const nextFields = template.fields.map(f => ({
            label: f.label,
            value: existingMap.get(f.label) || ''
        }));
        
        onChange('customFields', nextFields);
    };

    const handleCustomFieldChange = (label: string, value: string) => {
        const nextFields = (data.customFields || []).map(f => 
            f.label === label ? { ...f, value } : f
        );
        onChange('customFields', nextFields);
    };

    const handleCustomFieldAiSuggest = async (fieldLabel: string, fieldDesc?: string) => {
        setIsGenerating(prev => ({ ...prev, [fieldLabel]: true }));
        try {
            const contextData = {
                name: data.name || "Bạch y hiệp khách",
                gender: data.gender || "Nam",
                age: data.age || "20",
                genre: worldGenre || "Huyền thoại"
            };
            
            const fieldHint = fieldDesc ? ` (${fieldDesc})` : '';
            const prompt = `Hãy tạo nội dung phù hợp cho trường thuộc tính "${fieldLabel}"${fieldHint} của nhân vật chính trong bối cảnh thể loại "${contextData.genre}". Tên nhân vật: ${contextData.name}, Giới tính: ${contextData.gender}, Tuổi: ${contextData.age}. Tiểu sử tóm tắt: ${data.background || 'Chưa có'}. Hãy trả về một mô tả ngắn gọn, súc tích (khoảng 1-2 câu hoặc cụm từ phù hợp độ dài).`;
            
            const generated = await worldAiService.generateFieldContent(
                'player',
                'custom_field',
                contextData,
                'gemini-3.1-pro-preview',
                prompt,
                {} as any
            );
            
            if (generated && !generated.startsWith("Không thể")) {
                const nextFields = (data.customFields || []).map(f => 
                    f.label === fieldLabel ? { ...f, value: generated } : f
                );
                onChange('customFields', nextFields);
            }
        } catch (error) {
            console.error("AI gợi ý lỗi custom field:", error);
        } finally {
            setIsGenerating(prev => ({ ...prev, [fieldLabel]: false }));
        }
    };

    const handleAiSuggest = async (field: 'name' | 'gender' | 'age' | 'background' | 'skills' | 'appearance' | 'personality' | 'voiceAndTone') => {
        setIsGenerating(prev => ({ ...prev, [field]: true }));
        try {
            const contextData = {
                name: data.name || "Bạch y hiệp khách",
                gender: data.gender || "Nam",
                age: data.age || "20",
                genre: worldGenre || "Huyền ảo"
            };
            const generated = await worldAiService.generateFieldContent(
                'player', 
                field, 
                contextData, 
                'gemini-3.1-pro-preview', 
                (data as any)[field] || '',
                {} as any
            );
            if (generated && !generated.startsWith("Không thể")) {
                onChange(field, generated);
            }
        } catch (error) {
            console.error("AI gợi ý lỗi:", error);
        } finally {
            setIsGenerating(prev => ({ ...prev, [field]: false }));
        }
    };

    return (
        <div className="space-y-6 max-h-[72vh] overflow-y-auto pr-1.5 custom-scrollbar pb-6">

            {/* Custom Schema Setup Selector */}
            <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                        <Tags size={14} className="text-mystic-accent" />
                        <span>Sơ đồ Thuộc tính Mở rộng (RPG Custom Schema)</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold bg-amber-200/10 dark:bg-amber-450/10 px-2 py-0.5 rounded-full text-amber-600 dark:text-amber-400">
                        Hỗ trợ AI tạo nhanh
                    </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <div className="md:col-span-1">
                        <select
                            value={data.customSchemaId || 'none'}
                            onChange={(e) => handleSchemaChange(e.target.value)}
                            className="w-[100%] bg-[#cbd2df]/30 dark:bg-[#030610]/40 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-xs border border-transparent outline-none focus:border-mystic-accent font-semibold cursor-pointer"
                        >
                            <option value="none">❌ Không áp dụng sơ đồ</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {data.customSchemaId && data.customSchemaId !== 'none' ? (
                            <span>
                                🌟 Bạn đã chọn sơ đồ: <strong className="text-slate-700 dark:text-slate-300">{(templates.find(t => t.id === data.customSchemaId))?.name}</strong>. Các thuộc tính tùy biến này sẽ tự động tích hợp khi sử dụng tính năng <strong>AI tạo nhanh</strong> hoặc chỉnh sửa bên dưới.
                            </span>
                        ) : (
                            <span>
                                Chưa chọn sơ đồ nâng cao. Chỉ sử dụng các trường thuộc tính tiêu chuẩn cơ bản. Bạn có thể tự thiết kế sơ đồ mới tại tab <strong>Bản Thiết Kế Sơ Đồ Custom</strong>.
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Schema Fields Section */}
            {data.customSchemaId && data.customSchemaId !== 'none' && (
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
                    <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-[#cbd2df]/20 dark:border-[#142042]/5 pb-1 flex items-center gap-1">
                        <span>🔱 THUỘC TÍNH DÀNH RIÊNG CHO SƠ ĐỒ: {(templates.find(t => t.id === data.customSchemaId))?.name?.toUpperCase()}</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(data.customFields || []).map((field, idx) => {
                            const template = templates.find(t => t.id === data.customSchemaId);
                            const fieldDef = template?.fields.find(f => f.label === field.label);
                            
                            return (
                                <div key={idx} className="flex flex-col p-3 bg-white/45 dark:bg-slate-900/45 rounded-xl border border-[#cbd2df]/10 dark:border-[#142042]/5 space-y-1.5 relative">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                                            {field.label}
                                        </span>
                                        <button 
                                            type="button" 
                                            disabled={!!isGenerating[field.label]}
                                            onClick={() => handleCustomFieldAiSuggest(field.label, fieldDef?.description)}
                                            className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-[#cbd2df]/10 dark:border-[#142042]/5 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-transform"
                                        >
                                            <Sparkles size={8} className={isGenerating[field.label] ? 'animate-spin' : ''} />
                                            <span>AI tạo</span>
                                        </button>
                                    </div>
                                    
                                    {fieldDef?.type === 'select' ? (
                                        <select
                                            value={field.value || ''}
                                            onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
                                            className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/40 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100 text-xs border border-transparent outline-none focus:border-mystic-accent font-semibold"
                                        >
                                            <option value="">-- Chưa chọn --</option>
                                            {(fieldDef.options || []).map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : fieldDef?.type === 'textarea' ? (
                                        <textarea
                                            value={field.value || ''}
                                            onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
                                            placeholder={fieldDef.placeholder || 'Điền giá trị...'}
                                            rows={2}
                                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar resize-none"
                                        />
                                    ) : (
                                        <input 
                                            type="text"
                                            value={field.value || ''}
                                            onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
                                            placeholder={fieldDef?.placeholder || 'Điền giá trị...'}
                                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                                        />
                                    )}
                                    
                                    {fieldDef?.description && (
                                        <div className="text-[9px] text-slate-500 dark:text-slate-400 pt-1 border-t border-[#cbd2df]/5 dark:border-[#142042]/5 font-normal">
                                            {fieldDef.description}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Bento Grid layout containing exact fields for World Creator Remake */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                
                {/* 1. Tên */}
                <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5 relative">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <User size={13} className="text-mystic-accent" />
                            <span>Tên nhân vật</span>
                        </label>
                        <button 
                            type="button" 
                            disabled={isGenerating['name']}
                            onClick={() => handleAiSuggest('name')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-inner cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['name'] ? 'animate-spin' : ''} />
                            <span>AI tạo</span>
                        </button>
                    </div>
                    <input 
                        type="text"
                        value={data.name || ''}
                        onChange={(e) => onChange('name', e.target.value)}
                        placeholder="Có thể điền tên tùy ý..."
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-[#cbd2df]/10 dark:border-[#142042]/5 pt-1.5 font-normal">
                        X xưng danh hoặc tôn danh giang hồ đặc trưng bối cảnh.
                    </div>
                </div>

                {/* 2. Giới tính */}
                <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Giới tính</label>
                    <div className="grid grid-cols-4 gap-1.5 my-1">
                        {['Nam', 'Nữ', 'Khác', 'Ẩn'].map(g => {
                            const isSelected = data.gender === g || (!data.gender && g === 'Nam');
                            return (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => onChange('gender', g)}
                                    className={`py-1 text-[11px] font-bold rounded-xl border transition-all ${
                                        data.gender === g
                                            ? 'bg-[#e6ebf4] dark:bg-[#0b1329] border-mystic-accent text-mystic-accent font-extrabold shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]'
                                            : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-650 dark:text-slate-400 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] hover:text-mystic-accent'
                                    }`}
                                >
                                    {g}
                                </button>
                            );
                        })}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 pt-1 border-t border-[#cbd2df]/10 dark:border-[#142042]/5 font-normal">
                        Bản ngã của sinh mệnh trong câu chuyện phiêu lưu.
                    </div>
                </div>

                {/* 3. Tuổi */}
                <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Tuổi</label>
                        <button 
                            type="button" 
                            disabled={isGenerating['age']}
                            onClick={() => handleAiSuggest('age')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['age'] ? 'animate-spin' : ''} />
                            <span>AI tạo</span>
                        </button>
                    </div>
                    <input 
                        type="text"
                        value={data.age || ''}
                        onChange={(e) => onChange('age', e.target.value)}
                        placeholder="Ví dụ: 18, 500 tuổi, Phàm nhân..."
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-[#cbd2df]/10 dark:border-[#142042]/5 pt-1.5 font-normal">
                        Xác định số niên tuế hoặc chu kỳ sống bẩm sinh.
                    </div>
                </div>

                {/* 4. Tông màu / Khí chất */}
                <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Đại Vai Trò Câu Chuyện</label>
                    <select
                        value={data.narrativeRole || 'Protagonist'}
                        onChange={(e) => onChange('narrativeRole', e.target.value)}
                        className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/40 rounded-xl px-2.5 py-1 text-slate-900 dark:text-slate-100 text-xs border border-transparent outline-none focus:border-mystic-accent font-semibold"
                    >
                        {ARCHETYPES.map(role => (
                            <option key={role.id} value={role.id} className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">
                                {role.label}
                            </option>
                        ))}
                    </select>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-[#cbd2df]/10 dark:border-[#142042]/5 pt-1.5 font-normal">
                        Vị thế tự chọn nhân văn khởi biến cốt truyện.
                    </div>
                </div>

                {/* 5. Tiểu sử */}
                <div className="md:col-span-2 flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1">
                            <BookOpen size={13} className="text-mystic-accent" />
                            <span>Tiểu sử</span>
                        </label>
                        <button 
                            type="button" 
                            disabled={isGenerating['background']}
                            onClick={() => handleAiSuggest('background')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2.5 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['background'] ? 'animate-spin' : ''} />
                            <span>AI Điền/Gợi ý</span>
                        </button>
                    </div>
                    <textarea 
                        value={data.background || ''}
                        onChange={(e) => onChange('background', e.target.value)}
                        placeholder="Hành trạng quá khứ, xuất xứ lai lịch..."
                        rows={3}
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar resize-none"
                    />
                </div>

                {/* 6. Đặc điểm nhân vật */}
                <div className="md:col-span-2 flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Đặc điểm nhân vật (Traits, Sức mạnh & Kỹ năng)</label>
                        <button 
                            type="button" 
                            disabled={isGenerating['skills']}
                            onClick={() => handleAiSuggest('skills')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2.5 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['skills'] ? 'animate-spin' : ''} />
                            <span>AI Điền/Gợi ý</span>
                        </button>
                    </div>
                    <textarea 
                        value={data.skills || ''}
                        onChange={(e) => onChange('skills', e.target.value)}
                        placeholder="Năng lực đặc thù, thiên bẩm dị linh, tài võ sở hữu..."
                        rows={3}
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar resize-none"
                    />
                </div>

                {/* 7. Ngoại hình */}
                <div className="md:col-span-2 flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Ngoại hình</label>
                        <button 
                            type="button" 
                            disabled={isGenerating['appearance']}
                            onClick={() => handleAiSuggest('appearance')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2.5 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['appearance'] ? 'animate-spin' : ''} />
                            <span>AI Điền/Gợi ý</span>
                        </button>
                    </div>
                    <textarea 
                        value={data.appearance || ''}
                        onChange={(e) => onChange('appearance', e.target.value)}
                        placeholder="Trang phục, dáng vẻ vũ lực, khí chất..."
                        rows={3}
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar resize-none"
                    />
                </div>

                {/* 8. Tính cách */}
                <div className="md:col-span-2 flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1">
                            <Smile size={13} className="text-mystic-accent" />
                            <span>Tính cách</span>
                        </label>
                        <button 
                            type="button" 
                            disabled={isGenerating['personality']}
                            onClick={() => handleAiSuggest('personality')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2.5 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['personality'] ? 'animate-spin' : ''} />
                            <span>AI Điền/Gợi ý</span>
                        </button>
                    </div>
                    <textarea 
                        value={data.personality || ''}
                        onChange={(e) => onChange('personality', e.target.value)}
                        placeholder="Nét tính cách chủ đạo, chuẩn mực hành vi..."
                        rows={3}
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar resize-none"
                    />
                </div>

                {/* 9. Giọng điệu nhân vật */}
                <div className="md:col-span-2 flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1">
                            <Volume2 size={13} className="text-mystic-accent" />
                            <span>Giọng điệu nhân vật</span>
                        </label>
                        <button 
                            type="button" 
                            disabled={isGenerating['voiceAndTone']}
                            onClick={() => handleAiSuggest('voiceAndTone')}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 bg-[#e6ebf4] dark:bg-[#0b1329] px-2.5 py-0.5 rounded-lg border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] cursor-pointer"
                        >
                            <Sparkles size={10} className={isGenerating['voiceAndTone'] ? 'animate-spin' : ''} />
                            <span>AI Điền/Gợi ý</span>
                        </button>
                    </div>
                    <textarea 
                        value={data.voiceAndTone || ''}
                        onChange={(e) => onChange('voiceAndTone', e.target.value)}
                        placeholder="Hành văn khi vấn nói, khẩu ngữ xưng hô đặc thù..."
                        rows={3}
                        className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-medium focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar resize-none"
                    />
                </div>

            </div>

            {/* Custom attributes drawer */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl border border-[#cbd2df]/30 dark:border-[#142042]/15 p-4 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042]">
                <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider cursor-pointer font-sans"
                >
                    <span>🛠️ Tùy chọn nâng cao & Thuộc tính phụ</span>
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showAdvanced && (
                    <div className="mt-4 pt-4 border-t border-[#cbd2df]/25 dark:border-[#142042]/10 space-y-4">
                        <div className="flex flex-col space-y-1.5 p-3.5 bg-slate-100/40 dark:bg-slate-900/40 rounded-xl">
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Mục tiêu chí hướng chính (Goal)</span>
                            <input 
                                type="text"
                                value={data.goal || ''}
                                onChange={(e) => onChange('goal', e.target.value)}
                                placeholder="Gia phong Chân Tiên hành sơn..."
                                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0"
                            />
                        </div>
                        <div className="flex flex-col space-y-1.5 p-3.5 bg-slate-100/40 dark:bg-slate-900/40 rounded-xl">
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Giá trị cốt lõi cá nhân (Core values)</span>
                            <input 
                                type="text"
                                value={data.coreValues || ''}
                                onChange={(e) => onChange('coreValues', e.target.value)}
                                placeholder="Nhân quả, Danh phẩm..."
                                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0"
                            />
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
