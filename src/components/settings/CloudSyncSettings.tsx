import { useTranslation } from 'react-i18next';
import { Cloud, CheckCircle, RefreshCw } from 'lucide-react';
import { useSync } from '@/context/SyncContext';

export function CloudSyncSettings() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { config, updateConfig, syncNow, isSyncing, lastSyncTime } = useSync();

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
          <Cloud size={20} className="text-primary" />
          {isRTL ? 'المزامنة السحابية المجانية (Hybrid Cloud)' : 'Free Cloud Sync (Hybrid Cloud)'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isRTL 
            ? 'اربط نظامك بـ GitHub Gist للحصول على مزامنة سحابية مجانية تماماً كخدمات الـ SaaS بدون أي اشتراكات!'
            : 'Connect your system to GitHub Gist for totally free cloud sync like SaaS without any subscriptions!'}
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {isRTL ? 'مزود الخدمة السحابية' : 'Cloud Provider'}
          </label>
          <select
            value={config.provider}
            onChange={(e) => updateConfig({ provider: e.target.value as 'none' | 'github_gist' })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="none">{isRTL ? 'معطل (تخزين محلي فقط)' : 'Disabled (Local only)'}</option>
            <option value="github_gist">GitHub Gist (Free)</option>
          </select>
        </div>

        {config.provider === 'github_gist' && (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                GitHub Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={config.githubToken || ''}
                onChange={(e) => updateConfig({ githubToken: e.target.value })}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? 'قم بإنشاء Token من حسابك في GitHub مع صلاحية (gist).' : 'Create a token from your GitHub account with (gist) scope.'}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Gist ID
              </label>
              <input
                type="text"
                value={config.gistId || ''}
                onChange={(e) => updateConfig({ gistId: e.target.value })}
                placeholder="e.g. 1a2b3c4d5e..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? 'قم بإنشاء Gist سري يحتوي على ملف easystore_data.json والصق الـ ID هنا.' : 'Create a secret Gist with an easystore_data.json file and paste the ID here.'}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
              <input
                type="checkbox"
                id="autoSync"
                checked={config.autoSync}
                onChange={(e) => updateConfig({ autoSync: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
              />
              <label htmlFor="autoSync" className="text-sm font-medium text-foreground">
                {isRTL ? 'مزامنة تلقائية (كل 5 دقائق)' : 'Auto sync (every 5 mins)'}
              </label>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {lastSyncTime ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={14} /> 
                    {isRTL ? 'آخر مزامنة:' : 'Last sync:'} {new Date(lastSyncTime).toLocaleString()}
                  </span>
                ) : (
                  <span>{isRTL ? 'لم تتم أي مزامنة بعد' : 'No syncs yet'}</span>
                )}
              </div>
              <button
                onClick={() => syncNow()}
                disabled={isSyncing || !config.githubToken || !config.gistId}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                {isRTL ? 'زامن الآن' : 'Sync Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
