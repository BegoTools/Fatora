// ============================================================
// Easy Store ERP - طبقة الوصول للبيانات (Repository Layer)
// ============================================================
// تُوجَّه الآن إلى طبقة تخزين الملف (db/index.ts) التي تستخدم
// ملف JSON ذري على القرص عبر Tauri fs في الإنتاج (مع fallback
// إلى IndexedDB في وضع المتصفح). تم التخلص من مسار localStorage
// المتضارب السابق لمنع تفرّع البيانات بين مسارين.
// ============================================================

import type { AppState, IDataRepository } from '@/types';
import { loadState, saveState, resetState, exportState, importState } from '@/db';

/**
 * FileRepository
 * يُنفّذ واجهة IDataRepository فوق طبقة تخزين الملف (fileStore).
 * العمليات المتزامنة (load/save) تعمل على نسخة الذاكرة المُتزامنة،
 * بينما تتم الكتابة الفعلية على القرص بشكل ذرّي ومتسلسل.
 */
export class FileRepository implements IDataRepository {
  load(): AppState {
    return loadState();
  }

  save(state: AppState): void {
    saveState(state);
  }

  reset(): AppState {
    return resetState();
  }

  export(): string {
    return exportState();
  }

  import(json: string): boolean {
    return importState(json);
  }
}

// ============================================================
// مصدر البيانات الوحيد (Singleton)
// ============================================================
export const dataRepository: IDataRepository = new FileRepository();

// للحفاظ على التوافق مع الإصدارات الأقدم (أسماء قديمة قد تشير
// إليها ملفات خارجية) — موجّهة للطبقة الجديدة.
export { FileRepository as LocalStorageRepository };
