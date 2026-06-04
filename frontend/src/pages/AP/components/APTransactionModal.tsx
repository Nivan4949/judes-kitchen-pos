import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Trash2, Save, ShoppingBag, ArrowLeft, Calendar, User, ChevronDown, Check, Loader2, CreditCard, Banknote, ArrowDownLeft } from 'lucide-react';
import api from '../../../api/api';
import NumericKeypad from '../../../components/NumericKeypad';

interface Supplier {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    purchasePrice: number;
    unit: string;
}

interface CartItem {
    id: string;
    name: string;
    qty: number;
    rate: number;
    unit: string;
    total: number;
}

const APTransactionModal = ({ isOpen, onClose, onFinish, initialMode = 'PURCHASE' }: { isOpen: boolean, onClose: () => void, onFinish: () => void, initialMode?: string }) => {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState('MAIN'); // MAIN, ADD_ITEM, KEYPAD
  const [loading, setLoading] = useState(false);
  
  // Master Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Transaction State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierInput, setSupplierInput] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Payment Mode State (For Settlement)
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Keypad State
  const [activeField, setActiveField] = useState<{ type: 'QTY' | 'RATE' | 'PAYMENT' } | null>(null);

  // Item Buffer (for Step 2)
  const [workingItem, setWorkingItem] = useState({ id: '', name: '', qty: '', rate: '', unit: '', total: 0 });
  const [itemSearch, setItemSearch] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (suppliers.length === 0) fetchMasters();
      setMode(initialMode);
      resetForm();
    }
  }, [isOpen, initialMode]);

  const fetchMasters = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products')
      ]);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
    } catch (e) { console.error(e); }
  };

  const resetForm = () => {
    setSelectedSupplier(null);
    setSupplierInput('');
    setCart([]);
    setPaymentAmount('');
    setStep('MAIN');
  };

  const handleSave = async () => {
    if (!selectedSupplier) return alert('Please select a supplier');
    
    setLoading(true);
    try {
        if (mode === 'PURCHASE') {
            if (cart.length === 0) return alert('Cart is empty');
            const total = cart.reduce((sum, i) => sum + i.total, 0);
            await api.post('/ap/purchase', {
                supplierId: selectedSupplier.id,
                supplierName: selectedSupplier.name,
                items: cart.map(i => ({ productId: i.id, quantity: i.qty, price: i.rate })),
                grandTotal: total,
                subtotal: total,
                date
            });
        } else {
            if (!paymentAmount || parseFloat(paymentAmount) <= 0) return alert('Enter valid amount');
            await api.post('/ap/payment-out', {
                supplierId: selectedSupplier.id,
                amount: parseFloat(paymentAmount),
                method: paymentMethod,
                date
            });
        }
        onFinish();
        onClose();
    } catch (e: any) {
        alert(e.response?.data?.error || 'Transaction failed');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-white rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
         
         {/* 🎨 Modal Header */}
         <header className="p-8 pb-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl ${mode === 'PURCHASE' ? 'bg-slate-900 shadow-slate-900/20' : 'bg-red-500 shadow-red-500/20'}`}>
                    {mode === 'PURCHASE' ? <ShoppingBag size={24} /> : <Banknote size={24} />}
                </div>
                <div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tight">{mode === 'PURCHASE' ? 'Procure Inventory' : 'Vendor Settlement'}</h2>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounts Payable Engine v1.0</p>
                </div>
            </div>
            <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"><X size={24} /></button>
         </header>

         <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
            
            {/* 📍 Step 1: Supplier & Mode */}
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 bg-slate-50 p-2 rounded-2xl flex gap-1">
                        {['PURCHASE', 'PAYMENT_OUT'].map(m => (
                            <button 
                                key={m}
                                onClick={() => setMode(m)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {m.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-2">
                        <Calendar size={18} className="text-slate-400" />
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black text-slate-700 focus:ring-0 cursor-pointer" />
                    </div>
                </div>

                <div className="relative group">
                    <label className="absolute -top-2.5 left-4 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Select Party *</label>
                    <div className="w-full p-5 border-2 border-slate-100 rounded-[2rem] flex items-center bg-white group-focus-within:border-brand-500 transition-all">
                        <Search size={20} className="text-slate-300 mr-4" />
                        <input 
                            type="text" placeholder="Vendor name..." value={supplierInput} 
                            onChange={(e) => { setSupplierInput(e.target.value); setShowSupplierSuggestions(true); }}
                            onFocus={() => setShowSupplierSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-700" 
                        />
                        {selectedSupplier && <Check size={20} className="text-emerald-500" />}
                    </div>
                    {showSupplierSuggestions && supplierInput && (!selectedSupplier || supplierInput !== selectedSupplier.name) && (
                        <div className="absolute z-50 w-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto">
                            {suppliers.filter(s => s.name.toLowerCase().includes(supplierInput.toLowerCase())).map(s => (
                                <button key={s.id} onClick={() => { setSelectedSupplier(s); setSupplierInput(s.name); setShowSupplierSuggestions(false); }} className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 font-black text-slate-700">{s.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 📦 Purchase Content */}
            {mode === 'PURCHASE' ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Items</h4>
                        {cart.length > 0 && <span className="text-xs font-black text-brand-600 bg-brand-50 px-3 py-1 rounded-full">{cart.length} STAGED</span>}
                    </div>
                    
                    <div className="space-y-3">
                        {cart.map((item, idx) => (
                           <div key={idx} className="bg-slate-50 p-5 rounded-3xl flex items-center justify-between group">
                               <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-xs text-slate-400">#{idx+1}</div>
                                   <div>
                                       <p className="font-black text-slate-800 text-sm">{item.name}</p>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.qty} {item.unit} x ₹{item.rate}</p>
                                   </div>
                               </div>
                               <div className="flex items-center gap-6">
                                   <p className="font-black text-slate-900">₹{item.total.toLocaleString()}</p>
                                   <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                               </div>
                           </div>
                        ))}
                        <button 
                            onClick={() => setStep('ADD_ITEM')}
                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-bold text-sm uppercase tracking-widest hover:border-brand-300 hover:text-brand-500 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Add Catalog Item
                        </button>
                    </div>

                    {cart.length > 0 && (
                        <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex justify-between items-center shadow-xl shadow-slate-900/10">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Net Sourcing Cost</p>
                                <p className="text-3xl font-black">₹{cart.reduce((s, i) => s + i.total, 0).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Liability</p>
                                <p className="text-sm font-bold text-emerald-400 uppercase">Credit Purchase</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* 💸 Settlement Content */
                <div className="space-y-8 py-4">
                    <div className="bg-red-50 p-8 rounded-[3rem] border border-red-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white text-red-500 rounded-[2rem] flex items-center justify-center mb-4 shadow-sm">
                            <CreditCard size={32} />
                        </div>
                        <p className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-1">Debt Liquidation</p>
                        <p className="text-3xl font-black text-red-600">₹{paymentAmount || '0.00'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="relative" onClick={() => { setActiveField({ type: 'PAYMENT' }); setStep('KEYPAD'); }}>
                            <label className="absolute -top-2.5 left-4 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Amount to Settle</label>
                            <div className="w-full p-5 border-2 border-slate-100 rounded-[2rem] bg-slate-50/50 flex items-center justify-center font-black text-2xl text-slate-800 active:scale-95 transition-all cursor-pointer">
                                ₹{paymentAmount || '0.00'}
                            </div>
                        </div>
                        <div className="relative">
                            <label className="absolute -top-2.5 left-4 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Payment Mode</label>
                            <div className="w-full p-5 border-2 border-slate-100 rounded-[2rem] flex items-center bg-white group-focus-within:border-brand-500 transition-all">
                                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-0 font-black text-slate-800 appearance-none cursor-pointer">
                                    <option value="CASH">CASH</option>
                                    <option value="BANK">BANK / UPI</option>
                                </select>
                                <ChevronDown size={14} className="text-slate-400 ml-auto" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
         </div>

         {/* 🎯 Sticky Footer */}
         <footer className="p-8 pt-4 border-t border-slate-50 bg-white">
            <button 
                onClick={handleSave}
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Confirm & Record Entry
            </button>
         </footer>

         {/* 📱 Sub-Views Overlay (Slide in from right) */}
         {step === 'ADD_ITEM' && (
             <div className="absolute inset-0 bg-white z-[120] animate-in slide-in-from-right duration-300 flex flex-col p-8">
                 <header className="flex items-center gap-4 mb-10">
                    <button onClick={() => setStep('MAIN')} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><ArrowLeft size={24}/></button>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Catalogue Lookup</h2>
                 </header>
                 
                 <div className="space-y-8 flex-1">
                    <div className="relative">
                        <label className="absolute -top-2.5 left-4 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Item Identification</label>
                        <div className="w-full p-5 border-2 border-slate-100 rounded-[2rem] flex items-center bg-white group-focus-within:border-brand-500 transition-all">
                            <Search size={20} className="text-slate-300 mr-4" />
                            <input 
                                type="text" placeholder="Search product or scan..." value={itemSearch} 
                                onChange={(e) => { setItemSearch(e.target.value); setShowProductSuggestions(true); }}
                                onFocus={() => setShowProductSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-700" 
                            />
                        </div>
                        {showProductSuggestions && itemSearch && itemSearch !== workingItem.name && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto">
                                {products.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).map(p => (
                                    <button key={p.id} onClick={() => { setWorkingItem({ ...workingItem, id: p.id, name: p.name, rate: p.purchasePrice.toString(), unit: p.unit }); setItemSearch(p.name); setShowProductSuggestions(false); }} className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 font-black text-slate-700">{p.name}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="relative" onClick={() => { setActiveField({ type: 'QTY' }); setStep('KEYPAD'); }}>
                            <label className="absolute -top-2.5 left-4 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Quantity</label>
                            <div className="w-full p-5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-center font-black text-xl text-slate-800">{workingItem.qty || '0'}</div>
                        </div>
                        <div className="relative" onClick={() => { setActiveField({ type: 'RATE' }); setStep('KEYPAD'); }}>
                            <label className="absolute -top-2.5 left-4 px-1 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider z-10">Purchase Rate</label>
                            <div className="w-full p-5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-center font-black text-xl text-slate-800">₹{workingItem.rate || '0.00'}</div>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Item Appraisal</p>
                            <p className="text-4xl font-black">₹{(parseFloat(workingItem.qty || '0') * parseFloat(workingItem.rate || '0')).toLocaleString()}</p>
                        </div>
                    </div>
                 </div>

                 <button 
                    onClick={() => { 
                        if (!workingItem.id || !workingItem.qty) return;
                        setCart([...cart, { ...workingItem, qty: parseFloat(workingItem.qty), rate: parseFloat(workingItem.rate), total: parseFloat(workingItem.qty) * parseFloat(workingItem.rate) }]); 
                        setStep('MAIN'); 
                        setWorkingItem({ id: '', name: '', qty: '', rate: '', unit: '', total: 0 }); 
                        setItemSearch(''); 
                    }}
                    disabled={!workingItem.id || !workingItem.qty || parseFloat(workingItem.qty) <= 0}
                    className="w-full py-5 bg-brand-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-brand-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale"
                 >
                    <Plus size={18} /> Add to Transaction
                 </button>
             </div>
         )}

         {step === 'KEYPAD' && (
             <div className="absolute inset-0 bg-slate-900/95 z-[150] animate-in fade-in duration-200 flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-sm">
                    <header className="flex items-center justify-between mb-10">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Numeric Terminal</span>
                            <h3 className="text-white text-2xl font-black uppercase tracking-widest">{activeField?.type} INPUT</h3>
                        </div>
                        <button onClick={() => setStep(activeField?.type === 'PAYMENT' ? 'MAIN' : 'ADD_ITEM')} className="p-4 bg-white/5 text-white/50 rounded-2xl transition-all hover:text-white"><X size={24} /></button>
                    </header>

                    <div className="bg-white/5 p-8 rounded-[3rem] mb-8 border border-white/10 flex items-center justify-center">
                        <span className="text-white text-5xl font-black">
                            {activeField?.type === 'QTY' ? (workingItem.qty || '0') : 
                             activeField?.type === 'RATE' ? `₹${workingItem.rate || '0.00'}` : 
                             `₹${paymentAmount || '0.00'}`}
                        </span>
                    </div>

                    <NumericKeypad 
                        onInput={(v) => { 
                            if (activeField?.type === 'QTY') setWorkingItem({ ...workingItem, qty: workingItem.qty + v });
                            else if (activeField?.type === 'RATE') setWorkingItem({ ...workingItem, rate: workingItem.rate + v });
                            else setPaymentAmount(paymentAmount + v);
                        }}
                        onDelete={() => {
                            if (activeField?.type === 'QTY') setWorkingItem({ ...workingItem, qty: workingItem.qty.slice(0, -1) });
                            else if (activeField?.type === 'RATE') setWorkingItem({ ...workingItem, rate: workingItem.rate.slice(0, -1) });
                            else setPaymentAmount(paymentAmount.slice(0, -1));
                        }}
                        onClear={() => {
                            if (activeField?.type === 'QTY') setWorkingItem({ ...workingItem, qty: '' });
                            else if (activeField?.type === 'RATE') setWorkingItem({ ...workingItem, rate: '' });
                            else setPaymentAmount('');
                        }}
                        onConfirm={() => setStep(activeField?.type === 'PAYMENT' ? 'MAIN' : 'ADD_ITEM')}
                    />
                </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default APTransactionModal;
