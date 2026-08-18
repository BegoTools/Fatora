import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Download } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleExport = () => {
    const errorData = {
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      time: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(errorData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  public render() {
    if (this.state.hasError) {
      const isRTL = document.documentElement.dir === 'rtl' || localStorage.getItem('i18nextLng') === 'ar';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-card max-w-md w-full rounded-2xl border border-border shadow-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">
                {isRTL ? 'عذراً، حدث خطأ غير متوقع' : 'Oops, an unexpected error occurred'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRTL 
                  ? 'لقد واجه التطبيق مشكلة. يمكنك إعادة تحميل الصفحة أو تصدير تفاصيل الخطأ لدعم العملاء.'
                  : 'The application encountered a problem. You can reload the page or export the error details for support.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <RefreshCcw size={18} />
                {isRTL ? 'إعادة تحميل' : 'Reload Page'}
              </button>
              <button
                onClick={this.handleExport}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-muted text-foreground border border-border rounded-lg font-medium hover:bg-accent transition-colors"
              >
                <Download size={18} />
                {isRTL ? 'تصدير الخطأ' : 'Export Error'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
