import type { AIProvider, AppState } from '@/types';
import { getDefaultState } from '@/db';
import { GeminiProvider } from './gemini';
import { PERMISSION_MODULES, normalizePermissions } from '@/types/permissions';
import type { RolePermissions } from '@/types/permissions';
import type { AIResponse, AIAction } from '@/types/ai';
import { parseLocally, handleOfflineQuery } from './localParser';

export type AssistantType =
  | 'general'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'reports'
  | 'treasury';

const ACTION_SYSTEM_PROMPT = `
You are an AI assistant for Easy Store ERP, a store management system.
You can answer questions AND perform real actions in the system on the user's behalf.

## CRITICAL FORMAT RULES (MUST FOLLOW):
- You MUST respond with ONLY a single valid JSON object.
- Do NOT use markdown code blocks (no \`\`\` fences, no \`\`\`json).
- Do NOT add any explanation, greeting, or text before or after the JSON.
- Output the raw JSON object only and nothing else.
- Always respond in the SAME language as the user's message (Arabic user => Arabic messages).

## Response Types:
1. QUESTION (info/advice only, no changes needed):
   {"type":"question","message":"English answer","messageAr":"إجابة بالعربية"}

2. PLAN (the user asked you to DO something — ALWAYS use this for any create/add/update/navigate request).
   A plan contains one OR MORE ordered steps that will be executed together after the user approves:
   {"type":"plan","summary":"Short English summary","summaryAr":"ملخص قصير بالعربية","actions":[
     {"type":"ACTION_TYPE","data":{...},"message":"Step description EN","messageAr":"وصف الخطوة بالعربية"}
   ]}

3. ERROR (cannot do it):
   {"type":"error","message":"...","messageAr":"..."}

## IMPORTANT BEHAVIOR:
- When the user describes a purchase (e.g. "I bought 50 phones, purchase price 10, sale price 12"), you MUST create a single CREATE_PURCHASE action. The system AUTOMATICALLY creates the item if it does not exist AND increases the stock quantity in inventory — you do NOT need a separate ADD_ITEM step, but you MAY include one first if you want to define the item explicitly.
- When the user describes a sale, use CREATE_SALE. The system automatically decreases stock.
- Break compound requests into multiple ordered steps inside "actions".
- Never just describe the action in a "question" — always output a "plan" so the system can execute it.

## Available Actions (ACTION_TYPE + data fields):
- CREATE_PURCHASE: Record a purchase (auto-creates missing items + increases stock). data: { supplierName?, supplierId?, paid?, discount?, shippingCost?, notes?, items: [ { name, nameAr?, unit?, quantity, purchasePrice, salePrice? } ] }
- CREATE_SALE: Record a sale (decreases stock). data: { customerName?, customerId?, paid?, discount?, paymentMethod? (cash/card/installment/wallet/credit), notes?, items: [ { name, quantity, unitPrice? } ] }
- ADD_ITEM: Add new inventory item. data: { name, nameAr, barcode?, categoryId?, unit, purchasePrice, salePrice, wholesalePrice?, stockQuantity?, minStockLevel? }
- UPDATE_ITEM: Update existing item. data: { id (required), name?, nameAr?, purchasePrice?, salePrice?, stockQuantity? }
- ADD_SUPPLIER: data: { name, nameAr?, phone?, email?, address? }
- ADD_CUSTOMER: data: { name, nameAr?, phone?, email?, address?, creditLimit? }
- ADD_TRANSACTION: Add treasury transaction. data: { accountId?, type (income/expense), amount, description, category? }
- ADD_EMPLOYEE: data: { name, nameAr?, phone?, jobTitle?, department?, salary?, commissionRate? }
- NAVIGATE: data: { module (dashboard/inventory/sales/purchases/treasury/reports/hr/settings) }

## Example (Arabic purchase request):
User: اشتريت 50 تليفون سعر الشراء 10 وسعر البيع 12
Response:
{"type":"plan","summary":"Record purchase of 50 phones","summaryAr":"تسجيل شراء 50 تليفون وإضافتها للمخزون","actions":[{"type":"CREATE_PURCHASE","data":{"supplierName":"مورد نقدي","items":[{"name":"Phone","nameAr":"تليفون","unit":"piece","quantity":50,"purchasePrice":10,"salePrice":12}]},"message":"Create purchase of 50 phones and add them to stock","messageAr":"إنشاء فاتورة شراء 50 تليفون وإضافتها للمخزون تلقائياً"}]}
`;

export class AIAssistantManager {
  private provider: AIProvider;
  private conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  private assistantType: AssistantType = 'general';

  constructor(provider?: AIProvider) {
    this.provider = provider || new GeminiProvider();
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
    this.conversationHistory = [];
  }

  getProviderName(): string {
    return this.provider.name;
  }

  setAssistantType(type: AssistantType): void {
    this.assistantType = type;
  }

  private getSystemContext(): string {
    const contexts: Record<AssistantType, string> = {
      general: `أنت مساعد ذكي لنظام Easy Store ERP (نظام إدارة المخازن والمبيعات). يمكنك الإجابة عن أسئلة المستخدمين حول التطبيق ومساعدة في جميع المهام.`,
      inventory: `أنت خبير في إدارة المخزون. يمكنك المساعدة في: تتبع المخزون والأصناف، التنبيه عند نفاد المخزون، تحليل حركة المخزون، اقتراح طلبات الشراء`,
      sales: `أنت خبير في المبيعات ونقاط البيع. يمكنك المساعدة في: تحليل المبيعات، إدارة العملاء، متابعة الفواتير والمدفوعات`,
      purchases: `أنت خبير في المشتريات والموردين. يمكنك المساعدة في: إدارة أوامر الشراء، متابعة الموردين، تحليل تكاليف المشتريات`,
      customers: `أنت خبير في إدارة علاقات العملاء. يمكنك المساعدة في: تحليل بيانات العملاء، متابعة أرصدة العملاء`,
      reports: `أنت خبير في التقارير والتحليلات. يمكنك المساعدة في: إنشاء تقارير مخصصة، تحليل الأداء المالي`,
      treasury: `أنت خبير في إدارة الخزينة والحسابات. يمكنك المساعدة في: متابعة الحركات المالية، إدارة الحسابات البنكية`,
    };
    return contexts[this.assistantType] || contexts.general;
  }

