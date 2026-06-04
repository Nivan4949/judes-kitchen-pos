import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Save, ShoppingBag, ArrowLeft, Calendar, Share2, Check, User, ChevronDown, Trash, Clock, Loader2 } from 'lucide-react';
import api from '../../api/api';
import { Product } from '../../types';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNo, setBillNo] = useState('');
  const [step, setStep] = useState<'main' | 'add-item' | 'finalize'>('main');

  // Payment State (For Finalize Page)
  const [isPaid, setIsPaid] = useState(true);
  const [paidAmount, setPaidAmount] = useState<string>('');

  // Working Item State (For Add Item Page)
  const [workingItem, setWorkingItem] = useState({
    productId: '',
    name: '',
    quantity: '',
    unit: 'Nos',
    price: '',
    discountPercent: 0,
    total: 0
  });
  const [itemSearch, setItemSearch] = useState('');
  const [lastPriceHint, setLastPriceHint] = useState<number | null>(null);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        // Fetch core data sequentially to reduce parallel DB connection pressure (avoids 500s on Vercel)
        const prodRes = await api.get('/products');
        setProducts(prodRes.data);
        
        const supRes = await api.get('/suppliers');
        setSuppliers(supRes.data);

        // Fetch non-critical suggestions silently
        api.get('/products/low-stock')
           .then(res => setLowStockItems(res.data))
           .catch(e => console.warn('Low stock fetch delayed or failed:', e));

        // Handle Header Generation
        const countRes = await api.get('/purchases/count').catch(() => ({ data: { count: 0 } }));
        setBillNo(`PUR-${1001 + (countRes.data.count || 0)}`);

      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitial();
  }, [location.state]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  // Auto-sync supplier ID when typing (if exact match found)
  useEffect(() => {
      const match = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
      if (match) setSelectedSupplierId(match.id);
  }, [supplierName, suppliers]);

  // Fetch supplier balance for intelligence
  useEffect(() => {
    if (selectedSupplierId) {
       api.get(`/suppliers/${selectedSupplierId}/ledger`)
          .then(res => setSupplierBalance(res.data.summary.currentBalance))
          .catch(() => setSupplierBalance(null));
    } else {
       setSupplierBalance(null);
    }
  }, [selectedSupplierId]);

  const handleSelectItem = async (p: Product) => {
    setWorkingItem({
      ...workingItem,
      productId: p.id,
      name: p.name,
      unit: p.unit || 'Nos',
      price: p.purchasePrice.toString()
    });
    setItemSearch(p.name);
    // Don't close suggestions, but focus quantity
    setTimeout(() => {
        const qtyInput = document.querySelector('input[type="number"]');
        if (qtyInput instanceof HTMLInputElement) qtyInput.focus();
    }, 100);
    
    // Fetch last price for intelligence
    try {
        const res = await api.get(`/products/last-purchase-price/${p.id}`);
        if(res.data.price > 0) setLastPriceHint(res.data.price);
        else setLastPriceHint(null);
    } catch(e) {
        setLastPriceHint(null);
    }
  };

  const addToCartInternal = (shouldReset: boolean) => {
    if (!workingItem.productId || !workingItem.quantity) return alert('Please select item and enter quantity');
    
    const qty = parseFloat(workingItem.quantity);
    const prc = parseFloat(workingItem.price);
    const newItem = { ...workingItem, quantity: qty, price: prc, total: qty * prc };

    setCart([...cart, newItem]);

    if (shouldReset) {
      setWorkingItem({ productId: '', name: '', quantity: '', unit: 'Nos', price: '', discountPercent: 0, total: 0 });
      setItemSearch('');
      setLastPriceHint(null);
    } else {
      setStep('main');
    }
  };

  const quickAdd = (p: Product) => {
      if (!supplierName.trim()) return alert('Please enter Vendor / Sourcing Partner before adding items.');
      const newItem = {
          productId: p.id,
          name: p.name,
          quantity: 10, // Default batch
          unit: p.unit || 'Nos',
          price: p.purchasePrice,
          discountPercent: 0,
          total: 10 * p.purchasePrice
      };
      setCart([...cart, newItem]);
  };

  const handleSubmitFinal = async (shouldReset: boolean = true) => {
    if (!supplierName) return alert('Please enter Party Name');
    if (cart.length === 0) return alert('No items added');

    setLoading(true);
    try {
      const finalPaid = isPaid ? (parseFloat(paidAmount) || totalAmount) : 0;
      
      // CREATE DIRECT BILL (ALWAYS)
      const purchaseData = {
        supplierId: selectedSupplierId || null,
        supplierName,
        purchaseItems: cart,
        subtotal: totalAmount,
        totalDiscount: 0,
        taxTotal: 0,
        grandTotal: totalAmount,
        amountPaid: finalPaid,
        balanceDue: totalAmount - finalPaid,
        paymentStatus: finalPaid === totalAmount ? 'PAID' : finalPaid > 0 ? 'PARTIAL' : 'PENDING',
        paymentMode: 'CASH',
        date: purchaseDate
      };

      await api.post('/purchases', purchaseData);
      alert('Stock Updated Successfully!');
      
      if (shouldReset) {
        setCart([]);
        setSupplierName('');
        setSelectedSupplierId('');
        setStep('main');
        navigate('/inventory'); // Navigate back after success
      } else {
        navigate('/inventory');
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------------
  // MAIN VIEW (Step 1)
  // --------------------------------------------------------------------------------
  if (step === 'main') {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-slate-50 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500"><ArrowLeft size={22} /></button>
            <h1 className="text-[17px] font-black tracking-tight text-slate-800">Stock Procurement</h1>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Billing Date</span>
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="bg-transparent border-none p-0 focus:ring-0 text-xs font-black cursor-pointer text-brand-600" />
                <ChevronDown size={12} className="text-brand-600" />
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6 max-w-xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Entry Reference</span>
                    <div className="flex items-center gap-2 text-brand-600 font-black text-sm">{billNo || '---'}</div>
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
              <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-500 transition-colors">Vendor / Sourcing Partner *</label>
              <div className="w-full p-4 border-2 border-slate-100 rounded-2xl flex items-center bg-white group-focus-within:border-brand-500 group-focus-within:shadow-lg shadow-brand-500/5 transition-all">
                <input 
                  type="text" placeholder="Start typing supplier name..." value={supplierName} autoComplete="off"
                  onChange={(e) => { setSupplierName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-700 placeholder:text-slate-200"
                />
              </div>
              {showSuggestions && (
                <div className="absolute z-[60] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierName.toLowerCase())).map((s, idx) => (
                        <button key={idx} onClick={() => { setSupplierName(s.name); setSelectedSupplierId(s.id); setShowSuggestions(false); }} className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors">
                            <div>
                                <div className="font-black text-slate-800">{s.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">{s.phone || 'No Contact'}</div>
                            </div>
                            <User size={16} className="text-slate-200" />
                        </button>
                    ))}
                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierName.toLowerCase())).length === 0 && (
                        <div className="p-6 text-center">
                            <p className="text-slate-400 font-bold text-xs italic">No partners found matching search.</p>
                        </div>
                    )}
                </div>
              )}
           </div>



           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <button 
                 onClick={() => {
                     if (!supplierName.trim()) return alert('Please enter Vendor / Sourcing Partner before adding items.');
                     setStep('add-item');
                 }}
                 className="bg-slate-900 border-b-8 border-slate-950 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-white font-black text-sm hover:scale-[1.02] transition-all active:scale-[0.98] shadow-2xl shadow-slate-900/20"
               >
                  <Plus size={32} strokeWidth={3} className="text-brand-400" />
                  <span className="uppercase tracking-[0.2em]">{cart.length > 0 ? 'Add More Items' : 'Start Adding Items'}</span>
               </button>

               {lowStockItems.length > 0 && (
                   <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[2rem] flex flex-col gap-4">
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Clock size={14} /> Critical Low Stock
                       </h3>
                       <div className="flex flex-wrap gap-2">
                           {lowStockItems.slice(0, 4).map(item => (
                               <button 
                                   key={item.id}
                                   onClick={() => {
                                       setSupplierName(supplierName || 'General Sourcing');
                                       quickAdd(item);
                                   }}
                                   className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-[10px] font-black text-slate-600 hover:border-brand-500 hover:text-brand-600 transition-all flex items-center gap-2 shadow-sm"
                               >
                                   <Plus size={12} /> {item.name}
                               </button>
                           ))}
                       </div>
                   </div>
               )}
           </div>

           {cart.length > 0 && (
             <div className="pt-4 animate-in fade-in slide-in-from-bottom-4">
               <button 
                 onClick={() => setStep('finalize')}
                 className="w-full bg-brand-600 text-white p-5 rounded-2xl font-black text-sm shadow-xl shadow-brand-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-b-4 border-brand-700"
               >
                  Generate Procure Note <Check size={18} strokeWidth={4} />
               </button>
               <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                   <div className="h-1 w-8 bg-slate-100"></div>
                   {cart.length} items staged in draft
                   <div className="h-1 w-8 bg-slate-100"></div>
                </p>
             </div>
           )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // ADD ITEM VIEW (Step 2)
  // --------------------------------------------------------------------------------
  if (step === 'add-item') {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white px-4 py-4 flex items-center gap-4 border-b border-slate-50 sticky top-0 z-50">
          <button onClick={() => setStep('main')} className="p-2 -ml-2 text-slate-500"><ArrowLeft size={22} /></button>
          <h1 className="text-[17px] font-black tracking-tight text-slate-800">Catalogue Lookup</h1>
        </div>

        <div className="p-4 space-y-2 max-w-xl mx-auto">
            <div className="relative mb-6">
              <CustomInput label="Item / Product Search" value={itemSearch} onChange={(e: any) => setItemSearch(e.target.value)} placeholder="Type product name or scan..." icon={<Search size={18} />} />
              {itemSearch && products.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()) && p.name !== workingItem.name).length > 0 && (
                <div className="absolute top-16 left-0 right-0 z-50 bg-white shadow-2xl rounded-2xl border border-slate-100 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                   {products.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()) && p.name !== workingItem.name).map(p => (
                     <button key={p.id} onClick={() => handleSelectItem(p)} className="w-full p-4 text-left hover:bg-slate-50 font-black text-slate-700 border-b border-slate-50 last:border-0 flex items-center justify-between group">
                         <span>{p.name}</span>
                         <span className="text-[10px] font-black text-slate-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                     </button>
                   ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <CustomInput label="Procure Qty" type="number" value={workingItem.quantity} onChange={(e: any) => setWorkingItem({...workingItem, quantity: e.target.value})} placeholder="0" />
               <div className="relative group mb-6">
                  <label className="absolute -top-2.5 left-3 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Packing Unit</label>
                  <div className="flex items-center gap-3 w-full p-3 border-2 border-slate-100 rounded-xl bg-white group-focus-within:border-brand-500 transition-all">
                    <select 
                      value={workingItem.unit} 
                      onChange={(e) => setWorkingItem({...workingItem, unit: e.target.value})}
                      className="w-full bg-transparent border-none focus:ring-0 text-slate-800 font-bold p-0 text-[15px] appearance-none cursor-pointer"
                    >
                      {['Nos', 'Kg', 'Ltr', 'Pcs', 'Box', 'Pkt', 'Gm', 'Ml'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown size={14} className="text-slate-400 ml-auto pointer-events-none" />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
                <CustomInput label="Purchase Rate (₹)" type="number" value={workingItem.price} onChange={(e: any) => setWorkingItem({...workingItem, price: e.target.value})} placeholder="0.0" />
                {lastPriceHint !== null && (
                    <div className="px-1 -mt-4 animate-in slide-in-from-left-2 duration-300">
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Price Intel: Last bought at ₹{lastPriceHint.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-8 space-y-4 px-1">
               <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Entry Appraisal</h3>
               <div className="bg-slate-50 p-6 rounded-[2.5rem] flex justify-between items-center border border-slate-100">
                  <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">Net Payable</span>
                  <div className="text-right">
                      <div className="text-[10px] font-black text-slate-300 uppercase leading-none mb-1">Row Total</div>
                      <div className="flex items-center gap-2 text-slate-900 font-black"><span className="text-xs text-slate-400">₹</span><span className="text-3xl">{(parseFloat(workingItem.quantity || '0') * parseFloat(workingItem.price || '0')).toLocaleString('en-IN')}</span></div>
                  </div>
               </div>
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-50">
           <div className="max-w-xl mx-auto flex gap-4 h-14">
              <button 
                onClick={() => addToCartInternal(true)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl active:scale-95 transition-all"
              >Save & New</button>
              <button 
                onClick={() => addToCartInternal(false)} 
                className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white font-black rounded-2xl shadow-xl shadow-brand-500/10 active:scale-95 transition-all border-b-4 border-brand-800"
              >Proceed</button>
           </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // FINALIZE VIEW (Step 3)
  // --------------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white pb-40">
        <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-slate-50 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('main')} className="p-2 -ml-2 text-slate-500"><ArrowLeft size={22} /></button>
            <h1 className="text-[17px] font-black tracking-tight text-slate-800">Confirm Final Invoice</h1>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{purchaseDate}</p>
        </div>

        <div className="p-4 space-y-6 max-w-xl mx-auto">
           <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl shadow-slate-900/10 text-white relative overflow-hidden">
               <div className="relative z-10">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Primary Sourcing Partner</span>
                  <p className="text-2xl font-black leading-tight mb-4">{supplierName || 'Manual Entry Vendor'}</p>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                      <div className="flex items-center gap-1.5"><Calendar size={14}/> {purchaseDate}</div>
                      <div className="flex items-center gap-1.5"><Check size={14} className="text-emerald-400"/> Status: Active</div>
                  </div>
               </div>
               <div className="absolute top-0 right-0 p-8 opacity-10">
                   <User size={120} />
               </div>
           </div>

           <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Breakdown</h4>
              <span className="bg-brand-50 text-brand-600 text-[10px] font-black px-3 py-1 rounded-full">{cart.length} LINE ITEMS</span>
           </div>

           <div className="space-y-4">
              {cart.map((item, idx) => (
                <div key={idx} className="bg-white p-5 rounded-3xl border-2 border-slate-50 shadow-sm relative group hover:border-brand-100 transition-all">
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs">#{idx + 1}</div>
                          <div>
                              <h4 className="font-black text-slate-800 text-[16px]">{item.name}</h4>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{item.quantity} {item.unit} x ₹{item.price.toLocaleString('en-IN')}</p>
                          </div>
                       </div>
                       <p className="font-black text-slate-900 text-xl leading-none pt-2">₹{item.total.toLocaleString('en-IN')}</p>
                    </div>
                    
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="absolute top-4 right-4 w-10 h-10 bg-red-50 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white"><Trash size={18} /></button>
                </div>
              ))}
           </div>

           <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Quantity</span>
                    <span className="text-xl font-black text-slate-800">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bill Summary</span>
                    <span className="text-xl font-black text-slate-800">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
           </div>

           {/* PAYMENT SECTION - PREMIUM REDESIGN */}
           <div className="bg-brand-50 p-8 rounded-[3rem] border-2 border-brand-100 relative overflow-hidden">
               <div className="relative z-10 space-y-6">
                    <header className="flex justify-between items-center pb-4 border-b border-brand-100/50">
                        <span className="text-[11px] font-black text-brand-400 uppercase tracking-[0.2em]">Settlement Detail</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-brand-900 uppercase">Grand Total</span>
                           <span className="bg-brand-600 text-white px-3 py-1 rounded-full text-xs font-black">₹{totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                    </header>

                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <button onClick={() => setIsPaid(!isPaid)} className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all ${isPaid ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-600/30' : 'bg-white border-brand-200'}`}><Check size={20} strokeWidth={4} /></button>
                            <span className="font-black text-brand-900 text-lg">Mark as Paid</span>
                         </div>
                         {isPaid && (
                             <div className="text-right">
                                <label className="text-[10px] font-black text-brand-400 uppercase block mb-1">Amount Paid</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-brand-400 font-bold">₹</span>
                                    <input type="number" placeholder={totalAmount.toString()} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="bg-white border-2 border-brand-100 rounded-xl px-4 py-2 w-32 text-right focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all font-black text-lg text-brand-900 placeholder:text-brand-200" />
                                </div>
                             </div>
                         )}
                    </div>

                    {!isPaid && (
                        <div className="bg-red-50 p-4 rounded-2xl flex items-center gap-3 border border-red-100">
                            <Clock size={18} className="text-red-400"/>
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Outstanding balance will be added to vendor account.</p>
                        </div>
                    )}
               </div>
           </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur-xl border-t border-slate-100 z-[100] shadow-2xl">
           <div className="max-w-xl mx-auto flex gap-4 h-16">
              <button 
                 onClick={() => handleSubmitFinal(false)} disabled={loading}
                 className="flex-1 bg-slate-900 text-white font-black rounded-[2rem] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all text-sm uppercase tracking-[0.2em] border-b-8 border-slate-950 flex items-center justify-center gap-3"
              >
                  {loading && <Loader2 className="animate-spin" size={20}/>}
                  {loading ? 'Filing Entry...' : 'Commit Purchase'}
              </button>
           </div>
        </div>
    </div>
  );
};

export default StockEntry;
