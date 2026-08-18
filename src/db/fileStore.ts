import type { AppState } from '@/types';
import { supabase } from '@/services/supabase';
import { getCurrentUser } from '@/services/auth';
import { idbGet, idbSet, idbClear } from './idb';

let fileCache: AppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let isWritePending = false;

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

export async function loadFromFile(): Promise<AppState | null> {
  const user = await getCurrentUser();
  if (!user || !user.teamId) {
    const local = await idbGet<AppState>('state');
    return local || null;
  }

  try {
    const { data, error } = await supabase
      .from('team_data')
      .select('state_json')
      .eq('team_id', user.teamId)
      .single();

    if (error || !data || Object.keys(data.state_json || {}).length === 0) {
      // If no valid data in Supabase, try local
      const local = await idbGet<AppState>('state');
      return local || null;
    }

    const state = data.state_json as AppState;
    fileCache = state;
    await idbSet('state', state); // Local backup
    return state;
  } catch {
    const local = await idbGet<AppState>('state');
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
          const { error } = await supabase
            .from('team_data')
            .update({ state_json: currentState, updated_at: new Date().toISOString() })
            .eq('team_id', user.teamId);
          
          if (error) {
            console.error('Supabase save error:', error.message);
          }
        }
      } catch (err) {
        console.error('fileStore: failed to save to supabase:', err);
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
