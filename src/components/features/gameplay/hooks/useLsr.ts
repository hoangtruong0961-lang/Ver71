import { useState, useRef, useEffect } from 'react';
import { WorldData } from '../../../../types';
import { LsrTableDefinition } from '../../../../services/lsr/LsrParser';

export function useLsr(activeWorld: WorldData | null) {
  const [lsrTables, setLsrTables] = useState<LsrTableDefinition[]>([]);
  const [lsrRuntimeData, setLsrRuntimeData] = useState<Record<string, unknown[]>>(activeWorld?.lsrData || {});
  const [activeLsrTableId, setActiveLsrTableId] = useState<string | null>(null);
  const [lsrViewMode, setLsrViewMode] = useState<'table' | 'timeline'>('table');

  const lsrRuntimeDataRef = useRef<Record<string, unknown[]>>(activeWorld?.lsrData || {});

  useEffect(() => {
    lsrRuntimeDataRef.current = lsrRuntimeData;
  }, [lsrRuntimeData]);

  // Initialize active LSR table
  useEffect(() => {
    if (lsrTables.length > 0 && !activeLsrTableId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveLsrTableId(lsrTables[0].id);
    }
  }, [lsrTables, activeLsrTableId]);

  return {
    lsrTables,
    setLsrTables,
    lsrRuntimeData,
    setLsrRuntimeData,
    activeLsrTableId,
    setActiveLsrTableId,
    lsrViewMode,
    setLsrViewMode,
    lsrRuntimeDataRef
  };
}
