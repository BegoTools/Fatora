import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Search, ArrowRightLeft, TrendingUp, TrendingDown, Landmark, Wallet, Vault, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId } from '@/db';
import type { Transaction } from '@/types';

export function Treasury() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user, can } = useAuth();
  const { treasuryAccounts, transactions } = state.data;

  const [view, setView] = useState<'accounts' | 'transactions' | 'assets'>('accounts');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [transactionForm, setTransactionForm] = useState({
    accountId: '', type: 'income' as 'income' | 'expense', amount: 0,
    description: '', referenceNumber: '', category: '',
  });

  const [transferForm, setTransferForm] = useState({
    fromAccountId: '', toAccountId: '', amount: 0, description: '',
  });

  const formatCurrency = (val: number) => `${val.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${state.data.company.currencySymbol}`;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'safe': return <Vault size={20} className="text-primary" />;
      case 'bank': return <Landmark size={20} className="text-indigo-500 dark:text-indigo-400" />;
      case 'wallet': return <Wallet size={20} className="text-emerald-600 dark:text-emerald-400" />;
      default: return <Landmark size={20} />;
    }
  };

  const totalBalance = treasuryAccounts.reduce((sum, a) => sum + a.balance, 0);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return transactions.filter(t =>
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  const handleAddTransaction = () => {
    const account = treasuryAccounts.find(a => a.id === transactionForm.accountId);
    if (!account) return;

    const newTransaction: Transaction = {
      id: generateId('tr'),
      accountId: transactionForm.accountId,
      accountName: account.name,
      type: transactionForm.type,
      amount: transactionForm.amount,
      description: transactionForm.description,
      referenceNumber: transactionForm.referenceNumber || `REF-${Date.now()}`,
      category: transactionForm.category,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System',
    };

    dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
    setShowTransactionModal(false);
    setTransactionForm({ accountId: '', type: 'income', amount: 0, description: '', referenceNumber: '', category: '' });
    toast.success(t('notifications.itemAdded'));
  };

  const handleTransfer = () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || transferForm.amount <= 0) return;
    if (transferForm.fromAccountId === transferForm.toAccountId) return;

    const fromAcc = treasuryAccounts.find(a => a.id === transferForm.fromAccountId);
    if (!fromAcc || fromAcc.balance < transferForm.amount) return;

    const outTransaction: Transaction = {
      id: generateId('tr'), accountId: transferForm.fromAccountId,
      accountName: fromAcc.name, type: 'transfer_out',
      amount: transferForm.amount, description: `Transfer to ${treasuryAccounts.find(a => a.id === transferForm.toAccountId)?.name}: ${transferForm.description}`,
      referenceNumber: `TF-${Date.now()}`, category: 'Transfer',
      date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };

    const toAcc = treasuryAccounts.find(a => a.id === transferForm.toAccountId);
    const inTransaction: Transaction = {
      id: generateId('tr'), accountId: transferForm.toAccountId,
      accountName: toAcc?.name || '', type: 'transfer_in',
      amount: transferForm.amount, description: `Transfer from ${fromAcc.name}: ${transferForm.description}`,
      referenceNumber: `TF-${Date.now()}`, category: 'Transfer',
      date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };

    dispatch({ type: 'ADD_TRANSACTION', payload: outTransaction });
    dispatch({ type: 'ADD_TRANSACTION', payload: inTransaction });

    setShowTransferModal(false);
    setTransferForm({ fromAccountId: '', toAccountId: '', amount: 0, description: '' });
    toast.success(t('notifications.itemAdded'));
  };

  const totalIncome = transactions.filter(t => t.type === 'income' || t.type === 'transfer_in').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' || t.type === 'transfer_out').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('treasury.balance')}</p>
              <p className="text-2xl font-bold text-foreground font-mono mt-1">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
              <Landmark size={22} className="text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('treasury.income')}</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
              <TrendingUp size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('treasury.expense')}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono mt-1">{formatCurrency(totalExpense)}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
              <TrendingDown size={22} className="text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Toolbar */}
      <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`bg-card rounded-xl border border-border p-1 inline-flex ${isRTL ? 'flex-row-reverse' : ''}`}>
          {(['accounts', 'transactions', 'assets'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
              {t(`treasury.${v}`)}
            </button>
          ))}
        </div>
        <div className={`flex gap-2 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
          {can('treasury', 'create') && (
            <button onClick={() => setShowTransferModal(true)} className="flex items-center gap-1.5 px-3 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/10 transition-colors">
              <ArrowRightLeft size={14} /> {t('treasury.transferFunds')}
            </button>
          )}
          {can('treasury', 'create') && (
            <button onClick={() => setShowTransactionModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Plus size={16} /> {t('treasury.newTransaction')}
            </button>
          )}
        </div>
      </div>

      {/* Accounts View */}
      {view === 'accounts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {treasuryAccounts.map(acc => (
            <div key={acc.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    acc.type === 'safe' ? 'bg-primary/10' : acc.type === 'bank' ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'bg-emerald-50 dark:bg-emerald-950/50'
                  }`}>
                    {getAccountIcon(acc.type)}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{isRTL ? acc.nameAr : acc.name}</h4>
                    <p className="text-xs text-muted-foreground">{t(`treasury.${acc.type}`)}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold font-mono ${acc.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(acc.balance)}
                </span>
              </div>
              {acc.accountNumber && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                  <p className="text-xs font-mono text-foreground">{acc.accountNumber}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transactions View */}
      {view === 'transactions' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-xs">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('common.search')} className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary`} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('treasury.date')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('treasury.reference')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('treasury.description')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('treasury.accountName')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('treasury.transactionType')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.amount')}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.slice(0, 20).map(tr => (
                  <tr key={tr.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{tr.date}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{tr.referenceNumber}</td>
                    <td className="px-4 py-3">{tr.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tr.accountName}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${tr.type === 'income' || tr.type === 'transfer_in' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'}`}>{t(`treasury.${tr.type}`)}</span></td>
                    <td className={`px-4 py-3 font-mono font-medium ${tr.type === 'income' || tr.type === 'transfer_in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tr.type === 'income' || tr.type === 'transfer_in' ? '+' : '-'}{formatCurrency(tr.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fixed Assets View */}
      {view === 'assets' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.name')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.fields.category')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.purchase')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.annualDepreciation')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.accumulatedDepreciation')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.netBookValue')}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {state.data.fixedAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{isRTL ? asset.nameAr : asset.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{asset.category}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(asset.purchasePrice)}</td>
                    <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400">{formatCurrency(asset.annualDepreciation)}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(asset.accumulatedDepreciation)}</td>
                    <td className="px-4 py-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(asset.netBookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{t('treasury.newTransaction')}</h3>
              <button onClick={() => setShowTransactionModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.accountName')}</label>
                <select value={transactionForm.accountId} onChange={e => setTransactionForm({ ...transactionForm, accountId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
                  <option value="">{t('common.select')}...</option>
                  {treasuryAccounts.map(a => <option key={a.id} value={a.id}>{isRTL ? a.nameAr : a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.transactionType')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['income', 'expense'] as const).map(type => (
                    <button key={type} onClick={() => setTransactionForm({ ...transactionForm, type })} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${transactionForm.type === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                      {t(`treasury.${type}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.amount')}</label>
                <input type="number" value={transactionForm.amount} onChange={e => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })} min={0} step={0.01} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.description')}</label>
                <input type="text" value={transactionForm.description} onChange={e => setTransactionForm({ ...transactionForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.category')}</label>
                <select value={transactionForm.category} onChange={e => setTransactionForm({ ...transactionForm, category: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
                  <option value="">{t('common.select')}...</option>
                  <option value="Sales">{t('nav.sales')}</option>
                  <option value="Purchases">{t('nav.purchases')}</option>
                  <option value="Suppliers">{t('nav.purchases')} - {t('common.supplier')}</option>
                  <option value="Customers">{t('nav.sales')} - {t('common.customer')}</option>
                  <option value="Office">{t('common.office')}</option>
                  <option value="Utilities">{t('common.utilities')}</option>
                  <option value="Transfer">{t('treasury.transfer')}</option>
                </select>
              </div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowTransactionModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleAddTransaction} disabled={!transactionForm.accountId || transactionForm.amount <= 0} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{t('treasury.transferFunds')}</h3>
              <button onClick={() => setShowTransferModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.transfer')} {t('common.from')}</label>
                  <select value={transferForm.fromAccountId} onChange={e => setTransferForm({ ...transferForm, fromAccountId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
                    <option value="">{t('common.select')}...</option>
                    {treasuryAccounts.map(a => <option key={a.id} value={a.id}>{isRTL ? a.nameAr : a.name} ({formatCurrency(a.balance)})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.transfer')} {t('common.to')}</label>
                  <select value={transferForm.toAccountId} onChange={e => setTransferForm({ ...transferForm, toAccountId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
                    <option value="">{t('common.select')}...</option>
                    {treasuryAccounts.map(a => <option key={a.id} value={a.id}>{isRTL ? a.nameAr : a.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.amount')}</label>
                <input type="number" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: Number(e.target.value) })} min={0} step={0.01} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('treasury.description')}</label>
                <input type="text" value={transferForm.description} onChange={e => setTransferForm({ ...transferForm, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
              </div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleTransfer} disabled={!transferForm.fromAccountId || !transferForm.toAccountId || transferForm.amount <= 0 || transferForm.fromAccountId === transferForm.toAccountId} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
