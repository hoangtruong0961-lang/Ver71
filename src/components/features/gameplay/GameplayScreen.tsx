import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Eye, EyeOff, BookOpen, Settings } from 'lucide-react';
import { NavigationProps, GameState } from '../../../types';
import Button from '../../ui/Button';
import GameInput from './components/GameInput';
import { GameplaySidebar } from './GameplaySidebar';
import { GameplayChatArea } from './GameplayChatArea';
import { GameplayHUD } from './GameplayHUD';
import { GameplayModals } from './GameplayModals';
import { useGameplayCore } from './hooks/useGameplayCore';
import { dbService } from '../../../services/db/indexedDB';

const GameplayScreen: React.FC<NavigationProps> = ({ onNavigate, activeWorld, onUpdateWorld }) => {
  const core = useGameplayCore({ onNavigate, activeWorld, onUpdateWorld });
  const [showRuleModal, setShowRuleModal] = React.useState(false);
  const MESSAGES_PER_PAGE = 10;

  const lastScrollTopRef = React.useRef(0);
  const [areBarsHidden, setAreBarsHidden] = React.useState(false);
  const [autoHideBars, setAutoHideBars] = React.useState(() => {
    const saved = dbService.getKeyValueSync('ark_hud_autohide_bars');
    if (saved !== undefined && saved !== null) {
      return saved === true || saved === 'true';
    }
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // Default to true on mobile devices
    }
    return false;
  });

  // Instantly show bars back if loading status starts (to let user see AI generation / token monitors)
  React.useEffect(() => {
    if (core.isLoading) {
      setAreBarsHidden(false);
    }
  }, [core.isLoading]);

  const customHandleScroll = () => {
    core.handleScroll();

    if (core.scrollViewportRef.current) {
      const { scrollTop } = core.scrollViewportRef.current;
      const delta = scrollTop - lastScrollTopRef.current;

      if (autoHideBars) {
        if (delta > 15 && scrollTop > 60) {
          // Scrolling down, auto hide
          setAreBarsHidden(true);
        } else if (delta < -15) {
          // Scrolling up, show bars
          setAreBarsHidden(false);
        }
      }

      lastScrollTopRef.current = scrollTop;
    }
  };

  // Auto-open sidebar on wide screens on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      core.setShowMobileSidebar(true);
    }
  }, []);

  const {
      isLoading, history, lastAction, turnCount, settings, gameTime, setGameTime,
      isDead, setIsDead,
      showCharModal, showGlobalModal, showHistoryModal, showContextModal,
      showImageLibrary, showLogConsole, showRegexModal, showCalendarModal,
      setShowCharModal, setShowGlobalModal, setShowHistoryModal, setShowContextModal,
      setShowImageLibrary, setShowLogConsole, setShowRegexModal, setShowCalendarModal, showMobileSidebar, setShowMobileSidebar,
      showStoryDebugModal, setShowStoryDebugModal, selectedDebugMessageIndex, setSelectedDebugMessageIndex,
      isInputCollapsed, setIsInputCollapsed, currentPage, setCurrentPage,
      isSaving, scrollViewportRef, chatEndRef, handleScroll, scrollToTop, scrollToBottom,
      totalPages, displayedMessages, startIndex, handleSend, handleRegenerate, stopStreamGeneration,
      handleSwipe, handleMessageUpdate, handleToggleHideMessage, handleEntityClick, handleManualSave,
      handleGoToSettings, handleExit, toggleStreamResponse, handleTawaConfigChange,
      isMobile, AIMonitor, combinedRegexScripts,
      selectingAvatarFor, setSelectingAvatarFor, handleAvatarSelect,
      showTokenDetails, showStatsDetails, setShowTokenDetails, setShowStatsDetails,
      activeContextTab, setActiveContextTab, selectedEntity, setSelectedEntity,
      autosaveList, manualSaveList, initialSaveList, activeSaveTab, setActiveSaveTab,
      loadSaveLists, handleDeleteSave, handleLoadSave, handleUpdateContextConfig,
      tokenHistory, totalTokens, lastTurnTotalTime, currentProcessingTime,
      lsrTables, lsrRuntimeData, handleUpdateLsrData, activeLsrTableId, setActiveLsrTableId, lsrViewMode, setLsrViewMode,
      tavoSelectState, setTavoSelectState, tawaPresetConfig, gameInputRef,
      isTavernHelperReady,
      dynamicRules, setDynamicRules,

      // Fate Encounter Roll States
      fateSettings,
      showFateSettingsModal,
      setShowFateSettingsModal,
      showFateRollModal,
      setShowFateRollModal,
      pendingActionText,
      handleUpdateFateSettings
  } = core;

  const renderSidebarContent = () => {
    return (
        <GameplaySidebar 
            activeWorld={activeWorld}
            history={history}
            MESSAGES_PER_PAGE={MESSAGES_PER_PAGE}
            setShowCharModal={setShowCharModal}
            setShowGlobalModal={setShowGlobalModal}
            setShowHistoryModal={setShowHistoryModal}
            setShowImageLibrary={setShowImageLibrary}
            setShowLogConsole={setShowLogConsole}
            setShowContextModal={(v) => {
                setShowContextModal(v);
                if (v && isMobile) {
                    setShowMobileSidebar(false);
                }
            }}
            showRuleModal={showRuleModal}
            setShowRuleModal={(v) => {
                setShowRuleModal(v);
                if (v && isMobile) {
                    setShowMobileSidebar(false);
                }
            }}
            setShowRegexModal={setShowRegexModal}
            setShowCalendarModal={setShowCalendarModal}
            setShowStoryDebugModal={setShowStoryDebugModal}
            setShowFateSettingsModal={setShowFateSettingsModal}
            isInputCollapsed={isInputCollapsed}
            setIsInputCollapsed={setIsInputCollapsed}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            scrollToTop={scrollToTop}
            scrollToBottom={scrollToBottom}
            settings={settings}
            toggleStreamResponse={toggleStreamResponse}
            onUpdateWorld={onUpdateWorld}
            handleTawaConfigChange={handleTawaConfigChange}
            isLoading={isLoading}
            handleRegenerate={handleRegenerate}
            handleGoToSettings={handleGoToSettings}
            handleManualSave={handleManualSave}
            isSaving={isSaving}
            handleExit={handleExit}
            AIMonitor={AIMonitor}
            handleUpdateContextConfig={handleUpdateContextConfig}
            turnCount={turnCount}
            tawaPresetConfig={tawaPresetConfig}
            gameTime={gameTime}
            lastAction={lastAction}
            dynamicRules={dynamicRules}
            setDynamicRules={setDynamicRules}
        />
    );
  };

  // --- RENDER ---
  if (!activeWorld) return null;

  const lastMessage = history[history.length - 1];
  const activeChoices = (lastMessage?.role === 'model' && lastMessage.choices) ? lastMessage.choices : [];

  return (
    <div className="flex h-full w-full bg-stone-300 dark:bg-[#090f1d] font-sans overflow-hidden relative">
        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col h-full relative z-10 min-w-0">
            {/* Collapsible Top Bar with bouncy dynamics */}
            <motion.div
                animate={{ 
                    y: areBarsHidden ? '-100%' : 0, 
                    height: areBarsHidden ? 0 : 'auto',
                    opacity: areBarsHidden ? 0 : 1,
                }}
                transition={{ type: 'spring', damping: 24, stiffness: 180 }}
                className="relative z-30 w-full shrink-0 overflow-hidden"
            >
                <GameplayHUD 
                    activeWorld={activeWorld} 
                    turnCount={turnCount} 
                    gameTime={gameTime} 
                    setShowMobileSidebar={setShowMobileSidebar} 
                />
            </motion.div>

            <GameplayChatArea
                scrollViewportRef={scrollViewportRef}
                chatEndRef={chatEndRef}
                handleScroll={customHandleScroll}
                displayedMessages={displayedMessages}
                startIndex={startIndex}
                history={history}
                isLoading={isLoading}
                combinedRegexScripts={combinedRegexScripts}
                activeWorld={activeWorld}
                settings={settings}
                currentPage={currentPage}
                handleMessageUpdate={handleMessageUpdate}
                handleToggleHideMessage={handleToggleHideMessage}
                handleEntityClick={handleEntityClick}
                handleSwipe={handleSwipe}
                totalCount={history.length}
                isTavernHelperReady={isTavernHelperReady}
            />

            {/* Collapsible Bottom Bar with bouncy dynamics */}
            <motion.div
                animate={{ 
                    y: areBarsHidden ? '100%' : 0, 
                    height: areBarsHidden ? 0 : 'auto',
                    opacity: areBarsHidden ? 0 : 1,
                }}
                transition={{ type: 'spring', damping: 24, stiffness: 180 }}
                className="z-20 w-full shrink-0 overflow-hidden"
            >
                <div className="bg-stone-300 dark:bg-[#090f1d] border-t border-stone-400/20 dark:border-slate-800/10 flex flex-col shadow-[0_-5px_15px_rgba(0,0,0,0.04)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.25)]">
                    {/* Game Input Component */}
                    <GameInput 
                        ref={gameInputRef}
                        onSend={handleSend}
                        onStop={stopStreamGeneration}
                        isLoading={isLoading}
                        lastAction={lastAction}
                        isInputCollapsed={isInputCollapsed}
                        onToggleCollapse={() => setIsInputCollapsed(!isInputCollapsed)}
                        activeChoices={activeChoices}
                        history={history}
                        isMobile={isMobile}
                    >
                        {/* Thử Lại Button */}
                        <button 
                            onClick={() => {
                                const lastModelIdx = [...history].reverse().findIndex(m => m.role === 'model');
                                if (lastModelIdx !== -1) {
                                    const actualIdx = history.length - 1 - lastModelIdx;
                                    handleRegenerate(actualIdx);
                                }
                            }} 
                            disabled={isLoading || !history.some(m => m.role === 'model')} 
                            className="h-9 md:h-10 px-4 text-[10px] font-black uppercase tracking-widest neu-btn rounded-xl text-stone-700 dark:text-slate-300 hover:text-mystic-accent transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 border-none disabled:opacity-40"
                            title="Tạo lại phản hồi cuối cùng của AI"
                        >
                            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Thử Lại</span>
                        </button>

                        {/* Pagination Group */}
                        <div className="flex items-center h-9 md:h-10 neu-sm-flat rounded-xl overflow-hidden shrink-0 border-none">
                            <button 
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="h-full px-3 text-stone-600 dark:text-slate-400 hover:text-mystic-accent disabled:opacity-30 transition-colors border-r border-stone-400/20 dark:border-slate-700/20"
                                title="Trang trước"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <div className="px-3 flex flex-col items-center justify-center min-w-[50px]">
                                <span className="text-[10px] font-bold text-stone-700 dark:text-slate-300 leading-none">
                                    {currentPage}/{totalPages}
                                </span>
                                <span className="text-[7px] uppercase opacity-50 font-bold tracking-widest mt-0.5">Trang</span>
                            </div>
                            <button 
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="h-full px-3 text-stone-600 dark:text-slate-400 hover:text-mystic-accent disabled:opacity-30 transition-colors border-l border-stone-400/20 dark:border-slate-700/20"
                                title="Trang sau"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>

                        {/* Scroll Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                                onClick={scrollToTop}
                                className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl neu-btn border-none text-stone-600 dark:text-slate-300 hover:text-mystic-accent transition-all shadow-sm"
                                title="Lên đầu lượt"
                            >
                                <ChevronsUp size={16} />
                            </button>
                            <button 
                                onClick={scrollToBottom}
                                className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl neu-btn border-none text-stone-600 dark:text-slate-300 hover:text-mystic-accent transition-all shadow-sm"
                                title="Về cuối lượt"
                            >
                                <ChevronsDown size={16} />
                            </button>
                        </div>

                        {/* Dynamic Hiding Controls */}
                        <div className="flex items-center gap-1.5 shrink-0 border-l border-stone-400/25 dark:border-slate-850/25 pl-1.5 ml-1">
                            <button 
                                onClick={() => {
                                    const newval = !autoHideBars;
                                    setAutoHideBars(newval);
                                    dbService.setKeyValue('ark_hud_autohide_bars', newval);
                                    if (newval) {
                                        setAreBarsHidden(true);
                                    } else {
                                        setAreBarsHidden(false);
                                    }
                                }}
                                className={`h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl border-none transition-all shadow-sm ${
                                    autoHideBars 
                                    ? 'bg-mystic-accent/15 text-mystic-accent border border-mystic-accent/30 font-bold' 
                                    : 'neu-btn text-stone-600 dark:text-slate-300 hover:text-mystic-accent'
                                }`}
                                title={autoHideBars ? "Ẩn Tự Động: Đang bật (cuộn xuống sẽ ẩn thanh công cụ)" : "Ẩn Tự Động: Đang tắt (luôn giữ thanh công cụ)"}
                            >
                                {autoHideBars ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                            <button 
                                onClick={() => setAreBarsHidden(true)}
                                className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl neu-btn border-none text-stone-600 dark:text-slate-300 hover:text-mystic-accent transition-all shadow-sm"
                                title="Bật Chế Độ Đọc (Ẩn nhanh các thanh công cụ)"
                            >
                                <BookOpen size={15} />
                            </button>
                        </div>
                    </GameInput>
                </div>
            </motion.div>

            {/* Quick floating action controller bar when tools are tucked away */}
            <AnimatePresence>
                {areBarsHidden && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.85, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 15 }}
                        transition={{ duration: 0.25 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 bg-stone-300/90 dark:bg-[#070c18]/90 backdrop-blur-md rounded-2xl border border-stone-400/25 dark:border-slate-800/40 shadow-xl"
                    >
                        <span className="text-[10px] font-black text-stone-500 dark:text-slate-400 uppercase tracking-widest px-2 font-mono whitespace-nowrap">
                            Chế độ đọc
                        </span>
                        
                        <button
                            onClick={() => setAreBarsHidden(false)}
                            className="bg-mystic-accent hover:bg-mystic-accent/80 active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-xl border-none transition-all shadow-md flex items-center gap-1.5 ml-1 whitespace-nowrap cursor-pointer"
                        >
                            <span>Hiện công cụ</span>
                        </button>

                        <button
                            onClick={() => {
                                setAreBarsHidden(false);
                                setAutoHideBars(false);
                                dbService.setKeyValue('ark_hud_autohide_bars', false);
                            }}
                            className="p-1.5 rounded-lg neu-btn border-none text-stone-600 dark:text-stone-300 hover:text-mystic-accent transition-all flex items-center justify-center shrink-0 ml-1 cursor-pointer"
                            title="Tắt Tự Động Ẩn (Luôn hiển thị công cụ)"
                        >
                            <Settings size={13} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* SIDEBAR - UNIFIED COLLAPSIBLE SYSTEM */}
        <AnimatePresence mode="wait">
            {showMobileSidebar && (
                <>
                    {/* Shadow overlay purely for tablet/mobile dismiss (lg:hidden) */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
                        onClick={() => setShowMobileSidebar(false)}
                    />
                    
                    {/* Sliding sidebar container, works relative on large screen and absolute on small screen */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.5 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                        className="lg:relative fixed top-0 right-0 h-full w-[85vw] max-w-[360px] lg:w-[360px] lg:max-w-none shrink-0 bg-stone-300 dark:bg-mystic-900 z-40 border-l border-stone-400 dark:border-slate-800 shadow-2xl lg:shadow-none flex flex-col"
                    >
                        {renderSidebarContent()}
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* MODALS */}
        <GameplayModals 
            showHistoryModal={showHistoryModal}
            setShowHistoryModal={setShowHistoryModal}
            activeSaveTab={activeSaveTab}
            setActiveSaveTab={setActiveSaveTab}
            isMobile={isMobile}
            history={history}
            manualSaveList={manualSaveList}
            autosaveList={autosaveList}
            initialSaveList={initialSaveList}
            handleLoadSave={handleLoadSave}
            handleDeleteSave={handleDeleteSave}

            showCharModal={showCharModal}
            setShowCharModal={setShowCharModal}
            activeWorld={activeWorld}
            setSelectingAvatarFor={setSelectingAvatarFor}
            setShowImageLibrary={setShowImageLibrary}

            showGlobalModal={showGlobalModal}
            setShowGlobalModal={setShowGlobalModal}
            lsrTables={lsrTables}
            lsrRuntimeData={lsrRuntimeData}
            handleUpdateLsrData={handleUpdateLsrData}
            activeLsrTableId={activeLsrTableId}
            setActiveLsrTableId={setActiveLsrTableId}
            lsrViewMode={lsrViewMode}
            setLsrViewMode={setLsrViewMode}

            showContextModal={showContextModal}
            setShowContextModal={setShowContextModal}
            showRuleModal={showRuleModal}
            setShowRuleModal={setShowRuleModal}
            handleUpdateContextConfig={handleUpdateContextConfig}
            settings={settings!}
            turnCount={turnCount}
            tawaPresetConfig={tawaPresetConfig}
            gameTime={gameTime}
            setGameTime={setGameTime}
            lastAction={lastAction}
            dynamicRules={dynamicRules}
            setDynamicRules={setDynamicRules}

            tavoSelectState={tavoSelectState}
            setTavoSelectState={setTavoSelectState}

            selectedEntity={selectedEntity}
            setSelectedEntity={setSelectedEntity}

            showImageLibrary={showImageLibrary}
            handleAvatarSelect={handleAvatarSelect}
            selectingAvatarFor={selectingAvatarFor}

            showLogConsole={showLogConsole}
            setShowLogConsole={setShowLogConsole}
            showRegexModal={showRegexModal}
            setShowRegexModal={setShowRegexModal}
            showCalendarModal={showCalendarModal}
            setShowCalendarModal={setShowCalendarModal}
            combinedRegexScripts={combinedRegexScripts}
            onUpdateWorld={onUpdateWorld}

            showStoryDebugModal={showStoryDebugModal}
            setShowStoryDebugModal={setShowStoryDebugModal}
            selectedDebugMessageIndex={selectedDebugMessageIndex}

            // Fate Encounter Roll Properties
            fateSettings={fateSettings}
            showFateSettingsModal={showFateSettingsModal}
            setShowFateSettingsModal={setShowFateSettingsModal}
            showFateRollModal={showFateRollModal}
            setShowFateRollModal={setShowFateRollModal}
            pendingActionText={pendingActionText}
            handleUpdateFateSettings={handleUpdateFateSettings}
            handleSend={handleSend}
        />

        {/* DEATH SCREEN OVERLAY */}
        <AnimatePresence>
          {isDead && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center select-none"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className="max-w-md w-full p-8 rounded-3xl border border-red-500/30 bg-stone-900/95 shadow-[0_0_50px_rgba(239,68,68,0.25)] text-slate-150 flex flex-col items-center gap-6"
              >
                {/* Skull / Death Icon */}
                <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center text-4xl text-red-500 animate-pulse">
                  💀
                </div>
                
                <div className="space-y-1">
                  <h1 className="text-3xl font-black tracking-wider text-red-500 uppercase font-mono">
                    NHÂN VẬT ĐÃ CHẾT
                  </h1>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">
                    GAME OVER • CHẾ ĐỘ ĐỊA NGỤC
                  </p>
                </div>
                
                <p className="text-xs text-slate-450 leading-relaxed max-w-sm">
                  Dòng chảy sinh mệnh của <strong>{activeWorld.player?.name || "nhân vật"}</strong> đã chấm dứt vĩnh viễn trong chương này. 
                  Dưới áp lực của độ khó <strong>Địa Ngục</strong>, thất bại đồng nghĩa với kết thúc tuyệt đối: mọi dữ liệu lưu trữ (Save files) của thế giới này đã bị <strong>xóa sạch hoàn toàn</strong>.
                </p>

                <div className="w-full h-[1px] bg-slate-800" />

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    onClick={() => {
                      setIsDead(false);
                      onNavigate(GameState.WORLD_CREATION);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase bg-red-650 hover:bg-red-700 active:scale-95 text-white transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md"
                  >
                    Tạo Thế Giới Mới
                  </button>
                  <button
                    onClick={() => {
                      setIsDead(false);
                      onNavigate(GameState.MENU);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                  >
                    Về Menu
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
};

export default GameplayScreen;
