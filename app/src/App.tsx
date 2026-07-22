import { Suspense, lazy, useEffect } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LicenseProvider, useLicense } from '@/context/LicenseContext';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import './i18n';
import './App.css';

// Lazy load pages for performance
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('@/pages/Inventory').then(m => ({ default: m.Inventory })));
const Sales = lazy(() => import('@/pages/Sales').then(m => ({ default: m.Sales })));
const Customers = lazy(() => import('@/pages/Customers').then(m => ({ default: m.Customers })));
const Returns = lazy(() => import('@/pages/Returns').then(m => ({ default: m.Returns })));
const Exchange = lazy(() => import('@/pages/Exchange').then(m => ({ default: m.Exchange })));
const Purchases = lazy(() => import('@/pages/Purchases').then(m => ({ default: m.Purchases })));
const Expenses = lazy(() => import('@/pages/Expenses').then(m => ({ default: m.Expenses })));
const Treasury = lazy(() => import('@/pages/Treasury').then(m => ({ default: m.Treasury })));
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const HR = lazy(() => import('@/pages/HR').then(m => ({ default: m.HR })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));

function ModuleRouter() {
  const { state } = useApp();
  const { currentModule } = state.ui;

  switch (currentModule) {
    case 'dashboard': return <Dashboard />;
    case 'inventory': return <Inventory />;
    case 'sales': return <Sales />;
    case 'customers': return <Customers />;
    case 'returns': return <Returns />;
    case 'exchange': return <Exchange />;
    case 'purchases': return <Purchases />;
    case 'expenses': return <Expenses />;
    case 'treasury': return <Treasury />;
    case 'reports': return <Reports />;
    case 'hr': return <HR />;
    case 'settings': return <Settings />;
    default: return <Dashboard />;
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function AppContent() {
  const { setReadOnly } = useApp();
  const { info } = useLicense();

  // مزامنة حالة القراءة فقط مع حالة الترخيص
  useEffect(() => {
    setReadOnly(Boolean(info?.isReadOnly));
  }, [info, setReadOnly]);

  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <ModuleRouter />
      </Suspense>
    </Layout>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppProvider>
      <LicenseProvider>
        <AppContent />
      </LicenseProvider>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
