import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Save, ShoppingBag, ArrowLeft, Calendar, Check, User, ChevronDown, Trash, Clock, Loader2, ChefHat, AlertTriangle, X, RefreshCw, Flame, Package } from 'lucide-react';
import api from '../../api/api';
import { useNavigate, useLocation } from 'react-router-dom';

// Reusable Input Component with Floating-Style Label
const CustomInput = ({ label, value, onChange, placeholder, type = "text", disabled = false, icon = null, autoFocus = false }: any) => (
  <div className="relative group mb-6">
    <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] font-black text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-500 transition-colors">
      {label}
    </label>
    <div className={`flex items-center gap-3 w-full p-4 border-2 rounded-2xl transition-all ${disabled ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 group-focus-within:border-brand-500 group-focus-within:shadow-lg shadow-brand-500/5'}`}>
      {icon && <div className="text-slate-400 pl-1">{icon}</div>}
      <input 
        type={type} 
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent border-none focus:ring-0 text-slate-800 font-black placeholder:text-slate-200 p-0 text-lg md:text-xl"
        autoComplete="off"
      />
    </div>
  </div>
);

const StockEntry = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Active Tab: 'RAW_PROCUREMENT' vs 'FINISHED_PRODUCTION'
  const [activeTab, setActiveTab] = useState<'RAW_PROCUREMENT' | 'FINISHED_PRODUCTION'>('RAW_PROCUREMENT');

  // Core Raw Materials Data
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNo, setBillNo] = useState('');
  const [step, setStep] = useState<'main' | 'add-item' | 'finalize'>('main');

  // Payment State (For Raw Material Sourcing Finalize)
  const [isPaid, setIsPaid] = useState(true);
  const [paidAmount, setPaidAmount] = useState<string>('');

  // Sourcing Item Draft
  const [workingItem, setWorkingItem] = useState({
    rawMaterialId: '',
    name: '',
    quantity: '',
    unit: 'kg',
    price: '',
    total: 0
  });
  const [itemSearch, setItemSearch] = useState('');

  // Finished Products Production States
  const [eligibleProducts, setEligibleProducts] = useState<any[]>([]);
  const [productionSearch, setProductionSearch] = useState('');
  const [selectedProdItem, setSelectedProdItem] = useState<any | null>(null);
  const [produceQty, setProduceQty] = useState<number>(10);
  const [isProduceModalOpen, setIsProduceModalOpen] = useState(false);
  const [producing, setProducing] = useState(false);
  const [insufficientStockError, setInsufficientStockError] = useState<any[] | null>(null);

  // Shop Close States
  const [isShopCloseModalOpen, setIsShopCloseModalOpen] = useState(false);
  const [shopClosePreview, setShopClosePreview] = useState<{ productsToClear: any[]; totalStockValue: number } | null>(null);
  const [closingShop, setClosingShop] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // 1. Raw materials catalog
      const rawRes = await api.get('/inventory/raw-materials');
      setRawMaterials(rawRes.data);

      // 2. Suppliers list
      const supRes = await api.get('/suppliers');
      setSuppliers(supRes.data);

      // 3. Purchase bill reference number
      const countRes = await api.get('/purchases/count').catch(() => ({ data: { count: 0 } }));
      setBillNo(`PUR-${1001 + (countRes.data.count || 0)}`);

      // 4. Eligible finished products for production
      fetchEligibleProducts();

    } catch (error) {
      console.error('Error fetching initial stock procurement data:', error);
    }
  };

  const fetchEligibleProducts = async () => {
    try {
      const res = await api.get('/inventory/recipe-matrix/eligible-products');
      setEligibleProducts(res.data);
    } catch (err) {
      console.error('Error fetching production eligible products:', err);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  // Auto-sync supplier ID when typing
  useEffect(() => {
    const match = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
    if (match) setSelectedSupplierId(match.id);
  }, [supplierName, suppliers]);

  // Fetch supplier balance
  useEffect(() => {
    if (selectedSupplierId) {
      api.get(`/suppliers/${selectedSupplierId}/ledger`)
         .then(res => setSupplierBalance(res.data.summary?.currentBalance ?? null))
         .catch(() => setSupplierBalance(null));
    } else {
      setSupplierBalance(null);
    }
  }, [selectedSupplierId]);

  // Select Raw Material for Procurement Draft
  const handleSelectRawMaterial = (raw: any) => {
    setWorkingItem({
      rawMaterialId: raw.id,
      name: raw.name,
      unit: raw.unit || 'kg',
      quantity: '1',
      price: '0',
      total: 0
    });
    setItemSearch(raw.name);
  };

  const addToCartInternal = (shouldReset: boolean) => {
    if (!workingItem.rawMaterialId || !workingItem.quantity) return alert('Please select a raw material and enter quantity');
    
    const qty = parseFloat(workingItem.quantity);
    const prc = parseFloat(workingItem.price || '0');
    const newItem = { ...workingItem, quantity: qty, price: prc, total: qty * prc };

    setCart([...cart, newItem]);

    if (shouldReset) {
      setWorkingItem({ rawMaterialId: '', name: '', quantity: '', unit: 'kg', price: '', total: 0 });
      setItemSearch('');
    } else {
      setStep('main');
    }
  };

  // Submit Raw Material Procurement
  const handleSubmitProcurement = async (shouldReset: boolean = true) => {
    if (!supplierName) return alert('Please enter Party / Supplier Name');
    if (cart.length === 0) return alert('No raw material items added');

    setLoading(true);
    try {
      const payloadItems = cart.map(item => ({
        rawMaterialId: item.rawMaterialId,
        rawMaterialName: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }));

      await api.post('/inventory/purchases', {
        invoiceNo: billNo,
        supplierName,
        totalAmount,
        items: payloadItems
      });

      alert('Raw Material Stock Procurement Invoice Filed Successfully!');
      
      // Dispatch real-time refresh event
      window.dispatchEvent(new CustomEvent('inventory-updated'));

      fetchInitialData();
      setCart([]);
      setSupplierName('');
      setSelectedSupplierId('');
      setStep('main');

    } catch (error: any) {
      alert('Procurement Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // --- FINISHED PRODUCTS PRODUCTION LOGIC ---

  const handleOpenProductionModal = (prod: any) => {
    setSelectedProdItem(prod);
    setProduceQty(10);
    setInsufficientStockError(null);
    setIsProduceModalOpen(true);
  };

  const handleConfirmProduction = async () => {
    if (!selectedProdItem || produceQty <= 0) return;

    setProducing(true);
    setInsufficientStockError(null);

    try {
      const res = await api.post('/inventory/produce', {
        finishedProductId: selectedProdItem.id,
        quantity: produceQty
      });

      alert(`Successfully produced ${produceQty} pcs of ${selectedProdItem.name}! Finished stock updated.`);
      
      setIsProduceModalOpen(false);
      setSelectedProdItem(null);

      // Dispatch global real-time event
      window.dispatchEvent(new CustomEvent('inventory-updated'));

      // Refresh local products & raw materials
      fetchInitialData();

    } catch (err: any) {
      console.error('Production error:', err);
      if (err.response?.data?.insufficient) {
        setInsufficientStockError(err.response.data.insufficient);
      } else {
        alert('Production Failed: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setProducing(false);
    }
  };

  // --- SHOP CLOSE LOGIC ---

  const handleOpenShopCloseModal = async () => {
    try {
      const res = await api.get('/inventory/shop-close/preview');
      setShopClosePreview(res.data);
      setIsShopCloseModalOpen(true);
    } catch (err: any) {
      alert('Failed to load shop close preview: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleConfirmShopClose = async () => {
    if (!confirm('Are you sure you want to execute Shop Close? All unsold finished products will be cleared to 0 stock and recorded as Wasted Stock expense.')) return;

    setClosingShop(true);
    try {
      const res = await api.post('/inventory/shop-close');
      alert(res.data.message || 'Shop Close completed successfully!');
      
      setIsShopCloseModalOpen(false);

      // Dispatch real-time refresh event across system
      window.dispatchEvent(new CustomEvent('inventory-updated'));

      fetchInitialData();

    } catch (err: any) {
      alert('Shop Close Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setClosingShop(false);
    }
  };

  // --------------------------------------------------------------------------------
  // MAIN VIEW
  // --------------------------------------------------------------------------------
  if (step === 'main') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24">
        {/* Header Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-40 shadow-sm flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Stock Procurement & Manufacturing</h1>
              <p className="text-xs font-bold text-slate-400">Raw Sourcing, Recipe Matrix Consumption & Shop Close Clearance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenShopCloseModal}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Flame size={16} />
              <span>SHOP CLOSE</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 bg-slate-100 px-3 py-2 rounded-xl">
              <Calendar size={14} className="text-brand-600" />
              <input 
                type="date" 
                value={purchaseDate} 
                onChange={(e) => setPurchaseDate(e.target.value)} 
                className="bg-transparent border-none p-0 focus:ring-0 text-xs font-black cursor-pointer text-slate-800" 
              />
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6">
          <div className="flex gap-3 bg-slate-200/70 p-1.5 rounded-2xl max-w-md mb-6">
            <button
              onClick={() => setActiveTab('RAW_PROCUREMENT')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'RAW_PROCUREMENT'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package size={16} />
              <span>Vegetables & Raw Materials Catalog</span>
            </button>
            <button
              onClick={() => setActiveTab('FINISHED_PRODUCTION')}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'FINISHED_PRODUCTION'
                  ? 'bg-white text-brand-primary shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ChefHat size={16} />
              <span>Finished Products Production</span>
            </button>
          </div>

          {/* TAB 1: RAW MATERIALS PROCUREMENT */}
          {activeTab === 'RAW_PROCUREMENT' && (
            <div className="space-y-6 max-w-2xl">
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Entry Reference</span>
                    <div className="flex items-center gap-2 text-brand-600 font-black text-base">{billNo || '---'}</div>
                  </div>
                  {supplierBalance !== null && (
                    <div className="bg-brand-50 border border-brand-100 px-4 py-2 rounded-2xl flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
                      <div>
                        <p className="text-[8px] font-black text-brand-400 uppercase tracking-widest leading-none mb-0.5">Vendor Balance</p>
                        <p className="text-xs font-black text-brand-700">₹{supplierBalance.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative group">
                  <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-widest z-10">
                    Vendor / Sourcing Partner *
                  </label>
                  <div className="w-full p-4 border-2 border-slate-200 rounded-2xl flex items-center bg-white group-focus-within:border-brand-500 transition-all">
                    <input 
                      type="text" 
                      placeholder="Type supplier name..." 
                      value={supplierName} 
                      autoComplete="off"
                      onChange={(e) => { setSupplierName(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-800 placeholder:text-slate-300"
                    />
                  </div>
                  {showSuggestions && (
                    <div className="absolute z-[60] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                      {suppliers.filter(s => s.name.toLowerCase().includes(supplierName.toLowerCase())).map((s, idx) => (
                        <button key={idx} onClick={() => { setSupplierName(s.name); setSelectedSupplierId(s.id); setShowSuggestions(false); }} className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0">
                          <div>
                            <div className="font-black text-slate-800">{s.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{s.phone || 'No Contact'}</div>
                          </div>
                          <User size={16} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      if (!supplierName.trim()) return alert('Please enter Vendor / Sourcing Partner before adding raw material items.');
                      setStep('add-item');
                    }}
                    className="bg-slate-900 border-b-4 border-slate-950 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] transition-all shadow-xl"
                  >
                    <Plus size={28} className="text-brand-400" />
                    <span>{cart.length > 0 ? '+ Add More Raw Stock' : '+ Stage Raw Material Delivery'}</span>
                  </button>

                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Raw Material Inventory Count</span>
                    <span className="text-2xl font-black text-slate-900">{rawMaterials.length} Ingredients</span>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Vegetables & Raw Stock items only</p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Staged Delivery Items ({cart.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold">
                          <div>
                            <span className="text-slate-800">{item.name}</span>
                            <span className="text-slate-400 ml-2">({item.quantity} {item.unit} @ ₹{item.price})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-brand-primary font-black">₹{item.total.toFixed(2)}</span>
                            <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => setStep('finalize')}
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> File Procurement & Update Stock
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FINISHED PRODUCTS PRODUCTION */}
          {activeTab === 'FINISHED_PRODUCTION' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <ChefHat className="text-brand-primary" size={22} />
                    Finished Products Production Catalog
                  </h2>
                  <p className="text-xs font-bold text-slate-400">Only menu items with active Recipe Matrix mappings are displayed here.</p>
                </div>

                <div className="relative w-full md:w-72">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search production items..."
                    value={productionSearch}
                    onChange={(e) => setProductionSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
              </div>

              {/* Grid of Eligible Finished Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eligibleProducts
                  .filter(p => p.name.toLowerCase().includes(productionSearch.toLowerCase()))
                  .map(prod => {
                    const recipes = prod.recipeMatrix || prod.recipe || [];

                    return (
                      <div key={prod.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-md hover:shadow-xl transition-all flex flex-col justify-between relative overflow-hidden group">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-brand-50 text-brand-primary rounded-2xl flex items-center justify-center font-black text-xl shrink-0 border border-brand-100">
                                {prod.name.charAt(0)}
                              </div>
                              <div>
                                <h3 className="font-black text-slate-900 text-base leading-snug">{prod.name}</h3>
                                <p className="text-[11px] font-bold text-slate-400">₹{prod.sellingPrice?.toFixed(2)} / serving</p>
                              </div>
                            </div>

                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                              <Check size={10} strokeWidth={4} /> Recipe Mapped
                            </span>
                          </div>

                          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Recipe Ingredients Matrix</span>
                            <div className="flex flex-wrap gap-1.5">
                              {recipes.map((r: any, rIdx: number) => (
                                <span key={rIdx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700">
                                  {r.rawMaterial?.name || 'Raw Material'}: {r.quantityRequired || r.quantity} {r.unit || 'kg'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 mt-4 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Current Stock</span>
                            <span className={`text-base font-black ${prod.stockQuantity > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {prod.stockQuantity} {prod.unit || 'pcs'}
                            </span>
                          </div>

                          <button 
                            onClick={() => handleOpenProductionModal(prod)}
                            className="bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow flex items-center gap-1.5 transition-transform active:scale-95"
                          >
                            <Plus size={16} /> Produce
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {eligibleProducts.length === 0 && (
                  <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                    <ChefHat size={48} className="mx-auto text-slate-300" />
                    <h3 className="text-base font-black text-slate-800">No Recipe Mapped Finished Products</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Products must be configured in Recipe Matrix to be eligible for production. Navigate to Recipe Management to map raw material ingredients.
                    </p>
                    <button 
                      onClick={() => navigate('/recipes')}
                      className="bg-brand-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow"
                    >
                      Go to Recipe Management
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PRODUCTION MODAL */}
        {isProduceModalOpen && selectedProdItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 relative animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => setIsProduceModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-brand-50 text-brand-primary rounded-2xl flex items-center justify-center font-black text-xl border border-brand-100">
                  <ChefHat size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Produce {selectedProdItem.name}</h2>
                  <p className="text-xs font-bold text-slate-400">Current Stock: {selectedProdItem.stockQuantity} {selectedProdItem.unit || 'pcs'}</p>
                </div>
              </div>

              {/* Insufficient Stock Error Banner */}
              {insufficientStockError && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-black text-xs uppercase tracking-wider">
                    <AlertTriangle size={18} />
                    <span>Insufficient Stock - Production Blocked</span>
                  </div>
                  <table className="w-full text-left text-xs mt-2">
                    <thead>
                      <tr className="text-red-500 font-bold uppercase text-[9px] border-b border-red-200">
                        <th className="pb-1">Ingredient</th>
                        <th className="pb-1">Available</th>
                        <th className="pb-1">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 font-bold text-red-900">
                      {insufficientStockError.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1">{item.ingredient}</td>
                          <td className="py-1 text-red-600">{item.available?.toFixed(3)} {item.unit}</td>
                          <td className="py-1 text-red-700">{item.required?.toFixed(3)} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Production Quantity Selector */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Production Batch Quantity ({selectedProdItem.unit || 'pcs'})</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-900 text-center"
                    value={produceQty}
                    onChange={(e) => setProduceQty(Math.max(1, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="flex gap-2">
                  {[5, 10, 25, 50, 100].map(qty => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setProduceQty(qty)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        produceQty === qty ? 'bg-brand-primary text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      +{qty}
                    </button>
                  ))}
                </div>

                {/* Consumption Calculation Preview */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Raw Ingredient Consumption Plan</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {(selectedProdItem.recipeMatrix || selectedProdItem.recipe || []).map((rm: any, idx: number) => {
                      const required = (rm.quantityRequired || rm.quantity || 0) * produceQty;
                      return (
                        <div key={idx} className="flex justify-between text-xs font-bold py-1 border-b border-slate-100 last:border-0">
                          <span className="text-slate-700">{rm.rawMaterial?.name || 'Raw Material'}</span>
                          <span className="text-slate-900 font-mono">-{required.toFixed(3)} {rm.unit || 'kg'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsProduceModalOpen(false)}
                  className="px-5 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={producing}
                  onClick={handleConfirmProduction}
                  className="px-6 py-3 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/20 flex items-center gap-2"
                >
                  {producing && <Loader2 size={16} className="animate-spin" />}
                  <span>Produce & Update Stock</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SHOP CLOSE MODAL */}
        {isShopCloseModalOpen && shopClosePreview && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 md:p-8 relative animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => setIsShopCloseModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0">
                  <Flame size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Confirm Shop Close Stock Clearance</h2>
                  <p className="text-xs font-bold text-slate-400">Clears unsold finished products to 0 stock & records Wasted Stock expense.</p>
                </div>
              </div>

              <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl mb-6 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-800 leading-relaxed">
                  <strong>Important:</strong> Raw material stock will remain completely untouched. Only finished product items currently in stock will be reset to zero.
                </p>
              </div>

              {/* List of Products to Clear */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                  <span>Finished Products to Clear ({shopClosePreview.totalCount})</span>
                  <span>Total Stock Value</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {shopClosePreview.productsToClear.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold">
                      <div>
                        <span className="text-slate-800 font-bold">{p.name}</span>
                        <span className="text-slate-400 ml-2 font-mono">({p.stockQuantity} {p.unit || 'pcs'} @ ₹{p.cost.toFixed(2)})</span>
                      </div>
                      <span className="text-red-600 font-black">₹{p.itemValue.toFixed(2)}</span>
                    </div>
                  ))}

                  {shopClosePreview.productsToClear.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No finished products with positive stock available to clear.</p>
                  )}
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center font-black">
                  <span className="text-xs uppercase tracking-wider text-slate-400">Wasted Stock Expense to Create</span>
                  <span className="text-xl text-red-400">₹{shopClosePreview.totalStockValue.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsShopCloseModalOpen(false)}
                  className="px-5 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={closingShop}
                  onClick={handleConfirmShopClose}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 flex items-center gap-2"
                >
                  {closingShop && <Loader2 size={16} className="animate-spin" />}
                  <span>Confirm Shop Close</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // ADD RAW MATERIAL ITEM VIEW (Step 2 of Raw Procurement)
  // --------------------------------------------------------------------------------
  if (step === 'add-item') {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-50">
          <button onClick={() => setStep('main')} className="p-2 text-slate-500"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Raw Material Catalogue Lookup</h1>
        </div>

        <div className="p-4 space-y-4 max-w-xl mx-auto">
          <div className="relative mb-4">
            <CustomInput label="Search Raw Material" value={itemSearch} onChange={(e: any) => setItemSearch(e.target.value)} placeholder="Type ingredient name..." icon={<Search size={18} />} />
            {itemSearch && rawMaterials.filter(r => r.name.toLowerCase().includes(itemSearch.toLowerCase()) && r.name !== workingItem.name).length > 0 && (
              <div className="absolute top-16 left-0 right-0 z-50 bg-white shadow-2xl rounded-2xl border border-slate-100 max-h-56 overflow-y-auto">
                {rawMaterials.filter(r => r.name.toLowerCase().includes(itemSearch.toLowerCase()) && r.name !== workingItem.name).map(r => (
                  <button key={r.id} onClick={() => handleSelectRawMaterial(r)} className="w-full p-4 text-left hover:bg-slate-50 font-black text-slate-800 border-b border-slate-50 last:border-0 flex items-center justify-between">
                    <span>{r.name} ({r.unit})</span>
                    <span className="text-[10px] font-black text-brand-primary uppercase">Select</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CustomInput label="Procure Qty" type="number" value={workingItem.quantity} onChange={(e: any) => setWorkingItem({...workingItem, quantity: e.target.value})} placeholder="0" />
            <div className="relative group mb-6">
              <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Unit</label>
              <div className="flex items-center gap-3 w-full p-4 border-2 border-slate-100 rounded-2xl bg-white">
                <input type="text" disabled value={workingItem.unit} className="w-full bg-transparent border-none font-bold text-slate-800 p-0 text-base" />
              </div>
            </div>
          </div>

          <CustomInput label="Purchase Rate (₹ per unit)" type="number" value={workingItem.price} onChange={(e: any) => setWorkingItem({...workingItem, price: e.target.value})} placeholder="0.00" />

          <div className="pt-4 px-1">
            <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center border border-slate-100">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Line Item Total</span>
              <span className="text-3xl font-black text-slate-900">₹{(parseFloat(workingItem.quantity || '0') * parseFloat(workingItem.price || '0')).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100">
          <div className="max-w-xl mx-auto flex gap-4 h-14">
            <button 
              onClick={() => addToCartInternal(true)} 
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl text-xs uppercase tracking-wider"
            >
              Save & Add Another
            </button>
            <button 
              onClick={() => addToCartInternal(false)} 
              className="flex-[2] bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/20"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // FINALIZE RAW PROCUREMENT VIEW (Step 3)
  // --------------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setStep('main')} className="p-2 text-slate-500"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Confirm Raw Procurement Invoice</h1>
        </div>
        <p className="text-xs font-black text-slate-400">{purchaseDate}</p>
      </div>

      <div className="p-4 space-y-6 max-w-xl mx-auto">
        <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-2">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">Primary Sourcing Partner</span>
          <p className="text-2xl font-black">{supplierName || 'Manual Entry Vendor'}</p>
        </div>

        <div className="space-y-3">
          {cart.map((item, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                <p className="text-xs text-slate-400 font-bold">{item.quantity} {item.unit} x ₹{item.price}</p>
              </div>
              <p className="font-black text-slate-900 text-lg">₹{item.total.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center border border-slate-200">
          <span className="text-xs font-black uppercase text-slate-500">Invoice Total</span>
          <span className="text-2xl font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-50">
        <div className="max-w-xl mx-auto">
          <button 
            onClick={() => handleSubmitProcurement(true)} 
            disabled={loading}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={18}/>}
            <span>{loading ? 'Submitting Invoice...' : 'Commit Raw Material Delivery'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockEntry;
