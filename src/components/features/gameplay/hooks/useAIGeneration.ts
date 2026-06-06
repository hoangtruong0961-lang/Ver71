import { useState, useRef, useCallback } from "react";
import { ChatMessage, WorldData, AppSettings, GameTime, TawaPresetConfig } from "../../../../types";
import { gameplayAiService } from "../../../../services/ai/gameplay/service";
import { storyBibleService } from "../../../../services/ai/storyBibleService";
import { dbService } from "../../../../services/db/indexedDB";
import { Mem0Service } from "../../../../services/ai/memory/Mem0Service";
import { LsrParser } from "../../../../services/lsr/LsrParser";
import { getRegexedString, extractTagContent, parseChoices } from "../../../../utils/regex";
import { advanceTime } from "../../../../utils/timeUtils";

interface AIGenerationProps {
  activeWorld: WorldData | null;
  activeWorldRef: React.RefObject<WorldData | null>;
  history: ChatMessage[];
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  historyRef: React.RefObject<ChatMessage[]>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  lastActionRef: React.RefObject<string>;
  turnCount: number;
  setTurnCount: React.Dispatch<React.SetStateAction<number>>;
  turnCountRef: React.RefObject<number>;
  gameTime: GameTime;
  setGameTime: React.Dispatch<React.SetStateAction<GameTime>>;
  gameTimeRef: React.RefObject<GameTime>;
  lsrRuntimeData: any;
  setLsrRuntimeData: React.Dispatch<React.SetStateAction<any>>;
  lsrRuntimeDataRef: React.RefObject<any>;
  settings: AppSettings | null;
  dynamicRules: string[];
  dynamicRulesRef: React.RefObject<string[]>;
  tawaPresetConfig: TawaPresetConfig | null;
  tawaPresetConfigRef: React.RefObject<TawaPresetConfig | null>;
  combinedRegexScriptsRef: React.RefObject<any[]>;
  shouldAutoScrollRef: React.RefObject<boolean>;
  updateTokenHistory: (tokens: number, text: string) => void;
  syncWorldState: (
    historyList: ChatMessage[],
    turnCountVal: number,
    timeVal: GameTime,
    lsrData?: any,
    incrementalSummary?: string,
  ) => void;
  triggerAutosave: (
    historyList: ChatMessage[],
    turnCountVal: number,
    timeVal: GameTime,
    lsrData?: any,
  ) => void;
  checkDeathStatus: (
    historyList: ChatMessage[],
    lsrData?: Record<string, unknown[]>,
  ) => boolean;
  triggerPermadeath: () => Promise<void>;
}

