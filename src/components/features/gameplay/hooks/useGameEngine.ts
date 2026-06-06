import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, WorldData } from '../../../../types';

export function useGameEngine(activeWorld: WorldData | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>(activeWorld?.savedState?.history || []);
  const [lastAction, setLastAction] = useState('');
  const [turnCount, setTurnCount] = useState(activeWorld?.savedState?.turnCount || 0);

  const historyRef = useRef<ChatMessage[]>(activeWorld?.savedState?.history || []);
  const turnCountRef = useRef<number>(activeWorld?.savedState?.turnCount || 0);
  const lastActionRef = useRef<string | undefined>(lastAction);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { turnCountRef.current = turnCount; }, [turnCount]);
  useEffect(() => { lastActionRef.current = lastAction; }, [lastAction]);

  const syncEngineFromSave = useCallback((worldDataWithState: WorldData) => {
    setHistory(worldDataWithState.savedState?.history || []);
    setTurnCount(worldDataWithState.savedState?.turnCount || 0);
    setLastAction('');
  }, []);

  return {
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
    syncEngineFromSave
  };
}
