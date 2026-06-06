import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Database, X, Code, Zap, Plus, Trash2, Check, Sparkles, 
    AlertTriangle, ListChecks, Search, Clipboard, ArrowUp, ArrowDown,
    Edit2, Save, FileDown, FileUp, Sliders, CheckCircle2, HelpingCircle, RefreshCw,
    Undo, Redo, Star, Eye, Send, Play, Layers, CheckCircle, HelpCircle, Settings
} from 'lucide-react';
import Button from '../../../ui/Button';
import { useTheme } from '../../../../context/ThemeContext';
import { useResponsive } from '../../../../hooks/useResponsive';
import { ContextDebuggerView } from '../components/ContextDebuggerView';
import { WorldData, ContextWindowConfig, AppSettings, ChatMessage, PresetModelConfig } from '../../../../types';
import { getAiClient } from '../../../../services/ai/client';

const CATEGORIES = ['🎭 Đóng vai', '✍️ Văn phong', '🔥 Độ khó', '🗣️ Đối thoại', '⚙️ Cấu trúc'];
const PRIORITIES = ['🔴 TUYỆT ĐỐI', '🟡 LINH HOẠT', '🟢 KHUYẾN NGHỊ'];

const CATEGORY_STYLES: Record<string, { bg: string, text: string, border: string, iconColor: string }> = {
    '🎭 Đóng vai': { bg: 'bg-rose-500/10 dark:bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-900/40', iconColor: 'text-rose-500' },
    '✍️ Văn phong': { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-600 dark:text-sky-450', border: 'border-sky-300 dark:border-sky-900/40', iconColor: 'text-sky-400' },
    '🔥 Độ khó': { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-450', border: 'border-amber-300 dark:border-amber-900/40', iconColor: 'text-amber-500' },
    '🗣️ Đối thoại': { bg: 'bg-violet-500/10 dark:bg-violet-500/15', text: 'text-violet-600 dark:text-violet-450', border: 'border-violet-300 dark:border-violet-900/40', iconColor: 'text-violet-400' },
    '⚙️ Cấu trúc': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-450', border: 'border-emerald-300 dark:border-emerald-900/40', iconColor: 'text-emerald-450' },
    '⚙️ Khác': { bg: 'bg-stone-500/10 dark:bg-stone-500/15', text: 'text-stone-600 dark:text-stone-400', border: 'border-stone-300 dark:border-stone-800', iconColor: 'text-stone-400' },
};

const PRIORITY_STYLES: Record<string, { badge: string, dot: string }> = {
    '🔴 TUYỆT ĐỐI': { badge: 'bg-red-500/10 border-red-300 dark:border-red-900/30 text-red-600 dark:text-red-400', dot: 'bg-red-500' },
    '🟡 LINH HOẠT': { badge: 'bg-yellow-500/10 border-yellow-300 dark:border-yellow-900/30 text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
    '🟢 KHUYẾN NGHỊ': { badge: 'bg-green-500/10 border-green-300 dark:border-green-900/30 text-green-600 dark:text-green-400', dot: 'bg-green-500' },
};

interface ContextWindowModalProps {
    show: boolean;
    onClose: () => void;
    activeWorld: WorldData;
    handleUpdateContextConfig: (config: ContextWindowConfig) => void;
    settings: AppSettings;
    history: ChatMessage[];
    turnCount: number;
    tawaPresetConfig: PresetModelConfig | null;
    gameTime: any;
    lastAction: string;
    dynamicRules?: string[];
    setDynamicRules?: (rules: string[]) => void;
    isInline?: boolean;
    initialTab?: 'config' | 'rules' | 'debugger';
    allowedTabs?: ('config' | 'rules' | 'debugger')[];
}

interface ParsedRule {
    original: string;
    index: number;
    isDisabled: boolean;
    category: string;
    priority: string;
    title: string;
    content: string;
    condition?: string;
    tags?: string[];
    scope?: 'global' | 'chapter' | 'scene';
    expiryTurns?: number;
}

const parseRule = (rawRule: string, index: number): ParsedRule => {
    let str = rawRule.trim();
    let isDisabled = false;

    // Check disable status
    if (str.startsWith('[VÔ HIỆU HÓA]')) {
        isDisabled = true;
        str = str.substring('[VÔ HIỆU HÓA]'.length).trim();
    } else if (str.startsWith('//')) {
        isDisabled = true;
        str = str.substring(2).trim();
    }

    // Parse Expiry
    let expiryTurns: number | undefined = undefined;
    const expiryMatch = str.match(/^\[EXPIRY:\s*(\d+)\]/i);
    if (expiryMatch) {
        expiryTurns = parseInt(expiryMatch[1], 10);
        str = str.substring(expiryMatch[0].length).trim();
    }

    // Parse Scope
    let scope: 'global' | 'chapter' | 'scene' = 'global';
    const scopeMatch = str.match(/^\[SCOPE:\s*([^\]]+)\]/i);
    if (scopeMatch) {
        const parsedScope = scopeMatch[1].toLowerCase().trim();
        if (parsedScope === 'chapter' || parsedScope === 'scene') {
            scope = parsedScope;
        }
        str = str.substring(scopeMatch[0].length).trim();
    }

    // Parse Tags
    let tags: string[] = [];
    const tagsMatch = str.match(/^\[TAGS:\s*([^\]]+)\]/i);
    if (tagsMatch) {
        tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
        str = str.substring(tagsMatch[0].length).trim();
    }

    // Parse Condition tag
    let condition = '';
    const condMatch = str.match(/^\[(?:ĐIỀU KIỆN|KÍCH HOẠT KHI|COND|CONDITION|TRIGGER):\s*([^\]]+)\]/i);
    if (condMatch) {
        condition = condMatch[1].trim();
        str = str.substring(condMatch[0].length).trim();
    }

    // Parse category
    let category = '⚙️ Khác';
    for (const cat of CATEGORIES) {
        if (str.startsWith(`[${cat}]`)) {
            category = cat;
            str = str.substring(`[${cat}]`.length).trim();
            break;
        }
    }

    // Parse priority
    let priority = '🔴 TUYỆT ĐỐI';
    for (const pr of PRIORITIES) {
        if (str.startsWith(`[${pr}]`)) {
            priority = pr;
            str = str.substring(`[${pr}]`.length).trim();
            break;
        }
    }

    // Parse title
    let title = '';
    const titleMatch = str.match(/^\[([^\]]+)\]:\s*(.*)$/);
    if (titleMatch) {
        title = titleMatch[1];
        str = titleMatch[2];
    } else {
        // Fallback title
        title = str.length > 25 ? str.substring(0, 25) + '...' : str;
    }

    return {
        original: rawRule,
        index,
        isDisabled,
        category,
        priority,
        title,
        content: str,
        condition,
        tags,
        scope,
        expiryTurns
    };
};

const serializeRule = (parsed: Omit<ParsedRule, 'original' | 'index'>) => {
    let ruleStr = `[${parsed.category}] [${parsed.priority}] [${parsed.title}]: ${parsed.content}`;
    if (parsed.condition && parsed.condition.trim() !== '') {
        ruleStr = `[ĐIỀU KIỆN: ${parsed.condition.trim()}] ${ruleStr}`;
    }
    if (parsed.tags && parsed.tags.length > 0) {
        ruleStr = `[TAGS: ${parsed.tags.join(',')}] ${ruleStr}`;
    }
    if (parsed.scope && parsed.scope !== 'global') {
        ruleStr = `[SCOPE: ${parsed.scope}] ${ruleStr}`;
    }
    if (parsed.expiryTurns !== undefined && parsed.expiryTurns > 0) {
        ruleStr = `[EXPIRY: ${parsed.expiryTurns}] ${ruleStr}`;
    }
    if (parsed.isDisabled) {
        ruleStr = `[VÔ HIỆU HÓA] ${ruleStr}`;
    }
    return ruleStr;
};

// Advanced Preset Library structured by RPG usecase
const PRESET_USE_CASES = [
    { id: 'ALL', label: '🌐 Tất cả' },
    { id: 'Roleplay', label: '🎭 Roleplay' },
    { id: 'Combat', label: '⚔️ Combat' },
    { id: 'Storyline', label: '📜 Storyline' },
    { id: 'Safety', label: '🛡️ An toàn' },
    { id: 'Aesthetics', label: '✨ Thẩm mỹ' }
];

interface AdvancedPreset {
    title: string;
    category: string;
    priority: string;
    content: string;
    condition?: string;
    tags?: string[];
    scope?: 'global' | 'chapter' | 'scene';
    expiryTurns?: number;
    useCase: 'Roleplay' | 'Combat' | 'Storyline' | 'Safety' | 'Aesthetics';
    rating?: string;
    popular?: boolean;
    desc?: string;
}

const PRESET_RULE_TEMPLATES: AdvancedPreset[] = [
    {
        title: "Chống OOC / Tự đóng vai",
        category: "🎭 Đóng vai",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Không bao giờ được tự đóng thế, tự viết tiếp hành động, cảm xúc hoặc hội thoại của nhân vật người chơi (Player). Hãy để người chơi tự kiểm soát nhân vật của mình.",
        desc: "Yêu cầu AI dừng hoàn toàn việc tự ý tả hoặc thực hiện hành động thế nhân vật của bạn.",
        useCase: 'Roleplay',
        tags: ['ooc', 'player-rights'],
        scope: 'global',
        popular: true,
        rating: '5.0'
    },
    {
        title: "Tả cảnh quan & Giác quan sắc bén",
        category: "✍️ Văn phong",
        priority: "🟡 LINH HOẠT",
        content: "Miêu tả sâu sắc các liên kết ngũ giác (âm thanh, khứu giác, điều kiện thời tiết kịch tính cùng cử chỉ cơ thể chậm rãi). Tránh lạm dụng tính từ sáo rỗng.",
        desc: "Tăng tính chân thực, kết nối ngũ giác trực giác mạnh mẽ với môi trường bối cảnh.",
        useCase: 'Aesthetics',
        tags: ['sensory', 'cinematic'],
        scope: 'global',
        rating: '4.8'
    },
    {
        title: "Loại bỏ văn phong mẫu AI",
        category: "✍️ Văn phong",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Tuyệt đối không sử dụng văn phong phụ tá lặp quân hay các cụm câu mồi/kết luận sượng sùng như: 'Tuy nhiên,', 'Có vẻ như', 'bất kể thế nào', 'bánh xe số mệnh'. Câu từ thuần Việt gãy gọn, kịch tính, thô sần nguyên bản.",
        desc: "Lọc bỏ triệt để giọng điệu rườm rà rập khuôn máy móc đặc thù của AI.",
        useCase: 'Aesthetics',
        tags: ['filter-ai', 'clean-text'],
        scope: 'global',
        popular: true,
        rating: '4.9'
    },
    {
        title: "Độ khó sinh tồn tàn nhẫn",
        category: "🔥 Độ khó",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Nguy hiểm trong thế giới này là tuyệt đối nguy kịch, vết thương có thể dẫn tới bại hoại cơ thể rõ rệt, quái vật thông minh mưu sâu. AI không được can thiệp cứu nguy người chơi bất thành văn hay bằng phép màu vô lý.",
        desc: "Đưa hiểm nguy trở thành hiện thực gai góc, rèn luyện cảm xúc kịch tính cao.",
        useCase: 'Combat',
        tags: ['survival', 'hardcore'],
        scope: 'global',
        rating: '4.7'
    },
    {
        title: "Hội thoại súc tích thần thái",
        category: "🗣️ Đối thoại",
        priority: "🟡 LINH HOẠT",
        content: "Giữ đối thoại của NPC cực kỳ súc tích (dưới 3 câu). Thể hiện thần thái cốt cách thông qua hành động, hướng mắt nhìn, nhịp thở đi kèm thay vì nói dông dài lý lẽ.",
        desc: "NPC kiện lời, nội tâm sâu sắc sắc bén hơn rất nhiều.",
        useCase: 'Aesthetics',
        tags: ['short-chat', 'npc-temper'],
        scope: 'global',
        rating: '4.9'
    },
    {
        title: "Bức tường kịch bản cố định",
        category: "⚙️ Cấu trúc",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Ý chí và tôn chỉ của NPC giữ vững tuyệt đối, thù hận hay quy phục đều diễn tiến có lý trí. Không bị lay chuyển dễ dàng chỉ bằng vài từ ngữ hoa mỹ hay thuyết phục sáo rỗng từ người chơi.",
        desc: "Cản trợ người chơi bẻ khóa cốt cách hoặc phá vỡ tâm lý logic của Boss, NPC mấu chốt.",
        useCase: 'Safety',
        tags: ['lore-guard', 'difficulty'],
        scope: 'global',
        rating: '4.8'
    },
    {
        title: "Khẩu âm cổ xưa trang trọng",
        category: "🗣️ Đối thoại",
        priority: "🟡 LINH HOẠT",
        content: "Khi đối thoại, các nhân vật cổ trang dùng đại từ xưng hô đúng kịch bản kiếm hiệp / huyền huyễn dứt khoát như: 'Bản tọa, ta, ngươi, tại hạ, huynh đài, đạo hữu'. Cấm dùng từ ngữ hiện đại như 'Tôi, cậu, bạn, tớ'.",
        desc: "Duy trì không khí gia văn trọn vẹn lý thú.",
        useCase: 'Roleplay',
        tags: ['historical', 'ancient'],
        scope: 'global',
        rating: '4.6'
    }
];

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    styles: any;
    variant?: 'raised' | 'sunken' | 'accent';
    size?: 'sm' | 'md' | 'lg';
}

