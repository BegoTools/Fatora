import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, Landmark,
  BarChart3, Users, Settings, ChevronLeft, ChevronRight, Bell,
  Search, Menu, X, LogOut, Globe, Moon, Sun, HelpCircle,
  UserSquare2, RotateCcw, ArrowLeftRight, PlusCircle, Wallet
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import type { ModuleId } from '@/types';
import { AIChat } from './ai/AIChat';
import { Toaster } from './ui/sonner';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const moduleIcons: Record<ModuleId, React.ReactNode> = {
  dashboard: <LayoutDashboard size={20} />,
  inventory: <Package size={20} />,
  sales: <ShoppingCart size={20} />,
  customers: <UserSquare2 size={20} />,
  returns: <RotateCcw size={20} />,
  exchange: <ArrowLeftRight size={20} />,
  purchases: <Receipt size={20} />,
  expenses: <Wallet size={20} />,
  treasury: <Landmark size={20} />,
  reports: <BarChart3 size={20} />,
  hr: <Users size={20} />,
  settings: <Settings size={20} />,
};

const moduleOrder: ModuleId[] = [
  'dashboard', 'customers', 'inventory', 'purchases', 'sales', 'returns', 'exchange',
  'expenses', 'treasury', 'reports', 'hr', 'settings',
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { state, setModule } = useApp();
  const { user, logout, currentRole, can } = useAuth();
  const { t, i18n } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setDarkMode(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const current = state.ui.currentModule;
    if (!can(current, 'view')) {
      const first = moduleOrder.find(mod => can(mod, 'view'));
      if (first && first !== current) setModule(first);
    }
  }, [user, state.ui.currentModule, can, setModule]);

  const unreadCount = state.data.notifications.filter(n => !n.isRead).length;

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('i18nextLng', newLang);
  };

  const toggleDarkMode = () => {
    const isDark = !darkMode;
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleModuleClick = (module: ModuleId) => {
    setModule(module);
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    void logout();
  };

  const displayName = user?.name || '';
  const roleLabel = currentRole ? (isRTL ? currentRole.nameAr : currentRole.name) : (user?.role ?? '');
  const visibleModules = moduleOrder.filter(mod => can(mod, 'view'));
  const company = state.data.company;
  const companyName = isRTL ? (company.nameAr || company.name) : (company.name || company.nameAr);
  const handleNewSale = () => { setModule('sales'); setMobileMenuOpen(false); };

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-screen bg-tertiary text-tertiary-foreground z-50 transition-all duration-300 flex flex-col
          ${sidebarCollapsed ? 'w-[72px]' : 'w-[280px]'}
          ${mobileMenuOpen ? 'translate-x-0' : ''}
          ${isRTL && !mobileMenuOpen ? 'translate-x-full md:translate-x-0' : ''}
          ${!isRTL && !mobileMenuOpen ? '-translate-x-full md:translate-x-0' : ''}
        `}
      >
        <div className={`h-16 flex items-center border-b border-tertiary-foreground/10 ${sidebarCollapsed ? 'justify-center px-2' : 'px-5'} ${isRTL ? 'flex-row-reverse' : ''}`}>
          {sidebarCollapsed ? (
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              {company.logo ? (
                <img src={company.logo} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-tertiary font-bold text-sm">{companyName.charAt(0)}</span>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1">
                {company.logo ? (
                  <img src={company.logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-tertiary font-bold text-base">{companyName.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-tertiary-foreground text-sm leading-tight truncate">{companyName}</h1>
                <p className="text-[10px] text-tertiary-foreground/70 truncate">{t('app.tagline')}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex ml-auto text-tertiary-foreground/70 hover:text-tertiary-foreground transition-colors"
          >
            {sidebarCollapsed
              ? (isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
              : (isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
            }
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden absolute top-4 text-tertiary-foreground/70"
            style={{ [isRTL ? 'left' : 'right']: '1rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-4 pt-4">
            <button
              onClick={handleNewSale}
              className="w-full bg-success text-success-foreground py-3 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all font-semibold text-sm"
            >
              <PlusCircle size={18} />
              {t('sales.newSale')}
            </button>
          </div>
        )}

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {!sidebarCollapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold text-tertiary-foreground/50 uppercase tracking-wider">
              {t('nav.modules')}
            </p>
          )}

          {visibleModules.map((mod) => {
            const isActive = state.ui.currentModule === mod;
            return (
              <button
                key={mod}
                onClick={() => handleModuleClick(mod)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-tertiary-container text-tertiary-on-container font-semibold'
                    : 'text-tertiary-foreground/80 hover:bg-tertiary-container/50 hover:text-tertiary-foreground'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                  ${isRTL ? 'flex-row-reverse' : ''}
                `}
                title={sidebarCollapsed ? t(`nav.${mod}`) : undefined}
              >
                <span className={isActive ? 'text-tertiary-on-container' : 'text-tertiary-foreground/70 group-hover:text-tertiary-foreground'}>
                  {moduleIcons[mod]}
                </span>
                {!sidebarCollapsed && (
                  <span className="text-sm">{t(`nav.${mod}`)}</span>
                )}
                {sidebarCollapsed && (
                  <span className={`absolute ${isRTL ? 'right-full mr-2' : 'left-full ml-2'} px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50`}>
                    {t(`nav.${mod}`)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-tertiary-foreground/10 space-y-1">
          {!sidebarCollapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('nav.system')}
            </p>
          )}
          <button
            onClick={toggleLanguage}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary-foreground/80 hover:bg-tertiary-container/50 transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
            title={sidebarCollapsed ? t('common.language') : undefined}
          >
            <Globe size={18} />
            {!sidebarCollapsed && <span className="text-sm">{isRTL ? 'English' : 'العربية'}</span>}
          </button>
          <button
            onClick={toggleDarkMode}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary-foreground/80 hover:bg-tertiary-container/50 transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            {!sidebarCollapsed && <span className="text-sm">{darkMode ? 'Light' : 'Dark'}</span>}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary-foreground/80 hover:bg-error-container hover:text-on-error-container transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="text-sm">{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px] md:mr-0' : 'md:ml-[280px] md:mr-0'} ${isRTL ? 'md:mr-[280px] md:ml-0' : ''}`}>
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="h-16 px-4 md:px-6 flex items-center justify-between">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <Menu size={20} />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  {t(`${state.ui.currentModule}.title`)}
                </h2>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {t(`${state.ui.currentModule}.subtitle`)}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="relative">
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors relative"
                >
                  <Search size={20} />
                </button>
                {searchOpen && (
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-72 bg-card rounded-xl shadow-lg border border-border p-3 z-50`}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('common.search')}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <button className="hidden sm:flex p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                <HelpCircle size={20} />
              </button>

              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors relative"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-destructive-foreground font-bold">{unreadCount}</span>
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-80 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-foreground">{t('dashboard.alerts.title')}</h3>
                      <span className="text-xs text-muted-foreground">{unreadCount} {t('common.new')}</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {state.data.notifications.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground text-center">{t('notifications.empty')}</p>
                      ) : (
                        state.data.notifications.slice(0, 5).map(notif => (
                          <div
                            key={notif.id}
                            className={`px-4 py-3 border-b border-border hover:bg-accent cursor-pointer transition-colors ${!notif.isRead ? 'bg-primary/5' : ''}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                notif.type === 'error' ? 'bg-red-500 dark:bg-red-400' :
                                notif.type === 'warning' ? 'bg-amber-500 dark:bg-amber-400' :
                                notif.type === 'success' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-primary'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {isRTL ? notif.titleAr : notif.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {isRTL ? notif.messageAr : notif.message}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-2 border-t border-border text-center">
                      <button className="text-xs text-primary font-medium hover:underline">
                        {t('dashboard.alerts.viewAll')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-accent transition-colors ${isRTL ? 'flex-row-reverse pl-3 pr-2' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-xs font-bold">{getInitials(displayName)}</span>
                  </div>
                  <div className={`hidden md:block ${isRTL ? 'text-right' : 'text-left'}`}>
                    <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
                  </div>
                </button>

                {profileOpen && (
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-56 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setModule('settings'); setProfileOpen(false); }}
                        className={`w-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                      >
                        <Settings size={14} /> {t('nav.settings')}
                      </button>
                      <button
                        onClick={handleLogout}
                        className={`w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                      >
                        <LogOut size={14} /> {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>

      <AIChat />
      <Toaster position={isRTL ? 'bottom-left' : 'bottom-right'} richColors closeButton />
    </>
  );
}
