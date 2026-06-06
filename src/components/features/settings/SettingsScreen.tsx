
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavigationProps, GameState, AppSettings, ThinkingBudgetLevel, ThinkingLevel, NarrativePerspective, CustomTheme } from '../../../types';
import SafetySettings from './SafetySettings';
import RegexScriptsManager from '../gameplay/components/RegexScriptsManager';
import { dbService, DEFAULT_SETTINGS } from '../../../services/db/indexedDB';
import { elevenLabsService, ElevenLabsVoice } from '../../../services/audio/elevenlabs';
import { browserTtsService, BrowserVoice } from '../../../services/audio/browsertts';
import Button from '../../ui/Button';
import { Plus, Trash2, ChevronUp, ChevronDown, CheckCircle2, Globe, RefreshCw, Sparkles, Sliders, Database, Shield, Zap, Palette, Monitor, HardDrive, Server, Paintbrush, Mic, Volume2, Activity } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { DIFFICULTY_LEVELS, OUTPUT_LENGTHS } from '../../../constants/promptTemplates';

interface SettingsScreenProps extends NavigationProps {
  fromGame?: boolean;
  initialTab?: string;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate, fromGame, initialTab }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'display' | 'game' | 'advanced' | 'api' | 'custom-theme' | 'tts'>(
    (initialTab as any) || 'general'
  );
  
  const { 
    setTheme, setFontFamily, setFontSize, setVisualEffects, setLayoutZoom,
    useCustomTheme, setUseCustomTheme,
    customThemes, setCustomThemes,
    activeCustomThemeId, setActiveCustomThemeId
  } = useTheme();

  const [localFontSize, setLocalFontSize] = useState<string>('');
  const [manualKeyText, setManualKeyText] = useState('');

  // ElevenLabs local states
  const [fetchedVoices, setFetchedVoices] = useState<ElevenLabsVoice[]>([]);
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsSuccess, setTtsSuccess] = useState<string | null>(null);
  const [isTestingTts, setIsTestingTts] = useState(false);
  const [testPhrase, setTestPhrase] = useState('Xin chào! Tôi là giọng nói truyền cảm hứng từ ElevenLabs.');

  // Browser TTS local states
  const [browserVoices, setBrowserVoices] = useState<BrowserVoice[]>([]);
  const [isTestingBrowserTts, setIsTestingBrowserTts] = useState(false);
  const [browserTestPhrase, setBrowserTestPhrase] = useState('Xin chào! Đây là chức năng đọc văn bản tích hợp sẵn của trình duyệt. Hoàn toàn miễn phí và không cần API key!');

  // States for Custom Theme design
  const [newThemeName, setNewThemeName] = useState('Theme Của Tôi');
  const [newThemePrimary, setNewThemePrimary] = useState('#0b1329');
  const [newThemeSecondary, setNewThemeSecondary] = useState('#f1f5f9');
  const [newAccentColor, setNewAccentColor] = useState('#38bdf8');
  const [newSuccessColor, setNewSuccessColor] = useState('#10b981');
  const [newWarningColor, setNewWarningColor] = useState('#f59e0b');
  const [newErrorColor, setNewErrorColor] = useState('#ef4444');
  const [newMutedColor, setNewMutedColor] = useState('#64748b');
  const [manualColorOverride, setManualColorOverride] = useState(false);

  const [bgImage, setBgImage] = useState<string | null>(null);
  const bgBlur = dbService.getKeyValueSync('ark_v2_bg_blur') !== false && dbService.getKeyValueSync('ark_v2_bg_blur') !== 'false';

  useEffect(() => {
    const load = async () => {
      const s = await dbService.getSettings();
      setSettings(s);
      if (s) {
        setLocalFontSize(s.fontSize.toString());
      }

      const savedBg = await dbService.getAsset('ark_v2_custom_bg');
      if (savedBg) {
        setBgImage(savedBg);
      } else {
        const legacyBg = await dbService.getAsset('ark_v1_custom_bg');
        if (legacyBg) {
          setBgImage(legacyBg);
        } else {
          setBgImage(null);
        }
      }

      // Load current active custom theme form data if any
      if (s && s.activeCustomThemeId && s.customThemes) {
        const activeTheme = s.customThemes.find(t => t.id === s.activeCustomThemeId);
        if (activeTheme) {
          setNewThemeName(activeTheme.name);
          setNewThemePrimary(activeTheme.primaryColor);
          setNewThemeSecondary(activeTheme.secondaryColor);
          setNewAccentColor(activeTheme.accentColor);
          setNewSuccessColor(activeTheme.successColor);
          setNewWarningColor(activeTheme.warningColor);
          setNewErrorColor(activeTheme.errorColor);
          setNewMutedColor(activeTheme.mutedColor);
          setManualColorOverride(true);
        }
      }

      // Try to load ElevenLabs voices on startup if configured
      try {
        const voices = await elevenLabsService.getVoices(s?.elevenLabsApiKey);
        if (voices && voices.length > 0) {
          setFetchedVoices(voices);
        }
      } catch (e) {
        // Silent catch on startup to avoid blocking basic settings loading
      }

      // Load Browser TTS voices
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const populateBrowserVoices = () => {
          const list = window.speechSynthesis.getVoices().map(v => ({
            voiceURI: v.voiceURI,
            name: v.name,
            lang: v.lang,
            localService: v.localService,
            default: v.default
          }));
          setBrowserVoices(list);
        };
        populateBrowserVoices();
        window.speechSynthesis.onvoiceschanged = populateBrowserVoices;
      }
    };
    load();
  }, []);

  // Listen for TTS playback events to sync test playing status
  useEffect(() => {
    const handleTtsState = (playing: boolean, activeId: string | null) => {
      if (activeId === "test-playground") {
        setIsTestingTts(playing);
      }
    };
    elevenLabsService.addListener(handleTtsState);
    return () => {
      elevenLabsService.removeListener(handleTtsState);
      // Stop test play on screen unmount
      if (elevenLabsService.getActiveId() === "test-playground") {
        elevenLabsService.stop();
      }
    };
  }, []);

  // Listen for Browser TTS playback events
  useEffect(() => {
    const handleBrowserTtsState = (playing: boolean, activeId: string | null) => {
      if (activeId === "browser-test-playground") {
        setIsTestingBrowserTts(playing);
      }
    };
    browserTtsService.addListener(handleBrowserTtsState);
    return () => {
      browserTtsService.removeListener(handleBrowserTtsState);
      // Stop browser test play on screen unmount
      if (browserTtsService.getActiveId() === "browser-test-playground") {
        browserTtsService.stop();
      }
    };
  }, []);

  const handleTestPlayBrowserTts = async () => {
    if (!settings) return;
    if (isTestingBrowserTts) {
      browserTtsService.stop();
      return;
    }
    setTtsError(null);
    try {
      await browserTtsService.speak(browserTestPhrase, "browser-test-playground", settings);
    } catch (e: any) {
      setTtsError(e.message || "Có lỗi xảy ra khi phát thử giọng nói trình duyệt.");
    }
  };

  // Custom Theme Helpers & Effects
  const calculateLuminosity = (hex: string) => {
    try {
      const c = hex.replace('#', '');
      const r = parseInt(c.slice(0, 2), 16) / 255;
      const g = parseInt(c.slice(2, 4), 16) / 255;
      const b = parseInt(c.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    } catch {
      return 0.1;
    }
  };

  const mixHexColors = (color1: string, color2: string, ratio: number): string => {
    try {
      const c1 = color1.replace('#', '');
      const c2 = color2.replace('#', '');
      const r1 = parseInt(c1.slice(0, 2), 16);
      const g1 = parseInt(c1.slice(2, 4), 16);
      const b1 = parseInt(c1.slice(4, 6), 16);
      const r2 = parseInt(c2.slice(0, 2), 16);
      const g2 = parseInt(c2.slice(2, 4), 16);
      const b2 = parseInt(c2.slice(4, 6), 16);
      const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
      const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
      const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
      const toHex = (val: number) => Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      return color2;
    }
  };

  // Automatically compute colors when choosing primary and secondary
  useEffect(() => {
    if (manualColorOverride) return;
    const isPrimaryDark = calculateLuminosity(newThemePrimary) < 0.5;
    
    // Auto Accent
    const defaultAccent = isPrimaryDark ? '#38bdf8' : '#2563eb';
    setNewAccentColor(defaultAccent);

    // Auto Muted (55% secondary color mixed on top of primary)
    const defaultMuted = mixHexColors(newThemePrimary, newThemeSecondary, 0.55);
    setNewMutedColor(defaultMuted);

    // Dynamic warning, success, error based on luminance
    setNewSuccessColor(isPrimaryDark ? '#10b981' : '#16a34a');
    setNewWarningColor(isPrimaryDark ? '#f59e0b' : '#d97706');
    setNewErrorColor(isPrimaryDark ? '#ef4444' : '#dc2626');
  }, [newThemePrimary, newThemeSecondary, manualColorOverride]);

  const handleToggleCustomTheme = (enabled: boolean) => {
    setUseCustomTheme(enabled);
    handleChange('useCustomTheme', enabled);
  };

  const handleSelectCustomThemeId = (id: string) => {
    setActiveCustomThemeId(id);
    handleChange('activeCustomThemeId', id);
    
    const selected = customThemes.find(c => c.id === id);
    if (selected) {
      setNewThemeName(selected.name);
      setNewThemePrimary(selected.primaryColor);
      setNewThemeSecondary(selected.secondaryColor);
      setNewAccentColor(selected.accentColor);
      setNewSuccessColor(selected.successColor);
      setNewWarningColor(selected.warningColor);
      setNewErrorColor(selected.errorColor);
      setNewMutedColor(selected.mutedColor);
      setManualColorOverride(true);
    }
  };

  const handleSaveCustomTheme = () => {
    if (!newThemeName.trim()) {
      alert("Vui lòng nhập tên theme!");
      return;
    }

    const isPrimaryDark = calculateLuminosity(newThemePrimary) < 0.5;
    const themeId = activeCustomThemeId || `theme-${Date.now()}`;
    
    const themeToSave: CustomTheme = {
      id: themeId,
      name: newThemeName.trim(),
      primaryColor: newThemePrimary,
      secondaryColor: newThemeSecondary,
      accentColor: newAccentColor,
      successColor: newSuccessColor,
      warningColor: newWarningColor,
      errorColor: newErrorColor,
      mutedColor: newMutedColor,
      isDark: isPrimaryDark
    };

    let updatedThemes = [...customThemes];
    const index = updatedThemes.findIndex(t => t.id === themeId);
    if (index !== -1) {
      updatedThemes[index] = themeToSave;
    } else {
      updatedThemes.push(themeToSave);
    }

    setCustomThemes(updatedThemes);
    setActiveCustomThemeId(themeId);
    setUseCustomTheme(true);

    handleMultipleChanges({
      customThemes: updatedThemes,
      activeCustomThemeId: themeId,
      useCustomTheme: true
    });
  };

  const handleNewTheme = () => {
    setActiveCustomThemeId('');
    setNewThemeName('Custom Theme Mới');
    setNewThemePrimary('#0b1329');
    setNewThemeSecondary('#f1f5f9');
    setManualColorOverride(false);
  };

  const handleDeleteCustomTheme = (idToDelete: string) => {
    if (!confirm("Bạn có chắc muốn xóa theme này?")) return;
    const updatedThemes = customThemes.filter(t => t.id !== idToDelete);
    setCustomThemes(updatedThemes);
    
    let nextActiveId = activeCustomThemeId;
    if (activeCustomThemeId === idToDelete) {
      nextActiveId = updatedThemes.length > 0 ? updatedThemes[0].id : '';
      setActiveCustomThemeId(nextActiveId);
    }

    const useThemeVal = updatedThemes.length > 0 ? useCustomTheme : false;
    setUseCustomTheme(useThemeVal);

    handleMultipleChanges({
      customThemes: updatedThemes,
      activeCustomThemeId: nextActiveId,
      useCustomTheme: useThemeVal
    });
  };

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      if (!prev) return null;
      const newSettings = { ...prev, [key]: value };
      
      // Sync aiModel to active proxy's model
      if (key === 'aiModel' && typeof value === 'string' && prev.activeProxyId) {
        newSettings.proxies = prev.proxies.map(p => {
          if (p.id === prev.activeProxyId) {
            return { ...p, model: value };
          }
          return p;
        });
      }

      // Sync activeProxyId selection to aiModel
      if (key === 'activeProxyId' && value) {
        const targetProxy = prev.proxies.find(p => p.id === value);
        if (targetProxy && targetProxy.model) {
          newSettings.aiModel = targetProxy.model;
        }
      }
      
      // Side effects should be triggered after state update
      setTimeout(() => {
        dbService.saveSettings(newSettings);
        if (key === 'theme') setTheme(value as 'light' | 'dark');
        if (key === 'systemFont') setFontFamily(value as string);
        if (key === 'fontSize') {
          setFontSize(value as number);
          setLocalFontSize(value.toString());
        }
        if (key === 'visualEffects') setVisualEffects(value as boolean);
        if (key === 'layoutZoom') setLayoutZoom(value as number);
      }, 0);
      
      return newSettings;
    });
  };

  const handleMultipleChanges = (changes: Partial<AppSettings>) => {
    setSettings(prev => {
      if (!prev) return null;
      const newSettings = { ...prev, ...changes };
      
      // Sync proxy changes
      const activeId = changes.activeProxyId !== undefined ? changes.activeProxyId : prev.activeProxyId;
      const proxies = changes.proxies !== undefined ? changes.proxies : prev.proxies;
      if (activeId && proxies) {
        const activeProxy = proxies.find(p => p.id === activeId);
        if (activeProxy && activeProxy.model && activeProxy.model !== newSettings.aiModel) {
          if (changes.aiModel === undefined) {
            newSettings.aiModel = activeProxy.model;
          }
        }
      }
      
      // Side effects should be triggered after state update
      setTimeout(() => {
        dbService.saveSettings(newSettings);
        Object.entries(changes).forEach(([key, value]) => {
          if (key === 'theme') setTheme(value as 'light' | 'dark');
          if (key === 'systemFont') setFontFamily(value as string);
          if (key === 'fontSize') {
            setFontSize(value as number);
            setLocalFontSize(value.toString());
          }
          if (key === 'visualEffects') setVisualEffects(value as boolean);
          if (key === 'layoutZoom') setLayoutZoom(value as number);
        });
      }, 0);
      
      return newSettings;
    });
  };

  const handleGlobalUpdate = (newSettings: AppSettings) => {
    setSettings(newSettings);
    dbService.saveSettings(newSettings);
  };

  const handleFetchVoices = async () => {
    if (!settings) return;
    setIsFetchingVoices(true);
    setTtsError(null);
    setTtsSuccess(null);
    try {
      const voices = await elevenLabsService.getVoices(settings.elevenLabsApiKey);
      setFetchedVoices(voices);
      if (voices.length > 0) {
        setTtsSuccess(`Đã tải thành công ${voices.length} giọng nói từ tài khoản ElevenLabs!`);
      } else {
        setTtsError("Không tìm thấy giọng nói nào trong tài khoản của bạn.");
      }
    } catch (e: any) {
      setTtsError(e.message || "Không thể tải danh sách giọng nói. Kiểm tra lại API Key hoặc cấu hình máy chủ.");
    } finally {
      setIsFetchingVoices(false);
    }
  };

  const handleTestPlayTts = async () => {
    if (!settings) return;
    if (isTestingTts) {
      elevenLabsService.stop();
      return;
    }
    setTtsError(null);
    try {
      await elevenLabsService.speak(testPhrase, "test-playground", settings);
    } catch (e: any) {
      setTtsError(e.message || "Có lỗi xảy ra khi phát thử giọng nói.");
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    await dbService.saveSettings(settings);
    setIsSaving(false);
    onNavigate(fromGame ? GameState.PLAYING : GameState.MENU);
  };

  const handleResetFactory = async () => {
      setSettings(DEFAULT_SETTINGS);
      await dbService.saveSettings(DEFAULT_SETTINGS);
  };

  const handleAddManualKeys = () => {
    const newKeys = manualKeyText.split('\n').map(k => k.trim()).filter(k => k !== '');
    if (newKeys.length > 0) {
      const currentKeys = settings?.geminiApiKey || [];
      const updatedKeys = [...currentKeys];
      newKeys.forEach(nk => { if (!updatedKeys.includes(nk)) updatedKeys.push(nk); });
      handleChange('geminiApiKey', updatedKeys);
      setManualKeyText('');
    }
  };

  const handleLoadModels = async () => {
    if (!settings?.proxies || settings.proxies.length === 0) {
      return;
    }
    
    setIsSaving(true);
    let updatedSettings = { ...settings };
    const updatedProxies = [...settings.proxies];

    const processModelData = (data: any, currentModel: string) => {
      let modelList: string[] = [];
      
      const extractId = (m: any): string | null => {
        if (typeof m === 'string') return m;
        if (m && typeof m === 'object') {
          return m.id || m.name || m.model || m.slug || m.key || null;
        }
        return null;
      };

      if (Array.isArray(data)) {
        modelList = data.map(extractId).filter((m): m is string => !!m);
      } else if (data && Array.isArray(data.data)) {
        // OpenAI style
        modelList = data.data.map(extractId).filter((m): m is string => !!m);
      } else if (data && Array.isArray(data.models)) {
        // Google style
        modelList = data.models.map(m => {
          const id = extractId(m);
          return id ? id.replace('models/', '') : null;
        }).filter((m): m is string => !!m);
      } else if (data && data.data && Array.isArray(data.data.models)) {
        // Some other providers
        modelList = data.data.models.map(extractId).filter((m): m is string => !!m);
      } else if (data && Array.isArray(data.model_names)) {
        // Simple string array providers
        modelList = data.model_names.filter((m: any) => typeof m === 'string');
      }
      
      // Filter out duplicates and empty values
      modelList = Array.from(new Set(modelList.filter(m => m && typeof m === 'string')));

      if (modelList.length > 0) {
        // Sắp xếp theo yêu cầu: Chữ A-Z, Số từ lớn đến nhỏ
        modelList.sort((a, b) => {
          const split = (s: string) => s.match(/(\d+)|(\D+)/g) || [];
          const aParts = split(a);
          const bParts = split(b);
          
          for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
            const aP = aParts[i];
            const bP = bParts[i];
            const aIsNum = /^\d+$/.test(aP);
            const bIsNum = /^\d+$/.test(bP);
            
            if (aIsNum && bIsNum) {
              // Nếu cả hai là số, xếp từ lớn đến nhỏ (Descending)
              const diff = parseInt(bP) - parseInt(aP);
              if (diff !== 0) return diff;
            } else {
              // Nếu là chữ, xếp theo a-z (Ascending)
              const comp = aP.toLowerCase().localeCompare(bP.toLowerCase());
              if (comp !== 0) return comp;
            }
          }
          return aParts.length - bParts.length;
        });

        return {
          models: modelList,
          model: modelList.includes(currentModel) ? currentModel : modelList[0]
        };
      } else {
        throw new Error("Proxy không trả về danh sách model hợp lệ");
      }
    };

    const loadFromProxy = async (url: string, key: string, currentModel: string, type?: string) => {
      // Normalize URL: remove trailing slash
      const baseUrl = url.replace(/\/$/, '');
      const isOpenAI = type === 'openai' || type === 'openrouter' || baseUrl.toLowerCase().includes('/v1') || baseUrl.toLowerCase().includes('openrouter.ai') || baseUrl.toLowerCase().includes('groq.com');
      
      const tryFetch = async (fetchUrl: string, useGoogleKey: boolean = false) => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          if (key) {
            if (isOpenAI && !useGoogleKey) {
              headers['Authorization'] = `Bearer ${key}`;
            } else {
              headers['x-goog-api-key'] = key;
            }
          }

          // For Google style, also try appending key to URL to bypass some CORS header restrictions
          const finalUrl = (!isOpenAI && key && !fetchUrl.includes('key=')) 
            ? `${fetchUrl}${fetchUrl.includes('?') ? '&' : '?'}key=${key}`
            : fetchUrl;

          const response = await fetch(finalUrl, { headers });
          if (response.ok) return await response.json();
          return null;
        } catch (e) {
          return null;
        }
      };

      try {
        // Try multiple common paths based on detected type
        const paths = isOpenAI ? [
          `${baseUrl}/models`,
          baseUrl.replace(/\/v1$/, '') + '/models',
          `${baseUrl}`
        ] : [
          `${baseUrl}/v1beta/models`,
          `${baseUrl}/v1/models`,
          `${baseUrl}/models`,
          baseUrl
        ];

        for (const path of paths) {
          // Try with standard headers
          let data = await tryFetch(path, false);
          
          // If failed and not OpenAI, try with Google key header
          if (!data && !isOpenAI) {
            data = await tryFetch(path, true);
          }

          if (data) {
            try {
              return processModelData(data, currentModel);
            } catch (e) {
              continue;
            }
          }
        }
        
        throw new Error("Không thể tải danh sách model (CORS hoặc URL sai). Bạn có thể nhập tên model thủ công.");
      } catch (err: unknown) {
        console.error("Proxy Error:", err);
        throw err;
      }
    };

    try {
      const loadPromises = updatedProxies.map(async (proxy, index) => {
        if (!proxy.url) return;
        try {
          const result = await loadFromProxy(proxy.url, proxy.key || '', proxy.model || '', proxy.type);
          updatedProxies[index] = {
            ...proxy,
            models: result.models,
            model: result.model,
            lastError: undefined
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Proxy ${index + 1}: ${message}`);
          updatedProxies[index] = {
            ...proxy,
            lastError: message
          };
        }
      });

      await Promise.all(loadPromises);
      
      updatedSettings = {
        ...updatedSettings,
        proxies: updatedProxies
      };
      
      setSettings(updatedSettings);
      await dbService.saveSettings(updatedSettings);
    } catch (err: unknown) {
      console.error("General Proxy Error:", err);
    } finally {
      setIsSaving(false);
    }
  };
  const addProxy = () => {
    if (!settings) return;
    const newProxy = {
      id: `proxy-${Date.now()}`,
      url: '',
      key: '',
      model: '',
      models: [],
      isActive: false,
      type: 'google' as const
    };
    const updatedProxies = [...settings.proxies, newProxy];
    handleMultipleChanges({
      proxies: updatedProxies,
      activeProxyId: settings.activeProxyId || newProxy.id
    });
  };

  const removeProxy = (id: string) => {
    if (!settings) return;
    const updatedProxies = settings.proxies.filter(p => p.id !== id);
    let newActiveId = settings.activeProxyId;
    if (newActiveId === id) {
      newActiveId = updatedProxies.length > 0 ? updatedProxies[0].id : undefined;
    }
    handleMultipleChanges({
      proxies: updatedProxies,
      activeProxyId: newActiveId
    });
  };

  const updateProxy = (id: string, updates: Partial<any>) => {
    if (!settings) return;
    const updatedProxies = settings.proxies.map(p => {
      if (p.id === id) {
        const newProxy = { ...p, ...updates };
        // Auto-detect type if URL changed and type not explicitly provided
        if (updates.url !== undefined && updates.type === undefined) {
          const url = updates.url.toLowerCase();
          if (url.includes('openrouter.ai')) newProxy.type = 'openrouter';
          else if (url.includes('groq.com') || url.includes('/v1')) newProxy.type = 'openai';
          else newProxy.type = 'google';
        }
        return newProxy;
      }
      return p;
    });
    
    // Sync aiModel when the active proxy's model is updated
    const changes: Partial<AppSettings> = { proxies: updatedProxies };
    if (id === settings.activeProxyId && updates.model !== undefined) {
      changes.aiModel = updates.model;
    }
    handleMultipleChanges(changes);
  };

  const moveProxy = (index: number, direction: 'up' | 'down') => {
    if (!settings) return;
    const newProxies = [...settings.proxies];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newProxies.length) return;
    
    [newProxies[index], newProxies[targetIndex]] = [newProxies[targetIndex], newProxies[index]];
    handleChange('proxies', newProxies);
  };

  const handleResetApiTab = () => {
    if (settings) {
      setSettings({
        ...settings,
        geminiApiKey: [],
        proxies: [],
        activeProxyId: undefined,
        useGeminiApi: true,
        proxyEnabled: false
      });
    }
  };

  const handleImportTxt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      // Try JSON first
      try {
        const parsed = JSON.parse(content);
        if (settings) {
            // Guess type from URL
            const url = parsed.proxyUrl || parsed.url || '';
            let type: 'google' | 'openai' | 'openrouter' = 'google';
            if (url.includes('openrouter.ai')) type = 'openrouter';
            else if (url.includes('groq.com') || url.includes('/v1')) type = 'openai';

            const newProxy = {
              id: `proxy-${Date.now()}`,
              url: url,
              key: parsed.proxyKey || parsed.key || '',
              model: parsed.proxyModel || parsed.model || '',
              models: Array.isArray(parsed.proxyModels || parsed.models) ? (parsed.proxyModels || parsed.models) : [],
              isActive: true,
              type: type
            };

            setSettings({
                ...settings,
                proxies: [...settings.proxies, newProxy],
                activeProxyId: newProxy.id,
                geminiApiKey: Array.isArray(parsed.geminiApiKey) 
                    ? [...(settings.geminiApiKey || []), ...parsed.geminiApiKey] 
                    : (parsed.geminiApiKey ? [...(settings.geminiApiKey || []), parsed.geminiApiKey] : settings.geminiApiKey)
            });
            return;
        }
      } catch {
        // Not JSON, continue to TXT parsing
      }

      // TXT Parsing logic
      const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
      const newGeminiKeys: string[] = [...(settings?.geminiApiKey || [])];
      const newProxies: any[] = [];
      
      let currentProxy: any = null;
      const geminiKeyRegex = /^AIzaSy[A-Za-z0-9_-]{33}$/;

      lines.forEach(line => {
        // 1. Check for Gemini API Keys
        if (geminiKeyRegex.test(line)) {
          if (!newGeminiKeys.includes(line)) {
            newGeminiKeys.push(line);
          }
          return;
        }

        // 2. Check for common pipe-separated format: URL|KEY|NAME or URL|KEY
        if (line.includes('|') && line.startsWith('http')) {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length >= 2) {
            const url = parts[0];
            let type: 'google' | 'openai' | 'openrouter' = 'google';
            if (url.includes('openrouter.ai')) type = 'openrouter';
            else if (url.includes('groq.com') || url.includes('/v1')) type = 'openai';

            newProxies.push({
              id: crypto.randomUUID(),
              url: url,
              key: parts[1],
              model: '',
              models: [],
              isActive: true,
              type: type
            });
            return;
          }
        }

        // 3. Check for multi-line format (URL followed by Key/Name)
        if (line.startsWith('http')) {
          // If we were already building a proxy, push it
          if (currentProxy && currentProxy.url && currentProxy.key) {
            newProxies.push(currentProxy);
          }
          
          let type: 'google' | 'openai' | 'openrouter' | 'custom' = 'google';
          if (line.includes('openrouter.ai')) type = 'openrouter';
          else if (line.includes('groq.com') || line.includes('/v1')) type = 'openai';

          currentProxy = {
            id: crypto.randomUUID(),
            url: line,
            key: '',
            model: '',
            models: [],
            isActive: true,
            type: type
          };
        } else if (currentProxy) {
          if (line.toLowerCase().includes('proxy_key:') || line.toLowerCase().includes('key:')) {
            currentProxy.key = line.split(':')[1]?.trim() || currentProxy.key;
          } else if (line.length > 20 && !currentProxy.key) {
            // Heuristic: long string after URL is likely the key
            currentProxy.key = line;
          }
        }
      });

      // Push the last proxy if it exists
      if (currentProxy && currentProxy.url && currentProxy.key) {
        newProxies.push(currentProxy);
      }

      if (settings) {
        const updatedSettings = { 
          ...settings, 
          geminiApiKey: newGeminiKeys,
          proxies: [...settings.proxies, ...newProxies]
        };
        
        if (newProxies.length > 0) {
          updatedSettings.activeProxyId = newProxies[newProxies.length - 1].id;
        }

        setSettings(updatedSettings);
        dbService.saveSettings(updatedSettings);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!settings) return <div className="flex items-center justify-center h-full text-slate-400">Đang tải cấu hình...</div>;

  const defaultModels = [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro-preview",
    "gemini-2.5-flash-preview"
  ];
  const allAvailableModels = Array.from(new Set([
    ...defaultModels,
    ...(settings?.proxies?.flatMap(p => p.models || []) || [])
  ])).filter(Boolean);
  if (settings.aiModel && !allAvailableModels.includes(settings.aiModel)) allAvailableModels.push(settings.aiModel);
  if (settings.backgroundAiModel && !allAvailableModels.includes(settings.backgroundAiModel)) allAvailableModels.push(settings.backgroundAiModel);

  const tabs = [
    { id: 'general', label: 'Hệ thống AI', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'display', label: 'Giao diện', icon: <Monitor className="w-4 h-4" /> },
    { id: 'game', label: 'Trò chơi', icon: <Palette className="w-4 h-4" /> },
    { id: 'custom-theme', label: 'Theme Tùy Chỉnh', icon: <Paintbrush className="w-4 h-4" /> },
    { id: 'tts', label: 'TTS ElevenLabs', icon: <Mic className="w-4 h-4" /> },
    { id: 'advanced', label: 'Nâng cao', icon: <Shield className="w-4 h-4" /> },
    { id: 'api', label: 'Mạng & API', icon: <Globe className="w-4 h-4" /> }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 lg:p-10 overflow-hidden">
      {/* Background Layer mimicking the menu background */}
      {bgImage && (
        <>
          <div 
            className="absolute inset-0 z-0 transition-all duration-700"
            style={{ 
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `brightness(0.35) ${bgBlur ? 'blur(8px)' : 'blur(0px)'}`
            }}
          />
          <div className="absolute inset-0 z-0 bg-stone-100/20 dark:bg-black/45 backdrop-blur-[5px]" />
        </>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-row h-full w-full max-w-7xl bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-2xl md:rounded-[32px] shadow-[12px_12px_24px_#cbd2df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#030610,-12px_-12px_24px_#142042] overflow-hidden backdrop-blur-xl relative z-10"
      >
        {/* Sidebar Navigation */}
        <div className="w-56 md:w-64 lg:w-80 flex flex-col bg-[#e6ebf4] dark:bg-[#0b1329] border-r border-[#cbd2df]/20 dark:border-[#142042]/10 p-4 md:p-6 lg:p-8 shrink-0">
          <div className="flex items-center gap-3 mb-6 md:mb-10">
            <div className="w-10 h-10 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] border border-[#cbd2df]/10 dark:border-[#142042]/5 flex items-center justify-center text-mystic-accent">
              <Sliders className="w-5 h-5 pointer-events-none" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-wide font-sans">Cấu Hình</h2>
              <p className="text-xs md:text-[99px]-hidden text-mystic-accent/70 uppercase tracking-widest font-black leading-none mt-1">Ark V6 System</p>
            </div>
          </div>
 
          {/* Persistent Sidebar Tabs (PC Style) */}
          <div className="flex flex-col gap-3 relative">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 relative z-10 text-sm md:text-base cursor-pointer border border-transparent ${
                  activeTab === tab.id 
                    ? 'text-mystic-accent font-black shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] bg-[#cbd2df]/15 dark:bg-[#142042]/10' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:scale-[1.02] font-semibold'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTabBg" 
                    className="absolute inset-0 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] border border-[#cbd2df]/15 dark:border-[#142042]/5 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className={activeTab === tab.id ? 'text-mystic-accent animate-pulse' : ''}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
 
          <div className="mt-auto flex flex-col gap-4 pt-8">
            <button 
                onClick={handleResetFactory}
                className="w-full py-3 bg-[#e6ebf4] dark:bg-[#0b1329] text-red-500 hover:text-red-600 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/10 dark:border-[#142042]/5 hover:scale-105 transition-all font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2"
            >
                Khôi phục Mặc định
            </button>
            <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] hover:from-[#0284c7] hover:to-[#0369a1] text-white shadow-[0_4px_12px_rgba(14,165,233,0.3)] disabled:opacity-40 hover:scale-105 transition-all font-black text-xs uppercase tracking-widest rounded-xl cursor-pointer flex items-center justify-center gap-2"
            >
                {isSaving ? 'Đang lưu...' : (fromGame ? 'Quay Lại' : 'Đóng & Lưu')}
            </button>
          </div>
        </div>
 
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#e6ebf4] dark:bg-[#0b1329] relative">
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 lg:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl mx-auto space-y-8 pb-32 md:pb-12"
              >
                {/* 1. HỆ THỐNG AI */}
                {activeTab === 'general' && (
                  <div className="space-y-8">
                    <div className="space-y-2 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                          <Sparkles className="text-mystic-accent" /> Mô Hình Trí Tuệ Nhân Tạo
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Tùy chỉnh "bộ não" của hệ thống cho các xử lý nội tại.</p>
                      </div>
                      <button 
                          onClick={handleLoadModels}
                          disabled={isSaving || !settings.proxyEnabled || !settings.proxies?.length}
                          className="px-4 py-2 bg-[#e6ebf4] dark:bg-[#0b1329] text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] hover:scale-105 transition-all rounded-xl disabled:opacity-45 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
                      >
                          {isSaving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
                          Tải Model (Proxy)
                      </button>
                    </div>

                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 md:p-8 space-y-6">
                      {/* Hybrid Mode Toggle */}
                      <div className="flex items-start justify-between gap-4 pb-6 border-b border-[#cbd2df]/20 dark:border-[#142042]/10">
                        <div className="space-y-1">
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" /> Hệ thống Hybrid (Đa tác tử)
                          </label>
                          <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-8 font-medium">
                            Bật để cho phép sử dụng mô hình riêng biệt cho các tác vụ nền (như Tóm tắt, Trích xuất cốt truyện) giúp giảm chi phí và tăng tốc độ.
                          </p>
                        </div>
                        <button
                          onClick={() => handleChange('aiMode', settings.aiMode === 'hybrid' ? 'single' : 'hybrid')}
                          className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                        >
                          <motion.div 
                            layout
                            className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.aiMode === 'hybrid' ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                            animate={{ x: settings.aiMode === 'hybrid' ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-emerald-400" /> Mô hình Trực tiếp (Primary Agent)
                        </label>
                        <select 
                            value={settings.aiModel}
                            onChange={(e) => handleChange('aiModel', e.target.value)}
                            className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3.5 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                        >
                            {allAvailableModels.map(m => (
                                <option key={m} value={m} className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">{
                                  m === "gemini-3.5-flash" ? "Gemini 3.5 Flash (Thế hệ mới - Siêu nhanh)" :
                                  m === "gemini-3.1-pro-preview" ? "Gemini 3.1 Pro (Khuyên dùng - Logic cao)" :
                                  m === "gemini-3-flash-preview" ? "Gemini 3 Flash (Tốc độ cao)" : m
                                }</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">Xử lý viết truyện và phản hồi trực tiếp dựa trên hành động.</p>
                      </div>

                      {settings.aiMode === 'hybrid' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 pt-2"
                        >
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-sky-400" /> Mô hình Nền (Background Agent)
                          </label>
                          <select 
                              value={settings.backgroundAiModel || 'gemini-3-flash-preview'}
                              onChange={(e) => handleChange('backgroundAiModel', e.target.value)}
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3.5 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                          >
                              {allAvailableModels.map(m => (
                                  <option key={m} value={m} className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">{
                                    m === "gemini-3.5-flash" ? "Gemini 3.5 Flash (Thế hệ mới - Siêu nhanh)" :
                                    m === "gemini-3.1-pro-preview" ? "Gemini 3.1 Pro (Khuyên dùng - Logic cao)" :
                                    m === "gemini-3-flash-preview" ? "Gemini 3 Flash (Tốc độ cao)" : m
                                  }</option>
                              ))}
                          </select>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">Thực hiện tính toán ẩn, tự động tóm tắt, trích xuất cốt truyện (VD: gemini-3-flash-preview, gpt-4o-mini).</p>
                        </motion.div>
                      )}

                      <div className="space-y-3 pt-2">
                        <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Database className="w-4 h-4 text-indigo-400" /> Mô hình Vector (Embedding)
                        </label>
                        <select 
                            value={settings.embeddingModel || 'gemini-embedding-001'}
                            onChange={(e) => handleChange('embeddingModel', e.target.value)}
                            className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3.5 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                        >
                            <option value="gemini-embedding-001" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">gemini-embedding-001 (Mặc định)</option>
                            <option value="text-embedding-005" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">text-embedding-005</option>
                            <option value="gemini-embedding-2" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">gemini-embedding-2</option>
                            <option value="text-multilingual-embedding-002" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">text-multilingual-embedding-002</option>
                        </select>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">Dùng để mã hóa ký ức dài hạn của hệ thống.</p>
                      </div>

                      <div className="pt-6 border-t border-[#cbd2df]/20 dark:border-[#142042]/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <HardDrive className="w-4 h-4 text-mystic-accent" /> Bộ nhớ RAG (Retrieval-Augmented Generation)
                            </label>
                            <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-8 font-medium">
                              Tự động lưu trữ và truy xuất các sự kiện trong quá khứ để tránh AI bị quên cốt truyện dài hạn.
                            </p>
                          </div>
                          <button
                            onClick={() => handleChange('enableVectorMemory', !settings.enableVectorMemory)}
                            className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                          >
                            <motion.div 
                              layout
                              className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.enableVectorMemory ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                              animate={{ x: settings.enableVectorMemory ? 24 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      </div>

                      {settings.enableVectorMemory && (
                        <div className="pt-6 border-t border-[#cbd2df]/20 dark:border-[#142042]/10">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-[#10b981]" /> Tác vụ Embedding Cục bộ (Trình duyệt)
                              </label>
                              <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-8 font-medium">
                                Sử dụng bộ mã hóa NLP chạy hoàn toàn cục bộ trên thiết bị của bạn. Không chuyển nội dung lên đám mây làm tăng tốc độ phản hồi và bảo tuyệt mật, tiết kiệm 100% token.
                              </p>
                            </div>
                            <button
                              onClick={() => handleChange('useLocalEmbedding', !settings.useLocalEmbedding)}
                              className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                              id="toggle-local-rag"
                            >
                              <motion.div 
                                layout
                                className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.useLocalEmbedding ? 'bg-[#10b981]' : 'bg-slate-400 dark:bg-slate-600'}`}
                                animate={{ x: settings.useLocalEmbedding ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="pt-6 border-t border-[#cbd2df]/20 dark:border-[#142042]/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Globe className="w-4 h-4 text-mystic-accent" /> Google Search Grounding (Phối kiểm qua Web)
                            </label>
                            <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-8 font-medium">
                              Tìm kiếm và tra cứu thông tin thực tế từ Google Search thời gian thực để làm phong phú bối cảnh, nhân vật hoặc nội dung lịch sử.
                            </p>
                          </div>
                          <button
                            onClick={() => handleChange('enableSearchGrounding', !settings.enableSearchGrounding)}
                            className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                          >
                            <motion.div 
                              layout
                              className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.enableSearchGrounding ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                              animate={{ x: settings.enableSearchGrounding ? 24 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[#cbd2df]/20 dark:border-[#142042]/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Globe className="w-4 h-4 text-[#8b5cf6]" /> SOTA Web Search (Bộ Scraper Đa Nguồn Thác Đổ)
                            </label>
                            <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-8 font-medium">
                              Kích hoạt cơ chế tìm kiếm 2 lớp: Google Search Grounding kết hợp thác nguồn scraper song cực (DuckDuckGo, Wikipedia, Baidu Baike) thu thập tri thức thời gian thực chính xác tuyệt đối.
                            </p>
                          </div>
                          <button
                            onClick={() => handleChange('enableSotaSearch', !settings.enableSotaSearch)}
                            className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                          >
                            <motion.div 
                              layout
                              className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.enableSotaSearch ? 'bg-[#8b5cf6]' : 'bg-slate-400 dark:bg-slate-600'}`}
                              animate={{ x: settings.enableSotaSearch ? 24 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'display' && (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Monitor className="text-mystic-accent" /> Hiển Thị & Giao Diện
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Điều chỉnh trải nghiệm nhìn phù hợp với cá nhân.</p>
                    </div>

                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-3">
                        <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Phông chữ hệ thống</label>
                        <select 
                            value={settings.systemFont}
                            onChange={(e) => handleChange('systemFont', e.target.value)}
                            className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                        >
                            <option value="Inter" className="bg-[#cbd2df] dark:bg-[#0b1329]">Inter (Hiện đại)</option>
                            <option value="Playfair Display" className="bg-[#cbd2df] dark:bg-[#0b1329]">Playfair Display (Truyền thống)</option>
                            <option value="Lora" className="bg-[#cbd2df] dark:bg-[#0b1329]">Lora (Sách truyện)</option>
                            <option value="Noto Sans Vietnamese" className="bg-[#cbd2df] dark:bg-[#0b1329]">Noto Sans (Chuẩn Việt)</option>
                            <option value="JetBrains Mono" className="bg-[#cbd2df] dark:bg-[#0b1329]">JetBrains Mono (Code)</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Cỡ chữ (px)</label>
                        <input 
                            type="number"
                            value={localFontSize}
                            onChange={(e) => {
                                const val = e.target.value;
                                setLocalFontSize(val);
                                const num = parseInt(val);
                                if (!isNaN(num) && num >= 1 && num <= 40) {
                                    handleChange('fontSize', num);
                                }
                            }}
                            onBlur={() => {
                                if (!localFontSize || isNaN(parseInt(localFontSize))) {
                                    setLocalFontSize(settings.fontSize.toString());
                                }
                            }}
                            className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                            min="1" max="40"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Thu phóng Layout</label>
                          <span className="text-xs font-mono text-mystic-accent font-black">
                            {settings.layoutZoom !== undefined ? settings.layoutZoom : 100}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range"
                            min="50"
                            max="200"
                            step="5"
                            value={settings.layoutZoom !== undefined ? settings.layoutZoom : 100}
                            onChange={(e) => handleChange('layoutZoom', parseInt(e.target.value))}
                            className="flex-1 accent-mystic-accent h-1.5 bg-[#cbd2df] dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                          />
                          <button
                            onClick={() => handleChange('layoutZoom', 100)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#e6ebf4] dark:bg-[#0b1329] text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">Tự động phóng to hoặc thu nhỏ giao diện toàn bộ.</p>
                      </div>
                    </div>

                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                      {[
                        { id: 'theme', label: 'Chế độ Nền Sáng', desc: 'Sử dụng giao diện màu sáng thay vì tối.', state: settings.theme === 'light', toggle: () => handleChange('theme', settings.theme === 'light' ? 'dark' : 'light') },
                        { id: 'visualEffects', label: 'Hiệu ứng Hình Ảnh', desc: 'Bật các hiệu ứng particle, glow, và animations. Tắt để tối ưu hiệu suất.', state: settings.visualEffects, toggle: () => handleChange('visualEffects', !settings.visualEffects) },
                        { id: 'contentBeautify', label: 'Làm Đẹp Nội Dung', desc: 'Tự động định dạng văn bản, thêm icon và box cho hệ thống hiển thị.', state: settings.contentBeautify, toggle: () => handleChange('contentBeautify', !settings.contentBeautify) },
                        { id: 'fullScreenMode', label: 'Toàn Màn Hình', desc: 'Ẩn thanh trạng thái hệ điều hành (Chỉ tác dụng trên một số thiết bị).', state: settings.fullScreenMode, toggle: () => {
                            handleChange('fullScreenMode', !settings.fullScreenMode);
                            if (!settings.fullScreenMode) document.documentElement.requestFullscreen().catch(() => {});
                            else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                        }},
                      ].map((item, idx) => (
                        <div key={item.id} className={`flex items-start justify-between gap-4 ${idx > 0 ? 'pt-6 border-t border-[#cbd2df]/20 dark:border-[#142042]/10' : ''}`}>
                          <div className="space-y-1">
                            <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">{item.label}</label>
                            <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-8 font-medium">{item.desc}</p>
                          </div>
                          <button
                            onClick={item.toggle}
                            className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 cursor-pointer"
                          >
                            <motion.div 
                              layout
                              className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${item.state ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                              animate={{ x: item.state ? 24 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#cbd2df]/20 dark:border-[#142042]/10">
                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Giao Diện Truyện</h4>
                          <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">Tùy chỉnh màu sắc cho các thành phần đặc biệt trong đoạn truyện.</p>
                        </div>
                        <button 
                            onClick={() => handleMultipleChanges({
                                storyDialogueColor: '#F97316',
                                storyThinkingColor: '#A855F7',
                                storyHighlightColor: '#FACC15',
                                storyOnomatopoeiaColor: '#EF4444'
                            })}
                            className="px-3 py-2 rounded-lg bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-amber-500 border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all text-xs font-bold font-sans flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Khôi <span className="hidden sm:inline">Phục Mặc Định</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Màu Hội Thoại 「...」</label>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">{settings.storyDialogueColor || '#F97316'}</span>
                          </div>
                          <div className="flex gap-3">
                            <input 
                              type="color" 
                              value={settings.storyDialogueColor || '#F97316'}
                              onChange={(e) => handleChange('storyDialogueColor', e.target.value)}
                              className="w-10 h-10 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 bg-transparent p-0.5 cursor-pointer shrink-0 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                            />
                            <div className="flex-1 bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                              Nhân vật nói: <span className="font-extrabold" style={{color: settings.storyDialogueColor || '#F97316'}}>「Xin chào người lữ hành!」</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Màu Suy Nghĩ ﹁...﹂</label>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">{settings.storyThinkingColor || '#A855F7'}</span>
                          </div>
                          <div className="flex gap-3">
                            <input 
                              type="color" 
                              value={settings.storyThinkingColor || '#A855F7'}
                              onChange={(e) => handleChange('storyThinkingColor', e.target.value)}
                              className="w-10 h-10 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 bg-transparent p-0.5 cursor-pointer shrink-0 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                            />
                            <div className="flex-1 bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                              Nhân vật nghĩ thầm: <span className="font-extrabold" style={{color: settings.storyThinkingColor || '#A855F7'}}>﹁Có lẽ mình nên cẩn thận hơn.﹂</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Màu Điểm Nhấn 『...』</label>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">{settings.storyHighlightColor || '#FACC15'}</span>
                          </div>
                          <div className="flex gap-3">
                            <input 
                              type="color" 
                              value={settings.storyHighlightColor || '#FACC15'}
                              onChange={(e) => handleChange('storyHighlightColor', e.target.value)}
                              className="w-10 h-10 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 bg-transparent p-0.5 cursor-pointer shrink-0 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                            />
                            <div className="flex-1 bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                              Bạn nhận được <span className="font-extrabold" style={{color: settings.storyHighlightColor || '#FACC15'}}>『Thánh Kiếm』</span>!
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Màu Từ Tượng Thanh {"{...}"}</label>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">{settings.storyOnomatopoeiaColor || '#EF4444'}</span>
                          </div>
                          <div className="flex gap-3">
                            <input 
                              type="color" 
                              value={settings.storyOnomatopoeiaColor || '#EF4444'}
                              onChange={(e) => handleChange('storyOnomatopoeiaColor', e.target.value)}
                              className="w-10 h-10 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 bg-transparent p-0.5 cursor-pointer shrink-0 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                            />
                            <div className="flex-1 bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                              Một tiếng nổ vang lên <span className="font-extrabold" style={{color: settings.storyOnomatopoeiaColor || '#EF4444'}}>{"{BÙM!}"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. TRÒ CHƠI */}
                {activeTab === 'game' && (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Palette className="text-mystic-accent" /> Thông Số Trò Chơi
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Các quy tắc tương tác với môi trường mô phỏng.</p>
                    </div>

                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 md:p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Góc nhìn kể chuyện (POV)</label>
                          <select 
                              value={settings.perspective}
                              onChange={(e) => handleChange('perspective', e.target.value as NarrativePerspective)}
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                          >
                              <option value="third" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Ngôi thứ 3 (Anh ấy/Cô ấy)</option>
                              <option value="first" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Ngôi thứ 1 (Tôi)</option>
                              <option value="second" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Ngôi thứ 2 (Bạn/Ngươi)</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Độ Khó Cốt Truyện</label>
                          <select 
                              value={settings.difficulty.id}
                              onChange={(e) => {
                                  const diff = DIFFICULTY_LEVELS.find(d => d.id === e.target.value);
                                  if (diff) handleChange('difficulty', diff);
                              }}
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                          >
                              {DIFFICULTY_LEVELS.map(d => (
                                  <option key={d.id} value={d.id} className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">{d.label}</option>
                              ))}
                          </select>
                        </div>
                        
                        <div className="space-y-3">
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Độ Khó Thực Tại</label>
                          <select 
                              value={settings.realityDifficulty}
                              onChange={(e) => handleChange('realityDifficulty', e.target.value)}
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                          >
                              <option value="Easy" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Dễ</option>
                              <option value="Normal" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Bình thường</option>
                              <option value="Hard" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Khó</option>
                              <option value="Nightmare" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Ác mộng</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300">Độ dài phản hồi</label>
                          <select 
                              value={settings.outputLength.id}
                              onChange={(e) => {
                                  const len = OUTPUT_LENGTHS.find(o => o.id === e.target.value);
                                  if (len) handleChange('outputLength', len);
                              }}
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                          >
                              {OUTPUT_LENGTHS.map(o => (
                                  <option key={o.id} value={o.id} className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">{o.label}</option>
                              ))}
                          </select>
                        </div>

                        <div className="md:col-span-2 border-t border-[#cbd2df]/30 dark:border-[#142042]/30 pt-6 mt-4 flex items-center justify-between">
                          <div className="space-y-1 pr-6">
                            <span className="text-sm font-extrabold text-slate-805 dark:text-slate-200 flex items-center gap-2">
                              <Activity size={16} className="text-teal-505 animate-pulse shrink-0" />
                              Chế Độn tự Sửa Lỗi & Kiểm Duyệt DEEP-LOGIC (Phục Vụ Đồng Nhân Chuyên Sâu)
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              Kích hoạt kiểm duyệt logic tối cao: AI tự phân tích các vi phạm luật thế giới và trừng phạt khốc liệt (phản phệ kinh mạch, kỹ năng bạo liệt, thất bại thảm thê kịch tính) khi phát hiện người chơi buff bẩn hoặc cheat sức mạnh.
                            </p>
                          </div>
                          <div className="relative inline-flex items-center cursor-pointer select-none shrink-0 scale-110">
                            <input 
                              type="checkbox" 
                              checked={!!settings.enableDeepLogic} 
                              onChange={(e) => handleChange('enableDeepLogic', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-350 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500" />
                          </div>
                        </div>

                        {settings.enableDeepLogic && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }} 
                            className="md:col-span-2 grid grid-cols-1 gap-3 mt-3 p-4 bg-[#f0f3f9] dark:bg-[#030610] border border-[#cbd2df]/20 dark:border-[#142042]/10 rounded-2xl"
                          >
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                                Chế độ hoạt động DEEP-LOGIC
                              </label>
                              <select 
                                  value={settings.deepLogicMode || 'strict'} 
                                  onChange={(e: any) => handleChange('deepLogicMode', e.target.value)}
                                  className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                              >
                                <option value="one-pass" className="text-slate-800 dark:text-slate-200">
                                  Một lượt (One-Pass) - TIẾT KIỆM QUOTA (Khuyến dùng)
                                </option>
                                <option value="advisory" className="text-slate-800 dark:text-slate-200">
                                  Hai lượt (Two-Pass) - Chỉ nhắc nhở Advisory (Không tự sửa văn bản)
                                </option>
                                <option value="strict" className="text-slate-800 dark:text-slate-200">
                                  Hai lượt (Two-Pass) - Tự sửa văn bản Strict (Tốn quota nhất)
                                </option>
                              </select>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium leading-relaxed">
                                • <strong>Một lượt (One-Pass)</strong>: Ràng buộc luật được tích hợp trực tiếp lúc AI tạo câu chuyện ban đầu. <strong>Không phát sinh cuộc gọi API thứ hai</strong>, tiết kiệm 100% chi phí kiểm duyệt thêm.<br/>
                                • <strong>Chỉ nhắc nhở (Advisory)</strong>: Dùng cuộc gọi API thứ 2 cực nhẹ để kiểm logic và trả về cảnh báo vi phạm trên HUD nhưng không viết lại văn bản, giảm 95% output token cho cuộc gọi thứ hai.<br/>
                                • <strong>Tự sửa (Strict)</strong>: Dùng cuộc gọi API thứ 2 để viết lại và chèn hình phạt phản phệ hoành tráng nếu phát hiện cheat.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {settings.outputLength.id === 'custom' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }} 
                          className="grid grid-cols-2 gap-4 pt-4 border-t border-[#cbd2df]/20 dark:border-[#142042]/10"
                        >
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">Tối thiểu (Min words)</label>
                                <input 
                                    type="number"
                                    value={isNaN(settings.customMinWords) ? '' : settings.customMinWords}
                                    onChange={(e) => handleChange('customMinWords', parseInt(e.target.value))}
                                    className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">Tối đa (Max words)</label>
                                <input 
                                    type="number"
                                    value={isNaN(settings.customMaxWords) ? '' : settings.customMaxWords}
                                    onChange={(e) => handleChange('customMaxWords', parseInt(e.target.value))}
                                    className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium transition-all"
                                />
                            </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. NÂNG CAO & AN TOÀN */}
                {activeTab === 'advanced' && (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Shield className="text-mystic-accent animate-pulse" /> An Toàn & Lọc Nội Dung
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Kiểm soát các giới hạn AI và mã kịch bản thực thi.</p>
                    </div>

                    <SafetySettings settings={settings} onUpdate={handleGlobalUpdate} />

                    <div className="mt-8 space-y-2">
                      <h3 className="text-lg font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        Advanced Rendering
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tính năng nâng cao. Có thể thực thi mã Javascript từ game.</p>
                    </div>
                    
                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-6 border border-amber-500/20 rounded-3xl shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042]">
                      <div className="space-y-3">
                          <label className="block text-sm font-extrabold text-amber-600 dark:text-amber-300">Chế Độ Hỗ Trợ JavaScript</label>
                          <select 
                              value={settings.javaScriptMode}
                              onChange={(e) => handleChange('javaScriptMode', e.target.value as any)}
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-amber-500/40 rounded-2xl p-3.5 text-sm text-amber-700 dark:text-amber-400 focus:border-amber-500 outline-none font-bold shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                          >
                              <option value="disabled" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Disabled - Vô hiệu hóa (Khuyên dùng)</option>
                              <option value="auto" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Auto - Tự động phát hiện</option>
                              <option value="script" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Script Mode - Chạy thẻ &lt;script&gt;</option>
                              <option value="code_block" className="bg-[#cbd2df] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">Code Block Mode - Chạy code từ markdown</option>
                          </select>
                      </div>
                    </div>

                    <div className="mt-8 space-y-2">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            Global Regex Scripts
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            Các đoạn script xử lý biểu thức chính quy (Regex) được áp dụng trên toàn bộ ứng dụng (áp dụng cho mọi nhân vật).
                        </p>
                    </div>

                    <div className="border border-[#cbd2df]/10 dark:border-[#142042]/5 rounded-3xl p-1 overflow-hidden bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] pt-4 pb-4">
                        <RegexScriptsManager 
                            presetName="Global Configuration"
                            scripts={settings.regex_scripts || []} 
                            onChange={(scripts) => handleChange('regex_scripts', scripts)} 
                            playerName="Người chơi"
                            charName="Nhân vật"
                        />
                    </div>
                  </div>
                )}
                {activeTab === 'api' && (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Globe className="text-mystic-accent" /> Cấu Hình Mạng & API
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Cấu hình kết nối đến các nhà cung cấp AI ngoài hệ thống.</p>
                    </div>

                    {/* Gemini Key Config */}
                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl overflow-hidden">
                      <div className="p-5 bg-[#e6ebf4]/50 dark:bg-[#010514]/40 border-b border-[#cbd2df]/20 dark:border-[#142042]/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-lg shadow-sm">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-200">Google Gemini API Keys</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sử dụng cho hệ thống lõi</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleChange('useGeminiApi', !settings.useGeminiApi)}
                            className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/25 dark:border-[#142042]/10 cursor-pointer"
                          >
                            <motion.div 
                              layout
                              className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.useGeminiApi ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                              animate={{ x: settings.useGeminiApi ? 24 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      </div>

                      <div className={`p-6 space-y-6 transition-opacity duration-300 ${!settings.useGeminiApi ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                        <div className="flex flex-wrap gap-3">
                            <button 
                                onClick={async () => {
                                    try {
                                        await window.aistudio.openSelectKey();
                                    } catch (e) {
                                        console.error("Lỗi khi mở hộp thoại:", e);
                                    }
                                }}
                                className="px-3.5 py-2 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                            >
                                <Sparkles size={14} /> Tích hợp Cloud Key
                            </button>
                            <label className="px-3.5 py-2 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]">
                                Nhập từ File (.txt/.json)
                                <input type="file" accept=".txt,.json" className="hidden" onChange={handleImportTxt} />
                            </label>
                            <button 
                                onClick={handleResetApiTab}
                                className="px-3.5 py-2 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all cursor-pointer hover:scale-[1.02]"
                            >
                                Reset Cấu Hình API
                            </button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-extrabold text-slate-700 dark:text-slate-300">Thêm API Key Thủ Công</label>
                            <button 
                                onClick={handleAddManualKeys}
                                className="px-3.5 py-2 rounded-xl bg-mystic-accent text-white text-xs font-bold shadow-[2px_2px_5px_rgba(56,189,248,0.25)] hover:bg-mystic-accent/90 focus:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
                                disabled={!manualKeyText.trim()}
                            >
                                <Plus size={14} className="stroke-[2.5px]" /> Thêm Key
                            </button>
                          </div>
                          <textarea 
                              placeholder="AIzaSy... (Mỗi dòng 1 key, nhập xong nhấn nút Thêm Key hoặc nhấn Ctrl+Enter)"
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2.5px_2.5px_5px_#cbd2df,inset_-2.5px_-2.5px_5px_#ffffff] dark:shadow-[inset_2.5px_2.5px_5px_#030610,inset_-2.5px_-2.5px_5px_#142042] rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-mono min-h-[100px] font-medium"
                              value={manualKeyText}
                              onChange={(e) => setManualKeyText(e.target.value)}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.ctrlKey) {
                                      e.preventDefault();
                                      handleAddManualKeys();
                                  }
                              }}
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-extrabold text-slate-700 dark:text-slate-300">Danh Sách Tiêm (Luân Phiên)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                              {settings.geminiApiKey && settings.geminiApiKey.length > 0 ? (
                                  settings.geminiApiKey.map((key, index) => (
                                      <div key={index} className="flex items-center justify-between bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-2xl p-3.5 group">
                                          <div className="flex items-center gap-3 overflow-hidden">
                                              <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-[#e6ebf4] dark:bg-[#010514] text-mystic-accent text-[10px] font-black rounded-lg border border-[#cbd2df]/40 dark:border-[#142042]/10 shadow-[1px_1px_2px_#cbd2df,-1px_-1px_2px_#ffffff] dark:shadow-[1px_1px_2px_#030610,-1px_-1px_2px_#142042]">
                                                  {index + 1}
                                              </span>
                                              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 font-bold truncate">
                                                  {key.substring(0, 8)}...{key.substring(key.length - 4)}
                                              </span>
                                          </div>
                                          <button 
                                              onClick={() => {
                                                  const updated = settings.geminiApiKey?.filter((_, i) => i !== index);
                                                  handleChange('geminiApiKey', updated || []);
                                              }}
                                              className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                          >
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  ))
                              ) : (
                                  <div className="col-span-full text-xs text-slate-500 dark:text-slate-400 italic p-6 text-center border border-dashed border-[#cbd2df] dark:border-slate-800 rounded-2xl font-medium">
                                      Chưa có API Key nào được nạp.
                                  </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reverse Proxy Config */}
                    <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl overflow-hidden">
                      <div className="p-5 bg-[#e6ebf4]/50 dark:bg-[#010514]/40 border-b border-[#cbd2df]/20 dark:border-[#142042]/10 flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-lg shadow-sm">
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-200">Reverse Proxy & External API</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dành cho OpenRouter, OpenAI...</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2">
                              <Button 
                                  variant="ghost"
                                  className="text-[10px] h-8 px-3 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] text-slate-600 dark:text-slate-400 bg-transparent disabled:opacity-40"
                                  onClick={addProxy}
                                  disabled={!settings.proxyEnabled}
                              >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Thêm Node
                              </Button>
                              <Button 
                                  variant="ghost"
                                  className="text-[10px] h-8 px-3 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] text-slate-600 dark:text-slate-400 bg-transparent disabled:opacity-40"
                                  onClick={handleLoadModels}
                                  disabled={isSaving || !settings.proxyEnabled || !settings.proxies?.length}
                              >
                                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Globe className="w-3.5 h-3.5 mr-1" />}
                                  Fetch
                              </Button>
                          </div>
                          <button
                            onClick={() => handleChange('proxyEnabled', !settings.proxyEnabled)}
                            className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/25 dark:border-[#142042]/10 cursor-pointer"
                          >
                            <motion.div 
                              layout
                              className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.proxyEnabled ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                              animate={{ x: settings.proxyEnabled ? 24 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      </div>

                      <div className={`p-6 space-y-6 transition-opacity duration-300 ${!settings.proxyEnabled ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                        {/* Bể Proxy Config Card */}
                        <div className="bg-[#cbd2df]/10 dark:bg-[#030610]/40 p-5 rounded-3xl border border-[#cbd2df]/20 dark:border-[#142042]/10 shadow-[3px_3px_8px_#cbd2df,-3px_-3px_8px_#ffffff] dark:shadow-[3px_3px_8px_#030610,-3px_-3px_8px_#142042] space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-mystic-accent/10 text-mystic-accent rounded-2xl">
                                <Activity className="w-5 h-5 animate-pulse" />
                              </div>
                              <div>
                                <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Kích Hoạt Chế Độ Bể Proxy (Proxy Pool Core)</h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-md">
                                  Tự động xoay tua gọi các Node, chia tải yêu cầu, và tự khôi phục chuyển tải (Failover) thông minh khi một node bị ngắt kết nối hoặc gặp lỗi.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleChange('useProxyPool', !settings.useProxyPool)}
                              className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/25 dark:border-[#142042]/10 cursor-pointer"
                            >
                              <motion.div 
                                layout
                                className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${settings.useProxyPool ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                                animate={{ x: settings.useProxyPool ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>

                          {settings.useProxyPool && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }} 
                              animate={{ opacity: 1, y: 0 }}
                              className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#cbd2df]/20 dark:border-[#142042]/10"
                            >
                              <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-300">Chiến thuật Luân chuyển (Load Balancing)</label>
                                <select
                                  value={settings.proxyPoolStrategy || 'round_robin'}
                                  onChange={(e) => handleChange('proxyPoolStrategy', e.target.value as any)}
                                  className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none font-bold"
                                >
                                  <option value="round_robin">Xoay vòng tuần tự (Round Robin)</option>
                                  <option value="random">Luân chuyển ngẫu nhiên (Random Access)</option>
                                  <option value="failover">Ưu tiên theo thứ tự Node (Priority Failover)</option>
                                </select>
                              </div>
                              <div className="flex flex-col justify-end">
                                <div className="p-3 bg-[#cbd2df]/20 dark:bg-slate-950/20 rounded-xl border border-[#cbd2df]/10 dark:border-[#142042]/10">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-450">
                                    <span>Tổng số Node hoạt động:</span>
                                    <span className="text-emerald-500 font-extrabold">{settings.proxies.filter(p => p.isActive !== false && p.url && p.key).length} / {settings.proxies.length} Node active</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {settings.proxies && settings.proxies.length > 0 ? (
                            settings.proxies.map((proxy, index) => (
                                <div key={proxy.id ? `${proxy.id}-${index}` : index} className={`p-5 rounded-3xl border transition-all ${settings.activeProxyId === proxy.id ? 'bg-[#cbd2df]/20 dark:bg-slate-950/20 border-mystic-accent shadow-[3px_3px_8px_#cbd2df,-3px_-3px_8px_#ffffff] dark:shadow-[3px_3px_8px_#030610,-3px_-3px_8px_#142042]' : 'bg-transparent border-[#cbd2df]/30 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042]'}`}>
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => handleChange('activeProxyId', proxy.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border border-[#cbd2df]/30 dark:border-[#142042]/10 ${settings.activeProxyId === proxy.id ? 'bg-mystic-accent text-slate-950 shadow-md border-mystic-accent' : 'bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                            >
                                                {settings.activeProxyId === proxy.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                                                {settings.activeProxyId === proxy.id ? 'HOẠT ĐỘNG' : 'CHỌN DÙNG'}
                                            </button>
                                            <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">NODE {index + 1}</h4>
                                        </div>
                                        <div className="flex items-center gap-1 bg-[#cbd2df]/25 dark:bg-[#030610]/50 p-1.5 rounded-xl">
                                            <button onClick={() => moveProxy(index, 'up')} disabled={index === 0} className="p-1 px-1.5 text-slate-500 hover:text-mystic-accent rounded-lg disabled:opacity-30 cursor-pointer"><ChevronUp className="w-4 h-4" /></button>
                                            <button onClick={() => moveProxy(index, 'down')} disabled={index === settings.proxies!.length - 1} className="p-1 px-1.5 text-slate-500 hover:text-mystic-accent rounded-lg disabled:opacity-30 cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
                                            <button onClick={() => removeProxy(proxy.id)} className="p-1 px-1.5 text-slate-500 hover:text-red-500 rounded-lg ml-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                        <div className="lg:col-span-12 space-y-2">
                                            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                URL Endpoint
                                                <select 
                                                    value={proxy.type}
                                                    onChange={(e) => updateProxy(proxy.id, { type: e.target.value as any })}
                                                    className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/30 dark:border-[#142042]/10 rounded-lg px-2.5 py-1 text-[10px] text-slate-700 dark:text-slate-300 outline-none font-bold"
                                                >
                                                    <option value="google">Google</option>
                                                    <option value="openai">OpenAI</option>
                                                    <option value="openrouter">OpenRouter</option>
                                                </select>
                                            </label>
                                            <input 
                                                type="text" 
                                                placeholder="https://..."
                                                value={proxy.url}
                                                onChange={(e) => updateProxy(proxy.id, { url: e.target.value })}
                                                className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-mono"
                                            />
                                        </div>
                                        
                                        <div className="lg:col-span-6 space-y-2">
                                            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Bearer / API Key</label>
                                            <input 
                                                type="password" 
                                                placeholder="sk-..."
                                                value={proxy.key}
                                                onChange={(e) => updateProxy(proxy.id, { key: e.target.value })}
                                                className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-mono"
                                            />
                                        </div>

                                        <div className="lg:col-span-6 space-y-2">
                                            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                Target Model
                                                <span className="text-[10px] bg-[#cbd2df]/30 dark:bg-slate-950/25 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 font-extrabold">{proxy.models?.length || 0} loaded</span>
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    placeholder="Chỉ định model (VD: gpt-4)"
                                                    value={proxy.model}
                                                    onChange={(e) => updateProxy(proxy.id, { model: e.target.value })}
                                                    className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-mono pr-12"
                                                />
                                                <select 
                                                    value=""
                                                    onChange={(e) => {
                                                      if(e.target.value) updateProxy(proxy.id, { model: e.target.value });
                                                    }}
                                                    className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                                                >
                                                    <option value="">Lựa chọn đã fetch...</option>
                                                    {proxy.models?.map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats for Proxy Pool */}
                                    {(proxy.lastUsed || proxy.failCount !== undefined || proxy.latency !== undefined) && (
                                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#cbd2df]/20 dark:border-[#142042]/10 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            <div className="flex flex-col">
                                                <span>Lần gọi cuối:</span>
                                                <span className="text-slate-700 dark:text-slate-350 font-black">
                                                    {proxy.lastUsed ? new Date(proxy.lastUsed).toLocaleTimeString() : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span>Độ trễ (Latency):</span>
                                                <span className="text-emerald-500 font-black">
                                                    {proxy.latency !== undefined ? `${proxy.latency}ms` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span>Số lỗi (Errors):</span>
                                                <span className={proxy.failCount ? 'text-red-500 font-black' : 'text-slate-550 dark:text-slate-400 font-black'}>
                                                    {proxy.failCount || 0}
                                                </span>
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span>Trạng thái nạp:</span>
                                                <span className={proxy.isActive !== false ? 'text-emerald-500' : 'text-slate-400'}>
                                                    {proxy.isActive !== false ? 'Hoạt động' : 'Tạm dừng'}
                                                </span>
                                            </div>
                                            {proxy.lastError && (
                                                <div className="col-span-full bg-red-500/5 border border-red-500/10 p-2 rounded-xl text-red-500/90 font-mono text-[9px] break-words mt-2">
                                                    Error: {proxy.lastError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 bg-transparent border border-dashed border-[#cbd2df] dark:border-slate-800 rounded-3xl">
                                <Server className="w-16 h-16 text-slate-400 dark:text-slate-650 mx-auto mb-4 opacity-50" />
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-4">Hệ thống mạng mở rộng đang trống.</p>
                                <Button 
                                    variant="primary"
                                    onClick={addProxy}
                                    className="px-4 py-2 text-xs font-bold bg-[#e6ebf4] dark:bg-[#0b1329] text-emerald-600 dark:text-emerald-400 border border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] active:shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:active:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" /> Khởi tạo Node Mới
                                </Button>
                            </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'tts' && settings && (
                  <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 pb-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Mic className="text-mystic-accent" /> Cài đặt Giọng đọc (Audio & TTS)
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Khi kích hoạt, nội dung đối thoại và chính văn từ mô hình AI sẽ được phát ra tiếng nói. Bạn có thể chọn Trình duyệt (Web Speech API - Miễn phí) hoặc ElevenLabs (Cloud API - Chân thực).
                      </p>
                    </div>

                    {/* ==================== ENGINE 1: NATIVE BROWSER TTS ==================== */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-[#cbd2df]/30 dark:border-[#142042]/20 pb-2">
                        <Monitor className="text-mystic-accent w-5 h-5" />
                        <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                          Bộ Đọc Tích Hợp Trình Duyệt (Mặc định - Hoàn toàn Miễn phí)
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Toggle Enable Browser TTS */}
                        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 flex items-center justify-between">
                          <div className="space-y-1 pr-4">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                              Bật Giọng Đọc Trình Duyệt
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Đọc chính văn bằng bộ máy tổng hợp giọng nói Web Speech API tích hợp sẵn.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              handleChange('browserTtsEnabled', !settings.browserTtsEnabled);
                              if (!settings.browserTtsEnabled) {
                                handleChange('elevenLabsEnabled', false); // Turn off ElevenLabs to avoid overlay speech
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                              settings.browserTtsEnabled ? 'bg-mystic-accent' : 'bg-slate-300 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings.browserTtsEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Toggle Browser AutoPlay */}
                        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 flex items-center justify-between">
                          <div className="space-y-1 pr-4">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                              Tự Động Đọc Trình Duyệt (Auto Play)
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Tự động phát âm thanh ngay khi mô hình AI phản hồi cốt truyện mới.
                            </p>
                          </div>
                          <button
                            onClick={() => handleChange('browserTtsAutoPlay', !settings.browserTtsAutoPlay)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                              settings.browserTtsAutoPlay ? 'bg-mystic-accent' : 'bg-slate-300 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings.browserTtsAutoPlay ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Browser TTS Configuration Panel */}
                      <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Voice list */}
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                              <span>Giọng Đọc Trình Duyệt Thiết Lập</span>
                              <span className="text-mystic-accent font-mono text-[10px] font-semibold">Tải được: {browserVoices.length} giọng</span>
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={settings.browserTtsVoice || ''}
                                onChange={(e) => handleChange('browserTtsVoice', e.target.value)}
                                className="flex-1 text-xs px-3 py-2 bg-[#e0e6f0] dark:bg-[#080d1c] border border-slate-300/30 dark:border-slate-800/20 rounded-xl focus:outline-none focus:border-mystic-accent text-slate-800 dark:text-slate-100 font-semibold cursor-pointer shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042]"
                              >
                                <option value="">-- Tự động khớp tốt nhất (Ưu tiên Tiếng Việt/Mặc định hệ thống) --</option>
                                {browserVoices.map((voice) => (
                                  <option key={voice.voiceURI} value={voice.voiceURI}>
                                    {voice.name} ({voice.lang}) {voice.localService ? '[Offline]' : ''}
                                  </option>
                                ))}
                              </select>

                              {/* Refresh/Load Button */}
                              <Button
                                onClick={() => {
                                  if (typeof window !== "undefined" && window.speechSynthesis) {
                                    const list = window.speechSynthesis.getVoices().map(v => ({
                                      voiceURI: v.voiceURI,
                                      name: v.name,
                                      lang: v.lang,
                                      localService: v.localService,
                                      default: v.default
                                    }));
                                    setBrowserVoices(list);
                                  }
                                }}
                                className="px-3 py-2 font-black text-xs bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df] dark:active:shadow-[inset_2px_2px_4px_#030610] cursor-pointer flex items-center gap-1 text-slate-800 dark:text-slate-300 hover:text-mystic-accent transition-colors"
                                title="Tải lại danh sách giọng từ hệ điều hành / trình duyệt"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-mystic-accent" />
                                Tải Giọng
                              </Button>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              Hệ thống tự động nhận diện các gói ngôn ngữ được cài sẵn trên thiết bị của bạn. Nhập nút **Tải Giọng** để cập nhật nhanh danh sách nếu chưa tải đủ.
                            </p>
                          </div>

                          {/* Speed & Pitch Controls */}
                          <div className="space-y-4">
                            {/* Speed Rate */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                                <span>Tốc độ đọc (Speech Rate)</span>
                                <span className="text-mystic-accent font-mono">{settings.browserTtsRate ?? 1.0}x</span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={settings.browserTtsRate ?? 1.0}
                                onChange={(e) => handleChange('browserTtsRate', parseFloat(e.target.value))}
                                className="w-full accent-mystic-accent cursor-pointer"
                              />
                            </div>

                            {/* Pitch Control */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                                <span>Cao độ (Speech Pitch)</span>
                                <span className="text-mystic-accent font-mono">{settings.browserTtsPitch ?? 1.0}x</span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="1.5"
                                step="0.1"
                                value={settings.browserTtsPitch ?? 1.0}
                                onChange={(e) => handleChange('browserTtsPitch', parseFloat(e.target.value))}
                                className="w-full accent-mystic-accent cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Testing Lounge for Browser native speech */}
                        <div className="border-t border-[#cbd2df]/20 dark:border-[#142042]/10 pt-4 space-y-3">
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                            Thử giọng bộ máy Trình duyệt (Browser Tester)
                          </label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              type="text"
                              value={browserTestPhrase}
                              onChange={(e) => setBrowserTestPhrase(e.target.value)}
                              placeholder="Nhập nội dung thử giọng chính văn..."
                              className="flex-1 text-xs px-4 py-3 bg-[#e0e6f0] dark:bg-[#080d1c] border border-slate-300/30 dark:border-slate-800/20 rounded-xl focus:outline-none font-medium text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]"
                            />
                            <Button
                              onClick={handleTestPlayBrowserTts}
                              className={`px-5 py-3 font-black text-xs border border-mystic-accent/15 cursor-pointer flex items-center justify-center gap-1.5 transition-all text-white rounded-xl shadow-[3px_3px_6px_rgba(56,189,248,0.15)] dark:shadow-[3px_3px_6px_rgba(3,6,16,0.3)] ${
                                isTestingBrowserTts ? 'bg-red-500 hover:bg-red-600' : 'bg-mystic-accent hover:bg-mystic-accent/95'
                              }`}
                            >
                              {isTestingBrowserTts ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-white animate-ping mr-0.5"></span>
                                  Dừng phát
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-4 h-4" />
                                  Đọc thử giọng
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>


                    {/* ==================== ENGINE 2: PREMIUM ELEVENLABS ==================== */}
                    <div className="space-y-6 pt-4">
                      <div className="flex items-center gap-2 border-b border-[#cbd2df]/30 dark:border-[#142042]/20 pb-2">
                        <Sparkles className="text-mystic-accent w-5 h-5 animate-pulse" />
                        <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                          Bộ Đọc Đám Mây ElevenLabs (Cao cấp - Đòi hỏi mạng Internet & API Key)
                        </h4>
                      </div>

                      {/* Enable & Autoplay Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Toggle Enable */}
                        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 flex items-center justify-between">
                          <div className="space-y-1 pr-4">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                              Kích hoạt ElevenLabs TTS
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Sử dụng giọng nói chân thực từ mây đám với công nghệ AI ElevenLabs.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              handleChange('elevenLabsEnabled', !settings.elevenLabsEnabled);
                              if (!settings.elevenLabsEnabled) {
                                handleChange('browserTtsEnabled', false); // Turn off browser to avoid overlapping
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                              settings.elevenLabsEnabled ? 'bg-mystic-accent' : 'bg-slate-300 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings.elevenLabsEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Toggle AutoPlay */}
                        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 flex items-center justify-between">
                          <div className="space-y-1 pr-4">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                              Tự động Đọc (ElevenLabs Auto Play)
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Tự động phát giọng đọc ElevenLabs ngay sau khi nhận phản hồi từ AI.
                            </p>
                          </div>
                          <button
                            onClick={() => handleChange('elevenLabsAutoPlay', !settings.elevenLabsAutoPlay)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                              settings.elevenLabsAutoPlay ? 'bg-mystic-accent' : 'bg-slate-300 dark:bg-slate-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings.elevenLabsAutoPlay ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* ElevenLabs Detailed Config Panel */}
                      <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Cấu hình API & Tài khoản ElevenLabs</h4>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              ElevenLabs API Key
                            </label>
                            <input
                              type="password"
                              value={settings.elevenLabsApiKey || ''}
                              onChange={(e) => handleChange('elevenLabsApiKey', e.target.value)}
                              placeholder="Nhập API Key cá nhân (hoặc để trống nếu máy chủ đã cấu hình)..."
                              className="w-full text-xs px-4 py-3 bg-[#e0e6f0] dark:bg-[#080d1c] border border-slate-300/30 dark:border-slate-800/20 rounded-xl focus:outline-none focus:border-mystic-accent font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]"
                            />
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                              API Key được lưu trữ an toàn ngay trên trình duyệt và không chia sẻ ra bên ngoài.
                            </p>
                          </div>

                          {/* Voices Loader & Selector */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div>
                              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                Giọng nói (Voice) {settings.elevenLabsVoiceName ? `[${settings.elevenLabsVoiceName}]` : ''}
                              </label>
                              <div className="flex gap-2">
                                <select
                                  value={settings.elevenLabsVoiceId || ''}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const v = fetchedVoices.find(x => x.voice_id === selectedId);
                                    handleChange('elevenLabsVoiceId', selectedId);
                                    if (v) {
                                      handleChange('elevenLabsVoiceName', v.name);
                                    } else {
                                      // Fallback names for default choices
                                      const defaults: Record<string, string> = {
                                        "21m00Tcm4TlvDq8ikWAM": "Rachel",
                                        "AZnzlk1XhkZOKMWIecbY": "Dom",
                                        "EXAVITQu4vr4xnSDxMaL": "Bella",
                                        "ErXwobaYiN019PkySvjV": "Antoni",
                                        "MF3mGyX7TOfL2fIBI2N9": "Elli",
                                        "TxGEqn7nU66IdC2OXCR9": "Josh",
                                        "VR6A4UBqMnX7XI9IB7QC": "Arnold"
                                      };
                                      handleChange('elevenLabsVoiceName', defaults[selectedId] || "Tùy Chỉnh");
                                    }
                                  }}
                                  className="flex-1 text-xs px-3 py-2 bg-[#e0e6f0] dark:bg-[#080d1c] border border-slate-300/30 dark:border-slate-800/20 rounded-xl focus:outline-none focus:border-mystic-accent text-slate-800 dark:text-slate-100 font-semibold cursor-pointer shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042]"
                                >
                                  {fetchedVoices.length > 0 ? (
                                    fetchedVoices.map((voice) => (
                                      <option key={voice.voice_id} value={voice.voice_id}>
                                        {voice.name} {voice.category ? `(${voice.category})` : ''}
                                      </option>
                                    ))
                                  ) : (
                                    <>
                                      <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Mặc Định - Nữ Thậm Thụt)</option>
                                      <option value="AZnzlk1XhkZOKMWIecbY">Dom (Nam Trung Niên trầm ấm)</option>
                                      <option value="EXAVITQu4vr4xnSDxMaL">Bella (Sweet Polish Female)</option>
                                      <option value="ErXwobaYiN019PkySvjV">Antoni (Đọc Hội Thoại chuyên nghiệp)</option>
                                      <option value="MF3mGyX7TOfL2fIBI2N9">Elli (Soft Whispery Female)</option>
                                      <option value="TxGEqn7nU66IdC2OXCR9">Josh (Deep Mature Male)</option>
                                      <option value="VR6A4UBqMnX7XI9IB7QC">Arnold (Action Hero Male)</option>
                                    </>
                                  )}
                                </select>

                                {/* Fetch button */}
                                <Button
                                  onClick={handleFetchVoices}
                                  disabled={isFetchingVoices}
                                  className="px-3 py-2 font-black text-xs bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df] dark:active:shadow-[inset_2px_2px_4px_#030610] cursor-pointer flex items-center gap-1 text-slate-800 dark:text-slate-300"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingVoices ? 'animate-spin text-mystic-accent' : ''}`} />
                                  {isFetchingVoices ? 'Đang gọi...' : 'Tìm Giọng'}
                                </Button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                Model ngôn ngữ (Quality Model)
                              </label>
                              <select
                                value={settings.elevenLabsModelId || 'eleven_turbo_v2_5'}
                                onChange={(e) => handleChange('elevenLabsModelId', e.target.value)}
                                className="w-full text-xs px-3 py-2 bg-[#e0e6f0] dark:bg-[#080d1c] border border-slate-300/30 dark:border-slate-800/20 rounded-xl focus:outline-none focus:border-mystic-accent text-slate-800 dark:text-slate-100 font-semibold cursor-pointer shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042]"
                              >
                                <option value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Siêu nhanh & Đa ngữ - khuyên dùng)</option>
                                <option value="eleven_multilingual_v2">Eleven Multilingual v2 (Chất lượng rất cao - 26 ngôn ngữ)</option>
                                <option value="eleven_monolingual_v1">Eleven Monolingual v1 (Chỉ dành riêng cho Tiếng Anh)</option>
                              </select>
                            </div>
                          </div>

                          {/* Error and Success notifications */}
                          {ttsError && (
                            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-semibold text-red-500 dark:text-red-400 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                              {ttsError}
                            </div>
                          )}
                          {ttsSuccess && (
                            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              {ttsSuccess}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ElevenLabs Fine-Tuning Box */}
                      <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Tinh chỉnh kỹ thuật Luồng Phát Âm ElevenLabs</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Stability */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                              <span>Độ ổn định giọng đọc (Stability)</span>
                              <span className="text-mystic-accent font-mono">{Math.round((settings.elevenLabsStability ?? 0.5) * 100)}%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                              Giá trị thấp tạo ra giọng nói biểu cảm, ngẫu hứng và có cảm xúc thăng trầm sinh động hơn. Giá trị cao giúp giọng đọc đều, vững vàng, không méo tiếng.
                            </p>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((settings.elevenLabsStability ?? 0.5) * 100)}
                              onChange={(e) => handleChange('elevenLabsStability', parseFloat(e.target.value) / 100)}
                              className="w-full accent-mystic-accent cursor-pointer"
                            />
                          </div>

                          {/* Similarity Boost */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                              <span>Độ rõ nét & Đồng bộ (Similarity Boost)</span>
                              <span className="text-mystic-accent font-mono">{Math.round((settings.elevenLabsSimilarityBoost ?? 0.75) * 100)}%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                              Giá trị cao ép buộc Audio phát âm khớp tương đồng tối đa với giọng mẫu gốc (giảm rè tiếng). Giá trị thấp tạo cơ hội biến hóa giọng đọc theo văn phong tốt hơn.
                            </p>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((settings.elevenLabsSimilarityBoost ?? 0.75) * 100)}
                              onChange={(e) => handleChange('elevenLabsSimilarityBoost', parseFloat(e.target.value) / 100)}
                              className="w-full accent-mystic-accent cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Test voice playground */}
                      <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-4">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Phòng Thử giọng (Test ElevenLabs Audio)</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nhập câu hội thoại ngắn bất kỳ để kiểm nghiệm âm sắc và nhịp điệu của giọng đọc ElevenLabs được chọn.</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            value={testPhrase}
                            onChange={(e) => setTestPhrase(e.target.value)}
                            placeholder="Nhập nội dung thử giọng chính văn..."
                            className="flex-1 text-xs px-4 py-3 bg-[#e0e6f0] dark:bg-[#080d1c] border border-slate-300/30 dark:border-slate-800/20 rounded-xl focus:outline-none font-medium text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]"
                          />
                          <Button
                            onClick={handleTestPlayTts}
                            className={`px-5 py-3 font-black text-xs border border-mystic-accent/15 cursor-pointer flex items-center justify-center gap-1.5 transition-all text-white rounded-xl shadow-[3px_3px_6px_rgba(56,189,248,0.15)] dark:shadow-[3px_3px_6px_rgba(3,6,16,0.3)] ${
                              isTestingTts ? 'bg-red-500 hover:bg-red-600' : 'bg-mystic-accent hover:bg-mystic-accent/95'
                            }`}
                          >
                            {isTestingTts ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-white animate-ping mr-0.5"></span>
                                Dừng Lại
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-4 h-4" />
                                Thử Giọng
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'custom-theme' && (
                  <div className="space-y-8 select-none">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Paintbrush className="text-mystic-accent" /> Sáng Tạo & Tùy Biến Theme
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Tự tay thiết kế giao diện độc bản của bạn với bảng màu thông minh.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
                      {/* Left Side: Creator Form */}
                      <div className="lg:col-span-7 space-y-6">
                        
                        {/* Selector/Toggle Box */}
                        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Cài Đặt Theme</h4>
                              <p className="text-xs text-slate-500">Bật/tắt sử dụng theme do bạn tự định nghĩa</p>
                            </div>
                            <button
                              onClick={() => handleToggleCustomTheme(!useCustomTheme)}
                              className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/25 dark:border-[#142042]/10 cursor-pointer"
                            >
                              <motion.div 
                                layout
                                className={`absolute top-0.5 left-1 w-4 h-4 rounded-full shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] transition-colors ${useCustomTheme ? 'bg-mystic-accent' : 'bg-slate-400 dark:bg-slate-600'}`}
                                animate={{ x: useCustomTheme ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>

                          {customThemes.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Danh sách Theme Đã Tạo</label>
                              <div className="flex flex-wrap gap-2">
                                {customThemes.map(ct => (
                                  <div 
                                    key={ct.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold cursor-pointer ${activeCustomThemeId === ct.id ? 'bg-mystic-accent text-white border-transparent shadow-md' : 'bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-700 dark:text-slate-300 border-[#cbd2df]/30 dark:border-[#142042]/10 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]'}`}
                                    onClick={() => handleSelectCustomThemeId(ct.id)}
                                  >
                                    <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: ct.primaryColor }} />
                                    <span>{ct.name}</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCustomTheme(ct.id);
                                      }}
                                      className="p-0.5 hover:text-red-500 rounded-md cursor-pointer ml-1 text-slate-400"
                                    >
                                      <Trash2 className="w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Editor Box */}
                        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-6">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-[#cbd2df]/20 dark:border-[#142042]/10 pb-3">
                            <Palette className="w-4 h-4 text-mystic-accent" /> Tạo Theme Tùy Chỉnh
                          </h4>

                          <div className="space-y-2">
                            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Tên Theme</label>
                            <input
                              type="text"
                              value={newThemeName}
                              onChange={(e) => setNewThemeName(e.target.value)}
                              placeholder="Nhập tên theme..."
                              className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] rounded-xl p-3 text-sm text-slate-800 dark:text-slate-200 focus:border-mystic-accent outline-none font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Màu Chính (Nền)</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={newThemePrimary}
                                  onChange={(e) => setNewThemePrimary(e.target.value)}
                                  className="w-10 h-10 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 bg-transparent p-0.5 cursor-pointer shrink-0 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                                />
                                <div className="flex-1 bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl px-3 flex items-center justify-between">
                                  <span className="text-xs font-mono text-slate-650 dark:text-slate-300">{newThemePrimary}</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500">Đây sẽ là màu nền chính của theme</p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Màu Phụ (Chữ)</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={newThemeSecondary}
                                  onChange={(e) => setNewThemeSecondary(e.target.value)}
                                  className="w-10 h-10 rounded-xl border border-[#cbd2df]/30 dark:border-[#142042]/10 bg-transparent p-0.5 cursor-pointer shrink-0 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                                />
                                <div className="flex-1 bg-[#cbd2df]/10 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[inset_1.5px_1.5px_3px_#cbd2df,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#030610,inset_-1.5px_-1.5px_3px_#142042] rounded-xl px-3 flex items-center justify-between">
                                  <span className="text-xs font-mono text-slate-650 dark:text-slate-300">{newThemeSecondary}</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500">Đây sẽ là màu chữ chính của theme</p>
                            </div>
                          </div>

                          {/* Collapsible / Switch for Advanced Override Colors */}
                          <div className="pt-3 border-t border-[#cbd2df]/20 dark:border-[#142042]/10">
                            <button
                              type="button"
                              onClick={() => setManualColorOverride(!manualColorOverride)}
                              className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-mystic-accent transition-colors"
                            >
                              <Sliders className="w-3.5 h-3.5 text-mystic-accent" />
                              <span>{manualColorOverride ? "✓ Tùy chỉnh nâng cao: Được bật" : "⚡ Tùy Chỉnh Màu Sắc"}</span>
                            </button>

                            {manualColorOverride && (
                              <div className="mt-4 p-4 rounded-2xl bg-black/5 dark:bg-black/10 space-y-4 border border-[#cbd2df]/15 dark:border-[#142042]/10">
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Màu Nhấn (Accent)</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="color"
                                        value={newAccentColor}
                                        onChange={(e) => setNewAccentColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-gray-400/25 shrink-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={newAccentColor} 
                                        onChange={(e) => setNewAccentColor(e.target.value)}
                                        className="flex-1 bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 text-xs font-mono p-1 rounded-lg outline-none"
                                      />
                                    </div>
                                    <p className="text-[9px] text-slate-450 dark:text-slate-400">Màu nhấn cho các nút và điểm nhấn quan trọng</p>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Màu Mờ (Muted)</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="color"
                                        value={newMutedColor}
                                        onChange={(e) => setNewMutedColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-gray-400/25 shrink-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={newMutedColor} 
                                        onChange={(e) => setNewMutedColor(e.target.value)}
                                        className="flex-1 bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 text-xs font-mono p-1 rounded-lg outline-none"
                                      />
                                    </div>
                                    <p className="text-[9px] text-slate-450 dark:text-slate-400">Màu mờ cho văn bản phụ và thông tin ít quan trọng</p>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Màu Thành Công</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="color"
                                        value={newSuccessColor}
                                        onChange={(e) => setNewSuccessColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-gray-400/25 shrink-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={newSuccessColor} 
                                        onChange={(e) => setNewSuccessColor(e.target.value)}
                                        className="flex-1 bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 text-xs font-mono p-1 rounded-lg outline-none"
                                      />
                                    </div>
                                    <p className="text-[9px] text-slate-450 dark:text-slate-400">Màu cho thông báo thành công và trạng thái tích cực</p>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Màu Cảnh Báo</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="color"
                                        value={newWarningColor}
                                        onChange={(e) => setNewWarningColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-gray-400/25 shrink-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={newWarningColor} 
                                        onChange={(e) => setNewWarningColor(e.target.value)}
                                        className="flex-1 bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 text-xs font-mono p-1 rounded-lg outline-none"
                                      />
                                    </div>
                                    <p className="text-[9px] text-slate-450 dark:text-slate-400">Màu cho cảnh báo và thông báo quan trọng</p>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Màu Lỗi</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="color"
                                        value={newErrorColor}
                                        onChange={(e) => setNewErrorColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-gray-400/25 shrink-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={newErrorColor} 
                                        onChange={(e) => setNewErrorColor(e.target.value)}
                                        className="flex-1 bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/25 dark:border-[#142042]/15 text-xs font-mono p-1 rounded-lg outline-none"
                                      />
                                    </div>
                                    <p className="text-[9px] text-slate-450 dark:text-slate-400">Màu cho lỗi và thông báo tiêu cực</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick Action bar */}
                          <div className="flex gap-3 pt-2">
                            <button
                              type="button"
                              onClick={handleSaveCustomTheme}
                              className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 hover:bg-orange-500 transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Lưu Theme
                            </button>

                            <button
                              type="button"
                              onClick={handleNewTheme}
                              className="px-4 py-2.5 rounded-xl bg-[#cbd2df]/30 dark:bg-slate-950/25 text-slate-700 dark:text-slate-300 font-bold text-xs border border-[#cbd2df]/30 dark:border-[#142042]/10 transition-all cursor-pointer"
                            >
                              Tạo Mới Theme
                            </button>
                          </div>
                        </div>

                        {/* How it works card */}
                        <div className="bg-[#cbd2df]/20 dark:bg-slate-950/25 border border-[#cbd2df]/10 dark:border-[#142042]/5 rounded-3xl p-5 space-y-3">
                          <h5 className="text-[13px] font-black text-slate-700 dark:text-slate-300">Cách hoạt động</h5>
                          <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium list-disc list-inside">
                            <li>Chọn màu chính và màu phụ</li>
                            <li>Hệ thống tự động tạo màu bổ sung</li>
                            <li>Đảm bảo tỷ lệ tương phản phù hợp</li>
                            <li>Tạo gradient và bóng đẹp mắt</li>
                            <li>Tất cả màu khác được tính tự động</li>
                          </ul>
                        </div>
                      </div>

                      {/* Right Side: Live Theme Preview */}
                      <div className="lg:col-span-5 space-y-6">
                        <div className="sticky top-6">
                          <div className="bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/10 dark:border-[#142042]/5 shadow-[6px_6px_12px_#cbd2df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#030610,-6px_-6px_12px_#142042] rounded-3xl p-6 space-y-4">
                            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-200">Xem Trước Trực Tiếp</h4>

                            {/* Demo Container */}
                            <div 
                              className="rounded-2xl border p-5 space-y-5 transition-all shadow-md overflow-hidden relative"
                              style={{ 
                                backgroundColor: newThemePrimary, 
                                borderColor: `${newThemeSecondary}20`,
                              }}
                            >
                              {/* Background layer inside preview */}
                              <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: newAccentColor }} />

                              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: `${newThemeSecondary}15` }}>
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: newAccentColor }}>
                                  Xem Trước Theme: Preview
                                </span>
                                <div className="flex gap-1">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: newErrorColor }} />
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: newWarningColor }} />
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: newSuccessColor }} />
                                </div>
                              </div>

                              {/* Gradient Title */}
                              <div className="space-y-1">
                                <h5 
                                  className="text-base font-black tracking-tight"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${newThemeSecondary}, ${newAccentColor})`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                  }}
                                >
                                  Tiêu Đề Gradient
                                </h5>
                                <p className="text-xs font-semibold" style={{ color: newThemeSecondary }}>
                                  Màu chữ chính - Đây là màu chữ chính
                                </p>
                              </div>

                              {/* Texts Demo */}
                              <div className="p-3.5 rounded-xl space-y-2 border" style={{ backgroundColor: `${newThemeSecondary}0a`, borderColor: `${newThemeSecondary}0d` }}>
                                <p className="text-[11px] font-medium leading-relaxed" style={{ color: newMutedColor }}>
                                  Màu chữ mờ - Dành cho thông tin phụ
                                </p>
                                <p className="text-xs font-bold" style={{ color: newAccentColor }}>
                                  Màu chữ nhấn - Dành cho điểm nhấn
                                </p>
                                <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] font-bold underline block" style={{ color: newAccentColor }}>
                                  Màu liên kết - Dành cho các liên kết
                                </a>
                              </div>

                              {/* Color blocks indicator */}
                              <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
                                <div className="p-1 px-1.5 rounded-lg border text-white/90" style={{ backgroundColor: newSuccessColor, borderColor: `${newThemeSecondary}15` }}>Thành công</div>
                                <div className="p-1 px-1.5 rounded-lg border text-white/90" style={{ backgroundColor: newWarningColor, borderColor: `${newThemeSecondary}15` }}>Cảnh báo</div>
                                <div className="p-1 px-1.5 rounded-lg border text-white/90" style={{ backgroundColor: newErrorColor, borderColor: `${newThemeSecondary}15` }}>Thất bại</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsScreen;
