import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  NavigationProps,
  GameState,
  ChatMessage,
  AppSettings,
  SaveFile,
  WorldData,
  TawaPresetConfig,
  GameTime,
  Entity,
  ImageMetadata,
  ContextWindowConfig,
} from "../../../../types";
import { gameplayAiService } from "../../../../services/ai/gameplay/service";
import { dbService } from "../../../../services/db/indexedDB";
import {
  INITIAL_GAME_TIME,
  formatGameTime,
} from "../../../../utils/timeUtils";
import { useResponsive } from "../../../../hooks/useResponsive";
import { tavoRegistry } from "../../../../services/api/tavoApi";
import { useModalState } from "./useModalState";
import { useAiMonitor } from "./useAiMonitor";
import { LsrParser } from "../../../../services/lsr/LsrParser";
import { getRegexedString, extractTagContent, parseChoices } from "../../../../utils/regex";
import { useSaveSystem } from "./useSaveSystem";
import { FateSettings } from "../modals/FateSettingsModal";
import { DEFAULT_CRISES } from "../modals/FateRollOverlayModal";
import { useLsr } from "./useLsr";
import { useGameConfig } from "./useGameConfig";
import { useGameEngine } from "./useGameEngine";
import { processScheduleAutoprogression } from "../../../../services/schedule/ScheduleAutoEngine";
import { parseBuiltinPreset } from "../components/TawaPresetManager";
import tawaReYilPresetData from "../../../../assets/presets/tawa_re_yil.json";
import tawaDeltaPresetData from "../../../../assets/presets/tawa_delta_combined.json";

import { useScrollManager } from "./useScrollManager";
import { useFateSystem } from "./useFateSystem";
import { useExternalBridge } from "./useExternalBridge";
import { useAIGeneration } from "./useAIGeneration";

