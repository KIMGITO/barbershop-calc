import { create } from 'zustand'

export const useNetworkStore = create((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,

  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  markSynced: () => set({ lastSyncedAt: new Date().toISOString(), lastError: null }),
  setError: (lastError) => set({ lastError }),
}))
