import { useState, useEffect, useRef, useCallback } from "react";
import _ from "lodash";
import { ChatMessage, WorldData, GameTime } from "../../../../types";
import { dbService } from "../../../../services/db/indexedDB";
import { tavoRegistry } from "../../../../services/api/tavoApi";

interface ExternalBridgeProps {
  activeWorld: WorldData | null;
  activeWorldRef: React.RefObject<WorldData | null>;
  historyRef: React.RefObject<ChatMessage[]>;
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  gameTimeRef: React.RefObject<GameTime>;
  turnCountRef: React.RefObject<number>;
  syncWorldState: (
    historyList: ChatMessage[],
    turnCountVal: number,
    timeVal: GameTime,
    lsrData?: any,
    incrementalSummary?: string,
  ) => void;
  onUpdateWorld: ((data: Partial<WorldData>) => void) | undefined;
  setIsInputCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  handleSendRef: React.RefObject<((text: string) => Promise<void>) | null>;
}

export function useExternalBridge({
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
}: ExternalBridgeProps) {
  const [isTavernHelperReady, setIsTavernHelperReady] = useState(false);
  const isTavernHelperReadyRef = useRef(false);

  useEffect(() => {
    isTavernHelperReadyRef.current = isTavernHelperReady;
  }, [isTavernHelperReady]);

  const [tavoSelectState, setTavoSelectState] = useState<{
    options: any[];
    title?: string;
    defaultValue?: any;
    resolve: (val: any) => void;
  } | null>(null);

  useEffect(() => {
    tavoRegistry.activeWorld = activeWorld || null;
    tavoRegistry.updateWorld = onUpdateWorld || null;
    tavoRegistry.getHistory = () => historyRef.current || [];
    tavoRegistry.updateHistory = (historyList: ChatMessage[]) => {
      setHistory(historyList);
      syncWorldState(
        historyList,
        turnCountRef.current || 0,
        gameTimeRef.current,
      );
    };
  }, [
    activeWorld,
    onUpdateWorld,
    setHistory,
    historyRef,
    turnCountRef,
    gameTimeRef,
    syncWorldState,
  ]);

  useEffect(() => {
    // 1. Definition of Event Emitter, SlashCommandParser, and Extension Settings Storage Proxy
    class SimpleEventEmitter {
      private listeners: { [event: string]: Function[] } = {};

      on(event: string, callback: Function) {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
      }

      off(event: string, callback: Function) {
        if (!this.listeners[event]) return this;
        this.listeners[event] = this.listeners[event].filter(
          (cb) => cb !== callback,
        );
        return this;
      }

      emit(event: string, ...args: any[]) {
        if (!this.listeners[event]) return false;
        this.listeners[event].forEach((cb) => {
          try {
            cb(...args);
          } catch (e) {
            console.error(
              `[EventSource Bridge] Error in listener for event ${event}:`,
              e,
            );
          }
        });
        return true;
      }
    }

    class SlashCommandParser {
      static commands: { [name: string]: any } = {};

      static addCommandObject(cmdObj: any) {
        if (!cmdObj || !cmdObj.name) return;
        const name = cmdObj.name.toLowerCase();
        this.commands[name] = cmdObj;
        if (Array.isArray(cmdObj.aliases)) {
          cmdObj.aliases.forEach((alias: string) => {
            this.commands[alias.toLowerCase()] = cmdObj;
          });
        }
        console.log(`[SlashCommandParser] Registered command: /${name}`);
      }

      static getCommand(name: string) {
        return this.commands[name.toLowerCase()];
      }

      addCommandObject(cmdObj: any) {
        SlashCommandParser.addCommandObject(cmdObj);
      }
    }

    const eventSource = new SimpleEventEmitter();
    const event_types = {
      MESSAGE_RECEIVED: "message_received",
      MESSAGE_SENT: "message_sent",
      CHAT_CHANGED: "chat_changed",
      CHARACTER_MESSAGE_RENDERED: "character_message_rendered",
      GENERATION_STARTED: "generation_started",
      GENERATION_ENDED: "generation_ended",
      GENERATE_BEFORE_COMBINE_PROMPTS: "generate_before_combine_prompts",
      SYSTEM_MESSAGE_RECEIVED: "system_message_received",
      USER_MESSAGE_RENDERED: "user_message_rendered",
    };

    (window as any).eventSource = eventSource;
    (window as any).event_types = event_types;
    (window as any).SlashCommandParser = SlashCommandParser;
    (window as any).promptMiddleware = (window as any).promptMiddleware || [];

    const rawSettings: any = {};
    let debounceTimer: any = null;

    const saveSettingsDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const settingsObj = await dbService.getSettings();
          const existingExtSettings = settingsObj.extensionSettings || {};
          const worldId = activeWorldRef.current?.id || "default";

          await dbService.saveSettings({
            ...settingsObj,
            extensionSettings: {
              ...existingExtSettings,
              [worldId]: { ...rawSettings },
            },
          } as any);
          console.log(
            `[TavernHelper Bridge] Saved extension settings for world ${worldId} to DB:`,
            rawSettings,
          );
        } catch (e) {
          console.error(
            "[TavernHelper Bridge] Error saving extension settings:",
            e,
          );
        }
      }, 300);
    };

    (window as any).saveSettingsDebounced = saveSettingsDebounced;

    const makeDeepProxy = (obj: any, onWrite: () => void): any => {
      if (obj !== null && typeof obj === "object") {
        return new Proxy(obj, {
          get(target, prop) {
            if (typeof prop === "symbol") return Reflect.get(target, prop);
            const val = target[prop.toString()];
            if (val !== null && typeof val === "object") {
              return makeDeepProxy(val, onWrite);
            }
            return val;
          },
          set(target, prop, value) {
            if (typeof prop === "symbol") return Reflect.set(target, prop, value);
            target[prop.toString()] = value;
            onWrite();
            return true;
          },
          deleteProperty(target, prop) {
            if (typeof prop === "symbol")
              return Reflect.deleteProperty(target, prop);
            delete target[prop.toString()];
            onWrite();
            return true;
          },
        });
      }
      return obj;
    };

    (window as any).extension_settings = makeDeepProxy(
      rawSettings,
      saveSettingsDebounced,
    );

    // TavernHelper Cache
    const tavernHelperCache: any = {
      presets: [],
      loadedPresetName: "Tawa Re = YIL丨Alpha V1",
      worldbooks: [],
      globalWorldbooks: [],
      variables: {},
    };

    // Prefetch all data for TavernHelper synchronously caching
    const initTavernHelper = async () => {
      setIsTavernHelperReady(false);
      try {
        const { tavoApi } = await import("../../../../services/api/tavoApi");
        const dbPresets = await tavoApi.preset.all();
        const fullPresets = [];
        for (const p of dbPresets) {
          const full = await tavoApi.preset.get(p.id);
          if (full) fullPresets.push(full);
        }

        let hasTawaPreset = fullPresets.some(
          (p: any) =>
            p.name === "Tawa Re = YIL" ||
            p.name === "Tawa Re = YIL丨Alpha V1",
        );
        if (!hasTawaPreset) {
          try {
            const tawaData = await import(
              "../../../../assets/presets/tawa_re_yil.json"
            );
            if (tawaData) {
              fullPresets.push({
                id: "builtin_tawa_re_yil",
                name: "Tawa Re = YIL丨Alpha V1",
                prompts: tawaData.prompts || [],
                extensions: tawaData.extensions || {},
              });
            }
          } catch (e) {}
        }

        let hasTawaDeltaPreset = fullPresets.some(
          (p: any) =>
            p.id === "builtin_tawa_delta" ||
            p.name === "Tawa Delta Combined" ||
            p.name === "Tawa Delta Combined丨Mới Nhất",
        );
        if (!hasTawaDeltaPreset) {
          try {
            const tawaDeltaData = await import(
              "../../../../assets/presets/tawa_delta_combined.json"
            );
            if (tawaDeltaData) {
              fullPresets.push({
                id: "builtin_tawa_delta",
                name: "Tawa Delta Combined丨Mới Nhất",
                prompts: tawaDeltaData.prompts || tawaDeltaData.modules || [],
                extensions: tawaDeltaData.extensions || {},
              });
            }
          } catch (e) {}
        }
        tavernHelperCache.presets = fullPresets;

        const dbWbs = await tavoApi.lorebook.all();
        tavernHelperCache.worldbooks = dbWbs;

        const activeWorld = activeWorldRef.current;
        const variablesObj = activeWorld?.tavoVars || {};

        const currentChatInfo = await tavoApi.chat.current();
        const activeLobNames =
          currentChatInfo?.lorebooks?.map((l: any) => l.name) || [];
        tavernHelperCache.globalWorldbooks = activeLobNames;

        let globalVars = {};
        try {
          const settingsObj = await dbService.getSettings();
          globalVars = settingsObj?.tavoGlobalVars || {};

          // Prefetch extension settings
          const extSettings = settingsObj?.extensionSettings || {};
          const worldId = activeWorld?.id || "default";
          const worldExtSettings = extSettings[worldId] || {};

          // Clear active memory settings to prevent cross-leakage
          for (const key in rawSettings) {
            delete rawSettings[key];
          }
          for (const key in worldExtSettings) {
            rawSettings[key] = worldExtSettings[key];
          }
          console.log(
            `[TavernHelper Bridge] Successfully hydrated extension settings for world ${worldId}:`,
            rawSettings,
          );
        } catch (e) {}

        tavernHelperCache.variables = { ...globalVars, ...variablesObj };
        tavernHelperCache.loadedPresetName =
          activeWorld?.extensions?.presetName || "Tawa Re = YIL丨Alpha V1";

        // Emit chat_changed on load/init
        eventSource.emit("chat_changed", activeWorld?.id);
      } catch (err) {
        console.error("[TavernHelper Bridge] Initialization error:", err);
      } finally {
        setIsTavernHelperReady(true);
      }
    };

    initTavernHelper();

    // 2. Define SillyTavern & jQuery bridge on window
    const stBridge: any = {
      eventSource: eventSource,
      event_types: event_types,
      getContext: () => ({
        getCurrentChatId: () => activeWorldRef.current?.id || "default",
        chatId: activeWorldRef.current?.id || "default",
        characterId: activeWorldRef.current?.world?.characterId || 0,
        characters: [
          {
            name: activeWorldRef.current?.world?.name || "Character",
            chat: activeWorldRef.current?.id || "default",
          },
        ],
        executeSlashCommands: (command: string) => {
          (window as any).executeSlashCommands?.(command);
        },
        typeInput: (text: string) => {
          tavoRegistry.setInputValue?.(text);
          setIsInputCollapsed(false);
        },
        sendInput: () => {
          tavoRegistry.sendInput?.();
        },
      }),
      triggerSlash: (command: string) => {
        (window as any).executeSlashCommands?.(command);
      },
    };

    const jqBridge = function (selector: string) {
      if (typeof selector !== "string")
        return {
          val: () => "",
          trigger: () => jqBridge,
          click: () => jqBridge,
          focus: () => jqBridge,
        };

      const isTextarea =
        selector.includes("send_textarea") ||
        selector.includes("textarea") ||
        selector.includes("chat-textarea");
      const isSendButton =
        selector.includes("send_btn") || selector.includes("send-btn");

      if (isTextarea) {
        return {
          val: function (value?: string) {
            if (value !== undefined) {
              tavoRegistry.setInputValue?.(value);
              setIsInputCollapsed(false);
              return this;
            }
            return tavoRegistry.getInputValue?.() || "";
          },
          trigger: function (eventName: string) {
            return this;
          },
          focus: function () {
            tavoRegistry.focusInput?.();
            return this;
          },
        };
      }

      if (isSendButton) {
        return {
          click: function () {
            tavoRegistry.sendInput?.();
            return this;
          },
        };
      }

      try {
        const el = document.querySelector(selector);
        if (el) {
          return {
            val: function (val?: string) {
              if (val !== undefined) (el as any).value = val;
              return val !== undefined ? this : (el as any).value;
            },
            click: function () {
              el.click();
              return this;
            },
            trigger: function () {
              return this;
            },
            focus: function () {
              el.focus();
              return this;
            },
          };
        }
      } catch (e) {}

      return {
        val: () => "",
        trigger: function () {
          return this;
        },
        click: function () {
          return this;
        },
        focus: function () {
          return this;
        },
      };
    };

    // TavernHelper full bridge implementation
    const tavernHelper = {
      getPresetNames: () => {
        return tavernHelperCache.presets.map(
          (p: any) => p.name || "Unnamed Preset",
        );
      },
      getPreset: (name: string) => {
        const preset = tavernHelperCache.presets.find(
          (p: any) => p.name === name || p.id === name,
        );
        if (!preset) {
          return {
            name: name,
            prompts: [],
            extensions: { regex_scripts: [] },
          };
        }
        return preset;
      },
      getLoadedPresetName: () => {
        return tavernHelperCache.loadedPresetName;
      },
      getWorldbookNames: () => {
        return tavernHelperCache.worldbooks.map(
          (wb: any) => wb.name || "Unnamed Lorebook",
        );
      },
      getWorldbooks: () => {
        return tavernHelperCache.worldbooks || [];
      },
      getWorldbook: (name: string) => {
        return tavernHelperCache.worldbooks.find((wb: any) => wb.name === name);
      },
      getGlobalWorldbookNames: () => {
        return tavernHelperCache.globalWorldbooks;
      },
      rebindGlobalWorldbooks: async (newList: string[]) => {
        console.log("[TavernHelper] Rebinding global worldbooks:", newList);
        tavernHelperCache.globalWorldbooks = newList;

        try {
          const { tavoApi } = await import("../../../../services/api/tavoApi");
          const activeChat = await tavoApi.chat.current();
          if (activeChat) {
            const updatedLorebooks = newList.map((name) => {
              const found = tavernHelperCache.worldbooks.find(
                (wb: any) => wb.name === name,
              );
              return {
                id: found?.id || Date.now(),
                name: name,
                entries: found?.entries || [],
              };
            });

            await tavoApi.chat.update({
              ...activeChat,
              lorebooks: updatedLorebooks,
            });

            if (onUpdateWorld && activeWorldRef.current) {
              onUpdateWorld({
                ...activeWorldRef.current,
                lorebook: updatedLorebooks[0]
                  ? {
                      name: updatedLorebooks[0].name,
                      entries: updatedLorebooks[0].entries,
                    }
                  : undefined,
              });
            }
          }
        } catch (e) {
          console.error("[TavernHelper Bridge] rebindGlobalWorldbooks error:", e);
        }
        return true;
      },
      updatePresetWith: async (presetName: string, data: any) => {
        console.log("[TavernHelper] Updating preset:", presetName, data);
        let presetIdx = tavernHelperCache.presets.findIndex(
          (p: any) => p.name === presetName || p.id === presetName,
        );

        try {
          const { tavoApi } = await import("../../../../services/api/tavoApi");
          if (presetIdx !== -1) {
            const updatedPreset = {
              ...tavernHelperCache.presets[presetIdx],
              ...data,
            };
            tavernHelperCache.presets[presetIdx] = updatedPreset;
            await tavoApi.preset.update(updatedPreset);
          } else {
            const newPreset = { id: presetName, name: presetName, ...data };
            tavernHelperCache.presets.push(newPreset);
            await tavoApi.preset.create(newPreset);
          }
          window.dispatchEvent(
            new CustomEvent("tavo_presets_updated", {
              detail: { presetName, data },
            }),
          );
        } catch (e) {
          console.error("[TavernHelper Bridge] updatePresetWith error:", e);
        }
        return true;
      },
      getVariables: () => {
        return tavernHelperCache.variables;
      },
      getCurrentMessageId: () => {
        const messages = historyRef.current || [];
        return messages.length > 0 ? messages.length - 1 : 0;
      },
      updateVariablesWith: async (data: any) => {
        console.log("[TavernHelper] Updating variables:", data);
        if (!data || typeof data !== "object") return false;

        try {
          const { tavoApi } = await import("../../../../services/api/tavoApi");
          tavernHelperCache.variables = {
            ...tavernHelperCache.variables,
            ...data,
          };
          for (const key in data) {
            await tavoApi.set(key, data[key], "chat");
            window.dispatchEvent(
              new CustomEvent("tavo_vars_updated", {
                detail: { key, val: data[key] },
              }),
            );
          }
        } catch (e) {
          console.error("[TavernHelper Bridge] updateVariablesWith error:", e);
        }
        return true;
      },
      updateWorldbookWith: async (name: string, data: any) => {
        console.log("[TavernHelper] updateWorldbookWith called:", name, data);
        if (!name) return false;

        try {
          const { tavoApi } = await import("../../../../services/api/tavoApi");

          let wbIdx = tavernHelperCache.worldbooks.findIndex(
            (wb: any) => wb.name === name || wb.id === name,
          );

          let entriesArray: any[] = [];
          if (Array.isArray(data)) {
            entriesArray = data;
          } else if (data && typeof data === "object") {
            if (Array.isArray(data.entries)) {
              entriesArray = data.entries;
            } else if (data.entries && typeof data.entries === "object") {
              entriesArray = Object.values(data.entries);
            } else {
              entriesArray = Object.values(data);
            }
          }

          const entriesRecord: Record<string, any> = {};
          entriesArray.forEach((e: any, i: number) => {
            const uid = e.uid || e.identifier || String(i);
            entriesRecord[uid] = {
              uid,
              key: e.key || e.keys || [],
              comment: e.comment || "",
              content: e.content || e.value || "",
              enabled: e.enabled !== false,
              ...e,
            };
          });

          let updatedBook: any;
          if (wbIdx !== -1) {
            updatedBook = {
              ...tavernHelperCache.worldbooks[wbIdx],
              entries: entriesArray,
            };
            tavernHelperCache.worldbooks[wbIdx] = updatedBook;
            await tavoApi.lorebook.update(updatedBook);
          } else {
            updatedBook = {
              id:
                name.toLowerCase().replace(/\s+/g, "_") ||
                Date.now().toString(),
              name: name,
              entries: entriesArray,
            };
            tavernHelperCache.worldbooks.push(updatedBook);
            await tavoApi.lorebook.create(updatedBook);
          }

          const activeWorld = activeWorldRef.current;
          if (activeWorld) {
            const currentChatInfo = await tavoApi.chat.current();
            const activeLobNames =
              currentChatInfo?.lorebooks?.map((l: any) => l.name) || [];

            if (activeLobNames.includes(name) || activeLobNames.length === 0) {
              const updatedLorebookObj = {
                name: name,
                entries: entriesRecord,
              };

              if (onUpdateWorld) {
                onUpdateWorld({
                  lorebook: updatedLorebookObj,
                });
              }
            }
          }

          window.dispatchEvent(
            new CustomEvent("tavo_lorebooks_updated", {
              detail: { name, data: updatedBook },
            }),
          );
          return true;
        } catch (e) {
          console.error("[TavernHelper Bridge] updateWorldbookWith error:", e);
          return false;
        }
      },
    };

    // Event system helpers (Phase 1)
    const eventOn = (type: string, cb: Function) => eventSource.on(type, cb);
    const eventOnce = (type: string, cb: Function) => {
      const wrap = (...a: any[]) => {
        cb(...a);
        eventSource.off(type, wrap);
      };
      eventSource.on(type, wrap);
    };
    const eventOff = (type: string, cb: Function) => eventSource.off(type, cb);
    const eventEmit = (type: string, ...data: any[]) =>
      eventSource.emit(type, ...data);

    // Variable helpers (Phase 2)
    const getVariables = (option?: any) => {
      if (typeof option === "string") {
        return tavernHelperCache.variables[option];
      }
      return tavernHelperCache.variables;
    };
    const setVariables = async (data: any, option?: any) => {
      return await tavernHelper.updateVariablesWith(data);
    };

    // Message CRUD helpers (Phase 2)
    const getMessages = (option?: any) => {
      let list = [...(historyRef.current || [])];
      if (option?.role) {
        list = list.filter((m) => m.role === option.role);
      }
      return list;
    };
    const setMessage = (message_id: number, fields: any) => {
      console.log(
        "[SillyTavern Bridge] setMessage called:",
        message_id,
        fields,
      );
      if (typeof message_id !== "number") return;
      setHistory((prev: any) => {
        const next = prev.map((m: any, i: number) => {
          if (i === message_id) {
            const mappedText =
              typeof fields.message === "string"
                ? fields.message
                : fields.text || m.text || m.content;
            return {
              ...m,
              text: mappedText,
              content: mappedText,
              ...fields,
            };
          }
          return m;
        });
        syncWorldState(next, turnCountRef.current || 0, gameTimeRef.current);
        return next;
      });
    };
    const createMessage = (
      role: "user" | "assistant" | "system",
      content: string,
    ) => {
      console.log("[SillyTavern Bridge] createMessage called:", role, content);
      const newMsg = {
        role,
        text: content,
        content: content,
        timestamp: Date.now(),
      };
      setHistory((prev: any) => {
        const next = [...prev, newMsg];
        syncWorldState(next, turnCountRef.current || 0, gameTimeRef.current);
        return next;
      });
      return newMsg;
    };
    const deleteMessage = (message_id: number) => {
      console.log("[SillyTavern Bridge] deleteMessage called:", message_id);
      if (typeof message_id !== "number") return;
      setHistory((prev: any) => {
        const next = prev.filter((_: any, i: number) => i !== message_id);
        syncWorldState(next, turnCountRef.current || 0, gameTimeRef.current);
        return next;
      });
    };

    const getCurrentMessageId = () => {
      const messages = historyRef.current || [];
      return messages.length > 0 ? messages.length - 1 : 0;
    };

    // Prompt injection registers (Phase 4)
    const registerPromptMiddleware = (fn: Function) => {
      if (typeof fn === "function") {
        (window as any).promptMiddleware.push(fn);
      }
    };
    const registerPromptInjection = (fn: Function) => {
      if (typeof fn === "function") {
        (window as any).promptMiddleware.push(fn);
      }
    };

    // Case-extended event types for case-insensitivity
    const tavern_events_extended = { ...event_types };
    Object.keys(event_types).forEach((key) => {
      (tavern_events_extended as any)[key.toLowerCase()] = (
        event_types as any
      )[key];
    });

    const win = window as any;
    win.SillyTavern = stBridge;
    win.$ = jqBridge;
    win.jQuery = jqBridge;
    win.TavernHelper = tavernHelper;
    win.tavernHelper = tavernHelper;
    win.eventOn = eventOn;
    win.eventOnce = eventOnce;
    win.eventOff = eventOff;
    win.eventEmit = eventEmit;
    win.tavern_events = tavern_events_extended;
    win._ = _;
    win.getVariables = getVariables;
    win.setVariables = setVariables;
    win.getMessages = getMessages;
    win.setMessage = setMessage;
    win.createMessage = createMessage;
    win.deleteMessage = deleteMessage;
    win.getCurrentMessageId = getCurrentMessageId;
    win.registerPromptMiddleware = registerPromptMiddleware;
    win.registerPromptInjection = registerPromptInjection;

    const sendOpeningDataDirect = async (text: string, data?: any) => {
      console.log(
        "[SillyTavern Bridge] sendOpeningData direct function called:",
        text,
        data,
      );
      if (data && typeof data === "object") {
        try {
          await setVariables(data);
          console.log(
            "[SillyTavern Bridge] sendOpeningData variables synced:",
            data,
          );
        } catch (e) {
          console.error(
            "[SillyTavern Bridge] sendOpeningData variable sync failed:",
            e,
          );
        }
      }
      if (text && typeof text === "string") {
        if (handleSendRef.current) {
          handleSendRef.current(text);
        } else {
          console.warn(
            "[SillyTavern Bridge] handleSendRef is not ready yet for sendOpeningData",
          );
        }
      }
    };
    win.sendOpeningData = sendOpeningDataDirect;
    stBridge.sendOpeningData = sendOpeningDataDirect;

    const waitGlobalInitialized = () => {
      return new Promise<boolean>((resolve) => {
        const start = Date.now();
        const check = () => {
          if (isTavernHelperReadyRef.current || Date.now() - start > 4000) {
            resolve(true);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    };
    win.waitGlobalInitialized = waitGlobalInitialized;

    try {
      if (win.parent) {
        const pWin = win.parent as any;
        pWin.TavernHelper = tavernHelper;
        pWin.tavernHelper = tavernHelper;
        pWin.SillyTavern = stBridge;
        pWin.$ = jqBridge;
        pWin.jQuery = jqBridge;
        pWin.eventSource = eventSource;
        pWin.event_types = event_types;
        pWin.tavern_events = tavern_events_extended;
        pWin.eventOn = eventOn;
        pWin.eventOnce = eventOnce;
        pWin.eventOff = eventOff;
        pWin.eventEmit = eventEmit;
        pWin._ = _;
        pWin.getVariables = getVariables;
        pWin.setVariables = setVariables;
        pWin.getMessages = getMessages;
        pWin.setMessage = setMessage;
        pWin.createMessage = createMessage;
        pWin.deleteMessage = deleteMessage;
        pWin.getCurrentMessageId = getCurrentMessageId;
        pWin.waitGlobalInitialized = waitGlobalInitialized;
        pWin.registerPromptMiddleware = registerPromptMiddleware;
        pWin.registerPromptInjection = registerPromptInjection;
        pWin.triggerSlash = (command: string) =>
          win.executeSlashCommands?.(command);
        pWin.executeSlashCommands = (command: string) =>
          win.executeSlashCommands?.(command);
        pWin.sendOpeningData = sendOpeningDataDirect;
      }
    } catch (e) {}

    win.triggerSlash = (command: string) => {
      win.executeSlashCommands?.(command);
    };

    win.executeSlashCommands = async (command: string) => {
      console.log("[SillyTavern Bridge] Slash command received:", command);
      if (!command) return;

      const trimCmd = command.trim();
      let slashName = "";
      let slashArgs = "";

      if (trimCmd.startsWith("/")) {
        const spaceIdx = trimCmd.indexOf(" ");
        if (spaceIdx !== -1) {
          slashName = trimCmd.substring(1, spaceIdx).trim().toLowerCase();
          slashArgs = trimCmd.substring(spaceIdx + 1).trim();
        } else {
          slashName = trimCmd.substring(1).trim().toLowerCase();
        }
      }

      // 1. Try custom SlashCommandParser registry first
      if (slashName) {
        const cmdObj = (window as any).SlashCommandParser?.getCommand(slashName);
        if (cmdObj && typeof cmdObj.callback === "function") {
          try {
            const argsObj: any = {};
            const words = slashArgs.split(/\s+/);
            words.forEach((w: string) => {
              const eq = w.indexOf("=");
              if (eq !== -1) {
                argsObj[w.substring(0, eq)] = w.substring(eq + 1);
              }
            });
            console.log(
              `[SillyTavern Bridge] Executing registered custom command /${slashName}`,
            );
            return await cmdObj.callback(argsObj, slashArgs);
          } catch (e) {
            console.error(
              `[SillyTavern Bridge] Error in custom slash command /${slashName}:`,
              e,
            );
          }
        }
      }

      // Helper to extract argument value from named args (e.g. value="test" or key='something')
      const getCommandArgValue = (
        argsText: string,
        keyName: string = "value",
      ): string => {
        const trimmed = argsText.trim();
        if (!trimmed) return "";

        const prefix = `${keyName}=`;
        if (trimmed.startsWith(prefix)) {
          let val = trimmed.substring(prefix.length).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }

        if (trimmed.includes("=")) {
          const regex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
          let match;
          const params: Record<string, string> = {};
          while ((match = regex.exec(trimmed)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2] || match[3] || match[4] || "";
            params[key] = value;
          }
          if (params[keyName]) {
            return params[keyName];
          }
        }

        let val = trimmed;
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      };

      const getCommandArg = (key: string) => {
        return getCommandArgValue(slashArgs, key);
      };

      // 2. Fallbacks to virtualized internal commands
      if (slashName === "setinput") {
        const val = getCommandArg("value") || slashArgs;
        tavoRegistry.setInputValue?.(val);
        setIsInputCollapsed(false);
        setTimeout(() => {
          tavoRegistry.focusInput?.();
        }, 50);
        return;
      }

      if (slashName === "send") {
        const val = getCommandArg("value") || slashArgs;
        if (val) {
          tavoRegistry.setInputValue?.(val);
          setIsInputCollapsed(false);
          setTimeout(() => {
            tavoRegistry.sendInput?.();
          }, 50);
        } else {
          tavoRegistry.sendInput?.();
        }
        return;
      }

      if (slashName === "sys" || slashName === "system") {
        const val = getCommandArg("value") || slashArgs;
        if (val) {
          const sysMsg: ChatMessage = {
            role: "system",
            text: val,
            timestamp: Date.now(),
            gameTime: gameTimeRef.current,
            turnNumber: turnCountRef.current || 0,
          };
          setHistory((prev: any) => {
            const next = [...prev, sysMsg];
            syncWorldState(next, turnCountRef.current || 0, gameTimeRef.current);
            return next;
          });
        }
        return;
      }

      if (slashName === "pop") {
        setHistory((prev: any) => {
          if (prev.length === 0) return prev;
          const next = prev.slice(0, -1);
          syncWorldState(next, turnCountRef.current || 0, gameTimeRef.current);
          return next;
        });
        return;
      }

      if (slashName === "delete") {
        const num = parseInt(getCommandArg("value") || slashArgs, 10);
        if (!isNaN(num)) {
          setHistory((prev: any) => {
            const next = prev.filter((_: any, i: number) => i !== num);
            syncWorldState(next, turnCountRef.current || 0, gameTimeRef.current);
            return next;
          });
        }
        return;
      }

      if (slashName === "getvar") {
        const key = getCommandArg("key") || slashArgs;
        if (key) {
          const val = tavernHelperCache.variables[key] || "";
          console.log(`[Slash Command /getvar] ${key} = ${val}`);
          return val;
        }
        return;
      }

      if (slashName === "setvar") {
        const params = slashArgs.trim();
        let key = "";
        let val = "";

        const eqIdx = params.indexOf("=");
        if (eqIdx !== -1) {
          key = params.substring(0, eqIdx).trim();
          val = params.substring(eqIdx + 1).trim();
        } else {
          const spIdx = params.indexOf(" ");
          if (spIdx !== -1) {
            key = params.substring(0, spIdx).trim();
            val = params.substring(spIdx + 1).trim();
          } else {
            key = params;
          }
        }

        if (key) {
          if (key.startsWith("key=")) {
            key = key.substring(4).trim();
          }
          if (val.startsWith("value=")) {
            val = val.substring(6).trim();
          }
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.substring(1, val.length - 1);
          }

          console.log(
            `[Slash Command /setvar] Setting variable: ${key} = ${val}`,
          );
          try {
            const { tavoApi } = await import("../../../../services/api/tavoApi");
            await tavoApi.set(key, val);
            tavernHelperCache.variables[key] = val;
            window.dispatchEvent(
              new CustomEvent("tavo_vars_updated", { detail: { key, val } }),
            );
          } catch (e) {}
        }
        return;
      }

      if (slashName === "echo" || slashName === "display") {
        const val = getCommandArg("value") || slashArgs;
        if (val) {
          console.log(`[Slash Command /echo] Display alert: ${val}`);
        }
        return;
      }

      if (slashName === "clear" || slashName === "wipe") {
        setHistory([]);
        syncWorldState([], 0, gameTimeRef.current);
        return;
      }

      if (!trimCmd.startsWith("/")) {
        tavoRegistry.setInputValue?.(trimCmd);
        setIsInputCollapsed(false);
        setTimeout(() => {
          tavoRegistry.sendInput?.();
        }, 50);
      }
    };

    // 2. Click interceptor for choices embedded in chat logs (HTML)
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        "[data-reply], [data-choice], [data-action], .quick-reply, .silly_choice, .qr-btn, .reply-btn, .tawa-choice",
      );
      if (!target) return;

      let text = "";
      if (target.getAttribute("data-reply")) {
        text = target.getAttribute("data-reply") || "";
      } else if (target.getAttribute("data-choice")) {
        text = target.getAttribute("data-choice") || "";
      } else if (target.getAttribute("data-action")) {
        text = target.getAttribute("data-action") || "";
      } else if (
        target.classList.contains("quick-reply") ||
        target.classList.contains("silly_choice") ||
        target.classList.contains("qr-btn") ||
        target.classList.contains("reply-btn") ||
        target.classList.contains("tawa-choice")
      ) {
        text = target.textContent || "";
      }

      if (text) {
        text = text.trim();
        text = text.replace(/^(\d+\s*[│|.]\s*)/, "");
        text = text.replace(/^(\[\d+\]\s*)/, "");

        tavoRegistry.setInputValue?.(text);
        setIsInputCollapsed(false);

        setTimeout(() => {
          tavoRegistry.focusInput?.();
        }, 80);

        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentClick);

    return () => {
      const win = window as any;
      delete win.SillyTavern;
      delete win.$;
      delete win.jQuery;
      delete win.TavernHelper;
      delete win.tavernHelper;
      delete win.eventOn;
      delete win.eventOnce;
      delete win.eventOff;
      delete win.eventEmit;
      delete win.tavern_events;
      delete win._;
      delete win.getVariables;
      delete win.setVariables;
      delete win.getMessages;
      delete win.setMessage;
      delete win.createMessage;
      delete win.deleteMessage;
      delete win.getCurrentMessageId;
      delete win.registerPromptMiddleware;
      delete win.registerPromptInjection;

      try {
        if (win.parent) {
          const pWin = win.parent as any;
          delete pWin.TavernHelper;
          delete pWin.tavernHelper;
          delete pWin.SillyTavern;
          delete pWin.$;
          delete pWin.jQuery;
          delete pWin.eventSource;
          delete pWin.event_types;
          delete pWin.tavern_events;
          delete pWin.eventOn;
          delete pWin.eventOnce;
          delete pWin.eventOff;
          delete pWin.eventEmit;
          delete pWin._;
          delete pWin.getVariables;
          delete pWin.setVariables;
          delete pWin.getMessages;
          delete pWin.setMessage;
          pWin.createMessage && delete pWin.createMessage;
          pWin.deleteMessage && delete pWin.deleteMessage;
          pWin.getCurrentMessageId && delete pWin.getCurrentMessageId;
          pWin.registerPromptMiddleware &&
            delete pWin.registerPromptMiddleware;
          pWin.registerPromptInjection && delete pWin.registerPromptInjection;
          pWin.triggerSlash && delete pWin.triggerSlash;
          pWin.executeSlashCommands && delete pWin.executeSlashCommands;
        }
      } catch (e) {}
      delete win.triggerSlash;
      delete win.executeSlashCommands;
      delete win.eventSource;
      delete win.event_types;
      delete win.SlashCommandParser;
      delete win.promptMiddleware;
      delete win.extension_settings;
      delete win.saveSettingsDebounced;
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [setIsInputCollapsed, activeWorldRef, historyRef, gameTimeRef, turnCountRef, syncWorldState, setHistory, onUpdateWorld, handleSendRef]);

  return {
    isTavernHelperReady,
    tavoSelectState,
    setTavoSelectState,
  };
}
