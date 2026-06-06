import React, { useState, useEffect, useMemo } from 'react';
import { VectorData } from '../../../../../services/db/indexedDB';
import { BrainCircuit, Search, Loader2, Info, ChevronRight, Check, Star, Filter, Heart, Flag, MapPin, User, Package, Scale, Globe, Calendar } from 'lucide-react';
import { useAppStore } from '../../../../../store/appStore';
import { vectorService } from '../../../../../services/ai/vectorService';

interface MetadataRetrievalDebuggerProps {
  entries: VectorData[];
}

const CATEGORY_MAP: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  character: {
    label: "Nhân vật",
    color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/10",
    icon: User,
  },
  location: {
    label: "Địa điểm",
    color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/10",
    icon: MapPin,
  },
  faction: {
    label: "Thế lực",
    color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800/10",
    icon: Flag,
  },
  item: {
    label: "Vật phẩm",
    color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/10",
    icon: Package,
  },
  relationship: {
    label: "Mối quan hệ",
    color: "text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800/10",
    icon: Heart,
  },
  event: {
    label: "Sự kiện",
    color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800/10",
    icon: Calendar,
  },
  law: {
    label: "Luật lệ",
    color: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/10",
    icon: Scale,
  },
  rule: {
    label: "Luật lệ",
    color: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/10",
    icon: Scale,
  },
  world: {
    label: "Thế giới",
    color: "text-stone-600 bg-stone-100 dark:text-stone-400 dark:bg-stone-800/30 border-stone-300 dark:border-stone-700/10",
    icon: Globe,
  },
};

