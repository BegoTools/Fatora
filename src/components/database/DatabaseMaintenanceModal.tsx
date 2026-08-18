import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusTrap } from '@/components/ui/FocusTrap';
import { useApp } from '@/context/AppContext';
import { clearTransactionsOnly, resetEntireDatabase } from '@/services/databaseMaintenance';
import { Database, AlertOctagon, RefreshCw, Trash2 } from 'lucide-react';

export function DatabaseMaintenanceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, dispatch, showToast } = useApp();
  const { t, i18n } = useTranslation();
  const [confirmText, setConfirmText] = useState('');
  const [mode, setMode] = useState<'transactions' | 'entire' | null>(null);

  if (!isOpen) return null;

  const handleExecute = () => {
    if (confirmText !== t('database.confirmWord')) {
      showToast(t('database.typeConfirmToStart'), 'error');
      return;
    }

    if (mode === 'transactions') {
      const cleaned = clearTransactionsOnly(state.data);
      dispatch({ type: 'SET_STATE', payload: cleaned });
      showToast(t('database.transactionsCleared'), 'success');
    } else if (mode === 'entire') {
      const fresh = resetEntireDatabase();
      dispatch({ type: 'SET_STATE', payload: fresh });
      showToast(t('database.factoryResetSuccess'), 'success');
    }

    setMode(null);
    setConfirmText('');
    onClose();
  };

  return (
    <FocusTrap>
    <div role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${i18n.language === 'ar' ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('database.maintenanceTools')}</h3>
            <p className="text-xs text-gray-500">{t('database.maintenanceSubtitle')}</p>
          </div>
        </div>

        {!mode ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode('transactions')}
              className="w-full p-4 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition text-right space-y-1"
            >
              <div className="font-bold text-amber-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                <span>مسح الحركات والعمليات المالية فقط (سنة مالية جديدة)</span>
              </div>
              <p className="text-xs text-amber-700">
                {t('database.clearTransactionsDesc')}
              </p>
            </button>

            <button
              onClick={() => setMode('entire')}
              className="w-full p-4 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 transition text-right space-y-1"
            >
              <div className="font-bold text-rose-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>تصفير وإعادة ضبط المصنع الشامل (حذف الكل)</span>
              </div>
              <p className="text-xs text-rose-700">
                {t('database.factoryResetDesc')}
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-rose-100/70 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2 text-xs">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                {t('database.warningIrreversible')}
              </span>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                {t('database.typeWord')} <span className="font-bold text-rose-600">"{t('database.confirmWord')}"</span> {t('database.toContinue')}:
              </label>
              <input
                type="text"
                placeholder={`اكتب "${t('database.confirmWord')}" هنا`}
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-center font-bold text-base"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <button
            onClick={() => {
              setMode(null);
              onClose();
            }}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl text-sm"
          >
            إلغاء
          </button>
          {mode && (
            <button
              onClick={handleExecute}
              className="px-5 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-xl text-sm font-bold transition"
            >
              {t('database.confirmExecution')}
            </button>
          )}
        </div>
      </div>
    </div>
    </FocusTrap>
  );
}
