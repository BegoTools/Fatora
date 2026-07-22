import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Calendar, DollarSign, Users, X, ChevronLeft, ChevronRight, Link2, Unlink, UserPlus, KeyRound } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId } from '@/db';
import * as authService from '@/services/auth';
import type { Employee, AttendanceRecord, PayrollRecord, EmployeeAdvance, User, UserRole } from '@/types';

export function HR() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { roles, can } = useAuth();
  const { employees, attendanceRecords, payrollRecords, employeeAdvances } = state.data;

  const [view, setView] = useState<'employees' | 'attendance' | 'payroll' | 'advances'>('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [users, setUsers] = useState<User[]>([]);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');

  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({
    employeeNumber: '', name: '', nameAr: '', phone: '', email: '', address: '',
    jobTitle: '', department: '', hireDate: '', salary: 0, commissionRate: 0, isActive: true,
  });

  useEffect(() => {
    void authService.listAccounts().then(setUsers);
  }, []);

  const roleLabel = (roleId?: string) =>
    (roles.find(r => r.id === roleId)?.name) || (roles.find(r => r.id === roleId)?.nameAr) || roleId || t('hr.noAccount');
  const linkedUser = (userId?: string) => users.find(u => u.id === userId);
  const availableUsers = users.filter(u => !employees.some(e => e.userId === u.id && e.id !== editingEmployee?.id));

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const formatCurrency = (val: number) => `${val.toLocaleString()} ${state.data.company.currencySymbol}`;

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    return employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.nameAr.includes(searchQuery));
  }, [employees, searchQuery]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const todayAttendance = attendanceRecords.filter(a => a.date === selectedDate);

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const handleSaveEmployee = () => {
    if (!employeeForm.name) return;
    if (editingEmployee) {
      dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...editingEmployee, ...employeeForm } as Employee });
    } else {
      dispatch({ type: 'ADD_EMPLOYEE', payload: { ...employeeForm, id: generateId('emp'), createdAt: new Date().toISOString() } as Employee });
    }
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setNewUserPassword('');
    alert(t('notifications.saved'));
  };

  const handleLinkUser = (userId: string) => {
    setEmployeeForm({ ...employeeForm, userId });
  };

  const handleUnlinkUser = () => {
    setEmployeeForm({ ...employeeForm, userId: undefined });
  };

  const handleCreateAndLinkUser = async () => {
    if (newUserPassword.length < 6) { alert(t('settings.errWeakPassword')); return; }
    if (!employeeForm.email) { alert(t('settings.errInvalidFields')); return; }
    const res = await authService.adminCreateAccount(
      employeeForm.name || employeeForm.nameAr || t('hr.newEmployee'),
      employeeForm.email,
      newUserPassword,
      newUserRole,
    );
    if (!res.ok) { alert(t('settings.errEmailExists')); return; }
    if (res.user) {
      setUsers(prev => [...prev, res.user!]);
      setEmployeeForm({ ...employeeForm, userId: res.user.id });
    }
    setNewUserPassword('');
  };

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<EmployeeAdvance | null>(null);
  const [advanceForm, setAdvanceForm] = useState<Partial<EmployeeAdvance>>({
    employeeId: '', date: new Date().toISOString().split('T')[0], amount: 0, reason: '', repaidAmount: 0, notes: '',
  });

  const outstandingAdvances = employeeAdvances
    .filter(a => a.status !== 'repaid')
    .reduce((s, a) => s + (a.amount - (a.repaidAmount || 0)), 0);

  const advanceStatusOf = (a: EmployeeAdvance): EmployeeAdvance['status'] => {
    if ((a.repaidAmount || 0) >= a.amount) return 'repaid';
    if ((a.repaidAmount || 0) > 0) return 'partial';
    return 'pending';
  };

  const openAddAdvance = () => {
    setEditingAdvance(null);
    setAdvanceForm({ employeeId: employees[0]?.id || '', date: new Date().toISOString().split('T')[0], amount: 0, reason: '', repaidAmount: 0, notes: '' });
    setShowAdvanceModal(true);
  };

  const openEditAdvance = (a: EmployeeAdvance) => {
    setEditingAdvance(a);
    setAdvanceForm({ ...a });
    setShowAdvanceModal(true);
  };

  const handleSaveAdvance = () => {
    if (!advanceForm.employeeId || !advanceForm.amount) return;
    const emp = employees.find(e => e.id === advanceForm.employeeId);
    const status = advanceStatusOf(advanceForm as EmployeeAdvance);
    if (editingAdvance) {
      dispatch({ type: 'UPDATE_EMPLOYEE_ADVANCE', payload: { ...editingAdvance, ...advanceForm, employeeName: emp?.name || '', status } as EmployeeAdvance });
    } else {
      dispatch({ type: 'ADD_EMPLOYEE_ADVANCE', payload: { ...advanceForm, id: generateId('adv'), employeeName: emp?.name || '', status, createdAt: new Date().toISOString() } as EmployeeAdvance });
    }
    setShowAdvanceModal(false);
    setEditingAdvance(null);
    alert(t('notifications.saved'));
  };

  const handleDeleteAdvance = (id: string) => {
    if (confirm(t('notifications.confirmDelete'))) dispatch({ type: 'DELETE_EMPLOYEE_ADVANCE', payload: id });
  };

  const handleRepayAdvance = (a: EmployeeAdvance) => {
    dispatch({ type: 'UPDATE_EMPLOYEE_ADVANCE', payload: { ...a, repaidAmount: a.amount, status: 'repaid' } as EmployeeAdvance });
  };

  const handleCheckIn = (employeeId: string) => {
    const existing = todayAttendance.find(a => a.employeeId === employeeId);
    if (existing) {
      dispatch({ type: 'UPDATE_ATTENDANCE', payload: { ...existing, checkIn: new Date().toTimeString().substring(0, 5) } });
    } else {
      const emp = employees.find(e => e.id === employeeId);
      const newRecord: AttendanceRecord = {
        id: generateId('att'), employeeId, employeeName: emp?.name || '',
        date: selectedDate, checkIn: new Date().toTimeString().substring(0, 5), checkOut: '',
        status: 'present', notes: '',
      };
      dispatch({ type: 'ADD_ATTENDANCE', payload: newRecord });
    }
  };

  const handleCheckOut = (employeeId: string) => {
    const existing = todayAttendance.find(a => a.employeeId === employeeId);
    if (existing) {
      dispatch({ type: 'UPDATE_ATTENDANCE', payload: { ...existing, checkOut: new Date().toTimeString().substring(0, 5) } });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case 'absent': return <XCircle size={16} className="text-red-600 dark:text-red-400" />;
      case 'late': return <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />;
      default: return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  const handleGeneratePayroll = () => {
    employees.forEach(emp => {
      const existing = payrollRecords.find(p => p.employeeId === emp.id && p.month === monthNames[selectedMonth] && p.year === selectedYear);
      if (!existing && emp.isActive) {
        const baseSalary = emp.salary;
        const commission = Math.round(baseSalary * (emp.commissionRate / 100) * 10);
        const socialInsurance = Math.round(baseSalary * 0.08);
        const netSalary = baseSalary + commission - socialInsurance;

        const record: PayrollRecord = {
          id: generateId('pay'), employeeId: emp.id, employeeName: isRTL ? emp.nameAr : emp.name,
          month: monthNames[selectedMonth], year: selectedYear,
          baseSalary, commission, bonus: 0, deductions: 0, socialInsurance, netSalary,
          status: 'draft', createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_PAYROLL', payload: record });
      }
    });
    alert(t('notifications.itemAdded'));
  };

  const handleApprovePayroll = (id: string) => {
    dispatch({ type: 'UPDATE_PAYROLL', payload: { ...payrollRecords.find(p => p.id === id)!, status: 'approved' } });
  };

  const monthPayroll = payrollRecords.filter(p => p.month === monthNames[selectedMonth] && p.year === selectedYear);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div><p className="text-xs text-muted-foreground uppercase">{t('hr.employees')}</p><p className="text-2xl font-bold text-foreground font-mono mt-1">{employees.length}</p></div>
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center"><Users size={22} className="text-primary" /></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div><p className="text-xs text-muted-foreground uppercase">{t('hr.present')}</p><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{todayAttendance.filter(a => a.status === 'present' || a.status === 'late').length}</p></div>
            <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center"><CheckCircle size={22} className="text-emerald-600 dark:text-emerald-400" /></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div><p className="text-xs text-muted-foreground uppercase">{t('hr.payroll')} {t('common.total')}</p><p className="text-2xl font-bold text-primary font-mono mt-1">{formatCurrency(monthPayroll.reduce((s, p) => s + p.netSalary, 0))}</p></div>
            <div className="w-11 h-11 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center"><DollarSign size={22} className="text-indigo-500 dark:text-indigo-400" /></div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div><p className="text-xs text-muted-foreground uppercase">{t('hr.outstanding')}</p><p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">{formatCurrency(outstandingAdvances)}</p></div>
            <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center"><DollarSign size={22} className="text-amber-500 dark:text-amber-400" /></div>
          </div>
        </div>
      </div>

      {/* Tabs + Toolbar */}
      <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`bg-card rounded-xl border border-border p-1 inline-flex ${isRTL ? 'flex-row-reverse' : ''}`}>
          {(['employees', 'attendance', 'payroll', 'advances'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
              {t(`hr.${v}`)}
            </button>
          ))}
        </div>
        {view === 'employees' && (
          <div className={`flex gap-2 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('common.search')} className={`${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary`} />
            </div>
            {can('hr', 'create') && (
              <button onClick={() => { setEditingEmployee(null); setEmployeeForm({ employeeNumber: '', name: '', nameAr: '', phone: '', email: '', address: '', jobTitle: '', department: '', hireDate: '', salary: 0, commissionRate: 0, isActive: true }); setNewUserPassword(''); setShowEmployeeModal(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Plus size={16} /> {t('hr.newEmployee')}</button>
            )}
          </div>
        )}
        {view === 'attendance' && (
          <div className={`flex gap-2 items-center ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
            <Calendar size={16} className="text-muted-foreground" />
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
          </div>
        )}
        {view === 'payroll' && (
          <div className={`flex gap-2 items-center ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="px-3 py-2 border border-border rounded-lg text-sm bg-card">
              {monthNames.map((m, i) => <option key={i} value={i}>{t(`common.${m}`)}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="px-3 py-2 border border-border rounded-lg text-sm bg-card">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleGeneratePayroll} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">{t('common.add')}</button>
          </div>
        )}
        {view === 'advances' && (
          <div className={`flex gap-2 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
            {can('hr', 'create') && (
              <button onClick={openAddAdvance} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"><Plus size={16} /> {t('hr.newAdvance')}</button>
            )}
          </div>
        )}
      </div>

      {/* Employees View */}
      {view === 'employees' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.employeeNumber')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.employeeName')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.jobTitle')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.department')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.salary')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.userAccount')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paginatedEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-medium">{emp.employeeNumber}</td>
                    <td className="px-4 py-3">
                      <div><p className="font-medium text-foreground">{isRTL ? emp.nameAr : emp.name}</p><p className="text-xs text-muted-foreground/60">{emp.phone}</p></div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.jobTitle}</td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                    <td className="px-4 py-3 font-mono font-medium">{formatCurrency(emp.salary)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'}`}>{emp.isActive ? t('common.active') : t('common.inactive')}</span></td>
                    <td className="px-4 py-3">
                      {linkedUser(emp.userId) ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-foreground">{linkedUser(emp.userId)!.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit ${linkedUser(emp.userId)!.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{roleLabel(linkedUser(emp.userId)!.role)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">{t('hr.noAccount')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {can('hr', 'edit') && (
                          <button onClick={() => { setEditingEmployee(emp); setEmployeeForm({ ...emp }); setShowEmployeeModal(true); }} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Edit2 size={14} /></button>
                        )}
                        {can('hr', 'delete') && (
                          <button onClick={() => {
                            if (!confirm(t('notifications.confirmDelete'))) return;
                            if (emp.userId) dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, userId: undefined } as Employee });
                            dispatch({ type: 'DELETE_EMPLOYEE', payload: emp.id });
                          }} className="p-1.5 rounded hover:bg-destructive/10 text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className={`px-4 py-3 border-t border-border flex justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">{isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
              <span className="text-xs text-muted-foreground px-2">{currentPage}/{totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-accent disabled:opacity-30">{isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
            </div>
          )}
        </div>
      )}

      {/* Attendance View */}
      {view === 'attendance' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.employeeName')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.department')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.checkIn')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.checkOut')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.status')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {employees.filter(e => e.isActive).map(emp => {
                  const record = todayAttendance.find(a => a.employeeId === emp.id);
                  return (
                    <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{isRTL ? emp.nameAr : emp.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                      <td className="px-4 py-3 font-mono">{record?.checkIn || '-'}</td>
                      <td className="px-4 py-3 font-mono">{record?.checkOut || '-'}</td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {getStatusIcon(record?.status || 'absent')}
                          <span className="text-xs">{record ? t(`hr.fields.${record.status}`) : t('hr.absent')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {!record?.checkIn && <button onClick={() => handleCheckIn(emp.id)} className="px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50">{t('hr.checkIn')}</button>}
                          {record?.checkIn && !record?.checkOut && <button onClick={() => handleCheckOut(emp.id)} className="px-2 py-1 text-xs bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50">{t('hr.checkOut')}</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll View */}
      {view === 'payroll' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.employeeName')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.baseSalary')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.commission')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.deductions')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.socialInsurance')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.netSalary')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {monthPayroll.map(pay => (
                  <tr key={pay.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{pay.employeeName}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(pay.baseSalary)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(pay.commission)}</td>
                    <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400">-{formatCurrency(pay.deductions)}</td>
                    <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400">-{formatCurrency(pay.socialInsurance)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-primary">{formatCurrency(pay.netSalary)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${pay.status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : pay.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'}`}>{t(`hr.${pay.status}`)}</span></td>
                    <td className="px-4 py-3">
                      {pay.status === 'draft' && <button onClick={() => handleApprovePayroll(pay.id)} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90">{t('hr.approve')}</button>}
                      {pay.status === 'approved' && <button className="px-2 py-1 text-xs bg-emerald-600 text-white dark:bg-emerald-500 rounded hover:bg-emerald-700 dark:hover:bg-emerald-600">{t('hr.pay')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {monthPayroll.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
          )}
        </div>
      )}

      {/* Advances View */}
      {view === 'advances' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.employeeName')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.advanceDate')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.advanceAmount')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.repaid')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('hr.remaining')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {employeeAdvances.map(adv => {
                  const remaining = adv.amount - (adv.repaidAmount || 0);
                  return (
                    <tr key={adv.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{isRTL ? (employees.find(e => e.id === adv.employeeId)?.nameAr) : adv.employeeName}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{adv.date}</td>
                      <td className="px-4 py-3 font-mono font-medium">{formatCurrency(adv.amount)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(adv.repaidAmount || 0)}</td>
                      <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${adv.status === 'repaid' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : adv.status === 'partial' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'}`}>
                          {adv.status === 'repaid' ? t('hr.advRepaid') : adv.status === 'partial' ? t('hr.advPartial') : t('hr.advPending')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {adv.status !== 'repaid' && (
                            <button onClick={() => handleRepayAdvance(adv)} className="px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50">{t('hr.repay')}</button>
                          )}
                          {can('hr', 'edit') && (
                            <button onClick={() => openEditAdvance(adv)} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Edit2 size={14} /></button>
                          )}
                          {can('hr', 'delete') && (
                            <button onClick={() => handleDeleteAdvance(adv.id)} className="p-1.5 rounded hover:bg-destructive/10 text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {employeeAdvances.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
          )}
        </div>
      )}

      {/* Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{editingAdvance ? t('common.edit') : t('hr.newAdvance')}</h3>
              <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('hr.employeeName')}</label>
                  <select value={advanceForm.employeeId} onChange={e => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card">
                    <option value="">{t('common.select')}</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{isRTL ? e.nameAr : e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('hr.advanceDate')}</label>
                  <input type="date" value={advanceForm.date} onChange={e => setAdvanceForm({ ...advanceForm, date: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('hr.advanceAmount')}</label>
                  <input type="number" value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('hr.repaid')}</label>
                  <input type="number" value={advanceForm.repaidAmount} onChange={e => setAdvanceForm({ ...advanceForm, repaidAmount: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('hr.reason')}</label>
                <input value={advanceForm.reason} onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('common.notes')}</label>
                <input value={advanceForm.notes} onChange={e => setAdvanceForm({ ...advanceForm, notes: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
              </div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowAdvanceModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleSaveAdvance} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{editingEmployee ? t('common.edit') : t('hr.newEmployee')}</h3>
              <button onClick={() => setShowEmployeeModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('hr.employeeNumber')}</label><input value={employeeForm.employeeNumber} onChange={e => setEmployeeForm({ ...employeeForm, employeeNumber: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('hr.hireDate')}</label><input type="date" value={employeeForm.hireDate} onChange={e => setEmployeeForm({ ...employeeForm, hireDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')} EN</label><input value={employeeForm.name} onChange={e => setEmployeeForm({ ...employeeForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')} AR</label><input value={employeeForm.nameAr} onChange={e => setEmployeeForm({ ...employeeForm, nameAr: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.phone')}</label><input value={employeeForm.phone} onChange={e => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.email')}</label><input value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('hr.jobTitle')}</label><input value={employeeForm.jobTitle} onChange={e => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('hr.department')}</label><input value={employeeForm.department} onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('hr.salary')}</label><input type="number" value={employeeForm.salary} onChange={e => setEmployeeForm({ ...employeeForm, salary: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('hr.commission')} %</label><input type="number" value={employeeForm.commissionRate} onChange={e => setEmployeeForm({ ...employeeForm, commissionRate: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" /></div>
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-3">
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Link2 size={16} className="text-primary" />
                  <p className="text-sm font-medium text-foreground">{t('hr.linkAccount')}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t('hr.linkHint')}</p>

                {linkedUser(employeeForm.userId) ? (
                  <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{linkedUser(employeeForm.userId)!.name}</span>
                      <span className="text-xs text-muted-foreground">{linkedUser(employeeForm.userId)!.email}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${linkedUser(employeeForm.userId)!.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{roleLabel(linkedUser(employeeForm.userId)!.role)}</span>
                      <button onClick={handleUnlinkUser} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"><Unlink size={12} /> {t('hr.unlink')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <select value={employeeForm.userId || ''} onChange={e => handleLinkUser(e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card">
                        <option value="">{t('hr.linkExisting')}</option>
                        {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder={t('common.password')} className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
                      <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)} className="px-3 py-2 border border-border rounded-lg text-sm bg-card">
                        {roles.filter(r => r.id !== 'owner').map(r => <option key={r.id} value={r.id}>{isRTL ? r.nameAr : r.name}</option>)}
                      </select>
                      <button onClick={handleCreateAndLinkUser} className="flex items-center justify-center gap-1 px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90"><UserPlus size={14} /> {t('hr.createAndLink')}</button>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground/70"><KeyRound size={12} /> {t('settings.errWeakPassword')}</p>
                  </div>
                )}
              </div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowEmployeeModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleSaveEmployee} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
