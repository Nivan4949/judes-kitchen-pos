import React, { useState, useEffect } from 'react';
import { ChefHat, Plus, Trash2, Search, AlertTriangle, Save, ClipboardList, TrendingDown } from 'lucide-react';
import api from '../../api/api';

const RecipeManagement = () => {
  const [activeTab, setActiveTab] = useState<'RAW' | 'PROCURE' | 'WASTAGE' | 'RECIPES'>('RAW');
  const [loading, setLoading] = useState(false);

  // States
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // Tab 1: Raw Material Form
  const [showAddRaw, setShowAddRaw] = useState(false);
  const [rawForm, setRawForm] = useState({ id: '', name: '', unit: 'kg', stockQuantity: 0, lowStockThreshold: 0 });

  // Tab 2: Procurement Log
  const [procureInvoice, setProcureInvoice] = useState('');
  const [procureSupplier, setProcureSupplier] = useState('');
  const [procureItems, setProcureItems] = useState<any[]>([{ rawMaterialId: '', quantity: 0, price: 0 }]);
  const [procureHistory, setProcureHistory] = useState<any[]>([]);

  // Tab 3: Wastage Form
  const [wastageId, setWastageId] = useState('');
  const [wastageQty, setWastageQty] = useState('');
  const [wastageReason, setWastageReason] = useState('');
  const [wastageHistory, setWastageHistory] = useState<any[]>([]);

  // Tab 4: Recipe config
  const [selectedProductId, setSelectedProductId] = useState('');
  const [recipeItems, setRecipeItems] = useState<any[]>([{ rawMaterialId: '', quantity: 0 }]);

  useEffect(() => {
    fetchRawMaterials();
    fetchProducts();
    if (activeTab === 'PROCURE') fetchProcureHistory();
    if (activeTab === 'WASTAGE') fetchWastageHistory();
  }, [activeTab]);

  const fetchRawMaterials = async () => {
    try {
      const res = await api.get('/inventory/raw-materials');
      setRawMaterials(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProcureHistory = async () => {
    try {
      const res = await api.get('/inventory/purchases');
      setProcureHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWastageHistory = async () => {
    try {
      const res = await api.get('/inventory/wastage');
      setWastageHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Tab 1 CRUD
  const saveRawMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (rawForm.id) {
        await api.put(`/inventory/raw-materials/${rawForm.id}`, rawForm);
      } else {
        await api.post('/inventory/raw-materials', rawForm);
      }
      setRawForm({ id: '', name: '', unit: 'kg', stockQuantity: 0, lowStockThreshold: 0 });
      setShowAddRaw(false);
      fetchRawMaterials();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save raw material');
    }
  };

  const deleteRawMaterial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this raw material?')) return;
    try {
      await api.delete(`/inventory/raw-materials/${id}`);
      fetchRawMaterials();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete raw material');
    }
  };

  // Tab 2 Procurement Logic
  const handleProcureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = procureItems.filter(i => i.rawMaterialId && i.quantity > 0 && i.price >= 0);
    if (!procureInvoice || validItems.length === 0) {
      alert('Invoice number and valid raw material items are required');
      return;
    }

    const payloadItems = validItems.map(item => {
      const raw = rawMaterials.find(r => r.id === item.rawMaterialId);
      const total = item.quantity * item.price;
      return {
        rawMaterialId: item.rawMaterialId,
        rawMaterialName: raw ? raw.name : 'Unknown',
        quantity: item.quantity,
        price: item.price,
        total
      };
    });

    const totalAmount = payloadItems.reduce((sum, item) => sum + item.total, 0);

    try {
      await api.post('/inventory/purchases', {
        invoiceNo: procureInvoice,
        supplierName: procureSupplier,
        totalAmount,
        items: payloadItems
      });
      setProcureInvoice('');
      setProcureSupplier('');
      setProcureItems([{ rawMaterialId: '', quantity: 0, price: 0 }]);
      fetchRawMaterials();
      fetchProcureHistory();
      alert('Procurement invoice logged successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to log procurement');
    }
  };

  // Tab 3 Wastage Logic
  const handleWastageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(wastageQty);
    if (!wastageId || isNaN(qty) || qty <= 0) {
      alert('Raw material and valid quantity are required');
      return;
    }

    const raw = rawMaterials.find(r => r.id === wastageId);
    try {
      await api.post('/inventory/wastage', {
        rawMaterialId: wastageId,
        rawMaterialName: raw ? raw.name : 'Unknown',
        quantity: qty,
        reason: wastageReason
      });
      setWastageId('');
      setWastageQty('');
      setWastageReason('');
      fetchRawMaterials();
      fetchWastageHistory();
      alert('Wastage logged successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to log wastage');
    }
  };

  // Tab 4 Recipe Config Logic
  useEffect(() => {
    if (selectedProductId) {
      const p = products.find(prod => prod.id === selectedProductId);
      if (p && p.recipe && Array.isArray(p.recipe)) {
        setRecipeItems(p.recipe);
      } else {
        setRecipeItems([{ rawMaterialId: '', quantity: 0 }]);
      }
    }
  }, [selectedProductId]);

  const handleSaveRecipe = async () => {
    if (!selectedProductId) return;
    const validRecipe = recipeItems.filter(i => i.rawMaterialId && i.quantity > 0);
    
    try {
      const p = products.find(prod => prod.id === selectedProductId);
      await api.put(`/products/${selectedProductId}`, {
        ...p,
        recipe: validRecipe
      });
      fetchProducts();
      alert('Recipe mapped successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save recipe mapping');
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-2">Recipe & Raw Materials</h1>
        <p className="text-slate-500 font-medium text-xs md:text-sm">Manage raw stocks, procurement logging, wastage, and product recipes.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 mb-8 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('RAW')}
          className={`pb-4 px-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'RAW' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Raw Materials
        </button>
        <button 
          onClick={() => setActiveTab('PROCURE')}
          className={`pb-4 px-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'PROCURE' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Procurement (Stock-In)
        </button>
        <button 
          onClick={() => setActiveTab('WASTAGE')}
          className={`pb-4 px-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'WASTAGE' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Wastage Records
        </button>
        <button 
          onClick={() => setActiveTab('RECIPES')}
          className={`pb-4 px-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'RECIPES' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
          }`}
        >
          Recipe Mapping
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden min-h-[500px]">
        
        {activeTab === 'RAW' && (
          <div className="p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Ingredients Matrix</h2>
              <button 
                onClick={() => { setRawForm({ id: '', name: '', unit: 'kg', stockQuantity: 0, lowStockThreshold: 0 }); setShowAddRaw(true); }}
                className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider shadow"
              >
                + Create Ingredient
              </button>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-bold">Name</th>
                  <th className="px-6 py-3 font-bold">Standard Unit</th>
                  <th className="px-6 py-3 font-bold">Current Stock</th>
                  <th className="px-6 py-3 font-bold">Threshold Alert</th>
                  <th className="px-6 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rawMaterials.map(raw => {
                  const isLow = raw.stockQuantity <= raw.lowStockThreshold;

                  return (
                    <tr key={raw.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-800">{raw.name}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">{raw.unit}</td>
                      <td className="px-6 py-4 font-bold">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                          isLow ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {raw.stockQuantity.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500">{raw.lowStockThreshold} {raw.unit}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setRawForm(raw); setShowAddRaw(true); }}
                            className="text-slate-400 hover:text-brand-primary p-1"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteRawMaterial(raw.id)}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'PROCURE' && (
          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
            <form onSubmit={handleProcureSubmit} className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 h-max">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-4">Log Procurement Invoice</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <input 
                  required
                  placeholder="Invoice Number *"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                  value={procureInvoice}
                  onChange={e => setProcureInvoice(e.target.value)}
                />
                <input 
                  placeholder="Supplier Registry"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                  value={procureSupplier}
                  onChange={e => setProcureSupplier(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400">Purchased Items</label>
                {procureItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                      value={item.rawMaterialId}
                      onChange={e => {
                        const updated = [...procureItems];
                        updated[index].rawMaterialId = e.target.value;
                        setProcureItems(updated);
                      }}
                    >
                      <option value="">-- Choose Ingredient --</option>
                      {rawMaterials.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      step="0.001"
                      placeholder="Qty"
                      className="w-20 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-center"
                      value={item.quantity === 0 ? '' : item.quantity}
                      onChange={e => {
                        const updated = [...procureItems];
                        updated[index].quantity = parseFloat(e.target.value) || 0;
                        setProcureItems(updated);
                      }}
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      className="w-20 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-center"
                      value={item.price === 0 ? '' : item.price}
                      onChange={e => {
                        const updated = [...procureItems];
                        updated[index].price = parseFloat(e.target.value) || 0;
                        setProcureItems(updated);
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => setProcureItems(procureItems.filter((_, i) => i !== index))}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={() => setProcureItems([...procureItems, { rawMaterialId: '', quantity: 0, price: 0 }])}
                  className="text-brand-primary font-bold text-xs uppercase tracking-wider hover:underline py-1 block"
                >
                  + Add Item Row
                </button>
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow"
              >
                Log Invoice Stock-In
              </button>
            </form>

            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Procurement History</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {procureHistory.map((p, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex justify-between font-bold text-sm">
                      <span className="text-slate-800">Invoice: {p.invoiceNo}</span>
                      <span className="text-brand-primary">₹{p.totalAmount.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      Supplier: {p.supplierName || 'General'} • {new Date(p.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'WASTAGE' && (
          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
            <form onSubmit={handleWastageSubmit} className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 h-max">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-4">Log Food Wastage</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Ingredient</label>
                  <select
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                    value={wastageId}
                    onChange={e => setWastageId(e.target.value)}
                  >
                    <option value="">-- Choose Raw Material --</option>
                    {rawMaterials.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Quantity to Deduct</label>
                  <input 
                    type="number"
                    step="0.001"
                    placeholder="Wastage quantity weight..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                    value={wastageQty}
                    onChange={e => setWastageQty(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Reason / Notes</label>
                  <input 
                    placeholder="e.g. Spilled, Spoiled, Overcooked, Expiry"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                    value={wastageReason}
                    onChange={e => setWastageReason(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow"
              >
                Log Wastage (Deduct stock)
              </button>
            </form>

            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Wastage Logs</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {wastageHistory.map((w, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-slate-800">{w.rawMaterialName}</p>
                      <p className="text-xs text-red-500 font-bold mt-1">Deducted: -{w.quantity} {w.reason ? `(${w.reason})` : ''}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">
                      {new Date(w.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'RECIPES' && (
          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400">Select Menu Item</label>
              <select
                className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
              >
                <option value="">-- Select Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice.toFixed(0)})</option>
                ))}
              </select>

              {selectedProductId && (
                <div className="bg-brand-50/50 p-6 rounded-3xl border border-brand-100/50 flex gap-4 items-start">
                  <ChefHat className="text-brand-primary shrink-0" size={20} />
                  <div className="text-xs text-slate-600 font-medium leading-relaxed">
                    <p className="font-bold mb-1">Recipe Mapping:</p>
                    Map raw material ingredients to this menu item. Selling/serving this product in POS will automatically deduct the specified raw weight proportions.
                  </div>
                </div>
              )}
            </div>

            {selectedProductId && (
              <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-600 mb-2">Recipe Configuration</h3>
                
                <div className="space-y-3">
                  {recipeItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select
                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                        value={item.rawMaterialId}
                        onChange={e => {
                          const updated = [...recipeItems];
                          updated[idx].rawMaterialId = e.target.value;
                          setRecipeItems(updated);
                        }}
                      >
                        <option value="">-- Choose Ingredient --</option>
                        {rawMaterials.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                        ))}
                      </select>
                      <input 
                        type="number"
                        step="0.0001"
                        placeholder="Quantity"
                        className="w-28 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-center"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={e => {
                          const updated = [...recipeItems];
                          updated[idx].quantity = parseFloat(e.target.value) || 0;
                          setRecipeItems(updated);
                        }}
                      />
                      <button 
                        onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={() => setRecipeItems([...recipeItems, { rawMaterialId: '', quantity: 0 }])}
                    className="text-brand-primary font-bold text-xs uppercase tracking-wider hover:underline pt-1 block"
                  >
                    + Add Ingredient Row
                  </button>
                </div>

                <button 
                  onClick={handleSaveRecipe}
                  className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow flex items-center justify-center gap-1.5"
                >
                  <Save size={16} /> Save Recipe Mapping
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Raw Material Add Modal */}
      {showAddRaw && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveRawMaterial} className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-black text-slate-900 mb-6">{rawForm.id ? 'Edit Ingredient' : 'Create Ingredient'}</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Ingredient Name</label>
                <input 
                  required
                  placeholder="e.g. Rice, Chicken, Mozzarella, Milk"
                  className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  value={rawForm.name}
                  onChange={e => setRawForm({...rawForm, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Standard Unit</label>
                  <select
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    value={rawForm.unit}
                    onChange={e => setRawForm({...rawForm, unit: e.target.value})}
                  >
                    <option value="kg">kg</option>
                    <option value="g">gram</option>
                    <option value="ltr">litre</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Low Stock Alert qty</label>
                  <input 
                    required
                    type="number"
                    placeholder="10"
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    value={rawForm.lowStockThreshold}
                    onChange={e => setRawForm({...rawForm, lowStockThreshold: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              {!rawForm.id && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Initial Opening Stock</label>
                  <input 
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                    value={rawForm.stockQuantity}
                    onChange={e => setRawForm({...rawForm, stockQuantity: parseFloat(e.target.value) || 0})}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowAddRaw(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RecipeManagement;
