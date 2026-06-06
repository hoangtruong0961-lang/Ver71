import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    User, Calendar, Smile, BookOpen, Volume2, Sparkles, Check, Heart, HelpCircle, 
    Plus, Trash2, Tags, Download, Upload, Settings, Info, RefreshCw,
    ArrowUp, ArrowDown, ChevronRight, FileJson, ArrowLeft
} from 'lucide-react';
import { GameState, NavigationProps } from '../../../types';
import { dbService } from '../../../services/db/indexedDB';

export interface CustomFieldDefinition {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select';
    options?: string[];
    placeholder?: string;
    description?: string;
    section?: 'identity' | 'concept' | 'psyche' | 'skills_limits' | 'meta'; // Deeper layout mapping
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
        name: 'RPG Kiếm Hiệp CoT / Tu Tiên',
        description: 'Phù hợp với bối cảnh kiếm hiệp, huyền huyễn, tu chân tiên hiệp.',
        fields: [
            { id: 'tu_vi', label: 'Cấp độ Tu Vi / Cảnh Giới', type: 'select', options: ['Phàm Nhân', 'Luyện Khí Kỳ', 'Trúc Cơ Kỳ', 'Kim Đan Kỳ', 'Nguyên Anh Kỳ', 'Hóa Thần Kỳ', 'Cực Hạn Thượng Cảnh'], placeholder: 'Chọn cảnh giới tu vi...', description: 'Trình độ cảnh giới sức mạnh nội tại.', section: 'skills_limits' },
            { id: 'mon_phai', label: 'Môn Phái / Thế Lực', type: 'select', options: ['Thiếu Lâm Tự', 'Võ Đang Phái', 'Nga Mi Phái', 'Đường Môn', 'Ma Giáo', 'Nhất Đại Tán Tu'], placeholder: 'Chọn môn phái...', description: 'Nguồn gốc gốc võ học, võ hệ tâm pháp của nhân vật.', section: 'identity' },
            { id: 'linh_can', label: 'Linh Căn Nguyên Tố', type: 'text', placeholder: 'Hỏa hệ Thiên Linh Căn, Ngũ Hành tạp linh căn, v.v.', description: 'Tư chất ngũ hành, nguyên tố phong hệ bẩm sinh.', section: 'skills_limits' },
            { id: 'phap_bao', label: 'Bản Mệnh Pháp Bảo', type: 'textarea', placeholder: 'Huyền Thiết Trọng Kiếm, Thiên Ma Độc Châm v.v...', description: 'Thánh khí hoặc binh khí độc quyền hỗ trợ chiến đấu.', section: 'concept' }
        ]
    },
    {
        id: 'rpg-fantasy-status',
        name: 'RPG Fantasy Bản Thần Thoại',
        description: 'Mẫu chỉ số RPG cổ điển lớp nhân vật thần thoại phương Tây.',
        fields: [
            { id: 'job_class', label: 'Lớp Nhân Vật (Class)', type: 'select', options: ['Đấu Sĩ (Warrior)', 'Pháp Sư (Mage)', 'Sát Thủ (Rogue)', 'Trị Liệu (Cleric)', 'Cung Thủ (Ranger)'], placeholder: 'Chọn chức nghiệp...', description: 'Thiên hướng chiến thuật và phân khúc chiến đấu.', section: 'identity' },
            { id: 'stats_primary', label: 'Chỉ Số (HP / MP / ATK)', type: 'text', placeholder: 'HP: 1500 / MP: 500 / ATK: 150', description: 'Các thông số trị giá sinh mệnh thể hiện sức chiến đấu.', section: 'skills_limits' },
            { id: 'elemental_affinity', label: 'Hệ Ma Pháp tương hệ', type: 'select', options: ['Hỏa (Fire)', 'Thủy (Water)', 'Lôi (Lightning)', 'Phong (Wind)', 'Ánh Sáng (Light)', 'Bóng Tối (Dark)'], placeholder: 'Chọn nguyên tố thích ứng...', description: 'Sự tương hợp sức mạnh nguyên tố bẩm sinh.', section: 'skills_limits' },
            { id: 'passive_ability', label: 'Năng Lực Đặc Biệt (Passive)', type: 'textarea', placeholder: 'Hồi phục năng lượng trong bóng tối, giảm 20% sát thương chí mạng...', description: 'Thuộc tính bị động độc quyền bổ trợ.', section: 'meta' }
        ]
    },
    {
        id: 'cyberpunk-scifi',
        name: 'Cyberpunk & Tương Lai Giả Tưởng',
        description: 'Phù hợp bối cảnh khoa học viễn tưởng, đô thị ngầm, cấy ghép máy móc.',
        fields: [
            { id: 'cybernetics', label: 'Cấy Ghép Sinh Học (Cyberware)', type: 'textarea', placeholder: 'Mắt quét hồng ngoại v4, Hộp sọ tăng cường tốc độ phản xạ v2...', description: 'Các bộ phận nhân tạo thế hệ cơ giới tích hợp.', section: 'concept' },
            { id: 'faction', label: 'Chi Phái / Tổ Chức Đô Thị', type: 'text', placeholder: 'Thành viên Tập đoàn Arasaka, Kỹ sư thế giới ngầm, NETRUNNER...', description: 'Mối quan hệ chính trị tương lai trong đô thị siêu cấp.', section: 'identity' },
            { id: 'hacking_level', label: 'Cấp Độ Hacking (1-10)', type: 'number', placeholder: '5', description: 'Năng lực xâm nhập luồng dữ liệu ảo.', section: 'skills_limits' }
        ]
    }
];

