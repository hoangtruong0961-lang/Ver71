import React from 'react';
import { Menu, Clock } from 'lucide-react';
import { WorldData, GameTime } from '../../../types';
import { formatGameTime } from '../../../utils/timeUtils';
import { DynamicHUD } from './components/DynamicHUD';

interface GameplayHUDProps {
    activeWorld?: WorldData | null;
    turnCount: number;
    gameTime: GameTime;
    setShowMobileSidebar: any;
}

export const GameplayHUD: React.FC<GameplayHUDProps> = ({ activeWorld, turnCount, gameTime, setShowMobileSidebar }) => {
    return (
        <>
            <header className="h-14 md:h-16 shrink-0 bg-stone-300 dark:bg-[#090f1d] border-b border-stone-400/20 dark:border-slate-800/10 flex items-center justify-center relative px-4 z-30 shadow-md">
                 <button 
                    className="absolute left-4 text-stone-600 dark:text-slate-300 btn-click neu-btn p-2 rounded-xl border-none font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                    onClick={() => setShowMobileSidebar((prev: boolean) => !prev)}
                    title="Bật/Tắt Bản Tin Cốt Truyện"
                 >
                     <Menu size={16} />
                     <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider font-mono">Bản Tin</span>
                 </button>
                 <div className="flex flex-col items-center">
                     <h1 className="font-extrabold text-stone-800 dark:text-slate-200 text-xs md:text-sm tracking-widest leading-tight font-mono truncate max-w-[180px] md:max-w-none">
                         {activeWorld?.world?.worldName || "Thế giới vô danh"}
                     </h1>
                     <div className="mt-1 flex items-center gap-2">
                         <span className="text-[9px] md:text-[10px] font-mono font-bold text-mystic-accent neu-sm-inset px-2.5 py-1 rounded-full border-none leading-none shadow-inner">
                             Lượt: {turnCount}
                         </span>
                         <span className="text-[9px] md:text-[10px] font-mono font-bold text-emerald-500 neu-sm-inset px-2.5 py-1 rounded-full border-none flex items-center gap-1 leading-none shadow-inner">
                             <Clock size={8} className="md:size-2.5" />
                             {formatGameTime(gameTime)}
                         </span>
                     </div>
                 </div>
            </header>

            <DynamicHUD worldData={activeWorld} gameTime={gameTime} turnCount={turnCount} />
        </>
    );
};
