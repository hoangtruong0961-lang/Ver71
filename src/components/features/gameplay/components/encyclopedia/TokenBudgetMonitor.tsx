import React from 'react';
import { VectorData } from '../../../../../services/db/indexedDB';
import { BarChart3 } from 'lucide-react';
import { useAppStore } from '../../../../../store/appStore';

interface TokenBudgetMonitorProps {
  entries: VectorData[];
}

export const TokenBudgetMonitor: React.FC<TokenBudgetMonitorProps> = ({ entries }) => {
  const { activeWorld } = useAppStore();
  
  // Align with gameplay service (maxContextTokens represents the overall token budget)
  const totalBudget = activeWorld?.config?.contextConfig?.maxContextTokens || 60000;
  
  // Rough token estimation (3.5 chars per token for Latin/Vietnamese to align with service.ts)
  const estimateTokens = (text: string) => Math.ceil((text || '').length / 3.5);

  const characterCardStr = JSON.stringify(activeWorld?.player || {}) + JSON.stringify(activeWorld?.entities || {});
  const characterCard = estimateTokens(characterCardStr);

  const conversationStr = JSON.stringify(activeWorld?.savedState?.history || []);
  const conversation = estimateTokens(conversationStr);

  const alwaysEntries = entries
    .filter(e => e.isEnabled !== false && (e.triggerMode === 'always' || e.isSticky))
    .reduce((acc, e) => acc + estimateTokens(e.text || ''), 0);

  const triggeredPool = entries
    .filter(e => e.isEnabled !== false && e.triggerMode !== 'always' && !e.isSticky)
    .reduce((acc, e) => acc + estimateTokens(e.text || ''), 0);

  // We only count what is currently guaranteed to be injected:
  const totalUsed = characterCard + alwaysEntries + conversation;
  
  return (
    <div id="token-budget-monitor-root" className="flex flex-col h-full bg-slate-950/90 text-slate-100 border border-slate-800/60 rounded-xl overflow-hidden shadow-lg font-sans">
      <div className="px-3 py-2 border-b border-slate-850/50 bg-[#090f23] flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-black uppercase text-slate-400 flex items-center gap-1.5 tracking-widest leading-none">
          <BarChart3 size={12} className="text-sky-400" />
          Dung lượng Thư tịch (Tokens)
        </h3>
        <span className="text-[9px] font-mono text-sky-400 font-black bg-[#020617] px-1.5 py-0.5 rounded border border-slate-850/30 leading-none">{totalUsed.toLocaleString()} / {totalBudget.toLocaleString()}</span>
      </div>
      
      <div className="p-4 text-xs flex flex-col justify-center flex-1 gap-4">
        {/* Progress Bar with warm theme colors */}
        <div className="w-full h-3 bg-[#020617] rounded-full overflow-hidden flex border border-slate-850/50 shadow-inner relative select-none">
            <div style={{ width: `${Math.min((characterCard / totalBudget) * 100, 100)}%` }} className="bg-gradient-to-r from-red-650 to-red-500 h-full border-r border-[#16100c]/50" title="Character & Entities" />
            <div style={{ width: `${Math.min((alwaysEntries / totalBudget) * 100, 100)}%` }} className="bg-gradient-to-r from-[#c9a84c]/90 to-[#b09139]/80 h-full border-r border-[#16100c]/50" title="Always Active Entries" />
            <div style={{ width: `${Math.min((conversation / totalBudget) * 100, 100)}%` }} className="bg-gradient-to-r from-blue-700 to-blue-500 h-full" title="Chat Logs" />
        </div>

        {/* Legend metrics */}
        <div className="flex flex-col gap-1.5 text-[9px] font-mono text-slate-400 font-bold overflow-y-auto max-h-[140px] custom-scrollbar pr-1">
            <div className="flex justify-between items-center bg-[#020617]/50 px-2 py-1.5 border border-slate-850/15 rounded">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-red-500"></span> Bản thể nhân vật</span> 
              <span className="font-bold text-slate-100">{characterCard.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-[#020617]/50 px-2 py-1.5 border border-slate-850/15 rounded">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.35)]"></span> Luôn Kích hoạt</span> 
              <span className="font-bold text-slate-100">{alwaysEntries.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-[#020617]/50 px-2 py-1.5 border border-slate-850/15 rounded">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-blue-550"></span> Nhật ký tấu thoại</span> 
              <span className="font-bold text-slate-100">{conversation.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-[#020617]/50 px-2 py-1.5 border border-dashed border-slate-800/60 rounded" title="Dữ kiện dã thiết tiềm ẩn, chỉ được thắp sấy khi có tương đồng">
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full min-w-[8px] bg-transparent border border-slate-800/80"></span> Cảm biến Chờ kích thắp</span> 
               <span className="font-bold text-sky-400/70">{triggeredPool.toLocaleString()}</span>
            </div>
        </div>
      </div>
    </div>
  );
};
