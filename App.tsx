
import React from 'react';
import { Toaster } from 'sonner';
import MainLayout from './src/components/layout/MainLayout';
import MainMenuScreen from './src/components/features/main-menu/MainMenuScreen';
import SettingsScreen from './src/components/features/settings/SettingsScreen';
import WorldCreationScreen from './src/components/features/world-creation/WorldCreationScreen';
import GameplayScreen from './src/components/features/gameplay/GameplayScreen';
import FanficScreen from './src/components/features/fanfic/FanficScreen';
import KnowledgeTrainScreen from './src/components/features/knowledge-train/KnowledgeTrainScreen';
import { SchemaDesignerScreen } from './src/components/features/world-creation/SchemaDesignerScreen';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import { GameState } from './src/types';
import { useAppStore } from './src/store/appStore';

function App() {
  const gameState = useAppStore(state => state.gameState);
  const activeWorld = useAppStore(state => state.activeWorld);
  const importedSetup = useAppStore(state => state.importedSetup);
  const isSettingsFromGame = useAppStore(state => state.isSettingsFromGame);
  const selectedSettingsTab = useAppStore(state => state.selectedSettingsTab);
  
  const handleNavigate = useAppStore(state => state.navigate);
  const handleGameStart = useAppStore(state => state.startGame);
  const handleImportSetup = useAppStore(state => state.importSetup);
  const handleUpdateWorld = useAppStore(state => state.updateWorld);

  return (
    <MainLayout>
      <ErrorBoundary>
        <Toaster position="top-center" theme="dark" richColors />
        {/* Main Game State Switcher */}
      {gameState === GameState.MENU && (
        <MainMenuScreen 
            onNavigate={handleNavigate} 
            onGameStart={handleGameStart}
            onImportSetup={handleImportSetup}
        />
      )}

      {gameState === GameState.WORLD_CREATION && (
        <WorldCreationScreen 
            onNavigate={handleNavigate} 
            onGameStart={handleGameStart}
            initialData={importedSetup}
        />
      )}

      {gameState === GameState.PLAYING && (
        <GameplayScreen 
            onNavigate={handleNavigate}
            activeWorld={activeWorld}
            onUpdateWorld={handleUpdateWorld}
        />
      )}

      {gameState === GameState.SETTINGS && (
        <SettingsScreen 
            onNavigate={handleNavigate} 
            fromGame={isSettingsFromGame} 
            initialTab={selectedSettingsTab || undefined}
        />
      )}

      {gameState === GameState.FANFIC && (
        <FanficScreen 
            onNavigate={handleNavigate} 
            onGameStart={handleGameStart}
        />
      )}

      {gameState === GameState.KNOWLEDGE_TRAIN && (
        <KnowledgeTrainScreen 
            onNavigate={handleNavigate} 
        />
      )}

      {gameState === GameState.SCHEMA_DESIGNER && (
        <SchemaDesignerScreen 
            onNavigate={handleNavigate} 
        />
      )}
      </ErrorBoundary>
    </MainLayout>
  );
}

export default App;
