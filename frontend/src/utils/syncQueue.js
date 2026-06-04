import { offlineDB } from './offlineDB';
import api from '../api/api';

const API_BASE_URL = '/api';

export const addToSyncQueue = async (action, data) => {
  await offlineDB.put('syncQueue', {
    action,
    data,
    timestamp: Date.now(),
  });
  processSyncQueue();
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  const queue = await offlineDB.getAll('syncQueue');
  const orders = queue.filter(item => item.action === 'CREATE_ORDER');
  
  if (orders.length > 0) {
    try {
      const response = await api.post('/sync/orders', { 
        orders: orders.map(o => o.data) 
      }, { skipAuthRedirect: true });
      
      // Remove successfully synced orders from queue and update local order status
      const syncedItems = response.data.synced || [];
      for (const item of syncedItems) {
        // Find by client-side UUID 'id' (robust) or legacy 'invoiceNo'
        const queueItem = orders.find(o => 
          (typeof item === 'object' && item !== null && o.data.id === item.id) ||
          (typeof item === 'string' && o.data.invoiceNo === item)
        );
        if (queueItem) {
          await offlineDB.delete('syncQueue', queueItem.id);
        }

        // Also update local 'orders' store
        try {
          const targetId = typeof item === 'object' && item !== null ? item.id : null;
          const targetInvoice = typeof item === 'object' && item !== null ? item.invoiceNo : item;
          
          const localOrders = await offlineDB.getAll('orders');
          const localOrder = localOrders.find(lo => 
            (targetId && lo.id === targetId) || 
            (targetInvoice && lo.invoiceNo === targetInvoice) ||
            (queueItem && lo.id === queueItem.data.id)
          );
          
          if (localOrder) {
            if (targetInvoice) localOrder.invoiceNo = targetInvoice;
            localOrder.isSynced = true;
            localOrder.isSyncing = false;
            await offlineDB.put('orders', localOrder);
          }
        } catch (dbErr) {
          console.error('Failed to update local order sync status:', dbErr);
        }
      }
      
      console.log('Bulk sync completed:', syncedItems.length, 'orders');
    } catch (error) {
      console.error('Bulk sync failed:', error);
    }
  }

  // Handle other actions (Products, etc.) individually or in groups
  const otherItems = queue.filter(item => item.action !== 'CREATE_ORDER');
  for (const item of otherItems) {
    try {
      if (item.action === 'UPDATE_PRODUCT') {
        await api.put(`/products/${item.data.id}`, item.data, { skipAuthRedirect: true });
      }
      await offlineDB.delete('syncQueue', item.id);
    } catch (error) {
      console.error('Individual sync failed for item:', item.id, error);
    }
  }
};

// Auto-sync when coming back online
window.addEventListener('online', processSyncQueue);