export function useAIGeneration({
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
}: AIGenerationProps) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreamGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [setIsLoading]);

  const processAIResponse = useCallback(
    async (
      responseText: string,
      initial = false,
      time?: GameTime,
      alternateGreetings?: string[],
      groundingSources?: { title: string; uri: string }[],
      deepLogicResult?: any,
    ) => {
      const branchesContent =
        extractTagContent(responseText, "branches") ||
        extractTagContent(responseText, "choices") ||
        extractTagContent(responseText, "actions");
      const choicesList = parseChoices(branchesContent);

      const setTimeStr = extractTagContent(responseText, "set_time");
      let updatedTime = time || gameTimeRef.current;

      if (setTimeStr) {
        const parts = setTimeStr.split("|").map((p) => parseInt(p.trim(), 10));
        if (parts.length === 5 && !parts.some(isNaN)) {
          updatedTime = {
            year: parts[0],
            month: parts[1],
            day: parts[2],
            hour: parts[3],
            minute: parts[4],
          };
        }
      } else {
        const timeCostStr = extractTagContent(responseText, "time_cost");
        let timeCost = parseInt(timeCostStr || (initial ? "0" : "1"), 10);
        if (!initial && (isNaN(timeCost) || timeCost < 1)) timeCost = 1;

        if (timeCost > 0 || initial) {
          updatedTime = advanceTime(updatedTime, timeCost);
        }
      }

      setGameTime(updatedTime);

      const incrementalSummary = extractTagContent(
        responseText,
        "incrementalSummary",
      );

      let finalResponseText = responseText;
      const isDebugAI =
        typeof window !== "undefined" &&
        (window as any).__TAWA_REGEX_DEBUG__ === true;
      const playerNameToUse = activeWorldRef.current?.player?.name || "User";

      const applyRegex = (text: string) => {
        let result = text;
        if (combinedRegexScriptsRef.current) {
          result = getRegexedString(
            result,
            3,
            combinedRegexScriptsRef.current,
            {
              userName: playerNameToUse,
              charName: "Character",
              depth: 0,
              isDebug: isDebugAI,
              isPrompt: false,
              isMarkdown: false,
            },
          );
          result = getRegexedString(
            result,
            2,
            combinedRegexScriptsRef.current,
            {
              userName: playerNameToUse,
              charName: "Character",
              depth: 0,
              isDebug: isDebugAI,
              isPrompt: false,
              isMarkdown: false,
            },
          );
        }
        return result;
      };

      finalResponseText = applyRegex(finalResponseText);

      let finalSwipes = [finalResponseText];
      if (alternateGreetings && alternateGreetings.length > 0) {
        finalSwipes = [finalResponseText, ...alternateGreetings.map(applyRegex)];
      }

      let presetName = "Mặc định";
      try {
        const activeId =
          dbService.getKeyValueSync("tawa_active_preset_id_v4") || "default";
        const presetsRaw = dbService.getKeyValueSync("tawa_presets_list_v4");
        if (presetsRaw) {
          const presets =
            typeof presetsRaw === "string" ? JSON.parse(presetsRaw) : presetsRaw;
          const active = presets.find((p: any) => p.id === activeId);
          if (active) presetName = active.name;
        }
      } catch (e: any) {
        console.warn("processAIResponse: Failed to parse presets:", e);
      }

      const currentPresetForMeta = tawaPresetConfigRef.current;
      const cotUsedValue = currentPresetForMeta?.assistant_prefill
        ? `Prefill: ${currentPresetForMeta.assistant_prefill}`
        : "Không dùng";

      const metadata = {
        presetUsed: presetName,
        cotUsed: cotUsedValue,
        worldInfoConfig: `${activeWorldRef.current?.entities?.length || 0} Entities`,
      };

      const modelMsg: ChatMessage = {
        role: "model",
        text: finalResponseText,
        timestamp: Date.now(),
        gameTime: updatedTime,
        choices: choicesList,
        swipes: finalSwipes,
        swipeIndex: 0,
        turnNumber: initial ? 0 : turnCountRef.current + 1,
        userAction: initial ? undefined : lastActionRef.current,
        incrementalSummary: incrementalSummary,
        metadata: metadata,
        groundingSources: undefined,
        deepLogicResult: deepLogicResult,
      };

      const newHistory = [...historyRef.current, modelMsg];
      const tableStored = extractTagContent(responseText, "table_stored");
      let nextLsrData = lsrRuntimeDataRef.current;
      if (tableStored) {
        const parsedData = LsrParser.parseLsrString(tableStored);
        if (Object.keys(parsedData).length > 0) {
          nextLsrData = parsedData;
          setLsrRuntimeData(nextLsrData);
        }
      } else {
        const tableEdit = extractTagContent(responseText, "tableEdit");
        if (tableEdit) {
          const parsedEdits = LsrParser.parseLsrString(tableEdit);
          if (Object.keys(parsedEdits).length > 0) {
            nextLsrData = LsrParser.mergeLsrData(
              lsrRuntimeDataRef.current,
              parsedEdits,
            );
            setLsrRuntimeData(nextLsrData);
          }
        }
      }

      if (!initial && settings) {
        try {
          const auditedLsr = await gameplayAiService.auditLsrUpdates(
            lastActionRef.current || "",
            responseText,
            nextLsrData,
            settings,
          );
          nextLsrData = auditedLsr;
          setLsrRuntimeData(nextLsrData);
        } catch (auditErr) {
          console.warn("Failed to audit LSR:", auditErr);
        }
      }

      setHistory(newHistory);

      const win = window as any;
      if (win.eventSource) {
        win.eventSource.emit("generation_ended", responseText);
        win.eventSource.emit("message_received", modelMsg);
        win.eventSource.emit("character_message_rendered", modelMsg);
      }

      const dead = checkDeathStatus(newHistory, nextLsrData);
      if (dead) {
        triggerPermadeath();
      }

      if (!initial) {
        const newTurnCount = turnCountRef.current + 1;
        setTurnCount(newTurnCount);
        syncWorldState(
          newHistory,
          newTurnCount,
          updatedTime,
          nextLsrData,
          incrementalSummary,
        );
        triggerAutosave(newHistory, newTurnCount, updatedTime, nextLsrData);

        // Run Mem0 memory background updater asynchronously
        if (settings && activeWorldRef.current) {
          const campaignId = activeWorldRef.current.id || "default";
          const userInputText = lastActionRef.current || "";
          Mem0Service.updateMemoriesFromTurn(
            userInputText,
            finalResponseText,
            campaignId,
            settings,
            newTurnCount,
            activeWorldRef.current
          ).catch((mErr) => {
            console.error("[Mem0] Background updater failed:", mErr);
          });
        }
      } else {
        syncWorldState(
          newHistory,
          turnCountRef.current,
          updatedTime,
          nextLsrData,
          incrementalSummary,
        );
        triggerAutosave(
          newHistory,
          turnCountRef.current,
          updatedTime,
          nextLsrData,
        );
      }
      setIsLoading(false);
    },
    [
      activeWorldRef,
      combinedRegexScriptsRef,
      setGameTime,
      setLsrRuntimeData,
      setHistory,
      setIsLoading,
      setTurnCount,
      syncWorldState,
      triggerAutosave,
      checkDeathStatus,
      triggerPermadeath,
      gameTimeRef,
      lastActionRef,
      turnCountRef,
      lsrRuntimeDataRef,
      tawaPresetConfigRef,
      historyRef,
      settings,
    ],
  );

  const runStreamGeneration = useCallback(
    async (
      userInput: string,
      currentHistory: ChatMessage[],
      currentSettings: AppSettings,
      regenerateIndex?: number,
      world?: WorldData,
      time?: GameTime,
    ) => {
      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      const win = window as any;
      if (win.eventSource) {
        win.eventSource.emit("generation_started", {
          userInput,
          turnCount: turnCountRef.current,
        });
      }

      try {
        const targetWorld = world || activeWorldRef.current;
        const currentLsrData = lsrRuntimeDataRef.current;
        const effectiveWorldData: WorldData = {
          ...targetWorld!,
          lsrData: currentLsrData,
          gameTime: time || gameTimeRef.current,
          savedState: {
            history: currentHistory,
            turnCount: turnCountRef.current,
            gameTime: time || gameTimeRef.current,
          },
          config: {
            ...targetWorld!.config,
            rules: dynamicRulesRef.current,
            tawaPreset: tawaPresetConfigRef.current || undefined,
            regexScripts: combinedRegexScriptsRef.current || [],
          },
        };

        const workingHistory =
          regenerateIndex !== undefined
            ? [...currentHistory.slice(0, regenerateIndex + 1)]
            : [...currentHistory];
        let targetIndex = regenerateIndex;

        let presetName = "Mặc định";
        try {
          const activeId =
            dbService.getKeyValueSync("tawa_active_preset_id_v4") || "default";
          const presetsRaw = dbService.getKeyValueSync("tawa_presets_list_v4");
          if (presetsRaw) {
            const presets =
              typeof presetsRaw === "string" ? JSON.parse(presetsRaw) : presetsRaw;
            const active = presets.find((p: any) => p.id === activeId);
            if (active) presetName = active.name;
          }
        } catch {}

        const cotUsedValue = tawaPresetConfigRef.current?.assistant_prefill
          ? `Prefill: ${tawaPresetConfigRef.current.assistant_prefill}`
          : "Không dùng";

        const defaultMetadata = {
          presetUsed: presetName,
          cotUsed: cotUsedValue,
          worldInfoConfig: `${targetWorld?.entities?.length || 0} Entities`,
        };

        if (targetIndex === undefined) {
          const placeholderMsg: ChatMessage = {
            role: "model",
            text: "",
            timestamp: Date.now(),
            gameTime: time || gameTimeRef.current,
            swipes: [""],
            swipeIndex: 0,
            choices: [],
            turnNumber: currentHistory.length === 0 ? 0 : turnCountRef.current + 1,
            userAction: currentHistory.length === 0 ? undefined : userInput,
            metadata: defaultMetadata,
          };
          workingHistory.push(placeholderMsg);
          targetIndex = workingHistory.length - 1;
          setHistory([...workingHistory]);
        } else {
          const msg = { ...(workingHistory[targetIndex] || {}) } as ChatMessage;
          if (!msg.role) msg.role = "model";
          msg.metadata = defaultMetadata;

          const newSwipes = [...(msg.swipes || [msg.text || ""]), ""];
          msg.swipes = newSwipes;
          msg.swipeIndex = newSwipes.length - 1;
          msg.text = "";

          if (msg.turnNumber === undefined) {
            msg.turnNumber = targetIndex === 0 ? 0 : turnCountRef.current;
          }
          if (msg.userAction === undefined && targetIndex > 0) {
            msg.userAction = userInput;
          }

          workingHistory[targetIndex] = msg;
          setHistory([...workingHistory]);
        }

        await new Promise((r) => setTimeout(r, 0));

        const stream = gameplayAiService.generateStoryTurnStream(
          userInput,
          regenerateIndex !== undefined
            ? currentHistory.slice(0, regenerateIndex)
            : currentHistory,
          effectiveWorldData,
          currentSettings,
          tawaPresetConfigRef.current || undefined,
          time || gameTimeRef.current,
          abortControllerRef.current.signal,
        );

        let accumulatedText = "";
        let lastTokenCount = 0;
        let lastUIUpdateTime = 0;
        const UI_UPDATE_INTERVAL = 150;
        const groundingSources: { title: string; uri: string }[] = [];
        let deepLogicResult: any = null;

        for await (const chunk of stream) {
          if (typeof chunk === "string") {
            accumulatedText += chunk;
          } else {
            if (chunk.text) accumulatedText += chunk.text;
            if (chunk.usageMetadata?.totalTokenCount) {
              lastTokenCount = chunk.usageMetadata.totalTokenCount;
            }
            if (chunk.deepLogicResult) {
              deepLogicResult = chunk.deepLogicResult;
            }
            const gChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (gChunks && Array.isArray(gChunks)) {
              gChunks.forEach((gChunk: any) => {
                if (gChunk.web && gChunk.web.uri && gChunk.web.title) {
                  if (!groundingSources.some((s) => s.uri === gChunk.web.uri)) {
                    groundingSources.push({
                      title: gChunk.web.title,
                      uri: gChunk.web.uri,
                    });
                  }
                }
              });
            }
          }

          const now = Date.now();
          if (now - lastUIUpdateTime > UI_UPDATE_INTERVAL) {
            if (targetIndex !== undefined && workingHistory[targetIndex]) {
              const msg = { ...workingHistory[targetIndex] };
              const swipes = [...(msg.swipes || [""])];
              const currentSwipeIdx = msg.swipeIndex || 0;

              let displayContent = accumulatedText;
              const thinkingPatterns = [
                /<(?:thinking|think|thinhking|thought|thoughts)>[\s\S]*?<\/(?:thinking|think|thinhking|thought|thoughts)>/gi,
                /<(?:thinking|think|thinhking|thought|thoughts)>[\s\S]*$/gi,
              ];
              thinkingPatterns.forEach((pattern) => {
                displayContent = displayContent.replace(pattern, "");
              });

              swipes[currentSwipeIdx] = displayContent;

              const branchesContent =
                extractTagContent(accumulatedText, "branches") ||
                extractTagContent(accumulatedText, "choices") ||
                extractTagContent(accumulatedText, "actions");
              const choicesList = parseChoices(branchesContent);

              msg.swipes = swipes;
              msg.text = displayContent;
              msg.choices = choicesList;
              msg.groundingSources =
                groundingSources.length > 0 ? groundingSources : undefined;
              msg.deepLogicResult = deepLogicResult;

              workingHistory[targetIndex] = msg;
              setHistory([...workingHistory]);
              lastUIUpdateTime = now;
            }
          }
        }

        // Final completion logic
        if (lastTokenCount > 0) {
          updateTokenHistory(lastTokenCount, accumulatedText);
        } else if (accumulatedText.length > 0) {
          const estimatedTokens = Math.ceil(accumulatedText.length / 4);
          updateTokenHistory(estimatedTokens, accumulatedText);
        }

        const alternateGreetings: string[] = [];
        await processAIResponse(
          accumulatedText,
          false,
          time || gameTimeRef.current,
          alternateGreetings,
          groundingSources.length > 0 ? groundingSources : undefined,
          deepLogicResult,
        );
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream generation aborted cleanly.");
        } else {
          console.error("runStreamGeneration failed:", err);
          setIsLoading(false);
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      activeWorldRef,
      lsrRuntimeDataRef,
      gameTimeRef,
      dynamicRulesRef,
      tawaPresetConfigRef,
      combinedRegexScriptsRef,
      setHistory,
      setIsLoading,
      updateTokenHistory,
      processAIResponse,
      turnCountRef,
    ],
  );

  const updateMessageSwipes = useCallback(
    (index: number, newText: string, overrideTime?: GameTime) => {
      const tableStored = extractTagContent(newText, "table_stored");
      let nextLsrData = lsrRuntimeDataRef.current;
      if (tableStored) {
        nextLsrData = LsrParser.parseLsrString(tableStored);
        setLsrRuntimeData(nextLsrData);
      } else {
        const tableEdit = extractTagContent(newText, "tableEdit");
        if (tableEdit) {
          const parsedEdits = LsrParser.parseLsrString(tableEdit);
          nextLsrData = LsrParser.mergeLsrData(
            lsrRuntimeDataRef.current,
            parsedEdits,
          );
          setLsrRuntimeData(nextLsrData);
        }
      }

      setHistory((prev) => {
        const updated = prev.slice(0, index + 1);
        const msg = { ...(updated[index] || {}) } as ChatMessage;

        if (!msg.role) msg.role = "model";

        const branchesContent =
          extractTagContent(newText, "branches") ||
          extractTagContent(newText, "choices") ||
          extractTagContent(newText, "actions");
        const choicesList = parseChoices(branchesContent);

        const currentSwipes = msg.swipes || [msg.text];
        const newSwipes = [...currentSwipes, newText];

        msg.swipes = newSwipes;
        msg.swipeIndex = newSwipes.length - 1;
        msg.text = newText;
        msg.choices = choicesList;

        let finalTime = overrideTime || gameTime;
        const setTimeStr = extractTagContent(newText, "set_time");
        if (setTimeStr) {
          const parts = setTimeStr.split("|").map((p) => parseInt(p.trim(), 10));
          if (parts.length === 5 && !parts.some(isNaN)) {
            finalTime = {
              year: parts[0],
              month: parts[1],
              day: parts[2],
              hour: parts[3],
              minute: parts[4],
            };
          }
        } else {
          const timeCostStr = extractTagContent(newText, "time_cost");
          let timeCost = parseInt(timeCostStr || "1", 10);
          if (isNaN(timeCost) || timeCost < 1) timeCost = 1;
          finalTime = advanceTime(finalTime, timeCost);
        }

        msg.gameTime = finalTime;
        setGameTime(finalTime);

        const incrementalSummary = extractTagContent(
          newText,
          "incrementalSummary",
        );
        msg.incrementalSummary = incrementalSummary;

        if (msg.turnNumber === undefined) {
          msg.turnNumber = index === 0 ? 0 : turnCount;
        }
        if (msg.userAction === undefined && index > 0) {
          msg.userAction = updated[index - 1].text;
        }

        updated[index] = msg;

        syncWorldState(
          updated,
          turnCount,
          finalTime,
          nextLsrData,
          incrementalSummary,
        );
        return updated;
      });
    },
    [
      gameTime,
      setGameTime,
      setLsrRuntimeData,
      setHistory,
      syncWorldState,
      turnCount,
      lsrRuntimeDataRef,
    ],
  );

  const handleSendInitial = useCallback(
    async (currentSettings: AppSettings, world: WorldData, time: GameTime) => {
      setIsLoading(true);
      if (shouldAutoScrollRef) shouldAutoScrollRef.current = true;

      try {
        const campaignId =
          world.id ||
          `campaign-${world.world?.worldName?.replace(/\s+/g, "")}-${world.player?.name?.replace(/\s+/g, "")}`;
        storyBibleService
          .initialize(world, currentSettings, campaignId)
          .catch((err) => {
            console.error("Background StoryBible init failed", err);
          });
      } catch (e) {
        console.error("Failed to start StoryBible init", e);
      }

      if (
        world.world?.firstMessage &&
        world.world?.firstMessage.trim().length > 0
      ) {
        let rawFirstMsg = world.world?.firstMessage.trim();

        const playerName = world.player?.name || "User";
        const charName = world.entities?.[0]?.name || "Character";

        const replaceMacros = (text: string) => {
          const res = text.replace(/\{\{\s*user\s*\}\}/gi, playerName);
          return res.replace(/\{\{\s*char\s*\}\}/gi, charName);
        };

        rawFirstMsg = replaceMacros(rawFirstMsg);
        const alternateGreetings =
          world.entities?.[0]?.alternate_greetings?.map(replaceMacros) || [];

        processAIResponse(rawFirstMsg, true, time, alternateGreetings);
        return;
      }

      const startingScenario = world.world.startingScenario || "";
      const initialPrompt = startingScenario
        ? `Hãy bắt đầu câu chuyện dựa trên kịch bản khởi đầu này: "${startingScenario}". Hãy viết một mở đầu cực kỳ ấn tượng, sống động và lôi cuốn.`
        : "Hãy bắt đầu câu chuyện một cách tự nhiên và lôi cuốn nhất dựa trên bối cảnh thế giới và nhân vật đã thiết lập. Hãy thiết lập bối cảnh hiện tại một cách sống động.";

      if (currentSettings.streamResponse) {
        await runStreamGeneration(
          initialPrompt,
          [],
          currentSettings,
          undefined,
          world,
          time,
        );
      } else {
        const opening = await gameplayAiService.generateStoryTurn(
          initialPrompt,
          [],
          world,
          currentSettings,
          tawaPresetConfig,
          time,
        );
        if (opening.usage?.totalTokenCount) {
          updateTokenHistory(opening.usage.totalTokenCount, opening.text);
        } else if (opening.text) {
          const estimatedTokens = Math.ceil(opening.text.length / 4);
          updateTokenHistory(estimatedTokens, opening.text);
        }
        processAIResponse(opening.text, true, time);
      }
    },
    [
      runStreamGeneration,
      processAIResponse,
      tawaPresetConfig,
      updateTokenHistory,
      setIsLoading,
      shouldAutoScrollRef,
    ],
  );

  return {
    runStreamGeneration,
    stopStreamGeneration,
    processAIResponse,
    updateMessageSwipes,
    handleSendInitial,
  };
}
