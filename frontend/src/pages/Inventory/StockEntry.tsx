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
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [prodCatalogFilter, setProdCatalogFilter] = useState<'RECIPE_MAPPED' | 'ALL_PRODUCTS'>('RECIPE_MAPPED');
  const [productionSearch, setProductionSearch] = useState('');
  const [selectedProdItem, setSelectedProdItem] = useState<any | null>(null);
  const [produceQty, setProduceQty] = useState<number>(10);
  const [productionMode, setProductionMode] = useState<'RECIPE' | 'CUSTOM'>('RECIPE');
  const [customIngredients, setCustomIngredients] = useState<any[]>([]);
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

      // 5. All products for custom production lookup
      const prodRes = await api.get('/products');
      setAllProducts(prodRes.data);

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

  // New Raw Material Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRawItem, setNewRawItem] = useState({ name: '', unit: 'kg', lowStockThreshold: '10' });
  const [rawSearchQuery, setRawSearchQuery] = useState('');

  // Add raw material item directly to draft procurement cart
  const handleAddRawToCart = (raw: any) => {
    const existingIndex = cart.findIndex(item => item.rawMaterialId === raw.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].price;
      setCart(updated);
    } else {
      setCart([...cart, {
        rawMaterialId: raw.id,
        name: raw.name,
        unit: raw.unit || 'kg',
        quantity: 1,
        price: 0,
        total: 0
      }]);
    }
  };

  const handleUpdateCartItem = (index: number, field: string, value: any) => {
    const updated = [...cart];
    if (field === 'quantity') {
      updated[index].quantity = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'price') {
      updated[index].price = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'unit') {
      updated[index].unit = value;
    }
    updated[index].total = updated[index].quantity * updated[index].price;
    setCart(updated);
  };

  const handleRemoveCartItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleCreateRawMaterial = async () => {
    if (!newRawItem.name.trim()) return alert('Please enter Raw Material Name');
    
    try {
      const res = await api.post('/inventory/raw-materials', {
        name: newRawItem.name.trim(),
        unit: newRawItem.unit,
        stockQuantity: 0,
        lowStockThreshold: parseFloat(newRawItem.lowStockThreshold) || 10
      });

      alert(`Raw material "${res.data.name}" created successfully!`);
      setIsCreateModalOpen(false);
      setNewRawItem({ name: '', unit: 'kg', lowStockThreshold: '10' });

      // Refresh catalog and auto-add to cart
      const updatedRawList = await api.get('/inventory/raw-materials');
      setRawMaterials(updatedRawList.data);

      handleAddRawToCart(res.data);
    } catch (err: any) {
      alert('Failed to create raw material: ' + (err.response?.data?.error || err.message));
    }
  };

  // Submit Raw Material Procurement
  const handleSubmitProcurement = async () => {
    if (!supplierName.trim()) return alert('Please select or enter Vendor Name');
    if (cart.length === 0) return alert('No products drafted in procurement');

    const validItems = cart.filter(item => item.quantity > 0);
    if (validItems.length === 0) return alert('Please enter quantity > 0 for drafted items');

    setLoading(true);
    try {
      const payloadItems = validItems.map(item => ({
        rawMaterialId: item.rawMaterialId,
        rawMaterialName: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }));

      await api.post('/inventory/purchases', {
        invoiceNo: billNo,
        supplierName: supplierName.trim(),
        totalAmount,
        items: payloadItems
      });

      alert(`Stock procurement invoice ${billNo} registered successfully!`);
      
      // Dispatch real-time refresh event
      window.dispatchEvent(new CustomEvent('inventory-updated'));

      fetchInitialData();
      setCart([]);
      setSupplierName('');
      setSelectedSupplierId('');

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

    const recipe = prod.recipeMatrix || prod.recipe || [];
    if (recipe.length > 0) {
      setProductionMode('RECIPE');
      setCustomIngredients(
        recipe.map((r: any) => ({
          rawMaterialId: r.rawMaterialId,
          name: r.rawMaterial?.name || rawMaterials.find(rm => rm.id === r.rawMaterialId)?.name || 'Ingredient',
          quantityConsumed: (r.quantityRequired || r.quantity || 0) * 10,
          unit: r.unit || r.rawMaterial?.unit || 'kg'
        }))
      );
    } else {
      setProductionMode('CUSTOM');
      setCustomIngredients([{ rawMaterialId: '', name: '', quantityConsumed: 0, unit: 'kg' }]);
    }

    setIsProduceModalOpen(true);
  };

  const handleQtyChange = (newQty: number) => {
    setProduceQty(newQty);
    // Auto-scale custom ingredients if recipe mode or custom pre-filled
    if (selectedProdItem) {
      const recipe = selectedProdItem.recipeMatrix || selectedProdItem.recipe || [];
      if (recipe.length > 0) {
        setCustomIngredients(
          recipe.map((r: any) => ({
            rawMaterialId: r.rawMaterialId,
            name: r.rawMaterial?.name || rawMaterials.find(rm => rm.id === r.rawMaterialId)?.name || 'Ingredient',
            quantityConsumed: (r.quantityRequired || r.quantity || 0) * newQty,
            unit: r.unit || r.rawMaterial?.unit || 'kg'
          }))
        );
      }
    }
  };

  const addCustomIngredientRow = () => {
    setCustomIngredients([...customIngredients, { rawMaterialId: '', name: '', quantityConsumed: 0, unit: 'kg' }]);
  };

  const removeCustomIngredientRow = (index: number) => {
    setCustomIngredients(customIngredients.filter((_, i) => i !== index));
  };

  const updateCustomIngredientRow = (index: number, field: string, value: any) => {
    const updated = [...customIngredients];
    if (field === 'rawMaterialId') {
      const raw = rawMaterials.find(r => r.id === value);
      updated[index].rawMaterialId = value;
      updated[index].name = raw ? raw.name : '';
      updated[index].unit = raw ? raw.unit : 'kg';
    } else if (field === 'quantityConsumed') {
      updated[index].quantityConsumed = parseFloat(value) || 0;
    }
    setCustomIngredients(updated);
  };

  const handleConfirmProduction = async () => {
    if (!selectedProdItem || produceQty <= 0) return;

    if (productionMode === 'CUSTOM') {
      const validCustom = customIngredients.filter(c => c.rawMaterialId && parseFloat(c.quantityConsumed) > 0);
      if (validCustom.length === 0) {
        return alert('Please add at least one valid ingredient with quantity > 0 for Custom Production.');
      }
    }

    setProducing(true);
    setInsufficientStockError(null);

    try {
      const payload: any = {
        finishedProductId: selectedProdItem.id,
        quantity: produceQty
      };

      if (productionMode === 'CUSTOM') {
        payload.customItems = customIngredients
          .filter(c => c.rawMaterialId && parseFloat(c.quantityConsumed) > 0)
          .map(c => ({
            rawMaterialId: c.rawMaterialId,
            quantityConsumed: parseFloat(c.quantityConsumed),
            unit: c.unit
          }));
      }

      const res = await api.post('/inventory/produce', payload);

      alert(`Successfully produced ${produceQty} ${selectedProdItem.unit || 'pcs'} of ${selectedProdItem.name}! Finished product stock updated.`);
      
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
      <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans pb-32">
        {/* Header Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 sticky top-0 z-40 shadow-sm flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Procurement</h1>
              <span className="bg-pink-50 text-pink-600 border border-pink-200 text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-md uppercase">
                REGISTER SUPPLIER DELIVERIES
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenShopCloseModal}
              className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Flame size={14} />
              <span>SHOP CLOSE</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
              <Calendar size={14} className="text-pink-500" />
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
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
          <div className="flex gap-3 bg-slate-200/70 p-1 rounded-2xl max-w-md mb-6">
            <button
              onClick={() => setActiveTab('RAW_PROCUREMENT')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'RAW_PROCUREMENT'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package size={16} />
              <span>Stock Procurement</span>
            </button>
            <button
              onClick={() => setActiveTab('FINISHED_PRODUCTION')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'FINISHED_PRODUCTION'
                  ? 'bg-white text-brand-primary shadow-md'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ChefHat size={16} />
              <span>Finished Production</span>
            </button>
          </div>

          {/* TAB 1: RAW MATERIALS PROCUREMENT */}
          {activeTab === 'RAW_PROCUREMENT' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT COLUMN: SOURCING DETAILS & VENDOR META INFO (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* SOURCING DETAILS CARD */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                    <div className="flex items-center gap-2 text-pink-600 font-black text-xs uppercase tracking-wider">
                      <span>✨ SOURCING DETAILS</span>
                    </div>

                    {/* VENDOR NAME SELECT/INPUT */}
                    <div className="space-y-1 relative">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                        VENDOR NAME *
                      </label>
                      <div className="relative">
                        <select
                          className="w-full p-3.5 bg-white border-2 border-slate-200 focus:border-pink-500 rounded-2xl font-black text-sm text-slate-900 appearance-none outline-none transition-all pr-10"
                          value={selectedSupplierId}
                          onChange={(e) => {
                            const supId = e.target.value;
                            setSelectedSupplierId(supId);
                            const found = suppliers.find(s => s.id === supId);
                            if (found) setSupplierName(found.name);
                          }}
                        >
                          <option value="">Select Vendor...</option>
                          {suppliers.map((s, idx) => (
                            <option key={idx} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* INVOICE NUMBER / REF */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                        INVOICE NUMBER / REF
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. INV-1092"
                        value={billNo}
                        onChange={(e) => setBillNo(e.target.value)}
                        className="w-full p-3.5 bg-white border-2 border-slate-200 focus:border-pink-500 rounded-2xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* VENDOR META INFO CARD */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      VENDOR META INFO
                    </span>

                    {(() => {
                      const matchedSup = suppliers.find(s => s.id === selectedSupplierId || s.name.toLowerCase() === supplierName.toLowerCase());
                      return (
                        <div className="space-y-2 text-xs font-bold text-slate-700">
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-400">Party:</span>
                            <span className="font-black text-slate-900">{matchedSup?.name || supplierName || 'aymen'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Contact:</span>
                            <span className="font-black text-slate-900">{matchedSup?.phone || '96334 38625'}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* RIGHT COLUMN: FIND / ADD PRODUCT & DRAFT CART (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* FIND / ADD PRODUCT CARD */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 relative">
                    
                    {/* Floating Pink Badge */}
                    <div className="absolute -top-3 left-6 bg-pink-50 text-pink-600 border border-pink-200 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                      FIND / ADD PRODUCT
                    </div>

                    {/* Search Input Box */}
                    <div className="relative pt-1">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search product from catalog..."
                        value={rawSearchQuery}
                        onChange={(e) => setRawSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 focus:border-pink-500 rounded-2xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none transition-all"
                      />

                      {/* Dropdown Suggestions */}
                      {rawSearchQuery.trim().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-56 overflow-y-auto">
                          {rawMaterials
                            .filter(rm => rm.name.toLowerCase().includes(rawSearchQuery.toLowerCase()))
                            .map((rm, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  handleAddRawToCart(rm);
                                  setRawSearchQuery('');
                                }}
                                className="w-full p-3 text-left hover:bg-pink-50/50 flex items-center justify-between border-b border-slate-100 last:border-0"
                              >
                                <span className="font-black text-slate-800 text-xs">{rm.name} ({rm.unit})</span>
                                <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md">+ Add to Draft</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* CREATE PRODUCT "NEW" BUTTON */}
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="w-full py-3 bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-600 border border-indigo-200/80 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={16} />
                      <span>CREATE PRODUCT "NEW"</span>
                    </button>

                    {/* DRAFT ITEMS TABLE / EMPTY STATE */}
                    {cart.length === 0 ? (
                      <div className="py-12 text-center space-y-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                          <Clock size={32} />
                        </div>
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">NO PRODUCTS DRAFTED</h3>
                        <p className="text-xs text-slate-400 font-bold">Select a vendor or search products to begin</p>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {cart.map((item, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs font-bold">
                              <span className="flex-1 font-black text-slate-900 min-w-[140px]">{item.name}</span>

                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  placeholder="Qty"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  onChange={(e) => handleUpdateCartItem(idx, 'quantity', e.target.value)}
                                  className="w-20 p-2 bg-white border border-slate-200 rounded-xl font-black text-center text-slate-900 text-xs"
                                />
                                <select
                                  value={item.unit}
                                  onChange={(e) => handleUpdateCartItem(idx, 'unit', e.target.value)}
                                  className="p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-xs"
                                >
                                  <option value="kg">kg</option>
                                  <option value="gram">g</option>
                                  <option value="litre">ltr</option>
                                  <option value="ml">ml</option>
                                  <option value="pcs">pcs</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Price"
                                  value={item.price === 0 ? '' : item.price}
                                  onChange={(e) => handleUpdateCartItem(idx, 'price', e.target.value)}
                                  className="w-24 p-2 bg-white border border-slate-200 rounded-xl font-black text-center text-slate-900 text-xs"
                                />
                              </div>

                              <span className="w-24 text-right font-black text-slate-900">₹{item.total.toFixed(2)}</span>

                              <button
                                onClick={() => handleRemoveCartItem(idx)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary Footer inside Right Card */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-slate-400">Subtotal ({cart.length} lines) <span className="font-mono font-black text-slate-800 ml-4">₹{totalAmount.toFixed(2)}</span></span>
                      <div className="flex items-baseline gap-4 mt-1">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Total Procurement Value</span>
                        <span className="text-2xl md:text-3xl font-black text-pink-600 font-mono">₹{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* VEGETABLES & RAW MATERIALS CATALOG CARD */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <div className="text-pink-600 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <span>✨ VEGETABLES & RAW MATERIALS CATALOG</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          HIGHLIGHTING ITEMS SUPPLIED BY {supplierName?.toUpperCase() || 'VENDOR'}
                        </p>
                      </div>

                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {rawMaterials.length} products available
                      </span>
                    </div>

                    {/* Raw Materials Quick Add Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                      {rawMaterials.map((rm) => (
                        <button
                          key={rm.id}
                          onClick={() => handleAddRawToCart(rm)}
                          className="bg-slate-50 hover:bg-pink-50/50 p-3 rounded-2xl border border-slate-200/80 hover:border-pink-300 text-left transition-all group flex flex-col justify-between"
                        >
                          <div>
                            <span className="font-black text-slate-800 text-xs block group-hover:text-pink-600 transition-colors">{rm.name}</span>
                            <span className="text-[10px] font-bold text-slate-400">Stock: {rm.stockQuantity} {rm.unit}</span>
                          </div>
                          <span className="mt-2 text-[10px] font-black text-pink-600 uppercase tracking-wider flex items-center gap-1">
                            <Plus size={12} /> Add to Procurement
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
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
                  <p className="text-xs font-bold text-slate-400">Convert raw materials into finished products via Recipe Matrix or Custom Production.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setProdCatalogFilter('RECIPE_MAPPED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        prodCatalogFilter === 'RECIPE_MAPPED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Mapped Recipes ({eligibleProducts.length})
                    </button>
                    <button
                      onClick={() => setProdCatalogFilter('ALL_PRODUCTS')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        prodCatalogFilter === 'ALL_PRODUCTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      All POS Products ({allProducts.length})
                    </button>
                  </div>

                  <div className="relative w-full md:w-64">
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
              </div>

              {/* Grid of Finished Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(prodCatalogFilter === 'RECIPE_MAPPED' ? eligibleProducts : allProducts)
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

                            {recipes.length > 0 ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <Check size={10} strokeWidth={4} /> Recipe Mapped
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
                                Custom Production Only
                              </span>
                            )}
                          </div>

                          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Recipe Ingredients Matrix</span>
                            <div className="flex flex-wrap gap-1.5">
                              {recipes.map((r: any, rIdx: number) => (
                                <span key={rIdx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700">
                                  {r.rawMaterial?.name || rawMaterials.find(rm => rm.id === r.rawMaterialId)?.name || 'Ingredient'}: {r.quantityRequired || r.quantity} {r.unit || 'kg'}
                                </span>
                              ))}
                              {recipes.length === 0 && (
                                <span className="text-[10px] font-bold text-slate-400 italic">No pre-mapped recipe. Custom production available.</span>
                              )}
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

                {(prodCatalogFilter === 'RECIPE_MAPPED' ? eligibleProducts : allProducts).length === 0 && (
                  <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                    <ChefHat size={48} className="mx-auto text-slate-300" />
                    <h3 className="text-base font-black text-slate-800">No Finished Products Found</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Switch to "All POS Products" to produce any menu item via Custom Production, or map recipes in Recipe Management.
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
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 md:p-8 relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsProduceModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-brand-50 text-brand-primary rounded-2xl flex items-center justify-center font-black text-xl border border-brand-100 shrink-0">
                  <ChefHat size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Produce {selectedProdItem.name}</h2>
                  <p className="text-xs font-bold text-slate-400">Current POS Stock: <span className="text-emerald-600 font-extrabold">{selectedProdItem.stockQuantity} {selectedProdItem.unit || 'pcs'}</span></p>
                </div>
              </div>

              {/* Mode Switcher: Recipe vs Custom */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setProductionMode('RECIPE');
                    const recipe = selectedProdItem.recipeMatrix || selectedProdItem.recipe || [];
                    setCustomIngredients(
                      recipe.map((r: any) => ({
                        rawMaterialId: r.rawMaterialId,
                        name: r.rawMaterial?.name || rawMaterials.find(rm => rm.id === r.rawMaterialId)?.name || 'Ingredient',
                        quantityConsumed: (r.quantityRequired || r.quantity || 0) * produceQty,
                        unit: r.unit || r.rawMaterial?.unit || 'kg'
                      }))
                    );
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    productionMode === 'RECIPE'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Recipe Matrix Production
                </button>
                <button
                  type="button"
                  onClick={() => setProductionMode('CUSTOM')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    productionMode === 'CUSTOM'
                      ? 'bg-white text-brand-primary shadow-md'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Custom Production (On-The-Fly)
                </button>
              </div>

              {/* Insufficient Stock Error Banner */}
              {insufficientStockError && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 p-4 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-red-700 font-black text-xs uppercase tracking-wider">
                    <AlertTriangle size={18} />
                    <span>Insufficient Stock - Production Blocked</span>
                  </div>
                  <table className="w-full text-left text-xs mt-2">
                    <thead>
                      <tr className="text-red-500 font-bold uppercase text-[9px] border-b border-red-200">
                        <th className="pb-1">Ingredient</th>
                        <th className="pb-1">Available Stock</th>
                        <th className="pb-1">Required for Batch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 font-bold text-red-900">
                      {insufficientStockError.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1">{item.ingredient}</td>
                          <td className="py-1 text-red-600">{item.available?.toFixed(3)} {item.unit}</td>
                          <td className="py-1 text-red-700 font-extrabold">{item.required?.toFixed(3)} {item.unit}</td>
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
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl text-slate-900 text-center"
                    value={produceQty}
                    onChange={(e) => handleQtyChange(Math.max(1, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="flex gap-2">
                  {[5, 10, 25, 50, 100].map(qty => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => handleQtyChange(qty)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        produceQty === qty ? 'bg-brand-primary text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      +{qty}
                    </button>
                  ))}
                </div>

                {/* RECIPE MODE INGREDIENT CONSUMPTION PREVIEW */}
                {productionMode === 'RECIPE' && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Standard Recipe Consumption Plan</span>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {(selectedProdItem.recipeMatrix || selectedProdItem.recipe || []).map((rm: any, idx: number) => {
                        const required = (rm.quantityRequired || rm.quantity || 0) * produceQty;
                        return (
                          <div key={idx} className="flex justify-between text-xs font-bold py-1.5 border-b border-slate-100 last:border-0">
                            <span className="text-slate-700">{rm.rawMaterial?.name || rawMaterials.find(r => r.id === rm.rawMaterialId)?.name || 'Raw Material'}</span>
                            <span className="text-slate-900 font-mono font-black">-{required.toFixed(3)} {rm.unit || 'kg'}</span>
                          </div>
                        );
                      })}
                      {(selectedProdItem.recipeMatrix || selectedProdItem.recipe || []).length === 0 && (
                        <p className="text-xs text-slate-400 italic py-2">No recipe matrix mapped. Switch to Custom Production tab above.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* CUSTOM MODE INGREDIENT BUILDER */}
                {productionMode === 'CUSTOM' && (
                  <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">Custom Raw Material Ingredients</span>
                      <button
                        type="button"
                        onClick={addCustomIngredientRow}
                        className="text-brand-primary font-black text-xs uppercase tracking-wider hover:underline"
                      >
                        + Add Ingredient
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {customIngredients.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-amber-100 shadow-sm">
                          <select
                            className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs"
                            value={item.rawMaterialId}
                            onChange={(e) => updateCustomIngredientRow(idx, 'rawMaterialId', e.target.value)}
                          >
                            <option value="">-- Choose Raw Material --</option>
                            {rawMaterials.map(rm => (
                              <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>
                            ))}
                          </select>

                          <div className="relative w-28">
                            <input 
                              type="number"
                              step="0.001"
                              placeholder="Qty consumed"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs text-center pr-6"
                              value={item.quantityConsumed === 0 ? '' : item.quantityConsumed}
                              onChange={(e) => updateCustomIngredientRow(idx, 'quantityConsumed', e.target.value)}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{item.unit}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeCustomIngredientRow(idx)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HIGH VISIBILITY PRODUCTION CONFIRMATION BOX */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-lg">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b border-slate-800 pb-2">
                    PRODUCTION CONFIRMATION SUMMARY
                  </span>

                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">WHAT WILL BE PRODUCED:</span>
                      <span className="bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-black text-sm">
                        {selectedProdItem.name} × {produceQty} {selectedProdItem.unit || 'pcs'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase block mb-1">WHAT WILL BE CONSUMED FROM RAW STOCK:</span>
                      <div className="space-y-1 pl-2 font-mono text-emerald-400 text-xs">
                        {(productionMode === 'RECIPE'
                          ? (selectedProdItem.recipeMatrix || selectedProdItem.recipe || []).map((rm: any) => ({
                              name: rm.rawMaterial?.name || rawMaterials.find(r => r.id === rm.rawMaterialId)?.name || 'Ingredient',
                              weight: ((rm.quantityRequired || rm.quantity || 0) * produceQty).toFixed(3),
                              unit: rm.unit || 'kg'
                            }))
                          : customIngredients.filter(c => c.rawMaterialId && c.quantityConsumed > 0).map(c => ({
                              name: c.name || rawMaterials.find(r => r.id === c.rawMaterialId)?.name || 'Ingredient',
                              weight: parseFloat(c.quantityConsumed).toFixed(3),
                              unit: c.unit || 'kg'
                            }))
                        ).map((cp, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>• {cp.name}</span>
                            <span>-{cp.weight} {cp.unit}</span>
                          </div>
                        ))}

                        {(productionMode === 'CUSTOM' ? customIngredients.filter(c => c.rawMaterialId && c.quantityConsumed > 0).length : (selectedProdItem.recipeMatrix || selectedProdItem.recipe || []).length) === 0 && (
                          <span className="text-amber-400 text-xs font-sans italic">No ingredient consumption set!</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
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
                  className="px-6 py-3.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/20 flex items-center gap-2"
                >
                  {producing && <Loader2 size={16} className="animate-spin" />}
                  <span>PRODUCE & UPDATE STOCK</span>
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

        {/* STICKY BOTTOM ACTION BAR */}
        {activeTab === 'RAW_PROCUREMENT' && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 md:px-8 py-3 flex justify-between items-center z-40 shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                STAGED PROCUREMENT SUMMARY
              </span>
              <span className="text-xs font-bold text-slate-800">
                <span className="font-black">{cart.length}</span> items staged / Total Value: <span className="font-black font-mono text-pink-600">₹{totalAmount.toFixed(2)}</span>
              </span>
            </div>

            <button
              type="button"
              disabled={loading || cart.length === 0}
              onClick={handleSubmitProcurement}
              className={`px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                cart.length > 0 && supplierName.trim()
                  ? 'bg-brand-primary hover:bg-brand-secondary text-white shadow-brand-primary/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>SAVE PROCUREMENT</span>
            </button>
          </div>
        )}

        {/* CREATE NEW RAW MATERIAL MODAL */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 md:p-8 relative animate-in zoom-in-95 duration-200">
              <button 
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl border border-indigo-100 shrink-0">
                  <Plus size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Create Raw Material "NEW"</h2>
                  <p className="text-xs font-bold text-slate-400">Register new ingredient into catalog & draft cart.</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Raw Material Name *
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. Fresh Tomato"
                    value={newRawItem.name}
                    onChange={(e) => setNewRawItem({ ...newRawItem, name: e.target.value })}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Standard Unit *
                    </label>
                    <select
                      value={newRawItem.unit}
                      onChange={(e) => setNewRawItem({ ...newRawItem, unit: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="kg">kg</option>
                      <option value="gram">g</option>
                      <option value="litre">ltr</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Low Stock Threshold
                    </label>
                    <input 
                      type="number"
                      placeholder="10"
                      value={newRawItem.lowStockThreshold}
                      onChange={(e) => setNewRawItem({ ...newRawItem, lowStockThreshold: e.target.value })}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleCreateRawMaterial}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                >
                  <Save size={16} />
                  <span>Save & Add to Draft</span>
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
