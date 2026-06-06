import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, User, MapPin, Shield, Box } from 'lucide-react';
import { Entity, WorldData, ChatMessage, SaveFile, ContextWindowConfig, AppSettings, GameTime } from '../../../types';
import DataAndHistoryModal from './modals/DataAndHistoryModal';
import CharacterProfileModal from './modals/CharacterProfileModal';
import LsrDatabaseModal from './modals/LsrDatabaseModal';
import ContextWindowModal from './modals/ContextWindowModal';
import ImageLibraryModal from './components/ImageLibraryModal';
import LogConsole from './components/LogConsole';
import RegexScriptsManager from './components/RegexScriptsManager';
import { LsrTableDefinition } from '../../../services/lsr/LsrParser';
import { SchedulePlannerModal } from './modals/SchedulePlannerModal';
import { FateSettingsModal, FateSettings } from './modals/FateSettingsModal';
import { FateRollOverlayModal } from './modals/FateRollOverlayModal';

const EntityDetailModal: React.FC<{
    entity: Entity | null;
    onClose: () => void;
    onUpdateAvatar: (entityId: string) => void;
}> = ({ entity, onClose, onUpdateAvatar }) => {
    if (!entity) return null;

    const getIcon = () => {
        switch (entity.type) {
            case 'NPC': return <User size={20} className="text-sky-500" />;
            case 'LOCATION': return <MapPin size={20} className="text-emerald-500" />;
            case 'FACTION': return <Shield size={20} className="text-rose-500" />;
            case 'ITEM': return <Box size={20} className="text-amber-500" />;
            default: return <Box size={20} className="text-stone-500" />;
        }
    };

    const getTitle = () => {
        switch (entity.type) {
            case 'NPC': return 'Thông tin Nhân vật';
            case 'LOCATION': return 'Thông tin Địa danh';
            case 'FACTION': return 'Thông tin Phe phái';
            case 'ITEM': return 'Thông tin Vật phẩm';
            default: return 'Thông tin Thực thể';
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-stone-200 dark:bg-mystic-900 border border-stone-400 dark:border-slate-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            >
                <div className="p-4 border-b border-stone-400 dark:border-slate-800 flex justify-between items-center bg-stone-300 dark:bg-slate-900/50">
                    <h2 className="text-lg font-bold text-stone-800 dark:text-slate-200 flex items-center gap-2">
                        {getIcon()} {getTitle()}
                    </h2>
                    <button onClick={onClose} className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white p-1 rounded hover:bg-stone-400 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 bg-stone-200 dark:bg-mystic-900">
                    <div className="flex items-start gap-4">
                        <button 
                            onClick={() => onUpdateAvatar(entity.id)}
                            className="w-20 h-20 rounded-xl bg-stone-300 dark:bg-slate-800 border-2 border-mystic-accent flex items-center justify-center shrink-0 shadow-lg overflow-hidden group relative"
                        >
                            {entity.avatar ? (
                                <img src={entity.avatar} alt={entity.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="text-mystic-accent opacity-50 group-hover:opacity-100 transition-opacity flex flex-col items-center">
                                    {getIcon()}
                                    <span className="text-[8px] mt-1 font-bold">Thêm ảnh</span>
                                </div>
                            )}
                        </button>
                        <div className="flex-1 space-y-1">
                            <h3 className="text-2xl font-bold text-stone-800 dark:text-mystic-accent leading-none">
                                {entity.name}
                            </h3>
                            <p className="text-stone-600 dark:text-slate-400 text-sm">{entity.type}</p>
                        </div>
                    </div>
                    {entity.personality && (
                        <div className="bg-stone-300/50 dark:bg-slate-800/30 p-3 rounded-lg border border-stone-400/50 dark:border-slate-700/50">
                            <h4 className="text-xs font-bold text-stone-500 dark:text-slate-400 uppercase mb-1">Tính cách / Đặc điểm</h4>
                            <p className="text-sm font-medium text-stone-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{entity.personality}</p>
                        </div>
                    )}
                    <div className="bg-stone-300/50 dark:bg-slate-800/30 p-3 rounded-lg border border-stone-400/50 dark:border-slate-700/50">
                        <h4 className="text-xs font-bold text-stone-500 dark:text-slate-400 uppercase mb-1">Mô tả</h4>
                        <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{entity.description}</p>
                    </div>
                    <div className="bg-stone-300/50 dark:bg-slate-800/30 p-3 rounded-lg border border-stone-400/50 dark:border-slate-700/50 text-xs text-stone-500 dark:text-slate-500 font-mono">
                        ID: {entity.id}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};


interface GameplayModalsProps {
    showHistoryModal: boolean;
    setShowHistoryModal: (v: boolean) => void;
    activeSaveTab: 'manual' | 'auto' | 'initial';
    setActiveSaveTab: (v: 'manual' | 'auto' | 'initial') => void;
    isMobile: boolean;
    history: ChatMessage[];
    manualSaveList: SaveFile[];
    autosaveList: SaveFile[];
    initialSaveList: SaveFile[];
    handleLoadSave: (save: SaveFile) => void;
    handleDeleteSave: (id: string, type: 'manual' | 'auto' | 'initial') => void;

    showCharModal: boolean;
    setShowCharModal: (v: boolean) => void;
    activeWorld: WorldData;
    setSelectingAvatarFor: (v: { type: 'player' | 'entity', id?: string } | null) => void;
    setShowImageLibrary: (v: boolean) => void;

    showGlobalModal: boolean;
    setShowGlobalModal: (v: boolean) => void;
    lsrTables: LsrTableDefinition[];
    lsrRuntimeData: Record<string, unknown[]>;
    handleUpdateLsrData: (data: Record<string, any[]>) => void;
    activeLsrTableId: string;
    setActiveLsrTableId: (v: string) => void;
    lsrViewMode: 'data' | 'query' | 'visualize';
    setLsrViewMode: (v: 'data' | 'query' | 'visualize') => void;

    showContextModal: boolean;
    setShowContextModal: (v: boolean) => void;
    showRuleModal?: boolean;
    setShowRuleModal?: (v: boolean) => void;
    handleUpdateContextConfig: (newConfig: ContextWindowConfig) => void;
    settings: AppSettings | null;
    turnCount: number;
    tawaPresetConfig: any;
    gameTime: GameTime;
    lastAction?: string;
    dynamicRules?: string[];
    setDynamicRules?: (rules: string[]) => void;

    tavoSelectState: {options: any[], title?: string, defaultValue?: any, resolve: (val: any) => void} | null;
    setTavoSelectState: (v: any) => void;

    selectedEntity: Entity | null;
    setSelectedEntity: (e: Entity | null) => void;

    showImageLibrary: boolean;
    handleAvatarSelect: (url: string) => void;
    selectingAvatarFor: { type: 'player' | 'entity', id?: string } | null;

    showLogConsole: boolean;
    setShowLogConsole: (v: boolean) => void;
    showRegexModal: boolean;
    setShowRegexModal: (v: boolean) => void;
    showCalendarModal: boolean;
    setShowCalendarModal: (v: boolean) => void;
    combinedRegexScripts: RegexScript[];
    onUpdateWorld?: (updates: Partial<WorldData>) => void;
    showStoryDebugModal: boolean;
    setShowStoryDebugModal: (v: boolean) => void;
    selectedDebugMessageIndex: number | null;
    setGameTime?: (time: GameTime) => void;

    // Fate Encounter
    fateSettings: FateSettings;
    showFateSettingsModal: boolean;
    setShowFateSettingsModal: (v: boolean) => void;
    showFateRollModal: boolean;
    setShowFateRollModal: (v: boolean) => void;
    pendingActionText: string;
    handleUpdateFateSettings: (v: FateSettings) => void;
    handleSend: (text: string, isBypass?: boolean) => void;
}

export const GameplayModals: React.FC<GameplayModalsProps> = (props) => {
    return (
        <>
            {/* HISTORY & LOAD SAVE MODAL */}
            <DataAndHistoryModal
                show={props.showHistoryModal}
                onClose={() => props.setShowHistoryModal(false)}
                activeSaveTab={props.activeSaveTab}
                setActiveSaveTab={props.setActiveSaveTab}
                isMobile={props.isMobile}
                history={props.history}
                manualSaveList={props.manualSaveList}
                autosaveList={props.autosaveList}
                initialSaveList={props.initialSaveList}
                handleLoadSave={props.handleLoadSave}
                handleDeleteSave={props.handleDeleteSave}
            />

            {/* CHARACTER MODAL */}
            <CharacterProfileModal
                show={props.showCharModal}
                onClose={() => props.setShowCharModal(false)}
                activeWorld={props.activeWorld}
                onUpdateWorld={props.onUpdateWorld}
                onSelectAvatar={() => {
                    props.setSelectingAvatarFor({ type: 'player' });
                    props.setShowImageLibrary(true);
                }}
            />

            {/* GLOBAL INFO (LSR) MODAL */}
            <LsrDatabaseModal 
                show={props.showGlobalModal} 
                onClose={() => props.setShowGlobalModal(false)}
                lsrTables={props.lsrTables}
                lsrRuntimeData={props.lsrRuntimeData}
                handleUpdateLsrData={props.handleUpdateLsrData}
                activeLsrTableId={props.activeLsrTableId}
                setActiveLsrTableId={props.setActiveLsrTableId}
                lsrViewMode={props.lsrViewMode as any}
                setLsrViewMode={props.setLsrViewMode as any}
            />

            {/* CONTEXT MODAL */}
            <ContextWindowModal
                show={props.showContextModal}
                onClose={() => props.setShowContextModal(false)}
                activeWorld={props.activeWorld}
                handleUpdateContextConfig={props.handleUpdateContextConfig}
                settings={props.settings!}
                history={props.history}
                turnCount={props.turnCount}
                tawaPresetConfig={props.tawaPresetConfig!}
                gameTime={props.gameTime}
                lastAction={props.lastAction || 'Cập nhật hệ thống'}
                dynamicRules={props.dynamicRules}
                setDynamicRules={props.setDynamicRules}
                allowedTabs={['config', 'debugger']}
                initialTab="config"
            />

            {/* RULES MODAL */}
            {props.showRuleModal && props.setShowRuleModal && (
                <ContextWindowModal
                    show={props.showRuleModal}
                    onClose={() => props.setShowRuleModal!(false)}
                    activeWorld={props.activeWorld}
                    handleUpdateContextConfig={props.handleUpdateContextConfig}
                    settings={props.settings!}
                    history={props.history}
                    turnCount={props.turnCount}
                    tawaPresetConfig={props.tawaPresetConfig!}
                    gameTime={props.gameTime}
                    lastAction={props.lastAction || 'Cập nhật hệ thống'}
                    dynamicRules={props.dynamicRules}
                    setDynamicRules={props.setDynamicRules}
                    allowedTabs={['rules']}
                    initialTab="rules"
                />
            )}


            <AnimatePresence>
                {props.tavoSelectState && (
                    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-stone-100 dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] border border-stone-300 dark:border-slate-700"
                        >
                            <div className="p-4 border-b border-stone-300 dark:border-slate-700 flex justify-between items-center bg-stone-200 dark:bg-slate-800">
                                <h3 className="font-bold text-stone-800 dark:text-slate-200">{props.tavoSelectState.title || 'Lựa chọn tavo'}</h3>
                                <button 
                                    onClick={() => {
                                        props.tavoSelectState!.resolve(null);
                                        props.setTavoSelectState(null);
                                    }}
                                    className="text-stone-500 hover:text-red-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                                {props.tavoSelectState.options.map((opt, i) => {
                                    const val = typeof opt === 'string' ? opt : (opt.value !== undefined ? opt.value : opt.label);
                                    const label = typeof opt === 'string' ? opt : (opt.label || opt.value);
                                    const isSelected = val === props.tavoSelectState!.defaultValue;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                props.tavoSelectState!.resolve(val);
                                                props.setTavoSelectState(null);
                                            }}
                                            className={`w-full text-left p-3 rounded-lg border flex flex-col gap-1 transition-all ${isSelected ? 'bg-mystic-accent/10 border-mystic-accent text-mystic-accent' : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 hover:border-mystic-accent/50 text-stone-700 dark:text-slate-300'}`}
                                        >
                                            <div className="font-medium text-sm flex items-center gap-2">
                                               {label}
                                            </div>
                                            {typeof opt === 'object' && opt.subtitle && <div className="text-xs text-stone-500 dark:text-slate-400 font-semibold">{opt.subtitle}</div>}
                                            {typeof opt === 'object' && opt.description && <div className="text-[10px] text-stone-400 dark:text-slate-500">{opt.description}</div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {props.selectedEntity && (
                    <EntityDetailModal 
                        entity={props.selectedEntity} 
                        onClose={() => props.setSelectedEntity(null)} 
                        onUpdateAvatar={(id) => {
                            props.setSelectingAvatarFor({ type: 'entity', id });
                            props.setShowImageLibrary(true);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Image Library Modal */}
            <ImageLibraryModal 
                isOpen={props.showImageLibrary}
                onClose={() => {
                    props.setShowImageLibrary(false);
                    props.setSelectingAvatarFor(null);
                }}
                onSelect={props.handleAvatarSelect}
                selectedId={props.selectingAvatarFor?.type === 'player' ? props.activeWorld.player.avatar : props.activeWorld.entities.find(e => e.id === props.selectingAvatarFor?.id)?.avatar}
            />

            {/* Log Console Modal */}
            <AnimatePresence>
                {props.showLogConsole && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-4xl h-[80vh]"
                        >
                            <LogConsole onClose={() => props.setShowLogConsole(false)} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* REGEX SCRIPTS MODAL */}
            {props.showRegexModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-stone-200 dark:bg-mystic-900 w-full max-w-6xl h-[85vh] rounded-xl flex flex-col shadow-2xl border border-stone-400 dark:border-slate-700 overflow-hidden relative"
                    >
                        <button 
                            onClick={() => props.setShowRegexModal(false)}
                            className="absolute top-4 right-4 z-50 p-2 text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-white bg-stone-300 dark:bg-slate-800 hover:bg-stone-400 dark:hover:bg-slate-700 rounded-lg transition-colors border border-stone-400 dark:border-slate-600 shadow"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex-1 overflow-hidden mt-12 mb-4 mx-4 border border-stone-400 dark:border-slate-700 rounded-lg bg-stone-100 dark:bg-slate-900/50 shadow-inner">
                            <RegexScriptsManager 
                                presetName="World Regex Scripts"
                                scripts={props.activeWorld?.extensions?.regex_scripts || []}
                                onChange={(newScripts) => {
                                    if (props.onUpdateWorld) {
                                        props.onUpdateWorld({ 
                                            extensions: {
                                                ...(props.activeWorld?.extensions || {}),
                                                regex_scripts: newScripts
                                            }
                                        });
                                    }
                                }}
                                playerName={props.activeWorld?.player?.name || "Player"}
                                charName={props.activeWorld?.entities?.[0]?.name || "Character"}
                            />
                        </div>
                    </motion.div>
                </div>
            )}

            {/* SCHEDULE PLANNER (7 DAYS CALENDAR) MODAL */}
            <SchedulePlannerModal
                isOpen={props.showCalendarModal}
                onClose={() => props.setShowCalendarModal(false)}
                activeWorld={props.activeWorld}
                history={props.history}
                settings={props.settings}
                gameTime={props.gameTime}
                isMobile={props.isMobile}
                setGameTime={props.setGameTime}
                onUpdateWorld={props.onUpdateWorld}
                handleSend={props.handleSend}
            />

            {/* FATE ENCOUNTER SETTINGS MODAL */}
            <FateSettingsModal
                isOpen={props.showFateSettingsModal}
                onClose={() => props.setShowFateSettingsModal(false)}
                settings={props.fateSettings}
                onSave={props.handleUpdateFateSettings}
            />

            {/* FATE ENCOUNTER ROLL INTERACTIVE MODAL */}
            <FateRollOverlayModal
                isOpen={props.showFateRollModal}
                onClose={() => props.setShowFateRollModal(false)}
                settings={props.fateSettings}
                activeWorld={props.activeWorld}
                history={props.history}
                appSettings={props.settings || ({} as AppSettings)}
                gameTime={props.gameTime}
                actionText={props.pendingActionText}
                onAcceptFate={(finalPrompt) => props.handleSend(finalPrompt, true)}
            />
        </>
    );
};
