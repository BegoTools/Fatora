import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Mail, Lock, User as UserIcon, Loader2, Eye, EyeOff, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { AuthResult } from '@/services/auth';

export function Login() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { login, register, hasAccounts } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(hasAccounts ? 'login' : 'register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const errorMessage = (code: AuthResult['error']): string => {
    const map: Record<string, { en: string; ar: string }> = {
      email_exists: { en: 'This email is already registered.', ar: 'هذا البريد مسجّل بالفعل.' },
      invalid_credentials: { en: 'Incorrect email or password.', ar: 'البريد أو كلمة السر غير صحيحة.' },
      not_found: { en: 'Account not found.', ar: 'الحساب غير موجود.' },
      inactive: { en: 'This account is disabled.', ar: 'هذا الحساب معطّل.' },
      weak_password: { en: 'Password must be at least 6 characters.', ar: 'كلمة السر يجب ألا تقل عن 6 أحرف.' },
      invalid_input: { en: 'Please fill in all fields correctly.', ar: 'يرجى تعبئة جميع الحقول بشكل صحيح.' },
    };
    const entry = code ? map[code] : undefined;
    if (!entry) return isRTL ? 'حدث خطأ، حاول مرة أخرى.' : 'Something went wrong, try again.';
    return isRTL ? entry.ar : entry.en;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = mode === 'login'
      ? await login(email, password)
      : await register(name, email, password);
    setLoading(false);
    if (!result.ok) {
      setError(errorMessage(result.error));
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('i18nextLng', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <button
        onClick={toggleLanguage}
        className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors`}
      >
        <Globe size={16} />
        {isRTL ? 'English' : 'العربية'}
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-[#00355f] flex items-center justify-center mb-4 shadow-lg">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('app.name')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login'
              ? (isRTL ? 'سجّل الدخول للمتابعة' : 'Sign in to continue')
              : (isRTL ? 'أنشئ حسابك للبدء' : 'Create your account to get started')}
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-xl p-6">
          {!hasAccounts && mode === 'register' && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-xs text-center">
              {isRTL
                ? 'أول حساب يتم إنشاؤه سيكون حساب المالك بكامل الصلاحيات.'
                : 'The first account created will be the owner with full permissions.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {isRTL ? 'الاسم' : 'Name'}
                </label>
                <div className="relative">
                  <UserIcon size={16} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-muted-foreground`} />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className={`w-full py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder={isRTL ? 'اسمك الكامل' : 'Your full name'}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <div className="relative">
                <Mail size={16} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-muted-foreground`} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={`w-full py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
                  placeholder="name@example.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {isRTL ? 'كلمة السر' : 'Password'}
              </label>
              <div className="relative">
                <Lock size={16} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-muted-foreground`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={`w-full py-2.5 ${isRTL ? 'pr-9 pl-9' : 'pl-9 pr-9'} bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-muted-foreground hover:text-foreground`}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login'
                ? (isRTL ? 'تسجيل الدخول' : 'Sign In')
                : (isRTL ? 'إنشاء حساب' : 'Create Account')}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                {isRTL ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); }}
                  className="text-primary font-medium hover:underline"
                >
                  {isRTL ? 'أنشئ حساباً' : 'Sign up'}
                </button>
              </>
            ) : (
              <>
                {isRTL ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-primary font-medium hover:underline"
                >
                  {isRTL ? 'تسجيل الدخول' : 'Sign in'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
