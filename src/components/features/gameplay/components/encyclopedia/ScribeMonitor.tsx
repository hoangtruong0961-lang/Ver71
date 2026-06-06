import React from 'react';
import { VectorData } from '../../../../../services/db/indexedDB';
import { Database, Filter, Search, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';

interface ScribeMonitorProps {
  entries: VectorData[];
}

export const ScribeMonitor: React.FC<ScribeMonitorProps> = ({ entries }) => {
  const histories = entries.flatMap(e => (e.updateHistory || []).filter(h => h && h.content && typeof h.content === 'string' && !h.content.startsWith('__METADATA__')).map(h => ({
      ...h,
      keyword: e.keyword,
      category: e.category,
      entryId: e.id,
  }))).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50); // top 50 recent events

  return (
    <div className="flex flex-col h-full bg-slate-950/90 text-slate-100 border border-slate-800/60 rounded-xl overflow-hidden shadow-lg">
      <div className="px-3 py-2 border-b border-slate-850/50 bg-[#090f23] flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-1.5 tracking-widest leading-none">
          <Cpu size={14} className="text-sky-400" />
          Scribe Monitor
        </h3>
        <div className="flex gap-2">
            <button className="text-[10px] px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-slate-800/60 font-bold rounded transition-colors hidden sm:block leading-none">Active</button>
        </div>
      </div>
      <div className="p-3 text-[11px] overflow-y-auto flex-1 font-mono text-slate-400 space-y-2 custom-scrollbar bg-[#020617]/40">
        {histories.length > 0 ? histories.map((h, i) => (
             <div key={i} className="flex items-start gap-2 bg-slate-950/60 p-2 rounded border border-slate-850/30">
             <span className="text-sky-400/50 font-bold whitespace-nowrap mt-0.5">[{new Date(h.timestamp).toLocaleTimeString()}]</span>
             <div className="flex flex-col">
                 <span className="text-sky-400 font-bold">{h.keyword || 'Không tên'}</span>
                 <span className="text-slate-200/85 font-medium leading-relaxed line-clamp-2">
                     {h.content}
                 </span>
             </div>
         </div>
        )) : (
            <div className="flex flex-col items-center justify-center h-full opacity-60 py-12">
                <CheckCircle size={24} className="mb-2 text-slate-500/50" />
                <span>Chưa có hoạt động Scribe nào.</span>
            </div>
        )}
      </div>
    </div>
  );
};
