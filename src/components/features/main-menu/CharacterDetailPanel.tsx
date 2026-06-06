import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Info, BookOpen, Settings, ChevronRight, ChevronLeft, Calendar, Cpu, Bug, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, Sparkles, Loader2, Code, Terminal, Send, RotateCcw } from 'lucide-react';
import Button from '../../ui/Button';
import { StoredCharacter } from '../../../types';
import { dbService } from '../../../services/db/indexedDB';
import MarkdownRenderer from '../../common/MarkdownRenderer';

interface CharacterDetailPanelProps {
  character: StoredCharacter;
  onClose: () => void;
  onStart: (alternateGreetingIndex?: number) => void;
  onUpdate?: (updatedChar: StoredCharacter) => void;
}

export const CharacterDetailPanel: React.FC<CharacterDetailPanelProps> = ({ character, onClose, onStart, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'lorebook' | 'regex'>('info');
  const [greetingIndex, setGreetingIndex] = useState(-1);

  // AI Regex Chatbot Debugger states (matching sandbox live debugger style)
  const [selectedScriptIndex, setSelectedScriptIndex] = useState<number>(-1); // -1 is Tutti (all)
  const [regexAiChat, setRegexAiChat] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [regexAiInput, setRegexAiInput] = useState('');
  const [isRegexAiLoading, setIsRegexAiLoading] = useState(false);
  const [regexAiError, setRegexAiError] = useState<string | null>(null);

  const dataBlock = (character.rawData?.data && (character.spec === 'chara_card_v2' || character.spec === 'chara_card_v3')) 
    ? character.rawData.data 
    : (character.rawData || character || {});
  const alternateGreetings = dataBlock.alternate_greetings || [];
  
  const characterBook = character.rawData?.character_book || dataBlock.character_book;
  const lorebookSize = characterBook?.entries?.length || 0;
  
  let regexScripts: any[] = [];
  if (character.rawData?.regex_scripts) regexScripts = character.rawData.regex_scripts;
  else if (dataBlock.extensions?.regex_scripts) regexScripts = dataBlock.extensions.regex_scripts;
  else if (characterBook?.extensions?.regex_scripts) regexScripts = characterBook.extensions.regex_scripts;

  // Helper to persist updated scripts
  const updateCharacterRegexScripts = async (updatedScripts: any[]) => {
    const updatedChar = { ...character };
    
    if (updatedChar.rawData?.regex_scripts) {
      updatedChar.rawData.regex_scripts = updatedScripts;
    }
    
    // Also check nested data block (chara spec V2 / V3)
    if (updatedChar.rawData?.data) {
      if (updatedChar.rawData.data.extensions?.regex_scripts) {
        updatedChar.rawData.data.extensions.regex_scripts = updatedScripts;
      }
      if (updatedChar.rawData.data.character_book?.extensions?.regex_scripts) {
        updatedChar.rawData.data.character_book.extensions.regex_scripts = updatedScripts;
      }
    }
    
    // Check root character_book
    if (updatedChar.rawData?.character_book?.extensions?.regex_scripts) {
      updatedChar.rawData.character_book.extensions.regex_scripts = updatedScripts;
    }
    
    await dbService.saveCharacter(updatedChar);
    if (onUpdate) {
      onUpdate(updatedChar);
    }
  };

  const askRegexAi = async (customPrompt?: string | null, freshStarted = false, scriptIndexOverride?: number) => {
    setIsRegexAiLoading(true);
    setRegexAiError(null);
    const userMsgText = customPrompt !== undefined ? customPrompt : regexAiInput;
    if (userMsgText === '' && customPrompt === undefined) {
      setIsRegexAiLoading(false);
      return;
    }

    if (customPrompt === undefined) {
      setRegexAiInput('');
    }

    const nextChatHistory = [...regexAiChat];
    if (userMsgText) {
      nextChatHistory.push({ role: 'user', text: userMsgText });
      setRegexAiChat(nextChatHistory);
    }

    try {
      const idx = scriptIndexOverride !== undefined ? scriptIndexOverride : selectedScriptIndex;
      let currentScript: any = null;
      if (idx >= 0 && idx < regexScripts.length) {
        currentScript = regexScripts[idx];
      }

      const scriptName = currentScript ? (currentScript.scriptName || currentScript.name || `Script ${idx + 1}`) : "Tất cả kịch bản";
      const findRegex = currentScript ? (currentScript.regex || currentScript.findRegex || '') : JSON.stringify(regexScripts.map((s, i) => ({ index: i, name: s.scriptName || s.name, regex: s.regex || s.findRegex })));
      const replaceString = currentScript ? (currentScript.replacementString || currentScript.replacementText || currentScript.replaceString || '') : JSON.stringify(regexScripts.map((s, i) => ({ index: i, name: s.scriptName || s.name, replacement: s.replacementString || s.replacementText || s.replaceString })));

      const response = await fetch('/api/ai/debug-regex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scriptName,
          findRegex,
          replaceString,
          testInput: currentGreeting || '',
          testOutput: '',
          prompt: userMsgText || "Hãy phân tích và rà soát lỗi kịch bản Regex này giúp tôi.",
          chatHistory: freshStarted ? [] : regexAiChat
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Không thể gửi yêu cầu gỡ lỗi.');
      }

      setRegexAiChat(prev => [...prev, { role: 'model', text: data.text }]);
    } catch (err: any) {
      setRegexAiError(err.message || 'Lỗi không xác định khi kết nối với máy chủ AI.');
    } finally {
      setIsRegexAiLoading(false);
    }
  };

  const handleScriptChange = (index: number) => {
    setSelectedScriptIndex(index);
    setRegexAiChat([]);
    
    const isAll = index === -1;
    const prefix = isAll 
      ? "Hãy quét phân tích và gỡ lỗi tổng quan cho tất cả kịch bản Regex hiện có của nhân vật này nhé."
      : `Tôi muốn rà soát và tối ưu kịch bản Regex cụ thể mang tên "${regexScripts[index]?.scriptName || regexScripts[index]?.name || `Script ${index + 1}`}". Hãy phân tích biểu thức tìm kiếm \`${regexScripts[index]?.regex || regexScripts[index]?.findRegex}\` và hướng xử lý của nó nhé.`;
    
    askRegexAi(prefix, true, index);
  };

  const currentGreeting = greetingIndex === -1 ? dataBlock.first_mes : alternateGreetings[greetingIndex];
  
  const creator = dataBlock?.creator || character.rawData?.creator;
  const version = dataBlock?.character_version || character.rawData?.character_version || dataBlock?.version || character.rawData?.version;
  const creatorNotes = dataBlock?.creator_notes || character.rawData?.creator_notes;

  return (
    <div className="flex flex-col h-full">
      {/* Header Image */}
      <div className="relative h-64 flex-none bg-slate-950">
        {character.avatarUrl ? (
          <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-700">NO IMAGE</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/40" />
        <Button 
          variant="ghost" 
          icon={<X size={20} />} 
          onClick={onClose} 
          className="absolute top-4 left-4 rounded-full w-10 h-10 p-0 flex items-center justify-center bg-black/50 text-white hover:bg-black/80 backdrop-blur-md" 
        />
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="text-2xl font-black text-white drop-shadow-md leading-tight">{character.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {character.spec && (
               <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {character.spec}
               </span>
            )}
            {version && (
               <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  v{version}
               </span>
            )}
            {creator && (
               <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate max-w-[150px]" title={`Tác giả: ${creator}`}>
                  Tác giả: {creator}
               </span>
            )}
            {character.tags && character.tags.length > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-slate-800 text-slate-400">
                    {character.tags.length} Tags
                </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 border-b border-slate-800/60 bg-slate-900/50 flex-none overflow-x-auto no-scrollbar">
        {[
          { id: 'info', icon: <Info size={14} />, label: 'THÔNG TIN' },
          { id: 'lorebook', icon: <BookOpen size={14} />, label: `LOREBOOK (${lorebookSize})` },
          { id: 'regex', icon: <Settings size={14} />, label: `REGEX (${regexScripts.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-indigo-400 text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900">
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Tags Checklist */}
            <div className="space-y-1.5 animate-fade-in">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nhãn đính kèm (Tags)</h3>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-950/20 rounded-xl border border-slate-800/40">
                {character.tags && character.tags.length > 0 ? (
                  character.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/15">
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-500 italic">Không có nhãn (Tags).</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mô tả (Description)</h3>
              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/50 max-h-60 overflow-y-auto custom-scrollbar">
                <MarkdownRenderer content={character.description || 'Không có mô tả.'} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ghi chú từ Tác giả (Creator Notes)</h3>
              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/50 max-h-40 overflow-y-auto custom-scrollbar">
                {creatorNotes ? (
                  <MarkdownRenderer content={creatorNotes} />
                ) : (
                  <span className="text-slate-500 italic text-xs">Trống (Tác giả không đính kèm ghi chú).</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lời chào hàng / Lời thoại mở đầu (Greeting)</h3>
                {alternateGreetings.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-800/50 rounded-full px-2 py-1">
                    <button 
                      onClick={() => setGreetingIndex(prev => prev > -1 ? prev - 1 : alternateGreetings.length - 1)}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono text-slate-300">
                      {greetingIndex === -1 ? 'Mặc định' : `Alt ${greetingIndex + 1}`}
                    </span>
                    <button 
                      onClick={() => setGreetingIndex(prev => prev < alternateGreetings.length - 1 ? prev + 1 : -1)}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/50 max-h-64 overflow-y-auto custom-scrollbar">
                <MarkdownRenderer content={currentGreeting || 'Trống.'} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tính cách (Personality)</h3>
              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/50 max-h-40 overflow-y-auto custom-scrollbar">
                 <MarkdownRenderer content={dataBlock.personality || 'Trống.'} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bối cảnh cốt truyện (Scenario)</h3>
              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/50 max-h-40 overflow-y-auto custom-scrollbar">
                {dataBlock.scenario ? (
                  <MarkdownRenderer content={dataBlock.scenario} />
                ) : (
                  <span className="text-slate-500 italic text-xs">Trống (Không có thiết đặt bối cảnh cụ thể).</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ví dụ hội thoại (Example Messages)</h3>
              <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 max-h-40 overflow-y-auto custom-scrollbar font-mono whitespace-pre-wrap">
                {dataBlock.mes_example ? (
                  dataBlock.mes_example
                ) : (
                  <span className="text-slate-500 italic text-xs font-sans">Trống. Không chứa ví dụ mẫu câu thoại.</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lời nhắc hệ thống cá nhân (System Prompt)</h3>
              <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 max-h-40 overflow-y-auto custom-scrollbar font-mono whitespace-pre-wrap pink-accent-selection">
                {(dataBlock.system_prompt || dataBlock.extensions?.system_prompt) ? (
                  dataBlock.system_prompt || dataBlock.extensions?.system_prompt
                ) : (
                  <span className="text-slate-500 italic text-xs font-sans">Mặc định. Hệ thống sẽ sử dụng Lời nhắc chung (System Prompt) mặc định của trò chơi khi vận hành cuộc hội thoại.</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chỉ dẫn sau hội thoại (Post-History Prompt)</h3>
              <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 max-h-40 overflow-y-auto custom-scrollbar font-mono whitespace-pre-wrap">
                {(dataBlock.post_history_instructions || dataBlock.extensions?.post_history_instructions) ? (
                  dataBlock.post_history_instructions || dataBlock.extensions?.post_history_instructions
                ) : (
                  <span className="text-slate-500 italic text-xs font-sans">Trống (Không thiết đặt chỉ dẫn hậu kỳ).</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lorebook' && (
           <div className="text-sm text-slate-400 space-y-4">
              {lorebookSize > 0 ? (
                 <>
                   <p className="mb-4">Thẻ này có chứa <strong>{lorebookSize}</strong> mục Lorebook (World Info). Dữ liệu này sẽ tự động được sử dụng trong game.</p>
                   {characterBook.entries.map((entry: any, i: number) => (
                     <div key={i} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                       <h4 className="font-bold text-slate-200 mb-1">{entry.name || `Entry ${i + 1}`}</h4>
                       <p className="text-[10px] text-indigo-300 font-mono mb-2">Keys: {(entry.keys || []).join(', ')}</p>
                       <div className="text-sm text-slate-400 line-clamp-3">
                         {entry.content}
                       </div>
                     </div>
                   ))}
                 </>
              ) : (
                 <p>Thẻ này không có Lorebook đi kèm.</p>
              )}
           </div>
        )}

        {activeTab === 'regex' && (
           <div className="text-sm text-slate-400 space-y-4">
             {regexScripts.length > 0 && (
               <div className="flex flex-col gap-2 font-sans mb-3 text-slate-400">
                 <p className="text-xs">
                   Thẻ này chứa <strong>{regexScripts.length}</strong> Regex Scripts. Chọn kịch bản để AI tập trung gỡ lỗi và phân tích sâu:
                 </p>
                 <select
                   value={selectedScriptIndex}
                   onChange={(e) => handleScriptChange(Number(e.target.value))}
                   className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                 >
                   <option value={-1}>📋 TẤT CẢ KỊCH BẢN ({regexScripts.length})</option>
                   {regexScripts.map((s: any, idx: number) => (
                     <option key={idx} value={idx}>
                       {idx + 1}. {s.scriptName || s.name || `Script ${idx + 1}`} ({s.regex || s.findRegex || 'Chưa định nghĩa'})
                     </option>
                   ))}
                 </select>
               </div>
             )}
              {regexScripts.length > 0 ? (
                 <>

                    
                    {/* AI Debugger Sandbox Window */}
                    <div className="border border-indigo-500/30 bg-slate-950/40 rounded-xl p-4 space-y-3 shadow-lg relative overflow-hidden my-3" id="regex-chatbot-wrapper">
                      {/* Iframe ambient neon frame border effects */}
                      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
                      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />
                      
                      <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                        <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                          <Cpu className="animate-pulse" size={14} />
                          <span>AI Debugger iFrame - Regex</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest animate-pulse">
                            Sandbox Live
                          </span>
                          <button 
                            type="button"
                            onClick={() => {
                              setRegexAiChat([]);
                              askRegexAi("Hãy làm sạch bộ nhớ hoàn toàn. Hãy quét phân tích tổng quan toàn bộ danh sách kịch bản kịch bản Regex đính kèm ở thẻ nhân vật này và cho tôi biết có bất kỳ điểm rò rỉ hay lỗi cú pháp, logic nào không nhé.", true);
                            }}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Khởi chạy lại AI"
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Conversation History */}
                      <div className="overflow-y-auto mb-3 flex flex-col gap-3 max-h-[350px] p-3 bg-slate-950/80 rounded-lg border border-slate-900 scrollbar-thin">
                        {regexAiChat.length === 0 && !isRegexAiLoading && !regexAiError && (
                          <div className="text-center py-6 text-xs text-slate-500">
                            Hệ thống ảo đang hoạt động. Bạn có thể hỏi bất kỳ điều gì về kịch bản Regex của nhân vật.
                          </div>
                        )}

                        {regexAiChat.map((msg, index) => (
                          <div 
                            key={index} 
                            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                          >
                            <div className="text-[9px] text-slate-500 mb-0.5 font-mono uppercase tracking-widest px-1">
                              {msg.role === 'user' ? 'BẠN (USER)' : 'TRỢ LÝ AI'}
                            </div>
                            <div 
                              className={`rounded-xl p-3 text-xs leading-relaxed max-w-[95%] whitespace-pre-wrap ${
                                msg.role === 'user' 
                                  ? 'bg-slate-800 text-slate-100 border border-slate-700/50' 
                                  : 'bg-slate-900/80 text-slate-300 border border-slate-950 shadow-md font-sans'
                              }`}
                            >
                               <MarkdownRenderer content={msg.text} />
                            </div>
                          </div>
                        ))}

                        {isRegexAiLoading && (
                          <div className="flex flex-col items-start animate-pulse">
                            <div className="text-[9px] text-slate-500 mb-0.5 font-mono uppercase tracking-widest px-1">
                              TRỢ LÝ AI
                            </div>
                            <div className="bg-slate-900/60 text-slate-400 border border-slate-950 rounded-xl p-3 text-xs flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                              <span className="font-mono text-[10px] text-indigo-300">AI đang rà quét kịch bản...</span>
                            </div>
                          </div>
                        )}

                        {regexAiError && (
                          <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-300 text-xs rounded-lg flex items-start gap-2">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                            <span>⚠️ Có lỗi xảy ra: {regexAiError}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick action suggest panel */}
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <button 
                          type="button"
                          onClick={() => askRegexAi("Giải thích ngắn gọn cấu trúc và cách hoạt động của kịch bản Regex này.")}
                          className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2 py-1 rounded-lg transition-colors cursor-pointer font-medium"
                          disabled={isRegexAiLoading}
                        >
                          📋 Giải thích cấu trúc
                        </button>
                        <button 
                          type="button"
                          onClick={() => askRegexAi("Rà soát kịch bản này có lỗi cú pháp, rò rỉ mã hay lỗ hổng lặp vô hạn ReDoS nào không.")}
                          className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2 py-1 rounded-lg transition-colors cursor-pointer font-medium"
                          disabled={isRegexAiLoading}
                        >
                          🛡️ Quét lỗi & ReDoS
                        </button>
                        <button 
                          type="button"
                          onClick={() => askRegexAi("Hãy đề xuất giải pháp viết lại hoặc thay thế tối ưu nhất cho kịch bản Regex này.")}
                          className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 px-2 py-1 rounded-lg transition-colors cursor-pointer font-medium"
                          disabled={isRegexAiLoading}
                        >
                          💡 Đề xuất tối ưu hóa
                        </button>
                      </div>

                      {/* Input form */}
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          askRegexAi();
                        }}
                        className="flex gap-2"
                      >
                        <input 
                          type="text"
                          value={regexAiInput}
                          onChange={(e) => setRegexAiInput(e.target.value)}
                          placeholder="Đặt câu hỏi hoặc gõ yêu cầu gỡ lỗi kịch bản..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 font-mono"
                          disabled={isRegexAiLoading}
                        />
                        <button 
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                          disabled={isRegexAiLoading || !regexAiInput.trim()}
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </div>

                    {/* Original list of regexes */}
                    <div className="space-y-3 mt-4">
                       <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Danh sách kịch bản gốc</h4>
                       {regexScripts.map((script: any, i: number) => (
                         <div key={i} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 font-mono text-[10px] break-all">
                           <div className="flex justify-between items-center mb-1">
                             <span className="text-amber-400 font-bold">{script.scriptName || `Script ${i + 1}`}</span>
                             <span className={script.disabled ? "text-red-400" : "text-emerald-400"}>
                               {script.disabled ? "Khóa" : "Kích hoạt"}
                             </span>
                           </div>
                           <p className="text-slate-300 mt-1">Regex: <span className="text-indigo-300">{script.regex || script.findRegex}</span></p>
                           <p className="text-slate-300 mt-1">Thay thế: <span className="text-emerald-300">{script.replacementString || script.replacementText || script.replaceString || ""}</span></p>
                         </div>
                       ))}
                    </div>
                 </>
              ) : (
                 <p>Thẻ này không có Regex Scripts đi kèm để phân tích.</p>
              )}
           </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="flex-none p-4 bg-slate-950 border-t border-slate-800 flex flex-col gap-3">
         {character.lastPlayedAt && (
            <div className="text-[10px] flex items-center justify-center gap-1 text-slate-500 uppercase tracking-widest">
               <Calendar size={12} /> Lần chơi cuối: {new Date(character.lastPlayedAt).toLocaleString('vi-VN')}
            </div>
         )}
         <Button 
            variant="primary" 
            size="lg" 
            icon={<Play size={18} />} 
            onClick={() => onStart(greetingIndex)}
            className="w-full font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20"
         >
            Bắt Đầu Chơi
         </Button>
      </div>
    </div>
  );
};
