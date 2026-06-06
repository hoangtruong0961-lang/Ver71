import { useState, useRef, useEffect, useCallback } from 'react';
import { AppSettings, WorldData, TawaPresetConfig, RegexScript, GameTime } from '../../../../types';
import { INITIAL_GAME_TIME } from '../../../../utils/timeUtils';
import { tavoRegistry } from '../../../../services/api/tavoApi';
import { dbService } from '../../../../services/db/indexedDB';
import { parseBuiltinPreset } from '../components/TawaPresetManager';
import tawaReYilPresetData from '../../../../assets/presets/tawa_re_yil.json';

export function useGameConfig(activeWorld: WorldData | null) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tawaPresetConfig, setTawaPresetConfig] = useState<TawaPresetConfig>(() => {
    if (activeWorld?.config?.tawaPreset) {
      return activeWorld.config.tawaPreset;
    }
    try {
      const defaultSavedPreset = parseBuiltinPreset("builtin_tawa_re_yil", "Tawa Re = YIL丨Alpha V1", tawaReYilPresetData);
      return defaultSavedPreset.config;
    } catch (e) {
      console.error("Failed to parse fallback default preset in useGameConfig state initialization", e);
      return { modules: [] };
    }
  });
  const [dynamicRules, setDynamicRules] = useState<string[]>(activeWorld?.config?.rules || []);
  const [combinedRegexScripts, setCombinedRegexScripts] = useState<RegexScript[]>([]);
  const [gameTime, setGameTime] = useState<GameTime>(activeWorld?.gameTime || INITIAL_GAME_TIME);

  const dynamicRulesRef = useRef<string[]>(activeWorld?.config?.rules || []);
  const tawaPresetConfigRef = useRef<TawaPresetConfig>(tawaPresetConfig);
  const gameTimeRef = useRef<GameTime>(activeWorld?.gameTime || INITIAL_GAME_TIME);
  const activeWorldRef = useRef<WorldData | null>(activeWorld);

  const reloadRegexScripts = useCallback(async () => {
    try {
        const s = await dbService.getSettings() as AppSettings;
        setSettings(s);
        const globals = s?.regex_scripts || [];
        const scopeds = activeWorldRef.current?.extensions?.regex_scripts || [];
        const entityRegs: RegexScript[] = [];
        if (activeWorldRef.current?.entities) {
          activeWorldRef.current.entities.forEach((ent) => {
            if (ent.extensions?.regex_scripts && Array.isArray(ent.extensions.regex_scripts)) {
              entityRegs.push(...ent.extensions.regex_scripts);
            }
          });
        }
        const presets = tawaPresetConfigRef.current?.regexScripts || activeWorldRef.current?.config?.regexScripts || [];
        setCombinedRegexScripts([...globals, ...scopeds, ...entityRegs, ...presets]);
    } catch (e) {
        console.error("Failed to load regex scripts", e);
    }
  }, []);

  useEffect(() => {
    dynamicRulesRef.current = dynamicRules;
  }, [dynamicRules]);

  useEffect(() => {
    tawaPresetConfigRef.current = tawaPresetConfig;
    reloadRegexScripts();
  }, [tawaPresetConfig, reloadRegexScripts]);

  useEffect(() => {
    gameTimeRef.current = gameTime;
  }, [gameTime]);

  useEffect(() => { activeWorldRef.current = activeWorld; }, [activeWorld]);

  const loadInitialSettings = useCallback((appSettings: AppSettings) => {
    setSettings(appSettings);
  }, []);

  const syncConfigFromSave = useCallback((worldDataWithState: WorldData) => {
      if (worldDataWithState.config?.rules) setDynamicRules(worldDataWithState.config.rules);
      if (worldDataWithState.config?.tawaPreset) {
          setTawaPresetConfig(worldDataWithState.config.tawaPreset);
          tawaPresetConfigRef.current = worldDataWithState.config.tawaPreset;
      }
      setGameTime(worldDataWithState.gameTime || INITIAL_GAME_TIME);
  }, []);

  return {
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
    reloadRegexScripts
  };
}
