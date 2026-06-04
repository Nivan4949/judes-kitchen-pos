import { openDB } from 'idb';

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 2;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const offlineDB = {
  initDB,
  async getAll(storeName) {
    const db = await initDB();
    return db.getAll(storeName);
  },
  async put(storeName, data) {
    const db = await initDB();
    return db.put(storeName, data);
  },
  async delete(storeName, id) {
    const db = await initDB();
    return db.delete(storeName, id);
  },
  async clear(storeName) {
    const db = await initDB();
    return db.clear(storeName);
  }
};
