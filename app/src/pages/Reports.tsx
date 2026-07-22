import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, BarChart3, TrendingUp, Package, Users, Calendar } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#00355f', '#059669', '#D97706', '#DC2626', '#6366F1', '#8B5CF6'];

export function Reports() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state } = useApp();
  const { salesInvoices, items, purchaseInvoices, employees, payrollRecords } = state.data;

  const [reportType, setReportType] = useState<'sales' | 'inventory' | 'financial' | 'hr'>('sales');
  const [dateFrom, setDateFrom] = useState('2025-01-01');
  const [dateTo, setDateTo] = useState('2025-12-31');

  const formatCurrency = (val: number) => `${val.toLocaleString()} ${state.data.company.currencySymbol}`;

  // Filter by date range
  const filteredSales = salesInvoices.filter(s => s.createdAt >= dateFrom && s.createdAt <= dateTo + 'T23:59:59');
  const filteredPurchases = purchaseInvoices.filter(p => p.createdAt >= dateFrom && p.createdAt <= dateTo + 'T23:59:59');

  // Sales report data
  const salesByMonth = useMemo(() => {
    const months: Record<string, { sales: number; purchases: number; profit: number }> = {};
    for (let i = 0; i < 12; i++) {
      months[t(`common.${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][i]}`)] = { sales: 0, purchases: 0, profit: 0 };
    }
    filteredSales.forEach(s => {
      const m = new Date(s.createdAt).getMonth();
      const key = t(`common.${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][m]}`);
      months[key].sales += s.total;
    });
    filteredPurchases.forEach(p => {
      const m = new Date(p.createdAt).getMonth();
      const key = t(`common.${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][m]}`);
      months[key].purchases += p.total;
    });
    Object.keys(months).forEach(k => {
      months[k].profit = months[k].sales - months[k].purchases;
    });
    return Object.entries(months).map(([name, data]) => ({ name, ...data }));
  }, [filteredSales, filteredPurchases, t]);

  // Top selling items
  const itemSalesMap: Record<string, { name: string; nameAr: string; quantity: number; revenue: number }> = {};
  filteredSales.forEach(inv => {
    inv.items.forEach(item => {
      if (!itemSalesMap[item.itemId]) {
        const fullItem = items.find(i => i.id === item.itemId);
        itemSalesMap[item.itemId] = { name: fullItem?.name || item.itemName, nameAr: fullItem?.nameAr || '', quantity: 0, revenue: 0 };
      }
      itemSalesMap[item.itemId].quantity += item.quantity;
      itemSalesMap[item.itemId].revenue += item.total;
    });
  });
  const topItems = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Inventory summary
  const inventoryValue = items.reduce((sum, i) => sum + i.purchasePrice * i.stockQuantity, 0);
  const inventoryRetailValue = items.reduce((sum, i) => sum + i.salePrice * i.stockQuantity, 0);
  const lowStockItems = items.filter(i => i.stockQuantity <= i.minStockLevel && i.stockQuantity > 0);
  const outOfStockItems = items.filter(i => i.stockQuantity === 0);

  // HR data
  const departmentCounts: Record<string, number> = {};
  employees.forEach(e => { departmentCounts[e.department] = (departmentCounts[e.department] || 0) + 1; });
  const deptChartData = Object.entries(departmentCounts).map(([name, value]) => ({ name, value }));

  const totalPayroll = payrollRecords.reduce((sum, p) => sum + p.netSalary, 0);

  const reportCards = [
    { id: 'sales', label: t('reports.sales'), icon: <TrendingUp size={18} />, color: 'bg-primary/10 text-primary' },
    { id: 'inventory', label: t('reports.inventory'), icon: <Package size={18} />, color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' },
    { id: 'financial', label: t('reports.financial'), icon: <BarChart3 size={18} />, color: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 dark:text-indigo-400' },
    { id: 'hr', label: t('reports.hr'), icon: <Users size={18} />, color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reportCards.map(card => (
          <button
            key={card.id}
            onClick={() => setReportType(card.id as typeof reportType)}
            className={`p-4 rounded-xl border transition-all ${reportType === card.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card hover:shadow-sm'}`}
          >
            <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-2`}>
              {card.icon}
            </div>
            <p className="text-sm font-medium text-foreground">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className={`bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Calendar size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('reports.fromDate')}</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm text-muted-foreground">{t('reports.toDate')}</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
        </div>
        <button className={`flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
          <Download size={14} /> {t('common.export')}
        </button>
      </div>

      {/* Sales Report */}
      {reportType === 'sales' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('reports.salesSummary')}</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(filteredSales.reduce((s, i) => s + i.total, 0))}</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredSales.length} {t('sales.invoices')}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('purchases.orders')}</p>
              <p className="text-2xl font-bold text-primary font-mono mt-1">{formatCurrency(filteredPurchases.reduce((s, i) => s + i.total, 0))}</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredPurchases.length} {t('purchases.orders')}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('common.profit')}</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">{formatCurrency(filteredSales.reduce((s, i) => s + i.total, 0) - filteredPurchases.reduce((s, i) => s + i.total, 0))}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('common.margin')}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">{t('reports.salesSummary')}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="sales" fill="#00355f" radius={[4, 4, 0, 0]} name={t('common.sales')} />
                    <Bar dataKey="purchases" fill="#DC2626" radius={[4, 4, 0, 0]} name={t('common.purchases')} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">{t('reports.bestSellers')}</h3>
              <div className="space-y-3">
                {topItems.map((item, idx) => {
                  const maxRevenue = topItems[0]?.revenue || 1;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="text-foreground font-medium truncate">{isRTL ? item.nameAr : item.name}</span>
                        <span className="font-mono text-muted-foreground">{formatCurrency(item.revenue)}</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(item.revenue / maxRevenue) * 100}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {reportType === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('common.total')} {t('common.items')}</p>
              <p className="text-2xl font-bold text-foreground font-mono mt-1">{items.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('common.inventoryValue')}</p>
              <p className="text-2xl font-bold text-primary font-mono mt-1">{formatCurrency(inventoryValue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('common.retailValue')}</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(inventoryRetailValue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('common.potentialProfit')}</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">{formatCurrency(inventoryRetailValue - inventoryValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">{t('common.lowStock')}</h3>
              {lowStockItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">{t('common.allStockOk')}</p> : (
                <div className="space-y-2">
                  {lowStockItems.map(item => (
                    <div key={item.id} className={`flex justify-between items-center p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-amber-800 dark:text-amber-200 font-medium">{isRTL ? item.nameAr : item.name}</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">{item.stockQuantity} / {item.minStockLevel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">{t('common.outOfStock')}</h3>
              {outOfStockItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">{t('common.noOutOfStock')}</p> : (
                <div className="space-y-2">
                  {outOfStockItems.map(item => (
                    <div key={item.id} className={`flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/50 rounded-lg text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-red-800 dark:text-red-200 font-medium">{isRTL ? item.nameAr : item.name}</span>
                      <span className="font-mono text-red-600 dark:text-red-400">0</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financial Report */}
      {reportType === 'financial' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-foreground mb-4">{t('reports.incomeStatement')}</h3>
            <div className="space-y-2 max-w-md">
              <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('common.revenue')}</span>
                <span className="font-mono font-medium">{formatCurrency(filteredSales.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('common.costOfGoods')}</span>
                <span className="font-mono text-red-600 dark:text-red-400">-{formatCurrency(filteredPurchases.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              <div className={`flex justify-between text-sm border-t border-border pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="font-medium text-foreground">{t('common.grossProfit')}</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(filteredSales.reduce((s, i) => s + i.subtotal, 0) - filteredPurchases.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('common.operatingExpenses')}</span>
                <span className="font-mono text-red-600 dark:text-red-400">-{formatCurrency(payrollRecords.reduce((s, p) => s + p.netSalary, 0))}</span>
              </div>
              <div className={`flex justify-between text-base font-bold border-t border-foreground/20 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-foreground">{t('common.netIncome')}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(
                  filteredSales.reduce((s, i) => s + i.subtotal, 0) -
                  filteredPurchases.reduce((s, i) => s + i.subtotal, 0) -
                  payrollRecords.reduce((s, p) => s + p.netSalary, 0)
                )}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HR Report */}
      {reportType === 'hr' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('hr.employees')}</p>
              <p className="text-2xl font-bold text-foreground font-mono mt-1">{employees.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('reports.payrollReport')}</p>
              <p className="text-2xl font-bold text-primary font-mono mt-1">{formatCurrency(totalPayroll)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-xs text-muted-foreground uppercase">{t('common.avgSalary')}</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(employees.length > 0 ? employees.reduce((s, e) => s + e.salary, 0) / employees.length : 0)}</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-foreground mb-4">{t('hr.fields.department')} {t('common.distribution')}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deptChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {deptChartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
