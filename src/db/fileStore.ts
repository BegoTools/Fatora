import type { AppState } from '@/types';
import { supabase } from '@/services/supabase';
import { getCurrentUser } from '@/services/auth';
import { idbGet, idbSet, idbClear } from './idb';

let fileCache: AppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let isWritePending = false;

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs = 6000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('Timed out loading team data')), timeoutMs); }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function getFileCache(): AppState | null {
  return fileCache;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined'
    && (Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
      || Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__));
}

export function setFileCache(state: AppState): void {
  fileCache = state;
}

export async function forceSync(): Promise<boolean> {
  const local = await idbGet<AppState>('state');
  const hasPendingSync = await idbGet<boolean>('hasPendingSync');
  
  if (!hasPendingSync || !local) return true;
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));
  }
  
  try {
    const user = await getCurrentUser();
    if (user && user.teamId) {
      const { error } = await supabase
        .from('team_data')
        .update({ state_json: local, updated_at: new Date().toISOString() })
        .eq('team_id', user.teamId);
      
      if (!error) {
         await idbSet('hasPendingSync', false);
         if (typeof window !== 'undefined') {
           window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
         }
         return true;
      }
    }
  } catch(e) {
    console.error('forceSync failed:', e);
  }
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
  }
  return false;
}

export async function loadFromFile(): Promise<AppState | null> {
  const user = await getCurrentUser();
  const local = await idbGet<AppState>('state');
  const hasPendingSync = await idbGet<boolean>('hasPendingSync');

  // If we have local changes that haven't been pushed yet, 
  // DO NOT overwrite them with older cloud data. Push them first!
  if (hasPendingSync && local) {
    await forceSync();
    fileCache = local;
    return local;
  }

  if (!user || !user.teamId) {
    return local || null;
  }

  try {
    const result = await withTimeout(supabase
      .from('team_data')
      .select('state_json')
      .eq('team_id', user.teamId)
      .single());
    const { data, error } = result;

    if (error || !data) {
      // If network error or no data returned, fallback to local
      return local || null;
    }

    if (Object.keys(data.state_json || {}).length === 0) {
      // It's a fresh account from Supabase! Do NOT fallback to local IDB, 
      // otherwise old local data will bleed into the new account.
      // Return null so the app initializes a fresh default state.
      await idbClear(); // Clear the old local data just in case
      return null;
    }

    const state = data.state_json as AppState;
    fileCache = state;
    await idbSet('state', state); // Local backup
    await idbSet('hasPendingSync', false);
    return state;
  } catch {
    return local || null;
  }
}

export function saveToFile(state: AppState): Promise<void> {
  fileCache = state;
  
  if (!isWritePending) {
    isWritePending = true;
    const run = writeQueue.then(async () => {
      isWritePending = false;
      const currentState = { ...fileCache }; // capture reference
      try {
        await idbSet('state', currentState); // Local backup
        const user = await getCurrentUser();
        if (user && user.teamId) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));
          }
          const { error } = await supabase
            .from('team_data')
            .update({ state_json: currentState, updated_at: new Date().toISOString() })
            .eq('team_id', user.teamId);
          
          if (error) {
            console.error('Supabase save error:', error.message);
            await idbSet('hasPendingSync', true);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
            }
          } else {
            await idbSet('hasPendingSync', false);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('sync-status', { detail: 'success' }));
            }
          }
        }
      } catch (err) {
        console.error('fileStore: failed to save to supabase:', err);
        await idbSet('hasPendingSync', true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
        }
      }
    });
    writeQueue = run.catch(() => { /* ignore */ });
    return run;
  }
  return writeQueue;
}

export async function clearFileStore(): Promise<void> {
  fileCache = null;
  await idbClear();
  // We don't delete cloud data on logout
}

export async function getDataDir(): Promise<string | null> {
  return null;
}
