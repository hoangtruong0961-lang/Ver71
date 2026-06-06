
import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Copy, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessage } from '../../../../types';
import Button from '../../../ui/Button';
import { tavoRegistry } from '../../../../services/api/tavoApi';

interface GameInputProps {
    onSend: (text: string) => void;
    onStop?: () => void;
    isLoading: boolean;
    lastAction: string;
    isInputCollapsed: boolean;
    onToggleCollapse: () => void;
    activeChoices: string[];
    history: ChatMessage[];
    children?: React.ReactNode;
}

export interface GameInputRef {
    getInputValue: () => string;
    setInputValue: (val: string) => void;
    appendInputValue: (val: string) => void;
    clearInputValue: () => void;
    sendInput: () => void;
}

const GameInput = forwardRef<GameInputRef, GameInputProps>(({
    onSend,
    onStop,
    isLoading,
    lastAction,
    isInputCollapsed,
    onToggleCollapse,
    activeChoices,
    history,
    children
}, ref) => {
    const [inputValue, setInputValue] = useState('');
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInputValue, setTempInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputValueRef = useRef(inputValue);
    
    useEffect(() => {
        inputValueRef.current = inputValue;
    }, [inputValue]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleInputRaw = (e: Event) => {
            setInputValue((e.target as HTMLTextAreaElement).value);
        };

        textarea.addEventListener('input', handleInputRaw);
        return () => {
            textarea.removeEventListener('input', handleInputRaw);
        };
    }, []);

    const handleSendInternal = useCallback((text?: string) => {
        const textToSend = typeof text === 'string' ? text.trim() : inputValueRef.current.trim();
        if (!textToSend || isLoading) return;
        onSend(textToSend);
        setInputValue('');
        setHistoryIndex(-1);
        setTempInputValue('');
    }, [isLoading, onSend]);

    useImperativeHandle(ref, () => ({
        getInputValue: () => inputValueRef.current,
        setInputValue: (v: string) => setInputValue(v),
        appendInputValue: (v: string) => setInputValue(prev => prev + v),
        clearInputValue: () => setInputValue(''),
        sendInput: () => handleSendInternal(),
        focusInput: () => textareaRef.current?.focus()
    }), [handleSendInternal]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendInternal();
        } else if (e.key === 'ArrowUp') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionStart === 0) {
                const userMessages = history.filter(m => m.role === 'user').map(m => m.text).reverse();
                if (userMessages.length > 0) {
                    const nextIndex = historyIndex + 1;
                    if (nextIndex < userMessages.length) {
                        e.preventDefault();
                        if (historyIndex === -1) {
                            setTempInputValue(inputValue);
                        }
                        setHistoryIndex(nextIndex);
                        setInputValue(userMessages[nextIndex]);
                    }
                }
            }
        } else if (e.key === 'ArrowDown') {
            const target = e.target as HTMLTextAreaElement;
            if (target.selectionStart === inputValue.length && historyIndex >= 0) {
                const userMessages = history.filter(m => m.role === 'user').map(m => m.text).reverse();
                e.preventDefault();
                const nextIndex = historyIndex - 1;
                setHistoryIndex(nextIndex);
                if (nextIndex === -1) {
                    setInputValue(tempInputValue);
                } else {
                    setInputValue(userMessages[nextIndex]);
                }
            }
        }
    };

    return (
        <div className="w-full flex flex-col gap-2">
            {/* Quick Actions (Choices) */}
            <AnimatePresence>
                {activeChoices.length > 0 && !isLoading && !isInputCollapsed && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="px-2 md:px-4 mb-1"
                    >
                        <div className="flex flex-col gap-1.5 max-h-[30vh] md:max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                            {activeChoices.map((choice, idx) => {
                                // Parse choice for time cost if present (e.g. "Action | 10m")
                                const parts = choice.split('|');
                                const displayAction = parts[0].trim();
                                const displayTime = parts[1] ? parts[1].trim().replace('m', '') : null;

                                return (
                                    <motion.div 
                                        key={idx} 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="flex gap-1 group"
                                    >
                                        <button 
                                            onClick={() => {
                                                setInputValue(displayAction);
                                                setTimeout(() => {
                                                    textareaRef.current?.focus();
                                                }, 50);
                                            }}
                                            className="flex-1 text-left text-xs md:text-sm py-2 px-3.5 rounded-xl neu-sm-flat hover:neu-sm-inset text-stone-700 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center justify-between gap-3 group/btn border-none"
                                            title="Bấm để sao chép vào ô nhập câu thoại để chỉnh sửa"
                                        >
                                            <span className="flex-1 leading-snug">{displayAction}</span>
                                            {displayTime && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[9px] font-mono font-bold text-mystic-accent/80 bg-mystic-accent/5 px-2 py-0.5 rounded border border-mystic-accent/20">
                                                        {displayTime}m
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                        <button 
                                            onClick={() => handleSendInternal(displayAction)}
                                            className="w-9 rounded-xl neu-btn border-none text-mystic-accent hover:text-white hover:bg-mystic-accent transition-all flex items-center justify-center shrink-0"
                                            title="Gửi ngay lập tức"
                                        >
                                            <Send size={12} />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(displayAction);
                                            }}
                                            className="w-9 rounded-xl neu-sm-flat border-none hover:text-mystic-accent text-stone-400 dark:text-slate-500 transition-all flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Sao chép"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Bar */}
            <div className="p-1.5 md:p-2.5 flex flex-col gap-2.5 border-t border-stone-400/20 dark:border-slate-800/10 bg-stone-300 dark:bg-[#090f1d] backdrop-blur-sm shadow-inner">
                {/* Top Row: Input Area */}
                <AnimatePresence initial={false}>
                    {!isInputCollapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="w-full overflow-hidden"
                        >
                            <div className="relative w-full group">
                                <textarea 
                                    ref={textareaRef}
                                    id="send_textarea"
                                    name="send_textarea"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Nhập hành động..."
                                    className="w-full bg-stone-300 dark:bg-[#090f1d] neu-sm-inset font-sans rounded-2xl p-3 pb-14 text-stone-800 dark:text-slate-200 border-none outline-none focus:text-mystic-accent transition-all resize-none h-20 md:h-28 custom-scrollbar text-sm md:text-base shadow-inner"
                                />
                                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                    {/* Phục hồi Button (Inside) */}
                                    <button 
                                        onClick={() => {
                                            if (lastAction) {
                                                setInputValue(lastAction);
                                            }
                                        }} 
                                        disabled={isLoading || !lastAction} 
                                        className="h-8 px-3 text-[10px] font-extrabold uppercase tracking-widest neu-btn rounded-xl border-none text-stone-600 dark:text-slate-300 transition-all disabled:opacity-40 shadow-sm"
                                        title="Phục hồi hành động gần nhất"
                                    >
                                        Phục hồi
                                    </button>
                                    {/* Send/Stop Button (Inside) */}
                                    {isLoading ? (
                                        <button 
                                            id="stop_btn"
                                            onClick={onStop} 
                                            className="h-8 px-3 flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-xl border-none transition-all shadow-md font-bold gap-1 animate-pulse"
                                            title="Dừng viết (Stop generating)"
                                        >
                                            <div className="w-2.5 h-2.5 bg-white rounded-sm shrink-0" />
                                            <span className="text-[10px] uppercase font-black tracking-wider">Dừng</span>
                                        </button>
                                    ) : (
                                        <button 
                                            id="send_btn"
                                            onClick={() => handleSendInternal()} 
                                            disabled={!inputValue.trim()} 
                                            className="h-8 w-12 flex items-center justify-center bg-mystic-accent hover:bg-mystic-accent/80 text-white rounded-xl border-none transition-all shadow-md disabled:opacity-40 font-bold"
                                            title="Gửi hành động"
                                        >
                                            <Send size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Row: Controls */}
                <div className="flex gap-2.5 items-center w-full overflow-x-auto no-scrollbar pb-0.5">
                    <div className="flex items-center gap-2 flex-1 justify-center">
                        {/* Send/Stop Button (Only when collapsed) */}
                        {isInputCollapsed && (
                            isLoading ? (
                                <button 
                                    onClick={onStop} 
                                    className="h-9 md:h-10 px-4 flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md border-none transition-all shrink-0 font-bold gap-1.5 animate-pulse"
                                    title="Dừng viết (Stop generating)"
                                >
                                    <div className="w-3 h-3 bg-white rounded-sm shrink-0" />
                                    <span className="text-xs uppercase font-black tracking-wider">Dừng</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleSendInternal()} 
                                    className="h-9 md:h-10 px-5 flex items-center justify-center bg-mystic-accent hover:bg-mystic-accent/80 text-white rounded-xl shadow-md border-none transition-all shrink-0 font-bold"
                                    title="Gửi hành động (Continue)"
                                >
                                    <Send size={18} />
                                </button>
                            )
                        )}
                        
                        {children}
                    </div>

                    {/* Toggle Input Button - Fills remaining space */}
                    <button 
                        onClick={onToggleCollapse}
                        className={`h-9 md:h-10 px-3 flex-1 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm min-w-[40px] border-none ${
                            isInputCollapsed 
                            ? 'neu-sm-inset text-mystic-accent font-black' 
                            : 'neu-btn font-bold text-stone-600 dark:text-slate-300'
                        }`}
                        title={isInputCollapsed ? "Mở rộng ô nhập" : "Thu gọn ô nhập"}
                    >
                        {isInputCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                        <span className="text-[10px] font-bold uppercase whitespace-nowrap tracking-wider">
                            {isInputCollapsed ? 'Mở Rộng' : 'Thu Gọn'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
});

export default React.memo(GameInput);

