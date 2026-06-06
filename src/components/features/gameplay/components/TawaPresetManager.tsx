import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Settings2,
  Edit2,
  Check,
  X,
  Download,
  Upload,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Search,
  Save,
  Filter,
  AlignLeft,
  Bot,
  Variable,
  Zap,
} from "lucide-react";
import { TawaPresetConfig, PromptModule, WorldData, SaveFile } from "../../../../types";
import RegexScriptsManager from "./RegexScriptsManager";
import { toast } from "sonner";
import { dbService } from "../../../../services/db/indexedDB";

import tawaReYilPresetData from "../../../../assets/presets/tawa_re_yil.json";
import tawaDeltaPresetData from "../../../../assets/presets/tawa_delta_combined.json";

interface TawaPresetManagerProps {
  onConfigChange: (config: TawaPresetConfig) => void;
  initialPreset?: TawaPresetConfig;
  playerName?: string;
  charName?: string;
  activeWorld?: WorldData;
}

export interface SavedPreset {
  id: string;
  name: string;
  config: TawaPresetConfig;
}

const PRESETS_STORAGE_KEY = "tawa_presets_list_v4";
const ACTIVE_PRESET_ID_KEY = "tawa_active_preset_id_v4";

const DEFAULT_AI_SETTINGS = {
  temperature: 0.9,
  top_p: 1.0,
  top_k: 0,
  top_a: 0,
  min_p: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1.0,
  openai_max_context: 32000,
  openai_max_tokens: 4096,
};

export function normalizePresetConfig(config: TawaPresetConfig) {
  if (!config.modules) config.modules = [];

  // Find modules by ST standard identifier
  let mainMod = config.modules.find(m => m.identifier === "main");
  if (!mainMod) {
    mainMod = config.modules.find(m => m.name?.toLowerCase().includes("main system") || m.name?.toLowerCase().includes("hệ thống chính"));
  }

  let nsfwMod = config.modules.find(m => m.identifier === "nsfw");
  if (!nsfwMod) {
    nsfwMod = config.modules.find(m => m.name?.toLowerCase().includes("auxiliary") || m.name?.toLowerCase().includes("phụ") || m.name?.toLowerCase().includes("nsfw") || m.name?.toLowerCase().includes("secondary"));
  }

  let jbMod = config.modules.find(m => m.identifier === "jailbreak" || m.identifier === "jailbreak_prompt");
  if (!jbMod) {
    jbMod = config.modules.find(m => m.name?.toLowerCase().includes("vượt ngục") || m.name?.toLowerCase().includes("jailbreak"));
  }

  let phMod = config.modules.find(m => m.identifier === "post_history_instructions" || m.identifier === "post_history" || m.identifier === "post-history");
  if (!phMod) {
    phMod = config.modules.find(m => m.name?.toLowerCase().includes("post-history") || m.name?.toLowerCase().includes("post_history") || m.name?.toLowerCase().includes("ôn lại") || m.name?.toLowerCase().includes("lược sử") || m.name?.toLowerCase().includes("kết thúc ôn lại") || m.name?.toLowerCase().includes("———❉———"));
    // Ensure we don't pick the same module for jailbreak and post-history if only one of them exists using names!
    if (phMod && jbMod && phMod.identifier === jbMod.identifier) {
      phMod = undefined;
    }
  }

  // Map / unify identifiers
  if (mainMod && mainMod.identifier !== "main") {
    mainMod.identifier = "main";
  }
  if (nsfwMod && nsfwMod.identifier !== "nsfw") {
    nsfwMod.identifier = "nsfw";
  }
  if (jbMod && jbMod.identifier !== "jailbreak") {
    jbMod.identifier = "jailbreak";
  }
  if (phMod && phMod.identifier !== "post_history_instructions") {
    phMod.identifier = "post_history_instructions";
  }

  // Sync config values
  config.main_prompt = config.main_prompt || mainMod?.content || "";
  config.nsfw_prompt = config.nsfw_prompt || nsfwMod?.content || "";
  config.jailbreak_prompt = config.jailbreak_prompt || jbMod?.content || "";
  config.post_history_instructions = config.post_history_instructions || phMod?.content || "";

  // Helper to construct a module if absent
  const guaranteeModule = (identifier: string, modName: string, role: "system" | "user" | "assistant", content: string, systemPrompt: boolean, pos = 0) => {
    const exists = config.modules.some(m => m.identifier === identifier);
    if (!exists && content) {
      config.modules.push({
        identifier,
        name: modName,
        role,
        content,
        system_prompt: systemPrompt,
        enabled: true,
        injection_position: pos,
        injection_depth: identifier === "nsfw" ? 4 : 0,
        injection_order: 100
      });
    }
  };

  if (config.main_prompt) {
    guaranteeModule("main", "Princess Tawa (Main System)", "system", config.main_prompt, true, 0);
  }
  if (config.nsfw_prompt) {
    guaranteeModule("nsfw", "Auxiliary Prompt (Quy phạm phụ / Thiết lập bổ trợ)", "system", config.nsfw_prompt, true, 0);
  }
  if (config.jailbreak_prompt) {
    guaranteeModule("jailbreak", "Jailbreak Prompt (Chỉ thị Vượt ngục)", "assistant", config.jailbreak_prompt, false, 0);
  }
  if (config.post_history_instructions) {
    guaranteeModule("post_history_instructions", "Post-History Instructions (Chỉ thị Ôn lại)", "system", config.post_history_instructions, true, 1);
  }
}

function extractEnabledMapFromPromptOrder(promptOrder: any): Record<string, boolean> {
  const enabledMap: Record<string, boolean> = {};
  if (Array.isArray(promptOrder)) {
    for (const orderGroup of promptOrder) {
      if (orderGroup && Array.isArray(orderGroup.order)) {
        for (const item of orderGroup.order) {
          if (item && item.identifier !== undefined && item.enabled !== undefined) {
            enabledMap[item.identifier] = (item.enabled === true || item.enabled === "true");
          }
        }
      }
    }
  }
  return enabledMap;
}

