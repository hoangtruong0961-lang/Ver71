import { create } from 'zustand';
import { GameState, WorldData } from '../types';
import { LsrParser } from '../services/lsr/LsrParser';

interface AppState {
  gameState: GameState;
  activeWorld: WorldData | null;
  importedSetup: WorldData | null;
  isSettingsFromGame: boolean;

  setGameState: (state: GameState) => void;
  setActiveWorld: (world: WorldData | null) => void;
  setImportedSetup: (setup: WorldData | null) => void;
  setIsSettingsFromGame: (isFromGame: boolean) => void;

  selectedSettingsTab: string | null;
  setSelectedSettingsTab: (tab: string | null) => void;
  navigate: (newState: GameState, selectedTab?: string) => void;
  startGame: (worldData: WorldData) => void;
  importSetup: (worldData: WorldData) => void;
  updateWorld: (data: Partial<WorldData>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  gameState: GameState.MENU,
  activeWorld: null,
  importedSetup: null,
  isSettingsFromGame: false,
  selectedSettingsTab: null,

  setGameState: (state) => set({ gameState: state }),
  setActiveWorld: (world) => set({ activeWorld: world ? LsrParser.migrateWorldLsrToDefault(world) : null }),
  setImportedSetup: (setup) => set({ importedSetup: setup ? LsrParser.migrateWorldLsrToDefault(setup) : null }),
  setIsSettingsFromGame: (isFromGame) => set({ isSettingsFromGame: isFromGame }),
  setSelectedSettingsTab: (tab) => set({ selectedSettingsTab: tab }),

  navigate: (newState, selectedTab) => {
    const { gameState, importedSetup } = get();
    let nextSettingsFromGame = get().isSettingsFromGame;
    
    if (newState === GameState.SETTINGS) {
      nextSettingsFromGame = (gameState === GameState.PLAYING);
    }
    
    set({
      gameState: newState,
      isSettingsFromGame: nextSettingsFromGame,
      importedSetup: null, // Reset imported setup on normal navigation
      selectedSettingsTab: selectedTab || null,
      ...(newState === GameState.MENU ? { activeWorld: null } : {})
    });
  },

// Create a UUID or random string for sessionId
  startGame: (worldData) => {
    const migrated = LsrParser.migrateWorldLsrToDefault(worldData);
    set({
      activeWorld: { ...migrated, sessionId: crypto.randomUUID() },
      gameState: GameState.PLAYING
    });
  },

  importSetup: (worldData) => set({
    importedSetup: LsrParser.migrateWorldLsrToDefault(worldData),
    gameState: GameState.WORLD_CREATION
  }),

  updateWorld: (data) => set((state) => {
    if (!state.activeWorld) return { activeWorld: null };
    const merged = { ...state.activeWorld, ...data };
    const migrated = LsrParser.migrateWorldLsrToDefault(merged);
    return { activeWorld: migrated };
  })
}));
