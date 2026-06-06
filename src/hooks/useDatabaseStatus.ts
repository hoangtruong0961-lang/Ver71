import { useState, useEffect } from 'react';
import { dbService } from '../services/db/indexedDB';

type DBStatus = 'loading' | 'connected' | 'error';

export const useDatabaseStatus = () => {
  const [status, setStatus] = useState<DBStatus>('loading');
  const [hasSaves, setHasSaves] = useState<boolean>(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isConnected = await dbService.checkConnection();
        if (isConnected) {
            setStatus('connected');
            // Check for existing saves to enable "Continue" button
            const savesExist = await dbService.hasSaves();
            setHasSaves(savesExist);
        } else {
            setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    checkStatus();
  }, []);

  return { status, hasSaves };
};