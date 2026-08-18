import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusTrap } from '@/components/ui/FocusTrap';
import { useApp } from '@/context/AppContext';
import { performCashAudit } from '@/services/cashAudit';
import { DollarSign, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export function CashAuditModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, dispatch, showToast } = useApp();
  const { t, i18n } = useTranslation();
  const treasuries = state.data.treasuryAccounts || [];

  const [selectedTreasuryId, setSelectedTreasuryId] = useState(treasuries[0]?.id || '');
  const [actualCashBalance, setActualCashBalance] = useState<number>(0);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const currentTreasury = treasuries.find(t => t.id === selectedTreasuryId) || treasuries[0];
  const bookBalance = currentTreasury ? currentTreasury.balance : 0;
  const difference = actualCashBalance - bookBalance;

  const handleAudit = () => {
    if (!currentTreasury) return;

    const { updatedState, auditRecord } = performCashAudit(state.data, {
      treasuryAccount: currentTreasury,
      actualCashBalance,
      notes,
    });

    dispatch({ type: 'SET_STATE', payload: updatedState });

    if (auditRecord.status === 'matched') {
      showToast(t('cashAudit.matchedSuccess'), 'success');
    } else if (auditRecord.status === 'deficit') {
      showToast(t('cashAudit.deficitRecorded', { amount: Math.abs(auditRecord.difference) }), 'warning');
    } else {
      showToast(t('cashAudit.surplusRecorded', { amount: auditRecord.difference }), 'info');
    }

    onClose();
  };

  return (
    <FocusTrap>
    <div role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${i18n.language === 'ar' ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('cashAudit.title')}</h3>
            <p className="text-xs text-gray-500">{t('cashAudit.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-gray-700 font-medium mb-1">{t('cashAudit.selectTreasury')}</label>
            <select
              value={selectedTreasuryId}
              onChange={e => {
                setSelectedTreasuryId(e.target.value);
                const t = treasuries.find(tr => tr.id === e.target.value);
                if (t) setActualCashBalance(t.balance);
              }}
              className="w-full border rounded-xl p-2.5 bg-gray-50 text-sm outline-none"
            >
              {treasuries.map(treasury => (
                <option key={treasury.id} value={treasury.id}>
                  {treasury.nameAr || treasury.name} ({t('cashAudit.bookBalance')}: {treasury.balance} {t('common.currency')})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('cashAudit.currentBookBalance')}:</span>
              <span className="font-bold text-gray-900">{bookBalance} {t('common.currency')}</span>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1 mt-2">{t('cashAudit.actualCashBalance')}</label>
              <input
                type="number"
                value={actualCashBalance}
                onChange={e => setActualCashBalance(parseFloat(e.target.value) || 0)}
                className="w-full border rounded-xl p-2.5 font-bold text-lg text-emerald-700 bg-white"
              />
            </div>
          </div>

          {/* Result Banner */}
          {difference === 0 ? (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t('cashAudit.balanceMatched')}</span>
            </div>
          ) : difference < 0 ? (
            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{t('cashAudit.deficitAmount')}: {Math.abs(difference)} {t('common.currency')}</span>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 text-blue-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>{t('cashAudit.surplusAmount')}: {difference} {t('common.currency')}</span>
            </div>
          )}

          <div>
            <label className="block text-gray-700 font-medium mb-1">{t('cashAudit.auditNotes')}</label>
            <input
              type="text"
              placeholder={t('cashAudit.notesPlaceholder')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border rounded-xl p-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl text-sm font-medium">
            إلغاء
          </button>
          <button
            onClick={handleAudit}
            className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t('cashAudit.confirmAudit')}</span>
          </button>
        </div>
      </div>
    </div>
    </FocusTrap>
  );
}
