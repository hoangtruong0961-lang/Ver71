import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbService } from '../services/db/indexedDB';
import { CustomTheme } from '../types';

export type Theme = 'light' | 'dark' | 'pastel' | 'clay';

// Helper to convert hex to RGB for Neumorphic color calculations
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Dynamically generate Neumorphic gradients and shadows for any background color
function getNeumorphicStyles(primaryHex: string, isThemeDark: boolean) {
  const hex = primaryHex.toLowerCase();
  
  let shadowDark = '';
  let shadowLight = '';
  let flat = '';
  let convex = '';
  let concave = '';
  let inset = '';
  let border = '';

  if (hex === '#e8e2d5') {
    // Pastel/Cream Theme (#E8E2D5): warm sand/pastel cream, comforting matte bone/chalk texture
    shadowDark = 'rgb(203, 195, 178)';
    shadowLight = 'rgb(255, 255, 255)';
    flat = 'linear-gradient(135deg, #f3ede2, #ddd6c8)';
    convex = 'linear-gradient(135deg, #f9f4ea, #d5cebf)';
    concave = 'linear-gradient(135deg, #d5cebf, #f9f4ea)';
    inset = 'linear-gradient(135deg, #d3cbbb, #e8e2d5)';
    border = 'rgba(255, 255, 255, 0.75)';
  } else if (hex === '#debca3') {
    // Clay/Earthy Theme: rich natural desert terracotta, matte clay/rubber texture
    shadowDark = 'rgb(190, 150, 122)';
    shadowLight = 'rgb(250, 219, 196)';
    flat = 'linear-gradient(135deg, #ebd0bc, #cca78d)';
    convex = 'linear-gradient(135deg, #f0d6c4, #c7a186)';
    concave = 'linear-gradient(135deg, #c7a186, #f0d6c4)';
    inset = 'linear-gradient(135deg, #bd9a81, #debca3)';
    border = 'rgba(255, 255, 255, 0.25)';
  } else if (isThemeDark) {
    const rgb = hexToRgb(primaryHex) || { r: 11, g: 19, b: 41 };
    const { r, g, b } = rgb;
    const darkR = Math.max(0, r - 12);
    const darkG = Math.max(0, g - 12);
    const darkB = Math.max(0, b - 12);
    shadowDark = `rgb(${darkR}, ${darkG}, ${darkB})`;
    
    const lightR = Math.min(255, r + 18);
    const lightG = Math.min(255, g + 18);
    const lightB = Math.min(255, b + 18);
    shadowLight = `rgb(${lightR}, ${lightG}, ${lightB})`;
    
    const lighterR = Math.min(255, r + 10);
    const lighterG = Math.min(255, g + 10);
    const lighterB = Math.min(255, b + 10);
    const darkerR = Math.max(0, r - 8);
    const darkerG = Math.max(0, g - 8);
    const darkerB = Math.max(0, b - 8);
    
    flat = `linear-gradient(135deg, rgb(${lighterR}, ${lighterG}, ${lighterB}), rgb(${darkerR}, ${darkerG}, ${darkerB}))`;
    convex = `linear-gradient(135deg, rgb(${lighterR + 3}, ${lighterG + 3}, ${lighterB + 3}), rgb(${darkerR}, ${darkerG}, ${darkerB}))`;
    concave = `linear-gradient(135deg, rgb(${darkerR}, ${darkerG}, ${darkerB}), rgb(${lighterR + 3}, ${lighterG + 3}, ${lighterB + 3}))`;
    inset = `linear-gradient(135deg, rgb(${darkerR}, ${darkerG}, ${darkerB}), rgb(${lighterR}, ${lighterG}, ${lighterB}))`;
    border = `rgba(255, 255, 255, 0.03)`;
  } else {
    // For standard light/earth tones, shadows are soft and organic
    const rgb = hexToRgb(primaryHex) || { r: 230, g: 235, b: 244 };
    const { r, g, b } = rgb;
    const darkR = Math.max(0, r - 32);
    const darkG = Math.max(0, g - 32);
    const darkB = Math.max(0, b - 30);
    shadowDark = `rgb(${darkR}, ${darkG}, ${darkB})`;
    
    const lightR = Math.min(255, r + 24);
    const lightG = Math.min(255, g + 24);
    const lightB = Math.min(255, b + 24);
    shadowLight = `rgb(${lightR}, ${lightG}, ${lightB})`;
    
    const lighterR = Math.min(255, r + 14);
    const lighterG = Math.min(255, g + 14);
    const lighterB = Math.min(255, b + 14);
    const darkerR = Math.max(0, r - 16);
    const darkerG = Math.max(0, g - 16);
    const darkerB = Math.max(0, b - 16);
    
    flat = `linear-gradient(135deg, rgb(${lighterR}, ${lighterG}, ${lighterB}), rgb(${darkerR}, ${darkerG}, ${darkerB}))`;
    convex = `linear-gradient(135deg, rgb(${lighterR + 5}, ${lighterG + 5}, ${lighterB + 5}), rgb(${darkerR}, ${darkerG}, ${darkerB}))`;
    concave = `linear-gradient(135deg, rgb(${darkerR}, ${darkerG}, ${darkerB}), rgb(${lighterR + 5}, ${lighterG + 5}, ${lighterB + 5}))`;
    inset = `linear-gradient(135deg, rgb(${darkerR}, ${darkerG}, ${darkerB}), rgb(${lighterR}, ${lighterG}, ${lighterB}))`;
    border = `rgba(255, 255, 255, 0.55)`;
  }
  
  return { shadowDark, shadowLight, flat, convex, concave, inset, border };
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  visualEffects: boolean;
  setVisualEffects: (enabled: boolean) => void;
  layoutZoom: number;
  setLayoutZoom: (zoom: number) => void;

  // Custom Themes supporting
  useCustomTheme: boolean;
  setUseCustomTheme: (enabled: boolean) => void;
  customThemes: CustomTheme[];
  setCustomThemes: (themes: CustomTheme[]) => void;
  activeCustomThemeId: string;
  setActiveCustomThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [fontFamily, setFontFamilyState] = useState<string>('Lora');
  const [fontSize, setFontSizeState] = useState<number>(16);
  const [visualEffects, setVisualEffectsState] = useState<boolean>(true);
  const [layoutZoom, setLayoutZoomState] = useState<number>(100);

  // Custom Theme state variables
  const [useCustomTheme, setUseCustomTheme] = useState<boolean>(false);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [activeCustomThemeId, setActiveCustomThemeId] = useState<string>('');

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await dbService.getSettings();
      setThemeState(settings.theme || 'dark');
      setFontFamilyState(settings.systemFont || 'Lora');
      setFontSizeState(settings.fontSize || 16);
      setVisualEffectsState(settings.visualEffects !== undefined ? settings.visualEffects : true);
      setLayoutZoomState(settings.layoutZoom !== undefined ? settings.layoutZoom : 100);

      // Load custom themes from indexedDB
      setUseCustomTheme(!!settings.useCustomTheme);
      setCustomThemes(settings.customThemes || []);
      setActiveCustomThemeId(settings.activeCustomThemeId || '');
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'custom-theme-active');

    if (theme === 'pastel' || theme === 'clay') {
      root.classList.add('light', 'custom-theme-active');
    } else if (useCustomTheme && activeCustomThemeId) {
      const activeTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (activeTheme) {
        root.classList.add(activeTheme.isDark ? 'dark' : 'light', 'custom-theme-active');
      } else {
        root.classList.add(theme);
      }
    } else {
      root.classList.add(theme);
    }
  }, [theme, useCustomTheme, activeCustomThemeId, customThemes]);

  // Handle CSS variable generation and injection for Custom Theme and Presets (Pastel / Clay)
  useEffect(() => {
    const root = window.document.documentElement;
    let styleElement = document.getElementById('custom-theme-overrides');

    let isPresetOrCustom = false;
    let primaryColor = '';
    let secondaryColor = '';
    let accentColor = '';
    let successColor = '';
    let warningColor = '';
    let errorColor = '';
    let mutedColor = '';
    let isThemeDark = false;

    if (theme === 'pastel') {
      isPresetOrCustom = true;
      primaryColor = '#e8e2d5';
      secondaryColor = '#2c1810';
      accentColor = '#bf7575'; // Soft dusty rose/coral accent
      successColor = '#60998a'; // Sage green success
      warningColor = '#ca8a04'; // Warm amber warning
      errorColor = '#bf7575'; // Soft rose error
      mutedColor = '#7a6a60'; // Roasted chestnut muted text
      isThemeDark = false;
    } else if (theme === 'clay') {
      isPresetOrCustom = true;
      primaryColor = '#debca3';
      secondaryColor = '#35251c';
      accentColor = '#cf5c36';
      successColor = '#648c6a';
      warningColor = '#cf8a3c';
      errorColor = '#cf4a36';
      mutedColor = '#7c6353';
      isThemeDark = false;
    } else if (useCustomTheme && activeCustomThemeId) {
      const activeTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (activeTheme) {
        isPresetOrCustom = true;
        primaryColor = activeTheme.primaryColor;
        secondaryColor = activeTheme.secondaryColor;
        accentColor = activeTheme.accentColor;
        successColor = activeTheme.successColor;
        warningColor = activeTheme.warningColor;
        errorColor = activeTheme.errorColor;
        mutedColor = activeTheme.mutedColor;
        isThemeDark = activeTheme.isDark;
      }
    }

    if (isPresetOrCustom) {
      root.classList.add('custom-theme-active');

      // Create style tag if it does not exist
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'custom-theme-overrides';
        document.head.appendChild(styleElement);
      }

      const neu = getNeumorphicStyles(primaryColor, isThemeDark);

      // Populate CSS Custom Variables on :root and override selectors
      styleElement.innerHTML = `
        :root {
          --theme-bg: ${primaryColor};
          --theme-bg-trans: ${primaryColor}cc;
          --theme-text: ${secondaryColor};
          --theme-accent: ${accentColor};
          --theme-success: ${successColor};
          --theme-warning: ${warningColor};
          --theme-error: ${errorColor};
          --theme-muted: ${mutedColor};

          /* Neumorphic Overrides */
          --neu-bg: ${primaryColor};
          --neu-shadow-dark: ${neu.shadowDark};
          --neu-shadow-light: ${neu.shadowLight};
          --neu-flat-bg: ${neu.flat};
          --neu-convex-bg: ${neu.convex};
          --neu-concave-bg: ${neu.concave};
          --neu-inset-bg: ${neu.inset};
          --neu-border: ${neu.border};
        }

        html.custom-theme-active,
        html.custom-theme-active body,
        html.custom-theme-active #root,
        html.custom-theme-active .screen,
        html.custom-theme-active [class*="bg-[#0b1329]"],
        html.custom-theme-active [class*="bg-[#e6ebf4]"],
        html.custom-theme-active [class*="bg-[#010514]"],
        html.custom-theme-active [class*="bg-stone-50"],
        html.custom-theme-active [class*="bg-slate-900"],
        html.custom-theme-active [class*="bg-slate-950"],
        html.custom-theme-active [class*="bg-slate-900/"],
        html.custom-theme-active [class*="bg-slate-950/"],
        html.custom-theme-active [class*="bg-[#0b1329]/"] {
          background-color: var(--theme-bg) !important;
        }

        html.custom-theme-active [class*="bg-[#e6ebf4]/50"] {
          background-color: rgba(128,128,128,0.15) !important;
        }

        html.custom-theme-active,
        html.custom-theme-active p,
        html.custom-theme-active h1,
        html.custom-theme-active h2,
        html.custom-theme-active h3,
        html.custom-theme-active h4,
        html.custom-theme-active h5,
        html.custom-theme-active h6,
        html.custom-theme-active span,
        html.custom-theme-active label,
        html.custom-theme-active button,
        html.custom-theme-active [class*="text-slate-100"],
        html.custom-theme-active [class*="text-slate-200"],
        html.custom-theme-active [class*="text-slate-300"],
        html.custom-theme-active [class*="text-slate-700"],
        html.custom-theme-active [class*="text-slate-800"],
        html.custom-theme-active [class*="text-slate-900"],
        html.custom-theme-active [class*="text-stone-"] {
          color: var(--theme-text) !important;
        }

        html.custom-theme-active [class*="text-slate-400"],
        html.custom-theme-active [class*="text-slate-500"],
        html.custom-theme-active [class*="text-slate-600"] {
          color: var(--theme-muted) !important;
        }

        html.custom-theme-active [class*="text-mystic-accent"] {
          color: var(--theme-accent) !important;
        }

        html.custom-theme-active [class*="bg-mystic-accent"] {
          background-color: var(--theme-accent) !important;
          color: #ffffff !important;
        }

        html.custom-theme-active [class*="border-mystic-accent"] {
          border-color: var(--theme-accent) !important;
        }

        /* Theme indicators */
        html.custom-theme-active [class*="border-[#cbd2df]"],
        html.custom-theme-active [class*="border-[#142042]"] {
          border-color: rgba(128, 128, 128, 0.15) !important;
        }

        html.custom-theme-active [class*="shadow-"] {
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08) !important;
        }
      `;
    } else {
      root.classList.remove('custom-theme-active');
      if (styleElement) {
        styleElement.remove();
      }
    }
  }, [theme, useCustomTheme, activeCustomThemeId, customThemes]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--font-system', fontFamily);
    root.style.setProperty('--font-size-base', `${fontSize}px`);
  }, [fontFamily, fontSize]);

  useEffect(() => {
    const docEl = window.document.documentElement;
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    const updateScaling = () => {
      // Thiết lập hiển thị zoom tùy chọn
      // Bản di động (mobile) có tỷ lệ thu nhỏ mặc định là 0.8
      const isMobileDevice = window.innerWidth < 768;
      const baseZoom = isMobileDevice ? 0.8 : 1.0;
      const finalZoom = (layoutZoom / 100) * baseZoom;

      document.body.style.zoom = finalZoom.toString();
      docEl.style.zoom = ''; // Xoá zoom ở html để tránh lỗi đóng băng / khóa tính toán của đơn vị rem trên iOS Safari/Chrome Mobile
      docEl.style.transform = '';
      docEl.style.transformOrigin = '';
      docEl.style.width = '';
      docEl.style.height = '';
      docEl.style.overflow = '';
      document.body.style.overflow = '';
      
      const root = document.getElementById('root');
      if (root) {
        root.style.width = '100%';
        root.style.height = '100%';
        root.style.transform = '';
        root.style.transformOrigin = '';
        root.style.overflow = '';
        root.style.position = '';
        root.style.left = '';
        root.style.top = '';
      }

      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }
    };

    updateScaling();
    window.addEventListener('resize', updateScaling);
    return () => {
      window.removeEventListener('resize', updateScaling);
    };
  }, [layoutZoom]);

  const saveThemeToDb = async (newTheme: Theme) => {
    try {
      const settings = await dbService.getSettings();
      await dbService.saveSettings({ ...settings, theme: newTheme });
    } catch (e) {
      console.error("Error saving theme setting:", e);
    }
  };

  const toggleTheme = () => {
    const cycle: Record<Theme, Theme> = {
      light: 'dark',
      dark: 'pastel',
      pastel: 'clay',
      clay: 'light'
    };
    const newTheme = cycle[theme] || 'dark';
    setThemeState(newTheme);
    saveThemeToDb(newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveThemeToDb(newTheme);
  };

  const setFontFamily = (font: string) => {
    setFontFamilyState(font);
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
  };

  const setVisualEffects = (enabled: boolean) => {
    setVisualEffectsState(enabled);
  };

  const setLayoutZoom = (zoom: number) => {
    setLayoutZoomState(zoom);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, toggleTheme, setTheme, 
      fontFamily, setFontFamily, 
      fontSize, setFontSize,
      visualEffects, setVisualEffects,
      layoutZoom, setLayoutZoom,
      useCustomTheme, setUseCustomTheme,
      customThemes, setCustomThemes,
      activeCustomThemeId, setActiveCustomThemeId
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
