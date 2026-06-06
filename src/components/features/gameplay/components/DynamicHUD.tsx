import React, { useMemo, useState } from 'react';
import { WorldData, GameTime } from '../../../../types';
import { 
    MapPin, Heart, User, Sun, Moon, Backpack, Shirt, 
    ChevronDown, ChevronUp, Wind, Target, Users, BookOpen, 
    Shield, Coins, Swords, Zap, Activity, Clock, Sparkles, Flame, Compass, Scroll, FileText, Settings, Plus, Trash2
} from 'lucide-react';
import { formatGameTime } from '../../../../utils/timeUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../../../../services/db/indexedDB';

interface DynamicHUDProps {
    worldData?: WorldData | null;
    gameTime?: GameTime;
    turnCount: number;
}

interface CustomWidget {
    id: string;
    label: string;
    tableId: string; // e.g. "2"
    rowIdx: number;  // index of row
    colIdx: number;  // index of column
    iconEmoji: string; // emoji icon
}

export const DynamicHUD: React.FC<DynamicHUDProps> = ({ worldData, gameTime, turnCount }) => {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'status' | 'inventory' | 'quests' | 'relations' | 'chronicles' | 'config'>('status');
    const [selectedItem, setSelectedItem] = useState<{name: string, quantity?: string, desc: string} | null>(null);
    const [searchItemText, setSearchItemText] = useState('');
    const [activeLsrBrowserTable, setActiveLsrBrowserTable] = useState<string>('2');

    // --- State For Custom/Toggled Widgets (With Unified IndexedDB Key-Value Persistence) ---
    const [visibleWidgets, setVisibleWidgets] = useState<string[]>(() => {
        try {
            const saved = dbService.getKeyValueSync('ark_hud_visible_widgets');
            return saved ? saved : ['env', 'stats', 'quest', 'economy', 'effects'];
        } catch {
            return ['env', 'stats', 'quest', 'economy', 'effects'];
        }
    });

    const [customWidgets, setCustomWidgets] = useState<CustomWidget[]>(() => {
        try {
            const saved = dbService.getKeyValueSync('ark_hud_custom_widgets');
            return saved ? saved : [];
        } catch {
            return [];
        }
    });

    // Custom HUD theme overrides
    const [hudThemeSkin, setHudThemeSkin] = useState<'default' | 'mystic' | 'rose' | 'emerald'>(() => {
        return (dbService.getKeyValueSync('ark_hud_skin_theme')) || 'default';
    });

    // Custom Widget form variables
    const [newWidgetLabel, setNewWidgetLabel] = useState('');
    const [newWidgetTable, setNewWidgetTable] = useState('2');
    const [newWidgetRow, setNewWidgetRow] = useState(0);
    const [newWidgetCol, setNewWidgetCol] = useState(1);
    const [newWidgetEmoji, setNewWidgetEmoji] = useState('🔮');

    const lsr = worldData?.lsrData || {};

    // Helper to get element values safely (supports objects with numeric keys from LsrParser and fallback arrays)
    const getRowValue = (row: any, idx: number | string, fallback: string = ''): string => {
        if (!row) return fallback;
        const val = row[idx] !== undefined ? row[idx] : row[String(idx)];
        return val !== undefined ? String(val).trim() : fallback;
    };

    // Helper to estimate progress percentages from formatted/descriptive text
    const getProgressRatio = (valStr: string): number => {
        if (!valStr) return -1;
        const cleanVal = valStr.trim().toLowerCase();

        // 1. Check numeric fraction percentages e.g. "80/100" or "75%"
        const pctMatch = valStr.match(/(\d+)%/);
        if (pctMatch) return parseInt(pctMatch[1]);

        const fracMatch = valStr.match(/(\d+)\s*[/|]\s*(\d+)/);
        if (fracMatch) {
            const cur = parseInt(fracMatch[1]);
            const max = parseInt(fracMatch[2]);
            return max > 0 ? Math.min((cur / max) * 100, 100) : 0;
        }

        const numMatch = valStr.match(/^(\d+)$/);
        if (numMatch) {
            const v = parseInt(numMatch[1]);
            return v <= 100 ? v : 100;
        }

        // 2. High-accuracy description mappings (Vietnamese roleplay terms fallback)
        if (cleanVal.includes('sung mãn') || cleanVal.includes('tối đa') || cleanVal.includes('hoàn hảo') || cleanVal.includes('vô địch') || cleanVal.includes('tốt') || cleanVal.includes('cực khỏe') || cleanVal.includes('khỏe mạnh')) {
            return 100;
        }
        if (cleanVal.includes('bình thường') || cleanVal.includes('ổn định') || cleanVal.includes('khá') || cleanVal.includes('đang hồi phục') || cleanVal.includes('hồi phục')) {
            return 80;
        }
        if (cleanVal.includes('mệt mỏi') || cleanVal.includes('suy yếu nhẹ') || cleanVal.includes('chấn thương nhẹ') || cleanVal.includes('suy sụp nhẹ') || cleanVal.includes('trầy xước')) {
            return 60;
        }
        if (cleanVal.includes('suy yếu') || cleanVal.includes('thấp') || cleanVal.includes('kiệt sức') || cleanVal.includes('thương tổn nặng') || cleanVal.includes('bị thương')) {
            return 40;
        }
        if (cleanVal.includes('nguy kịch') || cleanVal.includes('hấp hối') || cleanVal.includes('nguyên thần tổn hao') || cleanVal.includes('sắp chết') || cleanVal.includes('hôn mê')) {
            return 15;
        }
        return -1;
    };
    
    // --- Parse LSR Tables ---
    // #0 Thông tin Hiện tại: ["Thời gian", "Địa điểm", "Sự kiện", "Mục tiêu"]
    const t0 = (lsr['0'] || []) as any[];
    const currentInfo = t0[0] || null;
    const locationString = getRowValue(currentInfo, 1, 'Chưa xác định');
    const currentEvent = getRowValue(currentInfo, 2, '');
    const currentObjective = getRowValue(currentInfo, 3, '');

    // #1 Nhân vật Gần đây: ["Tên Nhân vật", "Thái độ/Trạng thái", "Hành động"]
    const recentNpcs = (lsr['1'] || []).map(row => ({
        name: getRowValue(row, 0),
        status: getRowValue(row, 1),
        action: getRowValue(row, 2)
    })).filter(n => n.name);

    // #2 Trạng thái Bản thân: ["Chỉ số/Tên", "Giá trị", "Mô tả"]
    const playerStats = (lsr['2'] || []).map(row => ({
        name: getRowValue(row, 0),
        value: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(s => s.name);
    
    // Find primary health and mana stats to draw beautiful gauge bars in the core panel
    const healthStat = playerStats.find(s => 
        s.name.toLowerCase().includes('máu') || 
        s.name.toLowerCase().includes('hp') || 
        s.name.toLowerCase().includes('sinh lực') || 
        s.name.toLowerCase().includes('the luc') || 
        s.name.toLowerCase().includes('thể lực')
    );
    const manaStat = playerStats.find(s => 
        s.name.toLowerCase().includes('mana') || 
        s.name.toLowerCase().includes('năng lượng') || 
        s.name.toLowerCase().includes('ki') || 
        s.name.toLowerCase().includes('mp') || 
        s.name.toLowerCase().includes('pháp lực')
    );

    const quickStatus = healthStat ? `${healthStat.value} - ${healthStat.desc || ''}` : 'Bình thường';
    
    // #3 Quan hệ: ["Tên Nhân vật", "Độ thân thiết", "Chi tiết/Đánh giá"]
    const relations = (lsr['3'] || []).map(row => ({
        name: getRowValue(row, 0),
        affinity: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(r => r.name);
    
    // #4 Nhiệm vụ / Quest: ["Thời gian", "Trạng thái", "Tên Quest", "Tiến độ"]
    const quests = (lsr['4'] || []).map(row => ({
        time: getRowValue(row, 0),
        status: getRowValue(row, 1),
        name: getRowValue(row, 2),
        progress: getRowValue(row, 3)
    })).filter(q => q.name);
    const activeQuest = quests.find(q => 
        q.status.toLowerCase().includes('đang') || 
        q.status.toLowerCase().includes('active') || 
        q.status.toLowerCase().includes('chưa')
    );

    // #5 Kỹ năng / Phép thuật: ["Tên kỹ năng", "Cấp độ", "Sức mạnh / Mô tả"]
    const skills = (lsr['5'] || []).map(row => ({
        name: getRowValue(row, 0),
        level: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(s => s.name);

    // #6 Túi đồ: ["Tên vật phẩm", "Số lượng", "Trạng thái/Tác dụng"]
    const items = (lsr['6'] || []).map(row => ({
        name: getRowValue(row, 0),
        quantity: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(i => i.name);

    const filteredItems = useMemo(() => {
        if (!searchItemText.trim()) return items;
        return items.filter(i => 
            i.name.toLowerCase().includes(searchItemText.toLowerCase()) || 
            (i.desc && i.desc.toLowerCase().includes(searchItemText.toLowerCase()))
        );
    }, [items, searchItemText]);

    // #7 Trang bị đang mặc: ["Vị trí", "Tên trang bị", "Hiệu ứng/Độ bền"]
    const equipment = (lsr['7'] || []).map(row => ({
        slot: getRowValue(row, 0),
        name: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(e => e.name);

    // #8 Địa điểm đã biết
    const places = (lsr['8'] || []).map(row => ({
        name: getRowValue(row, 0),
        description: getRowValue(row, 1)
    })).filter(p => p.name);

    // #9 Phe phái / Thế lực
    const factions = (lsr['9'] || []).map(row => ({
        name: getRowValue(row, 0),
        reputation: getRowValue(row, 1),
        diplomacy: getRowValue(row, 2)
    })).filter(f => f.name);

    // #10 Timeline Sự kiện Thế giới
    const worldTimeline = (lsr['10'] || []).map(row => ({
        time: getRowValue(row, 0),
        significance: getRowValue(row, 1),
        name: getRowValue(row, 2),
        detail: getRowValue(row, 3)
    })).filter(t => t.name || t.detail);

    // #11 Tin đồn / Nhật ký
    const rumors = (lsr['11'] || []).map(row => ({
        source: getRowValue(row, 0),
        content: getRowValue(row, 1),
        reliability: getRowValue(row, 2)
    })).filter(r => r.content);

    // #12 Hiệu ứng (Buff/Debuff): ["Tên hiệu ứng", "Thời gian còn lại", "Tác dụng"]
    const activeEffects = (lsr['12'] || []).map(row => ({
        name: getRowValue(row, 0),
        duration: getRowValue(row, 1),
        effect: getRowValue(row, 2)
    })).filter(e => e.name);

    // #13 Kinh tế / Tiền tệ: ["Loại tài sản", "Số lượng", "Ghi chú"]
    const economy = (lsr['13'] || []).map(row => ({
        type: getRowValue(row, 0),
        amount: getRowValue(row, 1),
        note: getRowValue(row, 2)
    })).filter(eco => eco.type);

    // #14 Pet / Đồng hành
    const companions = (lsr['14'] || []).map(row => ({
        name: getRowValue(row, 0),
        status: getRowValue(row, 1),
        loyalty: getRowValue(row, 2)
    })).filter(c => c.name);

    // #15 Timeline Nhân Vật Chính
    const playerTimeline = (lsr['15'] || []).map(row => ({
        arc: getRowValue(row, 0),
        date: getRowValue(row, 1),
        character: getRowValue(row, 2),
        event: getRowValue(row, 3)
    })).filter(t => t.event);

    // Format final time string
    const timeString = gameTime ? formatGameTime(gameTime) : (getRowValue(currentInfo, 0) || '12:00');
    
    // --- Dynamic Environmental Color Themes & Icons --
    const environmentTheme = useMemo(() => {
        const lcTime = timeString.toLowerCase();
        const locStr = locationString.toLowerCase();
        
        let accentColor = "text-sky-400";
        let accentBg = "bg-sky-500/10";
        let accentBorder = "border-sky-500/30";
        let hoverBorder = "hover:border-sky-500/50";
        let glowShadow = "shadow-[0_0_15px_rgba(56,189,248,0.25)]";
        let bgGradient = "from-slate-900 via-slate-950 to-zinc-950";
        let headerGradient = "from-slate-950/70 to-slate-950/80";
        let headingText = "text-sky-200";
        let timeIcon = <Sun size={14} className="text-amber-400" />;
        
        // Manual Skin Overrides
        if (hudThemeSkin === 'mystic') {
            accentColor = "text-indigo-400";
            accentBg = "bg-indigo-500/10";
            accentBorder = "border-indigo-500/30";
            hoverBorder = "hover:border-indigo-500/50";
            glowShadow = "shadow-[0_0_15px_rgba(99,102,241,0.25)]";
            bgGradient = "from-indigo-950/50 via-slate-950 to-neutral-950";
            headerGradient = "from-indigo-950/80 to-indigo-950/90";
            headingText = "text-indigo-200";
            timeIcon = <Moon size={14} className="text-violet-300 animate-pulse" />;
        } else if (hudThemeSkin === 'rose') {
            accentColor = "text-rose-400";
            accentBg = "bg-rose-500/10";
            accentBorder = "border-rose-500/30";
            hoverBorder = "hover:border-rose-500/50";
            glowShadow = "shadow-[0_0_15px_rgba(244,63,94,0.25)]";
            bgGradient = "from-rose-950/40 via-slate-950 to-zinc-950";
            headerGradient = "from-rose-950/70 to-slate-950/85";
            headingText = "text-rose-200";
            timeIcon = <Sun size={14} className="text-rose-400 animate-spin-slow" />;
        } else if (hudThemeSkin === 'emerald') {
            accentColor = "text-emerald-400";
            accentBg = "bg-emerald-500/10";
            accentBorder = "border-emerald-500/30";
            hoverBorder = "hover:border-emerald-500/50";
            glowShadow = "shadow-[0_0_15px_rgba(16,185,129,0.25)]";
            bgGradient = "from-emerald-950/30 via-slate-950 to-slate-950";
            headerGradient = "from-emerald-950/60 to-slate-950/75";
            headingText = "text-emerald-200";
            timeIcon = <Sun size={14} className="text-yellow-300" />;
        } else {
            // Environment adaptive default
            if (lcTime.includes('đêm') || lcTime.includes('tối') || lcTime.includes('khuya') || lcTime.includes('21:') || lcTime.includes('22:') || lcTime.includes('23:') || lcTime.includes('00:') || lcTime.includes('01:') || lcTime.includes('02:') || lcTime.includes('03:') || lcTime.includes('04:')) {
                accentColor = "text-indigo-400";
                accentBg = "bg-indigo-500/10";
                accentBorder = "border-indigo-500/30";
                hoverBorder = "hover:border-indigo-500/50";
                glowShadow = "shadow-[0_0_15px_rgba(99,102,241,0.2)]";
                bgGradient = "from-indigo-950/40 via-slate-950 to-neutral-950";
                headerGradient = "from-indigo-950/85 to-indigo-950/95";
                headingText = "text-indigo-200";
                timeIcon = <Moon size={14} className="text-violet-300 animate-pulse" />;
            } else if (lcTime.includes('chiều') || lcTime.includes('hoàng hôn') || lcTime.includes('chạng vạng') || lcTime.includes('17:') || lcTime.includes('18:') || lcTime.includes('19:')) {
                accentColor = "text-rose-400";
                accentBg = "bg-rose-500/10";
                accentBorder = "border-rose-500/30";
                hoverBorder = "hover:border-rose-500/50";
                glowShadow = "shadow-[0_0_15px_rgba(244,63,94,0.25)]";
                bgGradient = "from-rose-950/30 via-slate-950 to-zinc-950";
                headerGradient = "from-rose-950/70 to-slate-950/85";
                headingText = "text-rose-200";
                timeIcon = <Sun size={14} className="text-rose-400" />;
            } else if (lcTime.includes('sáng') || lcTime.includes('bình minh') || lcTime.includes('05:') || lcTime.includes('06:') || lcTime.includes('07:') || lcTime.includes('08:') || lcTime.includes('09:')) {
                accentColor = "text-emerald-400";
                accentBg = "bg-emerald-500/10";
                accentBorder = "border-emerald-500/30";
                hoverBorder = "hover:border-emerald-500/50";
                glowShadow = "shadow-[0_0_15px_rgba(16,185,129,0.22)]";
                bgGradient = "from-emerald-950/30 via-slate-950 to-slate-950";
                headerGradient = "from-emerald-950/60 to-slate-950/75";
                headingText = "text-emerald-200";
                timeIcon = <Sun size={14} className="text-yellow-300 animate-pulse" />;
            }
        }
        
        let sceneryIcon = <MapPin size={12} className={accentColor} />;
        if (locStr.includes('rừng') || locStr.includes('cây') || locStr.includes('thảo nguyên') || locStr.includes('núi') || locStr.includes('nguyên')) {
            sceneryIcon = <MapPin size={12} className="text-emerald-400" />;
        } else if (locStr.includes('hang') || locStr.includes('hầm') || locStr.includes('ngục') || locStr.includes('đá') || locStr.includes('tối')) {
            sceneryIcon = <MapPin size={12} className="text-neutral-400" />;
        } else if (locStr.includes('biển') || locStr.includes('sông') || locStr.includes('hồ') || locStr.includes('nước') || locStr.includes('đại dương')) {
            sceneryIcon = <MapPin size={12} className="text-cyan-400 animate-pulse" />;
        } else if (locStr.includes('hỏa') || locStr.includes('lửa') || locStr.includes('vực') || locStr.includes('lab')) {
            sceneryIcon = <MapPin size={12} className="text-rose-500" />;
        } else if (locStr.includes('phố') || locStr.includes('thành') || locStr.includes('chợ') || locStr.includes('quán') || locStr.includes('lâu đài')) {
            sceneryIcon = <MapPin size={12} className="text-amber-400" />;
        }
        
        return {
            accentColor,
            accentBg,
            accentBorder,
            hoverBorder,
            glowShadow,
            bgGradient,
            headerGradient,
            headingText,
            timeIcon,
            sceneryIcon,
            timeStr: timeString // Fixes original undefined rendering bug
        };
    }, [timeString, locationString, hudThemeSkin]);

    // --- Dynamic Health Glow aura around character photo ---
    const characterAura = useMemo(() => {
        const effectsStr = JSON.stringify(activeEffects).toLowerCase();
        
        const isPoisoned = effectsStr.includes('độc') || effectsStr.includes('yếu') || effectsStr.includes('nguyền') || effectsStr.includes('dược');
        const isWounded = healthStat && (
            healthStat.value.toLowerCase().includes('yếu') || 
            healthStat.value.toLowerCase().includes('thấp') || 
            healthStat.value.toLowerCase().includes('nguy kịch') ||
            (getProgressRatio(healthStat.value) !== -1 && getProgressRatio(healthStat.value) < 30)
        );
        const isBuffed = effectsStr.includes('phúc lành') || effectsStr.includes('vệ') || effectsStr.includes('tăng') || effectsStr.includes('pháp') || effectsStr.includes('quang');

        if (isWounded) {
            return {
                pulseClass: "animate-ping bg-rose-500/20 ring-2 ring-rose-500/50",
                borderClass: "border-rose-500/90 shadow-[0_0_15px_rgba(244,63,94,0.73)]"
            };
        } else if (isPoisoned) {
            return {
                pulseClass: "animate-pulse bg-purple-500/20 ring-2 ring-purple-400/50",
                borderClass: "border-purple-500/90 shadow-[0_0_15px_rgba(168,85,247,0.73)]"
            };
        } else if (isBuffed) {
            return {
                pulseClass: "animate-pulse bg-amber-400/20 ring-2 ring-amber-400/50",
                borderClass: "border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.61)]"
            };
        }
        
        return {
            pulseClass: "animate-pulse bg-sky-500/10 ring-1 ring-sky-500/30",
            borderClass: "border-sky-500/60 shadow-[0_0_8px_rgba(56,189,248,0.36)]"
        };
    }, [activeEffects, healthStat]);

    // --- Widget Action handlers ---
    const toggleWidget = (widgetId: string) => {
        const updated = visibleWidgets.includes(widgetId)
            ? visibleWidgets.filter(w => w !== widgetId)
            : [...visibleWidgets, widgetId];
        setVisibleWidgets(updated);
        dbService.setKeyValue('ark_hud_visible_widgets', updated);
    };

    const addCustomWidget = () => {
        if (!newWidgetLabel.trim()) return;
        const newWidget: CustomWidget = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
            label: newWidgetLabel.trim(),
            tableId: newWidgetTable,
            rowIdx: newWidgetRow,
            colIdx: newWidgetCol,
            iconEmoji: newWidgetEmoji
        };
        const updated = [...customWidgets, newWidget];
        setCustomWidgets(updated);
        dbService.setKeyValue('ark_hud_custom_widgets', updated);
        setNewWidgetLabel('');
    };

    const removeCustomWidget = (id: string) => {
        const updated = customWidgets.filter(w => w.id !== id);
        setCustomWidgets(updated);
        dbService.setKeyValue('ark_hud_custom_widgets', updated);
    };

    const changeSkin = (skin: 'default' | 'mystic' | 'rose' | 'emerald') => {
        setHudThemeSkin(skin);
        dbService.setKeyValue('ark_hud_skin_theme', skin);
    };

    const silhouetteSlots = [
        { key: 'đầu', label: 'Mũ/Đầu', icon: <Shirt size={14} className="opacity-25" /> },
        { key: 'áo', label: 'Cơ thể/Áo', icon: <Shirt size={14} className="opacity-25" /> },
        { key: 'vũ khí', label: 'Vũ khí chính', icon: <Swords size={14} className="opacity-25" /> },
        { key: 'tay', label: 'Tay/Shield', icon: <Shield size={14} className="opacity-25" /> },
        { key: 'nhẫn', label: 'Nhẫn/Bùa', icon: <Coins size={14} className="opacity-25" /> },
        { key: 'chân', label: 'Giày/Chân', icon: <Backpack size={14} className="opacity-25" /> }
    ];

    if (!worldData) return null;

    return (
        <div className={`relative w-full z-20 transition-all duration-700 bg-stone-200 dark:bg-[#0c1425] border-b border-stone-300 dark:border-slate-900 shadow-md ${expanded ? '' : 'neu-flat'}`} id="dynamic_hud_container">
            
            {/* Top Bar - Beautiful Compact HUD Overlay */}
            <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    
                    {/* Character Bio Avatar & Vitals status */}
                    <button 
                        onClick={() => setExpanded(!expanded)} 
                        className="flex items-center gap-3 group cursor-pointer shrink-0 rounded-2xl hover:bg-stone-300/40 dark:hover:bg-slate-800/40 p-1.5 -ml-1 transition-all"
                        id="hud_avatar_btn"
                    >
                        <div className="relative">
                            {/* Animated ring glow indicator */}
                            <div className={`absolute -inset-0.5 rounded-full blur-sm leading-none ${characterAura.pulseClass}`} />
                            
                            <div className={`relative w-11 h-11 rounded-full bg-slate-950 flex items-center justify-center border-2 ${characterAura.borderClass} group-hover:border-white transition-all overflow-hidden shadow-inner`}>
                                {worldData.player.avatar ? (
                                    <img src={worldData.player.avatar} alt={worldData.player.name} className="w-full h-full object-cover scale-105" referrerPolicy="no-referrer" />
                                ) : (
                                    <User size={22} className="text-slate-400" />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-xs font-black text-stone-800 dark:text-slate-100 group-hover:text-mystic-accent transition-colors tracking-widest uppercase font-mono">
                                {worldData.player.name}
                            </span>
                            <span className="text-[10px] font-bold text-stone-600 dark:text-slate-400 max-w-[130px] md:max-w-[210px] truncate flex items-center gap-1.5 mt-0.5">
                                <Heart size={10} className="text-rose-500 animate-pulse fill-rose-500/20" />
                                {quickStatus}
                            </span>
                        </div>
                    </button>

                    <div className="h-8 w-px bg-stone-400/20 dark:bg-slate-800/40 hidden md:block" />

                    {/* Compact Interactive Stats Carousel */}
                    <div className="flex items-center gap-2.5 overflow-x-auto select-none no-scrollbar flex-1 pb-1 md:pb-0" id="hud_widgets_container">
                        
                        {/* 1. Environment Widget */}
                        {visibleWidgets.includes('env') && (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-300">
                                {environmentTheme.timeIcon}
                                <span className="text-[10px] font-extrabold font-mono text-stone-700 dark:text-slate-300">{environmentTheme.timeStr}</span>
                                <span className="text-[10px] font-normal text-stone-400 dark:text-slate-500 font-mono">|</span>
                                {environmentTheme.sceneryIcon}
                                <span className="text-[10px] font-extrabold text-stone-700 dark:text-slate-300 truncate max-w-[100px] md:max-w-[150px]">{locationString}</span>
                            </div>
                        )}

                        {/* 2. Primary Vitals Indicator Bar */}
                        {visibleWidgets.includes('stats') && healthStat && (
                            <div className="hidden sm:flex flex-col gap-1 w-24 md:w-32 shrink-0 neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none px-2.5 py-1.5 rounded-xl justify-center">
                                <div className="flex justify-between text-[8px] font-mono font-black leading-none text-stone-600 dark:text-slate-400">
                                    <span>{healthStat.name}</span>
                                    <span className="text-rose-600 dark:text-rose-400 font-bold">{healthStat.value}</span>
                                </div>
                                <div className="h-1 bg-stone-350 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full" 
                                        style={{ width: `${Math.max(0, Math.min(100, getProgressRatio(healthStat.value) !== -1 ? getProgressRatio(healthStat.value) : 100))}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {visibleWidgets.includes('stats') && manaStat && (
                            <div className="hidden md:flex flex-col gap-1 w-20 md:w-28 shrink-0 neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none px-2.5 py-1.5 rounded-xl justify-center">
                                <div className="flex justify-between text-[8px] font-mono font-black leading-none text-stone-600 dark:text-slate-400">
                                    <span>{manaStat.name}</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{manaStat.value}</span>
                                </div>
                                <div className="h-1 bg-stone-350 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-400 rounded-full" 
                                        style={{ width: `${Math.max(0, Math.min(100, getProgressRatio(manaStat.value) !== -1 ? getProgressRatio(manaStat.value) : 100))}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* 3. Active Quest Objective */}
                        {visibleWidgets.includes('quest') && (activeQuest || currentObjective) && (
                            <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-300">
                                <Target size={11} className="text-amber-500 animate-pulse" />
                                <span className="text-[10px] font-extrabold text-stone-700 dark:text-slate-300 truncate max-w-[150px] md:max-w-[220px]">
                                    {activeQuest ? activeQuest.name : currentObjective}
                                </span>
                            </div>
                        )}

                        {/* 4. Economy Quick Stats */}
                        {visibleWidgets.includes('economy') && economy.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-300 font-mono">
                                <Coins size={11} className="text-yellow-500" />
                                <span className="text-[10px] font-extrabold text-amber-500">
                                    {economy[0].amount} {economy[0].type}
                                </span>
                            </div>
                        )}

                        {/* 5. Cát hung (Buffs) counting indicator */}
                        {visibleWidgets.includes('effects') && activeEffects.length > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0 text-amber-400 text-[10px] font-bold">
                                <Zap size={11} className="animate-bounce" />
                                <span>{activeEffects.length} Mẫn hiệu</span>
                            </div>
                        )}

                        {/* --- RENDER USER-PERSISTED CUSTOM WIDGETS --- */}
                        {customWidgets.map(widget => {
                            const customVal = (() => {
                                const table = (lsr[widget.tableId] || []) as any[];
                                const row = table[widget.rowIdx];
                                if (!row) return '';
                                return getRowValue(row, widget.colIdx, '');
                            })();
                            
                            if (!customVal) return null;

                            return (
                                <div 
                                    key={widget.id} 
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-200"
                                    title={`Tùy chỉnh: ${widget.label}`}
                                >
                                    <span className="text-xs leading-none">{widget.iconEmoji}</span>
                                    <span className="text-[10px] font-medium text-stone-500 dark:text-slate-400 font-mono uppercase">{widget.label}:</span>
                                    <span className="text-[10px] font-black text-stone-800 dark:text-slate-100 font-mono">{customVal}</span>
                                </div>
                            );
                        })}

                    </div>
                </div>

                {/* Right side controls - Open Configuration or full Dashboard */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                         onClick={() => {
                             if (!expanded) {
                                 setExpanded(true);
                                 setActiveTab('status');
                             } else {
                                 setExpanded(false);
                             }
                         }}
                         className={`px-3.5 py-2.5 rounded-xl border-none flex items-center gap-2 text-[11px] font-mono tracking-widest uppercase transition-all duration-300 hover:scale-105 active:scale-95 neu-btn text-stone-700 dark:text-slate-300 ${
                             expanded && activeTab !== 'config'
                             ? 'text-mystic-accent font-black shadow-inner' 
                             : 'font-black'
                         }`}
                         title="Xem bảng trạng thái toàn bộ"
                         id="hud_expand_btn"
                    >
                         <span className="hidden md:inline font-bold">BẢN THỂ</span>
                         <motion.div animate={{ rotate: (expanded && activeTab !== 'config') ? 180 : 0 }} transition={{ duration: 0.3 }}>
                             <ChevronDown size={14} />
                         </motion.div>
                    </button>

                    <button 
                         onClick={() => {
                             if (expanded && activeTab === 'config') {
                                 setExpanded(false);
                             } else {
                                 setExpanded(true);
                                 setActiveTab('config');
                             }
                         }}
                         className={`p-2.5 rounded-xl border-none flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 neu-btn text-stone-700 dark:text-slate-300 ${
                             expanded && activeTab === 'config'
                             ? 'text-amber-400 bg-amber-500/10 border-amber-500/30 shadow-inner'
                             : ''
                         }`}
                         title="Cấu hình Widget và diện mạo HUD"
                         id="hud_config_btn"
                    >
                         <Settings size={14} className={expanded && activeTab === 'config' ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Dashboard - Satisfying Expandable Details panel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-white/5 bg-slate-950/95"
                    >
                        <div className="flex flex-col h-full max-h-[75vh] md:max-h-[500px]">
                            
                            {/* Tab Selection Row */}
                            <div className="flex px-4 pt-1 gap-1 overflow-x-auto no-scrollbar border-b border-white/5 bg-black/40">
                                {[
                                    { id: 'status', label: 'Trạng thái', icon: <Activity size={12} /> },
                                    { id: 'inventory', label: 'Hành lý', icon: <Backpack size={12} /> },
                                    { id: 'quests', label: 'Cơ duyên', icon: <Compass size={12} /> },
                                    { id: 'relations', label: 'Nhân gian', icon: <Users size={12} /> },
                                    { id: 'chronicles', label: 'Sử ký', icon: <Scroll size={12} /> },
                                    { id: 'config', label: 'Cấu hình HUD', icon: <Settings size={12} /> }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as any);
                                            setSelectedItem(null);
                                        }}
                                        className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                                            activeTab === tab.id 
                                            ? `text-white border-sky-400 bg-sky-500/5` 
                                            : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
                                        }`}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Tab Grid content panel */}
                            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-slate-950 via-slate-950 to-zinc-950">
                                
                                {/* 1. STATUS TAB */}
                                {activeTab === 'status' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        
                                        {/* Left col: Character Stat Bars & Vitals */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                    <Activity size={12} className={environmentTheme.accentColor} />
                                                    <span>Chỉ Số Bản Thể</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-3 space-y-3">
                                                    {playerStats.length > 0 ? (
                                                        playerStats.map((stat, i) => {
                                                            const ratio = getProgressRatio(stat.value);
                                                            const isHp = stat.name.toLowerCase().includes('máu') || stat.name.toLowerCase().includes('hp') || stat.name.toLowerCase().includes('sinh lực');
                                                            const isMp = stat.name.toLowerCase().includes('mana') || stat.name.toLowerCase().includes('năng lượng') || stat.name.toLowerCase().includes('mp') || stat.name.toLowerCase().includes('ki') || stat.name.toLowerCase().includes('pháp lực');
                                                            const isStamina = stat.name.toLowerCase().includes('lực') || stat.name.toLowerCase().includes('giáp') || stat.name.toLowerCase().includes('khí') || stat.name.toLowerCase().includes('tinh thần') || stat.name.toLowerCase().includes('thần thức');

                                                            // Determine bar color
                                                            let barColor = "from-sky-600 to-sky-400";
                                                            if (isHp) barColor = "from-red-600 to-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]";
                                                            else if (isMp) barColor = "from-indigo-600 to-violet-400 shadow-[0_0_8px_rgba(124,58,237,0.4)]";
                                                            else if (isStamina) barColor = "from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]";

                                                            return (
                                                                <div key={i} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                                    <div className="flex items-center justify-between animate-fadeIn">
                                                                        <span className="text-[11px] font-black text-slate-300 font-mono">{stat.name}</span>
                                                                        <span className="text-[11px] font-bold font-mono text-white bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{stat.value}</span>
                                                                    </div>
                                                                    
                                                                    {ratio !== -1 ? (
                                                                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-[1px] border border-white/5">
                                                                            <motion.div 
                                                                                initial={{ width: 0 }}
                                                                                animate={{ width: `${ratio}%` }}
                                                                                transition={{ duration: 0.8, ease: "easeOut" }}
                                                                                className={`h-full rounded-full bg-gradient-to-r ${barColor}`} 
                                                                            />
                                                                        </div>
                                                                    ) : null}
                                                                    {stat.desc && <span className="text-[10px] text-slate-400 mt-0.5 leading-snug font-sans">{stat.desc}</span>}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="p-4 text-center text-xs text-slate-500 font-mono">Chưa ghi nhận bản thể</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center col: Spells, Skills & Magic */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                    <BookOpen size={12} className="text-amber-400" />
                                                    <span>Kỹ Năng & Lĩnh Ngộ</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-2 max-h-[220px] overflow-y-auto no-scrollbar">
                                                    {skills.length > 0 ? (
                                                        skills.map((s, i) => (
                                                            <div key={i} className="p-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors flex gap-2.5 items-start">
                                                                <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-mono font-bold shrink-0">
                                                                    {getRowValue(s, 1, '1')}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[11px] font-bold text-slate-200">{s.name}</span>
                                                                    <span className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">{s.desc}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-4 text-center text-xs text-slate-500 font-mono">Trang kinh sơ khai, chưa lĩnh ngộ chiêu thức</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Companion details */}
                                            {companions.length > 0 && (
                                                <div>
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                        <Users size={12} className="text-pink-400" />
                                                        <span>Linh Thú & Bạn Đồng Hành</span>
                                                    </h4>
                                                    <div className="bg-black/35 rounded-xl border border-white/5 p-2 grid grid-cols-1 gap-2">
                                                        {companions.map((c, i) => (
                                                            <div key={i} className="flex items-center gap-2.5 py-1 px-2 border-b border-white/5 last:border-none">
                                                                <div className="w-7 h-7 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                                                                    <User size={13} className="text-pink-300" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <span className="text-[11px] font-bold text-slate-200">{c.name}</span>
                                                                    <span className="text-[10px] text-pink-300 font-mono italic">{c.status}</span>
                                                                </div>
                                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                                                                    💖 {c.loyalty || 'Trung thành'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right col: Dynamic Active Effects / Debuffs */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                    <Zap size={11} className="text-rose-400" />
                                                    <span>Trạng Thái Cát Hung (Buffs)</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-3 space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                                                    {activeEffects.length > 0 ? (
                                                        activeEffects.map((eff, i) => {
                                                            const isNegative = eff.name.toLowerCase().includes('độc') || eff.name.toLowerCase().includes('nguyền') || eff.name.toLowerCase().includes('yếu') || eff.name.toLowerCase().includes('giảm') || eff.name.toLowerCase().includes('vết thương');
                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    className={`flex flex-col p-2.5 rounded-lg border transition-all ${
                                                                        isNegative 
                                                                        ? 'bg-purple-950/20 border-purple-900/40 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.1)]' 
                                                                        : 'bg-amber-950/15 border-amber-900/35 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.05)]'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-bold flex items-center gap-1">
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isNegative ? 'bg-purple-500 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
                                                                            {eff.name}
                                                                        </span>
                                                                        <span className="text-[9px] font-mono opacity-80 flex items-center gap-0.5">
                                                                            <Clock size={8} />
                                                                            {eff.duration}
                                                                        </span>
                                                                    </div>
                                                                    {eff.effect && <span className="text-[10px] opacity-70 mt-1 leading-snug">{eff.effect}</span>}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="p-5 text-center text-xs text-slate-600 font-mono bg-slate-900/20 rounded-xl border border-dashed border-white/5">
                                                            Lục phủ thanh tịnh, vô định trạng thái cát tinh
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* 2. INVENTORY TAB - RPG Style Equipment & Item Grid with Inspect Drawer */}
                                {activeTab === 'inventory' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fadeIn">
                                        
                                        {/* Equipment Silhouette view (Left 5 columns) */}
                                        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Shield size={12} className="text-emerald-400" />
                                                    <span>Thiết Bị Cực Hạn (Trang Bị)</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-4 flex flex-col items-center relative min-h-[220px] justify-center">
                                                    <div className="absolute top-2 left-2 text-[8px] font-mono text-slate-500 uppercase tracking-widest">BODY CORE MATRIX</div>
                                                    
                                                    {/* Symmetric visual equipment outline */}
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-sm">
                                                        {silhouetteSlots.map(slot => {
                                                            // Match table #7 gear matching slot key in name or slot column
                                                            const eqItem = equipment.find(e => 
                                                                e.slot.toLowerCase().includes(slot.key) || 
                                                                slot.key.toLowerCase().includes(e.slot.toLowerCase())
                                                            );

                                                            return (
                                                                <div 
                                                                    key={slot.key} 
                                                                    className={`p-2 rounded-lg border flex flex-col items-center text-center justify-between min-h-[64px] transition-all ${
                                                                        eqItem 
                                                                        ? 'bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)] hover:border-emerald-500/60' 
                                                                        : 'bg-black/45 border-white/10 hover:border-slate-700'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between w-full opacity-60">
                                                                        <span className="text-[8px] font-mono tracking-widest uppercase text-slate-400">{slot.label}</span>
                                                                        {slot.icon}
                                                                    </div>
                                                                    
                                                                    {eqItem ? (
                                                                        <div className="w-full mt-1.5">
                                                                            <div className="text-[11px] font-black leading-none text-emerald-300 truncate">{eqItem.name}</div>
                                                                            <div className="text-[9px] text-slate-400 truncate mt-0.5 leading-none">{eqItem.desc || 'Đang lắp'}</div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[9px] font-mono text-slate-500 italic mt-1.5">Trống</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bag square slots view & Asset Indicator (Right 7 columns) */}
                                        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                                            <div>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-1.5 font-mono">
                                                        <Backpack size={12} className="text-sky-400" />
                                                        <span>Hành Trang & Tài Vật (Bags)</span>
                                                    </h4>
                                                    <input 
                                                        type="text"
                                                        placeholder="Tìm vật phẩm..."
                                                        value={searchItemText}
                                                        onChange={e => setSearchItemText(e.target.value)}
                                                        className="px-2 py-0.5 text-[10px] rounded bg-black border border-white/10 text-slate-300 outline-none w-full sm:w-36 focus:border-sky-500 transition-colors font-mono"
                                                    />
                                                </div>
                                                
                                                {/* Squares layout of items */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto no-scrollbar bg-black/25 rounded-xl border border-white/5 p-2">
                                                    {filteredItems.length > 0 ? (
                                                        filteredItems.map((item, i) => (
                                                            <div 
                                                                key={i} 
                                                                onClick={() => setSelectedItem(item)}
                                                                className={`cursor-pointer group flex flex-col justify-between p-2 rounded-lg bg-black/45 hover:bg-slate-900 border transition-all ${
                                                                    selectedItem?.name === item.name 
                                                                    ? `${environmentTheme.accentBorder} ${environmentTheme.glowShadow} scale-95` 
                                                                    : 'border-white/5 hover:border-white/10'
                                                                }`}
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <div className="w-7 h-7 rounded bg-sky-500/5 hover:bg-sky-500/10 border border-white/5 text-[9px] text-center flex items-center justify-center font-bold text-sky-400 font-mono">
                                                                        VẬT
                                                                    </div>
                                                                    <div className="text-[10px] font-black font-mono text-slate-300 bg-black px-1 rounded border border-white/5">
                                                                        x{item.quantity || 1}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 text-[10px] font-bold text-slate-200 truncate group-hover:text-white leading-tight">
                                                                    {item.name}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="col-span-full py-12 text-center text-xs text-slate-500 font-mono">Bao xơ trắng không có vật ngoài thân</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Item Inspection details tray */}
                                            {selectedItem && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 flex flex-col relative"
                                                >
                                                    <button 
                                                        onClick={() => setSelectedItem(null)}
                                                        className="absolute top-1.5 right-2 text-slate-400 hover:text-white font-mono text-xs p-1"
                                                    >
                                                        ✕
                                                    </button>
                                                    <div className="text-[11px] font-black text-sky-300 uppercase tracking-widest font-mono">Thông tin vật phẩm</div>
                                                    <div className="text-xs font-bold text-white mt-1 uppercase flex items-center gap-1">
                                                        <span>{selectedItem.name}</span>
                                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black text-amber-400">Số lượng: {selectedItem.quantity}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300 leading-relaxed mt-1.5 italic font-sans">
                                                        {selectedItem.desc || 'Huyền diệu chi vật vô luận tác dụng'}
                                                    </p>
                                                </motion.div>
                                            )}

                                            {/* Financial items indicator */}
                                            {economy.length > 0 && (
                                                <div className="bg-black/40 rounded-xl border border-white/5 p-2 px-3 flex flex-wrap gap-3 items-center">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 font-mono">
                                                        <Coins size={10} className="text-yellow-500" />
                                                        <span>Kinh tế & Tài sản:</span>
                                                    </div>
                                                    {economy.map((eco, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-white/5">
                                                            <span className="text-[10px] font-bold text-slate-400 truncate">{eco.type}:</span>
                                                            <span className="text-[11px] font-bold font-mono text-amber-400">{eco.amount}</span>
                                                            {eco.note && <span className="text-[9px] text-slate-400 truncate max-w-[80px]">({eco.note})</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}

                                {/* 3. QUESTS & COMPASS LORE TAB */}
                                {activeTab === 'quests' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fadeIn">
                                        
                                        {/* Quest List (Left 7 columns) */}
                                        <div className="lg:col-span-7 space-y-3">
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Target size={12} className="text-amber-400" />
                                                <span>Thiên Mệnh Nhân Quả (Nhiệm vụ)</span>
                                            </h4>
                                            
                                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar">
                                                {quests.length > 0 ? (
                                                    quests.map((q, i) => {
                                                        const isActive = q.status.toLowerCase().includes('đang') || q.status.toLowerCase().includes('tiến hành') || q.status.toLowerCase().includes('chưa');
                                                        const isDone = q.status.toLowerCase().includes('hoàn') || q.status.toLowerCase().includes('thành') || q.status.toLowerCase().includes('xong');
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`p-3 rounded-xl border transition-all ${
                                                                    isActive 
                                                                    ? 'bg-amber-950/15 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.05)]' 
                                                                    : isDone 
                                                                    ? 'bg-emerald-950/20 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.05)]' 
                                                                    : 'bg-black/35 border-white/5'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border ${
                                                                            isActive 
                                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                                                            : isDone 
                                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                                            : 'bg-slate-800 text-slate-400 border-white/5'
                                                                        }`}>
                                                                            {q.status}
                                                                        </span>
                                                                        <span className="text-[10px] font-mono text-slate-500">{q.time}</span>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="text-[12px] font-bold text-slate-100 mt-2 font-mono">{q.name}</div>
                                                                
                                                                {q.progress && (
                                                                    <div className="mt-2 flex flex-col gap-0.5 bg-black/30 p-2 rounded border border-white/5">
                                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Tiến độ sự kiện</span>
                                                                        <span className="text-[11px] text-slate-300 italic leading-snug">{q.progress}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-8 text-center text-xs text-slate-500 font-mono bg-black/40 rounded-xl border border-white/5 border-dashed">
                                                        Phục vân tản bộ, thế giới nhàn tản vô tai ách nguy nan
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Discovered Places & Rumors (Right 5 columns) */}
                                        <div className="lg:col-span-5 space-y-4">
                                            {/* Discovered places */}
                                            {places.length > 0 && (
                                                <div>
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                        <MapPin size={11} className="text-indigo-400" />
                                                        <span>Bản Đồ Ký (Địa Điểm)</span>
                                                    </h4>
                                                    <div className="bg-black/35 rounded-xl border border-white/5 p-2 grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto no-scrollbar">
                                                        {places.map((p, i) => (
                                                            <div key={i} className="py-2 px-2.5 rounded bg-black/50 border border-white/5 flex flex-col">
                                                                <span className="text-[11px] font-bold text-slate-200 font-mono">{p.name}</span>
                                                                {p.description && <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">{p.description}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Rumors journals */}
                                            {rumors.length > 0 && (
                                                <div>
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                        <FileText size={11} className="text-sky-400" />
                                                        <span>Đàm Tiếu Vân Khói (Tin Đồn)</span>
                                                    </h4>
                                                    <div className="bg-black/35 rounded-xl border border-white/5 p-2.5 space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                                                        {rumors.map((rum, i) => (
                                                            <div key={i} className="text-[10px] leading-relaxed p-2 bg-slate-900/60 border border-white/5 rounded text-slate-300">
                                                                <div className="flex items-center justify-between text-slate-400 font-mono text-[8px] uppercase font-bold mb-1 border-b border-white/5 pb-1">
                                                                    <span>Nguồn: {rum.source || 'Nhân thế'}</span>
                                                                    <span className="text-amber-500">Tin cậy: {rum.reliability}</span>
                                                                </div>
                                                                "{rum.content}"
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}

                                {/* 4. SOCIAL & RELATIONSHIPS TAB */}
                                {activeTab === 'relations' && (
                                    <div className="space-y-4 animate-fadeIn">
                                        
                                        {/* Factions status panel at the top (if present) */}
                                        {factions.length > 0 && (
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                    <Shield size={12} className="text-sky-400" />
                                                    <span>Môn Phái & Thế Lực</span>
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                                    {factions.map((f, i) => (
                                                        <div key={i} className="p-2.5 rounded-xl bg-black/45 border border-white/5 flex items-center justify-between">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[12px] font-bold text-slate-200 truncate font-mono">{f.name}</span>
                                                                <span className="text-[10px] text-slate-400 mt-0.5 leading-none">Ngoại giao: {f.diplomacy || 'Hòa hoãn'}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 px-2 py-0.5 rounded">
                                                                🛡️ {f.reputation || '0'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Relations Grid */}
                                        <div>
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                <Users size={12} className="text-pink-400" />
                                                <span>Nhân Tương Hội Ngộ (Nhân Vật)</span>
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {relations.length > 0 ? (
                                                    relations.map((rel, i) => {
                                                        const isActiveRecently = recentNpcs.some(n => 
                                                            n.name.toLowerCase().includes(rel.name.toLowerCase()) ||
                                                            rel.name.toLowerCase().includes(n.name.toLowerCase())
                                                        );

                                                        // Parse estimated friendliness numbers (e.g., "80/100", "70%", "Tiên tiến 90")
                                                        const affinityNumber = getProgressRatio(rel.affinity);

                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`p-3 rounded-xl border bg-gradient-to-r from-black/35 to-black/10 transition-colors flex gap-3 ${
                                                                    isActiveRecently 
                                                                    ? 'border-pink-500/40 ring-1 ring-pink-500/20' 
                                                                    : 'border-white/5 hover:border-pink-500/20'
                                                                }`}
                                                            >
                                                                {/* Circular Avatar */}
                                                                <div className="relative shrink-0">
                                                                    <div className={`w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border ${isActiveRecently ? 'border-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.4)]' : 'border-white/10'}`}>
                                                                        <User size={18} className="text-slate-400" />
                                                                    </div>
                                                                    {isActiveRecently && (
                                                                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-black rounded-full animate-pulse" title="Vừa tương tác gần đây" /> // Space typo fixed here
                                                                    )}
                                                                </div>

                                                                {/* Detailed text */}
                                                                <div className="flex flex-col flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-1.5">
                                                                        <span className="text-[12px] font-black text-slate-100 truncate font-mono">{rel.name}</span>
                                                                        <span className="text-[10px] font-mono px-2 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 whitespace-nowrap">
                                                                            💖 {rel.affinity}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    {/* Friendly gauge bar if applicable */}
                                                                    {affinityNumber !== -1 && (
                                                                        <div className="h-1 bg-slate-900 rounded-full w-full overflow-hidden mt-1.5">
                                                                            <motion.div 
                                                                                initial={{ width: 0 }}
                                                                                animate={{ width: `${affinityNumber}%` }}
                                                                                className="h-full bg-gradient-to-r from-rose-500 to-pink-400 rounded-full" 
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed font-sans">
                                                                        {rel.desc}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="col-span-full py-12 text-center text-xs text-slate-500 font-mono bg-black/40 rounded-xl border border-white/5 border-dashed">
                                                        Phàn trần độc bước, chưa lập nhân duyên bằng hữu thế sự
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* 5. CHRONICLES TIMELINE TAB */}
                                {activeTab === 'chronicles' && (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 animate-fadeIn">
                                        
                                        {/* Player timeline / Personal Arc milestones (Left 6 columns) */}
                                        <div className="md:col-span-6 space-y-3.5">
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-1.5">
                                                <Scroll size={11} className="text-pink-400" />
                                                <span>Thiên Mệnh Ký Sự (Sử ký Thân Bản)</span>
                                            </h4>
                                            
                                            <div className="relative border-l border-white/10 pl-4 ml-2.5 py-1 space-y-4 max-h-[320px] overflow-y-auto no-scrollbar">
                                                {playerTimeline.length > 0 ? (
                                                    playerTimeline.map((item, i) => (
                                                        <div key={i} className="relative group">
                                                            {/* Custom Bullet icon on vertical timeline line */}
                                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-slate-950 group-hover:scale-125 transition-transform" />
                                                            
                                                            <div className="bg-black/35 rounded-xl border border-white/5 p-3 hover:border-pink-500/10 transition-colors">
                                                                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 uppercase font-black">
                                                                    <span>TIẾN TRÌNH: {item.arc || 'CHÍNH'}</span>
                                                                    <span className="text-pink-400">{item.date}</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-300 mt-1 font-mono">
                                                                    Tương tác: {item.character}
                                                                </div>
                                                                <p className="text-[11px] text-slate-300 leading-relaxed mt-1.5 font-sans italic">
                                                                    "{item.event}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-12 text-center text-xs text-slate-500 font-mono">Chương thư khởi sắc, đang viết truyền kỳ bản thân</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* World event chronology timeline (Right 6 columns) */}
                                        <div className="md:col-span-6 space-y-3.5">
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-1.5">
                                                <Clock size={11} className="text-amber-400" />
                                                <span>Biên Niên Thế Sự (Sự Kiện Thiên Hạ)</span>
                                            </h4>
                                            
                                            <div className="relative border-l border-white/10 pl-4 ml-2.5 py-1 space-y-4 max-h-[320px] overflow-y-auto no-scrollbar">
                                                {worldTimeline.length > 0 ? (
                                                    worldTimeline.map((item, i) => (
                                                        <div key={i} className="relative group">
                                                            {/* Round bullet indicator */}
                                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-slate-950 group-hover:scale-125 transition-transform animate-pulse" />
                                                            
                                                            <div className="bg-black/35 rounded-xl border border-white/5 p-3 hover:border-amber-500/10 transition-colors">
                                                                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 font-black">
                                                                    <span>Ý NGHĨA: {item.significance || 'PHÁT SINH'}</span>
                                                                    <span className="text-amber-400">{item.time}</span>
                                                                </div>
                                                                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wide font-mono">
                                                                    {item.name || 'Biến chuyển đại lục'}
                                                                </div>
                                                                <p className="text-[11px] text-slate-300 leading-relaxed mt-1.5 font-sans">
                                                                    {item.detail}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-12 text-center text-xs text-slate-500 font-mono">Bát quái tĩnh dính, núi sông đại lục tạm thời thanh tĩnh</div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* 6. ADVANCED WIDGET CONFIGURATION & CUSTOM SKIN THEMES */}
                                {activeTab === 'config' && (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 animate-fadeIn" id="hud_config_panel">
                                        
                                        {/* Standard widget toggles (Left 6 columns) */}
                                        <div className="md:col-span-6 space-y-4">
                                            <div>
                                                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5 flex items-center gap-1.5 font-mono">
                                                    <Settings size={12} className="text-sky-400" />
                                                    <span>Bản chọn widget tiêu chuẩn (Compact Bar)</span>
                                                </h4>
                                                <p className="text-[11px] text-slate-400 mb-3 font-sans">Chọn ẩn/hiện các khối thông tin tiêu chuẩn trên thanh HUD nhỏ phí trên:</p>
                                                
                                                <div className="bg-black/40 rounded-xl border border-white/5 p-3 space-y-2">
                                                    {[
                                                        { id: 'env', label: 'Quang cảnh & Giờ khắc', desc: 'Sự kết hợp Thời gian game + Địa điểm hiện tại', icon: '🌍' },
                                                        { id: 'stats', label: 'Chỉ số Bản thể', desc: 'Thanh Sinh mệnh (HP) & Năng lượng (Mana)', icon: '❤️' },
                                                        { id: 'quest', label: 'Thiên mệnh nhân quả', desc: 'Nhiệm vụ chính tuyến hoặc mục tiêu đang làm', icon: '🎯' },
                                                        { id: 'economy', label: 'Bảo khố (Tài sản)', desc: 'Tiền tệ hoặc vật phẩm giá trị sơ khai', icon: '🪙' },
                                                        { id: 'effects', label: 'Cát hung Linh hiệu', desc: 'Độ mẫn linh, độc thuật hay Buff năng kích hoạt', icon: '⚡' }
                                                    ].map(orig => (
                                                        <div 
                                                            key={orig.id} 
                                                            onClick={() => toggleWidget(orig.id)}
                                                            className={`p-2.5 rounded-lg border cursor-pointer hover:bg-slate-900 flex items-center justify-between transition-colors ${
                                                                visibleWidgets.includes(orig.id) 
                                                                ? 'bg-sky-950/20 border-sky-400/30 text-sky-200' 
                                                                : 'bg-black/30 border-white/5 text-slate-500'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <span className="text-sm">{orig.icon}</span>
                                                                <div className="flex flex-col leading-tight min-w-0">
                                                                    <span className="text-[11px] font-bold font-mono">{orig.label}</span>
                                                                    <span className="text-[9px] opacity-75 truncate">{orig.desc}</span>
                                                                </div>
                                                            </div>
                                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                                visibleWidgets.includes(orig.id) 
                                                                ? 'border-sky-400 bg-sky-500/20' 
                                                                : 'border-slate-700 bg-slate-900'
                                                            }`}>
                                                                {visibleWidgets.includes(orig.id) && <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Visual HUD skin themes selection */}
                                            <div>
                                                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5 flex items-center gap-1.5 font-mono">
                                                    <Sparkles size={12} className="text-amber-400" />
                                                    <span>Tông màu HUD (Visual Skins)</span>
                                                </h4>
                                                
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { id: 'default', label: '🎮 Thích Ứng Khí Hậu', desc: 'Thay đổi màu theo thời gian thực tế', col: 'border-slate-800 bg-slate-900' },
                                                        { id: 'mystic', label: '🔮 Lam Dạ Tinh Hà', desc: 'Phong thái đêm dịu, tinh vân Lam Thạch', col: 'border-indigo-950/50 bg-indigo-950/20' },
                                                        { id: 'rose', label: '🩸 Huyết Nguyệt Hỏa Vân', desc: 'Thế lực Hỏa tàn, Đỏ hoàng hôn yêu dã', col: 'border-rose-950/50 bg-rose-910/20' },
                                                        { id: 'emerald', label: '🌱 Thảo Thần Linh Thạch', desc: 'Sắc xanh dịu, rừng sâu bích mộc hồi sinh', col: 'border-emerald-950/50 bg-emerald-950/20' }
                                                    ].map(skinItem => (
                                                        <div 
                                                            key={skinItem.id}
                                                            onClick={() => changeSkin(skinItem.id as any)}
                                                            className={`p-2.5 rounded-xl cursor-pointer border transition-all text-left flex flex-col justify-between ${skinItem.col} ${
                                                                hudThemeSkin === skinItem.id 
                                                                ? 'ring-2 ring-amber-400/60 border-amber-400' 
                                                                : 'hover:border-white/10'
                                                            }`}
                                                        >
                                                            <span className="text-[11.5px] font-bold text-slate-100 font-mono">{skinItem.label}</span>
                                                            <span className="text-[9px] text-slate-400 mt-1 leading-snug">{skinItem.desc}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dynamic Custom Regex-Table widget builder (Right 6 columns) */}
                                        <div className="md:col-span-6 space-y-4">
                                            <div>
                                                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                                                    <Plus size={13} className="text-emerald-400" />
                                                    <span>Chế Tạo Custom Widget</span>
                                                </h4>
                                                <p className="text-[11px] text-slate-400 mb-2.5 font-sans">Trích xuất mọi dữ liệu từ hệ thống bảng LSR gán thẳng lên thanh HUD nhỏ vô cùng trực quan:</p>

                                                <div className="bg-black/40 rounded-xl border border-white/5 p-4 space-y-3.5">
                                                    
                                                    {/* Widget Label row */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] uppercase font-black text-slate-450 font-mono">Tên hiển thị (Label):</label>
                                                        <input 
                                                            type="text"
                                                            placeholder="ví dụ: Tu vi, Linh lực, Linh Thạch..."
                                                            value={newWidgetLabel}
                                                            onChange={e => setNewWidgetLabel(e.target.value)}
                                                            className="px-3 py-2 text-xs rounded-lg bg-black border border-white/10 text-white outline-none focus:border-emerald-500 transition-colors font-mono"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Table Select */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] uppercase font-black text-slate-450 font-mono">Nguồn Bảng LSR:</label>
                                                            <select 
                                                                value={newWidgetTable} 
                                                                onChange={e => setNewWidgetTable(e.target.value)}
                                                                className="px-2.5 py-1.5 text-xs rounded-lg bg-black border border-white/10 text-slate-300 outline-none font-mono"
                                                            >
                                                                <option value="0">#0 Hiện tại / Điểm mục</option>
                                                                <option value="1">#1 Gần đây / NPCs</option>
                                                                <option value="2">#2 Trạng thái / Bản thân</option>
                                                                <option value="3">#3 Quan hệ nhân vật</option>
                                                                <option value="4">#4 Thiên mệnh / Nhiệm vụ</option>
                                                                <option value="5">#5 Kỹ năng / Lĩnh ngộ</option>
                                                                <option value="6">#6 Túi đồ / Hành lý</option>
                                                                <option value="7">#7 Trang bị đang mặc</option>
                                                                <option value="8">#8 Địa điểm đã biết</option>
                                                                <option value="9">#9 Phe phái thế lực</option>
                                                                <option value="10">#10 Biên niên sử ngoại ký</option>
                                                                <option value="11">#11 Tin đồn đàm tiếu</option>
                                                                <option value="12">#12 Hiệu ứng Buff/Debuff</option>
                                                                <option value="13">#13 Kinh tế tài vật</option>
                                                                <option value="14">#14 Thú khế nhân duyên</option>
                                                                <option value="15">#15 Thân bản ký hành</option>
                                                            </select>
                                                        </div>

                                                        {/* Icon select */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] uppercase font-black text-slate-450 font-mono">Icon hiển thị:</label>
                                                            <select 
                                                                value={newWidgetEmoji} 
                                                                onChange={e => setNewWidgetEmoji(e.target.value)}
                                                                className="px-2.5 py-1.5 text-xs rounded-lg bg-black border border-white/10 text-slate-300 outline-none font-mono"
                                                            >
                                                                <option value="🔮">🔮 Linh thạch / Ma pháp</option>
                                                                <option value="⚡">⚡ Lôi điện / Đột đột</option>
                                                                <option value="🪙">🪙 Tiêu pha / Tài vật</option>
                                                                <option value="🧪">🧪 Độc bình / Thảo dược</option>
                                                                <option value="⚔️">⚔️ Đồ đao / Sức mạnh</option>
                                                                <option value="🛡️">🛡️ Kim giáp / Phòng thủ</option>
                                                                <option value="🔥">🔥 Chân hỏa / Công lực</option>
                                                                <option value="🌸">🌸 Duyên phận / Hồng trần</option>
                                                                <option value="📜">📜 Ghi chép / Sử thư</option>
                                                                <option value="🐺">🐺 Đồng hành / Linh thú</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Row number selector */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] uppercase font-black text-slate-450 font-mono">Dòng (Tùy chỉnh index):</label>
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                max="20"
                                                                value={newWidgetRow}
                                                                onChange={e => setNewWidgetRow(parseInt(e.target.value) || 0)}
                                                                className="px-2.5 py-1.5 text-xs rounded-lg bg-black border border-white/10 text-white outline-none font-mono"
                                                            />
                                                        </div>

                                                        {/* Column number selector */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] uppercase font-black text-slate-450 font-mono">Cột (Tùy chỉnh index):</label>
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                max="8"
                                                                value={newWidgetCol}
                                                                onChange={e => setNewWidgetCol(parseInt(e.target.value) || 0)}
                                                                className="px-2.5 py-1.5 text-xs rounded-lg bg-black border border-white/10 text-white outline-none font-mono"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* --- INTERACTIVE LSR DATA VISUAL PICKER --- */}
                                                    <div className="p-3 bg-slate-900/50 rounded-xl border border-white/10 space-y-2.5 animate-fadeIn">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] uppercase font-bold text-emerald-400 font-mono">Duyệt & Chọn Nhanh Tế Bào LSR Dữ Liệu Thực :</span>
                                                        </div>
                                                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-white/5">
                                                            {(() => {
                                                                const tableKeys = Object.keys(lsr);
                                                                const tableLabels: Record<string, string> = {
                                                                    '0': '#0 Hiện tại', '1': '#1 Gần đây', '2': '#2 Chỉ số', '3': '#3 Quan hệ',
                                                                    '4': '#4 Nhiệm vụ', '5': '#5 Kỹ năng', '6': '#6 Túi đồ', '7': '#7 Trang bị',
                                                                    '8': '#8 Địa danh', '9': '#9 Phe phái', '10': '#10 Sử ký', '11': '#11 Nhật ký',
                                                                    '12': '#12 Hiệu ứng', '13': '#13 Kinh tế', '14': '#14 Linh thú', '15': '#15 Hành trình'
                                                                };
                                                                return tableKeys.map(key => {
                                                                    const rows = lsr[key] || [];
                                                                    if (rows.length === 0) return null;
                                                                    return (
                                                                        <button
                                                                            key={key}
                                                                            type="button"
                                                                            onClick={() => setActiveLsrBrowserTable(key)}
                                                                            className={`px-2 py-0.5 text-[8.5px] font-mono font-black rounded transition-all whitespace-nowrap ${
                                                                                activeLsrBrowserTable === key 
                                                                                ? 'bg-emerald-500 text-black shadow-md' 
                                                                                : 'bg-black/40 text-slate-400 border border-white/5 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            {tableLabels[key] || `Bảng ${key}`} ({rows.length})
                                                                        </button>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>

                                                        {/* Preview Cells Grid */}
                                                        <div className="bg-black/60 rounded border border-white/5 max-h-[120px] overflow-y-auto custom-scrollbar p-2 space-y-2">
                                                            {(() => {
                                                                const activeRows = (lsr[activeLsrBrowserTable] || []) as any[];
                                                                if (activeRows.length === 0) {
                                                                    return <div className="text-[10px] text-slate-500 text-center font-mono">Không tìm thấy bản ghi cho nguồn này</div>;
                                                                }
                                                                return activeRows.map((row, rIdx) => {
                                                                    const cellKeys = Object.keys(row).filter(k => k !== 'length');
                                                                    return (
                                                                        <div key={rIdx} className="space-y-1 border-b border-white/5 pb-1.5 last:border-none last:pb-0 font-mono">
                                                                            <div className="text-[8px] text-slate-500 font-extrabold uppercase">Dọc dòng {rIdx}:</div>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {cellKeys.map((cKey, cIdx) => {
                                                                                    const cellVal = getRowValue(row, cKey);
                                                                                    if (!cellVal) return null;
                                                                                    const isSelected = newWidgetTable === activeLsrBrowserTable && newWidgetRow === rIdx && newWidgetCol === Number(cKey);
                                                                                    return (
                                                                                        <button
                                                                                            key={cKey}
                                                                                            type="button"
                                                                                            title={`Nhấp để chọn Bảng ${activeLsrBrowserTable} - Dòng ${rIdx} - Cột ${cKey}`}
                                                                                            onClick={() => {
                                                                                                setNewWidgetTable(activeLsrBrowserTable);
                                                                                                setNewWidgetRow(rIdx);
                                                                                                setNewWidgetCol(Number(cKey));
                                                                                                // Smart Auto Naming
                                                                                                const firstVal = getRowValue(row, 0);
                                                                                                if (firstVal && Number(cKey) !== 0) {
                                                                                                    setNewWidgetLabel(firstVal);
                                                                                                } else {
                                                                                                    setNewWidgetLabel(cellVal.substring(0, 16));
                                                                                                }
                                                                                            }}
                                                                                            className={`px-1.5 py-0.5 text-[10px] rounded transition-all max-w-[120px] truncate border text-left ${
                                                                                                isSelected 
                                                                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500' 
                                                                                                : 'bg-black text-slate-350 border-white/10 hover:border-slate-500 hover:text-white'
                                                                                            }`}
                                                                                        >
                                                                                            C{cIdx}: {cellVal}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={addCustomWidget}
                                                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 font-mono font-bold text-xs rounded-lg text-black hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                                                    >
                                                        <Plus size={14} />
                                                        <span>GHIM LÊN COMPACT HUD</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Custom Widgets List with delete option */}
                                            {customWidgets.length > 0 && (
                                                <div>
                                                    <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                                                        <span>Danh sách Custom Widget đang Pin</span>
                                                    </h4>
                                                    <div className="bg-black/30 rounded-xl border border-white/5 p-2 space-y-1.5">
                                                        {customWidgets.map(widget => (
                                                            <div key={widget.id} className="p-2 bg-black/60 border border-white/5 rounded-lg flex items-center justify-between">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="text-xs">{widget.iconEmoji}</span>
                                                                    <div className="flex flex-col min-w-0 leading-none">
                                                                        <span className="text-[11px] font-black text-slate-200 truncate font-mono">{widget.label}</span>
                                                                        <span className="text-[8.5px] text-slate-500 font-mono mt-0.5">Bảng {widget.tableId} [D{widget.rowIdx}, C{widget.colIdx}]</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => removeCustomWidget(widget.id)}
                                                                    className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                                                    title="Tháo ghim khỏi HUD"
                                                                >
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}

                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
