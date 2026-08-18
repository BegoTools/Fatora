import React, { createContext, useContext, useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { toast } from 'sonner';

interface SyncConfig {
  provider: 'github_gist' | 'none';
  githubToken?: string;
  gistId?: string;
  autoSync: boolean;
}

interface SyncContextType {
  config: SyncConfig;
  updateConfig: (config: Partial<SyncConfig>) => void;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: string | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const SYNC_CONFIG_KEY = 'easystore_sync_config';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const [config, setConfig] = useState<SyncConfig>(() => {
    const saved = localStorage.getItem(SYNC_CONFIG_KEY);
    return saved ? JSON.parse(saved) : { provider: 'none', autoSync: false };
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('easystore_last_sync'));

  const updateConfig = (newConfig: Partial<SyncConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(updated));
  };

  const syncNow = async () => {
    if (config.provider !== 'github_gist' || !config.githubToken || !config.gistId) {
      toast.error('لم يتم إعداد المزامنة السحابية بشكل صحيح.');
      return;
    }

    setIsSyncing(true);
    try {
      const currentStateJson = JSON.stringify(state.data, null, 2);
      
      const patchRes = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${config.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: "Easy Store ERP Cloud Backup",
          files: {
            "easystore_data.json": {
              content: currentStateJson
            }
          }
        })
      });

      if (!patchRes.ok) throw new Error('فشل رفع البيانات إلى السحابة');

      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('easystore_last_sync', now);
      toast.success('تمت المزامنة السحابية بنجاح! ☁️');

    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || 'حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!config.autoSync || config.provider !== 'github_gist') return;
    const interval = setInterval(() => { syncNow(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, state.data]);

  return (
    <SyncContext.Provider value={{ config, updateConfig, syncNow, isSyncing, lastSyncTime }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
};
