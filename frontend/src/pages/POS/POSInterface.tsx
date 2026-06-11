import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Search, ShoppingCart, User, CreditCard, Trash2, Plus, Minus, Scan, Maximize, Minimize, Camera, Wifi, WifiOff, X, LayoutGrid, Printer, CheckCircle, Smartphone, Battery, ChevronRight, Clock, Star, Users, HandCoins, Bluetooth, BluetoothOff, RefreshCw } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { io } from 'socket.io-client';
import api from '../../api/api';
import usePOSStore from '../../store/posStore';
import useAuthStore from '../../store/authStore';
import useRestaurantStore from '../../store/restaurantStore';
import PaymentModal from '../../components/PaymentModal';
import ReceiptPreview from '../../components/ReceiptPreview';
import { Product, CartItem } from '../../types';
import { offlineDB } from '../../utils/offlineDB';
import { addToSyncQueue } from '../../utils/syncQueue';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { useBluetoothPrinter } from '../../hooks/useBluetoothPrinter';
import { EscPosBuilder } from '../../utils/escPosUtil';
import InstallPrompt from '../../components/InstallPrompt';
import CustomerSelectionModal from '../../components/CustomerSelectionModal';
import RedeemPointsModal from '../../components/RedeemPointsModal';
import ProductCard from '../../components/ProductCard';

