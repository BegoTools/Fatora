import { useTranslation } from 'react-i18next';
import {
  Package, Users,
  ShoppingCart, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageAIInput } from '@/components/ai/PageAIInput';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#00355f', '#059669', '#D97706', '#DC2626', '#6366F1', '#8B5CF6'];

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state } = useApp();
  const { items, salesInvoices, employees, notifications } = state.data;

  const lowStockItems = items.filter(i => i.stockQuantity <= i.minStockLevel && i.stockQuantity > 0).length;
  const outOfStockItems = items.filter(i => i.stockQuantity === 0).length;
  const activeItems = items.filter(i => i.isActive).length;

  const today = new Date().toISOString().split('T')[0];
  const todaySales = salesInvoices.filter(s => s.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

  const activeStaff = employees.filter(e => e.isActive).length;
  const unreadAlerts = notifications.filter(n => !n.isRead && n.type === 'warning').length;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const salesByDay = last7Days.map(date => {
    const daySales = salesInvoices.filter(s => s.createdAt.startsWith(date));
    return {
      day: new Date(date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'short' }),
      sales: daySales.reduce((sum, s) => sum + s.total, 0),
      count: daySales.length,
    };
  });

  const salesByCategory = state.data.categories
    .filter(c => !c.parentId)
    .map(cat => {
      const catItems = items.filter(i => {
        if (i.categoryId === cat.id) return true;
        const subCats = state.data.categories.filter(sc => sc.parentId === cat.id);
        return subCats.some(sc => sc.id === i.categoryId);
      });
      const catRevenue = salesInvoices.reduce((sum, inv) => {
        const catSaleItems = inv.items.filter(si => catItems.some(ci => ci.id === si.itemId));
        return sum + catSaleItems.reduce((s, ci) => s + ci.total, 0);
      }, 0);
      return { name: isRTL ? cat.nameAr : cat.name, value: catRevenue };
    })
    .filter(c => c.value > 0);

  const itemSalesMap: Record<string, { name: string; nameAr: string; quantity: number; revenue: number }> = {};
  salesInvoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!itemSalesMap[item.itemId]) {
        const fullItem = items.find(i => i.id === item.itemId);
        itemSalesMap[item.itemId] = {
          name: fullItem?.name || item.itemName,
          nameAr: fullItem?.nameAr || item.itemName,
          quantity: 0,
          revenue: 0,
        };
      }
      itemSalesMap[item.itemId].quantity += item.quantity;
      itemSalesMap[item.itemId].revenue += item.total;
    });
  });

  const topItems = Object.values(itemSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const kpiCards = [
    {
      title: t('dashboard.kpi.todaySales'),
      value: todayRevenue.toLocaleString(),
      suffix: ` ${state.data.company.currencySymbol}`,
      change: '+12%',
      icon: <ShoppingCart size={22} className="text-primary" />,
      iconBg: 'bg-primary/10',
      trend: 'up' as const,
    },
    {
      title: t('dashboard.kpi.inventoryItems'),
      value: activeItems.toString(),
      suffix: ` ${t('common.items')}`,
      change: `${lowStockItems} ${t('common.lowStock')}`,
      icon: <Package size={22} className="text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
      trend: 'neutral' as const,
    },
    {
      title: t('dashboard.kpi.lowStockAlerts'),
      value: (lowStockItems + outOfStockItems).toString(),
      suffix: '',
      change: `${outOfStockItems} ${t('common.outOfStock')}`,
      icon: <AlertTriangle size={22} className="text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/50',
      trend: 'down' as const,
    },
    {
      title: t('dashboard.kpi.activeStaff'),
      value: activeStaff.toString(),
      suffix: ` / ${employees.length}`,
      change: `${employees.filter(e => !e.isActive).length} ${t('common.inactive')}`,
      icon: <Users size={22} className="text-indigo-500 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/50',
      trend: 'neutral' as const,
    },
  ];

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString()} ${state.data.company.currencySymbol}`;
  };

  return (
    <div className="space-y-6">
      <PageAIInput contextType={isRTL ? 'الرئيسية' : 'Dashboard'} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1 font-mono">
                  {kpi.value}
                  <span className="text-sm font-normal text-muted-foreground">{kpi.suffix}</span>
                </p>
                <div className={`flex items-center gap-1 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {kpi.trend === 'up' && <ArrowUpRight size={14} className="text-emerald-600 dark:text-emerald-400" />}
                  {kpi.trend === 'down' && <ArrowDownRight size={14} className="text-red-600 dark:text-red-400" />}
                  <span className={`text-xs font-medium ${kpi.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : kpi.trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {kpi.change}
                  </span>
                </div>
              </div>
              <div className={`w-11 h-11 rounded-lg ${kpi.iconBg} flex items-center justify-center flex-shrink-0`}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('dashboard.charts.revenueOverview')}</h3>
              <p className="text-xs text-muted-foreground">{t('common.thisWeek')}</p>
            </div>
            <select className="text-xs border border-border rounded-lg px-2 py-1 bg-card focus:outline-none focus:ring-2 focus:ring-primary">
              <option>{t('common.thisWeek')}</option>
              <option>{t('common.thisMonth')}</option>
              <option>{t('common.thisYear')}</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), t('common.total')]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                />
                <Bar dataKey="sales" fill="#00355f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('dashboard.charts.salesByCategory')}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {salesByCategory.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {salesByCategory.slice(0, 4).map((cat, idx) => (
              <div key={idx} className={`flex items-center justify-between text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-mono font-medium text-foreground">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('dashboard.charts.topSellingItems')}</h3>
          <div className="space-y-3">
            {topItems.map((item, idx) => {
              const maxRevenue = topItems[0]?.revenue || 1;
              const pct = (item.revenue / maxRevenue) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className={`flex items-center justify-between text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-foreground font-medium truncate flex-1">{isRTL ? item.nameAr : item.name}</span>
                    <span className="text-muted-foreground font-mono ml-2">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{item.quantity} {t('common.sold')}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h3 className="text-base font-semibold text-foreground">{t('dashboard.alerts.title')}</h3>
            <span className="text-xs bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              {unreadAlerts} {t('common.pending')}
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notifications.filter(n => !n.isRead).slice(0, 5).map(notif => (
              <div
                key={notif.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                  notif.type === 'error' ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400' :
                  notif.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' :
                  'bg-primary/10 text-primary'
                }`}>
                  <AlertTriangle size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{isRTL ? notif.titleAr : notif.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{isRTL ? notif.messageAr : notif.message}</p>
                </div>
              </div>
            ))}
            {notifications.filter(n => !n.isRead).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('common.all')} {t('common.completed')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className={`px-5 py-4 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="text-base font-semibold text-foreground">{t('dashboard.recent.sales')}</h3>
          <button className="text-xs text-primary font-medium hover:underline">{t('dashboard.alerts.viewAll')}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('sales.invoiceNumber')}</th>
                <th className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.customer')}</th>
                <th className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.items')}</th>
                <th className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.total')}</th>
                <th className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.payment')}</th>
                <th className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {salesInvoices.slice(-5).reverse().map(inv => (
                <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-primary font-medium">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-foreground">{inv.customerName}</td>
                  <td className="px-5 py-3 text-muted-foreground">{inv.items.length} {t('common.items')}</td>
                  <td className="px-5 py-3 font-mono font-medium text-foreground">{formatCurrency(inv.total)}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {t(`common.${inv.paymentMethod}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      inv.paymentStatus === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' :
                      inv.paymentStatus === 'partial' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                      'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                    }`}>
                      {t(`common.${inv.paymentStatus}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
