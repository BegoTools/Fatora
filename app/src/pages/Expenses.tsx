import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Wallet, Trash2, Receipt, TrendingDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId } from '@/db';
import type { Transaction } from '@/types';

const EXPENSE_CATEGORIES = [
  'office', 'utilities', 'salaries', 'rent', 'supplies', 'marketing', 'maintenance', 'other',
];

export function Expenses() {
  const { state, dispatch } = useApp();
  const { can, user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const currency = state.data.company.currencySymbol || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [period, setPeriod] = useState<'all' | 'month' | 'today'>('month');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '', category: 'office', description: '', date: new Date().toISOString().slice(0, 10),
    accountId: state.data.treasuryAccounts[0]?.id || '',
  });

  const formatCurrency = (n: number) =>
    `${currency} ${n.toLocaleString(isRTL ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const expenses = useMemo(
    () => state.data.transactions
      .filter(tr => tr.type === 'expense')
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.data.transactions],
  );

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = now.toISOString().slice(0, 10);

  const filtered = useMemo(() => expenses.filter(tr => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !tr.description.toLowerCase().includes(q) && !tr.referenceNumber.toLowerCase().includes(q)) return false;
    if (categoryFilter !== 'all' && tr.category !== categoryFilter) return false;
    if (period === 'month' && !tr.date.startsWith(monthKey)) return false;
    if (period === 'today' && tr.date.slice(0, 10) !== todayKey) return false;
    return true;
  }), [expenses, searchQuery, categoryFilter, period, monthKey, todayKey]);

  const totalFiltered = filtered.reduce((s, tr) => s + tr.amount, 0);
  const totalMonth = expenses.filter(tr => tr.date.startsWith(monthKey)).reduce((s, tr) => s + tr.amount, 0);
  const topCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter(tr => tr.date.startsWith(monthKey)).forEach(tr => { map[tr.category] = (map[tr.category] || 0) + tr.amount; });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || '—';
  }, [expenses, monthKey]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      amount: '', category: 'office', description: '', date: new Date().toISOString().slice(0, 10),
      accountId: state.data.treasuryAccounts[0]?.id || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { alert(t('expenses.invalidAmount')); return; }
    if (!form.accountId) { alert(t('expenses.selectAccount')); return; }
    const account = state.data.treasuryAccounts.find(a => a.id === form.accountId);
    const newTr: Transaction = {
      id: editingId || generateId('tr'),
      accountId: form.accountId,
      accountName: account?.name || '',
      type: 'expense',
      amount,
      description: form.description.trim(),
      referenceNumber: `EXP-${Date.now()}`,
      category: form.category,
      date: new Date(form.date).toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: user?.name || '',
    };
    if (editingId) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: editingId });
    }
    dispatch({ type: 'ADD_TRANSACTION', payload: newTr });
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t('expenses.confirmDelete'))) return;
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
  };

  const accountName = (id: string) => state.data.treasuryAccounts.find(a => a.id === id)?.name || '—';

  const StatCard = ({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) => (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <h4 className="text-xl font-bold font-numeric text-foreground">{value}</h4>
      </div>
      <span className={`text-3xl opacity-20 ${accent}`}>{icon}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div>
          <h3 className="text-xl font-bold text-primary">{t('expenses.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('expenses.subtitle')}</p>
        </div>
        {can('expenses', 'create') && (
          <button onClick={openNew} className="flex items-center gap-2 bg-success text-success-foreground px-4 py-2.5 rounded-lg hover:brightness-110 transition-all font-medium text-sm">
            <Plus size={16} /> {t('expenses.newExpense')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label={t('expenses.periodTotal')} value={formatCurrency(totalFiltered)} icon={<Wallet />} accent="text-primary" />
        <StatCard label={t('expenses.monthTotal')} value={formatCurrency(totalMonth)} icon={<TrendingDown />} accent="text-destructive" />
        <StatCard label={t('expenses.topCategory')} value={t(`expenses.cat.${topCategory}`)} icon={<Receipt />} accent="text-secondary" />
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground" style={{ [isRTL ? 'right' : 'left']: '0.75rem' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-background"
            style={{ [isRTL ? 'paddingRight' : 'paddingLeft']: '2.25rem' }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-border rounded-lg py-2.5 px-3 bg-background text-sm focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t('common.all')} {t('expenses.category')}</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`expenses.cat.${c}`)}</option>)}
        </select>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as 'all' | 'month' | 'today')}
          className="border border-border rounded-lg py-2.5 px-3 bg-background text-sm focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t('common.all')}</option>
          <option value="month">{t('expenses.thisMonth')}</option>
          <option value="today">{t('expenses.today')}</option>
        </select>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-on-surface">
              <tr>
                <th className={`px-4 py-3 text-xs font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('expenses.date')}</th>
                <th className={`px-4 py-3 text-xs font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('expenses.category')}</th>
                <th className={`px-4 py-3 text-xs font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.description')}</th>
                <th className={`px-4 py-3 text-xs font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('expenses.account')}</th>
                <th className={`px-4 py-3 text-xs font-semibold ${isRTL ? 'text-left' : 'text-right'}`}>{t('expenses.amount')}</th>
                {can('expenses', 'delete') && <th className="px-4 py-3 text-center text-xs font-semibold">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={can('expenses', 'delete') ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">{t('expenses.empty')}</td></tr>
              )}
              {filtered.map(tr => (
                <tr key={tr.id} className="hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3 font-numeric text-muted-foreground whitespace-nowrap">{new Date(tr.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}</td>
                  <td className="px-4 py-3">
                    <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-medium">
                      {t(`expenses.cat.${tr.category}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{tr.description || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{accountName(tr.accountId)}</td>
                  <td className={`px-4 py-3 font-numeric font-semibold text-destructive ${isRTL ? 'text-left' : 'text-right'}`}>{formatCurrency(tr.amount)}</td>
                  {can('expenses', 'delete') && (
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(tr.id)} className="p-1.5 text-destructive hover:bg-error-container rounded transition-colors" title={t('common.delete')}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">{editingId ? t('expenses.editExpense') : t('expenses.newExpense')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('expenses.amount')}</label>
                <input
                  type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-background font-numeric"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('expenses.category')}</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-background">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`expenses.cat.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('expenses.account')}</label>
                <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-background">
                  {state.data.treasuryAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('expenses.date')}</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-background" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSave} className="flex-1 py-2 bg-success text-success-foreground rounded-lg text-sm font-medium hover:brightness-110 transition-all">
                {t('common.save')}
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
