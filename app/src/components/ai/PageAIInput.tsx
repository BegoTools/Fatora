import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Send, Loader2, X, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { aiManager } from '@/services/ai';
import { buildAIContext } from '@/services/ai/context';
import { executeActionPlan } from '@/services/ai/actions';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { AI_PERMISSIONS, ACTION_LABELS } from '@/types/ai';
import type { AIActionPlan } from '@/types/ai';

interface PageAIInputProps {
  contextType?: string;
}

export function PageAIInput({ contextType }: PageAIInputProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user } = useAuth();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ text: string } | null>(null);
  const [pendingPlan, setPendingPlan] = useState<AIActionPlan | null>(null);

  const userRole = user?.role || 'employee';
  const allowedActions = AI_PERMISSIONS[userRole] || AI_PERMISSIONS.employee;

  const handleSubmit = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setLoading(true);
    setResponse(null);
    setPendingPlan(null);

    try {
      const context = buildAIContext(state.data);
      const aiResponse = await aiManager.sendMessage(msg, context, state.data);

      if (aiResponse.type === 'plan' && aiResponse.plan) {
        const plan = aiResponse.plan;
        const forbidden = plan.actions.filter(a => !allowedActions.includes(a.type));
        if (forbidden.length > 0) {
          setResponse({
            text: isRTL
              ? `⚠️ ليس لديك صلاحية لتنفيذ هذا الإجراء.`
              : `⚠️ You don't have permission for this action.`,
          });
          setLoading(false);
          return;
        }
        setPendingPlan(plan);
        setResponse({
          text: isRTL ? (plan.summaryAr || plan.summary) : plan.summary,
        });
      } else if (aiResponse.type === 'error') {
        setResponse({
          text: isRTL
            ? `⚠️ ${aiResponse.messageAr || aiResponse.message}`
            : `⚠️ ${aiResponse.message}`,
        });
      } else {
        setResponse({
          text: isRTL ? (aiResponse.messageAr || aiResponse.message) : aiResponse.message,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (isRTL ? 'حدث خطأ. يرجى المحاولة مرة أخرى.' : 'An error occurred.');
      setResponse({
        text: isRTL ? `⚠️ ${msg}` : `⚠️ ${msg}`,
      });
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
    setResponse({ text: lines });
    setPendingPlan(null);
  };

  const editPlan = () => {
    if (!pendingPlan) return;
    setInput(isRTL ? (pendingPlan.summaryAr || pendingPlan.summary) : pendingPlan.summary);
    setResponse({
      text: isRTL
        ? '✏️ عدّل طلبك ثم أرسله من جديد.'
        : '✏️ Edit your request then send it again.',
    });
    setPendingPlan(null);
  };

  const deletePlan = () => {
    setResponse({
      text: isRTL ? '🗑️ تم حذف الأمر.' : '🗑️ Command deleted.',
    });
    setPendingPlan(null);
  };

  const dismiss = () => {
    setResponse(null);
    setPendingPlan(null);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-3">
      <div className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Bot size={16} className="text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          {isRTL ? 'اسأل المساعد الذكي' : 'Ask AI Assistant'}
          {contextType ? ` (${contextType})` : ''}
        </span>
      </div>
      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder={isRTL ? 'اسأل أو اطلب أمراً...' : 'Ask or command...'}
          className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>

      {/* Response */}
      {response && (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg relative">
          <button onClick={dismiss} className="absolute top-2 right-2 p-0.5 rounded hover:bg-accent text-muted-foreground">
            <X size={14} />
          </button>
          <p className="text-sm text-foreground pr-6 whitespace-pre-wrap">{response.text}</p>

          {pendingPlan && (
            <>
              <ol className={`mt-2 space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                {pendingPlan.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">{i + 1}</span>
                    <span className="flex-1">
                      <span className="font-medium">{isRTL ? ACTION_LABELS[a.type].ar : ACTION_LABELS[a.type].en}: </span>
                      {isRTL ? (a.messageAr || a.message) : a.message}
                    </span>
                  </li>
                ))}
              </ol>
              <div className={`flex flex-wrap gap-2 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={confirmPlan}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                >
                  <CheckCircle size={14} />
                  {isRTL ? 'قبول' : 'Accept'}
                </button>
                <button
                  onClick={editPlan}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  <Pencil size={14} />
                  {isRTL ? 'تعديل' : 'Edit'}
                </button>
                <button
                  onClick={deletePlan}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                >
                  <Trash2 size={14} />
                  {isRTL ? 'حذف' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
