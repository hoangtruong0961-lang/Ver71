import React, { useState, useEffect } from 'react';
import { WorldData, AppSettings, ChatMessage, GameTime, TawaPresetConfig } from '../../../../types';
import { buildGameplaySystemPrompt, getReinforcementInstruction } from '../../../../services/ai/gameplay/prompts';
import { vectorService } from '../../../../services/ai/vectorService';
import { storyBibleService } from '../../../../services/ai/storyBibleService';
import { LsrParser } from '../../../../services/lsr/LsrParser';
import { ContextCompressor } from '../../../../utils/compression';
// Removed DEFAULT_PRESET_CONFIG import
import { Loader2, Copy, Check, TerminalSquare } from 'lucide-react';

interface ContextDebuggerViewProps {
    worldData: WorldData;
    settings: AppSettings | null;
    history: ChatMessage[];
    turnCount: number;
    presetConfig?: TawaPresetConfig;
    gameTime?: GameTime;
    lastUserMessage: string;
}

export const ContextDebuggerView: React.FC<ContextDebuggerViewProps> = ({
    worldData,
    settings,
    history,
    turnCount,
    presetConfig,
    gameTime,
    lastUserMessage
}) => {
    const [systemInstruction, setSystemInstruction] = useState<string>('');
    const [historyPayload, setHistoryPayload] = useState<ChatMessage[]>([]);
    const [userPayload, setUserPayload] = useState<string>('');
    const [prefillPayload, setPrefillPayload] = useState<string>('');
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);

    useEffect(() => {
        const buildPreview = async () => {
            setIsUpdating(true);
            try {
                if (!settings) return;

                const MAX_HISTORY_CONTEXT = worldData.config.contextConfig?.recentHistoryCount || 100;
                const EMBEDDING_SCHEDULE_INTERVAL = 50;

                const cleanedInput = ContextCompressor.cleanText(lastUserMessage || "Người chơi đang hành động...");

                const currentTurn = Math.floor(history.length / 2);
                const shouldCallEmbedding = settings.enableVectorMemory && currentTurn > 0 && currentTurn % EMBEDDING_SCHEDULE_INTERVAL === 0;
                const shouldSearchEmbedding = shouldCallEmbedding && history.length >= MAX_HISTORY_CONTEXT;
                
                let relevantMemories = "";
                if (shouldSearchEmbedding) {
                    const similarVectors = await vectorService.searchSimilarVectors(cleanedInput, settings, 5);
                    relevantMemories = similarVectors
                        .map(v => `[${new Date(v.timestamp).toLocaleString()}] ${v.role === 'user' ? 'User' : 'AI'}: ${v.text}`)
                        .join('\n\n');
                }

                let sbVectors: import('../../../../services/ai/storybible/types').StoryBibleEntry[] = [];
                const shouldQueryStoryBible = settings.enableVectorMemory && (worldData.config.contextConfig?.items?.storyBible !== false);
                if (shouldQueryStoryBible) {
                    const campaignId = worldData.id || `campaign-${worldData.world?.worldName?.replace(/\s+/g, '')}-${worldData.player?.name?.replace(/\s+/g, '')}`;
                    sbVectors = await storyBibleService.queryContext(cleanedInput, history, campaignId, settings);
                }

                const slicedHistory = history.slice(-MAX_HISTORY_CONTEXT);
                const compressedHistory = slicedHistory.map(msg => ({
                    ...msg,
                    text: ContextCompressor.cleanText(msg.text)
                }));
                // Set history context
                setHistoryPayload(compressedHistory);

                const maxEntities = worldData.config.contextConfig?.maxEntities || 20;
                const recentText = [...compressedHistory.map(m => m.text), cleanedInput].join(' ').toLowerCase();
                
                const sortedEntities = [...worldData.entities].sort((a, b) => {
                    const aMentioned = recentText.includes(a.name.toLowerCase()) ? 1 : 0;
                    const bMentioned = recentText.includes(b.name.toLowerCase()) ? 1 : 0;
                    if (aMentioned !== bMentioned) return bMentioned - aMentioned;
                    
                    const aIsFemale = a.gender === 'Nữ' || a.description?.toLowerCase().includes('nữ') || a.description?.toLowerCase().includes('female') ? 1 : 0;
                    const bIsFemale = b.gender === 'Nữ' || b.description?.toLowerCase().includes('nữ') || b.description?.toLowerCase().includes('female') ? 1 : 0;
                    if (aIsFemale !== bIsFemale) return bIsFemale - aIsFemale;

                    if (a.type !== b.type) {
                        if (a.type === 'NPC') return -1;
                        if (b.type === 'NPC') return 1;
                    }
                    return 0;
                });

                const limitedEntities = sortedEntities.slice(0, maxEntities);

                const lsrTables = LsrParser.parseDefinitions();
                let tableDataString = worldData.lsrData 
                    ? LsrParser.stringifyLsrData(worldData.lsrData, lsrTables)
                    : "";
                tableDataString = ContextCompressor.minifyLsr(tableDataString);

                const activeConfig = presetConfig || { modules: [] };

                const { systemPrompt, postHistoryUser, prefillAssistant } = buildGameplaySystemPrompt(
                    worldData.world,
                    worldData.player,
                    limitedEntities,
                    worldData.entities,
                    relevantMemories,
                    currentTurn,
                    activeConfig, 
                    worldData.config,
                    settings,
                    gameTime,
                    cleanedInput,
                    worldData.summary ? ContextCompressor.cleanText(worldData.summary) : undefined,
                    tableDataString,
                    worldData.lorebook,
                    history,
                    worldData.tavoVars || {},
                    sbVectors
                );

                setSystemInstruction(systemPrompt);

                // Build User Request
                let userRequestContent = `<user_input>${cleanedInput}</user_input>`;
                if (postHistoryUser) {
                    userRequestContent += `\n\n${postHistoryUser}`;
                } else {
                    const reinforcement = getReinforcementInstruction(currentTurn);
                    const finalReminder = `\n\n<CRITICAL_REMINDER>\nSTRICTLY ADHERE TO THE OUTPUT FORMAT. \n...\n</CRITICAL_REMINDER>`;
                    userRequestContent += `${reinforcement}${finalReminder}`;
                }
                setUserPayload(userRequestContent);

                // Build Prefill
                setPrefillPayload(prefillAssistant || '');

            } catch (error) {
                console.error("Error building prompt preview:", error);
                setSystemInstruction(`[LỖI] Không thể tạo trước Context: ${error}`);
            } finally {
                setIsInitialLoad(false);
                setIsUpdating(false);
            }
        };

        buildPreview();
    }, [worldData, settings, history, turnCount, presetConfig, gameTime, lastUserMessage]);

    const getFullPayloadString = () => {
        let fullStr = `=== SYSTEM INSTRUCTION ===\n${systemInstruction}\n\n`;
        fullStr += `=== CHAT HISTORY (${historyPayload.length} messages) ===\n`;
        historyPayload.forEach((msg, idx) => {
            fullStr += `[${msg.role.toUpperCase()}] ${msg.text}\n\n`;
        });
        fullStr += `=== USER INPUT ===\n${userPayload}\n\n`;
        if (prefillPayload) {
            fullStr += `=== ASSISTANT PREFILL ===\n${prefillPayload}\n`;
        }
        return fullStr;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getFullPayloadString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isInitialLoad) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-stone-500">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm font-bold uppercase tracking-widest">Đang kết xuất Context...</p>
            </div>
        );
    }

    const fullString = getFullPayloadString();
    const estimateTokens = Math.ceil((fullString.length || 0) / 3.5);

    return (
        <div className="flex flex-col h-full bg-stone-900 rounded-xl overflow-hidden border border-stone-700 relative">
            {isUpdating && !isInitialLoad && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-bold z-10 backdrop-blur-sm">
                    <Loader2 size={12} className="animate-spin" />
                    Đang cập nhật...
                </div>
            )}
            <div className="p-3 bg-stone-800 border-b border-stone-700 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded flex items-center gap-2">
                        <TerminalSquare size={14} /> Trình Gỡ lỗi Context
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-900/30 px-2 py-1 rounded">
                        Tổng ~{estimateTokens.toLocaleString()} Tokens
                    </span>
                    <span className="text-xs font-mono text-stone-400">
                        ({fullString.length.toLocaleString()} ký tự)
                    </span>
                </div>
                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded text-xs font-bold text-stone-200 transition-colors"
                >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Đã chép' : 'Sao chép toàn bộ'}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                
                {/* System Prompt */}
                <div className="bg-stone-950 rounded border border-stone-800">
                    <div className="px-3 py-1 border-b border-stone-800 bg-stone-800/50 flex justify-between">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">System Instruction</span>
                        <span className="text-[10px] text-stone-500">{systemInstruction.length} chars</span>
                    </div>
                    <pre className="p-3 text-[11px] font-mono text-stone-300 whitespace-pre-wrap leading-relaxed">
                        {systemInstruction}
                    </pre>
                </div>

                {/* History */}
                {historyPayload.length > 0 && (
                    <div className="bg-stone-950 rounded border border-stone-800">
                        <div className="px-3 py-1 border-b border-stone-800 bg-stone-800/50 flex justify-between">
                            <span className="text-xs font-bold text-sky-500 uppercase tracking-widest">History ({historyPayload.length} msgs)</span>
                        </div>
                        <div className="p-3 space-y-4">
                            {historyPayload.map((msg, idx) => (
                                <div key={idx} className="bg-stone-900/50 border border-stone-800 rounded p-2">
                                    <div className={`text-[10px] font-bold uppercase mb-1 ${msg.role === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
                                        {msg.role}
                                    </div>
                                    <pre className="text-[11px] font-mono text-stone-400 whitespace-pre-wrap">
                                        {msg.text}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Final User Input */}
                <div className="bg-stone-950 rounded border border-stone-800">
                    <div className="px-3 py-1 border-b border-stone-800 bg-stone-800/50 flex justify-between">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">User Request (Next Turn)</span>
                    </div>
                    <pre className="p-3 text-[11px] font-mono text-emerald-100 whitespace-pre-wrap leading-relaxed">
                        {userPayload}
                    </pre>
                </div>

                {/* Prefill */}
                {prefillPayload && (
                    <div className="bg-stone-950 rounded border border-stone-800">
                        <div className="px-3 py-1 border-b border-stone-800 bg-stone-800/50 flex justify-between">
                            <span className="text-xs font-bold text-purple-500 uppercase tracking-widest">Assistant Prefill</span>
                        </div>
                        <pre className="p-3 text-[11px] font-mono text-purple-200 whitespace-pre-wrap leading-relaxed">
                            {prefillPayload}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};
