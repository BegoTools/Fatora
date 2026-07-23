import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { performCashAudit } from '@/services/cashAudit';
import { DollarSign, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export function CashAuditModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, dispatch, showToast } = useApp();
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
      showToast('تم مطابقة الخزينة بنجاح (لا يوجد فرق بين الرصيد الدفتري والفعلي)', 'success');
    } else if (auditRecord.status === 'deficit') {
      showToast(`تم تسجيل عجز بقيمة ${Math.abs(auditRecord.difference)} ج.م وإنشاء قيد تسوية تلقائي`, 'warning');
    } else {
      showToast(`تم تسجيل زيادة بقيمة ${auditRecord.difference} ج.م وإنشاء قيد إيداع تلقائي`, 'info');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl text-right">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">شاشة جرد ومطابقة الخزينة</h3>
            <p className="text-xs text-gray-500">مقارنة النقدية الفعلية بالرصيد الدفتري وتسوية الفروقات آليًا</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-gray-700 font-medium mb-1">اختر الخزينة / الصندوق</label>
            <select
              value={selectedTreasuryId}
              onChange={e => {
                setSelectedTreasuryId(e.target.value);
                const t = treasuries.find(tr => tr.id === e.target.value);
                if (t) setActualCashBalance(t.balance);
              }}
              className="w-full border rounded-xl p-2.5 bg-gray-50 text-sm outline-none"
            >
              {treasuries.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nameAr || t.name} (الرصيد الدفتري: {t.balance} ج.م)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">الرصيد الدفتري الحالي:</span>
              <span className="font-bold text-gray-900">{bookBalance} ج.م</span>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1 mt-2">النقدية الفعلية بالصندوق (بعد العد)</label>
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
              <span>الرصيد متطابق تمامًا</span>
            </div>
          ) : difference < 0 ? (
            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>عجز في الخزينة بمقدار: {Math.abs(difference)} ج.م</span>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 text-blue-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>زيادة غير مبررة في الخزينة بمقدار: {difference} ج.م</span>
            </div>
          )}

          <div>
            <label className="block text-gray-700 font-medium mb-1">ملاحظات الجرد</label>
            <input
              type="text"
              placeholder="سبب العجز أو الزيادة إن وجد..."
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
            <span>تطابق البيانات وتأكيد الجرد</span>
          </button>
        </div>
      </div>
    </div>
  );
}
