import { useState, useCallback } from 'react';
import { SaveFile } from '../../../../types';
import { dbService } from '../../../../services/db/indexedDB';

export function useSaveSystem() {
  const [autosaveList, setAutosaveList] = useState<SaveFile[]>([]);
  const [manualSaveList, setManualSaveList] = useState<SaveFile[]>([]);
  const [initialSaveList, setInitialSaveList] = useState<SaveFile[]>([]);
  const [activeSaveTab, setActiveSaveTab] = useState<'manual' | 'autosave' | 'history' | 'initial'>('manual');
  const [isSaving, setIsSaving] = useState(false);

  const loadSaveLists = useCallback(async () => {
    try {
        const saves = await dbService.getAllSaves();
        setAutosaveList(saves.filter(s => s.id.startsWith('autosave-')).sort((a,b) => b.updatedAt - a.updatedAt));
        setManualSaveList(saves.filter(s => s.id.startsWith('manual-')).sort((a,b) => b.updatedAt - a.updatedAt));
        setInitialSaveList(saves.filter(s => s.id.startsWith('initial-')).sort((a,b) => b.updatedAt - a.updatedAt));
    } catch (err) {
        console.error("Error loading save lists:", err);
    }
  }, []);

  const handleDeleteSave = useCallback(async (id: string) => {
      try {
          await dbService.deleteSave(id);
          await loadSaveLists();
      } catch (err) {
          console.error("Failed to delete save", err);
      }
  }, [loadSaveLists]);

  return {
    autosaveList,
    manualSaveList,
    initialSaveList,
    activeSaveTab,
    setActiveSaveTab,
    isSaving,
    setIsSaving,
    loadSaveLists,
    handleDeleteSave
  };
}
