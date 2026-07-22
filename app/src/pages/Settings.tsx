import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Upload, Download, RotateCcw, Building2, Globe, Database, Users, Shield, X, Plus, Trash2, Sparkles, Eye, EyeOff, Lock, Pencil, ReceiptText, Image as ImageIcon } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { resetToZero, exportState, importState } from '@/db';
import { GeminiProvider } from '@/services/ai/gemini';
import * as authService from '@/services/auth';
import * as rolesService from '@/services/roles';
import type { User, UserRole, InvoiceDesign } from '@/types';
import type { RoleDefinition, RolePermissions, PermissionModule, PermissionAction } from '@/types/permissions';
import { PERMISSION_MODULES, PERMISSION_ACTIONS, emptyPermissions, normalizePermissions } from '@/types/permissions';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import type { NormalizedInvoice } from '@/components/invoice/invoiceModel';
import { aiManager } from '@/services/ai';

export function Settings() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user: currentUser, roles, can, isOwner, reloadRoles } = useAuth();
  const { company, invoiceDesign, employees } = state.data;

  const canManageUsers = isOwner || can('users', 'view');
  const canEditUsers = isOwner || can('users', 'edit');
  const canDesignInvoice = isOwner || can('settings', 'edit');

  const [tab, setTab] = useState<'company' | 'invoice' | 'users' | 'roles' | 'backup' | 'language' | 'ai'>('company');
  const [companyForm, setCompanyForm] = useState({ ...company });
  const [designForm, setDesignForm] = useState<InvoiceDesign>(invoiceDesign);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState<Partial<User>>({ name: '', email: '', role: 'cashier', isActive: true });
  const [userPassword, setUserPassword] = useState('');
  const [userError, setUserError] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; nameAr: string; permissions: RolePermissions }>({
    name: '', nameAr: '', permissions: emptyPermissions(),
  });
  const [roleError, setRoleError] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  const handleSuggestPermissions = async () => {
    if (!roleForm.name.trim()) { setRoleError(t('settings.errInvalidFields')); return; }
    setSuggesting(true);
    try {
      const suggested = await aiManager.suggestRolePermissions(roleForm.name, roleForm.nameAr);
      setRoleForm(prev => ({ ...prev, permissions: suggested }));
    } catch {
      setRoleError(t('settings.suggestFailed'));
    } finally {
      setSuggesting(false);
    }
  };

  const refreshUsers = () => {
    void authService.listAccounts().then(setUsers);
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');

  useEffect(() => {
    setApiKey(localStorage.getItem('easy_store_gemini_key') || '');
  }, []);

  const handleSaveApiKey = () => {
    const key = apiKey.trim();
    if (key) {
      GeminiProvider.saveApiKey(key);
      setApiStatus('saved');
    }
  };

  const handleClearApiKey = () => {
    GeminiProvider.clearApiKey();
    setApiKey('');
    setApiStatus('cleared');
  };

  const handleSaveCompany = () => {
    dispatch({ type: 'UPDATE_COMPANY', payload: companyForm });
    alert(t('notifications.saved'));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert(t('settings.logoInvalid')); return; }
    if (file.size > 1024 * 1024) { alert(t('settings.logoTooLarge')); return; }
    const reader = new FileReader();
    reader.onload = () => setDesignForm(prev => ({ ...prev, logo: String(reader.result) }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const setLabel = (key: keyof InvoiceDesign['labels'], value: string) => {
    setDesignForm(prev => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  };

  const handleSaveDesign = () => {
    dispatch({ type: 'UPDATE_COMPANY', payload: companyForm });
    dispatch({ type: 'UPDATE_INVOICE_DESIGN', payload: designForm });
    alert(t('notifications.saved'));
  };

  const sampleInvoice: NormalizedInvoice = {
    invoiceNumber: '1',
    partyName: isRTL ? 'عميل تجريبي' : 'Sample Customer',
    createdBy: currentUser?.name || (isRTL ? 'المالك' : 'Owner'),
    createdAt: new Date().toISOString(),
    items: [
      { itemName: isRTL ? 'منتج تجريبي أ' : 'Sample Product A', itemId: 'P-001', quantity: 2, unitPrice: 50, total: 100 },
      { itemName: isRTL ? 'منتج تجريبي ب' : 'Sample Product B', itemId: 'P-002', quantity: 1, unitPrice: 75, total: 75 },
    ],
    subtotal: 175,
    discount: 15,
    extraCharges: [{ description: isRTL ? 'شحن' : 'Shipping', amount: 10 }],
    total: 170,
    paid: 100,
    previousBalance: 50,
  };

  const handleResetToZero = () => {
    if (window.confirm(t('settings.resetToZeroConfirm'))) {
      const fresh = resetToZero();
      dispatch({ type: 'SET_STATE', payload: fresh });
      alert(t('settings.resetToZeroDone'));
      window.location.reload();
    }
  };

  const handleExport = () => {
    const data = exportState();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easy_store_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (importState(importText)) {
      alert(t('settings.importSuccess'));
      setShowImportModal(false);
      setImportText('');
      window.location.reload();
    } else {
      alert(t('settings.importInvalid'));
    }
  };

  const roleLabel = (roleId: UserRole) => {
    const def = roles.find(r => r.id === roleId);
    if (def) return isRTL ? def.nameAr : def.name;
    return roleId;
  };
  const assignableRoles = roles.filter(r => r.id !== 'owner');
  const moduleLabel = (m: PermissionModule) => (m === 'users' ? t('settings.users') : t(`nav.${m}`));
  const actionLabel = (a: PermissionAction) => t(`permissions.${a}`);

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', role: 'cashier', isActive: true });
    setUserPassword('');
    setUserError('');
    setShowUserModal(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({ ...u });
    setUserPassword('');
    setUserError('');
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    setUserError('');
    if (!userForm.name || !userForm.email) return;
    const mapError = (error?: string) =>
      error === 'email_exists' ? t('settings.errEmailExists')
        : error === 'weak_password' ? t('settings.errWeakPassword')
          : error === 'owner_protected' ? t('settings.errOwnerProtected')
            : t('settings.errInvalidFields');
    if (editingUser) {
      const res = await authService.updateAccount(editingUser.id, {
        name: userForm.name,
        role: userForm.role as UserRole,
        isActive: userForm.isActive,
      });
      if (!res.ok) { setUserError(mapError(res.error)); return; }
    } else {
      const res = await authService.adminCreateAccount(
        userForm.name, userForm.email, userPassword, userForm.role as UserRole,
      );
      if (!res.ok) { setUserError(mapError(res.error)); return; }
    }
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({ name: '', email: '', role: 'cashier', isActive: true });
    setUserPassword('');
    refreshUsers();
  };

  const handleDeleteUser = async (u: User) => {
    if (u.role === 'owner') { alert(t('settings.cannotDeleteOwner')); return; }
    if (u.id === currentUser?.id) { alert(t('settings.cannotDeleteSelf')); return; }
    if (window.confirm(t('notifications.confirmDelete'))) {
      await authService.deleteAccount(u.id);
      refreshUsers();
    }
  };

  // ── إدارة الرتب ──────────────────────────────────────────
  const openAddRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', nameAr: '', permissions: emptyPermissions() });
    setRoleError('');
    setShowRoleModal(true);
  };

  const openEditRole = (r: RoleDefinition) => {
    setEditingRole(r);
    setRoleForm({ name: r.name, nameAr: r.nameAr, permissions: normalizePermissions(r.permissions) });
    setRoleError('');
    setShowRoleModal(true);
  };

  const toggleRolePerm = (module: PermissionModule, action: PermissionAction) => {
    setRoleForm(prev => {
      const next = { ...prev.permissions, [module]: { ...prev.permissions[module], [action]: !prev.permissions[module][action] } };
      // تفعيل "عرض" تلقائياً عند تفعيل أي إجراء آخر
      if (action !== 'view' && next[module][action]) next[module].view = true;
      return { ...prev, permissions: next };
    });
  };

  const handleSaveRole = async () => {
    setRoleError('');
    if (!roleForm.name.trim()) { setRoleError(t('settings.errInvalidFields')); return; }
    const res = editingRole
      ? await rolesService.updateRole(editingRole.id, { name: roleForm.name, nameAr: roleForm.nameAr, permissions: roleForm.permissions })
      : await rolesService.createRole(roleForm.name, roleForm.nameAr, roleForm.permissions);
    if (!res.ok) {
      setRoleError(res.error === 'exists' ? t('settings.errRoleExists')
        : res.error === 'protected' ? t('settings.errOwnerProtected')
          : t('settings.errInvalidFields'));
      return;
    }
    setShowRoleModal(false);
    setEditingRole(null);
    await reloadRoles();
  };

  const handleDeleteRole = async (r: RoleDefinition) => {
    if (r.isSystem) { alert(t('settings.errRoleProtected')); return; }
    const inUse = users.some(u => u.role === r.id);
    if (inUse) { alert(t('settings.errRoleInUse')); return; }
    if (window.confirm(t('notifications.confirmDelete'))) {
      await rolesService.deleteRole(r.id);
      await reloadRoles();
    }
  };

  const tabs = [
    { id: 'company', label: t('settings.company'), icon: <Building2 size={16} /> },
    ...(canDesignInvoice ? [{ id: 'invoice', label: t('settings.invoiceDesigner'), icon: <ReceiptText size={16} /> }] : []),
    ...(canManageUsers ? [{ id: 'users', label: t('settings.users'), icon: <Users size={16} /> }] : []),
    ...(canEditUsers ? [{ id: 'roles', label: t('settings.roles'), icon: <Shield size={16} /> }] : []),
    { id: 'ai', label: t('settings.ai'), icon: <Sparkles size={16} /> },
    { id: 'language', label: t('settings.language'), icon: <Globe size={16} /> },
    { id: 'backup', label: t('settings.backup'), icon: <Database size={16} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className={`bg-card rounded-xl border border-border p-1 inline-flex flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Company Settings */}
      {tab === 'company' && (
        <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('settings.company')}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">{t('settings.companyName')} EN</label><input value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">{t('settings.companyName')} AR</label><input value={companyForm.nameAr} onChange={e => setCompanyForm({ ...companyForm, nameAr: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.address')}</label><input value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.phone')}</label><input value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.email')}</label><input value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">{t('settings.commercialRegistration')}</label><input value={companyForm.commercialRegistration} onChange={e => setCompanyForm({ ...companyForm, commercialRegistration: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
            </div>
            <button onClick={handleSaveCompany} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Save size={16} /> {t('settings.saveChanges')}
            </button>
          </div>
        </div>
      )}

      {/* Invoice Designer */}
      {tab === 'invoice' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Editor */}
          <div className="space-y-4">
            {/* Logo & brand */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('settings.brandLogo')}</h3>
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-24 h-24 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/40 overflow-hidden flex-shrink-0">
                  {designForm.logo ? (
                    <img src={designForm.logo} alt="logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon size={28} className="text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 cursor-pointer">
                    <Upload size={14} /> {t('settings.uploadLogo')}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {designForm.logo && (
                    <button onClick={() => setDesignForm(prev => ({ ...prev, logo: '' }))} className="block text-xs text-destructive hover:underline">{t('settings.removeLogo')}</button>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t('settings.logoHint')}</p>
                </div>
              </div>
              <div className={`flex items-center gap-4 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <label className={`flex items-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input type="checkbox" checked={designForm.showLogo} onChange={e => setDesignForm({ ...designForm, showLogo: e.target.checked })} /> {t('settings.showLogo')}
                </label>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm text-muted-foreground">{t('settings.accentColor')}</span>
                  <input type="color" value={designForm.accentColor} onChange={e => setDesignForm({ ...designForm, accentColor: e.target.value })} className="w-9 h-8 rounded border border-border bg-card cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Company info */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('settings.company')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.companyName')} EN</label><input value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.companyName')} AR</label><input value={companyForm.nameAr} onChange={e => setCompanyForm({ ...companyForm, nameAr: e.target.value })} dir="rtl" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">{t('common.address')}</label><input value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.phone')}</label><input value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} dir="ltr" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.email')}</label><input value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} dir="ltr" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
            </div>

            {/* Extra fields */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('settings.invoiceFields')}</h3>
              <div className="space-y-3">
                <label className={`flex items-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input type="checkbox" checked={designForm.showSalesPerson} onChange={e => setDesignForm({ ...designForm, showSalesPerson: e.target.checked })} /> {t('settings.showSalesPerson')}
                </label>
                <label className={`flex items-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input type="checkbox" checked={designForm.showPreviousBalance} onChange={e => setDesignForm({ ...designForm, showPreviousBalance: e.target.checked })} /> {t('settings.showPreviousBalance')}
                </label>
                <label className={`flex items-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input type="checkbox" checked={designForm.showManagement} onChange={e => setDesignForm({ ...designForm, showManagement: e.target.checked })} /> {t('settings.showManagement')}
                </label>
                {designForm.showManagement && (
                  <input value={designForm.managementName} onChange={e => setDesignForm({ ...designForm, managementName: e.target.value })} placeholder={t('settings.managementName')} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                )}
                {([1, 2] as const).map(n => {
                  const key = (n === 1 ? 'customField1' : 'customField2') as 'customField1' | 'customField2';
                  const cf = designForm[key];
                  return (
                    <div key={n} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input value={cf.labelEn} onChange={e => setDesignForm({ ...designForm, [key]: { ...cf, labelEn: e.target.value } })} placeholder={`${t('settings.customField')} ${n} EN`} className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                      <input value={cf.labelAr} onChange={e => setDesignForm({ ...designForm, [key]: { ...cf, labelAr: e.target.value } })} dir="rtl" placeholder={`${t('settings.customField')} ${n} AR`} className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                      <input value={cf.value} onChange={e => setDesignForm({ ...designForm, [key]: { ...cf, value: e.target.value } })} placeholder={t('settings.value')} className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer & texts */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('settings.footerTexts')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.thankYou')} EN</label><input value={designForm.thankYouEn} onChange={e => setDesignForm({ ...designForm, thankYouEn: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.thankYou')} AR</label><input value={designForm.thankYouAr} onChange={e => setDesignForm({ ...designForm, thankYouAr: e.target.value })} dir="rtl" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.footerText')} EN</label><input value={designForm.footerTextEn} onChange={e => setDesignForm({ ...designForm, footerTextEn: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.footerText')} AR</label><input value={designForm.footerTextAr} onChange={e => setDesignForm({ ...designForm, footerTextAr: e.target.value })} dir="rtl" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
            </div>

            {/* Editable labels */}
            <details className="bg-card rounded-xl border border-border p-5">
              <summary className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.staticTexts')}</summary>
              <p className="text-[11px] text-muted-foreground mt-1 mb-3">{t('settings.staticTextsHint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  ['saleTitle', t('settings.lblSaleTitle')],
                  ['invoiceNo', t('settings.lblInvoiceNo')],
                  ['date', t('settings.lblDate')],
                  ['time', t('settings.lblTime')],
                  ['customer', t('settings.lblCustomer')],
                  ['previousBalance', t('settings.lblPreviousBalance')],
                  ['seller', t('settings.lblSeller')],
                  ['product', t('settings.lblProduct')],
                  ['code', t('settings.lblCode')],
                  ['qty', t('settings.lblQty')],
                  ['price', t('settings.lblPrice')],
                  ['total', t('settings.lblTotal')],
                  ['grandTotal', t('settings.lblGrandTotal')],
                  ['totalDue', t('settings.lblTotalDue')],
                  ['paid', t('settings.lblPaid')],
                  ['remaining', t('settings.lblRemaining')],
                  ['net', t('settings.lblNet')],
                ] as const).map(([base, label]) => {
                  const ekey = `${base}${isRTL ? 'Ar' : 'En'}` as keyof InvoiceDesign['labels'];
                  return (
                    <div key={base}>
                      <label className="block text-[11px] text-muted-foreground mb-1">{label}</label>
                      <input value={designForm.labels[ekey] || ''} onChange={e => setLabel(ekey, e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className="w-full px-3 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                    </div>
                  );
                })}
              </div>
            </details>

            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={handleSaveDesign} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                <Save size={16} /> {t('settings.saveChanges')}
              </button>
              <button onClick={() => setDesignForm(invoiceDesign)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
            </div>
          </div>

          {/* Live preview */}
          <div className="xl:sticky xl:top-4 self-start">
            <p className="text-xs text-muted-foreground mb-2">{t('settings.livePreview')}</p>
            <div className="rounded-lg border border-border overflow-hidden shadow-sm max-h-[80vh] overflow-y-auto">
              <InvoiceDocument invoice={sampleInvoice} company={companyForm} design={designForm} type="sale" isRTL={isRTL} />
            </div>
          </div>
        </div>
      )}

      {/* AI Settings */}
      {tab === 'ai' && (
        <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('settings.ai')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('settings.aiDesc')}</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('settings.geminiApiKey')}</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={isRTL ? "تم تحميل مفتاح النظام تلقائياً وبأمان" : "System API key loaded automatically & securely"}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary font-mono"
                />
                <button
                  onClick={() => setShowApiKey(v => !v)}
                  className="p-2 border border-border rounded-lg hover:bg-accent text-muted-foreground"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={handleSaveApiKey} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                <Save size={16} /> {t('settings.saveApiKey')}
              </button>
              <button onClick={handleClearApiKey} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent text-muted-foreground">
                <X size={16} /> {t('settings.clearApiKey')}
              </button>
            </div>
            {apiStatus === 'saved' && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('settings.apiKeySaved')}</p>
            )}
            {apiStatus === 'cleared' && (
              <p className="text-sm text-amber-600 dark:text-amber-400">{t('settings.apiKeyCleared')}</p>
            )}
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>{t('settings.aiProvider')}: <span className="font-medium text-foreground">Google Gemini</span></p>
              <p>{t('settings.aiModel')}: <span className="font-medium text-foreground">gemini-flash-latest</span></p>
              <p>
                {isRTL ? 'حالة مفتاح الخدمة:' : 'API Key Status:'}{' '}
                {apiKey.trim() ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {isRTL ? 'مفتاح مخصص نشط' : 'Custom key active'}
                  </span>
                ) : (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {isRTL ? 'مفتاح النظام المدمج نشط وآمن 🔒' : 'System key active & secure 🔒'}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="text-sm text-muted-foreground">{t('settings.usersDesc')}</p>
            <button onClick={openAddUser} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex-shrink-0">
              <Plus size={16} /> {t('settings.addUser')}
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50">
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.name')}</th>
                    <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.email')}</th>
                    <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.employeeName')}</th>
                    <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.role')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{isRTL ? 'لا يوجد مستخدمون' : 'No users yet'}</td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {u.name}
                        {u.id === currentUser?.id && <span className="ml-2 text-[10px] text-primary">({isRTL ? 'أنت' : 'you'})</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const emp = employees.find(e => e.userId === u.id);
                          return emp
                            ? <span className="text-xs font-medium text-foreground">{isRTL ? emp.nameAr : emp.name}</span>
                            : <span className="text-xs text-muted-foreground/60">{t('hr.noAccount')}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{roleLabel(u.role)}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'}`}>{u.isActive ? t('common.active') : t('common.inactive')}</span></td>
                      <td className="px-4 py-3">
                        <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <button onClick={() => openEditUser(u)} className="p-1.5 rounded hover:bg-primary/10 text-primary" title={t('common.edit')}><Pencil size={14} /></button>
                          {u.role === 'owner' ? (
                            <span className="p-1.5 text-muted-foreground" title={t('settings.cannotDeleteOwner')}><Lock size={14} /></span>
                          ) : (
                            <button onClick={() => handleDeleteUser(u)} className="p-1.5 rounded hover:bg-destructive/10 text-red-600 dark:text-red-400" title={t('common.delete')}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roles */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="text-sm text-muted-foreground">{t('settings.rolesDesc')}</p>
            <button onClick={openAddRole} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex-shrink-0">
              <Plus size={16} /> {t('settings.addRole')}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roles.map(r => {
              const allowed = PERMISSION_MODULES.filter(m => r.id === 'owner' || r.permissions[m]?.view);
              return (
                <div key={r.id} className="bg-card rounded-xl border border-border p-4">
                  <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : ''}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <h4 className="font-semibold text-foreground">{isRTL ? r.nameAr : r.name}</h4>
                        {r.isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t('settings.systemRole')}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{(isRTL ? r.descriptionAr : r.description) || ''}</p>
                    </div>
                    <div className={`flex gap-1 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {r.id === 'owner' ? (
                        <span className="p-1.5 text-muted-foreground"><Lock size={14} /></span>
                      ) : (
                        <>
                          <button onClick={() => openEditRole(r)} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Pencil size={14} /></button>
                          {!r.isSystem && (
                            <button onClick={() => handleDeleteRole(r)} className="p-1.5 rounded hover:bg-destructive/10 text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`flex flex-wrap gap-1 mt-3 ${isRTL ? 'justify-end' : ''}`}>
                    {r.id === 'owner' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">{t('settings.fullAccess')}</span>
                    ) : allowed.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">{t('permissions.noAccess')}</span>
                    ) : allowed.map(m => (
                      <span key={m} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{moduleLabel(m)}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Language */}
      {tab === 'language' && (
        <div className="bg-card rounded-xl border border-border p-6 max-w-md">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('settings.language')}</h3>
          <div className="space-y-3">
            <button
              onClick={() => i18n.changeLanguage('en')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${i18n.language === 'en' ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{t('common.english')}</span>
                {i18n.language === 'en' && <CheckCircle size={20} className="text-primary" />}
              </div>
            </button>
            <button
              onClick={() => i18n.changeLanguage('ar')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${i18n.language === 'ar' ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{t('common.arabic')}</span>
                {i18n.language === 'ar' && <CheckCircle size={20} className="text-primary" />}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Backup */}
      {tab === 'backup' && (
        <div className="space-y-4 max-w-md">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('settings.backupData')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('settings.backupDesc')}</p>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Download size={16} /> {t('settings.backupData')}
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('settings.restoreData')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('settings.restoreDesc')}</p>
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10">
              <Upload size={16} /> {t('settings.restoreData')}
            </button>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
            <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-4">{t('settings.resetToZero')}</h3>
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">{t('settings.resetToZeroDesc')}</p>
            <button onClick={handleResetToZero} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
              <RotateCcw size={16} /> {t('settings.resetToZero')}
            </button>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{editingUser ? t('settings.editUser') : t('settings.addUser')}</h3>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')}</label><input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('common.email')}</label>
                <input value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} disabled={!!editingUser} dir="ltr" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary disabled:opacity-60" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('settings.password')}</label>
                  <input type="password" value={userPassword} onChange={e => setUserPassword(e.target.value)} dir="ltr" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                </div>
              )}
              <div><label className="block text-xs text-muted-foreground mb-1">{t('common.role')}</label>
                {editingUser?.role === 'owner' ? (
                  <div className={`flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Lock size={14} /> {roleLabel('owner')}
                  </div>
                ) : (
                  <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as User['role'] })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary bg-card">
                    {assignableRoles.map(r => (
                      <option key={r.id} value={r.id}>{isRTL ? r.nameAr : r.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {editingUser && (
                <label className={`flex items-center gap-2 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input type="checkbox" checked={!!userForm.isActive} onChange={e => setUserForm({ ...userForm, isActive: e.target.checked })} />
                  {t('common.active')}
                </label>
              )}
              {userError && <p className="text-xs text-destructive">{userError}</p>}
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowUserModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleSaveUser} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{editingRole ? t('settings.editRole') : t('settings.addRole')}</h3>
              <button onClick={() => setShowRoleModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.roleName')} EN</label><input value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('settings.roleName')} AR</label><input value={roleForm.nameAr} onChange={e => setRoleForm({ ...roleForm, nameAr: e.target.value })} dir="rtl" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div>
                <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <label className="block text-xs font-medium text-muted-foreground">{t('settings.permissions')}</label>
                  <button
                    onClick={handleSuggestPermissions}
                    disabled={suggesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-container text-on-primary-container hover:brightness-110 transition-all disabled:opacity-60"
                  >
                    <Sparkles size={14} /> {suggesting ? t('settings.suggesting') : t('settings.suggestPermissions')}
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50">
                      <th className={`px-3 py-2 text-xs font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{t('settings.module')}</th>
                      {PERMISSION_ACTIONS.map(a => (
                        <th key={a} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-center">{actionLabel(a)}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {PERMISSION_MODULES.map(m => (
                        <tr key={m} className="hover:bg-muted/30">
                          <td className={`px-3 py-2 font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{moduleLabel(m)}</td>
                          {PERMISSION_ACTIONS.map(a => (
                            <td key={a} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={roleForm.permissions[m][a]}
                                onChange={() => toggleRolePerm(m, a)}
                                className="w-4 h-4 accent-primary cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {roleError && <p className="text-xs text-destructive">{roleError}</p>}
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleSaveRole} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{t('settings.restoreData')}</h3>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={t('settings.pasteBackup')} className="w-full h-40 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary font-mono text-xs" />
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleImport} disabled={!importText.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('settings.restoreData')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircle({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
