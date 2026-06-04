import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Search, ShoppingCart, User, CreditCard, Trash2, Plus, Minus, Scan, Maximize, Minimize, Camera, Wifi, WifiOff, X, LayoutGrid, Printer, CheckCircle, Smartphone, Battery, ChevronRight, Clock, Star, Users, HandCoins, Bluetooth, BluetoothOff, RefreshCw } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../../api/api';
import usePOSStore from '../../store/posStore';
import useAuthStore from '../../store/authStore';
import PaymentModal from '../../components/PaymentModal';
import ReceiptPreview from '../../components/ReceiptPreview';
import { Product, CartItem } from '../../types';
import { offlineDB } from '../../utils/offlineDB';
import { addToSyncQueue } from '../../utils/syncQueue';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { useBluetoothPrinter } from '../../hooks/useBluetoothPrinter';
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

  const isOnline = useNetworkStatus();
  const { isConnected, isConnecting, disconnect, connect } = useBluetoothPrinter();
  
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

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    
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
  }, []);

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

  const handlePaymentComplete = async (method: string, amount: string, orderType: string = 'Walk-in') => {
    if (cart.length === 0) return;

    const { subtotal, taxTotal, grandTotal, roundedTotal, savings } = getTotals();

    // DETECT NEXT SEQUENTIAL INVOICE NO - Optimized to avoid reading all orders
    let nextInvoiceNo = localStorage.getItem('last_invoice_no') || '100';
    try {
      const db = await offlineDB.initDB();
      const tx = db.transaction('orders', 'readonly');
      const store = tx.objectStore('orders');
      // Get the last record by index or by key if IDs are sequential/sortable
      // Since we use UUIDs for keys, we might need a dedicated way.
      // For now, let's use the local orders cache if small, or just increment last known.
      const lastInvoice = parseInt(nextInvoiceNo);
      nextInvoiceNo = (lastInvoice + 1).toString();
      localStorage.setItem('last_invoice_no', nextInvoiceNo);
    } catch (e) {
      nextInvoiceNo = (Date.now() % 10000).toString();
    }
    
    const orderData = {
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
      }), 
      invoiceNo: nextInvoiceNo,
      orderItems: cart.map((item: any, index: number) => ({
        ...item,
        slNo: index + 1,
        price: item.sellingPrice,
        gstRate: item.gstRate ?? 0,
        total: (item.sellingPrice * item.quantity) + ((item.sellingPrice * ((item.gstRate ?? 0) / 100)) * item.quantity)
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
      orderType: orderType, // Added Order Type
      discount: loyaltyDiscount + manualDiscount,
      manualDiscount: manualDiscount,
      loyaltyPointsRedeemed: appliedPoints,
      customerId: customer?.id || null,
      customer: customer,
      userName: user?.name || 'Staff',
      creatorId: user?.id || null,
      createdAt: new Date().toISOString(),
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
        api.post('/orders', orderData, {
          headers: { 'x-terminal-id': 'T1' },
          skipAuthRedirect: true
        } as any).then(response => {
          const syncedData = { ...orderData, ...response.data, isSyncing: false, isSynced: true };
          offlineDB.put('orders', syncedData).catch(() => {});
          
          // Silently update live receipt state if it's still open
          setRecentOrder(prev => prev?.id === finalOrderData.id ? syncedData : prev);
          
          // Fire WhatsApp ONLY after successful sync completion
          // Silent WhatsApp dispatch
          if (syncedData.customer?.phone) {
             api.post('/orders/share-whatsapp', { 
                 orderId: syncedData.id || syncedData.invoiceNo, 
                 phone: syncedData.customer.phone 
             }, { skipAuthRedirect: true } as any).catch(err => console.error('Silent WhatsApp dispatch failed:', err));
          }
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

  const { subtotal, taxTotal, grandTotal } = getTotals();

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
                    onSelect={addToCart}
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
            <button 
              onClick={clearCart}
              className="text-red-500 hover:bg-red-50 p-1.5 md:p-2 rounded-lg transition-colors group"
            >
              <Trash2 size={18} className="md:w-5 md:h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {cart.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {cart.map((item: CartItem) => (
                  <div key={item.id} className="p-3 md:p-4 hover:bg-slate-50/50 transition-colors flex items-center gap-3 md:gap-4 animate-in fade-in slide-in-from-right-4 group">
                    {/* Individual Delete Button on Left */}
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shrink-0"
                      title="Remove item"
                    >
                      <Trash2 size={18} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm md:text-base truncate">{item.name}</div>
                      <div className="text-xs md:text-sm text-slate-500 flex items-center gap-1.5">
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
                           <span>₹{item.sellingPrice.toFixed(2)}</span>
                         )}
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className="truncate">{item.category?.name || 'General'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 md:p-1">
                        <button 
                          onClick={() => {
                            updateQuantity(item.id, Math.max(1, item.quantity - 1));
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
                              updateQuantity(item.id, 0);
                              return;
                            }
                            let val = parseFloat(valStr) || 0;
                            if (!isFractionalUnit(item.unit)) val = Math.round(val);
                            updateQuantity(item.id, Math.max(0, val));
                          }}
                          onBlur={() => {
                            if (item.quantity <= 0) {
                              updateQuantity(item.id, isFractionalUnit(item.unit) ? 0.001 : 1);
                            }
                          }}
                          className="w-12 md:w-16 bg-transparent border-none text-center font-bold text-base text-slate-700 focus:ring-0 p-0"
                        />
                        <button 
                          onClick={() => {
                            updateQuantity(item.id, item.quantity + 1);
                          }}
                          className="w-6 md:w-8 h-6 md:h-8 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-slate-600"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>
                      <div className="font-bold text-slate-900 text-xs md:text-base">₹{(item.sellingPrice * item.quantity).toFixed(2)}</div>
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
            
            <div className="grid grid-cols-1 gap-2 md:gap-3">
              <button 
                onClick={() => { setIsMobileCartOpen(false); setIsPaymentModalOpen(true); }}
                className="py-3 md:py-4 w-full bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-xl md:rounded-2xl text-sm md:text-base shadow-lg shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={cart.length === 0}
              >
                <CreditCard size={18} /> PROCEED TO PAYMENT
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
    </div>
  );
};

export default POSInterface;
