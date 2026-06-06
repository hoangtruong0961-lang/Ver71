import React, { useState, useMemo, useEffect } from 'react';
import { VectorData } from '../../../../../services/db/indexedDB';
import { ShieldAlert, Search, Loader2, Link2, BrainCircuit, Pin } from 'lucide-react';
import { useAppStore } from '../../../../../store/appStore';
import { vectorService } from '../../../../../services/ai/vectorService';

interface TriggerDebuggerProps {
  entries: VectorData[];
}

export const TriggerDebugger: React.FC<TriggerDebuggerProps> = ({ entries }) => {
  const [testText, setTestText] = useState('');
  const [semanticMatches, setSemanticMatches] = useState<{id: string, score: number}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { settings } = useAppStore();

  useEffect(() => {
      const timer = setTimeout(() => {
          if (!testText.trim()) {
              setSemanticMatches([]);
              setIsSearching(false);
              return;
          }
          
          setIsSearching(true);
          (async () => {
              try {
                  const queryEmbedding = await vectorService.getEmbedding(testText, settings);
                  if (queryEmbedding) {
                      const matches: {id: string, score: number}[] = [];
                      for (const e of entries) {
                          if (e.isEnabled === false || !e.embedding) continue;
                          if (e.triggerMode === 'semantic' || e.triggerMode === 'hybrid') {
                             const similarity = vectorService.cosineSimilarity(queryEmbedding, e.embedding);
                             // Threshold based on Engine configs (0.35 in vectorService)
                             if (similarity > 0.35) {
                                 matches.push({ id: e.id, score: similarity });
                             }
                          }
                      }
                      setSemanticMatches(matches);
                  }
              } catch (err) {
                  console.error("Semantic debugger failed", err);
              } finally {
                  setIsSearching(false);
              }
          })();
      }, 600); // 600ms debounce
      
      return () => clearTimeout(timer);
  }, [testText, entries, settings]);

  const triggeredEntriesDetails = useMemo(() => {
      if (!testText.trim()) return [];
      
      const results: { entry: VectorData, type: 'always' | 'keyword' | 'semantic' | 'hybrid', reason: string, detail: string }[] = [];
      const lowerText = testText.toLowerCase();

      for (const e of entries) {
          if (e.isEnabled === false) continue;
          
          if (e.triggerMode === 'always' || e.isSticky) {
              results.push({ entry: e, type: 'always', reason: 'Always / Sticky', detail: 'Được ghim thủ công hoặc cài đặt luôn kích hoạt.' });
              continue;
          }
          
          let isKwMatch = false;
          let matchedKw = '';
          if (e.triggerMode === 'keyword' || e.triggerMode === 'hybrid' || !e.triggerMode) {
              const kwToTest = e.keywords && e.keywords.length > 0 ? e.keywords : (e.keyword ? [e.keyword] : []);
              const found = kwToTest.find(k => lowerText.includes(String(k).toLowerCase()));
              if (found) {
                  isKwMatch = true;
                  matchedKw = found;
              }
          }
          
          let isSemMatch = false;
          let semScore = 0;
          if (e.triggerMode === 'semantic' || e.triggerMode === 'hybrid') {
              const match = semanticMatches.find(m => m.id === e.id);
              if (match) {
                  isSemMatch = true;
                  semScore = match.score;
              }
          }
          
          if (isKwMatch && isSemMatch) {
              results.push({ entry: e, type: 'hybrid', reason: 'Hybrid', detail: `Từ khóa: "${matchedKw}" | Semantic: ${(semScore * 100).toFixed(1)}%` });
          } else if (isKwMatch) {
              results.push({ entry: e, type: 'keyword', reason: 'Keyword', detail: `Tìm thấy từ khóa: "${matchedKw}"` });
          } else if (isSemMatch) {
              results.push({ entry: e, type: 'semantic', reason: 'Semantic', detail: `Độ tương đồng ngữ nghĩa: ${(semScore * 100).toFixed(1)}%` });
          }
      }
      
      // Sort by Priority (high first), then logic
      return results.sort((a, b) => (b.entry.priority || 0) - (a.entry.priority || 0));
  }, [testText, entries, semanticMatches]);

  const getReasonIcon = (type: string) => {
      switch(type) {
          case 'always': return <Pin size={12} className="text-stone-500" />;
          case 'keyword': return <Link2 size={12} className="text-blue-500" />;
          case 'semantic': return <BrainCircuit size={12} className="text-indigo-500" />;
          case 'hybrid': return <ShieldAlert size={12} className="text-emerald-500" />;
          default: return <Search size={12} />;
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/90 text-slate-100 shadow-xl rounded-xl border border-slate-800/60">
      <div className="p-3 flex flex-col h-full gap-3">
         <div className="relative shrink-0">
             <input 
                 value={testText}
                 onChange={e => setTestText(e.target.value)}
                 placeholder='Test: "Tôi đến Eldoria gặp Aria"'
                 className="w-full pl-9 pr-3 py-2.5 bg-[#020617] border border-slate-850/50 focus:border-sky-500/80 rounded-xl text-slate-100 text-xs outline-none font-medium transition-colors"
             />
             {isSearching ? (
                 <Loader2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400 animate-spin" />
             ) : (
                 <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400/50" />
             )}
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            {testText.length > 0 ? (
                <div className="space-y-3">
                    <div className="text-sky-400 font-bold flex items-center gap-1.5 text-xs">
                        <ShieldAlert size={14}/> {isSearching ? 'Đang phân giải logic...' : `Đã kích hoạt (${triggeredEntriesDetails.length})`}
                    </div>
                    {triggeredEntriesDetails.length > 0 ? (
                        <div className="flex flex-col gap-2">
                           {triggeredEntriesDetails.map((item, idx) => (
                               <div key={item.entry.id + '_' + idx} className="bg-[#020617]/60 border border-slate-850/30 rounded-lg p-2.5 flex flex-col gap-1.5">
                                   <div className="flex justify-between items-start gap-2">
                                       <span className="font-bold text-slate-100 uppercase text-[11px] truncate flex items-center gap-1">
                                           {getReasonIcon(item.type)} {item.entry.title || item.entry.keyword}
                                       </span>
                                       <span className="text-[10px] font-black text-slate-400">
                                           PRI: {item.entry.priority || 0}
                                       </span>
                                   </div>
                                   <div className="flex items-center gap-2 text-[10px]">
                                       <span className={`px-1.5 py-0.5 rounded uppercase font-bold border ${
                                           item.type === 'always' ? 'bg-slate-950 text-slate-100 border-slate-800/80' :
                                           item.type === 'keyword' ? 'bg-blue-900/30 text-blue-400 border-blue-800/30' :
                                           item.type === 'semantic' ? 'bg-sky-500/10 text-sky-400 border-slate-800/60' :
                                           'bg-emerald-950/30 text-emerald-400 border-emerald-800/30'
                                       }`}>
                                           {item.reason}
                                       </span>
                                       <span className="text-slate-400 font-mono truncate">{item.detail}</span>
                                   </div>
                                </div>
                           ))}
                        </div>
                    ) : !isSearching && (
                        <div className="text-slate-400 text-xs bg-[#020617]/40 p-4 rounded-lg border border-slate-850/30 text-center">
                            Không phân giải được module nào từ đoạn văn bản trên.
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <ShieldAlert size={32} className="text-sky-500/20 mb-2" />
                    <div className="text-slate-100 font-medium text-xs">Visual Trigger Editor</div>
                    <div className="text-slate-400 text-[10px] mt-1 max-w-[200px]">
                        Nhập văn bản test để phân giải logic kích hoạt (Keyword, Semantic, Hybrid).
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