export const SchemaDesignerScreen: React.FC<NavigationProps> = ({ onNavigate }) => {
    const [templates, setTemplates] = useState<CustomSchemaTemplate[]>(() => {
        const saved = dbService.getKeyValueSync('tawa_custom_schemas_v2');
        if (saved) {
            try {
                return typeof saved === "string" ? JSON.parse(saved) : saved;
            } catch (e) {
                console.error("Failed to parse custom schemas:", e);
            }
        }
        return DEFAULT_TEMPLATES;
    });

    useEffect(() => {
        dbService.setKeyValue('tawa_custom_schemas_v2', templates);
    }, [templates]);

    const initialDesignerId = templates.length > 0 ? templates[0].id : '';
    const [designerSchemaId, setDesignerSchemaId] = useState<string>(initialDesignerId);

    useEffect(() => {
        if (templates.length > 0 && !templates.some(t => t.id === designerSchemaId)) {
            setDesignerSchemaId(templates[0].id);
        }
    }, [templates, designerSchemaId]);

    const activeDesignerSchema = templates.find(t => t.id === designerSchemaId) || templates[0];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [editStatus, setEditStatus] = useState<string | null>(null);

    const handleDeleteTemplate = (idToDelete: string) => {
        if (templates.length <= 1) {
            setImportError("Bạn cần giữ lại ít nhất một Sơ đồ bối cảnh!");
            setTimeout(() => setImportError(null), 3000);
            return;
        }
        setTemplates(prev => {
            const next = prev.filter(t => t.id !== idToDelete);
            return next;
        });
        setEditStatus("Đã xóa Sơ đồ cấu hình thành công!");
        setTimeout(() => setEditStatus(null), 3000);
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0f14] text-slate-100 font-sans relative overflow-hidden">
            {/* Top Navigation Panel */}
            <div className="flex-none h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => onNavigate(GameState.MENU)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        title="Quay lại Menu"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="w-[1px] h-5 bg-slate-800 mx-1" />
                    <div className="p-2 bg-gradient-to-tr from-indigo-500/10 to-mystic-accent/10 text-mystic-accent border border-mystic-accent/20 rounded-xl">
                        <Tags size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-150 leading-none">Bản Thiết Kế Sơ Đồ Custom</h2>
                        <p className="text-[10px] text-slate-400 font-semibold tracking-wide mt-1">
                            Tạo dựng, chỉnh sửa cấu trúc & bối cảnh thuộc tính bọc nhân vật hoàn chỉnh
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {editStatus && (
                        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-1.5 animate-pulse">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                            {editStatus}
                        </div>
                    )}
                    {importError && (
                        <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-ping"></span>
                            {importError}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Workspace Body */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10">
                
                {/* Left Panel: Schema Selection & Creation list */}
                <div className="w-full md:w-80 border-r border-slate-850 bg-slate-950/30 flex flex-col p-5 space-y-4">
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Tags size={13} className="text-mystic-accent" />
                            <span>Bộ Sơ đồ hiện có</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">Bấm chọn một sơ đồ để bắt đầu can thiệp thủ thuật</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {templates.map(t => {
                            const isSelected = t.id === designerSchemaId;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setDesignerSchemaId(t.id)}
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-1 cursor-pointer select-none group relative ${
                                        isSelected
                                            ? 'bg-mystic-accent/[0.04] border-mystic-accent/60 text-mystic-accent shadow-[0_4px_12px_rgba(56,189,248,0.05)]'
                                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80 text-slate-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold tracking-tight text-slate-100 group-hover:text-mystic-accent transition-colors leading-none">
                                            {t.name}
                                        </span>
                                        <ChevronRight size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'text-mystic-accent opacity-100' : 'text-slate-500'}`} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-relaxed font-medium">
                                        {t.description || 'Không có mô tả chi tiết của sơ đồ này.'}
                                    </p>
                                    <div className="mt-2.5 flex items-center gap-1 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wide bg-slate-900 px-2 py-0.5 rounded-md w-fit">
                                        <span>Trường: {t.fields?.length || 0}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Bottom Action buttons */}
                    <div className="pt-2 border-t border-slate-850 space-y-2.5">
                        <button
                            type="button"
                            onClick={() => {
                                const nextId = 'custom-' + crypto.randomUUID().slice(0, 8);
                                const newTpl: CustomSchemaTemplate = {
                                    id: nextId,
                                    name: 'Sơ đồ bối cảnh mới ' + (templates.length + 1),
                                    description: 'Hỗ trợ can thiệp các bối cảnh thế giới độc bản cho nhân vật cốt cách.',
                                    fields: [
                                        { id: 'f-' + Date.now(), label: 'Mục Thuộc Tính Mẫu', type: 'text', placeholder: 'Gợi ý nhập giá trị...', description: 'Mô tả bối cảnh để AI hiểu.', section: 'skills_limits' }
                                    ]
                                };
                                setTemplates(prev => [newTpl, ...prev]);
                                setDesignerSchemaId(nextId);
                                setEditStatus("Đã khởi tạo Sơ đồ bọc mới thành công!");
                                setTimeout(() => setEditStatus(null), 3000);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-mystic-accent/10 hover:bg-mystic-accent border border-mystic-accent/30 hover:border-mystic-accent text-mystic-accent hover:text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>Tạo Sơ đồ bọc mới</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("Bạn có chắc chắn muốn khôi phục danh sách Sơ đồ về mặc định? Các sơ đồ tùy chỉnh tự thiết kế sẽ bị ghi đè.")) {
                                    setTemplates(DEFAULT_TEMPLATES);
                                    setDesignerSchemaId(DEFAULT_TEMPLATES[0].id);
                                    setEditStatus("Đã tải lại cấu trúc Sơ đồ mặc định!");
                                    setTimeout(() => setEditStatus(null), 3000);
                                }
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 hover:bg-slate-850 text-slate-400 border border-slate-800 rounded-xl text-[10px] uppercase font-bold transition-all cursor-pointer"
                        >
                            <RefreshCw size={11} />
                            <span>Khôi phục mặc định</span>
                        </button>
                    </div>
                </div>

                {/* Right Panel: Active Schema Designer Workspace */}
                <div className="flex-1 bg-slate-900/10 flex flex-col overflow-hidden">
                    {activeDesignerSchema ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Editor Area Top Panel - Name and Description of active Schema */}
                            <div className="p-6 border-b border-slate-850/60 bg-slate-950/15 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-none">
                                <div className="flex-grow space-y-3 max-w-xl">
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-widest">Tên Sơ đồ bối cảnh</label>
                                        <input
                                            type="text"
                                            value={activeDesignerSchema.name}
                                            onChange={(e) => setTemplates(t => t.map(x => x.id === designerSchemaId ? { ...x, name: e.target.value } : x))}
                                            placeholder="Nhập tên sơ đồ..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-mystic-accent transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-widest">Tác dụng / Nhật ký bối cảnh</label>
                                        <input
                                            type="text"
                                            value={activeDesignerSchema.description || ''}
                                            onChange={(e) => setTemplates(t => t.map(x => x.id === designerSchemaId ? { ...x, description: e.target.value } : x))}
                                            placeholder="Mô tả tóm tắt tác dụng Sơ đồ này..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-mystic-accent transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Import / Export actions of active schema */}
                                <div className="flex md:flex-col gap-2 flex-none justify-end">
                                    <div className="flex gap-2.5">
                                        {/* Export Button */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                try {
                                                    const jsonStr = JSON.stringify(activeDesignerSchema, null, 2);
                                                    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
                                                    const url = URL.createObjectURL(blob);
                                                    const downloadAnchor = document.createElement('a');
                                                    downloadAnchor.href = url;
                                                    downloadAnchor.setAttribute("download", `${activeDesignerSchema.name.toLowerCase().replace(/\s+/g, '_')}_schema.json`);
                                                    document.body.appendChild(downloadAnchor);
                                                    downloadAnchor.click();
                                                    downloadAnchor.remove();
                                                    URL.revokeObjectURL(url);
                                                    setEditStatus("Đã xuất file cấu trúc bọc!");
                                                    setTimeout(() => setEditStatus(null), 3000);
                                                } catch (err) {
                                                    setImportError("Lỗi không thể sinh file JSON.");
                                                    setTimeout(() => setImportError(null), 3000);
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer"
                                            title="Tải cấu trúc sơ đồ hiện hành về máy tính"
                                        >
                                            <Download size={12} />
                                            <span>Xuất File JSON</span>
                                        </button>

                                        {/* Import Hidden Input */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (evt) => {
                                                    try {
                                                        const parsed = JSON.parse(evt.target?.result as string);
                                                        if (!parsed.name || !Array.isArray(parsed.fields)) {
                                                            throw new Error("Tệp không đúng cấu trúc (thiếu 'name' hoặc danh sách rỗng 'fields').");
                                                        }
                                                        const imported: CustomSchemaTemplate = {
                                                            id: 'imported-' + crypto.randomUUID().slice(0, 8),
                                                            name: parsed.name + " (Nhập khầu)",
                                                            description: parsed.description || "Ngoại lực bế quan từ nguồn bên ngoài.",
                                                            fields: parsed.fields.map((f: any) => ({
                                                                id: f.id || 'f-' + Date.now() + Math.random(),
                                                                label: f.label || 'Mục Vô Danh',
                                                                type: f.type || 'text',
                                                                options: Array.isArray(f.options) ? f.options : undefined,
                                                                placeholder: f.placeholder || '',
                                                                description: f.description || '',
                                                                section: f.section || 'skills_limits'
                                                            }))
                                                        };
                                                        setTemplates(prev => [imported, ...prev]);
                                                        setDesignerSchemaId(imported.id);
                                                        setEditStatus("Nạp file sơ đồ thành công!");
                                                        setTimeout(() => setEditStatus(null), 3000);
                                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                                    } catch (err: any) {
                                                        setImportError("Lỗi cấu trúc: " + (err.message || 'Mã JSON lỗi.'));
                                                        setTimeout(() => setImportError(null), 4000);
                                                    }
                                                };
                                                reader.readAsText(file);
                                            }}
                                            accept=".json"
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer"
                                            title="Nạp cấu trúc file sơ đồ bọc JSON vào ARK"
                                        >
                                            <Upload size={12} />
                                            <span>Nhập JSON</span>
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm(`Bạn có chắc muốn xóa vĩnh viễn Sơ đồ bọc "${activeDesignerSchema.name}" khỏi bối cảnh?`)) {
                                                handleDeleteTemplate(designerSchemaId);
                                            }
                                        }}
                                        className="py-1 px-2.5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 border border-transparent rounded-lg text-[10px] transition-colors cursor-pointer self-end mt-1 font-semibold uppercase tracking-wider"
                                    >
                                        Xóa Sơ đồ bọc
                                    </button>
                                </div>
                            </div>

                            {/* Schema Configuration Field Grid list area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                <div className="flex justify-between items-center bg-transparent">
                                    <span className="text-xs font-bold text-slate-450 uppercase font-mono tracking-wider flex items-center gap-2">
                                        <Tags size={14} className="text-mystic-accent" />
                                        <span>Danh sách cấu hình các trường ({activeDesignerSchema.fields?.length || 0})</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newField: CustomFieldDefinition = {
                                                id: 'f-' + Date.now() + Math.random().toString(36).slice(2, 6),
                                                label: 'Thuộc tính mới ' + (activeDesignerSchema.fields.length + 1),
                                                type: 'text',
                                                placeholder: 'Gợi ý nhập giá trị...',
                                                description: 'Thông tin bổ trợ AI bối cảnh tương ứng.',
                                                section: 'skills_limits'
                                            };
                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? { ...x, fields: [...x.fields, newField] } : x));
                                            setEditStatus("Đã cấy thêm một trường thuộc tính!");
                                            setTimeout(() => setEditStatus(null), 2500);
                                        }}
                                        className="flex items-center gap-1 px-4 py-2 bg-gradient-to-tr from-mystic-accent/80 to-mystic-accent hover:opacity-90 text-mystic-900 rounded-xl text-xs font-bold shadow-md shadow-mystic-accent/10 transition-all cursor-pointer"
                                    >
                                        <Plus size={14} strokeWidth={2.5} />
                                        <span>Thêm Trường Thuộc Tính</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {activeDesignerSchema.fields?.map((field, idx) => (
                                        <div key={field.id} className="p-5 border border-slate-800 bg-slate-950/20 hover:border-slate-700/80 rounded-xl space-y-4 relative transition-all shadow-sm">
                                            
                                            {/* Header column reorders and action */}
                                            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono flex items-center gap-1.5">
                                                    <span className="w-4 h-4 bg-slate-850 flex items-center justify-center rounded text-slate-400 text-[9px]">{idx + 1}</span>
                                                    <span>Trường dữ liệu</span>
                                                </span>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={idx === 0}
                                                        onClick={() => {
                                                            const f = [...activeDesignerSchema.fields];
                                                            const temp = f[idx];
                                                            f[idx] = f[idx - 1];
                                                            f[idx - 1] = temp;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? { ...x, fields: f } : x));
                                                        }}
                                                        className={`p-1 bg-slate-900 border border-slate-800 rounded-lg transition-colors ${idx === 0 ? 'opacity-25 cursor-not-allowed text-slate-500' : 'hover:bg-slate-800 text-slate-400 cursor-pointer'}`}
                                                        title="Đẩy lên"
                                                    >
                                                        <ArrowUp size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={idx === activeDesignerSchema.fields.length - 1}
                                                        onClick={() => {
                                                            const f = [...activeDesignerSchema.fields];
                                                            const temp = f[idx];
                                                            f[idx] = f[idx + 1];
                                                            f[idx + 1] = temp;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? { ...x, fields: f } : x));
                                                        }}
                                                        className={`p-1 bg-slate-900 border border-slate-800 rounded-lg transition-colors ${idx === activeDesignerSchema.fields.length - 1 ? 'opacity-25 cursor-not-allowed text-slate-500' : 'hover:bg-slate-800 text-slate-400 cursor-pointer'}`}
                                                        title="Đẩy xuống"
                                                    >
                                                        <ArrowDown size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const f = activeDesignerSchema.fields.filter(x => x.id !== field.id);
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? { ...x, fields: f } : x));
                                                            setEditStatus("Đã dòn dẹp trường dữ liệu!");
                                                            setTimeout(() => setEditStatus(null), 3000);
                                                        }}
                                                        className="p-1.5 bg-slate-900 border border-transparent hover:border-rose-500/30 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                                        title="Xóa trường"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Inputs for fields */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
                                                {/* Label */}
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Nhãn Hiển Thị (Label)</span>
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => {
                                                            const updatedLabel = e.target.value;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? {
                                                                ...x,
                                                                fields: x.fields.map(f => f.id === field.id ? { ...f, label: updatedLabel } : f)
                                                            } : x));
                                                        }}
                                                        placeholder="VD: Môn Phái, Thần Khí..."
                                                        className="w-full bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 outline-none focus:border-mystic-accent"
                                                    />
                                                </div>

                                                {/* Kiểu Nhập */}
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Kiểu Nhập Dữ Liệu</span>
                                                    <select
                                                        value={field.type}
                                                        onChange={(e) => {
                                                            const updatedType = e.target.value as any;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? {
                                                                ...x,
                                                                fields: x.fields.map(f => f.id === field.id ? { ...f, type: updatedType, options: updatedType === 'select' ? (f.options || ['Mục tiêu 1', 'Mục tiêu 2']) : undefined } : f)
                                                            } : x));
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-850 p-1.5 rounded-lg text-xs font-semibold text-slate-200 outline-none focus:border-mystic-accent"
                                                    >
                                                        <option value="text">Văn bản ngắn (Text)</option>
                                                        <option value="textarea">Đoạn văn dài (Textarea)</option>
                                                        <option value="number">Số lượng (Number)</option>
                                                        <option value="select">Hộp lựa chọn (Select)</option>
                                                    </select>
                                                </div>

                                                {/* Section Mapping Configuration - Crucial for unified rendering! */}
                                                <div className="space-y-1 md:col-span-1">
                                                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold flex items-center gap-1.5">
                                                        <span>Vị trí tích hợp Form</span>
                                                        <HelpCircle size={10} className="text-slate-500" title="Chọn khu vực trường này sẽ hiển thị bên trong form tạo nhân vật" />
                                                    </span>
                                                    <select
                                                        value={field.section || 'skills_limits'}
                                                        onChange={(e) => {
                                                            const sValue = e.target.value as any;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? {
                                                                ...x,
                                                                fields: x.fields.map(f => f.id === field.id ? { ...f, section: sValue } : f)
                                                            } : x));
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-850 p-1.5 rounded-lg text-xs font-semibold text-slate-100 outline-none focus:border-mystic-accent"
                                                    >
                                                        <option value="identity">Định Danh cốt lõi (Core identity)</option>
                                                        <option value="concept">Ngoại hình & Giọng nói (Physical)</option>
                                                        <option value="psyche">Tâm lý & Tiểu sử (Psyche)</option>
                                                        <option value="skills_limits">Năng lực & Giới hạn (Skills)</option>
                                                        <option value="meta">Mâu thuẫn & Sụp đổ (Meta/Role)</option>
                                                    </select>
                                                </div>

                                                {/* Placeholder */}
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Gợi ý mờ (Placeholder)</span>
                                                    <input
                                                        type="text"
                                                        value={field.placeholder || ''}
                                                        onChange={(e) => {
                                                            const updatedVal = e.target.value;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? {
                                                                ...x,
                                                                fields: x.fields.map(f => f.id === field.id ? { ...f, placeholder: updatedVal } : f)
                                                            } : x));
                                                        }}
                                                        placeholder="Mô tả mờ..."
                                                        className="w-full bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg text-xs text-slate-350 outline-none focus:border-mystic-accent"
                                                    />
                                                </div>

                                                {/* Description */}
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Ghi chú bối cảnh AI</span>
                                                    <input
                                                        type="text"
                                                        value={field.description || ''}
                                                        onChange={(e) => {
                                                            const updatedVal = e.target.value;
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? {
                                                                ...x,
                                                                fields: x.fields.map(f => f.id === field.id ? { ...f, description: updatedVal } : f)
                                                            } : x));
                                                        }}
                                                        placeholder="Giải thích cho AI hiểu..."
                                                        className="w-full bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg text-xs text-slate-350 outline-none focus:border-mystic-accent"
                                                    />
                                                </div>
                                            </div>

                                            {/* Select Options configuration panel */}
                                            {field.type === 'select' && (
                                                <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-850/80 space-y-1 inline-block w-full">
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold font-mono">Các lựa chọn Dropdown (Có giá trị mỗi dòng là một lựa chọn):</span>
                                                    <textarea
                                                        value={field.options?.join('\n') || ''}
                                                        onChange={(e) => {
                                                            const nextOpts = e.target.value.split('\n').filter(x => x.trim() !== '');
                                                            setTemplates(t => t.map(x => x.id === designerSchemaId ? {
                                                                ...x,
                                                                fields: x.fields.map(f => f.id === field.id ? { ...f, options: nextOpts } : f)
                                                            } : x));
                                                        }}
                                                        placeholder="Lựa chọn A&#10;Lựa chọn B&#10;Lựa chọn C..."
                                                        rows={2}
                                                        className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs text-slate-300 outline-none focus:border-mystic-accent resize-y font-mono max-h-24"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                            <Info size={40} className="text-slate-650 mb-3" />
                            <p className="text-sm font-semibold">Tạo tối thiểu 1 Sơ đồ bọc trong danh sách thiết kế bên trái để tiến hành cấu trúc!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