export const MetadataRetrievalDebugger: React.FC<MetadataRetrievalDebuggerProps> = ({ entries }) => {
  const [testText, setTestText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticMatches, setSemanticMatches] = useState<{ id: string; score: number }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { settings } = useAppStore();

  const activeIntents = useMemo(() => {
    const categories = new Set<string>();
    const lower = testText.toLowerCase();

    if (!testText.trim()) return [];

    if (/ai|nhân vật|người|hắn|nó|cô|anh|ông|bà|npc|tên|gặp|nói|hỏi|chào|player|char|character/i.test(lower)) {
      categories.add('character');
    }
    if (/đến|ở|tại|vào|đi|đâu|nơi|địa điểm|vùng|rừng|thành|phố|quán|vương quốc|đại lục|level|location|map|place|area/i.test(lower)) {
      categories.add('location');
    }
    if (/nhặt|mở|hộp|kiếm|vũ khí|vật phẩm|trang bị|sử dụng|thuốc|bình|đồ|item|weapon|equip|gear/i.test(lower)) {
      categories.add('item');
    }
    if (/phe|đối lập|băng|nhóm|gia tộc|thế lực|liên minh|quân|quốc gia|đảng|faction|guild|clan|nation/i.test(lower)) {
      categories.add('faction');
    }
    if (/yêu|ghét|quen|biết|bạn|thù|quan hệ|tình cảm|vợ|chồng|bố|mẹ|con|relationship|friend|enemy/i.test(lower)) {
      categories.add('relationship');
    }
    if (/khi|lúc|sau khi|trận|cuộc chiến|chiến đấu|lễ hội|sự kiện|biến cố|xảy ra|event|incident|happen/i.test(lower)) {
      categories.add('event');
    }
    if (/luật|lệ|quy tắc|hệ thống|chỉ số|sức mạnh|giới hạn|skill|chiêu|damage|hp|mp|law|rule|system|mechanic/i.test(lower)) {
      categories.add('rule');
    }
    if (/thế giới|vũ trụ|lịch sử|truyền thuyết|thần thoại|bối cảnh|world|universe|history|lore/i.test(lower)) {
      categories.add('world');
    }

    return Array.from(categories);
  }, [testText]);

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
            const matches: { id: string; score: number }[] = [];
            for (const e of entries) {
              if (e.isEnabled === false || !e.embedding) continue;
              if (e.triggerMode === 'semantic' || e.triggerMode === 'hybrid') {
                const similarity = vectorService.cosineSimilarity(queryEmbedding, e.embedding);
                // Matches standard threshold
                if (similarity > 0.15) {
                  matches.push({ id: e.id, score: similarity });
                }
              }
            }
            setSemanticMatches(matches);
          }
        } catch (err) {
          console.error("Embedding lookup failure in metadata visualizer:", err);
        } finally {
          setIsSearching(false);
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
  }, [testText, entries, settings]);

  const scoredResults = useMemo(() => {
    if (!testText.trim()) return [];

    const lowerScan = testText.toLowerCase();
    const results = [];

    for (const e of entries) {
      if (e.isEnabled === false) continue;

      let isKeywordMatched = false;
      const matchedKwList: string[] = [];
      let semanticScore = 0;
      let isSemanticMatched = false;
      let baseScore = 0;

      // 1. Keyword check
      const kws = e.keywords && e.keywords.length > 0 ? e.keywords : [e.keyword || e.title || ''];
      for (const k of kws) {
        if (k && lowerScan.includes(k.toLowerCase())) {
          isKeywordMatched = true;
          matchedKwList.push(k);
        }
      }

      // 2. Semantic vector similarity check
      const match = semanticMatches.find(m => m.id === e.id);
      if (match) {
        semanticScore = match.score;
        if (semanticScore > 0.35) {
          isSemanticMatched = true;
        }
      }

      // 3. Evaluate criteria based on trigger mode
      let activated = false;
      const tMode = e.triggerMode || 'semantic';
      if (tMode === 'always') {
        activated = true;
        baseScore = 0.82;
      } else if (tMode === 'keyword') {
        activated = isKeywordMatched;
        baseScore = isKeywordMatched ? 0.75 : 0;
      } else if (tMode === 'semantic') {
        activated = isSemanticMatched;
        baseScore = isSemanticMatched ? semanticScore : 0;
      } else if (tMode === 'hybrid') {
        activated = isKeywordMatched || isSemanticMatched;
        baseScore = isKeywordMatched 
          ? Math.max(0.75, semanticScore) 
          : (isSemanticMatched ? semanticScore : 0);
      }

      if (!activated) continue;

      // 4. Metadata-Aware Boosting
      let finalScore = baseScore;
      const boosts: string[] = [];
      let categoryMatched = false;

      // Category match boost
      const itemCat = e.category || 'world';
      if (activeIntents.includes(itemCat)) {
        categoryMatched = true;
        finalScore *= 1.25;
        boosts.push(`Khớp danh mục (${itemCat}): x1.25`);
      }

      // Tag overlap boost
      const matchedTags: string[] = [];
      if (e.tags && e.tags.length > 0) {
        for (const tag of e.tags) {
          if (lowerScan.includes(tag.toLowerCase())) {
            matchedTags.push(tag);
          }
        }
        if (matchedTags.length > 0) {
          finalScore += matchedTags.length * 0.05;
          boosts.push(`Thẻ khớp (${matchedTags.join(', ')}): +${(matchedTags.length * 0.05).toFixed(2)}`);
        }
      }

      // Priority boost
      const priority = e.priority ?? 50;
      const priorityBoost = (priority / 100) * 0.15;
      finalScore += priorityBoost;
      boosts.push(`Ưu tiên (hạng ${priority}): +${priorityBoost.toFixed(2)}`);

      // Cooldown Sticky
      if (e.isSticky) {
        finalScore *= 1.5;
        boosts.push(`Trạng thái Sticky: x1.5`);
      }

      results.push({
        entry: e,
        baseScore: Math.round(baseScore * 1000) / 1000,
        finalScore: Math.round(finalScore * 1000) / 1000,
        boosts,
        categoryMatched,
        matchedTags,
        matchedKwList,
        triggerReason: tMode,
      });
    }

    return results.sort((a, b) => b.finalScore - a.finalScore);
  }, [testText, entries, semanticMatches, activeIntents]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/90 text-slate-100 border border-slate-800/60 rounded-xl overflow-hidden shadow-lg">
      <div className="px-3 py-2 border-b border-slate-850/50 bg-[#090f23] flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-1.5 tracking-widest leading-none">
          <BrainCircuit size={14} className="text-sky-400" />
          Metadata-Aware Retrieval Tracker
        </h3>
        <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-850/50 leading-none">Active</span>
      </div>

      <div className="p-3 flex flex-col flex-1 gap-3 overflow-hidden bg-[#020617]/30">
        {/* Test Simulator input */}
        <div className="relative shrink-0">
          <input
            value={testText}
            onChange={e => setTestText(e.target.value)}
            placeholder='Test: "Gặp Aria tại đại lục Eldoria để học Pháp Thuật"'
            className="w-full pl-9 pr-3 py-2.5 bg-[#020617] border border-slate-850/50 focus:border-sky-500/80 rounded-xl text-slate-100 text-xs outline-none font-medium transition-colors"
          />
          {isSearching ? (
            <Loader2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400 animate-spin" />
          ) : (
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400/50" />
          )}
        </div>

        {/* Dynamic Category/Intent insights */}
        {testText.trim().length > 0 && (
          <div className="p-2 bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.35)]/5 rounded-xl border border-slate-850/50 text-[10px] space-y-1 shrink-0">
            <div className="text-slate-400 font-bold uppercase tracking-wider">Đặc trưng truy vấn trích xuất:</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeIntents.length > 0 ? (
                activeIntents.map(intent => {
                  const map = CATEGORY_MAP[intent] || { label: intent, color: 'text-slate-400 bg-[#020617]', icon: Info };
                  return (
                    <span key={intent} className={`px-2 py-0.5 rounded-md border flex items-center gap-1 font-bold text-[9px] uppercase bg-[#020617] text-slate-100 border-slate-850/50`}>
                      {React.createElement(map.icon, { size: 10 })}
                      {map.label} (BOOST)
                    </span>
                  );
                })
              ) : (
                <span className="text-slate-400 italic">Chưa phát hiện ý định đặc trưng. Sẽ sử dụng phân tích từ khóa và vector thuần.</span>
              )}
            </div>
          </div>
        )}

        {/* Results Stream list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-0.5">
          {testText.trim().length > 0 ? (
            scoredResults.length > 0 ? (
              scoredResults.map(({ entry, baseScore, finalScore, boosts, categoryMatched }) => {
                const isExpanded = expandedId === entry.id;
                const map = CATEGORY_MAP[entry.category || 'world'] || { label: 'Thế giới', color: 'text-slate-400 bg-[#020617]', icon: Globe };

                // Percentage calculate for UI visual bar
                const barWidth = Math.min(100, Math.round(finalScore * 100));

                return (
                  <div key={entry.id} className="border border-slate-850/30 rounded-xl bg-slate-950/45 overflow-hidden transition-all">
                    {/* Collapsed view */}
                    <div
                      onClick={() => toggleExpand(entry.id)}
                      className="p-2.5 cursor-pointer hover:bg-slate-950/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-xs truncate uppercase tracking-tight">
                            {entry.keyword || entry.title}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded border text-[8px] font-black uppercase tracking-wider whitespace-nowrap scale-90 origin-left bg-[#020617] text-sky-400 border-slate-850/50`}>
                            {map.label}
                          </span>
                        </div>
                        {/* Score bar */}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[#020617] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.35)]`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="font-mono text-[9px] font-bold text-slate-100">
                            {(finalScore * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={14} className={`text-sky-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>

                    {/* Expanded audit accordion */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-850/30 text-[10px] space-y-2 bg-[#020617]/40 font-mono text-slate-400">
                        {/* Summary fact */}
                        <div className="p-1 px-1.5 bg-[#020617]/80 rounded border border-slate-850/30 max-h-16 overflow-y-auto italic line-clamp-2 text-slate-400 text-[9px] leading-relaxed">
                          "{entry.text}"
                        </div>
                        
                        {/* Mathematics Trace */}
                        <div>
                          <div className="font-bold text-slate-100 text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Star size={10} className="text-sky-400" />
                            Nhật ký Phân giải Score:
                          </div>
                          <div className="space-y-1 pl-3 font-medium text-[9px]">
                            <div className="flex justify-between border-b border-dashed border-slate-850/15 pb-0.5">
                              <span>Match gốc (Trigger: {entry.triggerMode || 'hybrid'}):</span>
                              <span className="font-bold text-slate-100">{(baseScore * 100).toFixed(1)}%</span>
                            </div>
                            {boosts.map((boost, idx) => (
                              <div key={idx} className="flex justify-between text-sky-400 border-b border-dashed border-slate-850/15 pb-0.5">
                                <span>↳ {boost.split(":")[0]}</span>
                                <span className="font-bold">{boost.split(":")[1]?.trim()}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-1 font-bold text-slate-100">
                              <span>Tổng kết quả:</span>
                              <span className="text-sky-400">{(finalScore * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Trigger properties */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[9px]">
                          <div className="bg-[#020617] p-1.5 rounded flex items-center justify-between border border-slate-850/30">
                            <span className="text-slate-400">Category Match:</span>
                            <span className={`font-bold ${categoryMatched ? 'text-sky-400' : 'text-slate-400'}`}>
                              {categoryMatched ? 'KHỚP (BOOSTED)' : 'KHÔNG KHỚP'}
                            </span>
                          </div>
                          <div className="bg-[#020617] p-1.5 rounded flex items-center justify-between border border-slate-850/30">
                            <span className="text-slate-400">Trigger Mode:</span>
                            <span className="font-bold text-slate-100 uppercase">{entry.triggerMode || 'hybrid'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-slate-400 bg-[#020617]/60 p-8 rounded-xl border border-slate-850/30 text-center text-xs opacity-80">
                Không tìm thấy dữ kiện nào phù hợp qua bộ lọc Metadata-Aware hiện tại.
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-75">
              <BrainCircuit size={40} className="text-sky-400/40 mb-3 animate-pulse" />
              <div className="text-slate-100 font-bold text-xs uppercase tracking-wider">Mô phỏng Metadata-Aware</div>
              <div className="text-slate-400 text-[10px] mt-1.5 max-w-[240px] leading-relaxed">
                Nhập văn bản giả lập tin nhắn chat ở trên để xem trực quan thuật toán chiết tách ý định (Query Intent Classifier) và quá trình chấm điểm, nhân hệ số boost thông minh của AI Studio.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
