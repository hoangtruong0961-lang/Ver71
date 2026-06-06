
import React from 'react';
import { Database } from 'lucide-react';
import { useDatabaseStatus } from '../../../hooks/useDatabaseStatus';

const StatusFooter: React.FC = () => {
  const { status } = useDatabaseStatus();
  const GAME_VERSION = "v0.4.7 Alpha";

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500 shadow-[0_0_8px_#22c55e]';
      case 'error': return 'bg-red-500 shadow-[0_0_8px_#ef4444]';
      default: return 'bg-yellow-500 shadow-[0_0_8px_#eab308]';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Hoạt động';
      case 'error': return 'Lỗi kết nối';
      default: return 'Đang khởi tạo...';
    }
  };

  return (
    <footer className="w-full py-3 px-4 md:px-6 border-t border-stone-400 dark:border-slate-800/50 bg-stone-300/80 dark:bg-black/60 backdrop-blur-md flex justify-between items-center text-[10px] md:text-xs text-stone-500 font-mono z-50 shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 group cursor-help select-none" title={`Trạng thái DB: ${getStatusText()}`}>
          <Database size={12} className="md:w-3.5 md:h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="hidden sm:inline">Database:</span>
          <span>IndexedDB</span>
          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors duration-500 ${getStatusColor()}`} />
        </div>
      </div>

      <div className="opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap">
        {GAME_VERSION}
      </div>
    </footer>
  );
};

export default StatusFooter;
