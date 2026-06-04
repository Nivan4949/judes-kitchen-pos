import { create } from 'zustand';

interface PrinterStore {
  device: any | null;
  characteristic: any | null;
  isConnected: boolean;
  error: string | null;
  setDevice: (device: any) => void;
  setCharacteristic: (characteristic: any) => void;
  setIsConnected: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
  disconnect: () => void;
}

export const usePrinterStore = create<PrinterStore>((set, get) => ({
  device: null,
  characteristic: null,
  isConnected: false,
  error: null,

  setDevice: (device) => set({ device }),
  setCharacteristic: (characteristic) => set({ characteristic }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setError: (error) => set({ error }),
  
  disconnect: () => {
    const { device } = get();
    if (device && device.gatt?.connected) {
      device.gatt.disconnect();
    }
    set({ device: null, characteristic: null, isConnected: false, error: null });
  }
}));
