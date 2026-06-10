import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrinterStore } from '../store/printerStore';

// Common Thermal Printer UUIDs (Expanded for broader compatibility)
const SUPPORTED_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic / MTP
  '0000ff00-0000-1000-8000-00805f9b34fb', // ESC/POS Standard
  '0000af00-0000-1000-8000-00805f9b34fb', // Newer Android/Chinese printers
  '0000e0ff-0000-1000-8000-00805f9b34fb', // Some Zjiang/Goojprt
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // B-POS / ISSC
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Zijiang B-POS
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
];

const PRINTER_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '00002af0-0000-1000-8000-00805f9b34fb',
  '0000be02-0000-1000-8000-00805f9b34fb',
];

let hasAttemptedAutoReconnect = false;

export const useBluetoothPrinter = () => {
  const { 
    device, 
    characteristic, 
    isConnected, 
    error,
    setDevice, 
    setCharacteristic, 
    setIsConnected, 
    setError,
    disconnect: globalDisconnect
  } = usePrinterStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const isPrintingRef = useRef(false);

  const setupDeviceListeners = useCallback((dev: any) => {
    dev.addEventListener('gattserverdisconnected', () => {
      setIsConnected(false);
      setCharacteristic(null);
      console.warn('Printer GATT Server Disconnected!');
    });
  }, [setIsConnected, setCharacteristic]);

  const discoverServiceAndCharacteristic = useCallback(async (server: any) => {
    let service;
    // 1. Try known services
    for (const uuid of SUPPORTED_SERVICES) {
      try {
        service = await server.getPrimaryService(uuid);
        if (service) break;
      } catch (e) { continue; }
    }

    // 2. Fallback: Get all primary services and find one that looks like a printer
    if (!service) {
      try {
        const services = await server.getPrimaryServices();
        service = services[0]; // Take the first one as a last resort
      } catch (e) {}
    }

    if (!service) throw new Error('Could not find a compatible printing service.');

    // 3. Find writable characteristic
    let char;
    for (const uuid of PRINTER_CHARACTERISTIC_UUIDS) {
      try {
        char = await service.getCharacteristic(uuid);
        if (char) break;
      } catch (e) { continue; }
    }

    if (!char) {
      const characteristics = await service.getCharacteristics();
      char = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
    }

    if (!char) throw new Error('No writable characteristic found.');
    return char;
  }, []);

  useEffect(() => {
    const autoConnect = async () => {
      if (hasAttemptedAutoReconnect) return;
      hasAttemptedAutoReconnect = true;

      const bluetooth = (navigator as any).bluetooth;
      if (bluetooth && bluetooth.getDevices) {
        try {
          const devices = await bluetooth.getDevices();
          if (devices && devices.length > 0) {
            const lastId = localStorage.getItem('lastConnectedPrinterId');
            const dev = devices.find((d: any) => d.id === lastId) || devices[0];
            
            setIsConnecting(true);
            // Wait for system to settle
            await new Promise(r => setTimeout(r, 1000));
            
            // Set device immediately so if gatt.connect() fails in background,
            // ensureConnected() can retry it later on user gesture.
            setDevice(dev);
            
            try {
              const server = await dev.gatt.connect();
              const char = await discoverServiceAndCharacteristic(server);
              
              setupDeviceListeners(dev);
              setCharacteristic(char);
              setIsConnected(true);
              console.log('Bluetooth Auto-reconnected successfully!');
            } catch (err) {
              console.warn('Auto-reconnect failed', err);
            } finally {
              setIsConnecting(false);
            }
          }
        } catch (err) {
          console.warn('getDevices() failed', err);
        }
      }
    };

    autoConnect();
  }, [setDevice, setCharacteristic, setIsConnected, setupDeviceListeners, discoverServiceAndCharacteristic]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);
      const bluetooth = (navigator as any).bluetooth;
      if (!bluetooth) throw new Error('Bluetooth not supported on this browser.');

      // Check if we can resume without picker
      if (bluetooth.getDevices) {
        const devices = await bluetooth.getDevices();
        const lastId = localStorage.getItem('lastConnectedPrinterId');
        const existing = devices.find((d: any) => d.id === lastId);
        
        if (existing && !existing.gatt.connected) {
          try {
            // Try up to 2 times to reconnect to the known device
            for (let i = 0; i < 2; i++) {
              try {
                const server = await existing.gatt.connect();
                const char = await discoverServiceAndCharacteristic(server);
                setupDeviceListeners(existing);
                setDevice(existing);
                setCharacteristic(char);
                setIsConnected(true);
                return existing;
              } catch (e) {
                console.warn(`Reconnection attempt ${i + 1} failed in connect()`);
                if (i < 1) await new Promise(r => setTimeout(r, 1000));
              }
            }
            throw new Error('Retries exhausted');
          } catch (e) {
            console.warn('Failed to resume existing device. Clearing saved printer so next click shows picker.');
            localStorage.removeItem('lastConnectedPrinterId');
            throw new Error('Could not reconnect to the saved printer. Please click Connect again to pair.');
          }
        }
      }

      const dev = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: SUPPORTED_SERVICES,
      });

      const server = await dev.gatt.connect();
      const char = await discoverServiceAndCharacteristic(server);

      setDevice(dev);
      setCharacteristic(char);
      setIsConnected(true);
      setupDeviceListeners(dev);
      
      if (dev.id) localStorage.setItem('lastConnectedPrinterId', dev.id);

      return dev;
    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [setDevice, setCharacteristic, setIsConnected, setError, setupDeviceListeners, discoverServiceAndCharacteristic]);

  const ensureConnected = useCallback(async (retries = 3) => {
    if (device && device.gatt.connected && characteristic) return true;
    
    if (device) {
      for (let i = 0; i < retries; i++) {
        try {
          const server = await device.gatt.connect();
          const char = await discoverServiceAndCharacteristic(server);
          if (char) {
            setCharacteristic(char);
            setIsConnected(true);
            return true;
          }
        } catch (e: any) {
          console.warn(`Reconnection attempt ${i + 1} failed`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    return false;
  }, [device, characteristic, setCharacteristic, setIsConnected, discoverServiceAndCharacteristic]);

  const disconnect = useCallback(() => {
    globalDisconnect();
    localStorage.removeItem('lastConnectedPrinterId');
  }, [globalDisconnect]);

  const print = useCallback(async (data: Uint8Array) => {
    try {
      isPrintingRef.current = true;
      const ok = await ensureConnected();
      if (!ok) throw new Error('Printer is disconnected. Please reconnect.');
      
      if (!characteristic) throw new Error('Printer not ready.');

      // 120 bytes is a safe, optimal chunk size for Bluetooth printers (MTU is usually negotiated up to 512, safe fallback).
      // This reduces the number of Bluetooth writes by 6x compared to 20-byte chunks.
      const CHUNK_SIZE = 120;
      const writeWithoutResponse = !!characteristic.properties.writeWithoutResponse;

      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        try {
          if (writeWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
            // Pacing delay only needed for write without response to avoid overflowing printer buffer.
            // 15ms is extremely safe and fast (over 4x faster than 60ms).
            await new Promise(resolve => setTimeout(resolve, 15));
          } else {
            // Write with response is inherently flow-controlled by the device GATT server, so no artificial delay is needed!
            await characteristic.writeValue(chunk);
          }
        } catch (e) {
          // If writeWithoutResponse fails or throws, fallback to write with response
          await characteristic.writeValue(chunk);
        }
      }
    } catch (err: any) {
      console.error('Print Error:', err);
      throw err;
    } finally {
      isPrintingRef.current = false;
    }
  }, [characteristic, ensureConnected]);

  return { connect, disconnect, print, isConnected, isConnecting, device, error, ensureConnected };
};
