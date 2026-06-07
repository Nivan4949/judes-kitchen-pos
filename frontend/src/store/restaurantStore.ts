import { create } from 'zustand';
import api from '../api/api';

interface RestaurantState {
  tables: any[];
  sections: any[];
  activeKots: any[];
  settings: any | null;
  loading: boolean;
  activeShift: any | null;
  
  fetchTables: () => Promise<void>;
  fetchSections: () => Promise<void>;
  fetchActiveKots: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateTableStatus: (tableId: string, status: string, orderId?: string | null, amount?: number) => Promise<void>;
  transferTable: (sourceId: string, targetId: string) => Promise<void>;
  mergeTables: (sourceId: string, targetId: string) => Promise<void>;
  splitOrder: (sourceId: string, targetId: string | null, items: any[]) => Promise<any>;
  
  checkActiveShift: () => Promise<any>;
  openShift: (openingCash: number) => Promise<void>;
  closeShift: (actualCash: number, notes?: string) => Promise<void>;
  
  updateKotStatus: (kotId: string, status: string) => Promise<void>;
  updateKotItemStatus: (kotId: string, itemId: string, status: string) => Promise<void>;
  reprintKot: (kotId: string) => Promise<void>;
  saveSettings: (settingsData: any) => Promise<void>;
}

const useRestaurantStore = create<RestaurantState>((set, get) => ({
  tables: [],
  sections: [],
  activeKots: [],
  settings: null,
  loading: false,
  activeShift: null,

  fetchTables: async () => {
    try {
      const res = await api.get('/tables');
      set({ tables: res.data });
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  },

  fetchSections: async () => {
    try {
      const res = await api.get('/tables/sections');
      set({ sections: res.data });
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  },

  fetchActiveKots: async () => {
    try {
      const res = await api.get('/kots/active');
      set({ activeKots: res.data });
    } catch (err) {
      console.error('Error fetching KOTs:', err);
    }
  },

  fetchSettings: async () => {
    try {
      const res = await api.get('/restaurant-settings');
      set({ settings: res.data });
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  },

  updateTableStatus: async (tableId, status, orderId = null, amount = 0) => {
    try {
      const res = await api.put(`/tables/${tableId}`, { status, currentOrderId: orderId, runningOrderAmount: amount });
      set(state => ({
        tables: state.tables.map(t => t.id === tableId ? res.data : t)
      }));
    } catch (err) {
      console.error('Error updating table status:', err);
    }
  },

  transferTable: async (sourceId, targetId) => {
    try {
      await api.post('/tables/transfer', { sourceTableId: sourceId, targetTableId: targetId });
      await get().fetchTables();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to transfer table');
    }
  },

  mergeTables: async (sourceId, targetId) => {
    try {
      await api.post('/tables/merge', { sourceTableId: sourceId, targetTableId: targetId });
      await get().fetchTables();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to merge tables');
    }
  },

  splitOrder: async (sourceId, targetId, items) => {
    try {
      const res = await api.post('/tables/split', { sourceTableId: sourceId, targetTableId: targetId, itemsToSplit: items });
      await get().fetchTables();
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to split order');
    }
  },

  checkActiveShift: async () => {
    try {
      const res = await api.get('/shifts/active');
      if (res.data.active) {
        set({ activeShift: res.data.shift });
        return res.data.shift;
      } else {
        set({ activeShift: null });
        return null;
      }
    } catch (err) {
      console.error('Error checking active shift:', err);
      return null;
    }
  },

  openShift: async (openingCash) => {
    try {
      const res = await api.post('/shifts/open', { openingCash });
      set({ activeShift: res.data });
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to open shift');
    }
  },

  closeShift: async (actualCash, notes = '') => {
    try {
      await api.post('/shifts/close', { actualClosingCash: actualCash, notes });
      set({ activeShift: null });
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to close shift');
    }
  },

  updateKotStatus: async (kotId, status) => {
    try {
      const res = await api.patch(`/kots/${kotId}/status`, { status });
      set(state => ({
        activeKots: status === 'SERVED' || status === 'CANCELLED' 
          ? state.activeKots.filter(k => k.id !== kotId)
          : state.activeKots.map(k => k.id === kotId ? { ...k, status: res.data.status, items: res.data.items } : k)
      }));
    } catch (err) {
      console.error('Error updating KOT status:', err);
    }
  },

  updateKotItemStatus: async (kotId, itemId, status) => {
    try {
      await api.patch(`/kots/${kotId}/items/${itemId}/status`, { status });
      await get().fetchActiveKots(); // Refresh list to reflect parent KOT status changes
    } catch (err) {
      console.error('Error updating KOT item status:', err);
    }
  },

  reprintKot: async (kotId) => {
    try {
      await api.post(`/kots/${kotId}/reprint`);
    } catch (err) {
      console.error('Error reprinting KOT:', err);
    }
  },

  saveSettings: async (settingsData) => {
    try {
      const res = await api.put('/restaurant-settings', settingsData);
      set({ settings: res.data });
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to save settings');
    }
  }
}));

export default useRestaurantStore;