export function parseBuiltinPreset(id: string, name: string, data: any): SavedPreset {
  let config: TawaPresetConfig = { modules: [] };
  if (data.prompts && Array.isArray(data.prompts)) {
    config = { ...data, modules: data.prompts };
    delete (config as any).prompts; // keep it clean
  } else if (data.modules && Array.isArray(data.modules)) {
    config = { ...data };
  } else if (Array.isArray(data)) {
    config.modules = data;
  }

  // Ensure config has id and name
  config.id = id;
  config.name = name;

  const enabledMap = extractEnabledMapFromPromptOrder(data.prompt_order);
  if (config.modules && Array.isArray(config.modules)) {
    config.modules = config.modules.map((m: any) => {
      const isEnabled = enabledMap[m.identifier] !== undefined ? enabledMap[m.identifier] : (m.enabled ?? true);
      return {
        ...m,
        enabled: isEnabled
      };
    });
  }

  normalizePresetConfig(config);

  const stScripts = [
    ...(data.extensions && Array.isArray(data.extensions.regex_scripts) ? data.extensions.regex_scripts : []),
    ...(data.regex_scripts && Array.isArray(data.regex_scripts) ? data.regex_scripts : [])
  ];

  if (stScripts.length > 0) {
      config.regexScripts = stScripts.map((s: any) => ({
          id: s.id || crypto.randomUUID(),
          scriptName: s.scriptName || s.name || 'Imported Regex Script',
          findRegex: s.findRegex || s.regex || '',
          replaceString: s.replaceString || '',
          trimStrings: s.trimStrings || [],
          placement: s.placement || [],
          disabled: s.disabled || false,
          markdownOnly: s.markdownOnly || false,
          promptOnly: s.promptOnly || false,
          runOnEdit: s.runOnEdit || false,
          minDepth: s.minDepth,
          maxDepth: s.maxDepth,
          substituteRegex: s.substituteRegex || 0
      }));
  } else if (data.regexScripts && Array.isArray(data.regexScripts)) {
      config.regexScripts = data.regexScripts;
  }

  return { id, name, config };
}

const BUILTIN_PRESETS: SavedPreset[] = [
  parseBuiltinPreset("builtin_tawa_re_yil", "Tawa Re = YIL丨Alpha V1", tawaReYilPresetData),
  parseBuiltinPreset("builtin_tawa_delta", "Tawa Delta Combined丨Mới Nhất", tawaDeltaPresetData),
];