const POSInterface: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const cart = usePOSStore(state => state.cart);
  const addToCart = usePOSStore(state => state.addToCart);
  const removeFromCart = usePOSStore(state => state.removeFromCart);
  const updateQuantity = usePOSStore(state => state.updateQuantity);
  const updatePrice = usePOSStore(state => state.updatePrice);
  const clearCart = usePOSStore(state => state.clearCart);
  const getTotals = usePOSStore(state => state.getTotals);
  
  const activeOrderId = usePOSStore(state => state.activeOrderId);
  const orderType = usePOSStore(state => state.orderType);
  const setOrderType = usePOSStore(state => state.setOrderType);
  const waiterName = usePOSStore(state => state.waiterName);
  const setWaiter = usePOSStore(state => state.setWaiter);
  const tableName = usePOSStore(state => state.tableName);
  const tableId = usePOSStore(state => state.tableId);
  const setTable = usePOSStore(state => state.setTable);
  const notes = usePOSStore(state => state.notes);
  const setNotes = usePOSStore(state => state.setNotes);
  const heldOrders = usePOSStore(state => state.heldOrders);
  const holdCurrentOrder = usePOSStore(state => state.holdCurrentOrder);
  const resumeHeldOrder = usePOSStore(state => state.resumeHeldOrder);
  const deleteHeldOrder = usePOSStore(state => state.deleteHeldOrder);
  const loadRunningOrder = usePOSStore(state => state.loadRunningOrder);

  const { tables, fetchTables, settings, fetchSettings, sections, fetchSections, activeShift, checkActiveShift } = useRestaurantStore();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [recentOrder, setRecentOrder] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals / Selection states
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>([]);
  const [customizationQty, setCustomizationQty] = useState(1);
  const [itemNotesInput, setItemNotesInput] = useState('');
  const [waiters, setWaiters] = useState<any[]>([]);
  const [pendingQrRequests, setPendingQrRequests] = useState<any[]>([]);
  const [isQrRequestsModalOpen, setIsQrRequestsModalOpen] = useState(false);

  const fetchPendingQrRequests = async () => {
    try {
      const response = await api.get('/orders/pending-approvals');
      setPendingQrRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch QR requests:', error);
    }
  };

  const handleApproveQrRequest = async (id: string) => {
    try {
      const response = await api.post(`/orders/${id}/approve`);
      alert('Order approved and KOT sent to kitchen!');
      setPendingQrRequests(prev => prev.filter(r => r.id !== id));
      fetchTables();
    } catch (error: any) {
      console.error('Failed to approve QR request:', error);
      alert(error.response?.data?.error || 'Failed to approve request');
    }
  };

  const handleRejectQrRequest = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this order request?')) return;
    try {
      await api.post(`/orders/${id}/reject`);
      alert('Order request rejected and removed.');
      setPendingQrRequests(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      console.error('Failed to reject QR request:', error);
      alert(error.response?.data?.error || 'Failed to reject request');
    }
  };

  const [cancellationReasons, setCancellationReasons] = useState<{[key: string]: string}>({});

  const handleRemoveFromCart = (item: CartItem) => {
    if (activeOrderId && item.originalQuantity && item.originalQuantity > 0) {
      const reason = prompt(`Enter reason for cancelling/removing '${item.name}':`);
      if (reason === null) return;
      if (!reason.trim()) {
        alert('Cancellation reason is required.');
        return;
      }
      setCancellationReasons(prev => ({
        ...prev,
        [item.cartLineId || item.id]: reason
      }));
    }
    removeFromCart(item.cartLineId || item.id);
  };

  const handleUpdateQuantity = (item: CartItem, newQty: number) => {
    if (activeOrderId && item.originalQuantity && newQty < item.quantity) {
      const reducedQty = item.quantity - newQty;
      const reason = prompt(`Enter reason for reducing quantity of '${item.name}' by ${reducedQty}:`);
      if (reason === null) return;
      if (!reason.trim()) {
        alert('Reason is required for quantity reduction.');
        return;
      }
      setCancellationReasons(prev => ({
        ...prev,
        [item.cartLineId || item.id]: reason
      }));
    }
    updateQuantity(item.cartLineId || item.id, newQty);
  };


  const isOnline = useNetworkStatus();
  const { isConnected, isConnecting, disconnect, connect, print } = useBluetoothPrinter();
  
  const customer = usePOSStore(state => state.customer);
  const setCustomer = usePOSStore(state => state.setCustomer);
  const loyaltyDiscount = usePOSStore(state => state.loyaltyDiscount);
  const manualDiscount = usePOSStore(state => state.manualDiscount);
  const appliedPoints = usePOSStore(state => state.appliedPoints);

  // Helper to determine if a unit allows fractional quantities
  const isFractionalUnit = (unit: string | undefined) => {
    const u = unit?.toLowerCase() || '';
    return ['kg', 'ltr', 'g', 'ml', 'mtr', 'cm', 'loose'].includes(u);
  };

  const fetchCategories = async () => {
    try {
      if (isOnline) {
        const response = await api.get('/categories');
        setCategories(response.data);
        for (const cat of response.data) {
          await offlineDB.put('categories', cat);
        }
      } else {
        const offlineCats = await offlineDB.getAll('categories');
        setCategories(offlineCats);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      const offlineCats = await offlineDB.getAll('categories');
      setCategories(offlineCats);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let productList: Product[] = [];
      if (isOnline) {
        const response = await api.get('/products?activeOnly=true');
        productList = response.data;
        // Batch cache full list
        const tx = (await offlineDB.initDB()).transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        await store.clear();
        for (const product of productList) {
          await store.put(product);
        }
        await tx.done;
      } else {
        productList = await offlineDB.getAll('products');
      }
      setAllProducts(productList);
      applyFilters(search, selectedCategoryId, productList);
    } catch (error) {
      console.error('Error fetching products:', error);
      const offlineProducts = await offlineDB.getAll('products');
      setAllProducts(offlineProducts);
      applyFilters(search, selectedCategoryId, offlineProducts);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (query: string, catId: string | null, list: Product[] = allProducts) => {
    let filtered = [...list];
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.barcode?.includes(query)
      );
    }
    
    if (catId) {
      filtered = filtered.filter(p => p.categoryId === catId);
    }
    
    setFilteredProducts(filtered);
  };

  const fetchWaiters = async () => {
    try {
      const res = await api.get('/auth/users');
      const userList = res.data;
      const waiterList = userList.filter((u: any) => u.role === 'WAITER');
      setWaiters(waiterList.length > 0 ? waiterList : userList);
    } catch (err) {
      console.error('Failed to fetch waiters:', err);
    }
  };

  const parseJsonField = (field: any) => {
    if (!field) return [];
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (e) {
        return [];
      }
    }
    return field;
  };

  const handleProductSelect = (product: Product) => {
    const productVariants = parseJsonField(product.variants);
    const productAddons = parseJsonField(product.addons);
    
    if (productVariants.length > 0 || productAddons.length > 0) {
      setCustomizingProduct(product);
      setSelectedVariant(productVariants.length > 0 ? productVariants[0] : null);
      setSelectedModifiers([]);
      setCustomizationQty(1);
      setItemNotesInput('');
    } else {
      addToCart(product, 1);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchTables();
    fetchSections();
    fetchWaiters();
    fetchSettings();
    fetchPendingQrRequests();
    checkActiveShift();
    
    // Connect Real-Time socket notifications
    const socketUrl = `${window.location.protocol}//${window.location.host}`;
    const socket = io(socketUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true
    });

    socket.on('QR_ORDER_REQUESTED', (order: any) => {
      setPendingQrRequests(prev => {
        if (prev.some(r => r.id === order.id)) return prev;
        return [order, ...prev];
      });
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav');
        audio.play().catch(() => {});
      } catch (e) {}
    });

    socket.on('QR_ORDER_PROCESSED', ({ id }: { id: string }) => {
      setPendingQrRequests(prev => prev.filter(r => r.id !== id));
    });

    // Initialize last invoice number from DB once
    const initInvoiceNo = async () => {
      const orders = await offlineDB.getAll('orders');
      if (orders.length > 0) {
        const numericInvoices = orders
          .map(o => parseInt(o.invoiceNo))
          .filter(n => !isNaN(n) && n < 9000);
        if (numericInvoices.length > 0) {
          const max = Math.max(...numericInvoices);
          localStorage.setItem('last_invoice_no', max.toString());
        }
      }
    };
    initInvoiceNo();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Trigger auto-charge updates based on order mode and subtotal
  useEffect(() => {
    if (!settings) return;
    
    const { subtotal } = getTotals();
    let parcelCharge = 0;
    let deliveryCharge = 0;

    if (orderType === 'Takeaway') {
      parcelCharge = settings.parcelCharge || 0;
    } else if (orderType === 'Delivery') {
      deliveryCharge = settings.deliveryCharge || 0;
    }

    usePOSStore.getState().setCharges({
      parcelCharge,
      deliveryCharge
    });
  }, [orderType, cart, settings]);


  const handleCategorySelect = (id: string | null) => {
    setSelectedCategoryId(id);
    applyFilters(search, id);
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    applyFilters(val, selectedCategoryId);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText: string) => {
        // Find product by barcode
        const product = allProducts.find((p: Product) => p.barcode === decodedText);
        if (product) {
          addToCart(product);
          setShowScanner(false);
          scanner.clear();
        }
      }, (error: any) => {
        // Ignore errors
      });
      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [showScanner, allProducts]);

  // Global Keyboard Barcode Scanner Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let timeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          const product = allProducts.find(p => p.barcode === barcodeBuffer);
          if (product) {
            addToCart(product);
          } else {
            console.warn('Barcode scanned but no product found:', barcodeBuffer);
          }
        }
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          barcodeBuffer = ''; // Reset if typing is too slow (not a scanner)
        }, 80); // Scanners type very fast
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [allProducts, addToCart]);

  const handlePaymentComplete = async (method: string, amount: string, orderMode: string = 'Walk-in') => {
    if (cart.length === 0) return;

    const totals = getTotals();
    const { subtotal, taxTotal, parcelCharge, deliveryCharge, grandTotal, roundedTotal, savings } = totals;

    // DETECT NEXT SEQUENTIAL INVOICE NO - Optimized to avoid reading all orders
    let nextInvoiceNo = localStorage.getItem('last_invoice_no') || '100';
    try {
      const lastInvoice = parseInt(nextInvoiceNo);
      nextInvoiceNo = (lastInvoice + 1).toString();
      localStorage.setItem('last_invoice_no', nextInvoiceNo);
    } catch (e) {
      nextInvoiceNo = (Date.now() % 10000).toString();
    }
    
    const orderData: any = {
      id: activeOrderId || ((window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
      })), 
      invoiceNo: activeOrderId ? undefined : nextInvoiceNo,
      orderItems: cart.map((item: any, index: number) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.sellingPrice,
        mrp: item.mrp || item.sellingPrice,
        gstRate: item.gstRate ?? 0,
        discount: 0,
        total: (item.sellingPrice + (item.modifiersPrice || 0)) * item.quantity,
        notes: item.notes || null,
        variant: item.selectedVariant?.name || null,
        modifiers: item.selectedModifiers || []
      })),
      subtotal,
      taxTotal,
      grandTotal,
      roundedTotal,
      savings,
      totalQty: cart.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0),
      itemsCount: cart.length,
      amountPaid: parseFloat(amount) || 0,
      balance: Math.max(0, roundedTotal - (parseFloat(amount) || 0)),
      paymentMode: method,
      orderType: orderType,
      discount: loyaltyDiscount + manualDiscount,
      manualDiscount: manualDiscount,
      loyaltyPointsRedeemed: appliedPoints,
      customerId: customer?.id || null,
      customer: customer,
      userName: user?.name || 'Staff',
      creatorId: user?.id || null,
      shiftId: activeShift?.id || null,
      createdAt: new Date().toISOString(),
      waiterName: waiterName || null,
      tableName: tableName || null,
      tableId: tableId || null,
      notes: notes || null,
      parcelCharge: parcelCharge,
      deliveryCharge: deliveryCharge,
      isSyncing: true // Visual flag for the receipt
    };

    try {
      // Optimistic UI state
      let finalOrderData = { ...orderData, isSyncing: true, isSynced: false };

      // 1. LOCAL PERSISTENCE & STOCK GUARD (Fast, 0ms latency)
      try {
        await offlineDB.put('orders', finalOrderData);
        
        // Update stock in-memory and in-database simultaneously
        const updatedAllProducts = [...allProducts];
        const db = await offlineDB.initDB();
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');

        for (const cartItem of cart) {
          const idx = updatedAllProducts.findIndex(p => p.id === cartItem.id);
          if (idx !== -1) {
            const newStock = Math.max(0, updatedAllProducts[idx].stockQuantity - cartItem.quantity);
            updatedAllProducts[idx] = {
              ...updatedAllProducts[idx],
              stockQuantity: newStock
            };
            await store.put(updatedAllProducts[idx]);
          }
        }
        await tx.done;
        setAllProducts(updatedAllProducts);
        applyFilters(search, selectedCategoryId, updatedAllProducts);
      } catch (err) {
        console.error('Local persistence failed:', err);
      }
      
      // 2. UI TRANSITION (INSTANT)
      setRecentOrder(finalOrderData);
      clearCart();
      setIsPaymentModalOpen(false);
      setIsPreviewOpen(true);

      // 3. TRUE BACKGROUND SERVER SYNC
      if (isOnline) {
        const syncPromise = activeOrderId
          ? api.put(`/orders/${activeOrderId}`, { ...orderData, status: 'COMPLETED' })
          : api.post('/orders', orderData, {
              headers: { 'x-terminal-id': 'T1' },
              skipAuthRedirect: true
            } as any);

        syncPromise.then(response => {
          const syncedData = { ...orderData, ...response.data, isSyncing: false, isSynced: true };
          offlineDB.put('orders', syncedData).catch(() => {});
          
          // Silently update live receipt state if it's still open
          setRecentOrder(prev => prev?.id === finalOrderData.id ? syncedData : prev);
          
          // Fire WhatsApp ONLY after successful sync completion
          if (syncedData.customer?.phone) {
             api.post('/orders/share-whatsapp', { 
                 orderId: syncedData.id || syncedData.invoiceNo, 
                 phone: syncedData.customer.phone 
             }, { skipAuthRedirect: true } as any).catch(err => console.error('Silent WhatsApp dispatch failed:', err));
          }
          fetchTables(); // Refresh tables layout state
        }).catch(async (error) => {
          console.error('Checkout Sync Failed, added to queue:', error);
          await addToSyncQueue('CREATE_ORDER', orderData);
        });
      } else {
        await addToSyncQueue('CREATE_ORDER', orderData);
      }
      
    } catch (error: any) {
      console.error('Critical Layout Error:', error);
      alert('A critical error occurred while attempting to process the layout.');
    }
  };

  const handleSystemKotPrint = (kotData: any) => {
    if (!kotData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Popup blocked!');
      alert('Popup blocker active! Please allow popups for printing.');
      return;
    }

    const itemsHtml = (kotData.items || []).map((item: any) => {
      const variantSuffix = item.variant ? ` (${item.variant})` : '';
      const fullName = item.name + variantSuffix;
      let modifiersHtml = '';
      if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        modifiersHtml = item.modifiers.map((m: any) => `<div style="font-size: 10px; font-weight: normal; color: #555; padding-left: 10px;">+ ${m.name}</div>`).join('');
      }
      let notesHtml = '';
      if (item.notes) {
        notesHtml = `<div style="font-size: 10px; font-weight: bold; color: #d32f2f; padding-left: 10px;">* Note: ${item.notes}</div>`;
      }
      return `
      <tr>
        <td style="font-size: 12px; padding: 6px 0; border-bottom: 1px dashed #eee; font-weight: bold; text-transform: uppercase; word-break: break-word; max-width: 200px; vertical-align: top;">
          ${fullName}
          ${modifiersHtml}
          ${notesHtml}
        </td>
        <td style="font-size: 14px; padding: 6px 0; border-bottom: 1px dashed #eee; font-weight: 900; text-align: right; vertical-align: top;">x${(Number(item.quantity) || 0).toFixed(0)}</td>
      </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Print KOT - ${kotData.kotNo}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              width: 70mm; 
              margin: 0 auto; 
              padding: 5mm; 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 12px;
              color: #000;
              background: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .dashed-border { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 5px 0; }
            th { text-align: left; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 10px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase;">
              ${kotData.status === 'CANCELLED' ? 'KOT CANCELLATION' : 'KOT TICKET'}
            </h1>
            <div class="dashed-border"></div>
          </div>
          <div style="margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px;">
            <div class="total-row"><span>KOT No : ${kotData.kotNo}</span></div>
            <div class="total-row"><span>Time   : ${new Date(kotData.createdAt || Date.now()).toLocaleTimeString()}</span></div>
            ${kotData.tableName ? `<div class="total-row"><span>Table  : ${kotData.tableName}</span></div>` : `<div class="total-row"><span>Mode   : ${kotData.orderType || 'Walk-in'}</span></div>`}
            ${kotData.waiterName ? `<div class="total-row"><span>Waiter : ${kotData.waiterName}</span></div>` : ''}
            ${kotData.reprintCount > 0 ? `<div class="total-row"><span class="bold">** REPRINT #${kotData.reprintCount} **</span></div>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 75%; text-align: left;">Description</th>
                <th style="width: 25%; text-align: right;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="dashed-border"></div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendKot = async () => {
    if (cart.length === 0) return;

    if (orderType === 'Dine-in') {
      if (!tableId) {
        alert('Please assign a dining table first.');
        setIsTableModalOpen(true);
        return;
      }
      if (!waiterName) {
        alert('Please select a waiter first.');
        return;
      }
    }

    setLoading(true);
    try {
      const kotItems = cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.sellingPrice,
        notes: item.notes || null,
        variant: item.selectedVariant?.name || null,
        modifiers: item.selectedModifiers || []
      }));

      const totals = getTotals();
      const orderPayload = {
        id: activeOrderId || undefined,
        invoiceNo: activeOrderId ? undefined : (Date.now() % 10000).toString(),
        orderItems: cart.map((item, idx) => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.sellingPrice,
          mrp: item.mrp || item.sellingPrice,
          gstRate: item.gstRate ?? 0,
          discount: 0,
          total: (item.sellingPrice + (item.modifiersPrice || 0)) * item.quantity,
          notes: item.notes || null,
          variant: item.selectedVariant?.name || null,
          modifiers: item.selectedModifiers || []
        })),
        subtotal: totals.subtotal,
        discount: totals.loyaltyDiscount + totals.manualDiscount,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        roundedTotal: totals.roundedTotal,
        savings: totals.savings,
        amountPaid: 0,
        balance: totals.roundedTotal,
        paymentMode: 'CASH',
        orderType,
        waiterName,
        tableName,
        tableId,
        notes: notes || null,
        parcelCharge: totals.parcelCharge,
        deliveryCharge: totals.deliveryCharge,
        shiftId: activeShift?.id || null,
        status: 'PENDING'
      };

      let orderIdToUse = activeOrderId;
      if (!orderIdToUse) {
        orderIdToUse = ((window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }));
        usePOSStore.setState({ activeOrderId: orderIdToUse });
      }

      // Ensure the generated ID is passed inside the order payload
      const orderPayloadWithId = { ...orderPayload, id: orderIdToUse };

      // Concurrently kick off the order save in the background (heavy DB transaction)
      const orderSavePromise = activeOrderId
        ? api.put(`/orders/${activeOrderId}`, orderPayloadWithId)
        : api.post('/orders', orderPayloadWithId);

      // Instantly generate KOT (very fast database insertion)
      const kotResponse = await api.post('/kots', {
        orderId: orderIdToUse,
        tableId,
        tableName,
        waiterName,
        orderType,
        items: kotItems,
        cancellationReasons
      });
      setCancellationReasons({});

      console.log('KOT response:', kotResponse.data);
      const { kot, cancelKot } = kotResponse.data;

      // Print KOT (Bluetooth or fallback to System Browser printer)
      if (isConnected && print) {
        try {
          if (kot) {
            const kotBytes = EscPosBuilder.generateKotReceipt(kot, settings);
            await print(kotBytes);
          }
          if (cancelKot) {
            const cancelKotBytes = EscPosBuilder.generateKotReceipt(cancelKot, settings);
            await print(cancelKotBytes);
          }
        } catch (printErr) {
          console.error('Bluetooth KOT print failed, falling back to system print:', printErr);
          if (kot) handleSystemKotPrint(kot);
          if (cancelKot) handleSystemKotPrint(cancelKot);
        }
      } else {
        if (kot) handleSystemKotPrint(kot);
        if (cancelKot) handleSystemKotPrint(cancelKot);
      }

      // Handle order sync completion & refresh tables in background
      orderSavePromise
        .then(() => {
          fetchTables(); // Refresh floor status
        })
        .catch(err => {
          console.error('Background order sync failed:', err);
        });

      alert('KOT sent to kitchen successfully!');
    } catch (error: any) {
      console.error('KOT Failed:', error);
      alert(error.response?.data?.error || 'Failed to place KOT');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxTotal, parcelCharge, deliveryCharge, grandTotal } = getTotals();

  return (
    <div className="flex flex-col h-full bg-slate-100 font-sans text-slate-800 overflow-hidden relative">
      {/* Zero-Processing Main Interface */}
      {/* Top Header */}
      <header className="bg-gradient-to-r from-brand-primary to-brand-dark text-white px-4 py-3 flex justify-between items-center shadow-lg select-none shrink-0 relative z-10 overflow-hidden">
        {/* Decorative background glass effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_15%_50%,rgba(255,255,255,0.08),transparent)] pointer-events-none"></div>
        
        <div className="flex items-center gap-4 relative z-20">
          <div className="relative group cursor-pointer lg:flex items-center gap-3">
             <div className="absolute -inset-1 bg-gradient-to-r from-brand-300 to-brand-primary rounded-xl blur opacity-20 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
             <div className="relative flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 px-3 py-2 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                <div className="bg-white shadow-lg p-1.5 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-brand-primary font-black text-xs leading-none">POS</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black tracking-tighter uppercase italic leading-none">Jude's Kitchen</span>
                  <span className="text-[8px] font-bold text-brand-200 tracking-[0.2em] uppercase opacity-60">Terminal v1.0.8</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 relative z-20">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="hidden xs:block tracking-[0.15em]">{isOnline ? 'CLOUD CONNECTED' : 'OFFLINE MODE'}</span>
          </div>

          <button 
            onClick={() => isConnected ? disconnect() : connect().catch(() => {})}
            disabled={isConnecting}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${isConnected ? 'bg-brand-300/10 border-brand-300/30 text-brand-300' : isConnecting ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-wait' : 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'} hover:bg-white/5 disabled:opacity-70`}
            title={isConnected ? "Click to release printer" : isConnecting ? "Reconnecting..." : "Click to authorize printer"}
          >
            {isConnected ? (
              <Bluetooth size={14} className="animate-pulse" />
            ) : isConnecting ? (
              <Bluetooth size={14} className="animate-spin" />
            ) : (
              <BluetoothOff size={14} />
            )}
            <span className="hidden xs:block tracking-[0.15em]">
              {isConnected ? 'BT PRINTER: READY' : isConnecting ? 'RECONNECTING...' : 'CONNECT PRINTER'}
            </span>
          </button>

          <div className="h-6 w-px bg-white/10 hidden sm:block mx-1"></div>

          {/* QR Requests Badge Button */}
          <button
            onClick={() => {
              fetchPendingQrRequests();
              setIsQrRequestsModalOpen(true);
            }}
            className="p-2 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center text-white/70 hover:text-white relative"
            title="Pending QR Requests"
          >
            <Smartphone size={18} className={pendingQrRequests.length > 0 ? "text-orange-400 animate-bounce" : ""} />
            {pendingQrRequests.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {pendingQrRequests.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center text-white/70 hover:text-white"
            title="Refresh Terminal"
          >
            <RefreshCw size={18} />
          </button>

          <button 
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded-xl transition-all hidden xs:flex items-center justify-center text-white/70 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="text-[10px] font-bold text-white/50 tracking-wider hidden lg:flex flex-col items-end leading-none">
            <span>{new Date().toLocaleDateString()}</span>
            <span className="mt-1">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side - Product Selection */}
        <section className="flex-1 lg:w-3/5 flex flex-col p-3 md:p-4 gap-3 md:gap-4 overflow-hidden border-b lg:border-r border-slate-200">
          <div className="relative group flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-white rounded-xl shadow-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary text-base md:text-lg transition-all"
                value={search}
                onChange={handleSearch}
              />
            </div>
            <button 
              onClick={() => setShowScanner(!showScanner)}
              className={`px-3 md:px-4 rounded-xl shadow-sm border transition-all flex items-center justify-center ${showScanner ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400'}`}
            >
              <Camera size={20} />
            </button>
          </div>

          {showScanner && (
            <div className="bg-white p-2 md:p-4 rounded-xl border border-slate-200 shadow-inner relative animate-in fade-in zoom-in-95">
              <div id="reader" className="overflow-hidden rounded-lg min-h-[200px]"></div>
              <button 
                onClick={() => setShowScanner(false)}
                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-all z-10"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* Category Bar */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide select-none shrink-0">
            <button
              onClick={() => handleCategorySelect(null)}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${
              selectedCategoryId === null 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30' 
                : 'bg-white text-slate-500 hover:bg-brand-50 border border-slate-200'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${
                  selectedCategoryId === cat.id 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30' 
                  : 'bg-white text-slate-500 hover:bg-brand-50 border border-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-24 lg:pb-0 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {loading ? (
                <div className="col-span-full text-center py-10 md:py-20 text-slate-400 animate-pulse">Loading...</div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={handleProductSelect}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-20 text-slate-400">No products</div>
              )}
            </div>
          </div>
        </section>

        {/* Right Side - Cart & Billing (Drawer on Mobile) */}
        {/* Overlay for mobile drawer */}
        {isMobileCartOpen && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsMobileCartOpen(false)}
          ></div>
        )}

        <section 
          id="cart-section" 
          className={`
            fixed inset-x-0 bottom-0 z-40 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 transform rounded-t-[2rem] lg:rounded-none overflow-hidden flex flex-col
            ${isMobileCartOpen ? 'translate-y-0 h-[85vh]' : 'translate-y-full h-[85vh]'}
            lg:static lg:translate-y-0 lg:h-full lg:w-2/5 lg:shadow-xl lg:flex
          `}
        >
          {/* Cart Header */}
          <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileCartOpen(false)}
                className="lg:hidden p-1.5 -ml-1 text-slate-400 hover:text-slate-800 bg-white rounded-lg shadow-sm border border-slate-200"
              >
                <X size={20} />
              </button>
              <ShoppingCart size={22} className="text-brand-primary hidden md:block" />
              <h2 className="font-bold text-lg text-slate-700">Cart ({cart.length})</h2>
            </div>
            <div className="flex items-center gap-2">
              {heldOrders.length > 0 && (
                <button
                  onClick={() => setIsHeldModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-colors"
                >
                  Held ({heldOrders.length})
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={holdCurrentOrder}
                  className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 font-black rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
                >
                  Hold
                </button>
              )}
              <button 
                onClick={clearCart}
                className="text-red-500 hover:bg-red-50 p-1.5 md:p-2 rounded-lg transition-colors group"
              >
                <Trash2 size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
          </div>

          {/* Order Mode Selector Tabs */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex gap-2 shrink-0">
            {['Dine-in', 'Takeaway', 'Delivery'].map((mode) => (
              <button
                key={mode}
                onClick={() => setOrderType(mode)}
                className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                  orderType === mode
                    ? 'bg-brand-primary text-white shadow shadow-brand-primary/20 border-brand-primary'
                    : 'bg-white text-slate-500 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Dine-in Table / Waiter Context Panel */}
          {orderType === 'Dine-in' && (
            <div className="p-3 border-b border-slate-100 bg-brand-50/20 flex gap-2 shrink-0">
              <button
                onClick={() => setIsTableModalOpen(true)}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all ${
                  tableId 
                    ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary shadow-sm shadow-brand-primary/5'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-brand-primary'
                }`}
              >
                <Users size={14} />
                <span>{tableName ? `Table: ${tableName}` : 'Select Table'}</span>
              </button>

              <select
                className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-700 focus:outline-none focus:border-brand-primary"
                value={waiterName}
                onChange={(e) => setWaiter(e.target.value)}
              >
                <option value="">-- Select Waiter --</option>
                {waiters.map((w: any) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {cart.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {cart.map((item: CartItem) => (
                  <div key={item.cartLineId || item.id} className="p-3 md:p-4 hover:bg-slate-50/50 transition-colors flex items-center gap-3 md:gap-4 animate-in fade-in slide-in-from-right-4 group">
                    {/* Individual Delete Button on Left */}
                    <button 
                      onClick={() => handleRemoveFromCart(item)}
                      className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shrink-0"
                      title="Remove item"
                    >
                      <Trash2 size={18} />
                    </button>
 
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm md:text-base truncate">
                        {item.name}
                        {item.selectedVariant && <span className="text-[10px] text-orange-500 ml-1.5 uppercase font-black">({item.selectedVariant.name})</span>}
                      </div>
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          + {item.selectedModifiers.map((m: any) => m.name).join(', ')}
                        </div>
                      )}
                      {item.notes && <div className="text-[10px] text-orange-600 italic mt-0.5">* "{item.notes}"</div>}
                      <div className="text-xs md:text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                         {item.unit?.toUpperCase() === 'LOOSE' ? (
                           <div className="flex items-center gap-1">
                             <span>₹</span>
                             <input 
                               type="number"
                               className="w-16 bg-white border border-slate-200 rounded px-1 py-0.5 font-bold text-slate-800 focus:ring-1 focus:ring-brand-primary outline-none text-base"
                               value={item.sellingPrice === 0 ? '' : item.sellingPrice}
                               onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                               onClick={(e) => e.currentTarget.select()}
                             />
                           </div>
                         ) : (
                           <span>₹{(item.sellingPrice + (item.modifiersPrice || 0)).toFixed(2)}</span>
                         )}
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className="truncate">{item.category?.name || 'General'}</span>
                      </div>
                    </div>
 
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 md:p-1">
                        <button 
                          onClick={() => {
                            handleUpdateQuantity(item, Math.max(1, item.quantity - 1));
                          }}
                          className="w-6 md:w-8 h-6 md:h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-slate-500"
                        >
                          <Minus size={12} strokeWidth={3} />
                        </button>
                        <input 
                          type="number" 
                          step={isFractionalUnit(item.unit) ? "0.001" : "1"}
                          min="0"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => {
                            let valStr = e.target.value;
                            if (valStr === '') {
                              handleUpdateQuantity(item, 0);
                              return;
                            }
                            let val = parseFloat(valStr) || 0;
                            if (!isFractionalUnit(item.unit)) val = Math.round(val);
                            handleUpdateQuantity(item, Math.max(0, val));
                          }}
                          onBlur={() => {
                            if (item.quantity <= 0) {
                              handleUpdateQuantity(item, isFractionalUnit(item.unit) ? 0.001 : 1);
                            }
                          }}
                          className="w-12 md:w-16 bg-transparent border-none text-center font-bold text-base text-slate-700 focus:ring-0 p-0"
                        />
                        <button 
                          onClick={() => {
                            handleUpdateQuantity(item, item.quantity + 1);
                          }}
                          className="w-6 md:w-8 h-6 md:h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-slate-600"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>
                      <div className="font-bold text-slate-900 text-xs md:text-base">₹{((item.sellingPrice + (item.modifiersPrice || 0)) * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300 opacity-60">
                 <ShoppingCart size={40} strokeWidth={1} className="mb-2" />
                 <p className="text-sm font-medium">Cart is empty</p>
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="p-4 md:p-6 bg-slate-900 text-white rounded-t-2xl md:rounded-t-3xl shadow-2xl shrink-0">
            <div className="space-y-2 mb-4 md:mb-6">
              <div className="flex justify-between text-xs md:text-sm text-slate-400">
                <span>Total Items</span>
                <span className="text-white font-bold">{cart.length}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm text-slate-400">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {parcelCharge > 0 && (
                <div className="flex justify-between text-xs md:text-sm text-slate-400">
                  <span>Parcel Charge</span>
                  <span>₹{parcelCharge.toFixed(2)}</span>
                </div>
              )}
              {deliveryCharge > 0 && (
                <div className="flex justify-between text-xs md:text-sm text-slate-400">
                  <span>Delivery Charge</span>
                  <span>₹{deliveryCharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs md:text-sm text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">
                <span>Total Savings</span>
                <span>₹{getTotals().savings.toFixed(2)}</span>
              </div>
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-xs md:text-sm text-green-400 font-medium">
                  <span>Loyalty Discount ({appliedPoints} pts)</span>
                  <span>- ₹{loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-slate-800 my-2"></div>
              <div className="flex justify-between items-end">
                <span className="text-sm md:text-lg font-bold text-brand-300">Total</span>
                <div className="text-right">
                  <div className="text-2xl md:text-4xl font-black text-white tracking-tight">₹{grandTotal.toFixed(2)}</div>
                  {customer && (
                    <div className="text-[10px] text-brand-200 mt-1">Earn: +{Math.floor(grandTotal / 100)} pts</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <button 
                onClick={handleSendKot}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl md:rounded-2xl text-xs uppercase tracking-wider shadow border border-slate-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                disabled={cart.length === 0 || loading}
              >
                <Printer size={14} /> Send KOT
              </button>
              
              <button 
                onClick={async () => { 
                  setIsMobileCartOpen(false); 
                  const { roundedTotal } = getTotals();
                  setLoading(true);
                  try {
                    await handlePaymentComplete('CASH', roundedTotal.toString(), orderType); 
                  } catch (err) {
                    console.error('Checkout failed:', err);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="py-3 bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-xl md:rounded-2xl text-xs uppercase tracking-wider shadow shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                disabled={cart.length === 0 || loading}
              >
                <CreditCard size={14} /> Settle Bill
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Cart Button for Mobile */}
      <button 
        onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 active:scale-95 transition-transform"
      >
        <div className="relative">
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-3 -right-3 bg-brand-primary text-white text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-900 shadow-lg">
              {cart.length}
            </span>
          )}
        </div>
        <div className="flex flex-col text-left border-l border-slate-700 pl-4 w-28">
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 leading-none mb-1">Total Due</span>
          <span className="font-bold leading-none text-lg">₹{grandTotal.toFixed(2)}</span>
        </div>
      </button>

      {isPaymentModalOpen && (
        <PaymentModal 
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {isPreviewOpen && (
        <ReceiptPreview 
          order={recentOrder} 
          onClose={() => setIsPreviewOpen(false)} 
        />
      )}

      {isCustomerModalOpen && (
        <CustomerSelectionModal 
          onClose={() => setIsCustomerModalOpen(false)}
          onSelect={(c: any) => {
            setCustomer(c);
            setIsCustomerModalOpen(false);
          }}
        />
      )}

      {isRedeemModalOpen && (
        <RedeemPointsModal onClose={() => setIsRedeemModalOpen(false)} />
      )}

      <InstallPrompt />

      {/* Customization Modal */}
      {customizingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setCustomizingProduct(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-1.5"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">{customizingProduct.name}</h2>
            <p className="text-xs text-brand-primary font-bold uppercase mb-4">Customize Dish</p>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Product Type Tag (Veg/Non-Veg) */}
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest ${
                  customizingProduct.foodType === 'NON_VEG' ? 'bg-red-50 text-red-600 border border-red-200' :
                  customizingProduct.foodType === 'EGG' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                  'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}>
                  {customizingProduct.foodType || 'VEG'}
                </span>
              </div>

              {/* Variants Section */}
              {parseJsonField(customizingProduct.variants).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Select Portion / Size *</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {parseJsonField(customizingProduct.variants).map((variant: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={`p-3 rounded-xl font-bold text-xs uppercase border transition-all text-center ${
                          selectedVariant?.name === variant.name
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary ring-2 ring-brand-primary/20'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-black text-sm">{variant.name}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">₹{variant.price}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Addons Section */}
              {parseJsonField(customizingProduct.addons).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Add Extra Customizations / Modifiers</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {parseJsonField(customizingProduct.addons).map((addon: any, idx: number) => {
                      const isSelected = selectedModifiers.some(m => m.name === addon.name);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedModifiers(selectedModifiers.filter(m => m.name !== addon.name));
                            } else {
                              setSelectedModifiers([...selectedModifiers, addon]);
                            }
                          }}
                          className={`p-3 rounded-xl font-bold text-xs uppercase border transition-all text-left flex justify-between items-center ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-100'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{addon.name}</span>
                          <span className="font-bold">+ ₹{addon.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chef Notes instructions */}
              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Chef Instructions / Notes</h3>
                <textarea
                  placeholder="e.g. No onions, Extra spicy, Gluten-free..."
                  className="w-full p-3 bg-slate-50 border-none rounded-2xl font-bold text-slate-800 outline-none text-sm min-h-[80px]"
                  value={itemNotesInput}
                  onChange={(e) => setItemNotesInput(e.target.value)}
                />
              </div>

              {/* Customization Quantity Selector */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</span>
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => setCustomizationQty(Math.max(1, customizationQty - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="font-black text-lg text-slate-800">{customizationQty}</span>
                  <button 
                    type="button"
                    onClick={() => setCustomizationQty(customizationQty + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Customization Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="flex-1 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  addToCart(customizingProduct, customizationQty, selectedVariant, selectedModifiers, itemNotesInput);
                  setCustomizingProduct(null);
                }}
                className="flex-1 py-3 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-wider shadow"
              >
                Add To Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Selection Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsTableModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-1.5"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">Assign Dining Table</h2>
            <p className="text-xs text-slate-500 font-bold uppercase mb-6">Select a dining slot from the floor plan</p>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
              {sections.map((sec: any) => {
                const sectionTables = tables.filter((t: any) => t.sectionId === sec.id);
                if (sectionTables.length === 0) return null;

                return (
                  <div key={sec.id} className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-150 pb-1">{sec.name}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {sectionTables.map((table: any) => {
                        const isOccupied = table.status === 'OCCUPIED';
                        const isSelected = tableId === table.id;

                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={async () => {
                              if (isOccupied && table.currentOrderId !== activeOrderId) {
                                if (confirm(`Table ${table.number} has a running order. Load this running order into the POS?`)) {
                                  try {
                                    const res = await api.get(`/orders/${table.currentOrderId}`);
                                    loadRunningOrder(res.data, res.data.orderItems);
                                    setIsTableModalOpen(false);
                                  } catch (err) {
                                    alert('Failed to load table order.');
                                  }
                                }
                              } else {
                                if (activeOrderId && table.id !== tableId) {
                                  clearCart();
                                }
                                setTable(table.id, table.number);
                                setIsTableModalOpen(false);
                              }
                            }}
                            className={`p-4 rounded-2xl border text-center transition-all flex flex-col justify-between items-center h-24 ${
                              isSelected
                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-black ring-2 ring-brand-primary/20'
                                : isOccupied
                                ? 'border-amber-300 bg-amber-50 text-amber-700 font-bold'
                                : 'border-slate-200 hover:border-brand-400 bg-white text-slate-700'
                            }`}
                          >
                            <span className="text-lg font-black">{table.number}</span>
                            <span className="text-[9px] uppercase tracking-wider opacity-60">
                              {isOccupied ? `₹${table.runningOrderAmount.toFixed(0)}` : `${table.capacity} Pax`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Held Orders Modal */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsHeldModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-1.5"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">Held Orders Queue</h2>
            <p className="text-xs text-slate-500 font-bold uppercase mb-6">Resume or manage suspended drafts</p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {heldOrders.map((held: any) => (
                <div 
                  key={held.id}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-800 text-sm">{held.id}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{held.timestamp}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                      <span className="font-bold text-brand-primary uppercase">{held.orderType}</span>
                      {held.tableName && <span className="text-slate-400">• Table: {held.tableName}</span>}
                      {held.waiterName && <span className="text-slate-400">• Waiter: {held.waiterName}</span>}
                      <span>• {held.cart.length} items</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        resumeHeldOrder(held.id);
                        setIsHeldModalOpen(false);
                      }}
                      className="px-3 py-1.5 bg-brand-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow hover:bg-brand-secondary transition-all"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this held order?')) {
                          deleteHeldOrder(held.id);
                        }
                      }}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {heldOrders.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-bold italic">
                  No orders on hold.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Order Requests Modal */}
      {isQrRequestsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsQrRequestsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-1.5"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">QR Menu Order Requests</h2>
            <p className="text-xs text-slate-500 font-bold uppercase mb-6">Verify and approve customer self-orders</p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {pendingQrRequests.map((req: any) => (
                <div 
                  key={req.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-slate-700"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-black uppercase tracking-wider">
                          {req.orderType}
                        </span>
                        {req.tableName && (
                          <span className="font-black text-slate-800 text-sm">
                            Table {req.tableName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Cust: {req.customerName || 'QR Guest'} {req.customerPhone ? `(${req.customerPhone})` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="border-t border-slate-200/60 pt-2 space-y-1">
                    {req.orderItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-700 font-medium">
                        <span>
                          {item.product?.name || item.name}
                          {item.variant && <span className="text-[10px] text-orange-500 ml-1">({item.variant})</span>}
                          {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                            <span className="text-[10px] text-slate-400 block pl-3">
                              + {item.modifiers.map((m: any) => m.name).join(', ')}
                            </span>
                          )}
                          {item.notes && <span className="text-[10px] text-orange-600 block pl-3 italic">* "{item.notes}"</span>}
                        </span>
                        <span className="font-bold text-slate-900">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {req.notes && (
                    <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100/50 p-2 rounded-xl italic">
                      Note: "{req.notes}"
                    </p>
                  )}

                  {/* Approval Actions */}
                  <div className="flex gap-2 pt-2 border-t border-slate-200/60 justify-end">
                    <button
                      type="button"
                      onClick={() => handleRejectQrRequest(req.id)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveQrRequest(req.id)}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-orange-600/10 transition-all"
                    >
                      Approve & KOT
                    </button>
                  </div>
                </div>
              ))}
              {pendingQrRequests.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-bold italic">
                  No pending QR requests.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />
    </div>
  );
};

export default POSInterface;
