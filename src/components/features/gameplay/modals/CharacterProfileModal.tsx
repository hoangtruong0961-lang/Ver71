import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, X, Edit2, Save, Undo, Sparkles, Lock, Unlock, 
    BrainCircuit, Info, Shield, HelpCircle, Activity, Heart, 
    Crown, Compass, MessageSquare, Zap, Terminal, BadgeCheck 
} from 'lucide-react';
import MarkdownRenderer from '../../../common/MarkdownRenderer';
import { WorldData } from '../../../../types';
import { toast } from 'sonner';
import { dbService } from '../../../../services/db/indexedDB';

interface CharacterProfileModalProps {
    show: boolean;
    onClose: () => void;
    activeWorld: WorldData;
    onSelectAvatar: () => void;
    onUpdateWorld?: (updates: Partial<WorldData>) => void;
}

type TabType = 'identity' | 'psyche' | 'lore' | 'skills_goals' | 'custom_schema';

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

const CharacterProfileModal: React.FC<CharacterProfileModalProps> = ({ 
    show, 
    onClose, 
    activeWorld, 
    onSelectAvatar,
    onUpdateWorld
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('identity');
    const [showHelp, setShowHelp] = useState(false);

    // Dynamic schema list loading
    const [templates] = useState<CustomSchemaTemplate[]>(() => {
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

    // Form states (full 17-attribute schema)
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [age, setAge] = useState('');
    const [appearance, setAppearance] = useState('');
    const [voiceAndTone, setVoiceAndTone] = useState('');
    const [coreValues, setCoreValues] = useState('');
    const [hardLimits, setHardLimits] = useState('');
    const [definingEvents, setDefiningEvents] = useState('');
    const [currentMood, setCurrentMood] = useState('');
    const [relationshipTags, setRelationshipTags] = useState('');
    const [strengths, setStrengths] = useState('');
    const [weaknesses, setWeaknesses] = useState('');
    const [narrativeRole, setNarrativeRole] = useState('');
    const [contradictions, setContradictions] = useState('');
    const [failureMode, setFailureMode] = useState('');
    const [skills, setSkills] = useState('');
    const [goal, setGoal] = useState('');
    const [background, setBackground] = useState('');
    const [personality, setPersonality] = useState('');
    const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);
    
    // Schema wrap properties
    const [customSchemaId, setCustomSchemaId] = useState('none');
    const [birthDay, setBirthDay] = useState(1);
    const [birthMonth, setBirthMonth] = useState(1);
    const [birthYear, setBirthYear] = useState(2000);

    // Sync form states with world model on load
    useEffect(() => {
        if (show && activeWorld?.player) {
            const p = activeWorld.player;
            setName(p.name || '');
            setGender(p.gender || 'Chưa rõ');
            setAge(p.age || 'Chưa rõ');
            setAppearance(p.appearance || '');
            setVoiceAndTone(p.voiceAndTone || '');
            setCoreValues(p.coreValues || '');
            setHardLimits(p.hardLimits || '');
            setDefiningEvents(p.definingEvents || '');
            setCurrentMood(p.currentMood || '');
            setRelationshipTags(p.relationshipTags || '');
            setStrengths(p.strengths || '');
            setWeaknesses(p.weaknesses || '');
            setNarrativeRole(p.narrativeRole || '');
            setContradictions(p.contradictions || '');
            setFailureMode(p.failureMode || '');
            setSkills(p.skills || '');
            setGoal(p.goal || '');
            setBackground(p.background || '');
            setPersonality(p.personality || '');
            setCustomFields(p.customFields || []);
            setCustomSchemaId(p.customSchemaId || 'none');
            setBirthDay(p.birthDay !== undefined ? Number(p.birthDay) : 1);
            setBirthMonth(p.birthMonth !== undefined ? Number(p.birthMonth) : 1);
            setBirthYear(p.birthYear !== undefined ? Number(p.birthYear) : 2000);
            setIsEditing(false);
        }
    }, [show, activeWorld]);

    const handleSave = () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error("Tên nhân vật chính không được để trống!");
            return;
        }

        if (onUpdateWorld && activeWorld) {
            onUpdateWorld({
                player: {
                    ...activeWorld.player,
                    name: trimmedName,
                    gender: gender.trim(),
                    age: age.trim(),
                    appearance: appearance.trim(),
                    voiceAndTone: voiceAndTone.trim(),
                    coreValues: coreValues.trim(),
                    hardLimits: hardLimits.trim(),
                    definingEvents: definingEvents.trim(),
                    currentMood: currentMood.trim(),
                    relationshipTags: relationshipTags.trim(),
                    strengths: strengths.trim(),
                    weaknesses: weaknesses.trim(),
                    narrativeRole: narrativeRole.trim(),
                    contradictions: contradictions.trim(),
                    failureMode: failureMode.trim(),
                    skills: skills.trim(),
                    goal: goal.trim(),
                    background: background.trim(),
                    personality: personality.trim(),
                    customFields: customFields,
                    customSchemaId: customSchemaId,
                    birthDay: birthDay,
                    birthMonth: birthMonth,
                    birthYear: birthYear
                }
            });
            setIsEditing(false);
            toast.success(`🎉 Đã cập nhật thông tin hồ sơ nhân vật thành công!`);
        }
    };

    const toggleFieldLock = (field: string) => {
        if (!onUpdateWorld || !activeWorld) return;
        const currentLocks = activeWorld.player.lockedFields || [];
        let nextLocks: string[];
        
        if (currentLocks.includes(field)) {
            nextLocks = currentLocks.filter(f => f !== field);
            toast.success(`🔓 Đã mở khóa: AI Scribe sẽ tự động cập nhật mặt này dựa trên biểu hiện thực tế!`);
        } else {
            nextLocks = [...currentLocks, field];
            toast.success(`🔒 Đã khóa: "${field}" đã được cố định và bảo toàn khỏi AI cải biên!`);
        }
        
        onUpdateWorld({
            player: {
                ...activeWorld.player,
                lockedFields: nextLocks
            }
        });
    };

    const isLocked = (field: string) => {
        return (activeWorld?.player?.lockedFields || []).includes(field);
    };

    // Human-readable labels & translations for explanation
    const schemaDetails: Record<string, { label: string; desc: string; placeholder: string; icon: React.ReactNode }> = {
        name: { label: "Tên nhân vật", desc: "Tên chính thức của ngôi sao hành trình.", placeholder: "Alex...", icon: <User size={13}/> },
        gender: { label: "Giới tính", desc: "Thể chất sinh lý hoặc bản sắc sinh hoạt.", placeholder: "Nam/Nữ...", icon: <Sparkles size={13}/> },
        age: { label: "Tuổi tác", desc: "Tuổi thọ hay phân cấp vòng đời hiện hành.", placeholder: "24 tuổi...", icon: <Activity size={13}/> },
        appearance: { label: "Ngoại hình diện mạo", desc: "Sắc mặt, tóc tai, thương tích, trang phục và trang bị.", placeholder: "Mắt hổ phách, áo choàng rách...", icon: <Shield size={13}/> },
        voiceAndTone: { label: "Giọng nói & Văn phong", desc: "Cách nhả từ, ngữ điệu (âm u, vội vã) hướng dẫn thoại cho AI.", placeholder: "Thanh thản, đôi mắt lơ đãng, ít khi lên giọng...", icon: <MessageSquare size={13}/> },
        coreValues: { label: "Giá trị cốt lõi", desc: "Nguyên tắc ý thức chủ nghĩa sâu sắc nhất không thể phản bội.", placeholder: "Không hy sinh người vô tội để đạt mục đích...", icon: <Crown size={13}/> },
        hardLimits: { label: "Giới hạn cấm kỵ", desc: "Lằn ranh đỏ hành vi nhân vật tuyệt đối không vi phạm.", placeholder: "Không hợp tác với tà thần...", icon: <Shield size={13}/> },
        definingEvents: { label: "Biến cố định hình", desc: "Vết sẹo hoặc vinh quang lịch sử làm nên nhân dạng hiện thời.", placeholder: "Trận hỏa hoạn thiêu rụi quê nhà năm 10 tuổi...", icon: <Zap size={13}/> },
        currentMood: { label: "Tâm trạng tinh thần", desc: "Xu hướng cảm xúc tức thời thay đổi theo các turn truyện.", placeholder: "Đầy cảnh giác, nhịp thở đứt quãng...", icon: <Heart size={13}/> },
        relationshipTags: { label: "Ứng xử xã hội", desc: "Thiết lập tình hữu nghị, thù hận hoặc phòng bị với tha nhân.", placeholder: "Lịch thiệp với hiền sĩ, vô tình với địch thủ...", icon: <MessageSquare size={13}/> },
        strengths: { label: "Sở trường vượt trội", desc: "Điểm siêu việt thể chất hoặc mưu lược của bạn.", placeholder: "Phản xạ tiệm cận thần tốc...", icon: <Sparkles size={13}/> },
        weaknesses: { label: "Điểm yếu thực tế", desc: "Hạn chế, chấn thương tiềm ẩn ngăn chặn xu hướng god-moding.", placeholder: "Cơ hoành yếu, sợ bóng tối sâu thẳm...", icon: <Zap size={13}/> },
        narrativeRole: { label: "Vai trò cốt truyện", desc: "Góc nhìn định hình hành vi (Nhân vật chính, Hoài nghi giả, ...)", placeholder: "Người sống sót duy nhất, gánh vác phục quốc...", icon: <Terminal size={13}/> },
        contradictions: { label: "Mâu thuẫn nội tâm", desc: "Nút thắt tâm lý biện chứng giúp tăng chiều sâu văn học.", placeholder: "Muốn bảo vệ thế giới nhưng căm giận loài người...", icon: <HelpCircle size={13}/> },
        failureMode: { label: "Phản ứng sụp đổ", desc: "Trạng thái tinh thần khi bế tắc cùng cực hoặc rơi vào góc tối.", placeholder: "Dễ nóng nảy giận dữ mất kiểm soát...", icon: <Activity size={13}/> },
        skills: { label: "Kỹ năng thực chiến", desc: "Sở học thực tế, phép thuật hay kỹ nghệ sinh tồn dã ngoại.", placeholder: "Kiếm thuật bản xứ cổ xưa, am hiểu phong thủy...", icon: <Compass size={13}/> },
        goal: { label: "Đích đến tối hậu", desc: "Nguyện vọng hoặc nhiệm vụ bối cảnh hiện tại cần thúc đẩy.", placeholder: "Giải thoát lời nguyền cho bộ tộc...", icon: <Compass size={13}/> },
        background: { label: "Tiểu sử chi tiết", desc: "Cuộc sống và các vết tích xuất thân cơ bản.", placeholder: "Con trai thứ của một thợ rèn danh giá đã phá sản...", icon: <Terminal size={13}/> },
        personality: { label: "Tính cách chung", desc: "Tính khí xã hội thường biểu hiện ra bên ngoài.", placeholder: "Lầm lì, hay trầm tư suy ngẫm...", icon: <Compass size={13}/> },
    };

    const renderViewCard = (key: string) => {
        const value = (activeWorld?.player as any)?.[key] || '';
        const details = schemaDetails[key] || { label: key, desc: '', icon: <HelpCircle size={13}/> };
        const locked = isLocked(key);

        let displayValue = value;
        if (key === 'age' && activeWorld?.player?.birthDay !== undefined) {
            const p = activeWorld.player;
            displayValue = `${value} tuổi (Ngày sinh bối cảnh: Ngày ${p.birthDay} tháng ${p.birthMonth} năm ${p.birthYear})`;
        }

        return (
            <div key={key} className="bg-stone-300/40 dark:bg-slate-900/40 p-3.5 rounded-xl border border-stone-400/20 dark:border-slate-800/80 hover:border-mystic-500/20 transition-all flex flex-col justify-between select-none relative group h-full">
                <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-stone-800 dark:text-slate-200">
                            <span className="text-mystic-accent dark:text-mystic-accent/80">{details.icon}</span>
                            <span className="text-xs font-bold font-mono tracking-wide uppercase">{details.label}</span>
                        </div>
                        
                        {/* Lock / Unlock Badge for AI Interactivity */}
                        <button 
                            onClick={() => toggleFieldLock(key)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black transition-all ${
                                locked 
                                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' 
                                : 'bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20'
                            }`}
                            title={locked ? "Trường đã bị Khóa. AI sẽ không tự ý cập nhật." : "Trường mở cho AI Scribe tự do đồng hóa cảnh đời."}
                        >
                            {locked ? <Lock size={9}/> : <Unlock size={9}/>}
                            <span>{locked ? "LOCKED" : "AI SCRIBE"}</span>
                        </button>
                    </div>
                    
                    <p className="text-[10px] text-stone-500 dark:text-slate-400 leading-normal mb-2.5 font-sans italic">
                        {details.desc}
                    </p>

                    <div className="text-xs text-stone-800 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-wrap pl-1.5 border-l border-stone-400/30 dark:border-slate-800">
                        {displayValue ? (
                            <MarkdownRenderer content={displayValue} />
                        ) : (
                            <span className="text-stone-500 italic">Chưa có dấu ấn nội dung nào được xác lập. AI Scribe tự ý phác họa khi phát sinh biến cố.</span>
                        )}
                    </div>
                </div>
                
                {!locked && (
                    <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[9px] font-mono text-sky-400/60 flex items-center gap-1">
                            <BrainCircuit size={10} className="animate-pulse" /> Sinh động cùng truyện
                        </span>
                    </div>
                )}
            </div>
        );
    };

    const renderEditField = (key: string, rows = 2) => {
        const details = schemaDetails[key] || { label: key, desc: '', placeholder: '', icon: <HelpCircle size={13}/> };
        const val = (this as any)?.[`state_${key}`] || ''; // read from state dynamic
        
        // Find setter and state
        let currentVal = '';
        let setter: (v: string) => void = () => {};

        switch(key) {
            case 'name': currentVal = name; setter = setName; break;
            case 'gender': currentVal = gender; setter = setGender; break;
            case 'age': currentVal = age; setter = setAge; break;
            case 'appearance': currentVal = appearance; setter = setAppearance; break;
            case 'voiceAndTone': currentVal = voiceAndTone; setter = setVoiceAndTone; break;
            case 'coreValues': currentVal = coreValues; setter = setCoreValues; break;
            case 'hardLimits': currentVal = hardLimits; setter = setHardLimits; break;
            case 'definingEvents': currentVal = definingEvents; setter = setDefiningEvents; break;
            case 'currentMood': currentVal = currentMood; setter = setCurrentMood; break;
            case 'relationshipTags': currentVal = relationshipTags; setter = setRelationshipTags; break;
            case 'strengths': currentVal = strengths; setter = setStrengths; break;
            case 'weaknesses': currentVal = weaknesses; setter = setWeaknesses; break;
            case 'narrativeRole': currentVal = narrativeRole; setter = setNarrativeRole; break;
            case 'contradictions': currentVal = contradictions; setter = setContradictions; break;
            case 'failureMode': currentVal = failureMode; setter = setFailureMode; break;
            case 'skills': currentVal = skills; setter = setSkills; break;
            case 'goal': currentVal = goal; setter = setGoal; break;
            case 'background': currentVal = background; setter = setBackground; break;
            case 'personality': currentVal = personality; setter = setPersonality; break;
        }

        return (
            <div key={key} className="flex flex-col bg-stone-300/25 dark:bg-slate-900/20 p-3 rounded-lg border border-stone-300/60 dark:border-slate-800/50">
                <label className="text-[10px] font-black uppercase tracking-wider text-mystic-accent mb-0.5 flex items-center gap-1">
                    {details.icon} <span>{details.label}</span>
                </label>
                <span className="text-[9px] text-stone-500 italic mb-1.5">{details.desc}</span>
                {rows === 1 ? (
                    <input 
                        type="text"
                        value={currentVal}
                        onChange={(e) => setter(e.target.value)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 rounded-lg border border-stone-400 dark:border-slate-700 focus:outline-none focus:border-mystic-accent font-mono text-xs"
                        placeholder={details.placeholder}
                    />
                ) : (
                    <textarea 
                        rows={rows}
                        value={currentVal}
                        onChange={(e) => setter(e.target.value)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 rounded-lg border border-stone-400 dark:border-slate-700 focus:outline-none focus:border-mystic-accent font-mono text-xs leading-relaxed"
                        placeholder={details.placeholder}
                    />
                )}
            </div>
        );
    };

    const locksCount = activeWorld?.player?.lockedFields?.length || 0;
    const unlockedCount = 19 - locksCount; // Total 19 components of details

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-1.5 sm:p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-700 w-full max-w-5xl h-[92vh] sm:h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header Area */}
                        <div className="p-3 border-b border-stone-400 dark:border-slate-800 flex justify-between items-center bg-stone-300 dark:bg-slate-900/60 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-1 rounded bg-mystic-accent/15 border border-mystic-accent/30 text-mystic-accent">
                                    <BrainCircuit size={18} className="animate-spin-slow" />
                                </div>
                                <div>
                                    <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-slate-150 flex items-center gap-1.5 font-mono uppercase tracking-normal">
                                        {isEditing ? "Hiệu chỉnh Bản Thiết Kế Nhân Vật" : "Tuyển Tập Đặc Tính Nhân Vật Chính"}
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-mystic-accent/20 border border-mystic-accent/40 text-mystic-accent uppercase tracking-widest leading-0 font-sans">Fixed Schema</span>
                                    </h2>
                                    <p className="text-[10px] text-stone-500 dark:text-slate-400 leading-none mt-0.5">
                                        Schema cố định tích hợp cơ chế Thư Ký AI (Scribe Engine) để tự quyết định cốt cách bối cảnh.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {!isEditing ? (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="text-[11px] font-bold uppercase tracking-wider text-mystic-accent hover:text-white bg-mystic-accent/10 hover:bg-mystic-accent px-3 py-1.5 rounded-lg border border-mystic-accent/30 transition-all flex items-center gap-1"
                                        title="Chỉnh sửa mọi thông số nguyên mẫu"
                                    >
                                        <Edit2 size={11} />
                                        <span>Khởi biên</span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={handleSave}
                                            className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1"
                                        >
                                            <Save size={11} />
                                            <span>Lưu đổi mới</span>
                                        </button>
                                        <button 
                                            onClick={() => setIsEditing(false)}
                                            className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 hover:text-white bg-white/5 hover:bg-stone-500 px-3 py-1.5 rounded-lg border border-stone-400/20 transition-all flex items-center gap-1"
                                        >
                                            <Undo size={11} />
                                            <span>Huỷ bỏ</span>
                                        </button>
                                    </div>
                                )}
                                
                                <button 
                                    onClick={onClose} 
                                    className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white p-1.5 rounded hover:bg-stone-400/30 dark:hover:bg-slate-800 transition-colors ml-1"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Top-level Info Console Dashboard */}
                        <div className="bg-stone-300/30 dark:bg-slate-900/30 px-4 py-2 border-b border-stone-400/40 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <Activity size={12} className="text-emerald-500" />
                                    <span className="text-slate-500">Giới tính: </span>
                                    <span className="font-bold text-stone-800 dark:text-slate-300 font-mono">{activeWorld?.player?.gender || 'Chưa rõ'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Heart size={12} className="text-rose-500" />
                                    <span className="text-slate-500">Tuổi: </span>
                                    <span className="font-bold text-stone-800 dark:text-slate-300 font-mono">{activeWorld?.player?.age || 'Chưa rõ'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <BrainCircuit size={12} className="text-sky-500" />
                                    <span className="text-slate-500">Scribe chỉ số:</span>
                                    <span className="font-bold text-sky-400 font-mono">{unlockedCount} thông thoáng</span>
                                    <span className="text-stone-400">/</span>
                                    <span className="font-bold text-rose-400 font-mono">{locksCount} khóa cứng</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setShowHelp(!showHelp)}
                                className="text-[10px] font-bold text-mystic-accent hover:underline flex items-center gap-1"
                            >
                                <Info size={11} />
                                {showHelp ? "Đóng cẩm nang" : "Xem cơ chế Thư Ký AI?"}
                            </button>
                        </div>

                        {/* Expandable Help Section */}
                        <AnimatePresence>
                            {showHelp && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-3 text-xs text-sky-800 dark:text-sky-200 shrink-0 space-y-1.5"
                                >
                                    <p className="font-bold flex items-center gap-1">
                                        <BadgeCheck size={14} className="text-sky-400" /> CƠ CHẾ THƯ KÝ ĐỒNG BỘ (AI SCRIBE ENGINE) HOẠT ĐỘNG THẾ NÀO?
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1 leading-relaxed opacity-90">
                                        <li>Cấu trúc hồ sơ này bao gồm <strong>17 thuộc tính cố định chuẩn tiểu thuyết tương tác</strong>, tối ưu hóa mức độ nhất quán và mạch súc tích bối cảnh.</li>
                                        <li>Khi bạn chơi, AI Quản trò ghi chép biểu hiện thực tại qua các bảng trạng thái LSR. Hệ thống tự động phân tích và <strong>ghi đè nội dung phù hợp nhất</strong> vào các ô tương ứng.</li>
                                        <li>Bạn giữ quyền kiểm soát tối cao: Nhấn nút <strong>"AI SCRIBE / LOCKED"</strong> trên bất kỳ ô nào để bảo lưu nguyên mẫu đó. Khi ô bị khóa, AI sẽ tôn trọng chỉ số đó và không bao giờ sửa đổi.</li>
                                    </ul>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Core Workspace Grid */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-stone-150 dark:bg-mystic-950/70 p-2 sm:p-4 gap-4">
                            
                            {/* Left Panel: Profile Avatar & Tab Buttons */}
                            <div className="w-full md:w-56 shrink-0 flex flex-col gap-3">
                                {/* Avatar Card */}
                                <div className="bg-stone-300/35 dark:bg-slate-900/50 p-4 rounded-2xl border border-stone-300 dark:border-slate-800 text-center flex flex-col items-center gap-3 select-none">
                                    <button 
                                        onClick={onSelectAvatar}
                                        className="w-20 h-20 rounded-full bg-stone-400 dark:bg-slate-800 border-2 border-mystic-accent flex items-center justify-center shrink-0 shadow-lg overflow-hidden group relative transition-transform hover:scale-105"
                                        title="Đổi chân dung truyền thần"
                                    >
                                        {activeWorld.player?.avatar ? (
                                            <img src={activeWorld.player.avatar} alt={activeWorld.player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <User size={36} className="text-mystic-accent" />
                                        )}
                                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Edit2 size={20} className="text-white" />
                                        </div>
                                    </button>

                                    <div>
                                        <h3 className="font-black text-stone-900 dark:text-slate-100 text-sm font-mono truncate max-w-[180px] tracking-tight">
                                            {activeWorld.player?.name || "Lữ Khách Vô Danh"}
                                        </h3>
                                        <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">TIÊN PHONG CHỦ THỂ</span>
                                    </div>
                                </div>

                                {/* Vertical Navigation / Mobile Scroll Layout */}
                                <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible hide-scrollbar shrink-0 md:bg-transparent bg-stone-250 dark:bg-slate-900/10 p-1 rounded-xl">
                                    {[
                                        { id: 'identity', label: 'Thân thế diện mạo', icon: <User size={13}/> },
                                        { id: 'psyche', label: 'Tâm tính đạo đức', icon: <Crown size={13}/> },
                                        { id: 'lore', label: 'Quá khứ quan hệ', icon: <Terminal size={13}/> },
                                        { id: 'skills_goals', label: 'Kỹ năng mục tiêu', icon: <Compass size={13}/> },
                                        { id: 'custom_schema', label: 'Chỉ số Sơ đồ (Schema)', icon: <Activity size={13}/> },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as TabType)}
                                            className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border whitespace-nowrap md:w-full select-none ${
                                                activeTab === tab.id 
                                                ? 'text-mystic-accent border-mystic-accent bg-mystic-accent/10' 
                                                : 'text-stone-500 dark:text-slate-400 border-transparent hover:bg-white/5 hover:text-stone-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            {tab.icon}
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right Panel: Content Widgets Grid / Forms */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 bg-stone-100/50 dark:bg-slate-905 p-3 rounded-2xl border border-stone-300/50 dark:border-slate-800/40">
                                
                                {isEditing ? (
                                    /* --- EDIT MODE --- */
                                    <div className="space-y-4">
                                        <div className="bg-mystic-accent/5 border border-mystic-accent/20 p-2.5 rounded-lg text-[10px] text-mystic-accent font-mono leading-relaxed mb-1">
                                            ⚠️ CẢNH BÁO KHỞI BIÊN: Bạn đang trực tiếp chỉnh sửa cấu trúc nguyên mẫu. Khi ấn "Lưu đổi mới", các nội dung này sẽ áp vào bối cảnh nhân vật.
                                        </div>

                                        {activeTab === 'identity' && (
                                            <div className="grid grid-cols-1 gap-4">
                                                {renderEditField('name', 1)}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {renderEditField('gender', 1)}
                                                    <div className="flex flex-col bg-stone-300/25 dark:bg-slate-900/20 p-3 rounded-lg border border-stone-300/60 dark:border-slate-800/50">
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-mystic-accent mb-0.5 flex items-center gap-1">
                                                            <Activity size={13}/> <span>Tuổi tác bối cảnh</span>
                                                        </label>
                                                        <input 
                                                            type="text"
                                                            value={age}
                                                            onChange={(e) => setAge(e.target.value)}
                                                            className="px-3 py-1.5 bg-white dark:bg-slate-800 text-stone-900 dark:text-slate-100 rounded-lg border border-stone-400 dark:border-slate-700 focus:outline-none focus:border-mystic-accent font-mono text-xs"
                                                            placeholder="24..."
                                                        />
                                                        <span className="text-[8px] text-stone-500 italic mt-1">Tự động tính tuổi theo năm sinh bối cảnh so với mốc khởi đầu của Thế Giới.</span>
                                                    </div>
                                                </div>
                                                <div className="bg-stone-300/25 dark:bg-slate-900/20 p-3 rounded-lg border border-stone-300/60 dark:border-slate-800/50">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-mystic-accent block mb-2">
                                                        📅 THIẾT LẬP NGÀY SINH LỊCH SỬ BỐI CẢNH
                                                    </label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div>
                                                             <label className="text-[8px] text-stone-500 uppercase tracking-wider block mb-1">Ngày sinh</label>
                                                             <select
                                                                 value={birthDay}
                                                                 onChange={(e) => setBirthDay(Number(e.target.value))}
                                                                 className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-stone-400 dark:border-slate-700 rounded-lg text-stone-800 dark:text-slate-200 focus:outline-none"
                                                             >
                                                                 {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                                     <option key={d} value={d}>Ngày {d}</option>
                                                                 ))}
                                                             </select>
                                                        </div>
                                                        <div>
                                                             <label className="text-[8px] text-stone-500 uppercase tracking-wider block mb-1">Tháng sinh</label>
                                                             <select
                                                                 value={birthMonth}
                                                                 onChange={(e) => setBirthMonth(Number(e.target.value))}
                                                                 className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-stone-400 dark:border-slate-700 rounded-lg text-stone-800 dark:text-slate-200 focus:outline-none"
                                                             >
                                                                 {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                                     <option key={m} value={m}>Tháng {m}</option>
                                                                 ))}
                                                             </select>
                                                        </div>
                                                        <div>
                                                             <label className="text-[8px] text-stone-500 uppercase tracking-wider block mb-1">Năm sinh</label>
                                                             <input
                                                                 type="number"
                                                                 value={birthYear}
                                                                 onChange={(e) => {
                                                                     const yr = Number(e.target.value);
                                                                     setBirthYear(yr);
                                                                     const startYear = activeWorld.gameTime?.year || activeWorld.world?.startingYear || 2024;
                                                                     const calculatedAge = startYear - yr;
                                                                     setAge(calculatedAge > 0 ? `${calculatedAge}` : '0');
                                                                 }}
                                                                 className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-stone-400 dark:border-slate-700 rounded-lg font-mono text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                                             />
                                                        </div>
                                                    </div>
                                                </div>
                                                {renderEditField('appearance', 3)}
                                                {renderEditField('voiceAndTone', 3)}
                                            </div>
                                        )}

                                        {activeTab === 'psyche' && (
                                            <div className="grid grid-cols-1 gap-4">
                                                {renderEditField('personality', 3)}
                                                {renderEditField('coreValues', 3)}
                                                {renderEditField('hardLimits', 2)}
                                                {renderEditField('currentMood', 2)}
                                            </div>
                                        )}

                                        {activeTab === 'lore' && (
                                            <div className="grid grid-cols-1 gap-4">
                                                {renderEditField('definingEvents', 3)}
                                                {renderEditField('background', 4)}
                                                {renderEditField('narrativeRole', 1)}
                                                {renderEditField('relationshipTags', 2)}
                                            </div>
                                        )}

                                        {activeTab === 'skills_goals' && (
                                            <div className="grid grid-cols-1 gap-4">
                                                {renderEditField('skills', 3)}
                                                {renderEditField('strengths', 2)}
                                                {renderEditField('weaknesses', 2)}
                                                {renderEditField('contradictions', 2)}
                                                {renderEditField('failureMode', 2)}
                                                {renderEditField('goal', 2)}
                                            </div>
                                        )}

                                        {activeTab === 'custom_schema' && (
                                            <div className="space-y-4">
                                                {/* Schema wrap selector */}
                                                <div className="bg-stone-300/35 dark:bg-slate-900/50 p-4 rounded-xl border border-stone-400/30 dark:border-slate-800/80 space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-mystic-accent block mb-1">
                                                        🔱 SƠ ĐỒ BỌC CHỈ SỐ BỐI CẢNH (SCHEMA WRAPPER)
                                                    </label>
                                                    <select
                                                        value={customSchemaId}
                                                        onChange={(e) => {
                                                            const nextId = e.target.value;
                                                            setCustomSchemaId(nextId);
                                                            // Auto initialize schema fields in customFields if not present
                                                            if (nextId !== 'none') {
                                                                const template = templates.find(t => t.id === nextId);
                                                                if (template) {
                                                                    const nextFields = [...customFields];
                                                                    template.fields.forEach(f => {
                                                                        if (!nextFields.some(cf => cf.label === f.label)) {
                                                                            nextFields.push({ label: f.label, value: '' });
                                                                        }
                                                                    });
                                                                    setCustomFields(nextFields);
                                                                }
                                                            }
                                                        }}
                                                        className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-stone-400 dark:border-slate-700 rounded-lg text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent font-semibold"
                                                    >
                                                        <option value="none">-- Không áp dụng sơ đồ bọc (Chỉ số tự do) --</option>
                                                        {templates.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                    {customSchemaId !== 'none' && (
                                                        <p className="text-[10px] text-stone-500 dark:text-slate-400 italic font-medium leading-normal pt-1">
                                                            {templates.find(t => t.id === customSchemaId)?.description || 'Đang bọc bối cảnh mẫu chỉ số.'}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Schema Fields inputs */}
                                                {customSchemaId !== 'none' && (() => {
                                                    const template = templates.find(t => t.id === customSchemaId);
                                                    if (!template) return null;
                                                    return (
                                                        <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3.5 animate-fadeIn">
                                                            <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider block">
                                                                ⚜️ CHỈ SỐ CỨNG THEO SƠ ĐỒ {template.name.toUpperCase()}
                                                            </span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                                                {template.fields.map(f => {
                                                                    const val = customFields.find(cf => cf.label === f.label)?.value || '';
                                                                    const setVal = (newVal: string) => {
                                                                        const next = [...customFields];
                                                                        const idx = next.findIndex(cf => cf.label === f.label);
                                                                        if (idx >= 0) {
                                                                            next[idx] = { ...next[idx], value: newVal };
                                                                        } else {
                                                                            next.push({ label: f.label, value: newVal });
                                                                        }
                                                                        setCustomFields(next);
                                                                    };

                                                                    return (
                                                                        <div key={f.id} className="flex flex-col gap-1">
                                                                            <label className="text-[10px] font-bold text-stone-700 dark:text-slate-300 uppercase tracking-wide">
                                                                                {f.label}
                                                                            </label>
                                                                            {f.description && (
                                                                                <span className="text-[8px] text-stone-500 italic leading-none">{f.description}</span>
                                                                            )}
                                                                            {f.type === 'select' ? (
                                                                                <select
                                                                                    value={val}
                                                                                    onChange={(e) => setVal(e.target.value)}
                                                                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 text-stone-850 dark:text-slate-100 rounded-lg border border-stone-400 dark:border-slate-700 text-xs focus:outline-none focus:border-mystic-accent"
                                                                                >
                                                                                    <option value="">-- Chưa chọn --</option>
                                                                                    {f.options?.map(opt => (
                                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : f.type === 'textarea' ? (
                                                                                <textarea
                                                                                    rows={2}
                                                                                    value={val}
                                                                                    onChange={(e) => setVal(e.target.value)}
                                                                                    placeholder={f.placeholder}
                                                                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 text-stone-850 dark:text-slate-150 rounded-lg border border-stone-400 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-mystic-accent"
                                                                                />
                                                                            ) : (
                                                                                <input
                                                                                    type={f.type === 'number' ? 'number' : 'text'}
                                                                                    value={val}
                                                                                    onChange={(e) => setVal(e.target.value)}
                                                                                    placeholder={f.placeholder}
                                                                                    className="px-3 py-1.5 bg-white dark:bg-slate-800 text-stone-850 dark:text-slate-150 rounded-lg border border-stone-400 dark:border-slate-705 text-xs font-mono focus:outline-none focus:border-mystic-accent"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex justify-between items-center bg-stone-300/30 dark:bg-slate-900/30 p-2.5 rounded-lg border border-stone-400/20 dark:border-slate-800/60">
                                                    <span className="text-xs font-bold text-stone-750 dark:text-slate-300">
                                                        {customSchemaId !== 'none' ? '⚜️ THUỘC TÍNH MỞ RỘNG NGOÀI SƠ ĐỒ' : '🔱 DANH SÁCH THUỘC TÍNH TỰ DO'} ({
                                                            customSchemaId === 'none'
                                                                ? customFields.length
                                                                : customFields.filter(cf => {
                                                                    const template = templates.find(t => t.id === customSchemaId);
                                                                    return template ? !template.fields.some(f => f.label === cf.label) : true;
                                                                }).length
                                                        })
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setCustomFields([...customFields, { label: 'Chỉ số mới', value: '' }])}
                                                        className="px-2.5 py-1 bg-mystic-accent text-white rounded text-[10px] font-bold hover:bg-mystic-accent/90"
                                                    >
                                                        + Thêm thuộc tính
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                                                    {customFields.map((cf, idx) => {
                                                        const template = templates.find(t => t.id === customSchemaId);
                                                        const isBound = template ? template.fields.some(f => f.label === cf.label) : false;
                                                        if (isBound) return null;

                                                        return (
                                                        <div key={idx} className="flex gap-3 items-center bg-stone-300/20 dark:bg-slate-950/40 p-2.5 rounded-xl border border-stone-300 dark:border-slate-800">
                                                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-grow">
                                                                 <input
                                                                     type="text"
                                                                     value={cf.label}
                                                                     onChange={(e) => {
                                                                         const next = [...customFields];
                                                                         next[idx] = { ...next[idx], label: e.target.value };
                                                                         setCustomFields(next);
                                                                     }}
                                                                     placeholder="Tên thuộc tính (HP, Mana, Cấp độ...)"
                                                                     className="w-full bg-white dark:bg-slate-900 border border-stone-400 dark:border-slate-800 px-2 py-1.5 rounded-lg text-xs font-semibold text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                                                 />
                                                                 <input
                                                                     type="text"
                                                                     value={cf.value}
                                                                     onChange={(e) => {
                                                                         const next = [...customFields];
                                                                         next[idx] = { ...next[idx], value: e.target.value };
                                                                         setCustomFields(next);
                                                                     }}
                                                                     placeholder="Giá trị"
                                                                     className="sm:col-span-2 w-full bg-white dark:bg-slate-900 border border-stone-400 dark:border-slate-800 px-2 py-1.5 rounded-lg text-xs text-stone-800 dark:text-slate-200 focus:outline-none focus:border-mystic-accent"
                                                                 />
                                                             </div>
                                                             <button
                                                                 type="button"
                                                                 onClick={() => {
                                                                     const next = customFields.filter((_, i) => i !== idx);
                                                                     setCustomFields(next);
                                                                 }}
                                                                 className="p-1 px-2 hover:bg-rose-500/10 text-stone-500 hover:text-rose-500 rounded text-xs shrink-0 transition-colors"
                                                             >
                                                                 Xóa
                                                             </button>
                                                         </div>
                                                         );
                                                     })}
                                                 </div>
                                             </div>
                                         )}
                                    </div>
                                ) : (
                                    /* --- VIEW MODE --- */
                                    <div className="h-full">
                                        {activeTab === 'identity' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2">
                                                    {renderViewCard('name')}
                                                </div>
                                                {renderViewCard('gender')}
                                                {renderViewCard('age')}
                                                <div className="md:col-span-2">
                                                    {renderViewCard('appearance')}
                                                </div>
                                                <div className="md:col-span-2">
                                                    {renderViewCard('voiceAndTone')}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'psyche' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2">
                                                    {renderViewCard('personality')}
                                                </div>
                                                <div className="md:col-span-2">
                                                    {renderViewCard('coreValues')}
                                                </div>
                                                <div className="md:col-span-2">
                                                    {renderViewCard('hardLimits')}
                                                </div>
                                                <div className="md:col-span-2">
                                                    {renderViewCard('currentMood')}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'lore' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2">
                                                    {renderViewCard('definingEvents')}
                                                </div>
                                                <div className="md:col-span-2">
                                                    {renderViewCard('background')}
                                                </div>
                                                {renderViewCard('narrativeRole')}
                                                {renderViewCard('relationshipTags')}
                                            </div>
                                        )}

                                        {activeTab === 'skills_goals' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {renderViewCard('skills')}
                                                {renderViewCard('goal')}
                                                {renderViewCard('strengths')}
                                                {renderViewCard('weaknesses')}
                                                {renderViewCard('contradictions')}
                                                {renderViewCard('failureMode')}
                                            </div>
                                        )}

                                        {activeTab === 'custom_schema' && (
                                             <div className="space-y-4">
                                                 {/* Active schema header if any */}
                                                 {customSchemaId !== 'none' && (() => {
                                                     const template = templates.find(t => t.id === customSchemaId);
                                                     if (!template) return null;
                                                     return (
                                                         <div className="bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-500/15 flex items-center justify-between text-[10px] font-mono">
                                                             <span className="text-amber-600 dark:text-amber-500 font-bold">⚜️ ĐANG ÁP DỤNG SƠ ĐỒ GỐC: {template.name.toUpperCase()}</span>
                                                             <span className="text-stone-500 italic text-[9px]">{template.description}</span>
                                                         </div>
                                                     );
                                                 })()}

                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                     {customFields.length === 0 ? (
                                                         <div className="md:col-span-2 text-center py-8 bg-stone-300/20 dark:bg-slate-900/30 rounded-xl border border-dashed border-stone-400/30 dark:border-slate-800 text-stone-550 text-xs">
                                                             Nhân vật này chưa cấu hình Sơ đồ thuộc tính thăng tiến tùy biến. Nhấn nút "Khởi biên" ở góc trên để bổ sung.
                                                         </div>
                                                     ) : (() => {
                                                         const template = templates.find(t => t.id === customSchemaId);
                                                         const schemaFields = template ? template.fields : [];
                                                         const schemaLabels = schemaFields.map(f => f.label);

                                                         // Sort: schema fields first (in schema order), then custom freeform fields
                                                         const sortedFields = [...customFields].sort((a, b) => {
                                                             const indexA = schemaLabels.indexOf(a.label);
                                                             const indexB = schemaLabels.indexOf(b.label);
                                                             if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                             if (indexA !== -1) return -1;
                                                             if (indexB !== -1) return 1;
                                                             return a.label.localeCompare(b.label);
                                                         });

                                                         return sortedFields.map((cf, idx) => {
                                                             const isSchemaField = schemaLabels.includes(cf.label);
                                                             return (
                                                                 <div key={idx} className={`p-4 rounded-xl border transition-all flex flex-col justify-between relative group select-none ${
                                                                     isSchemaField 
                                                                         ? "bg-stone-300/40 dark:bg-slate-900/40 border-amber-500/20 shadow-sm" 
                                                                         : "bg-stone-300/20 dark:bg-slate-900/25 border-stone-400/10 dark:border-slate-800/60"
                                                                 }`}>
                                                                     <div>
                                                                         <div className="flex items-center gap-1.5 text-stone-800 dark:text-slate-200 mb-2">
                                                                             <Activity size={13} className={isSchemaField ? "text-amber-500 animate-pulse" : "text-stone-500"} />
                                                                             <span className="text-xs font-bold font-mono tracking-wide uppercase">{cf.label}</span>
                                                                             {isSchemaField && (
                                                                                 <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded uppercase font-bold tracking-widest font-mono scale-90 select-none">Sơ Đồ</span>
                                                                             )}
                                                                         </div>
                                                                         <div className="text-xs text-stone-850 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-wrap pl-1.5 border-l border-stone-400/30 dark:border-slate-805">
                                                                             {cf.value ? (
                                                                                 <MarkdownRenderer content={cf.value} />
                                                                             ) : (
                                                                                 <span className="text-stone-500 italic block py-0.5">Chưa xác lập chỉ số.</span>
                                                                             )}
                                                                         </div>
                                                                     </div>
                                                                 </div>
                                                             );
                                                         });
                                                     })()}
                                                 </div>
                                             </div>
                                         
                                        )}
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

export default CharacterProfileModal;
