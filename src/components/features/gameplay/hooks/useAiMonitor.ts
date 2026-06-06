import { useState, useRef, useEffect, useCallback } from 'react';
import { WorldData } from '../../../../types';

export function useAiMonitor(activeWorld: WorldData | null) {
  const initialHistory = activeWorld?.savedState?.aiMonitor?.tokenHistory || [];
  const initialTotal = activeWorld?.savedState?.aiMonitor?.totalTokens || 0;
  const initialLastTime = activeWorld?.savedState?.aiMonitor?.lastTurnTotalTime || 0;

  const [tokenHistory, setTokenHistory] = useState<{tokens: number, words: number, timestamp: number}[]>(initialHistory);
  const [totalTokens, setTotalTokens] = useState<number>(initialTotal);
  const [lastTurnTotalTime, setLastTurnTotalTime] = useState<number>(initialLastTime);
  const [currentProcessingTime, setCurrentProcessingTime] = useState<number>(0);
  
  const tokenHistoryRef = useRef<{tokens: number, words: number, timestamp: number}[]>(initialHistory);
  const totalTokensRef = useRef<number>(initialTotal);
  const lastTurnTotalTimeRef = useRef<number>(initialLastTime);
  const processingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    tokenHistoryRef.current = tokenHistory;
  }, [tokenHistory]);

  useEffect(() => {
    totalTokensRef.current = totalTokens;
  }, [totalTokens]);

  useEffect(() => {
    lastTurnTotalTimeRef.current = lastTurnTotalTime;
  }, [lastTurnTotalTime]);

  const startProcessing = useCallback(() => {
    processingStartTimeRef.current = Date.now();
    setCurrentProcessingTime(0);
  }, []);

  const endProcessing = useCallback(() => {
    if (processingStartTimeRef.current) {
        const total = Date.now() - processingStartTimeRef.current;
        setLastTurnTotalTime(total);
        lastTurnTotalTimeRef.current = total;
        processingStartTimeRef.current = null;
    }
  }, []);

  const updateTokenHistoryItem = useCallback((tokens: number, text?: string) => {
    if (!tokens) return;
    const words = text ? text.trim().split(/\s+/).length : 0;
    const newEntry = { tokens, words, timestamp: Date.now() };
    setTokenHistory(prev => {
        const updated = [newEntry, ...prev].slice(0, 5);
        tokenHistoryRef.current = updated;
        return updated;
    });
    setTotalTokens(prev => {
        const updated = prev + tokens;
        totalTokensRef.current = updated;
        return updated;
    });
  }, []);

  const syncFromSave = useCallback((aiMonitorInfo: any) => {
    if (aiMonitorInfo) {
        setTokenHistory(aiMonitorInfo.tokenHistory || []);
        setTotalTokens(aiMonitorInfo.totalTokens || 0);
        setLastTurnTotalTime(aiMonitorInfo.lastTurnTotalTime || 0);
    } else {
        setTokenHistory([]);
        setTotalTokens(0);
        setLastTurnTotalTime(0);
    }
  }, []);

  return {
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
    updateTokenHistoryItem,
    syncFromSave
  };
}
