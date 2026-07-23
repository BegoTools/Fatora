import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { BUILTIN_SECTORS, parseCustomSectorProfile } from '@/services/sectors';
import type { SectorTypeId, SectorProfile } from '@/types';
import { Store, Check, Upload, Layers } from 'lucide-react';

export function SectorProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, dispatch, showToast } = useApp();
  const currentProfile = state.data.sectorProfile || BUILTIN_SECTORS.general;

  const [selectedId, setSelectedId] = useState<SectorTypeId>(currentProfile.id);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonTab, setShowJsonTab] = useState(false);

  if (!isOpen) return null;

  const handleSelectSector = (profile: SectorProfile) => {
    dispatch({ type: 'SET_SECTOR_PROFILE', payload: profile });
    showToast(`تمت تهيئة النظام على بروفايل: ${profile.nameAr}`, 'success');
    onClose();
  };

  const handleImportJson = () => {
    const parsed = parseCustomSectorProfile(jsonInput);
    if (!parsed) {
      showToast('ملف JSON غير صالح أو يفتقد للحقول المطلوبة', 'error');
      return;
    }
    handleSelectSector(parsed);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl text-right">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">تهيئة قطاع النشاط التجاري (Vertical Templates)</h3>
              <p className="text-xs text-gray-500">تخصيص الحقول والتنبیهات تلقائيًا حسب نوع نشاطك التجاري</p>
            </div>
          </div>
          <button
            onClick={() => setShowJsonTab(!showJsonTab)}
            className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{showJsonTab ? 'القطاعات المدمجة' : 'استيراد قطاع JSON'}</span>
          </button>
        </div>

        {!showJsonTab ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {Object.values(BUILTIN_SECTORS).map(sec => {
              const isCurrent = currentProfile.id === sec.id;
              return (
                <div
                  key={sec.id}
                  onClick={() => setSelectedId(sec.id)}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between space-y-2 ${
                    selectedId === sec.id
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>{sec.nameAr}</span>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                        نشط حاليًا
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{sec.descriptionAr}</p>
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-200/60 text-[11px] text-gray-600">
                    {sec.showColorSize && <span className="bg-white px-1.5 py-0.5 border rounded">مقاسات وألوان</span>}
                    {sec.showWeightScaleBarcode && <span className="bg-white px-1.5 py-0.5 border rounded">باركود ميزان</span>}
                    {sec.showSerialTracking && <span className="bg-white px-1.5 py-0.5 border rounded">سيريال أجهزة</span>}
                    {sec.showExpiryDate && <span className="bg-white px-1.5 py-0.5 border rounded">صلاحية الأصناف</span>}
                    {sec.showMaintenanceModule && <span className="bg-white px-1.5 py-0.5 border rounded">ورش وصيانة</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-gray-600">
              يمكنك استيراد بروفايل قطاع مخصص عبر لصق كائن JSON الذي يحتوي على الإعدادات المطلوبة:
            </p>
            <textarea
              rows={6}
              placeholder='{"id":"custom_store","nameAr":"قطاع مخصص","showColorSize":true}'
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              className="w-full font-mono text-xs border rounded-xl p-3 bg-gray-50"
            />
            <button
              onClick={handleImportJson}
              className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
            >
              تحميل وتفعيل القطاع المخصص
            </button>
          </div>
        )}

        {!showJsonTab && (
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl text-sm">
              إلغاء
            </button>
            <button
              onClick={() => handleSelectSector(BUILTIN_SECTORS[selectedId])}
              className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>تطبيق وتفعيل البروفايل</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
