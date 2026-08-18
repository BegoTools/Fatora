// ============================================================
// Easy Store ERP - مزود Google Gemini AI
// ============================================================
// يمكن استبدال هذا الملف بمزود آخر (OpenAI, Claude...) مع
// الحفاظ على نفس الواجهة (AIProvider Interface).
// ============================================================

import type { AIProvider } from '@/types';

const KEY_API_KEY = 'easy_store_gemini_key';

// قائمة الموديلات المجانية مرتبة من الأحدث للأقدم
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

// ============================================================
// Gemini Provider
// يستخدم Gemini API (الخطة المجانية مع دعم التبديل التلقائي)
// يتم ضبط المفتاح من صفحة الإعدادات - تبويب «المساعد الذكي»
// ============================================================
// ============================================================
// Simple synchronous obfuscation to avoid plain-text storage
// ============================================================
function obfuscateKey(key: string): string {
  if (!key) return key;
  return btoa(key.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ (i % 255))).join(''));
}

function deobfuscateKey(obfuscated: string): string {
  if (!obfuscated) return obfuscated;
  try {
    return atob(obfuscated).split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ (i % 255))).join('');
  } catch (_e) {
    return obfuscated; // fallback if it was saved un-obfuscated previously
  }
}

export class GeminiProvider implements AIProvider {
  name = 'Google Gemini';

  // ============================================================
  // الحصول على مفتاح API من التخزين المحلي أو متغير البيئة فقط.
  // لا يوجد مفتاح احتياطي مضمّن لأسباب أمنية — المنتج يعمل كاملًا
  // بدون الذكاء الاصطناعي عبر محلل الأوامر المحلي (localParser).
  // ============================================================
  private getApiKey(): string {
    const stored = localStorage.getItem(KEY_API_KEY);
    if (stored) return deobfuscateKey(stored);
    return (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_GEMINI_API_KEY) || '';
  }

  // ============================================================
  // حفظ مفتاح API
  // ============================================================
  static saveApiKey(key: string): void {
    localStorage.setItem(KEY_API_KEY, obfuscateKey(key));
  }

  // ============================================================
  // حذف مفتاح API
  // ============================================================
  static clearApiKey(): void {
    localStorage.removeItem(KEY_API_KEY);
  }

  // ============================================================
  // التحقق من توفر المزود
  // ============================================================
  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  // ============================================================
  // إنشاء رد من Gemini API مع التراجع التلقائي للموديلات (Auto-Fallback)
  // ============================================================
  async generateResponse(prompt: string, context?: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('مفتاح API غير مضبوط');
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: context ? `${context}\n\nسؤال المستخدم: ${prompt}` : prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.95,
        topK: 40,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    let lastError: Error | null = null;

    // محاولة الاتصال بالموديلات بالتوالي من الأحدث للأقدم
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      console.log(`AI Assistant: Trying model '${model}'...`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          let apiMessage = '';
          try {
            const errJson = JSON.parse(errText);
            apiMessage = errJson?.error?.message || '';
          } catch {
            apiMessage = errText;
          }

          if (response.status === 403 || response.status === 401) {
            throw new Error('مفتاح API غير صالح. يرجى التحقق من المفتاح في الإعدادات.');
          }

          throw new Error(apiMessage || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          console.log(`AI Assistant: Model '${model}' succeeded.`);
          return text;
        }

        throw new Error('Empty response from model');
      } catch (err) {
        console.warn(`AI Assistant: Model '${model}' failed:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        // الانتقال للموديل التالي في القائمة تلقائياً
      }
    }

    // إذا فشلت جميع المحاولات لجميع الموديلات
    throw lastError || new Error('حدث خطأ في الاتصال بجميع موديلات الذكاء الاصطناعي.');
  }
}
