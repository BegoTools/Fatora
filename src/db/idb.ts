// ============================================================
// Easy Store ERP - طبقة قاعدة البيانات المحلية (IndexedDB)
// ------------------------------------------------------------
// غلاف بسيط بدون مكتبات خارجية حول IndexedDB يوفّر تخزينًا
// محليًا احترافيًا (key/value) داخل المتصفح.
// ============================================================

const DB_NAME = 'easy_store_erp';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('IndexedDB open timeout'));
    }, 3000);

    if (typeof indexedDB === 'undefined') {
      clearTimeout(timeout);
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => {
        clearTimeout(timeout);
        resolve(req.result);
      };
      req.onerror = () => {
        clearTimeout(timeout);
        reject(req.error);
      };
      req.onblocked = () => {
        clearTimeout(timeout);
        reject(new Error('IndexedDB blocked'));
      };
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result ?? null) as T | null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('idbGet fallback:', err);
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('idbSet fallback:', err);
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('idbDelete fallback:', err);
  }
}

export async function idbClear(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('idbClear fallback:', err);
  }
}
