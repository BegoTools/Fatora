import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Send, Loader2, AlertCircle, CheckCircle, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { aiManager } from '@/services/ai';
import { buildAIContext } from '@/services/ai/context';
import { executeActionPlan } from '@/services/ai/actions';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { AI_PERMISSIONS, ACTION_LABELS } from '@/types/ai';
import type { AIResponse, AIActionPlan } from '@/types/ai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  plan?: AIActionPlan;
}

export function AIChat() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AIActionPlan | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userRole = user?.role || 'employee';
  const allowedActions = AI_PERMISSIONS[userRole] || AI_PERMISSIONS.employee;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const context = buildAIContext(state.data);
      const response: AIResponse = await aiManager.sendMessage(msg, context, state.data);

      if (response.type === 'plan' && response.plan) {
        const plan = response.plan;
        const forbidden = plan.actions.filter(a => !allowedActions.includes(a.type));
        if (forbidden.length > 0) {
          const names = forbidden.map(a => isRTL ? ACTION_LABELS[a.type].ar : ACTION_LABELS[a.type].en).join('، ');
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: isRTL
              ? `⚠️ ليس لديك صلاحية لتنفيذ: ${names}. يرجى التواصل مع المدير.`
              : `⚠️ You don't have permission for: ${names}. Please contact your manager.`,
          }]);
          setLoading(false);
          return;
        }
        setPendingPlan(plan);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: isRTL ? (plan.summaryAr || plan.summary) : plan.summary,
          plan,
        }]);
      } else if (response.type === 'error') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: isRTL
            ? `⚠️ ${response.messageAr || response.message}`
            : `⚠️ ${response.message}`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: isRTL ? (response.messageAr || response.message) : response.message,
        }]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (isRTL ? 'حدث خطأ. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isRTL ? `⚠️ ${msg}` : `⚠️ ${msg}`,
      }]);
    }
    setLoading(false);
  };

  const confirmPlan = () => {
    if (!pendingPlan) return;
    const { results, navigate } = executeActionPlan(
      pendingPlan.actions,
      (action) => dispatch(action as never),
      state.data
    );
    if (navigate) {
      dispatch({ type: 'SET_MODULE', payload: navigate as 'dashboard' | 'inventory' | 'sales' | 'purchases' | 'treasury' | 'reports' | 'hr' | 'settings' });
    }
    const lines = results.map((r, i) => `${r.success ? '✅' : '❌'} ${i + 1}. ${r.message}`).join('\n');
    const allOk = results.every(r => r.success);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: (isRTL
        ? (allOk ? 'تم تنفيذ كل الخطوات بنجاح:' : 'اكتمل التنفيذ مع بعض المشاكل:')
        : (allOk ? 'All steps executed successfully:' : 'Completed with some issues:')) + '\n' + lines,
    }]);
    setPendingPlan(null);
  };

  const editPlan = () => {
    if (!pendingPlan) return;
    setInput(isRTL ? (pendingPlan.summaryAr || pendingPlan.summary) : pendingPlan.summary);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: isRTL
        ? '✏️ عدّل طلبك في مربع الكتابة ثم أرسله من جديد لأعيد التخطيط.'
        : '✏️ Edit your request in the input box then send it again to re-plan.',
    }]);
    setPendingPlan(null);
    inputRef.current?.focus();
  };

  const deletePlan = () => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: isRTL ? '🗑️ تم حذف الأمر ولم يتم تنفيذ أي شيء.' : '🗑️ Command deleted. Nothing was executed.',
    }]);
    setPendingPlan(null);
  };

  const clearChat = () => {
    setMessages([]);
    aiManager.clearHistory();
    setPendingPlan(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[#00355f] text-white shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 flex items-center justify-center group"
        title={isRTL ? 'المساعد الذكي' : 'AI Assistant'}
      >
        <Bot size={28} className="group-hover:animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-[#00355f] text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Bot size={20} />
          <div>
            <h3 className="text-sm font-semibold">
              {isRTL ? 'المساعد الذكي' : 'AI Assistant'}
            </h3>
            <p className="text-[10px] opacity-80">
              {isRTL ? 'مدعوم من Google Gemini' : 'Powered by Google Gemini'}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title={isRTL ? 'مسح المحادثة' : 'Clear chat'}
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-h-[400px] p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {isRTL ? 'مرحباً! كيف يمكنني مساعدتك؟' : 'Hello! How can I help you?'}
            </p>
            <p className="text-xs mt-1">
              {isRTL
                ? 'يمكنك سؤالي أو طلب تنفيذ إجراء مثل إضافة صنف أو إنشاء تقرير'
                : 'Ask me questions or request actions like adding items or creating reports'}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.plan && (
                <ol className={`mt-3 pt-2 border-t border-border/50 space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {msg.plan.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">{i + 1}</span>
                      <span className="flex-1">
                        <span className="font-medium">{isRTL ? ACTION_LABELS[a.type].ar : ACTION_LABELS[a.type].en}: </span>
                        {isRTL ? (a.messageAr || a.message) : a.message}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 size={18} className="animate-spin text-primary" />
            </div>
          </div>
        )}

        {/* Plan Confirmation */}
        {pendingPlan && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {isRTL ? 'مراجعة قبل التنفيذ' : 'Review before executing'}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {isRTL
                    ? `سيتم تنفيذ ${pendingPlan.actions.length} خطوة. اختر الإجراء:`
                    : `${pendingPlan.actions.length} step(s) will be executed. Choose an action:`}
                </p>
                <div className={`flex flex-wrap gap-2 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={confirmPlan}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={14} />
                    {isRTL ? 'قبول' : 'Accept'}
                  </button>
                  <button
                    onClick={editPlan}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Pencil size={14} />
                    {isRTL ? 'تعديل' : 'Edit'}
                  </button>
                  <button
                    onClick={deletePlan}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                    {isRTL ? 'حذف' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            placeholder={isRTL ? 'اسأل أو اطلب أمراً...' : 'Ask or command...'}
            className="flex-1 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {isRTL
            ? 'يمكنك طلب إضافة صنف، مورد، عميل، أو أي إجراء آخر'
            : 'You can ask questions or request actions like adding items'}
        </p>
      </div>
    </div>
  );
}
