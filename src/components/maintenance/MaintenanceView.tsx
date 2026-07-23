import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { createMaintenanceReceipt, getTechnicianLedger } from '@/services/maintenance';
import type { MaintenanceStatus } from '@/types';
import { Wrench, Plus, Search, UserCheck } from 'lucide-react';

export function MaintenanceView() {
  const { state, dispatch, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'receipts' | 'technicians'>('receipts');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [reportedFault, setReportedFault] = useState('');
  const [expectedCost, setExpectedCost] = useState(0);
  const [depositPaid, setDepositPaid] = useState(0);
  const [technicianName, setTechnicianName] = useState('');
  const [technicianCommission, setTechnicianCommission] = useState(0);
  const [expectedDeliveryDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );

  const receipts = state.data.maintenanceReceipts || [];
  const technicianLedger = getTechnicianLedger(state.data);

  const filteredReceipts = receipts.filter(r =>
    r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.technicianName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !deviceName || !reportedFault) {
      showToast('يرجى ملء البيانات الرئيسية لجهاز الصيانة', 'error');
      return;
    }

    const { receipt } = createMaintenanceReceipt(state.data, {
      customerName,
      customerPhone,
      deviceName,
      reportedFault,
      expectedCost,
      depositPaid,
      technicianName: technicianName || 'فني الصيانة',
      technicianCommission,
      expectedDeliveryDate,
    });

    dispatch({ type: 'ADD_MAINTENANCE_RECEIPT', payload: receipt });
    showToast(`تمت إضافة فاتورة استلام الصيانة ${receipt.receiptNumber} بنجاح`, 'success');
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeviceName('');
    setReportedFault('');
    setExpectedCost(0);
    setDepositPaid(0);
    setTechnicianName('');
    setTechnicianCommission(0);
  };

  const handleStatusChange = (id: string, status: MaintenanceStatus) => {
    dispatch({ type: 'UPDATE_MAINTENANCE_STATUS', payload: { id, status } });
    showToast('تم تحديث حالة الصيانة بنجاح', 'success');
  };

  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'received':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">مستلم</span>;
      case 'under_inspection':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">قيد الفحص</span>;
      case 'ready':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">جاهز للتسليم</span>;
      case 'delivered':
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">تم التسليم</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-medium">ملغى</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 dir-rtl text-right">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">إدارة الورش والصيانة</h1>
            <p className="text-sm text-gray-500">متابعة فواتير استلام الأجهزة وأجور الفنيين وحالات الإصلاح</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
        >
          <Plus className="w-4 h-4" />
          <span>إصدار فاتورة صيانة جديد</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'receipts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          فواتير الصيانة ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab('technicians')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'technicians'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          كشف حساب الفنيين والصنايعية ({technicianLedger.length})
        </button>
      </div>

      {activeTab === 'receipts' ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="البحث برقم الفاتورة، اسم العميل، اسم الجهاز، أو الفني..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          {/* Receipts Table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                  <tr>
                    <th className="p-4 font-semibold">رقم الفاتورة</th>
                    <th className="p-4 font-semibold">العميل</th>
                    <th className="p-4 font-semibold">الجهاز والعطل</th>
                    <th className="p-4 font-semibold">الفني المسؤول</th>
                    <th className="p-4 font-semibold">التكلفة والمدفوع</th>
                    <th className="p-4 font-semibold">الحالة</th>
                    <th className="p-4 font-semibold">تغيير الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        لا توجد فواتير صيانة مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-4 font-semibold text-blue-600">{r.receiptNumber}</td>
                        <td className="p-4">
                          <div className="font-medium text-gray-900">{r.customerName}</div>
                          <div className="text-xs text-gray-500">{r.customerPhone}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-900">{r.deviceName}</div>
                          <div className="text-xs text-rose-600">العطل: {r.reportedFault}</div>
                        </td>
                        <td className="p-4 text-gray-700">{r.technicianName}</td>
                        <td className="p-4">
                          <div className="text-gray-900 font-medium">{r.expectedCost} ج.م</div>
                          <div className="text-xs text-emerald-600">العربون: {r.depositPaid} ج.م</div>
                        </td>
                        <td className="p-4">{getStatusBadge(r.status)}</td>
                        <td className="p-4">
                          <select
                            value={r.status}
                            onChange={e => handleStatusChange(r.id, e.target.value as MaintenanceStatus)}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                          >
                            <option value="received">مستلم</option>
                            <option value="under_inspection">قيد الفحص</option>
                            <option value="ready">جاهز للتسليم</option>
                            <option value="delivered">تم التسليم</option>
                            <option value="cancelled">ملغى</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Technicians Ledger Tab */
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>كشف حساب أجور وعمولات الفنيين والصنايعية</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicianLedger.map(tech => (
              <div key={tech.technicianName} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="font-bold text-gray-900 text-base">{tech.technicianName}</div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>إجمالي الأجهزة:</span>
                  <span className="font-semibold">{tech.totalJobs}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>الأجهزة المكتملة:</span>
                  <span className="font-semibold text-emerald-600">{tech.completedJobs}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200 font-bold text-blue-700">
                  <span>مجموع المستحقات:</span>
                  <span>{tech.totalCommissions} ج.م</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Maintenance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 text-right">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">إصدار فاتورة استلام صيانة جديدة</h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">اسم العميل *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">اسم الجهاز والنوع *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: لاب توب ديل G15"
                    value={deviceName}
                    onChange={e => setDeviceName(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">الفني المسؤول</label>
                  <input
                    type="text"
                    placeholder="اسم الصنايعي"
                    value={technicianName}
                    onChange={e => setTechnicianName(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">العطل المُبلَّغ عنه *</label>
                <textarea
                  required
                  rows={2}
                  value={reportedFault}
                  onChange={e => setReportedFault(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">التكلفة التقديرية</label>
                  <input
                    type="number"
                    value={expectedCost}
                    onChange={e => setExpectedCost(parseFloat(e.target.value) || 0)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">العربون المدفوع</label>
                  <input
                    type="number"
                    value={depositPaid}
                    onChange={e => setDepositPaid(parseFloat(e.target.value) || 0)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">عمولة الفني</label>
                  <input
                    type="number"
                    value={technicianCommission}
                    onChange={e => setTechnicianCommission(parseFloat(e.target.value) || 0)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-lg">
                  حفظ الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