const NeuButton: React.FC<NeuButtonProps> = ({ 
    children, 
    styles, 
    variant = 'raised', 
    size = 'md', 
    className = '', 
    ...props 
}) => {
    const [isPressed, setIsPressed] = useState(false);
    
    const sizeClasses = {
        sm: 'px-2.5 py-1 text-[11px] rounded-lg tracking-wider font-bold',
        md: 'px-4 py-2 text-xs rounded-xl tracking-wider font-black uppercase',
        lg: 'px-6 py-3 text-sm rounded-2xl tracking-widest font-black uppercase',
    };

    let btnStyle: React.CSSProperties = {
        border: styles.border,
        transition: 'all 0.15s ease-out',
    };

    if (props.disabled) {
        btnStyle = {
            ...btnStyle,
            opacity: 0.4,
            boxShadow: 'none',
            background: styles.bg,
            color: styles.textMuted
        };
    } else if (variant === 'accent') {
        btnStyle = {
            ...btnStyle,
            background: styles.accent,
            color: '#ffffff',
            borderColor: 'transparent',
            boxShadow: isPressed ? 'inset 2px 2px 5px rgba(0,0,0,0.3)' : '0 4px 10px rgba(0,0,0,0.15)'
        };
    } else if (variant === 'sunken' || isPressed) {
        btnStyle = {
            ...btnStyle,
            boxShadow: styles.shadowInner,
            background: styles.bg,
            color: styles.text
        };
    } else {
        btnStyle = {
            ...btnStyle,
            boxShadow: styles.shadowButton,
            background: styles.convexBg,
            color: styles.text
        };
    }

    return (
        <button
            onMouseDown={() => !props.disabled && setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            onTouchStart={() => !props.disabled && setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            style={btnStyle}
            className={`transition-all hover:scale-[1.01] active:translate-y-[1px] flex items-center justify-center gap-1.5 ${sizeClasses[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

interface NeuCardProps {
    styles: any;
    variant?: 'flat' | 'raised' | 'sunken' | 'fancy';
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
    onClick?: () => void;
}

const NeuCard: React.FC<NeuCardProps> = ({ 
    children, 
    styles, 
    variant = 'raised', 
    className = '',
    style = {},
    onClick
}) => {
    let cardStyle: React.CSSProperties = {
        border: styles.border,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style
    };

    if (variant === 'sunken') {
        cardStyle = {
            ...cardStyle,
            boxShadow: styles.shadowInner,
            background: styles.bg,
        };
    } else if (variant === 'flat') {
        cardStyle = {
            ...cardStyle,
            boxShadow: 'none',
            background: styles.flatBg,
        };
    } else if (variant === 'fancy') {
        cardStyle = {
            ...cardStyle,
            boxShadow: styles.shadowOuter,
            background: `linear-gradient(135deg, ${styles.bg}, ${styles.bg}ee)`,
        };
    } else {
        cardStyle = {
            ...cardStyle,
            boxShadow: styles.shadowOuter,
            background: styles.convexBg,
        };
    }

    return (
        <div 
            onClick={onClick}
            style={cardStyle} 
            className={`rounded-2xl ${onClick ? 'cursor-pointer hover:scale-[1.005]' : ''} ${className}`}
        >
            {children}
        </div>
    );
};

interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    styles: any;
}

const NeuInput: React.FC<NeuInputProps> = ({ styles, className = '', ...props }) => {
    return (
        <input
            style={{
                boxShadow: styles.shadowInner,
                background: styles.bg,
                border: styles.border,
                color: styles.text
            }}
            className={`w-full px-3 py-2 text-xs rounded-xl outline-none placeholder:opacity-50 focus:border-stone-450 dark:focus:border-slate-700 transition-all ${className}`}
            {...props}
        />
    );
};

interface NeuTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    styles: any;
}

const NeuTextarea: React.FC<NeuTextareaProps> = ({ styles, className = '', ...props }) => {
    return (
        <textarea
            style={{
                boxShadow: styles.shadowInner,
                background: styles.bg,
                border: styles.border,
                color: styles.text
            }}
            className={`w-full px-4 py-3 text-xs rounded-2xl outline-none placeholder:opacity-50 focus:border-stone-450 dark:focus:border-slate-700 transition-all resize-none ${className}`}
            {...props}
        />
    );
};

interface NeuSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    styles: any;
}

const NeuSelect: React.FC<NeuSelectProps> = ({ styles, className = '', children, ...props }) => {
    return (
        <select
            style={{
                boxShadow: styles.shadowButton,
                background: styles.flatBg,
                border: styles.border,
                color: styles.text
            }}
            className={`px-3 py-2 text-xs rounded-xl outline-none cursor-pointer focus:border-stone-450 dark:focus:border-slate-700 transition-all ${className}`}
            {...props}
        >
            {children}
        </select>
    );
};

const ContextWindowModal: React.FC<ContextWindowModalProps> = ({
    show, onClose, activeWorld, handleUpdateContextConfig,
    settings, history, turnCount, tawaPresetConfig, gameTime, lastAction,
    dynamicRules = [], setDynamicRules, isInline = false,
    initialTab, allowedTabs
}) => {
    const { theme } = useTheme();

    const styles = useMemo(() => {
        switch (theme) {
            case 'light':
                return {
                    bg: '#e6ebf4', 
                    text: '#2c3e50',
                    textMuted: '#7f8c8d',
                    accent: '#db2777', 
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                    shadowOuter: '6px 6px 12px #c8d0dc, -6px -6px 12px #ffffff',
                    shadowInner: 'inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff',
                    shadowButton: '4px 4px 8px #c8d0dc, -4px -4px 8px #ffffff',
                    shadowButtonActive: 'inset 2px 2px 4px #cbd5e1, inset -2px -2px 4px #ffffff',
                    flatBg: 'linear-gradient(135deg, #edf2fc, #dee4ed)',
                    convexBg: 'linear-gradient(135deg, #f2f7fc, #dae0e9)',
                };
            case 'dark':
                return {
                    bg: '#0b1329', 
                    text: '#f1f5f9',
                    textMuted: '#94a3b8',
                    accent: '#f472b6',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    shadowOuter: '6px 6px 12px #040812, -6px -6px 12px #121e40',
                    shadowInner: 'inset 3px 3px 6px #040812, inset -3px -3px 6px #121e40',
                    shadowButton: '4px 4px 8px #040812, -4px -4px 8px #121e40',
                    shadowButtonActive: 'inset 2px 2px 4px #040812, inset -2px -2px 4px #121e40',
                    flatBg: 'linear-gradient(135deg, #0d162d, #080d1e)',
                    convexBg: 'linear-gradient(135deg, #0f1c3a, #060a16)',
                };
            case 'pastel':
                return {
                    bg: '#e8e2d5', 
                    text: '#2c1810',
                    textMuted: '#7a6a60',
                    accent: '#bf7575',
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                    shadowOuter: '6px 6px 12px #cbc3b2, -6px -6px 12px #ffffff',
                    shadowInner: 'inset 3px 3px 6px #cbc3b2, inset -3px -3px 6px #ffffff',
                    shadowButton: '4px 4px 8px #cbc3b2, -4px -4px 8px #ffffff',
                    shadowButtonActive: 'inset 2px 2px 4px #cbc3b2, inset -2px -2px 4px #ffffff',
                    flatBg: 'linear-gradient(135deg, #f3ede2, #ddd6c8)',
                    convexBg: 'linear-gradient(135deg, #f9f4ea, #d5cebf)',
                };
            case 'clay':
                return {
                    bg: '#debca3', 
                    text: '#35251c',
                    textMuted: '#7c6353',
                    accent: '#cf5c36',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    shadowOuter: '6px 6px 12px #be967a, -6px -6px 12px #fadec4',
                    shadowInner: 'inset 3px 3px 6px #be967a, inset -3px -3px 6px #fadec4',
                    shadowButton: '4px 4px 8px #be967a, -4px -4px 8px #fadec4',
                    shadowButtonActive: 'inset 2px 2px 4px #be967a, inset -2px -2px 4px #fadec4',
                    flatBg: 'linear-gradient(135deg, #ebd0bc, #cca78d)',
                    convexBg: 'linear-gradient(135deg, #f0d6c4, #c7a186)',
                };
            default:
                return {
                    bg: 'var(--theme-bg, #0b1329)',
                    text: 'var(--theme-text, #f1f5f9)',
                    textMuted: 'var(--theme-muted, #94a3b8)',
                    accent: 'var(--theme-accent, #ec4899)',
                    border: 'var(--neu-border, 1px solid rgba(255, 255, 255, 0.05))',
                    shadowOuter: '6px 6px 12px var(--neu-shadow-dark, rgba(0,0,0,0.5)), -6px -6px 12px var(--neu-shadow-light, rgba(255,255,255,0.05))',
                    shadowInner: 'inset 3px 3px 6px var(--neu-shadow-dark, rgba(0,0,0,0.5)), inset -3px -3px 6px var(--neu-shadow-light, rgba(255,255,255,0.05))',
                    shadowButton: '4px 4px 8px var(--neu-shadow-dark, rgba(0,0,0,0.5)), -4px -4px 8px var(--neu-shadow-light, rgba(255,255,255,0.05))',
                    shadowButtonActive: 'inset 2px 2px 4px var(--neu-shadow-dark, rgba(0,0,0,0.5)), inset -2px -2px 4px var(--neu-shadow-light, rgba(255,255,255,0.05))',
                    flatBg: 'var(--neu-flat-bg, var(--theme-bg, #0b1329))',
                    convexBg: 'var(--neu-convex-bg, var(--theme-bg, #0b1329))',
                };
        }
    }, [theme]);

    const { isMobile: isMobileMode } = useResponsive();
    const tabsToRender = allowedTabs || ['rules', 'config', 'debugger'];
    const [activeContextTab, setActiveContextTab] = useState<'config' | 'rules' | 'debugger'>(
        initialTab && tabsToRender.includes(initialTab) ? initialTab : (tabsToRender[0] || 'rules')
    );

    useEffect(() => {
        if (initialTab && tabsToRender.includes(initialTab)) {
            setActiveContextTab(initialTab);
        }
    }, [initialTab]);

    const [composerMode, setComposerMode] = useState<'advanced' | 'simple' | 'ai-assist'>('advanced');
    const [mobileRuleSubTab, setMobileRuleSubTab] = useState<'editor' | 'presets'>('editor');
    const [selectedPresetUseCase, setSelectedPresetUseCase] = useState<string>('ALL');
    
    // Core states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALL');
    const [selectedFilterStatus, setSelectedFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

    // Inline editing states
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingCategory, setEditingCategory] = useState('');
    const [editingPriority, setEditingPriority] = useState('');
    const [editingCondition, setEditingCondition] = useState('');
    const [editingContent, setEditingContent] = useState('');

    // Advanced Rule Editor target selection
    const [selectedRuleIdx, setSelectedRuleIdx] = useState<number | null>(null);
    const [editorTab, setEditorTab] = useState<'core' | 'trigger' | 'metadata'>('core');

    // Edit form states (or creation states)
    const [ruleTitle, setRuleTitle] = useState('');
    const [ruleCategory, setRuleCategory] = useState('🎭 Đóng vai');
    const [rulePriority, setRulePriority] = useState('🔴 TUYỆT ĐỐI');
    const [ruleContent, setRuleContent] = useState('');
    const [ruleCondition, setRuleCondition] = useState('');
    const [ruleTagsStr, setRuleTagsStr] = useState('');
    const [ruleScope, setRuleScope] = useState<'global' | 'chapter' | 'scene'>('global');
    const [ruleExpiry, setRuleExpiry] = useState<number>(0);

    // AI Assist Helpers
    const [aiAssistConcept, setAiAssistConcept] = useState('');
    const [aiAssistLoading, setAiAssistLoading] = useState(false);
    const [aiAssistOutput, setAiAssistOutput] = useState('');
    const [aiAssistConflictDetails, setAiAssistConflictDetails] = useState<string | null>(null);
    const [aiAssistSuggestions, setAiAssistSuggestions] = useState<{title: string, content: string}[]>([]);

    // Undo / Redo dynamic rule list stack (History depth of 15)
    const [ruleHistory, setRuleHistory] = useState<string[][]>([]);
    const [ruleHistoryPointer, setRuleHistoryPointer] = useState<number>(-1);

    // Visual Trigger Builder States
    const [triggerType, setTriggerType] = useState('turn_count');
    const [triggerOperator, setTriggerOperator] = useState('>');
    const [triggerValue, setTriggerValue] = useState('5');

    // Bulk Select & Collapsed categories
    const [bulkSelectedIdxs, setBulkSelectedIdxs] = useState<number[]>([]);
    const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Simulator states
    const [simulatorInput, setSimulatorInput] = useState('');
    const [simulatorOutput, setSimulatorOutput] = useState('');
    const [isSimulating, setIsSimulating] = useState(false);

    // Import/Export Modal Zone
    const [showImportExport, setShowImportExport] = useState(false);
    const [importExportText, setImportExportText] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');

    // Ratings & Preset selected usecase
    const [activePresetGroup, setActivePresetGroup] = useState<'ALL' | 'Roleplay' | 'Combat' | 'Storyline' | 'Safety' | 'Aesthetics'>('ALL');

    // Synchronize initial rules list with History Stack
    useEffect(() => {
        if (dynamicRules.length > 0 && ruleHistory.length === 0) {
            setRuleHistory([dynamicRules]);
            setRuleHistoryPointer(0);
        }
    }, [dynamicRules]);

    const recordHistory = (newList: string[]) => {
        if (!setDynamicRules) return;
        const trunk = ruleHistory.slice(0, ruleHistoryPointer + 1);
        trunk.push(newList);
        // limit history to 20 items
        if (trunk.length > 20) trunk.shift();
        setRuleHistory(trunk);
        setRuleHistoryPointer(trunk.length - 1);
        setDynamicRules(newList);
    };

    const handleUndo = () => {
        if (ruleHistoryPointer > 0) {
            const nextIdx = ruleHistoryPointer - 1;
            setRuleHistoryPointer(nextIdx);
            if (setDynamicRules) {
                setDynamicRules(ruleHistory[nextIdx]);
            }
        }
    };

    const handleRedo = () => {
        if (ruleHistoryPointer < ruleHistory.length - 1) {
            const nextIdx = ruleHistoryPointer + 1;
            setRuleHistoryPointer(nextIdx);
            if (setDynamicRules) {
                setDynamicRules(ruleHistory[nextIdx]);
            }
        }
    };

    // Real-time client evaluator
    const evaluateRuleConditionClient = (conditionStr?: string) => {
        if (!conditionStr || conditionStr.trim() === '' || conditionStr.toLowerCase() === 'always' || conditionStr === 'luôn luôn' || conditionStr === 'luôn áp dụng') {
            return { active: true, label: 'Luôn áp dụng' };
        }
        
        const cond = conditionStr.trim();
        const compRegex = /^([a-zA-Z_0-9.]+)\s*(>=|<=|==|===|=|>|<)\s*([a-zA-Z_0-9.-]+|'[^']*'|"[^"]*")$/;
        const match = cond.match(compRegex);

        let leftVal: any = undefined;
        let leftLabel = '';
        if (match) {
            const [, rawLeft, op, rawRight] = match;
            const left = rawLeft.trim();
            const right = rawRight.trim().replace(/^['"]|['"]$/g, '');

            if (left === 'turn' || left === 'turnCount' || left === 'turn_count') {
                leftVal = turnCount;
                leftLabel = `Lượt (${turnCount})`;
            } else if (left === 'hour' || left === 'time_hour') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.hour : 8;
                leftLabel = `Giờ (${leftVal}h)`;
            } else if (left === 'day' || left === 'time_day') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.day : 1;
                leftLabel = `Ngày (${leftVal})`;
            } else if (left === 'month' || left === 'time_month') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.month : 1;
                leftLabel = `Tháng (${leftVal})`;
            } else if (left === 'year' || left === 'time_year') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.year : 2024;
                leftLabel = `Năm (${leftVal})`;
            } else {
                const cleanKey = left.replace(/^(vars\.|var\.|biến\.)/, '');
                const tavoVars = (activeWorld as any)?.tavoVars || {};
                if (cleanKey in tavoVars) {
                    leftVal = tavoVars[cleanKey];
                    leftLabel = `Biến ${cleanKey} (${leftVal})`;
                } else {
                    leftLabel = `Biến ${cleanKey}`;
                }
            }

            if (leftVal === undefined) {
                return { active: false, label: `${leftLabel} ${op} ${right}` };
            }

            const rightNum = Number(right);
            const isRightNumeric = !isNaN(rightNum);
            const rightVal = isRightNumeric ? rightNum : right;

            let result = false;
            switch (op) {
                case '>': result = Number(leftVal) > Number(rightVal); break;
                case '<': result = Number(leftVal) < Number(rightVal); break;
                case '>=': result = Number(leftVal) >= Number(rightVal); break;
                case '<=': result = Number(leftVal) <= Number(rightVal); break;
                case '==':
                case '===':
                case '=':
                    result = String(leftVal) === String(rightVal); break;
            }

            return { 
                active: result, 
                label: `${leftLabel} ${op} ${right}` 
            };
        }

        const keywordRegex = /^(keyword|contains|chứa|player_msg_contains|tin_nhắn_chứa)\s*:\s*(.+)$/i;
        const kwMatch = cond.match(keywordRegex);
        if (kwMatch) {
            const searchStr = kwMatch[2].trim().replace(/^['"]|['"]$/g, '');
            const msg = (lastAction || '').toLowerCase();
            const contains = msg.includes(searchStr.toLowerCase());
            return {
                active: contains,
                label: `Tin nhắn chứa "${searchStr}"`
            };
        }

        return { active: true, label: `ĐK: ${cond}` };
    };

    const config = activeWorld?.config?.contextConfig || {
        items: {
          playerProfile: true, worldInfo: true, longTermMemory: true, relevantMemories: true, storyBible: true,
          entities: true, npcRegistry: true, timeSystem: true, reinforcement: true, graphRag: true
        },
        maxEntities: 10, recentHistoryCount: 100
    };

    const toggleContextItem = (key: keyof ContextWindowConfig['items']) => {
        const newConfig = {
            ...config,
            items: {
                ...config.items,
                [key]: !config.items[key]
            }
        };
        handleUpdateContextConfig(newConfig);
    };

    const updateContextMaxEntities = (val: number) => {
        handleUpdateContextConfig({ ...config, maxEntities: val });
    };

    const updateContextHistoryCount = (val: number) => {
        handleUpdateContextConfig({ ...config, recentHistoryCount: val });
    };

    const updateContextMaxTokens = (val: number) => {
        handleUpdateContextConfig({ ...config, maxContextTokens: val });
    };

    // Parse Rules once
    const parsedRulesList = useMemo(() => {
        return dynamicRules.map((rule, idx) => parseRule(rule, idx));
    }, [dynamicRules]);

    // Local automatic conflict scanner
    const localConflicts = useMemo(() => {
        const activeList = parsedRulesList.filter(r => !r.isDisabled);
        const issues: Record<number, string[]> = {};

        for (let i = 0; i < activeList.length; i++) {
            for (let j = i + 1; j < activeList.length; j++) {
                const r1 = activeList[i];
                const r2 = activeList[j];

                // Name overlapping
                if (r1.title.toLowerCase() === r2.title.toLowerCase()) {
                    issues[r1.index] = [...(issues[r1.index] || []), `Trùng tên quy định với "${r2.title}"`];
                    issues[r2.index] = [...(issues[r2.index] || []), `Trùng tên quy định với "${r1.title}"`];
                }

                // Priority collision on same category
                if (r1.category === r2.category && r1.priority === '🔴 TUYỆT ĐỐI' && r2.priority === '🟢 KHUYẾN NGHỊ') {
                    const clean1 = r1.content.toLowerCase();
                    const clean2 = r2.content.toLowerCase();
                    // Basic overlap check
                    const common = clean1.split(/\s+/).filter(w => w.length > 5 && clean2.includes(w));
                    if (common.length > 2) {
                        issues[r1.index] = [...(issues[r1.index] || []), `Khả năng mạo lạm văn cảnh với "${r2.title}" (Cùng mục, độ cưỡng chế nghịch chiều)`];
                        issues[r2.index] = [...(issues[r2.index] || []), `Khả năng mạo lạm văn cảnh với "${r1.title}" (Cùng mục, độ cưỡng chế nghịch chiều)`];
                    }
                }
            }
        }
        return issues;
    }, [parsedRulesList]);

    // Search and filter list
    const filteredRules = useMemo(() => {
        return parsedRulesList.filter(rule => {
            const matchesSearch = searchQuery 
                ? rule.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (rule.tags && rule.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
                : true;
            
            const matchesCategory = selectedFilterCategory === 'ALL' 
                ? true 
                : rule.category === selectedFilterCategory;

            const matchesStatus = selectedFilterStatus === 'ALL' 
                ? true 
                : selectedFilterStatus === 'ACTIVE' 
                    ? !rule.isDisabled 
                    : rule.isDisabled;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [parsedRulesList, searchQuery, selectedFilterCategory, selectedFilterStatus]);

    // Token impact estimation (character counts / 3.8 average word tokens)
    const estimatedTokenUsage = useMemo(() => {
        const enabledRules = parsedRulesList.filter(r => !r.isDisabled);
        const characters = enabledRules.reduce((acc, r) => acc + (r.title.length + r.content.length + (r.condition?.length || 0)), 0);
        return Math.ceil(characters / 3.8);
    }, [parsedRulesList]);

    // Calculate IsDirty state for currently active rule inputs
    const isCurrentDirty = useMemo(() => {
        if (selectedRuleIdx === null) {
            // Check if any fields are written in a blank creation form
            return !!(ruleTitle.trim() || ruleContent.trim() || ruleCondition.trim() || ruleTagsStr.trim() || ruleExpiry > 0 || ruleScope !== 'global');
        }
        const initial = parsedRulesList[selectedRuleIdx];
        if (!initial) return false;

        const currentTags = ruleTagsStr.split(',').map(t => t.trim()).filter(Boolean);
        const initialTags = initial.tags || [];
        const tagsDiff = currentTags.join(',') !== initialTags.join(',');

        return (
            initial.title !== ruleTitle.trim() ||
            initial.content !== ruleContent.trim() ||
            (initial.condition || '') !== ruleCondition.trim() ||
            initial.category !== ruleCategory ||
            initial.priority !== rulePriority ||
            initial.scope !== ruleScope ||
            (initial.expiryTurns || 0) !== ruleExpiry ||
            tagsDiff
        );
    }, [
        selectedRuleIdx, ruleTitle, ruleContent, ruleCondition, ruleCategory, 
        rulePriority, ruleTagsStr, ruleScope, ruleExpiry, parsedRulesList
    ]);

    // Load full details of rule into Right panel editor
    const handleSelectRuleForEditing = (idx: number) => {
        const rule = parsedRulesList[idx];
        if (!rule) return;
        setSelectedRuleIdx(idx);
        setRuleTitle(rule.title);
        setRuleCategory(rule.category);
        setRulePriority(rule.priority);
        setRuleContent(rule.content);
        setRuleCondition(rule.condition || '');
        setRuleTagsStr(rule.tags ? rule.tags.join(', ') : '');
        setRuleScope(rule.scope || 'global');
        setRuleExpiry(rule.expiryTurns || 0);

        // Reset AI assists panel
        resetAiAssistConsole();
    };

    const handleOpenBlankCreation = () => {
        setSelectedRuleIdx(null);
        setRuleTitle('');
        setRuleCategory('🎭 Đóng vai');
        setRulePriority('🔴 TUYỆT ĐỐI');
        setRuleContent('');
        setRuleCondition('');
        setRuleTagsStr('');
        setRuleScope('global');
        setRuleExpiry(0);
        resetAiAssistConsole();
    };

    const resetAiAssistConsole = () => {
        setAiAssistConcept('');
        setAiAssistOutput('');
        setAiAssistConflictDetails(null);
        setAiAssistSuggestions([]);
    };

    // Save detailed rule (either overwrite selected or append new)
    const handleSaveDetailedRule = () => {
        if (!ruleContent.trim()) return;

        const parsedTags = ruleTagsStr.split(',').map(s => s.trim()).filter(Boolean);
        const serialized = serializeRule({
            isDisabled: selectedRuleIdx !== null ? parsedRulesList[selectedRuleIdx].isDisabled : false,
            category: ruleCategory,
            priority: rulePriority,
            title: ruleTitle.trim() || 'Không tên',
            content: ruleContent.trim(),
            condition: ruleCondition.trim(),
            tags: parsedTags,
            scope: ruleScope,
            expiryTurns: ruleExpiry > 0 ? ruleExpiry : undefined
        });

        const list = [...dynamicRules];
        if (selectedRuleIdx !== null) {
            // Overwrite existing
            list[selectedRuleIdx] = serialized;
            recordHistory(list);
        } else {
            // Append new rule
            list.push(serialized);
            recordHistory(list);
            // Select newly created rule
            setSelectedRuleIdx(list.length - 1);
        }
    };

    // Save detailed rule as a copy (Duplicate)
    const handleSaveAsCopy = () => {
        if (!ruleContent.trim()) return;
        const parsedTags = ruleTagsStr.split(',').map(s => s.trim()).filter(Boolean);
        const nameCopy = ruleTitle.trim() ? `${ruleTitle.trim()} (Bản sao)` : 'Bản sao';
        const serialized = serializeRule({
            isDisabled: false,
            category: ruleCategory,
            priority: rulePriority,
            title: nameCopy,
            content: ruleContent.trim(),
            condition: ruleCondition.trim(),
            tags: parsedTags,
            scope: ruleScope,
            expiryTurns: ruleExpiry > 0 ? ruleExpiry : undefined
        });

        const list = [...dynamicRules];
        list.push(serialized);
        recordHistory(list);
        setSelectedRuleIdx(list.length - 1);
    };

    // Delete active rule completely
    const handleRemoveRule = (index: number) => {
        const list = dynamicRules.filter((_, idx) => idx !== index);
        recordHistory(list);
        
        // Deselect or adjust pointer
        if (selectedRuleIdx === index) {
            setSelectedRuleIdx(null);
            handleOpenBlankCreation();
        } else if (selectedRuleIdx !== null && selectedRuleIdx > index) {
            setSelectedRuleIdx(selectedRuleIdx - 1);
        }
    };

    // Toggle rule status (Active / Inactive)
    const handleToggleRuleActive = (index: number) => {
        const parsed = parsedRulesList[index];
        const updated = serializeRule({
            ...parsed,
            isDisabled: !parsed.isDisabled
        });
        const list = [...dynamicRules];
        list[index] = updated;
        recordHistory(list);

        // Sync local edit panel state if currently editing this index
        if (selectedRuleIdx === index) {
            handleSelectRuleForEditing(index);
        }
    };

    // Visual Trigger Builder Injection
    const handleInjectTriggerBlock = () => {
        let blockStatement = '';
        if (triggerType === 'turn_count') {
            blockStatement = `turn ${triggerOperator} ${triggerValue}`;
        } else if (triggerType === 'keyword') {
            blockStatement = `keyword:${triggerValue.trim()}`;
        } else if (triggerType === 'hour') {
            blockStatement = `hour ${triggerOperator} ${triggerValue}`;
        } else if (triggerType === 'day') {
            blockStatement = `day ${triggerOperator} ${triggerValue}`;
        } else if (triggerType === 'custom_var') {
            blockStatement = `var.${triggerValue.trim()} ${triggerOperator} 1`;
        }

        const newCond = ruleCondition.trim() 
            ? `${ruleCondition.trim()} && ${blockStatement}` 
            : blockStatement;
        setRuleCondition(newCond);
    };

    // HTML5 Drag and Drop events to rearrange list swiftly
    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDropRearrange = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const list = [...dynamicRules];
        const movedItem = list[sourceIndex];
        list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, movedItem);
        recordHistory(list);

        // adjust selected pointer
        if (selectedRuleIdx === sourceIndex) {
            setSelectedRuleIdx(targetIndex);
        } else if (selectedRuleIdx !== null) {
            if (sourceIndex < selectedRuleIdx && targetIndex >= selectedRuleIdx) {
                setSelectedRuleIdx(selectedRuleIdx - 1);
            } else if (sourceIndex > selectedRuleIdx && targetIndex <= selectedRuleIdx) {
                setSelectedRuleIdx(selectedRuleIdx + 1);
            }
        }
    };

    // Quick loading a preset card with fine-tuning state open
    const handleSelectPreset = (preset: AdvancedPreset) => {
        setSelectedRuleIdx(null);
        setRuleTitle(preset.title);
        setRuleCategory(preset.category);
        setRulePriority(preset.priority);
        setRuleContent(preset.content);
        setRuleCondition(preset.condition || '');
        setRuleTagsStr(preset.tags ? preset.tags.join(', ') : '');
        setRuleScope(preset.scope || 'global');
        setRuleExpiry(preset.expiryTurns || 0);
        setEditorTab('core');
        resetAiAssistConsole();
    };

    // Bulk Actions handlers
    const handleToggleBulkSelect = (idx: number) => {
        if (bulkSelectedIdxs.includes(idx)) {
            setBulkSelectedIdxs(bulkSelectedIdxs.filter(i => i !== idx));
        } else {
            setBulkSelectedIdxs([...bulkSelectedIdxs, idx]);
        }
    };

    const handleBulkSelectAll = () => {
        if (bulkSelectedIdxs.length === filteredRules.length) {
            setBulkSelectedIdxs([]);
        } else {
            setBulkSelectedIdxs(filteredRules.map(r => r.index));
        }
    };

    const handleBulkEnable = () => {
        if (bulkSelectedIdxs.length === 0) return;
        const list = [...dynamicRules];
        bulkSelectedIdxs.forEach(idx => {
            const parsed = parsedRulesList[idx];
            if (parsed) {
                list[idx] = serializeRule({ ...parsed, isDisabled: false });
            }
        });
        recordHistory(list);
        setBulkSelectedIdxs([]);
    };

    const handleBulkDisable = () => {
        if (bulkSelectedIdxs.length === 0) return;
        const list = [...dynamicRules];
        bulkSelectedIdxs.forEach(idx => {
            const parsed = parsedRulesList[idx];
            if (parsed) {
                list[idx] = serializeRule({ ...parsed, isDisabled: true });
            }
        });
        recordHistory(list);
        setBulkSelectedIdxs([]);
    };

    const handleBulkDelete = () => {
        if (bulkSelectedIdxs.length === 0) return;
        const list = dynamicRules.filter((_, idx) => !bulkSelectedIdxs.includes(idx));
        recordHistory(list);
        setBulkSelectedIdxs([]);
        setSelectedRuleIdx(null);
        handleOpenBlankCreation();
        setShowDeleteConfirm(false);
    };

    const handleClearAll = () => {
        recordHistory([]);
        setBulkSelectedIdxs([]);
        setSelectedRuleIdx(null);
        handleOpenBlankCreation();
        setShowClearConfirm(false);
    };

    // Collapse/Expand group toggles
    const handleToggleCollapseCategory = (cat: string) => {
        if (collapsedCategories.includes(cat)) {
            setCollapsedCategories(collapsedCategories.filter(c => c !== cat));
        } else {
            setCollapsedCategories([...collapsedCategories, cat]);
        }
    };

    // AI Assist API Call handler
    const handleCallAiAssist = async (action: 'draft' | 'rephrase' | 'detect-conflict' | 'suggest') => {
        if (aiAssistLoading) return;
        setAiAssistLoading(true);
        setAiAssistOutput('');
        setAiAssistConflictDetails(null);
        setAiAssistSuggestions([]);

        try {
            const currentRuleData = {
                title: ruleTitle,
                category: ruleCategory,
                priority: rulePriority,
                content: ruleContent,
                condition: ruleCondition
            };

            const response = await fetch('/api/ai/rule-assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    currentRule: currentRuleData,
                    existingRules: parsedRulesList.map(r => ({ title: r.title, content: r.content })),
                    prompt: aiAssistConcept
                })
            });

            const data = await response.json();
            if (response.ok) {
                const text = data.result || '';
                if (action === 'draft' || action === 'rephrase') {
                    setAiAssistOutput(text.trim());
                } else if (action === 'detect-conflict') {
                    try {
                        const parsedJson = JSON.parse(text);
                        if (parsedJson.hasConflict) {
                            setAiAssistConflictDetails(parsedJson.explanation);
                        } else {
                            setAiAssistConflictDetails("✅ Không ghi nhận bất kỳ xung đột cốt lõi nào đối với hệ thống luật lệ hiện hữu!");
                        }
                    } catch {
                        setAiAssistConflictDetails(text);
                    }
                } else if (action === 'suggest') {
                    try {
                        const list = JSON.parse(text);
                        setAiAssistSuggestions(Array.isArray(list) ? list : []);
                    } catch {
                        // fallback mock from text
                        setAiAssistOutput(text);
                    }
                }
            } else {
                toast.error("Lỗi AI Trợ lý: " + (data.error || 'Unknown error'));
            }
        } catch (e: any) {
            toast.error("Lỗi kết nối bộ não AI: " + e.message + ". Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY hoặc Proxy trên máy chủ.");
        } finally {
            setAiAssistLoading(false);
        }
    };

    // Run custom rule compilation in simulator
    const handleRunRuleSimulation = async () => {
        if (!simulatorInput.trim() || isSimulating) return;
        setIsSimulating(true);
        setSimulatorOutput('Đang gửi ngữ cảnh luật lệ tới bộ giả lập AI Tawa...');

        try {
            // Build the system instructions simulating the active rules
            const activeRulesText = parsedRulesList
                .filter(r => !r.isDisabled)
                .map(r => `[LUẬT LỆ: ${r.title}] (Độ Cưỡng Chế: ${r.priority}) - ${r.content}`)
                .join('\n');

            const aiClient = getAiClient(settings);
            const response = await aiClient.models.generateContent({
                model: settings?.aiModel || "gemini-3.5-flash",
                contents: [
                    { role: 'user', parts: [{ text: simulatorInput }] }
                ],
                config: {
                    systemInstruction: `Bạn là mô hình kiểm thử RPG chính văn. Hãy trả lời câu hỏi của người chơi, đồng thời tuân thủ TUYỆT ĐỐI các luật lệ bối cảnh cưỡng chế sau đây:\n\n${activeRulesText || "Không có luật lệ nào."}`,
                    temperature: 0.7
                }
            });

            if (response && response.text) {
                setSimulatorOutput(response.text);
            } else {
                setSimulatorOutput('Không có câu trả lời từ trợ lý AI giả lập.');
            }
        } catch (error: any) {
            setSimulatorOutput(`⚠️ Thất bại kết nối giả lập: ${error.message}`);
        } finally {
            setIsSimulating(false);
        }
    };

    // Swap position arrow keys helper
    const handleMoveRuleArrow = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= dynamicRules.length) return;

        const list = [...dynamicRules];
        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;
        recordHistory(list);

        if (selectedRuleIdx === index) {
            setSelectedRuleIdx(targetIndex);
        } else if (selectedRuleIdx === targetIndex) {
            setSelectedRuleIdx(index);
        }
    };

    // Import/Export presets JSON
    const handleImportJson = (mode: 'merge' | 'replace') => {
        setImportError('');
        setImportSuccess('');
        try {
            const parsed = JSON.parse(importExportText);
            if (Array.isArray(parsed)) {
                if (mode === 'replace') {
                    recordHistory(parsed);
                    setImportSuccess(`Đã thay thế toàn bộ thành công ${parsed.length} quy tắc vào kịch bản!`);
                } else {
                    const currentSet = new Set(dynamicRules);
                    const mergedList = [...dynamicRules];
                    let addedCount = 0;
                    parsed.forEach((rule: string) => {
                        if (!currentSet.has(rule)) {
                            mergedList.push(rule);
                            addedCount++;
                        }
                    });
                    recordHistory(mergedList);
                    setImportSuccess(`Đã gộp thành công ${addedCount} quy tắc mới vào kịch bản hiện hữu!`);
                }
                setTimeout(() => {
                    setShowImportExport(false);
                    setImportSuccess('');
                }, 1800);
            } else {
                setImportError('Định dạng JSON không hợp lệ. Phải là mảng dạng ["chuỗi luật", "chuỗi luật 2"]');
            }
        } catch (e: any) {
            setImportError('Cú pháp JSON lỗi: ' + e.message);
        }
    };

    // Export action
    const handleExportJson = () => {
        setImportError('');
        setImportSuccess('');
        const data = JSON.stringify(dynamicRules, null, 2);
        setImportExportText(data);
        navigator.clipboard.writeText(data).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleStartEditing = (rule: ParsedRule) => {
        setEditingIndex(rule.index);
        setEditingTitle(rule.title);
        setEditingCategory(rule.category);
        setEditingPriority(rule.priority);
        setEditingCondition(rule.condition || '');
        setEditingContent(rule.content);
    };

    const handleSaveInlineEdit = (index: number) => {
        const parsed = parsedRulesList[index];
        if (!parsed) return;
        
        const serialized = serializeRule({
            isDisabled: parsed.isDisabled,
            category: editingCategory,
            priority: editingPriority,
            title: editingTitle.trim() || 'Không tên',
            content: editingContent.trim(),
            condition: editingCondition.trim(),
            tags: parsed.tags,
            scope: parsed.scope,
            expiryTurns: parsed.expiryTurns
        });
        
        const list = [...dynamicRules];
        list[index] = serialized;
        recordHistory(list);
        setEditingIndex(null);
    };

    const handleMoveRule = handleMoveRuleArrow;

    const handleAddRule = () => {
        if (!ruleContent.trim()) return;
        const parsedTags = ruleTagsStr.split(',').map(s => s.trim()).filter(Boolean);
        const serialized = serializeRule({
            isDisabled: false,
            category: ruleCategory,
            priority: rulePriority,
            title: ruleTitle.trim() || 'Không tên',
            content: ruleContent.trim(),
            condition: ruleCondition.trim(),
            tags: parsedTags,
            scope: ruleScope,
            expiryTurns: ruleExpiry > 0 ? ruleExpiry : undefined
        });

        const list = [...dynamicRules];
        list.push(serialized);
        recordHistory(list);
        handleOpenBlankCreation();
    };

    if (!activeWorld) return null;

    const wrapperClasses = isInline 
        ? "w-full h-full flex flex-col overflow-hidden text-stone-900 dark:text-slate-100" 
        : "flex flex-col overflow-hidden text-stone-900 dark:text-slate-100 w-full h-full bg-stone-200 dark:bg-mystic-950 rounded-xl";

    const content = (
        <div className={wrapperClasses}>
            {/* Header */}
            <div className={`border-b border-stone-450 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between items-stretch gap-2 bg-stone-300 dark:bg-mystic-900/80 shrink-0 ${isInline ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center gap-2.5">
                    <div className={`${isInline ? 'p-1.5' : 'p-2'} bg-mystic-accent/15 rounded-lg text-mystic-accent`}>
                        <Database size={isInline ? 16 : 24} />
                    </div>
                    <div className="text-left w-full">
                        <h2 className={`font-bold text-stone-850 dark:text-slate-100 flex items-center gap-1.5 ${isInline ? 'text-sm/tight' : 'text-lg'}`}>
                            {tabsToRender.length === 1 && tabsToRender[0] === 'rules'
                                ? 'Bản Đồ Luật Lệ Tối Cao'
                                : (isInline ? 'Điều phối Luật lệ & Ngữ cảnh' : 'Trung tâm Điều phối Luật lệ & Ngữ cảnh')}
                            {!isInline && <span className="text-xs font-black uppercase text-mystic-accent bg-mystic-accent/10 px-2 py-0.5 rounded border border-mystic-accent/20 animate-pulse">Advanced Edition</span>}
                        </h2>
                        {!isInline && (
                            <p className="text-xs text-stone-550 dark:text-slate-450 uppercase tracking-widest font-black">
                                {tabsToRender.length === 1 && tabsToRender[0] === 'rules'
                                    ? 'Cưỡng chế điều khiển, áp chế quy tắc và thiết chế tối thượng của Tawa'
                                    : 'Thiết chế cấu hình cưỡng chế tối ưu ngôn từ AI Tawa'}
                            </p>
                        )}
                        {isInline && <p className="text-xs text-stone-550 dark:text-slate-450 uppercase tracking-widest font-bold">Cưỡng chế tối ưu ngôn từ AI Tawa</p>}
                    </div>
                </div>

                <div className="flex justify-between items-center gap-2">
                    <div 
                        className={`flex bg-stone-400/30 dark:bg-slate-800/50 rounded-lg p-0.5 ${isInline ? 'w-full grid' : 'p-1'}`}
                        style={isInline ? { gridTemplateColumns: `repeat(${tabsToRender.length}, minmax(0, 1fr))` } : undefined}
                    >
                        {tabsToRender.includes('rules') && (
                            <button
                                onClick={() => setActiveContextTab('rules')}
                                className={`text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1 ${
                                    isInline ? 'py-1 text-xs' : 'px-4 py-1.5'
                                } ${
                                    activeContextTab === 'rules'
                                        ? 'bg-mystic-accent text-mystic-900 shadow-md font-black'
                                        : 'text-stone-655 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <ListChecks size={isInline ? 11 : 14} /> 
                                <span>Luật ({dynamicRules.length})</span>
                            </button>
                        )}
                        {tabsToRender.includes('config') && (
                            <button
                                onClick={() => setActiveContextTab('config')}
                                className={`text-xs font-bold uppercase tracking-wider rounded-md transition-all text-center ${
                                    isInline ? 'py-1 text-xs' : 'px-4 py-1.5'
                                } ${
                                    activeContextTab === 'config'
                                        ? 'bg-mystic-accent text-mystic-900 shadow-md font-black'
                                        : 'text-stone-655 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                                }`}
                            >
                                Ngữ Cảnh
                            </button>
                        )}
                        {tabsToRender.includes('debugger') && (
                            <button
                                onClick={() => setActiveContextTab('debugger')}
                                className={`text-xs font-bold uppercase tracking-wider rounded-md transition-all text-center flex items-center justify-center gap-1 ${
                                    isInline ? 'py-1 text-xs' : 'px-4 py-1.5'
                                } ${
                                    activeContextTab === 'debugger'
                                        ? 'bg-mystic-accent text-mystic-900 shadow-md font-black'
                                        : 'text-stone-655 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <Code size={isInline ? 11 : 14} />
                                <span>Debugger</span>
                            </button>
                        )}
                    </div>

                    {!isInline && (
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/20 text-stone-500 hover:text-red-500 rounded-full transition-all"
                        >
                            <X size={26} />
                        </button>
                    )}
                </div>
            </div>

            {/* Body Container */}
            <div className="flex-1 overflow-hidden flex flex-col bg-stone-100 dark:bg-mystic-950">

                {/* TAB 1: RULES MANAGER */}
                {activeContextTab === 'rules' && (
                    <div className={`flex-1 overflow-y-auto custom-scrollbar ${isInline ? 'p-3 space-y-4' : 'p-5 space-y-6'}`} style={{ background: styles.bg }}>
                        
                        {/* Modern Refined Banner - Mobile-first & Sleek */}
                        <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 max-w-7xl mx-auto w-full ${
                            isInline ? 'p-4' : 'p-5'
                        }`}
                        style={{
                            background: `linear-gradient(135deg, ${styles.bg}, ${styles.convexBg || '#dae0e9'})`,
                            borderColor: 'rgba(168, 85, 247, 0.25)',
                            color: styles.text
                        }}>
                            {/* Decorative Blur Background Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                                <div className="flex gap-3.5 items-start text-left">
                                    <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                                        <Sparkles size={18} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-sm md:text-base tracking-tight" style={{ color: styles.text }}>
                                            Kịch Bản Luật Lệ Tối Cao
                                            <span className="ml-2 inline-block font-mono text-[9px] font-black uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/25">
                                                Rules Engine
                                            </span>
                                        </h3>
                                        <p className="text-[11px] font-medium leading-relaxed mt-0.5" style={{ color: styles.textMuted }}>
                                            Ràng buộc trực hệ chỉ thị cưỡng chế vào nền tảng tư duy bối cảnh của LLM. Tawa bắt buộc phải tuyệt đối tôn trọng các chế tài vận hành được thiết chế tại đây.
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0 flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setImportExportText(JSON.stringify(dynamicRules, null, 2));
                                            setShowImportExport(true);
                                        }}
                                        className="flex items-center gap-1.5 text-xs font-black px-4 py-2.5 rounded-xl bg-purple-500 text-white hover:bg-purple-600 active:scale-95 transition-all shadow-md active:translate-y-[1px]"
                                    >
                                        <FileUp size={14} /> Nhập / Xuất Quy Chế
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Segmented sliding controller */}
                        <div className="block lg:hidden w-full p-1 bg-stone-250/50 dark:bg-slate-900/40 rounded-xl mb-4 border border-stone-300/20 dark:border-slate-800/30 max-w-7xl mx-auto w-full">
                            <div className="grid grid-cols-2 gap-1 text-center">
                                <button
                                    type="button"
                                    onClick={() => setMobileRuleSubTab('editor')}
                                    className={`py-2 text-[11px] font-black tracking-wide ease-in-out transition-all rounded-lg duration-200 ${
                                        mobileRuleSubTab === 'editor'
                                            ? 'bg-white dark:bg-stone-800 shadow-sm text-stone-900 dark:text-slate-100 font-extrabold'
                                            : 'text-stone-500 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    ✍️ Soạn Thảo Luật
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileRuleSubTab('presets')}
                                    className={`py-2 text-[11px] font-black tracking-wide ease-in-out transition-all rounded-lg duration-200 ${
                                        mobileRuleSubTab === 'presets'
                                            ? 'bg-white dark:bg-stone-800 shadow-sm text-stone-900 dark:text-slate-100 font-extrabold'
                                            : 'text-stone-500 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    📚 Thư Viện Mẫu ({PRESET_RULE_TEMPLATES.length})
                                </button>
                            </div>
                        </div>

                        {/* Split Panels: Form & Presets Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-7xl mx-auto w-full">
                            
                            {/* Panel 1: Creation Dashboard (7 Cols or full on active subtab) */}
                            <div 
                                className={`lg:col-span-7 border border-stone-200/80 dark:border-slate-800/80 rounded-2xl p-5 md:p-6 transition-all duration-300 flex flex-col justify-between ${
                                    mobileRuleSubTab === 'editor' ? 'block' : 'hidden lg:flex'
                                }`}
                                style={{
                                    background: styles.convexBg,
                                }}
                            >
                                <div className="space-y-5">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-200/40 dark:border-slate-800/40 pb-4">
                                        <h4 style={{ color: styles.accent }} className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <Settings size={14} /> Thiết Lập Luật Vận Hành
                                        </h4>
                                        <div style={{ background: styles.bg }} className="flex rounded-xl p-1 text-[10px] w-fit">
                                            <button 
                                                type="button"
                                                onClick={() => setComposerMode('advanced')}
                                                style={composerMode === 'advanced' ? { background: styles.accent, color: '#ffffff' } : { color: styles.textMuted }}
                                                className="px-3 py-1.5 font-bold rounded-lg transition-all"
                                            >
                                                Biên Soạn Chỉ Số
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setComposerMode('simple')}
                                                style={composerMode === 'simple' ? { background: styles.accent, color: '#ffffff' } : { color: styles.textMuted }}
                                                className="px-3 py-1.5 font-bold rounded-lg transition-all"
                                            >
                                                Soạn Nhanh
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setComposerMode('ai-assist')}
                                                style={composerMode === 'ai-assist' ? { background: 'linear-gradient(135deg, rgb(147, 51, 234), rgb(79, 70, 229))', color: '#ffffff' } : { color: styles.textMuted }}
                                                className="px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1"
                                            >
                                                <span>✨ AI Trợ Lý</span>
                                            </button>
                                        </div>
                                    </div>

                                    {composerMode === 'advanced' && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Meta Title */}
                                                <div className="space-y-1.5 text-left">
                                                    <label className="text-[10px] font-black uppercase tracking-wider pl-1" style={{ color: styles.textMuted }}>Tiêu Đề Luật Lệ (Key Tag)</label>
                                                    <input 
                                                        type="text" 
                                                        value={ruleTitle}
                                                        onChange={(e) => setRuleTitle(e.target.value)}
                                                        placeholder="Ví dụ: Chống nói nhảm, Chế tài HP..."
                                                        style={{
                                                            background: styles.bg,
                                                            border: styles.border,
                                                            color: styles.text
                                                        }}
                                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl outline-none placeholder:opacity-50 font-bold focus:border-stone-400 dark:focus:border-slate-700 transition-all shadow-inner"
                                                    />
                                                </div>

                                                {/* Meta Scope */}
                                                <div className="space-y-1.5 text-left">
                                                    <label className="text-[10px] font-black uppercase tracking-wider pl-1" style={{ color: styles.textMuted }}>Phạm vi ứng dụng</label>
                                                    <div className="grid grid-cols-3 gap-1 bg-stone-200/50 dark:bg-slate-900/40 p-1 rounded-xl border border-stone-200/30 dark:border-slate-800/30">
                                                        {(['global', 'chapter', 'scene'] as const).map(sc => (
                                                            <button
                                                                key={sc}
                                                                type="button"
                                                                onClick={() => setRuleScope(sc)}
                                                                className={`py-1.5 text-[9.5px] font-black rounded-lg transition-all uppercase ${
                                                                    ruleScope === sc
                                                                        ? 'bg-white dark:bg-slate-800 shadow-sm'
                                                                        : 'opacity-65 hover:opacity-100'
                                                                }`}
                                                                style={{ color: ruleScope === sc ? styles.accent : styles.textMuted }}
                                                            >
                                                                {sc === 'global' ? 'Thế Giới' : sc === 'chapter' ? 'Chương' : 'Cảnh'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Advanced Category Select Chips (No dropdowns!) */}
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-[10px] font-black uppercase tracking-wider pl-1 block" style={{ color: styles.textMuted }}>Danh Mục Phân Hành</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {CATEGORIES.map(cat => {
                                                        const isSelected = ruleCategory === cat;
                                                        return (
                                                            <button
                                                                key={cat}
                                                                type="button"
                                                                onClick={() => setRuleCategory(cat)}
                                                                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-xl border transition-all duration-200 ${
                                                                    isSelected
                                                                        ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.12)] scale-[1.02]'
                                                                        : 'bg-stone-50/50 dark:bg-slate-900/40 border-stone-200/80 dark:border-slate-800/80 text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-850'
                                                                }`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Advanced Priority Select Chips (No dropdowns!) */}
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-[10px] font-black uppercase tracking-wider pl-1 block" style={{ color: styles.textMuted }}>Độ Ưu Tiên Áp Dụng</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {PRIORITIES.map(pr => {
                                                        const isSelected = rulePriority === pr;
                                                        return (
                                                            <button
                                                                key={pr}
                                                                type="button"
                                                                onClick={() => setRulePriority(pr)}
                                                                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-xl border transition-all duration-200 ${
                                                                    isSelected
                                                                        ? 'bg-pink-500/10 border-pink-500 text-pink-600 dark:text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.12)] scale-[1.02]'
                                                                        : 'bg-stone-50/50 dark:bg-slate-900/40 border-stone-200/80 dark:border-slate-800/80 text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-850'
                                                                }`}
                                                            >
                                                                {pr}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Advanced Text Area with description */}
                                            <div className="space-y-1.5 text-left">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: styles.textMuted }}>Chỉ Thị Ràng Buộc Chi Tiết</label>
                                                    <span className="text-[9px] font-bold opacity-60" style={{ color: styles.text }}>
                                                        {ruleContent.length} ký tự
                                                    </span>
                                                </div>
                                                <textarea
                                                    value={ruleContent}
                                                    onChange={(e) => setRuleContent(e.target.value)}
                                                    placeholder="Ví dụ: Khi người chơi bị thương quá nặng, không bao giờ tự tả nhân vật hồi phục ngay lập tức mà phải trải qua cơn đau đớn kịch liệt..."
                                                    style={{
                                                        background: styles.bg,
                                                        border: styles.border,
                                                        color: styles.text
                                                    }}
                                                    className="w-full px-4 py-3 text-xs rounded-xl h-24 outline-none placeholder:opacity-50 resize-none font-bold focus:border-stone-400 dark:focus:border-slate-700 transition-all shadow-inner"
                                                />
                                            </div>

                                            {/* Activate Condition Trigger Builder */}
                                            <div className="bg-stone-50 dark:bg-slate-900/50 border border-stone-200/40 dark:border-slate-800 p-4 rounded-xl space-y-2 text-left animate-in slide-in-from-right duration-250">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-yellow-500">⚡</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: styles.text }}>Điều Kiện Kích Hoạt Tự Động</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <input 
                                                        type="text" 
                                                        value={ruleCondition}
                                                        onChange={(e) => setRuleCondition(e.target.value)}
                                                        placeholder="Cú pháp: turn > 10, hour >= 18"
                                                        style={{
                                                            background: styles.bg,
                                                            border: styles.border,
                                                            color: styles.text
                                                        }}
                                                        className="w-full px-3 py-2 text-xs rounded-lg outline-none placeholder:opacity-50 font-mono focus:border-stone-300 transition-all font-bold"
                                                    />
                                                    <div className="flex flex-wrap gap-1 items-center">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setRuleCondition('turn > 5')}
                                                            className="text-[9px] font-bold px-2 py-1 bg-stone-200/60 dark:bg-slate-800 text-stone-600 dark:text-slate-300 rounded border border-transparent hover:border-stone-350 dark:hover:border-slate-700 transition-all"
                                                        >
                                                            Lượt &gt; 5
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setRuleCondition('hour >= 18')}
                                                            className="text-[9px] font-bold px-2 py-1 bg-stone-200/60 dark:bg-slate-800 text-stone-600 dark:text-slate-300 rounded border border-transparent hover:border-stone-350 dark:hover:border-slate-700 transition-all"
                                                        >
                                                            Đêm (18h+)
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setRuleCondition('keyword: chiến đấu')}
                                                            className="text-[9px] font-bold px-2 py-1 bg-stone-200/60 dark:bg-slate-800 text-stone-600 dark:text-slate-300 rounded border border-transparent hover:border-stone-350 dark:hover:border-slate-700 transition-all"
                                                        >
                                                            Chiến đấu
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setRuleCondition('')}
                                                            className="text-[9px] font-black px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded hover:bg-red-500/15 transition-all"
                                                        >
                                                            Xóa
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {composerMode === 'simple' && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-[10px] font-black uppercase tracking-wider pl-1" style={{ color: styles.textMuted }}>Dòng Văn Bản Ràng Buộc Thô</label>
                                                <textarea
                                                    value={ruleContent}
                                                    onChange={(e) => setRuleContent(e.target.value)}
                                                    placeholder="Ví dụ: Tuyệt đối không cho phép hồi máu mà không nạp sinh mệnh đan..."
                                                    style={{
                                                        background: styles.bg,
                                                        border: styles.border,
                                                        color: styles.text
                                                    }}
                                                    className="w-full px-4 py-3.5 text-xs rounded-xl h-48 outline-none placeholder:opacity-50 resize-none font-bold focus:border-stone-400 dark:focus:border-slate-700 transition-all shadow-inner"
                                                />
                                                <p className="text-[10px]" style={{ color: styles.textMuted }}>
                                                    * Biên soạn thô sẽ mặc định xếp nhóm ⚙️ Cấu trúc và ĐỘ Ưu Tiên 🔴 TUYỆT ĐỐI.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {composerMode === 'ai-assist' && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="bg-stone-50 dark:bg-slate-900/30 border border-stone-200/60 dark:border-slate-800/60 rounded-xl p-4 space-y-3.5">
                                                <div className="flex gap-2.5 items-center">
                                                    <span className="p-1.5 px-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 animate-bounce">✨</span>
                                                    <div className="text-left">
                                                        <span className="text-xs font-black" style={{ color: styles.text }}>AI Thiết Kế Luật Lệ Tawa</span>
                                                        <p className="text-[10.5px]" style={{ color: styles.textMuted }}>Sinh mới từ ý tưởng, viết lại chuyên nghiệp, hoặc kiểm lỗi xung đột logic hệ thống</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 text-left">
                                                    <label className="text-[10px] font-black uppercase tracking-wider pl-1" style={{ color: styles.textMuted }}>Nhập Ý Tưởng Thô Hoặc Đề Bài</label>
                                                    <textarea
                                                        value={aiAssistConcept}
                                                        onChange={(e) => setAiAssistConcept(e.target.value)}
                                                        placeholder="Ví dụ: Tránh việc nhân vật chính quá bá đạo, bắt có hệ thống phạt thể lực khi tung kiếm kỹ liên tục..."
                                                        style={{
                                                            background: styles.bg,
                                                            border: styles.border,
                                                            color: styles.text
                                                        }}
                                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl h-24 outline-none placeholder:opacity-50 resize-none font-bold focus:border-purple-500 transition-all shadow-inner"
                                                    />
                                                </div>
                                                <div className="flex flex-wrap gap-2 pt-1 lg:justify-start justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCallAiAssist('draft')}
                                                        disabled={aiAssistLoading || !aiAssistConcept.trim()}
                                                        className={`flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-2 rounded-xl transition-all shadow-sm ${
                                                            aiAssistLoading
                                                                ? 'opacity-40 cursor-wait'
                                                                : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white active:scale-95'
                                                        }`}
                                                    >
                                                        {aiAssistLoading ? 'Đang phân tích...' : '✍️ Đắp Luật Chuẩn 100%'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCallAiAssist('rephrase')}
                                                        disabled={aiAssistLoading || !ruleContent.trim()}
                                                        className={`flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all ${
                                                            aiAssistLoading
                                                                ? 'opacity-40 cursor-wait'
                                                                : !ruleContent.trim()
                                                                    ? 'opacity-30 cursor-not-allowed bg-stone-105 border-stone-200 dark:bg-slate-900 dark:border-slate-800'
                                                                    : 'bg-white dark:bg-slate-900 border-stone-300 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 active:scale-95 text-stone-800 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        🪄 Viết Lại Sang Chảnh
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCallAiAssist('detect-conflict')}
                                                        disabled={aiAssistLoading || !ruleContent.trim()}
                                                        className={`flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all ${
                                                            aiAssistLoading
                                                                ? 'opacity-40 cursor-wait'
                                                                : !ruleContent.trim()
                                                                    ? 'opacity-30 cursor-not-allowed bg-stone-105 border-stone-200 dark:bg-slate-900 dark:border-slate-800'
                                                                    : 'bg-red-500/10 border-red-500/30 text-red-650 dark:text-red-450 hover:bg-red-500/20 active:scale-95'
                                                        }`}
                                                    >
                                                        ⚡ Kiểm Tra Mâu Thuẫn Logic
                                                    </button>
                                                </div>
                                            </div>

                                            {/* AI Output Result Visual Box */}
                                            {aiAssistOutput && (
                                                <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-left space-y-2.5 animate-in slide-in-from-bottom duration-300">
                                                    <div className="flex justify-between items-center-wrap gap-2">
                                                        <span className="text-[9.5px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1">
                                                            <Sparkles size={11} className="animate-spin" /> Bộ Ràng Buộc Sinh Bởi Trợ Lý
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRuleContent(aiAssistOutput);
                                                                toast.success("Đã ghi đè văn phong đề xuất vào biên dịch viên!");
                                                            }}
                                                            className="text-[9.5px] py-1 px-2 bg-purple-500 text-white font-extrabold rounded-lg hover:bg-purple-600 shadow-sm transition-all text-center"
                                                        >
                                                            📥 Đẩy Sang Soạn Thảo
                                                        </button>
                                                    </div>
                                                    <p className="text-xs leading-relaxed max-h-40 overflow-y-auto font-medium" style={{ color: styles.text }}>
                                                        {aiAssistOutput}
                                                    </p>
                                                </div>
                                            )}

                                            {aiAssistConflictDetails && (
                                                <div className={`p-4 rounded-xl text-left text-xs leading-relaxed border animate-in slide-in-from-bottom duration-300 ${
                                                    aiAssistConflictDetails.includes('✅')
                                                        ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-650 dark:text-emerald-400'
                                                        : 'bg-rose-500/5 border-rose-500/25 text-rose-650 dark:text-rose-400'
                                                }`}>
                                                    <span className="font-extrabold uppercase text-[10px] tracking-wider block mb-1">Kiểm Kê Quy Chế Xung Đột</span>
                                                    <div>{aiAssistConflictDetails}</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-5 border-t border-stone-200/40 dark:border-slate-800/40 mt-5">
                                    <button 
                                        type="button"
                                        onClick={handleAddRule}
                                        disabled={!ruleContent.trim()}
                                        className="w-full py-3 px-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:translate-y-[1px] disabled:opacity-40"
                                        style={{
                                            background: styles.accent,
                                            color: '#ffffff'
                                        }}
                                    >
                                        <Plus size={15} /> Thêm Quy Tắc Vào Hệ Thống
                                    </button>
                                </div>
                            </div>

                            {/* Panel 2: Presets Library (5 Cols) */}
                            <div 
                                className={`lg:col-span-5 border border-stone-200/80 dark:border-slate-800/80 rounded-2xl p-5 md:p-6 transition-all duration-300 flex flex-col justify-start scroll-smooth ${
                                    mobileRuleSubTab === 'presets' ? 'block' : 'hidden lg:flex'
                                }`}
                                style={{
                                    background: styles.convexBg,
                                }}
                            >
                                <div className="space-y-4">
                                    <h4 style={{ color: styles.text }} className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-left pl-1">
                                        <Zap size={14} className="text-amber-500 animate-bounce" /> Thư Viện Bản Mẫu Khuyên Dùng
                                    </h4>
                                    <p className="text-[11px] text-left leading-relaxed mt-1" style={{ color: styles.textMuted }}>
                                        Bộ luật đề cử giải quyết triệt để lỗi cơ cấu của AI. Bạn có thể nhấn nạp bản mẫu này vào khung soạn và chỉnh chi tiết theo bối cảnh truyện của mình.
                                    </p>

                                    {/* Scrollable Use Case Filter tags */}
                                    <div className="flex flex-wrap gap-1 border-b border-stone-200/40 dark:border-slate-800/40 pb-2">
                                        {PRESET_USE_CASES.map((uc) => {
                                            const isActive = selectedPresetUseCase === uc.id;
                                            return (
                                                <button
                                                    key={uc.id}
                                                    type="button"
                                                    onClick={() => setSelectedPresetUseCase(uc.id)}
                                                    className={`px-2 py-1 text-[9px] font-extrabold rounded-lg border transition-all ${
                                                        isActive
                                                            ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-450 font-black'
                                                            : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-800 text-stone-600 dark:text-slate-400 hover:bg-stone-50'
                                                    }`}
                                                >
                                                    {uc.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                        {PRESET_RULE_TEMPLATES
                                            .filter(preset => selectedPresetUseCase === 'ALL' || preset.useCase === selectedPresetUseCase)
                                            .map((preset, idx) => {
                                                const isLoadedInEditor = ruleContent === preset.content;
                                                return (
                                                    <div 
                                                        key={idx}
                                                        onClick={() => handleSelectPreset(preset)}
                                                        className={`p-3.5 rounded-xl text-left cursor-pointer transition-all duration-200 flex justify-between items-start gap-2 group border ${
                                                            isLoadedInEditor
                                                                ? 'shadow-[0_4px_12px_rgba(244,114,182,0.15)] bg-pink-500/5 dark:bg-pink-500/10'
                                                                : 'bg-stone-50/50 dark:bg-slate-900/20 border-stone-150 dark:border-slate-850 hover:bg-stone-100 dark:hover:bg-slate-800'
                                                        }`}
                                                        style={{
                                                            borderColor: isLoadedInEditor ? styles.accent : 'transparent',
                                                        }}
                                                    >
                                                        <div className="flex-1 space-y-1.5 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="text-[8px] font-black uppercase bg-stone-200 dark:bg-slate-805 text-stone-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono border border-stone-250 dark:border-slate-700/50">
                                                                    {preset.category}
                                                                </span>
                                                                {preset.popular && (
                                                                    <span className="text-[8px] font-black uppercase bg-red-500 text-white px-1 py-0.5 rounded shadow-sm scale-95 origin-left">
                                                                        ⭐ Hot
                                                                    </span>
                                                                )}
                                                                <span className="font-extrabold text-xs truncate max-w-[130px]" style={{ color: styles.text }}>
                                                                    {preset.title}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] line-clamp-2 leading-normal" style={{ color: styles.textMuted }}>
                                                                {preset.desc}
                                                            </p>
                                                        </div>
                                                        <span 
                                                            style={{ color: styles.accent }}
                                                            className="text-[9px] font-black tracking-wider shrink-0 uppercase opacity-75 group-hover:opacity-100 transition-opacity pl-1 pt-0.5"
                                                        >
                                                            + Thêm
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Database Filters & Active Rules Queue */}
                        <div className="max-w-7xl mx-auto w-full pt-4 space-y-4">
                            
                            {/* Glassmorphic Filter Sub-header */}
                            <div className="bg-stone-50/40 dark:bg-slate-900/20 border border-stone-200/50 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center text-left">
                                <div className="w-full md:w-auto">
                                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: styles.text }}>
                                        Danh Trực Hệ Ràng Buộc Đang Chạy ({filteredRules.length} / {dynamicRules.length})
                                    </h4>
                                    <p className="text-[10px]" style={{ color: styles.textMuted }}>
                                        Kéo thả tự do để phân cấp độ ưu tiên, gạt công tắc để bật tắt an toàn hoặc chỉnh sửa nội dung trực hệ.
                                    </p>
                                </div>

                                {/* Controls Row */}
                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                                    
                                    {/* Query Search */}
                                    <div className="relative flex-1 md:flex-initial">
                                        <Search size={13} className="absolute left-3.5 top-3" style={{ color: styles.textMuted }} />
                                        <input 
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Tìm luật..."
                                            style={{
                                                background: styles.bg,
                                                border: styles.border,
                                                color: styles.text
                                            }}
                                            className="w-full md:w-36 rounded-xl pl-8.5 pr-3 py-2 text-xs placeholder:opacity-50 focus:outline-none focus:border-stone-450 dark:focus:border-slate-705 transition-all font-bold shadow-inner"
                                        />
                                    </div>

                                    {/* Category Select Dropdown */}
                                    <select 
                                        value={selectedFilterCategory}
                                        onChange={(e) => setSelectedFilterCategory(e.target.value)}
                                        style={{
                                            background: styles.bg,
                                            border: styles.border,
                                            color: styles.text,
                                        }}
                                        className="rounded-xl px-2.5 py-2 text-xs font-black outline-none shadow-inner"
                                    >
                                        <option value="ALL">Mọi Nhóm</option>
                                        {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-stone-200 dark:bg-slate-900">{cat}</option>)}
                                    </select>

                                    {/* Status Select Dropdown */}
                                    <select 
                                        value={selectedFilterStatus}
                                        onChange={(e) => setSelectedFilterStatus(e.target.value as any)}
                                        style={{
                                            background: styles.bg,
                                            border: styles.border,
                                            color: styles.text,
                                        }}
                                        className="rounded-xl px-2.5 py-2 text-xs font-black outline-none shadow-inner"
                                    >
                                        <option value="ALL">Mọi trạng thái</option>
                                        <option value="ACTIVE">Kích hoạt</option>
                                        <option value="DISABLED">Đang tắt</option>
                                    </select>

                                    {dynamicRules.length > 0 && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (setDynamicRules) setDynamicRules([]);
                                                toast.success("Đã dọn dẹp sạch toàn bộ các luật vận hành!");
                                            }}
                                            className="text-red-500 font-extrabold flex items-center gap-1.5 px-3 py-2 text-xs border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 active:scale-95 rounded-xl transition-all"
                                        >
                                            <Trash2 size={12} /> Xóa Hết
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Rules Card Render - Dynamic Flex List */}
                            {filteredRules.length === 0 ? (
                                <div 
                                    className="p-10 text-center space-y-3.5 max-w-7xl mx-auto w-full border border-stone-200/50 dark:border-slate-800/80 rounded-2xl"
                                    style={{ background: styles.convexBg }}
                                >
                                    <AlertTriangle size={32} style={{ color: styles.accent }} className="mx-auto" />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider" style={{ color: styles.text }}>
                                            Không tìm thấy điều quy nào khả dụng
                                        </p>
                                        <p className="text-[11px] max-w-xs mx-auto leading-relaxed mt-1" style={{ color: styles.textMuted }}>
                                            Hãy thử khởi sinh bối cảnh mẫu ở trình ghi đè presets phía bên trên hoặc tự soạn thảo luật lệ mới của bạn.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3.5 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
                                    {filteredRules.map((parsedRule) => {
                                        const isEditing = editingIndex === parsedRule.index;
                                        const isSomeoneElseEditing = editingIndex !== null && !isEditing;
                                        const catStyle = CATEGORY_STYLES[parsedRule.category] || CATEGORY_STYLES['⚙️ Khác'];
                                        const prioStyle = PRIORITY_STYLES[parsedRule.priority] || PRIORITY_STYLES['🟡 LINH HOẠT'];
                                        
                                        // Real-time condition evaluation
                                        const hasCond = parsedRule.condition && parsedRule.condition.trim() !== '';
                                        const condEval = hasCond ? evaluateRuleConditionClient(parsedRule.condition) : { active: true, label: 'Luôn áp dụng' };

                                        return (
                                            <div 
                                                key={parsedRule.index}
                                                style={{
                                                    background: isEditing 
                                                        ? styles.bg 
                                                        : parsedRule.isDisabled 
                                                            ? 'rgba(128,128,128,0.05)' 
                                                            : styles.convexBg,
                                                    borderColor: isEditing 
                                                        ? styles.accent 
                                                        : parsedRule.isDisabled 
                                                            ? 'transparent' 
                                                            : 'rgba(255, 255, 255, 0.05)',
                                                    opacity: parsedRule.isDisabled ? 0.75 : 1,
                                                }}
                                                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row gap-4 relative md:items-start group text-left shadow-sm ${
                                                    isEditing ? 'shadow-md scale-[1.005]' : 'hover:shadow-md'
                                                } ${isSomeoneElseEditing ? 'opacity-30 pointer-events-none' : ''}`}
                                            >
                                                {/* Left Side: Priority indicators & Up/Down arrows */}
                                                <div className="flex md:flex-col items-center justify-between shrink-0 md:border-r border-stone-200/40 dark:border-slate-800/40 pr-0 md:pr-4 gap-3 select-none">
                                                    <span 
                                                        style={{
                                                            background: styles.bg,
                                                            color: styles.accent,
                                                            borderColor: 'rgba(255,255,255,0.05)'
                                                        }}
                                                        className="text-xs font-black font-mono px-3 py-1 border rounded-lg shadow-inner"
                                                    >
                                                        #{parsedRule.index + 1}
                                                    </span>
                                                    <div className="flex flex-row md:flex-col gap-1">
                                                        <button 
                                                            type="button"
                                                            disabled={parsedRule.index === 0}
                                                            onClick={() => handleMoveRule(parsedRule.index, 'up')}
                                                            className="p-1 px-1.5 rounded-lg bg-stone-200/50 dark:bg-slate-800 hover:bg-stone-300 disabled:opacity-20 transition-all text-stone-500"
                                                            title="Đẩy ưu tiên lên đầu"
                                                        >
                                                            <ArrowUp size={11} />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            disabled={parsedRule.index === dynamicRules.length - 1}
                                                            onClick={() => handleMoveRule(parsedRule.index, 'down')}
                                                            className="p-1 px-1.5 rounded-lg bg-stone-200/50 dark:bg-slate-800 hover:bg-stone-300 disabled:opacity-20 transition-all text-stone-500"
                                                            title="Hạ ưu tiên xuống dưới"
                                                        >
                                                            <ArrowDown size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* Card Editing Banner */}
                                                {isEditing && (
                                                    <div 
                                                        style={{ background: styles.accent }}
                                                        className="absolute top-3 right-4 flex items-center gap-1 font-black text-[8px] md:text-[9px] text-white uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse shadow-sm z-10"
                                                    >
                                                        ⚠️ ĐANG SỬA ĐỔI (CHƯA LƯU)
                                                    </div>
                                                )}

                                                {/* Main Content Side */}
                                                <div className="flex-1 min-w-0">
                                                    {isEditing ? (
                                                        <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                                                                {/* Edit Title */}
                                                                <div className="md:col-span-4">
                                                                    <input 
                                                                        type="text"
                                                                        value={editingTitle}
                                                                        onChange={(e) => setEditingTitle(e.target.value)}
                                                                        placeholder="Tiêu đề..."
                                                                        style={{
                                                                            background: styles.bg,
                                                                            border: styles.border,
                                                                            color: styles.text
                                                                        }}
                                                                        className="w-full px-3 py-2 text-xs rounded-xl outline-none font-bold"
                                                                    />
                                                                </div>

                                                                {/* Edit Category select */}
                                                                <div className="md:col-span-3">
                                                                    <select 
                                                                        value={editingCategory}
                                                                        onChange={(e) => setEditingCategory(e.target.value)}
                                                                        style={{
                                                                            background: styles.bg,
                                                                            border: styles.border,
                                                                            color: styles.text,
                                                                        }}
                                                                        className="w-full px-2 py-2 text-xs font-black outline-none rounded-xl"
                                                                    >
                                                                        {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-stone-200 dark:bg-slate-900">{cat}</option>)}
                                                                    </select>
                                                                </div>

                                                                {/* Edit Priority select */}
                                                                <div className="md:col-span-2">
                                                                    <select 
                                                                        value={editingPriority}
                                                                        onChange={(e) => setEditingPriority(e.target.value)}
                                                                        style={{
                                                                            background: styles.bg,
                                                                            border: styles.border,
                                                                            color: styles.text,
                                                                        }}
                                                                        className="w-full px-2 py-2 text-xs font-black outline-none rounded-xl"
                                                                    >
                                                                        {PRIORITIES.map(pr => <option key={pr} value={pr} className="bg-stone-200 dark:bg-slate-900">{pr}</option>)}
                                                                    </select>
                                                                </div>

                                                                {/* Edit Trigger Condition */}
                                                                <div className="md:col-span-3">
                                                                    <input 
                                                                        type="text"
                                                                        value={editingCondition}
                                                                        onChange={(e) => setEditingCondition(e.target.value)}
                                                                        placeholder="ĐK kích hoạt (turn > 5)"
                                                                        style={{
                                                                            background: styles.bg,
                                                                            border: styles.border,
                                                                            color: styles.text
                                                                        }}
                                                                        className="w-full px-3 py-2 text-xs rounded-xl font-mono outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <textarea
                                                                value={editingContent}
                                                                onChange={(e) => setEditingContent(e.target.value)}
                                                                placeholder="Mô tả chỉ kịch..."
                                                                style={{
                                                                    background: styles.bg,
                                                                    border: styles.border,
                                                                    color: styles.text
                                                                }}
                                                                className="w-full px-4 py-3 text-xs rounded-xl h-20 outline-none resize-none font-bold"
                                                            />
                                                            <div className="flex justify-between items-center text-[10px] pt-1">
                                                                <div className="opacity-70 leading-normal" style={{ color: styles.text }}>
                                                                    * Lưu ý: Mọi chỉnh đổi sẽ đồng bộ trực hệ tới lõi Tawa ngay.
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setEditingIndex(null)}
                                                                        className="px-3.5 py-1.5 text-[10px] font-black tracking-wide bg-stone-300 dark:bg-slate-805 text-stone-750 dark:text-slate-300 rounded-lg hover:shadow-inner"
                                                                    >
                                                                        Hủy
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleSaveInlineEdit(parsedRule.index);
                                                                            toast.success("Đã hiệu đính thành công kịch bản luật!");
                                                                        }}
                                                                        className="px-3.5 py-1.5 text-[10px] font-black tracking-wide bg-emerald-500 text-white rounded-lg flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                                                                    >
                                                                        <Save size={11} /> Lưu Lại
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2.5">
                                                            {/* Display Meta Tags & Badges */}
                                                            <div className="flex flex-wrap gap-2 items-center">
                                                                <span 
                                                                    className={`text-[9px] tracking-wider font-extrabold px-2.5 py-1 rounded-lg border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                                                                >
                                                                    {parsedRule.category}
                                                                </span>
                                                                <span 
                                                                    className={`text-[9px] tracking-wider font-extrabold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 ${prioStyle.badge}`}
                                                                >
                                                                    <span className={`w-1 h-1 rounded-full ${prioStyle.dot}`} />
                                                                    {parsedRule.priority}
                                                                </span>
                                                                
                                                                {/* Real-time trigger evaluation states */}
                                                                {hasCond ? (
                                                                    condEval.active ? (
                                                                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/10 font-mono flex items-center gap-1 animate-pulse">
                                                                            ⚡ KÍCH HOẠT ({condEval.label})
                                                                        </span>
                                                                    ) : (
                                                                       <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-stone-150 dark:bg-slate-805 text-stone-500 border border-transparent font-mono">
                                                                            ⏳ CHỜ ĐIỀU KIỆN
                                                                       </span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-lg bg-indigo-500/5 text-purple-600 dark:text-purple-400 font-mono">
                                                                        🔥 LUÔN THI HÀNH
                                                                    </span>
                                                                )}

                                                                {parsedRule.scope && parsedRule.scope !== 'global' && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/5 text-blue-500 border border-blue-500/10 uppercase">
                                                                        📍 {parsedRule.scope === 'chapter' ? 'Chương' : 'Cảnh'}
                                                                    </span>
                                                                )}

                                                                <h5 className="font-extrabold text-xs ml-1.5" style={{ color: styles.text }}>
                                                                    {parsedRule.title}
                                                                </h5>

                                                                {parsedRule.isDisabled && (
                                                                    <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10">
                                                                        ⚠️ Đang vô hiệu hóa
                                                                    </span>
                                                                )}
                                                            </div>
                      
                                                            {/* Content representation */}
                                                            <p className="text-[11.5px] leading-relaxed font-semibold whitespace-pre-wrap pl-1 tracking-wide" style={{ color: styles.textMuted }}>
                                                                {parsedRule.content}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                      
                                                {/* Right Side Controls sidebar */}
                                                {!isEditing && (
                                                    <div className="flex md:flex-col items-center gap-3 md:border-l border-stone-200/40 dark:border-slate-800/40 pl-0 md:pl-4 justify-between md:justify-center shrink-0">
                                                        {/* Toggle active switch button */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                handleToggleRuleActive(parsedRule.index);
                                                                toast.success(parsedRule.isDisabled ? "Đã ghim điều quy hành trở lại!" : "Tam thời ngưng áp quy này!");
                                                            }}
                                                            style={{
                                                                background: !parsedRule.isDisabled ? styles.accent : 'rgba(128,128,128,0.2)',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none border-none cursor-pointer"
                                                            title={parsedRule.isDisabled ? "Kích hoạt điều kiện bảo vật" : "Tạm ngưng quy chế"}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all shadow-sm ${!parsedRule.isDisabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                                        </button>
                      
                                                        {/* Quick Pen Edit inside list */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleStartEditing(parsedRule)}
                                                            className="p-2 rounded-xl bg-stone-200/60 hover:bg-stone-250 dark:bg-slate-800 text-stone-600 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all border-none cursor-pointer"
                                                            title="Sửa nhanh inline"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                      
                                                        {/* Core removal action button */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                handleRemoveRule(parsedRule.index);
                                                                toast.success("Đã xóa vĩnh quy chế này!");
                                                            }}
                                                            className="p-2 rounded-xl bg-red-500/10 text-red-550 dark:text-red-400 hover:bg-red-500/15 hover:scale-105 active:scale-95 transition-all border-none cursor-pointer"
                                                            title="Xóa vĩnh viễn"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                            {/* TAB 2: IN-DEPTH CONTEXT COMPONENT (RAG TOGGLES) */}
                            {activeContextTab === 'config' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Left Column: Toggles */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black text-mystic-accent uppercase tracking-[0.2em] border-b border-mystic-accent/30 pb-2 text-left">Thành phần Ngữ cảnh</h3>
                                        
                                        <div className="space-y-3">
                                            {[
                                                { key: 'playerProfile', label: 'Hồ sơ nhân vật', desc: 'Thông tin chi tiết về nhân vật của bạn' },
                                                { key: 'worldInfo', label: 'Thông tin thế giới', desc: 'Bối cảnh, thể loại và cốt truyện chung' },
                                                { key: 'longTermMemory', label: 'Trí nhớ dài hạn (Summary)', desc: 'Bản tóm tắt các sự kiện đã qua' },
                                                { key: 'relevantMemories', label: 'Ký ức liên quan (RAG)', desc: 'Các đoạn hội thoại cũ được tìm thấy qua Vector Search' },
                                                { key: 'storyBible', label: 'Encyclopedia Encyclopedia', desc: 'Dữ kiện sự thật được hệ thống tự trích xuất linh hoạt' },
                                                { key: 'graphRag', label: 'Bối cảnh đồ thị (GraphRAG)', desc: 'Chèn tri thức chất lượng cao từ sơ đồ thực thể & quan hệ thế giới' },
                                                { key: 'entities', label: 'Thực thể (NPCs/Items)', desc: 'Thông tin về các nhân vật và vật phẩm trong thế giới' },
                                                { key: 'npcRegistry', label: 'Danh sách tổng NPC (Registry)', desc: 'Danh sách rút gọn tất cả NPC để AI tham chiếu ID' },
                                                { key: 'timeSystem', label: 'Hệ thống thời gian', desc: 'Ngày, tháng, năm và lượt chơi hiện tại' },
                                                { key: 'reinforcement', label: 'Chỉ thị củng cố (Reinforcement)', desc: 'Các lệnh ép AI duy trì chất lượng văn phong' },
                                            ].map((item) => (
                                                <div key={item.key} className="flex items-center justify-between p-4 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 hover:border-mystic-accent/50 transition-all group text-left">
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">{item.label}</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">{item.desc}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleContextItem(item.key as keyof ContextWindowConfig['items'])}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.items[item.key as keyof typeof config.items] ? 'bg-mystic-accent' : 'bg-stone-400 dark:bg-slate-700'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.items[item.key as keyof typeof config.items] ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Column: Numeric Limits */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black text-mystic-accent uppercase tracking-[0.2em] border-b border-mystic-accent/30 pb-2 text-left">Giới hạn Số lượng</h3>
                                        
                                        <div className="space-y-6">
                                            {/* Max Entities */}
                                            <div className="p-5 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 text-left">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">Số lượng Thực thể tối đa (NPCs)</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">Giới hạn số lượng NPC/Vật phẩm gửi cho AI mỗi lượt</p>
                                                    </div>
                                                    <div className="text-2xl font-black text-mystic-accent">{config.maxEntities}</div>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="1" 
                                                    max="50" 
                                                    value={config.maxEntities} 
                                                    onChange={(e) => updateContextMaxEntities(parseInt(e.target.value))}
                                                    className="w-full h-2 bg-stone-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-mystic-accent"
                                                />
                                                <div className="flex justify-between text-xs text-stone-500 mt-2 font-bold select-none">
                                                    <span>1 NPC</span>
                                                    <span>50 NPCs</span>
                                                </div>
                                            </div>

                                            {/* Recent History Count */}
                                            <div className="p-5 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 text-left">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">Lịch sử gần đây (Recent History)</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">Số lượng tin nhắn gần nhất AI sẽ đọc trực tiếp</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            max="500" 
                                                            value={config.recentHistoryCount} 
                                                            onChange={(e) => updateContextHistoryCount(parseInt(e.target.value) || 1)}
                                                            className="w-16 bg-stone-305 dark:bg-slate-850 border border-stone-400 dark:border-slate-700 rounded px-2 py-1 text-center font-black text-mystic-accent outline-none focus:border-mystic-accent"
                                                        />
                                                        <span className="text-xs font-bold text-stone-550 dark:text-slate-400">câu</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs italic text-amber-600 dark:text-amber-500/70 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                                                    * Số lượng càng cao AI càng nhớ tốt mạch diễn biến tức thời vừa xảy ra, tuy nhiên sẽ tăng độ trễ tiêu tốn Token bối cảnh.
                                                </p>
                                            </div>

                                            {/* Max Context Tokens */}
                                            <div className="p-5 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 text-left">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">Giới hạn Tokens ngữ cảnh (Max Context)</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">Tổng số lượng Token tối đa cho toàn bộ bối cảnh gửi đi</p>
                                                    </div>
                                                    <div className="text-[18px] font-black text-mystic-accent">{(config.maxContextTokens || 60000).toLocaleString()}</div>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min={4000} 
                                                    max={128000} 
                                                    step={2000}
                                                    value={config.maxContextTokens || 60000} 
                                                    onChange={(e) => updateContextMaxTokens(parseInt(e.target.value))}
                                                    className="w-full h-2 bg-stone-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-mystic-accent"
                                                />
                                                <div className="flex justify-between text-xs text-stone-550 mt-2 font-bold select-none">
                                                    <span>4k Tokens</span>
                                                    <span>128k Tokens (Thượng tầng Gemini)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: TRÌNH DEBUGGER ĐIỀU TRA SÁT HẠCH */}
                            {activeContextTab === 'debugger' && (
                                <div className="flex-1 h-full p-2 overflow-hidden flex flex-col">
                                    <ContextDebuggerView 
                                        worldData={activeWorld}
                                        settings={settings}
                                        history={history}
                                        turnCount={turnCount}
                                        presetConfig={tawaPresetConfig}
                                        gameTime={gameTime}
                                        lastUserMessage={lastAction}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer area */}
                        {!isInline && (
                            <div className="p-4 border-t border-stone-440 dark:border-slate-800/80 bg-stone-300 dark:bg-mystic-900/80 flex justify-center gap-3 shrink-0 select-none">
                                <Button 
                                    onClick={onClose}
                                    className="px-14 py-2.5 bg-mystic-accent text-mystic-900 font-extrabold uppercase tracking-wider hover:bg-sky-400 shadow-md transition-all rounded-lg"
                                >
                                    Lưu & Áp Dụng Hệ Thống
                                </Button>
                            </div>
                        )}
        </div>
    );

    if (isInline) {
        return (
            <div className="w-full h-full relative select-none flex flex-col overflow-hidden">
                {content}
                
                {/* NESTED IMPORT/EXPORT DRAWER MODAL (IFRAME SAFE) */}
                {showImportExport && (
                    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
                        <div className="bg-stone-250 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 w-full max-w-xl rounded-xl shadow-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-stone-300 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-mystic-accent">
                                    <FileDown size={18} />
                                    <h3 className="font-bold text-sm text-stone-855 dark:text-slate-100">Giao dịch dữ liệu Luật lệ (Import / Export JSON)</h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setShowImportExport(false);
                                        setImportError('');
                                        setImportSuccess('');
                                    }}
                                    className="p-1 hover:bg-stone-300 dark:hover:bg-slate-800 rounded"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <p className="text-[11px] text-stone-550 dark:text-slate-400 text-left leading-relaxed">
                                Mã hóa luật gửi theo cấu trúc array của tệp tin. Bạn có thể chép mã này đi phân phối sang thế giới khác hoặc dán mã quy chế của người khác vào đây để tích hợp nhanh chóng.
                            </p>

                            <div className="space-y-1 text-left">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Khối mã JSON</label>
                                <textarea 
                                    value={importExportText}
                                    onChange={(e) => setImportExportText(e.target.value)}
                                    placeholder="Dán mảng JSON chứa các mẫu luật tại đây..."
                                    className="w-full h-44 bg-stone-50 dark:bg-slate-950 border border-stone-350 dark:border-slate-800 rounded-lg p-3 text-xs font-mono text-stone-850 dark:text-slate-300 focus:outline-none focus:border-mystic-accent resize-none h-48"
                                />
                            </div>

                            {/* Import/Export Status Feedback Banners */}
                            {importError && (
                                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                    <AlertTriangle size={14} /> {importError}
                                </div>
                            )}
                            {importSuccess && (
                                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                    <CheckCircle2 size={14} /> {importSuccess}
                                </div>
                            )}

                            <div className="flex gap-2 justify-end text-xs">
                                <button 
                                    onClick={handleExportJson}
                                    className="px-4 py-2 bg-stone-300 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-bold transition-all flex items-center gap-1.5"
                                >
                                    {isCopied ? <Check size={14} /> : <Clipboard size={14} />}
                                    {isCopied ? "Đã sao chép!" : "Sao chép mã xuất"}
                                </button>
                                <button 
                                    onClick={handleImportJson}
                                    className="px-5 py-2 bg-sky-500 text-white hover:bg-sky-400 rounded font-black transition-all flex items-center gap-1.5"
                                >
                                    <FileDown size={14} /> Đọc & Nhập luật
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4 pointer-events-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.23, ease: 'easeOut' }}
                        className="relative bg-stone-200 dark:bg-mystic-950 border border-stone-400 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-presence w-[98vw] max-w-[1400px] h-[95vh] md:h-[99vh]"
                    >
                        {content}
                    </motion.div>
                </div>
            )}

            {/* NESTED IMPORT/EXPORT DRAWER MODAL (IFRAME SAFE) */}
            {showImportExport && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
                    <div 
                        className="bg-stone-250 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 rounded-xl shadow-2xl p-5 space-y-4 w-[92vw] max-w-lg max-h-[85vh] overflow-y-auto"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-stone-300 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-mystic-accent">
                                <FileDown size={18} />
                                <h3 className="font-bold text-sm text-stone-855 dark:text-slate-100">Giao dịch dữ liệu Luật lệ (Import / Export JSON)</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowImportExport(false);
                                    setImportError('');
                                    setImportSuccess('');
                                }}
                                className="p-1 hover:bg-stone-300 dark:hover:bg-slate-800 rounded"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-[11px] text-stone-550 dark:text-slate-400 text-left leading-relaxed">
                            Mã hóa luật gửi theo cấu trúc array của tệp tin. Bạn có thể chép mã này đi phân phối sang thế giới khác hoặc dán mã quy chế của người khác vào đây để tích hợp nhanh chóng.
                        </p>

                        <div className="space-y-1 text-left">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Khối mã JSON</label>
                            <textarea 
                                value={importExportText}
                                onChange={(e) => setImportExportText(e.target.value)}
                                placeholder="Dán mảng JSON chứa các mẫu luật tại đây..."
                                className="w-full h-44 bg-stone-50 dark:bg-slate-950 border border-stone-350 dark:border-slate-800 rounded-lg p-3 text-xs font-mono text-stone-850 dark:text-slate-300 focus:outline-none focus:border-mystic-accent resize-none h-48"
                            />
                        </div>

                        {/* Import/Export Status Feedback Banners */}
                        {importError && (
                            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                <AlertTriangle size={14} /> {importError}
                            </div>
                        )}
                        {importSuccess && (
                            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                <CheckCircle2 size={14} /> {importSuccess}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end text-xs">
                            <button 
                                onClick={handleExportJson}
                                className="px-4 py-2 bg-stone-300 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-bold transition-all flex items-center gap-1.5"
                            >
                                {isCopied ? <Check size={14} /> : <Clipboard size={14} />}
                                {isCopied ? "Đã sao chép!" : "Sao chép mã xuất"}
                            </button>
                            <button 
                                onClick={handleImportJson}
                                className="px-5 py-2 bg-sky-500 text-white hover:bg-sky-400 rounded font-black transition-all flex items-center gap-1.5"
                            >
                                <FileDown size={14} /> Đọc & Nhập luật
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ContextWindowModal;
