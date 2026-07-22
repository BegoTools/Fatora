// ============================================================
// Easy Store ERP - سياق الترخيص (License Context)
// ------------------------------------------------------------
// يوفر حالة الترخيص للتطبيق ويقيّد الكتابة عند انتهاء الصلاحية.
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getLicenseInfo, activateLicense, deactivateLicense, getTrialDaysRemaining, type LicenseInfo } from '@/services/license';

interface LicenseContextValue {
  info: LicenseInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  activate: (key: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  deactivate: () => void;
  trialDaysLeft: number;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getLicenseInfo();
    setInfo(current);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = await getLicenseInfo();
      if (mounted) {
        setInfo(current);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const activate = useCallback(async (key: string) => {
    const result = await activateLicense(key);
    if (result.ok) {
      await refresh();
      return { ok: true as const };
    }
    return { ok: false as const, error: result.error };
  }, [refresh]);

  const deactivate = useCallback(() => {
    deactivateLicense();
    void refresh();
  }, [refresh]);

  const value: LicenseContextValue = {
    info,
    loading,
    refresh,
    activate,
    deactivate,
    trialDaysLeft: info ? getTrialDaysRemaining(info) : 0,
  };

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within a LicenseProvider');
  return ctx;
}
