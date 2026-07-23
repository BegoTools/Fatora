import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { clearTransactionsOnly, resetEntireDatabase } from '@/services/databaseMaintenance';
import { Database, AlertOctagon, RefreshCw, Trash2 } from 'lucide-react';

export function DatabaseMaintenanceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, dispatch, showToast } = useApp();
  const [confirmText, setConfirmText] = useState('');
  const [mode, setMode] = useState<'transactions' | 'entire' | null>(null);

  if (!isOpen) return null;

  const handleExecute = () => {
    if (confirmText !== 'تأكيد') {
      showToast('يرجى كتابة كلمة "تأكيد" للبدء بالعملية', 'error');
      return;
    }

    if (mode === 'transactions') {
      const cleaned = clearTransactionsOnly(state.data);
      dispatch({ type: 'SET_STATE', payload: cleaned });
      showToast('تم مسح الحركات المالية بنجاح مع الحفاظ على الأصناف والعملاء والموردين لبداية سنة مالية جديدة', 'success');
    } else if (mode === 'entire') {
      const fresh = resetEntireDatabase();
      dispatch({ type: 'SET_STATE', payload: fresh });
      showToast('تم إعادة ضبط المصنع ومسح جميع البيانات بنجاح', 'success');
    }

    setMode(null);
    setConfirmText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl text-right">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">أدوات تنظيف وصيانة قاعدة البيانات</h3>
            <p className="text-xs text-gray-500">إلغاء البيانات أو بدء دورة محاسبية وسنة مالية جديدة</p>
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
                يحذف جميع فواتير المبيعات، المشتريات، المرتجعات، والعمليات مع الحفاظ على الأصناف والعملاء والموردين.
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
                يقوم بحذف جميع البيانات من قاعدة البيانات بالكامل والبدء بنسخة نظيفة تمامًا.
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-rose-100/70 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2 text-xs">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                تحذير هام: هذه العملية نهائية ولا يمكن التراجع عنها إلا باستعادة نسخة احتياطية سابقة!
              </span>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                اكتب كلمة <span className="font-bold text-rose-600">"تأكيد"</span> للمتابعة:
              </label>
              <input
                type="text"
                placeholder='اكتب "تأكيد" هنا'
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
              تأكيد التنفيذ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