export const useGameplayCore = ({ onNavigate, activeWorld, onUpdateWorld }: NavigationProps) => {
  const isMobile = useResponsive("md") === false;
  const gameInputRef = useRef<HTMLTextAreaElement>(null);

  // 1. Core State & Refs (Engine)
  const {
    isLoading,
    setIsLoading,
    history,
    setHistory,
    lastAction,
    setLastAction,
    turnCount,
    setTurnCount,
    historyRef,
    turnCountRef,
    lastActionRef,
    syncEngineFromSave,
  } = useGameEngine(activeWorld);

  // 2. Setup Config
  const {
    settings,
    setSettings,
    tawaPresetConfig,
    setTawaPresetConfig,
    dynamicRules,
    setDynamicRules,
    combinedRegexScripts,
    setCombinedRegexScripts,
    gameTime,
    setGameTime,
    dynamicRulesRef,
    tawaPresetConfigRef,
    gameTimeRef,
    loadInitialSettings,
    syncConfigFromSave,
    reloadRegexScripts,
  } = useGameConfig(activeWorld);

  const combinedRegexScriptsRef = useRef(combinedRegexScripts);
  useEffect(() => {
    combinedRegexScriptsRef.current = combinedRegexScripts;
  }, [combinedRegexScripts]);

  // 3. Save Lists and Management
  const {
    autosaveList,
    manualSaveList,
    initialSaveList,
    activeSaveTab,
    setActiveSaveTab,
    isSaving,
    setIsSaving,
    loadSaveLists,
    handleDeleteSave,
  } = useSaveSystem();

  // 4. Token & Speed Tracking (AI Monitor)
  const {
    tokenHistory,
    totalTokens,
    lastTurnTotalTime,
    currentProcessingTime,
    setCurrentProcessingTime,
    processingStartTimeRef,
    tokenHistoryRef,
    totalTokensRef,
    lastTurnTotalTimeRef,
    startProcessing,
    endProcessing,
    updateTokenHistoryItem: updateTokenHistory,
    syncFromSave: syncAiMonitorFromSave,
  } = useAiMonitor(activeWorld);

  const tokenHistoryRefSync = useRef(tokenHistory);
  const totalTokensRefSync = useRef(totalTokens);
  const lastTurnTotalTimeRefSync = useRef(lastTurnTotalTime);

  useEffect(() => { tokenHistoryRefSync.current = tokenHistory; }, [tokenHistory]);
  useEffect(() => { totalTokensRefSync.current = totalTokens; }, [totalTokens]);
  useEffect(() => { lastTurnTotalTimeRefSync.current = lastTurnTotalTime; }, [lastTurnTotalTime]);

  // 5. Interface Modals State
  const {
    showCharModal,
    setShowCharModal,
    showGlobalModal,
    setShowGlobalModal,
    showHistoryModal,
    setShowHistoryModal,
    showContextModal,
    setShowContextModal,
    showImageLibrary,
    setShowImageLibrary,
    showLogConsole,
    setShowLogConsole,
    showRegexModal,
    setShowRegexModal,
    showCalendarModal,
    setShowCalendarModal,
    showMobileSidebar,
    setShowMobileSidebar,
    showStoryDebugModal,
    setShowStoryDebugModal,
    selectedDebugMessageIndex,
    setSelectedDebugMessageIndex,
    selectingAvatarFor,
    setSelectingAvatarFor,
  } = useModalState();

  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [showStatsDetails, setShowStatsDetails] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [activeContextTab, setActiveContextTab] = useState<"scenario" | "author" | "bible" | "rules">("bible");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // 6. LSR Module
  const {
    lsrTables,
    setLsrTables,
    lsrRuntimeData,
    setLsrRuntimeData,
    activeLsrTableId,
    setActiveLsrTableId,
    lsrViewMode,
    setLsrViewMode,
    lsrRuntimeDataRef,
  } = useLsr(activeWorld);

  const handleUpdateLsrData = useCallback((newData: Record<string, any[]>) => {
    setLsrRuntimeData(newData);
    if (onUpdateWorld && activeWorld) {
      setTimeout(() => {
        onUpdateWorld({ lsrData: newData });
      }, 0);
    }
  }, [activeWorld, onUpdateWorld, setLsrRuntimeData]);

  // Initialize Reference Hooks
  const activeWorldRef = useRef<WorldData | null>(activeWorld);
  useEffect(() => {
    activeWorldRef.current = activeWorld;
  }, [activeWorld]);

  const isReadyRef = useRef(false);
  const activeWorldSummaryRef = useRef<string | undefined>(activeWorld?.summary);
  useEffect(() => {
    activeWorldSummaryRef.current = activeWorld?.summary;
  }, [activeWorld]);

  const syncWorldState = useCallback(
    (
      currentHistory?: ChatMessage[],
      currentTurn?: number,
      currentTime?: GameTime,
      currentLsrData?: Record<string, unknown[]>,
      currentSummary?: string,
    ) => {
      if (!isReadyRef.current) return;
      if (onUpdateWorld) {
        setTimeout(() => {
          onUpdateWorld({
            summary: currentSummary || activeWorldSummaryRef.current,
            lsrData: currentLsrData || lsrRuntimeDataRef.current,
            config: {
              ...activeWorldRef.current?.config,
              rules: dynamicRulesRef.current,
              tawaPreset: tawaPresetConfigRef.current,
            },
            savedState: {
              history: currentHistory || historyRef.current,
              turnCount: currentTurn !== undefined ? currentTurn : turnCountRef.current,
              gameTime: currentTime || gameTimeRef.current,
              aiMonitor: {
                tokenHistory: tokenHistoryRefSync.current,
                totalTokens: totalTokensRefSync.current,
                lastTurnTotalTime: lastTurnTotalTimeRefSync.current,
              },
            },
          });
        }, 0);
      }
    },
    [onUpdateWorld, lsrRuntimeDataRef, dynamicRulesRef, tawaPresetConfigRef, historyRef, turnCountRef, gameTimeRef],
  );

  // Handle world auto-saves to IndexedDB dynamically on background state updates
  useEffect(() => {
    if (!activeWorld || !activeWorld.activeSaveId || !isReadyRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const saves = await dbService.getAllSaves();
        const existingSave = saves.find((s) => s.id === activeWorld.activeSaveId);

        const updatedSave: SaveFile = {
          id: activeWorld.activeSaveId,
          name:
            existingSave?.name ||
            `${activeWorld.world?.worldName || "Unknown World"} - Lượt ${turnCount} (Tự động)`,
          createdAt: existingSave?.createdAt || Date.now(),
          updatedAt: Date.now(),
          data: {
            ...activeWorld,
            lsrData: lsrRuntimeData,
            savedState: {
              history: history,
              turnCount: turnCount,
              gameTime: gameTime,
              aiMonitor: {
                tokenHistory: tokenHistory,
                totalTokens: totalTokens,
                lastTurnTotalTime: lastTurnTotalTime,
              },
            },
          },
        };
        await dbService.saveAutosave(updatedSave);
      } catch (err) {
        console.error("Autobackground save to DB failed:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeWorld, history, turnCount, gameTime, lsrRuntimeData, tokenHistory, totalTokens, lastTurnTotalTime]);

  const triggerInitialSave = useCallback(
    async (world: WorldData, time: GameTime) => {
      if (!isReadyRef.current) return;
      try {
        const worldData: WorldData = {
          ...world,
          lsrData: lsrRuntimeDataRef.current,
          config: {
            ...(world.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRulesRef.current,
            tawaPreset: tawaPresetConfigRef.current,
            regexScripts: combinedRegexScriptsRef.current,
          },
          savedState: {
            history: [],
            turnCount: 0,
            gameTime: time,
            aiMonitor: {
              tokenHistory: tokenHistoryRefSync.current,
              totalTokens: totalTokensRefSync.current,
              lastTurnTotalTime: lastTurnTotalTimeRefSync.current,
            },
          },
        };
        const worldName = world.world?.worldName || "Unknown_World";
        const slotId = `initial-${worldName.replace(/\s+/g, "_")}-start`;

        await dbService.saveAutosave({
          id: slotId,
          name: `${worldName} - Bản lưu lượt 0`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: worldData,
        });
      } catch (err) {
        console.error("Initial save failed", err);
      }
    },
    [lsrRuntimeDataRef, dynamicRulesRef, tawaPresetConfigRef],
  );

  const triggerAutosave = useCallback(
    async (
      currentHistory: ChatMessage[],
      currentTurn: number,
      currentTime: GameTime,
      currentLsrData?: Record<string, unknown[]>,
    ) => {
      if (!activeWorldRef.current || !isReadyRef.current) return;
      try {
        const worldData: WorldData = {
          ...activeWorldRef.current,
          lsrData: currentLsrData || lsrRuntimeDataRef.current,
          config: {
            ...(activeWorldRef.current.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRulesRef.current,
            tawaPreset: tawaPresetConfigRef.current,
            regexScripts: combinedRegexScriptsRef.current,
          },
          savedState: {
            history: currentHistory,
            turnCount: currentTurn,
            gameTime: currentTime,
            aiMonitor: {
              tokenHistory: tokenHistoryRefSync.current,
              totalTokens: totalTokensRefSync.current,
              lastTurnTotalTime: lastTurnTotalTimeRefSync.current,
            },
          },
        };
        const activeName = activeWorldRef.current.world?.worldName || "World_Name";
        const cleanName = activeName.replace(/\s+/g, "_");
        const slotId = `autosave-${activeWorldRef.current.id || "c1"}-${cleanName}`;

        await dbService.saveAutosave({
          id: slotId,
          name: `${activeName} - Tự động lưu Lượt ${currentTurn}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: worldData,
        });
      } catch (err) {
        console.error("Autosave trigger failing:", err);
      }
    },
    [lsrRuntimeDataRef, dynamicRulesRef, tawaPresetConfigRef],
  );

  // 7. Initialize Fate roll, settings, and health check mechanics
  const {
    isDead,
    setIsDead,
    showFateSettingsModal,
    setShowFateSettingsModal,
    showFateRollModal,
    setShowFateRollModal,
    pendingActionText,
    setPendingActionText,
    fateSettings,
    setFateSettings,
    handleUpdateFateSettings,
    checkDeathStatus,
    triggerPermadeath,
  } = useFateSystem(activeWorld, settings, onUpdateWorld);

  // 8. Derived UI calculations for scroll & pagination
  const totalPages = useMemo(() => {
    const turns = Array.from(
      new Set(history.map((m) => (m.turnNumber !== undefined ? m.turnNumber : 0))),
    ).sort((a, b) => a - b);
    return turns.length > 0 ? turns.length : 1;
  }, [history]);

  const displayedMessages = useMemo(() => {
    const turns = Array.from(
      new Set(history.map((m) => (m.turnNumber !== undefined ? m.turnNumber : 0))),
    ).sort((a, b) => a - b);
    if (turns.length === 0) return history;

    // Use current page as index (1-indexed)
    const targetPageIndex = Math.max(1, Math.min(totalPages, 1)); // Placeholder logic to be updated below
    return history; // Simple slice proxy for core compatibility
  }, [history, totalPages]);

  const startIndex = 0;

  // 9. Scrolling & Auto scroll Management
  const {
    chatEndRef,
    scrollViewportRef,
    shouldAutoScrollRef,
    pendingScrollTurnRef,
    currentPage,
    setCurrentPage,
    lastNavigatedTurn,
    setLastNavigatedTurn,
    handleScroll,
    scrollToTurn,
    findCurrentTurnInView,
    scrollToTop,
    scrollToBottom,
  } = useScrollManager(history, isLoading, displayedMessages);

  // 10. AI Generation Orchestration
  const {
    runStreamGeneration,
    stopStreamGeneration,
    processAIResponse,
    updateMessageSwipes,
    handleSendInitial,
  } = useAIGeneration({
    activeWorld,
    activeWorldRef,
    history,
    setHistory,
    historyRef,
    isLoading,
    setIsLoading,
    lastActionRef,
    turnCount,
    setTurnCount,
    turnCountRef,
    gameTime,
    setGameTime,
    gameTimeRef,
    lsrRuntimeData,
    setLsrRuntimeData,
    lsrRuntimeDataRef,
    settings,
    dynamicRules,
    dynamicRulesRef,
    tawaPresetConfig,
    tawaPresetConfigRef,
    combinedRegexScriptsRef,
    shouldAutoScrollRef,
    updateTokenHistory,
    syncWorldState,
    triggerAutosave,
    checkDeathStatus,
    triggerPermadeath,
  });

  const handleSendRef = useRef<((text: string) => Promise<void>) | null>(null);

  // 11. External client connectivity bridge (SillyTavern, simpleEventEmitter, variables)
  const {
    isTavernHelperReady,
    tavoSelectState,
    setTavoSelectState,
  } = useExternalBridge({
    activeWorld,
    activeWorldRef,
    historyRef,
    setHistory,
    gameTimeRef,
    turnCountRef,
    syncWorldState,
    onUpdateWorld,
    setIsInputCollapsed,
    handleSendRef,
  });

  // Action Sender (Incorporates fate, regex, multi-swipes, state sync, and scheduling progression triggers)
  const handleSend = async (textToSend: string, isFateBypass: boolean = false) => {
    if (!textToSend || isLoading || !activeWorld || !settings) return;

    const trimText = textToSend.trim();
    if (trimText === "/regex-state" || trimText.startsWith("/regex-off ") || trimText.startsWith("/regex-on ")) {
      const isState = trimText === "/regex-state";
      const isOff = trimText.startsWith("/regex-off ");
      const isOn = trimText.startsWith("/regex-on ");
      const targetName = isOff
        ? trimText.replace("/regex-off ", "").trim()
        : isOn
          ? trimText.replace("/regex-on ", "").trim()
          : "";

      let statusMessage = "";

      if (isState) {
        statusMessage = "**Regex Scripts State:**\n\n";
        if (!combinedRegexScripts || combinedRegexScripts.length === 0) {
          statusMessage += "No regex scripts found.";
        } else {
          combinedRegexScripts.forEach((script) => {
            statusMessage += `- **${script.scriptName}**: ${script.disabled ? "🔴 OFF" : "🟢 ON"} *(Placement: ${script.placement.join(", ")})*\n`;
          });
        }
      } else if (targetName && combinedRegexScripts) {
        let found = false;

        const globals = [...(settings.regex_scripts || [])];
        let modifiedGlobals = false;
        globals.forEach((s) => {
          if (s.scriptName === targetName) {
            s.disabled = isOff;
            modifiedGlobals = true;
            found = true;
          }
        });
        if (modifiedGlobals) {
          const newSettings = { ...settings, regex_scripts: globals };
          setSettings(newSettings);
          dbService.saveSettings(newSettings);
        }

        const scopeds = [...(activeWorld.extensions?.regex_scripts || [])];
        let modifiedScopeds = false;
        scopeds.forEach((s) => {
          if (s.scriptName === targetName) {
            s.disabled = isOff;
            modifiedScopeds = true;
            found = true;
          }
        });
        if (modifiedScopeds && onUpdateWorld) {
          onUpdateWorld({
            extensions: {
              ...(activeWorld.extensions || {}),
              regex_scripts: scopeds,
            },
          });
        }

        const updatedCombined = combinedRegexScripts.map((s) => {
          if (s.scriptName === targetName) return { ...s, disabled: isOff };
          return s;
        });
        setCombinedRegexScripts(updatedCombined);

        setTimeout(() => reloadRegexScripts(), 100);

        if (found) {
          statusMessage = `Regex script \`${targetName}\` has been turned **${isOff ? "OFF" : "ON"}**.`;
        } else {
          statusMessage = `Regex script \`${targetName}\` not found in current scope.`;
        }
      }

      const sysMsg: ChatMessage = {
        role: "system",
        text: statusMessage,
        timestamp: Date.now(),
        gameTime: gameTime,
        turnNumber: turnCount,
      };
      const newHistory = [...history, sysMsg];
      setHistory(newHistory);
      syncWorldState(newHistory, turnCount, gameTime);
      setTimeout(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return;
    }

    const isSlash = trimText.startsWith("/");
    if (fateSettings.enabled && !isSlash && !isFateBypass) {
      const shouldTrigger = Math.random() * 100 <= (fateSettings.rate ?? 100);
      if (shouldTrigger) {
        setPendingActionText(textToSend);
        if (fateSettings.autoRoll) {
          const maxVal = fateSettings.diceType === "D20" ? 20 : 100;
          const roll = Math.floor(Math.random() * maxVal) + 1;
          const failed = roll < fateSettings.dc;

          if (failed) {
            toast.error(
              `🎲 Định mệnh đổ ${fateSettings.diceType} = ${roll} (Thất bại < DC ${fateSettings.dc})! Biến cố Ám Tuyến ập đến...`,
            );

            if (fateSettings.onlyHiddenFromSchedule) {
              const scheduleEvents: any[] = [];
              const worldId = activeWorld.id || "default";
              ["user", "char"].forEach((p) => {
                const cached = dbService.getKeyValueSync(`ark-schedule-v5-${worldId}-${p}`);
                if (cached) {
                  try {
                    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
                    if (parsed.days) {
                      parsed.days.forEach((d: any) => {
                        if (d.events) {
                          d.events.forEach((ev: any) => {
                            if (ev.type === "hidden") scheduleEvents.push(ev);
                          });
                        }
                      });
                    }
                  } catch (e) {}
                }
              });

              const customOnes = fateSettings.customCrises || [];
              const selectedEvent =
                scheduleEvents.length > 0
                  ? scheduleEvents[Math.floor(Math.random() * scheduleEvents.length)]
                  : customOnes.length > 0
                    ? customOnes[Math.floor(Math.random() * customOnes.length)]
                    : DEFAULT_CRISES[Math.floor(Math.random() * DEFAULT_CRISES.length)];

              const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc định mệnh ${fateSettings.diceType} = ${roll} (Dưới độ khó DC ${fateSettings.dc}).\n\nBIẾN CỐ ÁM TUYẾN: ${selectedEvent.title}.\nDiễn biến biến cố bất ngờ: ${selectedEvent.description}`;
              handleSend(injectText, true);
            } else {
              const toastId = toast.loading(
                "🎲 Định mệnh tăm tối xoay vần... Hệ thống đang dùng AI dệt kết biến cố tương thích bối cảnh...",
              );

              (async () => {
                try {
                  const { getAiClient } = await import("../../../../services/ai/client");
                  const { getAiModel } = await import("../../../../services/ai/gameplay/service");
                  const { formatGameTime } = await import("../../../../utils/timeUtils");

                  const client = getAiClient(settings || undefined);
                  const activeModel = getAiModel(settings || undefined);

                  const historyText = history
                    .slice(-10)
                    .map((m) => {
                      const speaker =
                        m.role === "user"
                          ? activeWorld.player.name
                          : activeWorld.entities?.[0]?.name || "AI";
                      return `${speaker}: ${m.text}`;
                    })
                    .join("\n\n");

                  const prompt = `Bạn là Dungeon Master trong trò chơi nhập vai dã sử / kỳ ảo trinh thám. Người chơi vừa thực hiện hành động sau nhưng đã tung xúc xắc định mệnh thất bại (Fate Roll Failure):
"${textToSend}"

Bối cảnh thế giới hiện hành:
- Thế giới nhập vai: ${activeWorld.world?.name || "Tự do khám phá"}
- Mô tả bối cảnh: ${activeWorld.world?.description || ""}
- Nhân vật chính: ${activeWorld.player.name} (${activeWorld.player.appearance || "Nhân vật chính"})
- Người đối thoại chủ chốt: ${activeWorld.entities?.[0]?.name || "AI"} (${activeWorld.entities?.[0]?.description || ""})
- Mốc thời gian game: ${gameTime ? formatGameTime(gameTime) : "Hiện tại"}

Lịch sử trò chuyện gần đây để bắt bối cảnh:
${historyText}

Hãy tạo ra một biến cố Ám tuyến phi thường đột ngột trực tiếp dội thẳng vào thế giới xung quanh họ (phù hợp với thế giới dã sử trinh thám và triệt tiêu tính hòa bình lúc này). Biến cố phải tạo ra thử thách trực diện (nhờ vả bị bẫy, rơi mật thư đầy ký tự lạ ám chỉ sát thủ đang săn đuổi, bóng đen đột kích trong sương mù, sập hầm cơ quan ẩn mật giấu kín...).

Yêu cầu định dạng JSON chính xác tuyệt đối sau:
{
  "title": "<Tiêu đề biến cố giật gân, mười chữ trở lại>",
  "description": "<Dòng miêu tả kịch tính giàu văn phong văn học gợi mở, khoảng 100 chữ bằng tiếng Việt>",
  "location": "<Vị trí chính xác phát sinh biến cố>"
}`;

                  const response = await client.models.generateContent({
                    model: activeModel,
                    contents: prompt,
                    config: {
                      temperature: 0.85,
                      responseMimeType: "application/json",
                    },
                  });

                  const responseText = response.text ? response.text.trim() : "";
                  const parsed = JSON.parse(responseText);

                  if (parsed.title && parsed.description) {
                    const loc = parsed.location ? ` (Địa điểm: ${parsed.location})` : "";
                    const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc định mệnh ${fateSettings.diceType} = ${roll} (Dưới độ khó DC ${fateSettings.dc}).\n\nBIẾN CỐ ÁM TUYẾN ẬP XUỐNG: "${parsed.title}"${loc}\nDiễn biến biến cố bất ngờ: ${parsed.description}\n\n(AI/Dungeon Master hãy kết hợp sự kiện bất ngờ khốc liệt này vào mạch truyện để dồn dập kịch tính hóa màn chơi kế tiếp nhé!)`;
                    toast.dismiss(toastId);
                    handleSend(injectText, true);
                  } else {
                    throw new Error("Cấu trúc JSON không hợp lệ");
                  }
                } catch (err) {
                  console.error("Lỗi sinh biến cố AI trong auto-roll, chuyển về mặc định:", err);
                  const customOnes = fateSettings.customCrises || [];
                  const randomPick =
                    customOnes.length > 0
                      ? customOnes[Math.floor(Math.random() * customOnes.length)]
                      : DEFAULT_CRISES[Math.floor(Math.random() * DEFAULT_CRISES.length)];
                  const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc định mệnh ${fateSettings.diceType} = ${roll} (Dưới độ khó DC ${fateSettings.dc}).\n\nBIẾN CỐ ÁM TUYẾN: ${randomPick.title}.\nDiễn biến biến cố bất ngờ: ${randomPick.description}`;
                  toast.dismiss(toastId);
                  handleSend(injectText, true);
                }
              })();
            }
          } else {
            toast.success(
              `🎲 Định mệnh đổ ${fateSettings.diceType} = ${roll} (Thành công >= DC ${fateSettings.dc})! Thân thể bình an.`,
            );
            const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn tung thành công xúc xắc Số phận ${fateSettings.diceType} = ${roll} (Đạt hoặc vượt độ khó DC ${fateSettings.dc}). Trực giác hoàn hảo mách bảo, bạn nương theo thời thế né tránh nguy ngại.`;
            handleSend(injectText, true);
          }
          return;
        } else {
          setShowFateRollModal(true);
          return;
        }
      }
    }

    let finalUserText = textToSend;
    const isDebug = typeof window !== "undefined" && (window as any).__TAWA_REGEX_DEBUG__ === true;
    const currentPlayerName = activeWorld.player?.name || "User";
    const currentCharName = activeWorld.entities?.[0]?.name || "Character";

    if (combinedRegexScripts) {
      if (finalUserText.startsWith("/")) {
        finalUserText = getRegexedString(finalUserText, 3, combinedRegexScripts, {
          userName: currentPlayerName,
          charName: currentCharName,
          depth: 0,
          isDebug,
          isPrompt: false,
          isMarkdown: false,
        });
      }

      finalUserText = getRegexedString(finalUserText, 1, combinedRegexScripts, {
        userName: currentPlayerName,
        charName: currentCharName,
        depth: 0,
        isDebug,
        isPrompt: false,
        isMarkdown: false,
      });
    }

    setLastAction(textToSend);
    setLastNavigatedTurn(null);

    const userMsg: ChatMessage = {
      role: "user",
      text: finalUserText,
      timestamp: Date.now(),
      gameTime: gameTime,
      turnNumber: turnCount + 1,
    };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    syncWorldState(newHistory, turnCount, gameTime);

    const win = window as any;
    if (win.eventSource) {
      win.eventSource.emit("message_sent", userMsg);
      win.eventSource.emit("user_message_rendered", userMsg);
    }

    shouldAutoScrollRef.current = true;

    if (settings.streamResponse) {
      await runStreamGeneration(
        userMsg.text,
        newHistory,
        settings,
        undefined,
        activeWorld,
        gameTime,
      );
    } else {
      setIsLoading(true);
      if (win.eventSource) {
        win.eventSource.emit("generation_started", {
          userInput: userMsg.text,
          turnCount: turnCount + 1,
        });
      }
      try {
        const effectiveWorldData: WorldData = {
          ...activeWorld,
          lsrData: lsrRuntimeDataRef.current,
          gameTime: gameTime,
          savedState: {
            history: newHistory,
            turnCount: turnCount,
            gameTime: gameTime,
          },
          config: {
            ...(activeWorld.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRules,
            tawaPreset: tawaPresetConfig,
            regexScripts: combinedRegexScripts,
          },
        };

        const result = await gameplayAiService.generateStoryTurn(
          userMsg.text,
          newHistory,
          effectiveWorldData,
          settings,
          tawaPresetConfig,
          gameTime,
        );
        if (result.usage?.totalTokenCount) {
          updateTokenHistory(result.usage.totalTokenCount, result.text);
        } else if (result.text) {
          const estimatedTokens = Math.ceil(result.text.length / 4);
          updateTokenHistory(estimatedTokens, result.text);
        }
        processAIResponse(
          result.text,
          false,
          gameTime,
          undefined,
          result.groundingSources,
          result.deepLogicResult,
        );
      } catch (error: any) {
        console.error("AI Generation failed:", error);
        setIsLoading(false);
        const detailedError = error instanceof Error ? error.message : String(error);
        processAIResponse(
          `*(Hệ thống: Có lỗi xảy ra trong quá trình tạo phản hồi. Chi tiết lỗi: ${detailedError}. Vui lòng kiểm tra cấu hình mạng hoặc API Key/Proxy trong Cài đặt và thử lại!)*`,
          false,
          gameTime,
        );
      }
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    if (showHistoryModal) {
      loadSaveLists();
    }
  }, [showHistoryModal, loadSaveLists]);

  // Automated Schedule Time Progression 7-day checks
  const prevGameTimeRef = useRef<GameTime | null>(null);
  useEffect(() => {
    if (!activeWorld || !gameTime) return;

    if (prevGameTimeRef.current) {
      const isChanged =
        prevGameTimeRef.current.year !== gameTime.year ||
        prevGameTimeRef.current.month !== gameTime.month ||
        prevGameTimeRef.current.day !== gameTime.day ||
        prevGameTimeRef.current.hour !== gameTime.hour ||
        prevGameTimeRef.current.minute !== gameTime.minute;

      if (isChanged) {
        const runProgression = async () => {
          try {
            const result = await processScheduleAutoprogression(
              activeWorld.id || "default",
              gameTime,
              activeWorld,
              settings,
              (effect) => {
                toast.warning(`🦋 HIỆU ỨNG CÁNH BƯỚM: Lịch trình bị bỏ lỡ tạo ra biến số dòng thời gian!`, {
                  description: `${effect.title}: ${effect.consequence}`,
                  duration: 8000,
                });
              },
            );

            if (result.processed) {
              const updated = [...historyRef.current];
              let hasNewLogs = false;

              if (result.weatherChanges && result.weatherChanges.length > 0) {
                result.weatherChanges.forEach((wc) => {
                  updated.push({
                    role: "system",
                    text: `[🌤️ THIÊN TƯỢNG VÀ ĐIỀM BÁO]: Khí tiết cốt truyện ngày mới chuyển biến.\nThời tiết hiện tại: "${wc.weather}"\nĐiềm bảo bản đồ: "${wc.omen}"\n\n(AI hãy lồng ghép khéo léo bầu không khí đặc thù này vào lời thoại hoặc mô tả thế giới xung quanh)`,
                    timestamp: Date.now(),
                    gameTime,
                    turnNumber: turnCountRef.current,
                  });
                  toast.info(`🌤️ Thiên tượng chuyển dịch: ${wc.weather} | ${wc.omen}`, { duration: 6000 });
                  hasNewLogs = true;
                });
              }

              if (result.npcMovements && result.npcMovements.length > 0) {
                result.npcMovements.forEach((move) => {
                  updated.push({
                    role: "system",
                    text: `[👥 NPC DYNAMIC SCHEDULER]: Mốc thời gian trôi qua đã kích hoạt dịch chuyển lịch trình của thần thoại nhân vật:\nSự kiện liên đới: "${move.title}"\nHành động/Di chuyển NPC: "${move.npcDynamic}"\nĐịa điểm: "${move.location}"\n\n(AI lưu ý cập nhật trạng thái vị trí mới của các NPC này, không lặp lại hành vi ở địa điểm cũ lúc trước)`,
                    timestamp: Date.now(),
                    gameTime,
                    turnNumber: turnCountRef.current,
                  });
                  toast(`👥 NPC di chuyển: ${move.npcDynamic}`, { icon: "👣", duration: 6000 });
                  hasNewLogs = true;
                });
              }

              if (result.newRipples && result.newRipples.length > 0) {
                result.newRipples.forEach((rip) => {
                  updated.push({
                    role: "system",
                    text: `[🦋 HIỆU ỨNG CÁNH BƯỚM]: Hành động trễ nải hoặc dịch chuyển thời gian đã làm dở dang sự kiện "${rip.eventTitle}" tại ${rip.eventLocation}.\n\nTuyến tính bị lệch hướng: "${rip.title}"\nHệ quả cốt truyện: ${rip.consequence}\nTác động thế giới quan: ${rip.rippleEffect}\n\n(AI hãy tích hợp sâu sắc hệ quả gián tiếp kịch tính này vào lời thoại, miêu tả thế giới, và phản ứng kế tiếp của các nhân vật)`,
                    timestamp: Date.now(),
                    gameTime,
                    turnNumber: turnCountRef.current,
                  });
                  hasNewLogs = true;
                });
              }

              if (hasNewLogs) {
                setHistory(updated);
                syncWorldState(updated, turnCountRef.current, gameTime);
              }
            }
          } catch (e) {
            console.error("Lỗi tự động hóa tiến triển lịch trình:", e);
          }
        };
        runProgression();
      }
    }
    prevGameTimeRef.current = gameTime;
  }, [gameTime, activeWorld, settings, syncWorldState, historyRef, setHistory]);

  const handleLoadSave = (save: SaveFile) => {
    if (!save.data) return;
    const worldData = save.data as WorldData;
    if (!worldData.savedState) return;

    const dead = checkDeathStatus(worldData.savedState.history, worldData.lsrData);
    if (dead) {
      triggerPermadeath();
      setShowHistoryModal(false);
      return;
    }

    const time = worldData.savedState.gameTime || INITIAL_GAME_TIME;
    setGameTime(time);
    gameTimeRef.current = time;

    setTurnCount(worldData.savedState.turnCount);
    turnCountRef.current = worldData.savedState.turnCount;

    setHistory(worldData.savedState.history);
    historyRef.current = worldData.savedState.history;

    setLsrRuntimeData(worldData.lsrData || {});
    lsrRuntimeDataRef.current = worldData.lsrData || {};

    isReadyRef.current = true;
    worldData.activeSaveId = save.id;

    if (onUpdateWorld) {
      onUpdateWorld(worldData);
    }
    setShowHistoryModal(false);
  };

  const handleRegenerate = async (msgIndex: number) => {
    if (isLoading || !activeWorld || !settings) return;

    const prevHistory = history.slice(0, msgIndex);
    const userTriggerMsg = history[msgIndex - 1];
    const startTime = userTriggerMsg?.gameTime || gameTime;

    const userInput = msgIndex === 0 ? "Hãy bắt đầu câu chuyện." : userTriggerMsg?.text || "Continue";
    shouldAutoScrollRef.current = true;

    if (settings.streamResponse) {
      await runStreamGeneration(
        userInput,
        history,
        settings,
        msgIndex,
        activeWorld,
        startTime,
      );
    } else {
      setIsLoading(true);
      try {
        const effectiveWorldData: WorldData = {
          ...activeWorld,
          lsrData: lsrRuntimeDataRef.current,
          config: {
            ...(activeWorld.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRules,
            tawaPreset: tawaPresetConfig,
            regexScripts: combinedRegexScripts,
          },
        };

        const result = await gameplayAiService.generateStoryTurn(
          userInput,
          prevHistory,
          effectiveWorldData,
          settings,
          tawaPresetConfig,
          startTime,
        );

        if (result.usage?.totalTokenCount) {
          updateTokenHistory(result.usage.totalTokenCount, result.text);
        } else if (result.text) {
          const estimatedTokens = Math.ceil(result.text.length / 4);
          updateTokenHistory(estimatedTokens, result.text);
        }

        let finalRegenText = result.text;
        const isDebugRegen = typeof window !== "undefined" && (window as any).__TAWA_REGEX_DEBUG__ === true;
        const playerNameToUseRegen = activeWorld.player?.name || "User";
        if (combinedRegexScripts) {
          finalRegenText = getRegexedString(finalRegenText, 3, combinedRegexScripts, {
            userName: playerNameToUseRegen,
            charName: "Character",
            depth: 0,
            isDebug: isDebugRegen,
            isPrompt: false,
            isMarkdown: false,
          });
          finalRegenText = getRegexedString(finalRegenText, 2, combinedRegexScripts, {
            userName: playerNameToUseRegen,
            charName: "Character",
            depth: 0,
            isDebug: isDebugRegen,
            isPrompt: false,
            isMarkdown: false,
          });
        }

        updateMessageSwipes(msgIndex, finalRegenText, startTime);
        setIsLoading(false);
      } catch (error: any) {
        console.error("AI Regeneration failed:", error);
        setIsLoading(false);
        const errDesc = error instanceof Error ? error.message : String(error);
        toast.error(`Lỗi tái tạo phản hồi (AI Regeneration): ${errDesc}. Vui lòng thử lại hoặc kiểm tra kết nối!`);
      }
    }
  };

  const handleMessageUpdate = useCallback(
    (index: number, newText: string) => {
      setHistory((prev) => {
        const newHistory = [...prev];
        if (newHistory[index]) {
          const msgToEdit = newHistory[index];
          const currentPlayerName = activeWorldRef.current?.player?.name || "User";
          let finalText = newText;
          const isDebug = typeof window !== "undefined" && (window as any).__TAWA_REGEX_DEBUG__ === true;
          let scriptsToRunOnEdit: any[] = [];
          if (combinedRegexScriptsRef.current) {
            scriptsToRunOnEdit = [...combinedRegexScriptsRef.current.filter((s: any) => s.runOnEdit)];
          }
          if (scriptsToRunOnEdit.length > 0) {
            const messageDepth = newHistory.length > 0 ? newHistory.length - 1 - index : -1;
            const placement = msgToEdit.role === "user" ? 1 : 2;
            if (placement === 2) {
              finalText = getRegexedString(finalText, 3, scriptsToRunOnEdit, {
                userName: currentPlayerName,
                charName: "Character",
                depth: messageDepth,
                isDebug,
                isEdit: true,
                isPrompt: false,
                isMarkdown: false,
              });
            }
            finalText = getRegexedString(finalText, placement, scriptsToRunOnEdit, {
              userName: currentPlayerName,
              charName: "Character",
              depth: messageDepth,
              isDebug,
              isEdit: true,
              isPrompt: false,
              isMarkdown: false,
            });
          }

          const msg = { ...newHistory[index] };
          msg.text = finalText;

          if (msg.swipes && msg.swipeIndex !== undefined) {
            const newSwipes = [...msg.swipes];
            newSwipes[msg.swipeIndex] = finalText;
            msg.swipes = newSwipes;
          }

          if (msg.role === "model") {
            const branchesContent =
              extractTagContent(finalText, "branches") ||
              extractTagContent(finalText, "choices") ||
              extractTagContent(finalText, "actions");
            msg.choices = parseChoices(branchesContent);
          }
          newHistory[index] = msg;
          setTimeout(() => syncWorldState(newHistory), 0);
        }
        return newHistory;
      });
    },
    [syncWorldState],
  );

  const handleEntityClick = useCallback(
    (id: string) => {
      const entity = activeWorld?.entities.find((e) => e.id === id);
      if (entity) setSelectedEntity(entity);
    },
    [activeWorld?.entities],
  );

  const handleToggleHideMessage = useCallback(
    (index: number) => {
      setHistory((prev) => {
        const newHistory = [...prev];
        if (newHistory[index]) {
          newHistory[index] = {
            ...newHistory[index],
            hidden: !newHistory[index].hidden,
          };
          setTimeout(() => syncWorldState(newHistory), 0);
        }
        return newHistory;
      });
    },
    [syncWorldState],
  );

  const handleManualSave = async (slotId: string, name: string) => {
    if (!activeWorld) return;
    setIsSaving(true);
    try {
      const worldDataObj: WorldData = {
        ...activeWorld,
        lsrData: lsrRuntimeData,
        config: {
          ...(activeWorld.config || { rules: [], regex_scripts: [] }),
          rules: dynamicRules,
          tawaPreset: tawaPresetConfig || undefined,
          regexScripts: combinedRegexScripts,
        },
        savedState: {
          history: history,
          turnCount: turnCount,
          gameTime: gameTime,
          aiMonitor: {
            tokenHistory: tokenHistory,
            totalTokens: totalTokens,
            lastTurnTotalTime: lastTurnTotalTime,
          },
        },
      };

      await dbService.saveManualSave({
        id: slotId,
        name: name || `${activeWorld.world?.worldName} - Bản lưu thủ công`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: worldDataObj,
      });

      toast.success("Đã ghi lại bản lưu thành công!");
      loadSaveLists();
    } catch (err: any) {
      toast.error(`Sao lưu thất bại: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoToSettings = () => {
    syncWorldState();
    onNavigate(GameState.SETTINGS);
  };

  const handleExit = () => {
    onNavigate(GameState.MENU);
  };

  const toggleStreamResponse = async () => {
    if (!settings) return;
    const newSetting = !settings.streamResponse;
    setSettings({ ...settings, streamResponse: newSetting });
    await dbService.saveSettings({ ...settings, streamResponse: newSetting });
  };

  const handleUpdateContextConfig = (newConfig: ContextWindowConfig) => {
    if (onUpdateWorld && activeWorld) {
      onUpdateWorld({
        config: {
          ...(activeWorld.config || { rules: [], regex_scripts: [] }),
          contextConfig: newConfig,
        },
      });
    }
  };

  const handleAvatarSelect = async (image: ImageMetadata) => {
    if (!selectingAvatarFor || !activeWorld) return;

    if (selectingAvatarFor.type === "player") {
      const updatedWorld = {
        ...activeWorld,
        player: { ...activeWorld.player, avatar: image.data },
      };
      if (onUpdateWorld) onUpdateWorld(updatedWorld);
    } else if (selectingAvatarFor.type === "entity" && selectingAvatarFor.id) {
      const updatedEntities = activeWorld.entities.map((e) =>
        e.id === selectingAvatarFor.id ? { ...e, avatar: image.data } : e,
      );
      const updatedWorld = {
        ...activeWorld,
        entities: updatedEntities,
      };
      if (onUpdateWorld) onUpdateWorld(updatedWorld);
    }

    setSelectingAvatarFor(null);
    setShowImageLibrary(false);
  };

  const handleTawaConfigChange = useCallback(
    (config: TawaPresetConfig) => {
      setTawaPresetConfig(config);
      tawaPresetConfigRef.current = config;
      reloadRegexScripts();
    },
    [reloadRegexScripts, setTawaPresetConfig, tawaPresetConfigRef],
  );

  // Initialize and load world historical sessions
  const lastWorldRef = useRef<WorldData | null>(null);
  const initializedRef = useRef(false);
  const initialStartedRef = useRef(false);

  useEffect(() => {
    if (activeWorld && (!lastWorldRef.current || activeWorld.sessionId !== lastWorldRef.current.sessionId)) {
      initializedRef.current = false;
      lastWorldRef.current = activeWorld;
      initialStartedRef.current = false;
      isReadyRef.current = false;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const s = await dbService.getSettings();
      setSettings(s);
      setLsrTables(LsrParser.parseDefinitions());

      if (activeWorld) {
        setDynamicRules(activeWorld.config?.rules || []);

        if (activeWorld.config?.tawaPreset) {
          setTawaPresetConfig(activeWorld.config.tawaPreset);
          tawaPresetConfigRef.current = activeWorld.config.tawaPreset;
          const activeId = activeWorld.config.tawaPreset.id || "builtin_tawa_re_yil";
          dbService.setKeyValue("tawa_active_preset_id_v4", activeId);
        } else {
          try {
            const defaultSavedPreset = parseBuiltinPreset("builtin_tawa_re_yil", "Tawa Re = YIL丨Alpha V1", tawaReYilPresetData);
            setTawaPresetConfig(defaultSavedPreset.config);
            tawaPresetConfigRef.current = defaultSavedPreset.config;
            dbService.setKeyValue("tawa_active_preset_id_v4", "builtin_tawa_re_yil");

            const currentPresets = dbService.getKeyValueSync("tawa_presets_list_v4");
            if (!currentPresets) {
              const defaultPresetsList = [
                defaultSavedPreset,
                parseBuiltinPreset("builtin_tawa_delta", "Tawa Delta Combined丨Mới Nhất", tawaDeltaPresetData),
              ];
              dbService.setKeyValue("tawa_presets_list_v4", defaultPresetsList);
            }

            if (onUpdateWorld) {
              const updatedConfig = {
                ...(activeWorld.config || {}),
                tawaPreset: defaultSavedPreset.config,
                regexScripts: defaultSavedPreset.config.regexScripts,
              };
              onUpdateWorld({ config: updatedConfig });
            }
          } catch (e) {
            console.error("Failed to load default Tawa preset", e);
          }
        }

        reloadRegexScripts();

        if (activeWorld.lsrData) {
          setLsrRuntimeData(activeWorld.lsrData);
        }

        const worldDataWithState = activeWorld as WorldData;
        if (worldDataWithState.savedState && worldDataWithState.savedState.history.length > 0) {
          setHistory(worldDataWithState.savedState.history);
          historyRef.current = worldDataWithState.savedState.history;

          const dead = checkDeathStatus(worldDataWithState.savedState.history, worldDataWithState.lsrData);
          if (dead) {
            triggerPermadeath();
          }

          setTurnCount(worldDataWithState.savedState.turnCount);
          turnCountRef.current = worldDataWithState.savedState.turnCount;

          if (worldDataWithState.savedState.gameTime) {
            setGameTime(worldDataWithState.savedState.gameTime);
            gameTimeRef.current = worldDataWithState.savedState.gameTime;
          }

          syncAiMonitorFromSave(worldDataWithState.savedState.aiMonitor);
          isReadyRef.current = true;
        } else {
          syncAiMonitorFromSave(null);

          if (s && !initialStartedRef.current) {
            initialStartedRef.current = true;
            const initialTime = worldDataWithState.gameTime || INITIAL_GAME_TIME;
            setGameTime(initialTime);
            isReadyRef.current = true;

            await triggerInitialSave(worldDataWithState, initialTime);
            handleSendInitial(s, worldDataWithState, initialTime);
          }
        }
      }
    };
    init();
  }, [activeWorld, handleSendInitial, triggerInitialSave, checkDeathStatus, triggerPermadeath, reloadRegexScripts, setSettings, setLsrTables, setDynamicRules, setTawaPresetConfig, tawaPresetConfigRef, onUpdateWorld, setLsrRuntimeData, setHistory, historyRef, setTurnCount, turnCountRef, setGameTime, gameTimeRef, syncAiMonitorFromSave]);

  const handleSwipe = (msgIndex: number, direction: "prev" | "next") => {
    const msg = history[msgIndex];
    if (!msg.swipes || msg.swipes.length === 0) return;

    const currentIndex = msg.swipeIndex || 0;
    let newIndex = currentIndex;

    if (direction === "prev") {
      if (currentIndex > 0) newIndex--;
    } else {
      if (currentIndex < msg.swipes.length - 1) {
        newIndex++;
      } else {
        handleRegenerate(msgIndex);
        return;
      }
    }

    const newText = msg.swipes[newIndex];
    const tableStored = extractTagContent(newText, "table_stored");
    let nextLsrData = lsrRuntimeDataRef.current;
    if (tableStored) {
      const parsedData = LsrParser.parseLsrString(tableStored);
      if (Object.keys(parsedData).length > 0) {
        nextLsrData = parsedData;
        setLsrRuntimeData(nextLsrData);
      }
    } else {
      const tableEdit = extractTagContent(newText, "tableEdit");
      if (tableEdit) {
        const parsedEdits = LsrParser.parseLsrString(tableEdit);
        if (Object.keys(parsedEdits).length > 0) {
          nextLsrData = LsrParser.mergeLsrData(lsrRuntimeDataRef.current, parsedEdits);
          setLsrRuntimeData(nextLsrData);
        }
      }
    }

    const incrementalSummary = extractTagContent(newText, "incrementalSummary");

    setHistory((prev) => {
      const updated = [...prev];
      const updatedMsg = { ...updated[msgIndex] };

      updatedMsg.swipeIndex = newIndex;
      updatedMsg.text = newText;

      const branchesContent =
        extractTagContent(newText, "branches") ||
        extractTagContent(newText, "choices") ||
        extractTagContent(newText, "actions");
      updatedMsg.choices = parseChoices(branchesContent);
      updatedMsg.incrementalSummary = incrementalSummary;

      updated[msgIndex] = updatedMsg;

      syncWorldState(
        updated,
        turnCount,
        gameTime,
        nextLsrData,
        incrementalSummary,
      );

      return updated;
    });
  };

  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`;
  };

  const AIMonitor = () => {
    let activeProxy = settings?.proxies?.find((p) => p.id === settings.activeProxyId);
    if (!activeProxy && (settings?.proxyEnabled || settings?.proxyUrl)) {
      activeProxy = {
        id: "legacy",
        name: settings?.proxyName || "Legacy Proxy",
        url: settings?.proxyUrl || "",
        key: settings?.proxyKey || "",
        model: settings?.proxyModel || "",
        models: settings?.proxyModels || [],
        isActive: true,
        type:
          settings?.proxyUrl?.includes("moonshot") || settings?.proxyUrl?.includes("kimi")
            ? "openai"
            : settings?.proxyEnabled
              ? "openai"
              : "google",
      } as any;
    }

    const isProxy = !!activeProxy?.url && !!activeProxy?.key;
    const activeModel = activeProxy && activeProxy.model ? activeProxy.model : settings?.aiModel;

    return (
      <div className="p-3 bg-stone-300 dark:bg-slate-900/80 rounded-lg border border-stone-400 dark:border-slate-700 space-y-2 font-mono text-[10px] mt-2">
        <div className="flex justify-between items-center border-b border-stone-400 dark:border-slate-800 pb-1.5">
          <span className="text-stone-500 dark:text-slate-500 uppercase font-bold">AI Monitor</span>
          <div className="flex items-center gap-2">
            {isLoading && <div className="w-1.5 h-1.5 rounded-full bg-mystic-accent animate-pulse" />}
            <span className={isLoading ? "text-mystic-accent" : "text-stone-400 dark:text-slate-600"}>
              {isLoading ? "PROCESSING" : "IDLE"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-slate-500 uppercase">Connection</span>
            <span className={isProxy ? "text-sky-500" : "text-emerald-500"}>
              {isProxy ? `REVERSE PROXY (${activeProxy?.name || "Unknown"})` : "DIRECT API"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-slate-500 uppercase">Active Model</span>
            <span className="text-stone-700 dark:text-slate-300 truncate" title={activeModel}>
              {activeModel}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-slate-500 uppercase">Timer</span>
            <span className="text-amber-500 font-bold">{formatTime(isLoading ? currentProcessingTime : lastTurnTotalTime)}</span>
          </div>

          <div className="flex flex-col">
            <div
              className="flex justify-between items-center cursor-pointer hover:text-mystic-accent transition-colors"
              onClick={() => setShowTokenDetails(!showTokenDetails)}
            >
              <span className="text-stone-500 dark:text-slate-500 uppercase">Tokens (Last 5)</span>
              <span className="text-[8px] opacity-50">{showTokenDetails ? "Ẩn" : "Hiện"} chi tiết</span>
            </div>
            <div className="flex gap-1 items-end h-4 mt-1">
              {tokenHistory.length > 0 ? (
                tokenHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="bg-mystic-accent/30 border-t border-mystic-accent w-2"
                    style={{ height: `${Math.min(100, (entry.tokens / 4000) * 100)}%` }}
                    title={`${entry.tokens} tokens, ${entry.words} words`}
                  />
                ))
              ) : (
                <span className="text-stone-400">No data</span>
              )}
            </div>

            {showTokenDetails && tokenHistory.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-stone-400/30 dark:border-slate-800/50 pt-1">
                {tokenHistory.map((entry, i) => (
                  <div key={i} className="flex justify-between text-[9px] text-stone-600 dark:text-slate-400">
                    <span>#{tokenHistory.length - i}</span>
                    <span>{formatNumber(entry.tokens)} tkn</span>
                    <span>{formatNumber(entry.words)} chữ</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col border-t border-stone-400 dark:border-slate-800 pt-1">
            <div
              className="flex justify-between items-center cursor-pointer hover:text-mystic-accent transition-colors"
              onClick={() => setShowStatsDetails(!showStatsDetails)}
            >
              <span className="text-stone-500 dark:text-slate-500 uppercase">Thống kê</span>
              <span className="text-[8px] opacity-50">{showStatsDetails ? "Ẩn" : "Hiện"} chi tiết</span>
            </div>

            {showStatsDetails && (
              <div className="flex flex-col gap-0.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-between">
                  <span>Gần nhất:</span>
                  <span className="text-stone-700 dark:text-slate-300">
                    {tokenHistory.length > 0 ? formatNumber(tokenHistory[0].tokens) : 0} tkn
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Số chữ:</span>
                  <span className="text-stone-700 dark:text-slate-300">
                    {tokenHistory.length > 0 ? formatNumber(tokenHistory[0].words) : 0} chữ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tổng cộng:</span>
                  <span className="text-mystic-accent font-bold">{formatNumber(totalTokens)} tkn</span>
                </div>
                <div className="flex justify-between">
                  <span>Trung bình:</span>
                  <span className="text-stone-700 dark:text-slate-300">
                    {tokenHistory.length > 0
                      ? formatNumber(Math.round(tokenHistory.reduce((a, b) => a + b.tokens, 0) / tokenHistory.length))
                      : 0}{" "}
                    tkn
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return {
    isLoading,
    setIsLoading,
    isDead,
    setIsDead,
    history,
    setHistory,
    lastAction,
    setLastAction,
    turnCount,
    setTurnCount,
    settings,
    setSettings,
    tawaPresetConfig,
    setTawaPresetConfig,
    dynamicRules,
    setDynamicRules,
    combinedRegexScripts,
    setCombinedRegexScripts,
    gameTime,
    setGameTime,

    showCharModal,
    setShowCharModal,
    showGlobalModal,
    setShowGlobalModal,
    showHistoryModal,
    setShowHistoryModal,
    showContextModal,
    setShowContextModal,
    showImageLibrary,
    setShowImageLibrary,
    showLogConsole,
    setShowLogConsole,
    showRegexModal,
    setShowRegexModal,
    showCalendarModal,
    setShowCalendarModal,
    showMobileSidebar,
    setShowMobileSidebar,
    showStoryDebugModal,
    setShowStoryDebugModal,
    selectedDebugMessageIndex,
    setSelectedDebugMessageIndex,
    selectingAvatarFor,
    setSelectingAvatarFor,

    showTokenDetails,
    setShowTokenDetails,
    showStatsDetails,
    setShowStatsDetails,
    isInputCollapsed,
    setIsInputCollapsed,
    activeContextTab,
    setActiveContextTab,
    selectedEntity,
    setSelectedEntity,
    currentPage,
    setCurrentPage,

    autosaveList,
    manualSaveList,
    initialSaveList,
    activeSaveTab,
    setActiveSaveTab,
    isSaving,
    setIsSaving,
    loadSaveLists,
    handleDeleteSave,

    tokenHistory,
    totalTokens,
    lastTurnTotalTime,
    currentProcessingTime,

    scrollViewportRef,
    chatEndRef,
    handleScroll,
    scrollToTop,
    scrollToBottom,

    totalPages,
    displayedMessages,
    startIndex,

    handleSend,
    handleRegenerate,
    stopStreamGeneration,
    processAIResponse,
    handleSwipe,
    handleMessageUpdate,
    handleToggleHideMessage,
    handleEntityClick,
    handleAvatarSelect,
    handleManualSave,
    handleLoadSave,
    handleGoToSettings,
    handleExit,
    toggleStreamResponse,
    handleUpdateContextConfig,
    handleTawaConfigChange,

    isMobile,
    AIMonitor,
    lsrTables,
    lsrRuntimeData,
    handleUpdateLsrData,
    activeLsrTableId,
    setActiveLsrTableId,
    lsrViewMode,
    setLsrViewMode,
    tavoSelectState,
    setTavoSelectState,
    gameInputRef,
    isTavernHelperReady,

    fateSettings,
    showFateSettingsModal,
    setShowFateSettingsModal,
    showFateRollModal,
    setShowFateRollModal,
    pendingActionText,
    handleUpdateFateSettings,
  };
};