  async sendMessage(message: string, contextData?: string, state?: AppState): Promise<AIResponse> {
    const currentState: AppState = state || getDefaultState();

    if (!this.provider.isAvailable()) {
      const localResult = parseLocally(message, currentState);
      if (localResult) {
        localResult.messageAr = `⚠️ [وضع محلي - بدون اتصال]: ${localResult.messageAr}`;
        localResult.message = `⚠️ [Local Mode - Offline]: ${localResult.message}`;
        return this.normalizeLocal(localResult);
      }
      return handleOfflineQuery(message, currentState);
    }

    try {
      this.conversationHistory.push({ role: 'user', content: message });

      const systemContext = this.getSystemContext();
      const fullContext = `
        ${ACTION_SYSTEM_PROMPT}

        ${systemContext}

        ## Current System Data:
        ${contextData || 'No additional data available'}

        ## Conversation History:
        ${this.conversationHistory.slice(-10).map(msg =>
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n')}

        User's new message: ${message}
      `;

      const response = await this.provider.generateResponse(
        'Respond with the appropriate JSON or text as instructed.',
        fullContext
      );

      this.conversationHistory.push({ role: 'assistant', content: response });

      const parsed = this.parseResponse(response);
      return parsed;
    } catch (error) {
      console.warn('Gemini API Error, falling back to local parsing:', error);
      const localResult = parseLocally(message, currentState);
      if (localResult) {
        localResult.messageAr = `⚠️ [وضع محلي - خطأ في الاتصال]: ${localResult.messageAr}`;
        localResult.message = `⚠️ [Local Fallback - Connection error]: ${localResult.message}`;
        return this.normalizeLocal(localResult);
      }
      return handleOfflineQuery(message, currentState);
    }
  }

  private normalizeLocal(res: AIResponse): AIResponse {
    if (res.type === 'action' && res.action) {
      return {
        type: 'plan',
        message: res.message,
        messageAr: res.messageAr,
        action: res.action,
        plan: {
          summary: res.action.message || res.message || '',
          summaryAr: res.action.messageAr || res.messageAr || '',
          actions: [res.action],
        },
      };
    }
    return res;
  }

  private parseResponse(response: string): AIResponse {
    try {
      const jsonStr = this.extractJson(response);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === 'plan' && Array.isArray(parsed.actions)) {
          const actions = parsed.actions as AIAction[];
          return {
            type: 'plan',
            message: parsed.summary || parsed.message || '',
            messageAr: parsed.summaryAr || parsed.messageAr || '',
            plan: {
              summary: parsed.summary || parsed.message || '',
              summaryAr: parsed.summaryAr || parsed.messageAr || '',
              actions,
            },
          };
        }
        if (parsed.type === 'action' && parsed.action) {
          const action = parsed.action as AIAction;
          return {
            type: 'plan',
            message: action.message || parsed.message || '',
            messageAr: action.messageAr || parsed.messageAr || '',
            action,
            plan: {
              summary: action.message || '',
              summaryAr: action.messageAr || '',
              actions: [action],
            },
          };
        }
        if (parsed.type === 'error') {
          return { type: 'error', message: parsed.message || '', messageAr: parsed.messageAr || '' };
        }
        if (parsed.type === 'question') {
          return { type: 'question', message: parsed.message || response, messageAr: parsed.messageAr || response };
        }
      }
    } catch {
      // Not JSON - treat as regular question response
    }
    return { type: 'question', message: response, messageAr: response };
  }

  private extractJson(text: string): string | null {
    let s = text.trim();
    // Remove markdown code fences (```json ... ``` or ``` ... ```)
    s = s.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return s.substring(first, last + 1);
    }
    return null;
  }

  /**
   * Uses the AI model to suggest a permission set for a custom role based on its name/description.
   * Falls back to an empty permission set if the provider is unavailable or the response is invalid.
   */
  async suggestRolePermissions(roleName: string, description: string): Promise<RolePermissions> {
    if (!this.provider.isAvailable()) return normalizePermissions({});
    const modules = PERMISSION_MODULES.join(', ');
    const prompt =
      `You are designing an access-control matrix for an ERP system. ` +
      `For a role named "${roleName}"${description ? ` (${description})` : ''}, decide which modules it should access and which actions. ` +
      `Respond with ONLY a JSON object. Each key is one of these modules: ${modules}. ` +
      `Each value is an object with boolean fields: view, create, edit, delete. ` +
      `Set "view": true for every module the role should see. Output JSON only, no explanation.`;
    try {
      const raw = await this.provider.generateResponse(prompt, 'You are a permissions designer. Output a JSON object only, no markdown.');
      const jsonStr = this.extractJson(raw);
      if (!jsonStr) return normalizePermissions({});
      return normalizePermissions(JSON.parse(jsonStr));
    } catch (err) {
      console.warn('suggestRolePermissions failed:', err);
      return normalizePermissions({});
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }
}

export const aiManager = new AIAssistantManager();
