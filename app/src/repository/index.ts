// ============================================================
// Easy Store ERP - طبقة الوصول للبيانات (Repository Layer)
// ============================================================
// هذه الطبقة مسؤولة عن تخزين واسترجاع البيانات.
// حاليًا تستخدم localStorage، لكن يمكن استبدالها بقاعدة بيانات
// أو API دون التأثير على باقي أجزاء التطبيق.
// ============================================================

import type { AppState, IDataRepository } from '@/types';
import { getDefaultState } from '@/db';

const STORAGE_KEY = 'easy_store_erp_data';

/**
 * LocalStorageRepository
 * تنفذ واجهة IDataRepository باستخدام localStorage
 * يمكن استبدالها بـ APIRepository أو SQLRepository لاحقًا
 */
export class LocalStorageRepository implements IDataRepository {
  load(): AppState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // في حالة خطأ، نعيد البيانات الافتراضية
    }
    const defaultState = getDefaultState();
    this.save(defaultState);
    return defaultState;
  }

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      console.warn('⚠️ فشل حفظ البيانات إلى localStorage');
    }
  }

  reset(): AppState {
    const fresh = getDefaultState();
    this.save(fresh);
    return fresh;
  }

  export(): string {
    const state = this.load();
    return JSON.stringify(state, null, 2);
  }

  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================
// مصدر البيانات الوحيد (Singleton)
// ============================================================
export const dataRepository: IDataRepository = new LocalStorageRepository();