export default function TawaPresetManager({
  onConfigChange,
  initialPreset,
  playerName,
  charName,
  activeWorld,
}: TawaPresetManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "modules" | "settings" | "prompts" | "variables" | "regex" | "quick_prompts"
  >("modules");
  const [searchTerm, setSearchTerm] = useState("");

  const [presets, setPresets] = useState<SavedPreset[]>(() => {
    let baseList: SavedPreset[] = [];
    try {
      const savedList = dbService.getKeyValueSync(PRESETS_STORAGE_KEY);
      if (savedList) {
        const parsed = typeof savedList === "string" ? JSON.parse(savedList) : savedList;
        if (Array.isArray(parsed)) {
          const uniqueIds = new Set();
          baseList = parsed.filter((p) => {
            if (uniqueIds.has(p.id)) return false;
            uniqueIds.add(p.id);
            return true;
          });
        }
      }
    } catch (e) {
      console.warn("Failed to parse presets from database key.");
    }

    // Merge in builtin presets
    BUILTIN_PRESETS.forEach(builtin => {
      const existingIndex = baseList.findIndex(p => p.id === builtin.id);
      if (existingIndex === -1) {
        baseList.push(builtin);
      } else {
        // Keep the user's customized settings stored in localStorage, do not overwrite blindly!
        // We preserve whatever was parsed from localStorage for builtin presets.
      }
    });

    if (initialPreset) {
      const targetId = initialPreset.id || "custom_world";
      const existingIndex = baseList.findIndex((p) => p.id === targetId);
      const alignedPreset = {
        ...initialPreset,
        id: targetId,
        name: initialPreset.name || "World Preset"
      };
      if (existingIndex === -1) {
        baseList.push({
          id: targetId,
          name: initialPreset.name || "World Preset",
          config: alignedPreset,
        });
      } else {
        // Sync/Update with fresh config from the loaded world save (e.g. from IndexedDB or imported JSON)
        baseList[existingIndex] = {
          ...baseList[existingIndex],
          config: {
            ...baseList[existingIndex].config,
            ...alignedPreset
          }
        };
      }
    }
    if (baseList.length === 0) {
      baseList.push({
        id: "default",
        name: "Default",
        config: { id: "default", name: "Default", modules: [] },
      });
    }

    // Run normalization process on ALL loaded configs to heal any legacy formats/incomplete files
    baseList.forEach((p) => {
      if (p.config) {
        p.config.id = p.id;
        p.config.name = p.name;
        normalizePresetConfig(p.config);
      }
    });

    return baseList;
  });

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    if (initialPreset?.id) return initialPreset.id;
    return dbService.getKeyValueSync(ACTIVE_PRESET_ID_KEY) || presets[0]?.id || "";
  });

  // Sync active preset ID state if initialPreset changes
  useEffect(() => {
    if (initialPreset?.id) {
      setActivePresetId(initialPreset.id);
    }
  }, [initialPreset]);

  const activePreset =
    presets.find((p) => p.id === activePresetId) || presets[0];
  const config = activePreset?.config || { modules: [] };

  const mainPromptValue = config.main_prompt || (config.modules?.find(m => m.identifier === "main")?.content || "");
  const nsfwPromptValue = config.nsfw_prompt || (config.modules?.find(m => m.identifier === "nsfw")?.content || "");
  const jailbreakPromptValue = config.jailbreak_prompt || (config.modules?.find(m => m.identifier === "jailbreak")?.content || "");
  const postHistoryInstructionsValue = config.post_history_instructions || (config.modules?.find(m => m.identifier === "post_history_instructions" || m.identifier === "post_history")?.content || "");
  const assistantPrefillValue = config.assistant_prefill || "";

  useEffect(() => {
    if (activePreset) {
      onConfigChange(activePreset.config);
    }
  }, [config, onConfigChange, activePreset]);

  // UPDATE HELPERS
  const updateConfig = (
    updater: (prev: TawaPresetConfig) => TawaPresetConfig,
  ) => {
    setPresets((prevList) => {
      const newList = prevList.map((p) => {
        if (p.id === activePresetId) {
          return { ...p, config: updater(p.config) };
        }
        return p;
      });
      dbService.setKeyValue(PRESETS_STORAGE_KEY, newList);
      return newList;
    });
  };

  const updatePresetName = (newName: string) => {
    setPresets((prevList) => {
      const newList = prevList.map((p) =>
        p.id === activePresetId ? { ...p, name: newName } : p,
      );
      dbService.setKeyValue(PRESETS_STORAGE_KEY, newList);
      return newList;
    });
  };

  const handleSaveAndApply = async () => {
    if (!activePreset) return;

    try {
      const targetId = activePreset.id || activePresetId;
      const targetName = activePreset.name || "World Preset";

      // Ensure activePreset config has id and name
      activePreset.config.id = targetId;
      activePreset.config.name = targetName;

      // Sync all configs with their preset wrappers to enforce data integrity
      const updatedPresets = presets.map((p) => {
        if (p.config) {
          return {
            ...p,
            config: {
              ...p.config,
              id: p.id,
              name: p.name,
            },
          };
        }
        return p;
      });

      // 1. Force save localPresets to IndexedDB keyval cache
      await dbService.setKeyValue(PRESETS_STORAGE_KEY, updatedPresets);
      await dbService.setKeyValue(ACTIVE_PRESET_ID_KEY, targetId);

      // 2. Propagate configuration state to parent react state immediately
      onConfigChange(activePreset.config);

      // 3. Immediately persist to activeWorld inside IndexedDB database so exiting doesn't cancel it
      let worldStateSaved = false;
      if (activeWorld && activeWorld.activeSaveId) {
        try {
          const saves = await dbService.getAllSaves();
          const existingSave = Array.isArray(saves) ? saves.find((s) => s.id === activeWorld.activeSaveId) : undefined;

          const updatedSave: SaveFile = {
            id: activeWorld.activeSaveId,
            name: existingSave?.name || `${activeWorld.world?.worldName || "Unknown World"} - Lượt ${activeWorld.savedState?.turnCount || 0} (Tự động)`,
            createdAt: existingSave?.createdAt || Date.now(),
            updatedAt: Date.now(),
            data: {
              ...activeWorld,
              config: {
                ...(activeWorld.config || { rules: [], regex_scripts: [] }),
                tawaPreset: activePreset.config,
              }
            },
          };

          await dbService.saveAutosave(updatedSave);
          worldStateSaved = true;
        } catch (innerErr) {
          console.warn("Soft conflict during immediate saveAutosave in TawaPresetManager, deferring to background auto-save engine:", innerErr);
        }
      }

      if (worldStateSaved) {
        toast.success("💾 Đã lưu cấu hình Preset và cập nhật Nhật Ký Thế Giới thành công!");
      } else {
        toast.success("💾 Đã lưu kịch bản Preset vào trình duyệt thành công!");
      }
    } catch (error) {
      console.error("Failed to save preset to database:", error);
      toast.error("Lỗi khi lưu cấu hình Preset! Chi tiết: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleResetBuiltin = () => {
    const builtin = BUILTIN_PRESETS.find(p => p.id === activePresetId);
    if (!builtin) return;

    setPresets((prev) => {
      const updated = prev.map(p => p.id === activePresetId ? JSON.parse(JSON.stringify(builtin)) : p);
      dbService.setKeyValue(PRESETS_STORAGE_KEY, updated);
      return updated;
    });
    toast.success("✨ Đã khôi phục preset mặc định về nguyên bản!");
  };

  // QUICK PROMPTS EDITING HANDLER
  const handleQuickPromptChange = (field: "main" | "nsfw" | "jailbreak" | "post_history_instructions" | "assistant_prefill", value: string) => {
    updateConfig((prev) => {
      const updated = { ...prev };
      if (field === "main") {
        updated.main_prompt = value;
      } else if (field === "nsfw") {
        updated.nsfw_prompt = value;
      } else if (field === "jailbreak") {
        updated.jailbreak_prompt = value;
      } else if (field === "post_history_instructions") {
        updated.post_history_instructions = value;
      } else if (field === "assistant_prefill") {
        updated.assistant_prefill = value;
        return updated;
      }

      // Also locate/update the corresponding PromptModule so it synchronizes correctly
      const modules = [...(prev.modules || [])];
      
      let targetIdentifier = "";
      let defaultName = "";
      let defaultRole: "system" | "user" | "assistant" = "system";
      
      if (field === "main") {
        targetIdentifier = "main";
        defaultName = "Princess Tawa (Main System)";
        defaultRole = "system";
      } else if (field === "nsfw") {
        targetIdentifier = "nsfw";
        defaultName = "Auxiliary Prompt (Quy phạm phụ / Thiết lập bổ trợ)";
        defaultRole = "system";
      } else if (field === "jailbreak") {
        targetIdentifier = "jailbreak";
        defaultName = "Jailbreak Prompt (Chỉ thị Vượt ngục)";
        defaultRole = "assistant";
      } else if (field === "post_history_instructions") {
        targetIdentifier = "post_history_instructions";
        defaultName = "Post-History Instructions (Chỉ thị Ôn lại cuối Lịch sử)";
        defaultRole = "system";
      }
      
      const modIdx = modules.findIndex(m => m.identifier === targetIdentifier);
      if (modIdx !== -1) {
        modules[modIdx] = {
          ...modules[modIdx],
          content: value
        };
      } else {
        // Create matching module
        modules.push({
          identifier: targetIdentifier,
          name: defaultName,
          role: defaultRole,
          enabled: true,
          content: value,
          system_prompt: defaultRole === "system",
          injection_position: field === "post_history_instructions" ? 1 : 0,
          injection_depth: field === "nsfw" ? 4 : 0,
          injection_order: 100
        });
      }
      
      updated.modules = modules;
      return updated;
    });
  };

  // MODULE MANAGEMENT
  const addModule = () => {
    const newMod: PromptModule = {
      identifier: "new_module_" + Date.now(),
      name: "New Module",
      enabled: true,
      injection_position: 0,
      injection_depth: 4,
      injection_order: 100,
      role: "system",
      content: "",
      system_prompt: false,
    };
    updateConfig((c) => ({ ...c, modules: [...(c.modules || []), newMod] }));
  };

  const updateModule = (idx: number, updates: Partial<PromptModule>) => {
    updateConfig((c) => {
      const newMods = [...(c.modules || [])];
      newMods[idx] = { ...newMods[idx], ...updates };
      return { ...c, modules: newMods };
    });
  };

  const removeModule = (idx: number) => {
    updateConfig((c) => ({
      ...c,
      modules: (c.modules || []).filter((_, i) => i !== idx),
    }));
  };

  const moveModule = (idx: number, dir: number) => {
    updateConfig((c) => {
      const newMods = [...(c.modules || [])];
      if (idx + dir < 0 || idx + dir >= newMods.length) return c;
      const temp = newMods[idx];
      newMods[idx] = newMods[idx + dir];
      newMods[idx + dir] = temp;
      return { ...c, modules: newMods };
    });
  };

  // IMPORT / EXPORT
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedJson = JSON.parse(content);

        let newConfig: TawaPresetConfig = { modules: [] };
        let name = file.name.replace(".json", "");

        if (importedJson.modules) {
          // We assume it's a full TawaPresetConfig
          newConfig = { ...newConfig, ...importedJson };
          if (importedJson.name) name = importedJson.name;
        } else if (Array.isArray(importedJson)) {
          newConfig.modules = importedJson;
        } else if (
          importedJson.prompts &&
          Array.isArray(importedJson.prompts)
        ) {
          // ST format?
          newConfig.modules = importedJson.prompts;
          if (importedJson.impersonation_prompt !== undefined) {
            newConfig = { ...newConfig, ...importedJson };
          }
        } else {
          toast.error(
            "Định dạng Preset không hợp lệ. Hệ thống yêu cầu mảng các module hoặc định dạng Preset tiêu chuẩn."
          );
          return;
        }

        const enabledMap = extractEnabledMapFromPromptOrder(importedJson.prompt_order || (importedJson.config && importedJson.config.prompt_order));
        if (newConfig.modules && Array.isArray(newConfig.modules)) {
          newConfig.modules = newConfig.modules.map((m: any) => {
            const isEnabled = enabledMap[m.identifier] !== undefined ? enabledMap[m.identifier] : (m.enabled ?? true);
            return {
              ...m,
              enabled: isEnabled
            };
          });
        }

        const stScripts = [
            ...(importedJson.extensions && Array.isArray(importedJson.extensions.regex_scripts) ? importedJson.extensions.regex_scripts : []),
            ...(importedJson.regex_scripts && Array.isArray(importedJson.regex_scripts) ? importedJson.regex_scripts : [])
        ];

        if (stScripts.length > 0) {
            newConfig.regexScripts = stScripts.map((s: any) => ({
                id: crypto.randomUUID(),
                scriptName: s.scriptName || s.name || 'Imported Regex Script',
                findRegex: s.findRegex || s.regex || '',
                replaceString: s.replaceString || '',
                trimStrings: s.trimStrings || [],
                placement: s.placement || [],
                disabled: s.disabled || false,
                markdownOnly: s.markdownOnly || false,
                promptOnly: s.promptOnly || false,
                runOnEdit: s.runOnEdit || false,
                minDepth: s.minDepth,
                maxDepth: s.maxDepth,
                substituteRegex: s.substituteRegex || 0
            }));
        } else if (importedJson.regexScripts && Array.isArray(importedJson.regexScripts)) {
            newConfig.regexScripts = importedJson.regexScripts;
        }

        // Extract and align fields using normalized extraction
        if (importedJson.main_prompt !== undefined) newConfig.main_prompt = importedJson.main_prompt;
        if (importedJson.jailbreak_prompt !== undefined) newConfig.jailbreak_prompt = importedJson.jailbreak_prompt;
        else if (importedJson.jailbreak !== undefined) newConfig.jailbreak_prompt = importedJson.jailbreak;

        if (importedJson.nsfw_prompt !== undefined) newConfig.nsfw_prompt = importedJson.nsfw_prompt;
        else if (importedJson.nsfw !== undefined) newConfig.nsfw_prompt = importedJson.nsfw;

        if (importedJson.post_history_instructions !== undefined) newConfig.post_history_instructions = importedJson.post_history_instructions;
        else if (importedJson.post_history !== undefined) newConfig.post_history_instructions = importedJson.post_history;

        normalizePresetConfig(newConfig);

        const presetId = "preset_" + Date.now();
        newConfig.id = presetId;
        newConfig.name = name;
        setPresets((prev) => {
          const updated = [...prev, { id: presetId, name, config: newConfig }];
          dbService.setKeyValue(PRESETS_STORAGE_KEY, updated);
          return updated;
        });

        setActivePresetId(presetId);
        dbService.setKeyValue(ACTIVE_PRESET_ID_KEY, presetId);
      } catch (error: any) {
        toast.error("Lỗi phân tích cú pháp JSON Preset: " + (error?.message || "JSON không đúng định dạng."));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    try {
      // Export full config with ST format matching
      const exportObject = {
        name: activePreset.name,
        ...DEFAULT_AI_SETTINGS, // Inject default settings if not fully defined
        ...config,
        main_prompt: config.main_prompt || config.modules?.find(m => m.identifier === "main")?.content || "",
        jailbreak_prompt: config.jailbreak_prompt || config.modules?.find(m => m.identifier === "jailbreak")?.content || "",
        nsfw: config.nsfw_prompt || config.modules?.find(m => m.identifier === "nsfw")?.content || "",
        nsfw_prompt: config.nsfw_prompt || config.modules?.find(m => m.identifier === "nsfw")?.content || "",
        post_history_instructions: config.post_history_instructions || config.modules?.find(m => m.identifier === "post_history_instructions")?.content || "",
        prompts: config.modules,
        prompt_order: [
          {
            character_id: 100001,
            order: (config.modules || []).map(m => ({
              identifier: m.identifier,
              enabled: m.enabled ?? true
            }))
          }
        ],
        regex_scripts: config.regexScripts || [],
      };
      const dataStr = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tawa_${activePreset.name.replace(/\s+/g, "_")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const createBlankPreset = () => {
    const presetId = "preset_" + Date.now();
    setPresets((prev) => {
      const updated = [
        ...prev,
        { 
          id: presetId, 
          name: "New Preset", 
          config: { id: presetId, name: "New Preset", modules: [] } 
        },
      ];
      dbService.setKeyValue(PRESETS_STORAGE_KEY, updated);
      return updated;
    });
    setActivePresetId(presetId);
    dbService.setKeyValue(ACTIVE_PRESET_ID_KEY, presetId);
  };

  const clonePreset = () => {
    const presetId = "preset_" + Date.now();
    setPresets((prev) => {
      const clonedConfig = JSON.parse(JSON.stringify(config));
      clonedConfig.id = presetId;
      clonedConfig.name = activePreset.name + " (Copy)";
      const updated = [
        ...prev,
        {
          id: presetId,
          name: activePreset.name + " (Copy)",
          config: clonedConfig,
        },
      ];
      dbService.setKeyValue(PRESETS_STORAGE_KEY, updated);
      return updated;
    });
    setActivePresetId(presetId);
    dbService.setKeyValue(ACTIVE_PRESET_ID_KEY, presetId);
  };

  const handleDeletePreset = () => {
    setPresets((prev) => {
      const newList = prev.filter((p) => p.id !== activePresetId);
      dbService.setKeyValue(PRESETS_STORAGE_KEY, newList);
      return newList;
    });
    const nextPreset = presets.find((p) => p.id !== activePresetId);
    const newId = nextPreset ? nextPreset.id : "";
    setActivePresetId(newId);
    dbService.setKeyValue(ACTIVE_PRESET_ID_KEY, newId);
  };

  // VARIABLES MANAGEMENT
  const addVariable = () => {
    const newVal = {
      id: "var_" + Date.now(),
      name: "new_variable",
      value: "",
      description: "",
    };
    updateConfig((c) => ({
      ...c,
      variables: [...(c.variables || []), newVal],
    }));
  };

  const updateVariable = (idx: number, updates: any) => {
    updateConfig((c) => {
      const newVars = [...(c.variables || [])];
      newVars[idx] = { ...newVars[idx], ...updates };
      return { ...c, variables: newVars };
    });
  };

  const removeVariable = (idx: number) => {
    updateConfig((c) => ({
      ...c,
      variables: (c.variables || []).filter((_, i) => i !== idx),
    }));
  };

  const moveVariable = (idx: number, dir: number) => {
    updateConfig((c) => {
      const newVars = [...(c.variables || [])];
      if (idx + dir < 0 || idx + dir >= newVars.length) return c;
      const temp = newVars[idx];
      newVars[idx] = newVars[idx + dir];
      newVars[idx + dir] = temp;
      return { ...c, variables: newVars };
    });
  };

  const filteredModules = useMemo(() => {
    if (!searchTerm) return config.modules || [];
    const lowerSearch = searchTerm.toLowerCase();
    return (config.modules || []).filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(lowerSearch)) ||
        (m.identifier && m.identifier.toLowerCase().includes(lowerSearch)) ||
        (m.content && m.content.toLowerCase().includes(lowerSearch)),
    );
  }, [config.modules, searchTerm]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition shadow border border-slate-700"
      >
        <BrainCircuit size={16} className="text-mystic-accent" />
        <span className="text-sm font-medium">Quản lý Preset ST</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-xl flex flex-col shadow-2xl border border-slate-700 overflow-hidden">
        {/* HEADER */}
        <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800/80">
          <div className="flex items-center gap-3">
            <BrainCircuit className="text-mystic-accent" size={24} />
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Quản lý Ngữ cảnh Nâng cao
              <span className="bg-slate-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded text-slate-300">
                TƯƠNG THÍCH ST V4
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndApply}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-green-900/40 hover:shadow-green-500/20 active:scale-95 transition-all border border-green-500"
              title="Lưu cấu hình preset hiện tại vào thiết bị và đồng bộ vĩnh viễn"
            >
              <Save size={16} />
              <span>Lưu Cấu Hình (Save)</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition bg-slate-800 p-1.5 rounded-md border border-slate-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* LEFT SIDEBAR: PRESET SELECTOR & TABS */}
          <div className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col p-3 gap-4 overflow-y-auto">
            {/* Preset Select */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Preset Đang Chọn
              </label>
              <select
                value={activePresetId}
                onChange={(e) => {
                  setActivePresetId(e.target.value);
                  dbService.setKeyValue(ACTIVE_PRESET_ID_KEY, e.target.value);
                }}
                className="w-full p-2 bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded-lg outline-none focus:border-mystic-accent"
              >
                {Array.from(new Map((presets || []).filter(Boolean).map(p => [p.id, p])).values())
                  .map((p, idx) => (
                    <option key={`preset-${p.id || 'id'}-${idx}`} value={p.id}>
                      {String(p.name || 'Unnamed Preset')}
                    </option>
                  ))}
              </select>

              <input
                type="text"
                value={activePreset?.name || ""}
                onChange={(e) => updatePresetName(e.target.value)}
                placeholder="Tên Preset"
                className="w-full p-2 bg-slate-950 text-sm border border-slate-800 rounded outline-none focus:border-slate-600 focus:bg-slate-900 transition mt-1 text-slate-200"
              />

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={createBlankPreset}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded p-1.5 text-xs font-medium border border-slate-700 flex items-center justify-center gap-1"
                >
                  <Plus size={12} /> Tạo Mới
                </button>
                <button
                  onClick={clonePreset}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded p-1.5 text-xs font-medium border border-slate-700 flex items-center justify-center gap-1"
                >
                  <Copy size={12} /> Nhân Bản
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col gap-1 mt-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Cấu Hình
              </label>
              <TabButton
                active={activeTab === "quick_prompts"}
                onClick={() => setActiveTab("quick_prompts")}
                icon={<Zap size={16} />}
                label="Quick Prompts Edit"
              />
              <TabButton
                active={activeTab === "modules"}
                onClick={() => setActiveTab("modules")}
                icon={<AlignLeft size={16} />}
                label="Các Module Lệnh"
                badge={config.modules?.length}
              />
              <TabButton
                active={activeTab === "prompts"}
                onClick={() => setActiveTab("prompts")}
                icon={<Edit2 size={16} />}
                label="Định Dạng & Các Lệnh"
              />
              <TabButton
                active={activeTab === "settings"}
                onClick={() => setActiveTab("settings")}
                icon={<Settings2 size={16} />}
                label="Cài Đặt Model AI"
              />
              <TabButton
                active={activeTab === "variables"}
                onClick={() => setActiveTab("variables")}
                icon={<Variable size={16} />}
                label="Các Biến"
              />
              <TabButton
                active={activeTab === "regex"}
                onClick={() => setActiveTab("regex")}
                icon={<Settings2 size={16} />}
                label="Regex Scripts"
                badge={config.regexScripts?.length || 0}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-slate-800">
              <button
                onClick={handleSaveAndApply}
                className="flex items-center gap-2 justify-center w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded transition border border-green-500 shadow-md shadow-green-950/50"
                title="Lưu tất cả các thay đổi của preset hiện tại"
              >
                <Save size={14} /> Lưu Vào Thế Giới
              </button>
              {activePresetId && activePresetId.startsWith("builtin_") && (
                <button
                  onClick={handleResetBuiltin}
                  className="flex items-center gap-2 justify-center w-full py-2 bg-amber-950/40 hover:bg-amber-900/50 text-amber-400 text-xs rounded transition border border-amber-900/40"
                  title="Khôi phục preset mặc định này về nguyên bản gốc"
                >
                  Khôi phục Mặc định
                </button>
              )}
              <label className="flex items-center gap-2 justify-center w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded cursor-pointer transition border border-slate-700 mt-2">
                <Upload size={14} /> Nhập JSON ST
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 justify-center w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded transition border border-slate-700"
              >
                <Download size={14} /> Xuất JSON ST
              </button>
              {presets.length > 1 && (
                <button
                  onClick={handleDeletePreset}
                  className="flex items-center gap-2 justify-center w-full py-2 mt-2 bg-red-950/30 hover:bg-red-900/50 text-red-400 text-sm rounded transition border border-red-900/50"
                >
                  <Trash2 size={14} /> Xóa Đã Chọn
                </button>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 bg-slate-900 p-4 overflow-y-auto">
            {/* QUICK PROMPTS TAB */}
            {activeTab === "quick_prompts" && (
              <div className="flex flex-col gap-4 pb-8">
                <div className="bg-slate-800/20 border border-slate-800 p-4 rounded-xl flex flex-col gap-2">
                  <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
                    <Zap size={20} className="text-mystic-accent" /> Quick Prompts Edit
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sửa nhanh các Prompts cốt lõi của Preset giống như SillyTavern. Sẽ tự động cập nhật và đồng bộ hóa cả các Prompt Modules tương ứng phía dưới.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 p-4 bg-slate-800/30 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <h4 className="font-bold text-slate-300">1. Main Prompt (System Prompt / Định nghĩa Danh tính)</h4>
                        <p className="text-xs text-slate-400">Quy định danh tính cốt lõi của AI và cách hoạt động mặc định của bot.</p>
                      </div>
                    </div>
                    <textarea
                      value={mainPromptValue}
                      onChange={(e) => handleQuickPromptChange("main", e.target.value)}
                      placeholder="Nhập nội dung cho Main System Prompt..."
                      rows={10}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-mystic-accent/50 font-mono resize-y min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 p-4 bg-slate-800/30 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <h4 className="font-bold text-slate-300">2. Auxiliary Prompt (Phần bổ trợ hệ thống / Quy phạm phụ)</h4>
                        <p className="text-xs text-slate-400">Các bối cảnh, quy phạm phụ, và chỉ thị thiết lập cốt truyện bổ trợ độc lập (Ví dụ: &quot;☫Quy phạm cốt truyện dài tập&quot; có identifier <strong>nsfw</strong> của Preset Gomorrah).</p>
                      </div>
                    </div>
                    <textarea
                      value={nsfwPromptValue}
                      onChange={(e) => handleQuickPromptChange("nsfw", e.target.value)}
                      placeholder="Nhập nội dung cho Auxiliary Prompt (Mặc định liên kết với identifier 'nsfw')..."
                      rows={10}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-mystic-accent/50 font-mono resize-y min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 p-4 bg-slate-800/30 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <h4 className="font-bold text-slate-300">3. Jailbreak Prompt (Chỉ thị Vượt ngục / Phục hồi trạng thái)</h4>
                        <p className="text-xs text-slate-400">Chỉ thị rũ bỏ rào cản hệ thống và thiết lập phong cách viết (Ví dụ: Định dạng phản hồi ngôi thứ nhất có identifier <strong>jailbreak</strong>), thường được kích hoạt trước phản hồi.</p>
                      </div>
                    </div>
                    <textarea
                      value={jailbreakPromptValue}
                      onChange={(e) => handleQuickPromptChange("jailbreak", e.target.value)}
                      placeholder="Nhập nội dung cho Jailbreak Prompt (Mặc định liên kết với identifier 'jailbreak')..."
                      rows={10}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-mystic-accent/50 font-mono resize-y min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 p-4 bg-slate-800/30 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <h4 className="font-bold text-slate-300">4. Post-History Instructions (Chỉ thị Ôn lại cuối Lịch sử)</h4>
                        <p className="text-xs text-slate-400">Được tiêm trực tiếp vào sau Lịch sử (Post-History, e.g. &quot;———❉———&quot; hoặc nhắc lại bối cảnh có identifier <strong>post_history_instructions</strong>), dùng để duy trì bối cảnh và hướng dẫn phản hồi.</p>
                      </div>
                    </div>
                    <textarea
                      value={postHistoryInstructionsValue}
                      onChange={(e) => handleQuickPromptChange("post_history_instructions", e.target.value)}
                      placeholder="Nhập nội dung cho Post-History Instructions (Mặc định liên kết với identifier 'post_history_instructions')..."
                      rows={10}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-mystic-accent/50 font-mono resize-y min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 p-4 bg-slate-800/30 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <h4 className="font-bold text-slate-300">5. Assistant Prefill (Tiền thoại phản hồi / Tiền tố Assistant)</h4>
                        <p className="text-xs text-slate-400">Được gửi trực tiếp ở cuối danh sách tin nhắn để bắt buộc AI bắt đầu viết tiếp bằng phần đầu này (Ví dụ: &quot;&lt;thinking&gt;\n&quot; để ép AI suy nghĩ trước). SillyTavern nguyên bản sẽ đẩy tiền tố này sau tất cả các modules.</p>
                      </div>
                    </div>
                    <textarea
                      value={assistantPrefillValue}
                      onChange={(e) => handleQuickPromptChange("assistant_prefill", e.target.value)}
                      placeholder="Nhập nội dung cho Assistant Prefill (ví dụ: <thinking>)..."
                      rows={4}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-mystic-accent/50 font-mono resize-y min-h-[80px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* MODULES TAB */}
            {activeTab === "modules" && (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Tìm kiếm modules..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 outline-none focus:border-mystic-accent/50"
                    />
                  </div>
                  <button
                    onClick={addModule}
                    className="flex items-center gap-2 px-3 py-1.5 bg-mystic-accent/20 text-mystic-accent border border-mystic-accent/30 rounded-lg hover:bg-mystic-accent/30 transition text-sm"
                  >
                    <Plus size={16} /> Thêm Module
                  </button>
                </div>

                <div className="flex flex-col gap-3 pb-8">
                  {filteredModules.map((mod, idx) => {
                    // find absolute index for updates
                    const absoluteIdx = config.modules!.findIndex(
                      (m) => m.identifier === mod.identifier,
                    );

                    return (
                      <div
                        key={mod.identifier + idx}
                        className={`bg-slate-800/80 border ${mod.enabled ? "border-slate-700" : "border-slate-800 opacity-60"} rounded-lg overflow-hidden flex flex-col transition-all`}
                      >
                        {/* Module Header */}
                        <div className="flex items-center gap-3 p-3 bg-slate-900/40 border-b border-slate-800/50">
                          <button
                            onClick={() =>
                              updateModule(absoluteIdx, {
                                enabled: !mod.enabled,
                              })
                            }
                            className={`w-5 h-5 rounded flex items-center justify-center border ${mod.enabled ? "bg-mystic-accent/20 border-mystic-accent/50 text-mystic-accent" : "bg-slate-800 border-slate-600 text-transparent"}`}
                          >
                            <Check size={14} />
                          </button>
                          <div className="flex-1 grid grid-cols-2 gap-4 items-center">
                            <input
                              type="text"
                              value={mod.name}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  name: e.target.value,
                                })
                              }
                              className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-mystic-accent outline-none text-white font-bold"
                            />
                            <input
                              type="text"
                              value={mod.identifier}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  identifier: e.target.value,
                                })
                              }
                              className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-slate-500 outline-none text-slate-400 text-xs font-mono"
                              title="Identifier (e.g. core_sys)"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 mr-2 whitespace-nowrap">
                              Thứ tự: {mod.injection_order}
                            </span>
                            <button
                              onClick={() => moveModule(absoluteIdx, -1)}
                              disabled={absoluteIdx === 0}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded disabled:opacity-50"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => moveModule(absoluteIdx, 1)}
                              disabled={
                                absoluteIdx === config.modules!.length - 1
                              }
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded disabled:opacity-50"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => removeModule(absoluteIdx)}
                              className="p-1.5 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded ml-2"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Module Options Row */}
                        <div className="flex flex-wrap gap-4 p-3 bg-slate-800/30 border-b border-slate-800/50 text-xs">
                          <label className="flex items-center gap-2 text-slate-300">
                            <span className="text-slate-500">Kênh:</span>
                            <select
                              value={mod.role}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  role: e.target.value as
                                    | "system"
                                    | "assistant"
                                    | "user",
                                })
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 outline-none"
                            >
                              <option value="system">System</option>
                              <option value="assistant">Assistant</option>
                              <option value="user">User</option>
                            </select>
                          </label>
                          <label
                            className="flex items-center gap-2 text-slate-300"
                            title="Vị trí (0 = Top System, 1 = Bottom System, 2 = Trong Ngữ Cảnh Chat)"
                          >
                            <span className="text-slate-500">Vị trí:</span>
                            <input
                              type="number"
                              value={mod.injection_position || 0}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  injection_position:
                                    parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 outline-none text-center"
                            />
                          </label>
                          <label
                            className="flex items-center gap-2 text-slate-300"
                            title="Độ sâu (0 = Xa tin nhắn mới nhất nhất. Ở Vị trí 1, độ sâu càng cao càng gần hội thoại. Ở Vị trí 0, độ sâu thấp thì gần điểm bắt đầu hơn.)"
                          >
                            <span className="text-slate-500">Độ sâu:</span>
                            <input
                              type="number"
                              value={mod.injection_depth || 0}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  injection_depth:
                                    parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 outline-none text-center"
                            />
                          </label>
                          <label
                            className="flex items-center gap-2 text-slate-300"
                            title="Thứ tự cùng độ sâu (Nhỏ hơn = xuất hiện trước/cao hơn)"
                          >
                            <span className="text-slate-500">Thứ tự:</span>
                            <input
                              type="number"
                              value={mod.injection_order || 0}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  injection_order:
                                    parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-16 bg-slate-900 border border-slate-700 rounded px-1 outline-none text-center"
                            />
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer ml-auto border-l border-slate-700 pl-4 py-0.5">
                            <input
                              type="checkbox"
                              checked={mod.system_prompt || false}
                              onChange={(e) =>
                                updateModule(absoluteIdx, {
                                  system_prompt: e.target.checked,
                                })
                              }
                              className="accent-mystic-accent"
                            />
                            <span
                              className={`${mod.system_prompt ? "text-mystic-accent font-medium" : "text-slate-400"}`}
                            >
                              Lệnh Main System
                            </span>
                          </label>
                        </div>

                        {/* Content Area */}
                        <div className="p-0">
                          <textarea
                            value={mod.content}
                            onChange={(e) =>
                              updateModule(absoluteIdx, {
                                content: e.target.value,
                              })
                            }
                            placeholder="Nội dung module..."
                            className="w-full bg-slate-950 text-slate-200 p-3 h-24 min-h-[96px] text-sm font-mono outline-none resize-y border-none focus:bg-[#111] transition"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {filteredModules.length === 0 && (
                    <div className="text-center p-8 text-slate-500 bg-slate-900/50 rounded-lg border border-dashed border-slate-800">
                      Không tìm thấy module nào. Hãy tạo mới để bắt đầu.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROMPTS & FORMATTING TAB */}
            {activeTab === "prompts" && (
              <div className="flex flex-col gap-6 max-w-3xl">
                <ConfigSection
                  title="Các Lệnh Cấu Trúc Cốt Lõi"
                  description="Các lệnh này ghi đè các lệnh cấu trúc mặc định của ST."
                >
                  <TextAreaField
                    label="Lệnh Nhập Vai (Impersonation)"
                    value={config.impersonation_prompt}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, impersonation_prompt: v }))
                    }
                  />
                  <TextAreaField
                    label="Lệnh Thúc Đẩy Tiếp Tục (Continue Nudge)"
                    value={config.continue_nudge_prompt}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, continue_nudge_prompt: v }))
                    }
                  />
                </ConfigSection>

                <ConfigSection
                  title="Định Dạng Dữ Liệu"
                  description="Cách các macro và thông tin nhân vật, thế giới được chèn vào."
                >
                  <TextAreaField
                    label="Định Dạng World Info"
                    value={config.wi_format}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, wi_format: v }))
                    }
                    placeholder="VD: World Info: {{entry}}"
                  />
                  <TextAreaField
                    label="Định Dạng Kịch Bản"
                    value={config.scenario_format}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, scenario_format: v }))
                    }
                  />
                  <TextAreaField
                    label="Định Dạng Tính Cách"
                    value={config.personality_format}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, personality_format: v }))
                    }
                  />
                </ConfigSection>

                <ConfigSection title="Nâng Cao">
                  <TextAreaField
                    label="Lệnh Chat Mới"
                    value={config.new_chat_prompt}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, new_chat_prompt: v }))
                    }
                  />
                  <TextAreaField
                    label="Gửi khi Rỗng"
                    value={config.send_if_empty}
                    onChange={(v: string) =>
                      updateConfig((c) => ({ ...c, send_if_empty: v }))
                    }
                    placeholder="Văn bản thay thế nếu nội dung nhập rỗng"
                  />
                </ConfigSection>

                {/* Removed Chain of Thought (CoT) Selection section per SillyTavern design alignment */}
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === "settings" && (
              <div className="flex flex-col gap-6 max-w-3xl">
                <ConfigSection
                  title="Thông Số Lấy Mẫu AI (AI Sampling)"
                  description="Các thiết lập này kiểm soát độ sáng tạo và độ ổn định của văn bản AI tạo ra."
                >
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label="Temperature"
                      value={config.temperature}
                      defaultVal={DEFAULT_AI_SETTINGS.temperature}
                      step={0.05}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, temperature: v }))
                      }
                    />
                    <NumberField
                      label="Top P"
                      value={config.top_p}
                      defaultVal={DEFAULT_AI_SETTINGS.top_p}
                      step={0.05}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, top_p: v }))
                      }
                    />
                    <NumberField
                      label="Min P"
                      value={config.min_p}
                      defaultVal={DEFAULT_AI_SETTINGS.min_p}
                      step={0.01}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, min_p: v }))
                      }
                    />
                    <NumberField
                      label="Top K"
                      value={config.top_k}
                      defaultVal={DEFAULT_AI_SETTINGS.top_k}
                      step={1}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, top_k: v }))
                      }
                    />
                    <NumberField
                      label="Repetition Penalty (Nhại Lại)"
                      value={config.repetition_penalty}
                      defaultVal={DEFAULT_AI_SETTINGS.repetition_penalty}
                      step={0.05}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, repetition_penalty: v }))
                      }
                    />
                    <NumberField
                      label="Presence Penalty"
                      value={config.presence_penalty}
                      defaultVal={DEFAULT_AI_SETTINGS.presence_penalty}
                      step={0.05}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, presence_penalty: v }))
                      }
                    />
                    <NumberField
                      label="Frequency Penalty"
                      value={config.frequency_penalty}
                      defaultVal={DEFAULT_AI_SETTINGS.frequency_penalty}
                      step={0.05}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, frequency_penalty: v }))
                      }
                    />
                    <NumberField
                      label="Top A"
                      value={config.top_a}
                      defaultVal={DEFAULT_AI_SETTINGS.top_a}
                      step={0.05}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, top_a: v }))
                      }
                    />
                  </div>
                </ConfigSection>

                <ConfigSection title="Giới Hạn Ngữ Cảnh">
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label="Chuỗi Ngữ Cảnh Tối Đa (Tokens)"
                      value={config.openai_max_context}
                      defaultVal={DEFAULT_AI_SETTINGS.openai_max_context}
                      step={1000}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, openai_max_context: v }))
                      }
                    />
                    <NumberField
                      label="Trần Output Generation (Tokens)"
                      value={config.openai_max_tokens}
                      defaultVal={DEFAULT_AI_SETTINGS.openai_max_tokens}
                      step={128}
                      onChange={(v: number | undefined) =>
                        updateConfig((c) => ({ ...c, openai_max_tokens: v }))
                      }
                    />
                  </div>
                </ConfigSection>
              </div>
            )}

            {/* VARIABLES TAB */}
            {activeTab === "variables" && (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Variable className="text-mystic-accent" size={20} />
                    <h3 className="text-lg font-bold text-slate-200">
                      Kho Lưu Trữ Đầu Vào (Variables)
                    </h3>
                  </div>
                  <button
                    onClick={addVariable}
                    className="flex items-center gap-2 px-3 py-1.5 bg-mystic-accent/20 text-mystic-accent border border-mystic-accent/30 rounded-lg hover:bg-mystic-accent/30 transition text-sm"
                  >
                    <Plus size={16} /> Thêm Biến
                  </button>
                </div>

                <div className="bg-slate-800/30 border border-slate-800 p-4 rounded-xl mb-4">
                  <p className="text-slate-400 text-sm">
                    Định nghĩa các biến tĩnh có thể tái sử dụng qua macro{" "}
                    <code>{`{{tên_biến}}`}</code> trong các module lệnh. Các
                    biến này cũng có thể được tự động cập nhật bởi AI nếu bạn
                    cấp quyền ghi cho AI (ST V4 Spec).
                  </p>
                </div>

                <div className="flex flex-col gap-3 pb-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {(config.variables || []).length === 0 ? (
                    <div className="text-center p-8 text-slate-500 bg-slate-900/50 rounded-lg border border-dashed border-slate-800">
                      Chưa có biến nào. Hãy nhấn Thêm Biến để bắt đầu.
                    </div>
                  ) : (
                    (config.variables || []).map((v, idx) => (
                      <div
                        key={v.id}
                        className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex flex-col gap-3"
                      >
                        <div className="flex gap-4 items-start">
                          <div className="flex flex-col flex-1 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-mono text-xs">{`{{`}</span>
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) =>
                                  updateVariable(idx, {
                                    name: e.target.value.replace(
                                      /[^a-zA-Z0-9_]/g,
                                      "",
                                    ),
                                  })
                                }
                                placeholder="ten_bien_khong_dau"
                                className="bg-slate-900 border border-slate-700 rounded p-1.5 text-sm text-mystic-accent font-mono outline-none focus:border-mystic-accent flex-1 max-w-[200px]"
                              />
                              <span className="text-slate-500 font-mono text-xs">{`}}`}</span>
                            </div>
                            <input
                              type="text"
                              value={v.description || ""}
                              onChange={(e) =>
                                updateVariable(idx, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Mô tả công dụng biến (dành cho bạn và AI)..."
                              className="bg-transparent border-b border-slate-700 hover:border-slate-600 focus:border-slate-500 p-1 text-xs text-slate-400 outline-none w-full"
                            />
                          </div>
                          <div className="flex-1 flex flex-col gap-1">
                            <label className="text-xs text-slate-500">
                              Giá trị khởi tạo/hiện tại:
                            </label>
                            <textarea
                              value={v.value}
                              onChange={(e) =>
                                updateVariable(idx, { value: e.target.value })
                              }
                              placeholder="Giá trị..."
                              className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-mystic-accent resize-y min-h-[60px]"
                            />
                          </div>
                          <div className="flex flex-col gap-1 w-8 shrink-0 items-end">
                            <button
                              onClick={() => moveVariable(idx, -1)}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => moveVariable(idx, 1)}
                              disabled={idx === config.variables!.length - 1}
                              className="p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => removeVariable(idx)}
                              className="p-1.5 text-slate-500 hover:text-red-400 mt-2"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {/* REGEX TAB */}
            {activeTab === "regex" && (
              <RegexScriptsManager
                presetName={activePreset?.name || "Preset"}
                scripts={config.regexScripts || []}
                onChange={(scripts) => updateConfig((c) => ({ ...c, regexScripts: scripts }))}
                playerName={playerName}
                charName={charName}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function TabButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${active ? "bg-mystic-accent/10 text-mystic-accent font-medium" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${active ? "bg-mystic-accent/20" : "bg-slate-800"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function ConfigSection({ title, description, children }: any) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-800/30 border border-slate-800 rounded-xl">
      <div>
        <h3 className="font-bold text-slate-200">{title}</h3>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: any) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-mystic-accent font-mono resize-y min-h-[60px]"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, defaultVal, step = 1 }: any) {
  const isSet = value !== undefined && value !== null;
  const currentVal = isSet ? (isNaN(value as number) ? '' : value) : defaultVal;

  return (
    <label className="flex flex-col gap-1.5 bg-slate-900 p-2 rounded-lg border border-slate-800">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <button
          onClick={() => onChange(isSet ? undefined : defaultVal)}
          className={`text-[10px] px-1.5 rounded ${isSet ? "bg-slate-700/50 text-mystic-accent" : "bg-slate-800 text-slate-500"}`}
        >
          {isSet ? "GHI ĐÈ (OVERRIDE)" : "MẶC ĐỊNH (DEFAULT)"}
        </button>
      </div>
      <input
        type="number"
        disabled={!isSet}
        value={currentVal}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        className="bg-transparent text-sm text-white outline-none disabled:opacity-50"
      />
    </label>
  );
}
