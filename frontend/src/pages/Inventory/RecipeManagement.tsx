import React, { useState, useEffect } from 'react';
import { 
  ChefHat, Plus, Trash2, Search, AlertTriangle, Save, ClipboardList, TrendingDown, 
  FileText, Paperclip, Eye, Download, X, Check, RefreshCw, Filter, Calendar, 
  Building, DollarSign, ArrowRight, ExternalLink, Receipt, Upload, PackageCheck, Ban
} from 'lucide-react';
import api from '../../api/api';

const RecipeManagement = () => {
  const [activeTab, setActiveTab] = useState<'RAW' | 'PROCURE' | 'WASTAGE' | 'RECIPES'>('RAW');
  const [loading, setLoading] = useState(false);

  // States
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Tab 1: Raw Material Form (Create Ingredient)
  const [showAddRaw, setShowAddRaw] = useState(false);
  const [rawForm, setRawForm] = useState({ id: '', name: '', unit: 'kg', stockQuantity: 0, lowStockThreshold: 0 });

  // Tab 2: Procurement & Multi-Product Purchase
  const [procureHistory, setProcureHistory] = useState<any[]>([]);
  const [showRecordPurchase, setShowRecordPurchase] = useState(false);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any | null>(null);
  const [viewAttachmentModal, setViewAttachmentModal] = useState<{ url: string; name: string; type: string } | null>(null);

  // Purchase History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historySupplierFilter, setHistorySupplierFilter] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  // Multi-Product Purchase Form State
  const initialPurchaseForm = {
    invoiceNo: '',
    supplierId: '',
    supplierName: '',
    supplierGstin: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'CASH',
    paymentStatus: 'PAID',
    discount: 0,
    attachmentUrl: '',
    attachmentName: '',
    attachmentType: '',
    notes: '',
    items: [
      {
        rawMaterialId: '',
        rawMaterialName: '',
        isNewIngredient: false,
        unit: 'kg',
        quantity: 1,
        price: 0,
        taxPercent: 0
      }
    ]
  };
  const [purchaseForm, setPurchaseForm] = useState(initialPurchaseForm);

  // Tab 3: Wastage Form
  const [wastageId, setWastageId] = useState('');
  const [wastageQty, setWastageQty] = useState('');
  const [wastageReason, setWastageReason] = useState('');
  const [wastageHistory, setWastageHistory] = useState<any[]>([]);

  // Tab 4: Recipe config
  const [selectedProductId, setSelectedProductId] = useState('');
  const [recipeItems, setRecipeItems] = useState<any[]>([{ rawMaterialId: '', quantity: 0, unit: 'kg' }]);

  useEffect(() => {
    fetchRawMaterials();
    fetchProducts();
    fetchSuppliers();
    if (activeTab === 'PROCURE') {
      fetchProcureHistory();
    }
    if (activeTab === 'WASTAGE') fetchWastageHistory();
  }, [activeTab]);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  const fetchNextInvoice = async () => {
    try {
      const res = await api.get('/inventory/purchases/next-invoice');
      if (res.data?.invoiceNo) {
        setPurchaseForm(prev => ({ ...prev, invoiceNo: res.data.invoiceNo }));
      }
    } catch (err) {
      console.error('Failed to fetch next invoice:', err);
    }
  };

  const fetchRawMaterials = async () => {
    try {
      const res = await api.get('/inventory/raw-materials');
      setRawMaterials(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProcureHistory = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (historySearch) params.search = historySearch;
      if (historySupplierFilter) params.supplier = historySupplierFilter;
      if (historyStartDate) params.startDate = historyStartDate;
      if (historyEndDate) params.endDate = historyEndDate;
      if (historyStatusFilter && historyStatusFilter !== 'ALL') params.status = historyStatusFilter;

      const res = await api.get('/inventory/purchases', { params });
      setProcureHistory(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWastageHistory = async () => {
    try {
      const res = await api.get('/inventory/wastage');
      setWastageHistory(res.data || []);
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
    if (!confirm('Remove this ingredient from the active matrix? Its purchase and wastage history will be kept.')) return;
    try {
      await api.delete(`/inventory/raw-materials/${id}`);
      setRawMaterials(current => current.filter(raw => raw.id !== id));
      await fetchProducts();
      alert('Ingredient removed from the active matrix successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete raw material');
    }
  };

  // --- Dynamic Purchase Calculation ---
  const calculatePurchaseTotals = () => {
    let subtotal = 0;

    purchaseForm.items.forEach(item => {
      const qty = parseFloat(item.quantity as any) || 0;
      const rate = parseFloat(item.price as any) || 0;
      subtotal += qty * rate;
    });

    const discount = parseFloat(purchaseForm.discount as any) || 0;
    const grandTotal = Math.max(0, subtotal - discount);

    return {
      subtotal,
      totalTax: 0,
      cgst: 0,
      sgst: 0,
      discount,
      grandTotal
    };
  };

  // File Upload Handler (PDF, JPG, JPEG, PNG - Max 10MB)
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      alert('Invalid file format. Please upload a PDF, JPG, JPEG, or PNG tax invoice.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit. Please upload a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPurchaseForm(prev => ({
        ...prev,
        attachmentUrl: reader.result as string,
        attachmentName: file.name,
        attachmentType: file.type
      }));
    };
    reader.readAsDataURL(file);
  };

  // Handle supplier change in purchase form
  const handleSupplierSelect = (supplierIdOrName: string) => {
    const existing = suppliers.find(s => s.id === supplierIdOrName || s.name.toLowerCase() === supplierIdOrName.toLowerCase());
    if (existing) {
      setPurchaseForm(prev => ({
        ...prev,
        supplierId: existing.id,
        supplierName: existing.name,
        supplierGstin: existing.gstNo || prev.supplierGstin
      }));
    } else {
      setPurchaseForm(prev => ({
        ...prev,
        supplierId: '',
        supplierName: supplierIdOrName
      }));
    }
  };

  // Save Purchase Form
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseSubmitting) return;

    const validItems = purchaseForm.items.filter(i => {
      const hasName = i.rawMaterialId || (i.rawMaterialName && i.rawMaterialName.trim().length > 0);
      const qty = parseFloat(i.quantity as any) || 0;
      const rate = parseFloat(i.price as any) || 0;
      return hasName && qty > 0 && rate >= 0;
    });

    if (validItems.length === 0) {
      alert('Please add at least one valid product with quantity and rate.');
      return;
    }

    setPurchaseSubmitting(true);
    const totals = calculatePurchaseTotals();

    const payload = {
      invoiceNo: purchaseForm.invoiceNo.trim(),
      supplierId: purchaseForm.supplierId || undefined,
      supplierName: purchaseForm.supplierName.trim() || 'General Vendor',
      supplierGstin: purchaseForm.supplierGstin.trim() || undefined,
      date: purchaseForm.date ? new Date(purchaseForm.date).toISOString() : new Date().toISOString(),
      subtotal: totals.subtotal,
      taxTotal: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      discount: totals.discount,
      totalAmount: totals.grandTotal,
      paymentMode: purchaseForm.paymentMode,
      paymentStatus: purchaseForm.paymentStatus,
      attachmentUrl: purchaseForm.attachmentUrl || undefined,
      attachmentName: purchaseForm.attachmentName || undefined,
      attachmentType: purchaseForm.attachmentType || undefined,
      notes: purchaseForm.notes.trim() || undefined,
      items: validItems.map(item => {
        const qty = parseFloat(item.quantity as any) || 0;
        const rate = parseFloat(item.price as any) || 0;
        const lineSubtotal = qty * rate;
        const rawMat = rawMaterials.find(r => r.id === item.rawMaterialId);

        return {
          rawMaterialId: item.rawMaterialId || undefined,
          rawMaterialName: rawMat ? rawMat.name : (item.rawMaterialName || '').trim(),
          unit: item.unit || rawMat?.unit || 'kg',
          quantity: qty,
          price: rate,
          subtotal: lineSubtotal,
          taxPercent: 0,
          taxAmount: 0,
          total: lineSubtotal
        };
      })
    };

    try {
      const res = await api.post('/inventory/purchases', payload);
      alert(`Purchase invoice ${res.data.invoiceNo} saved & raw material stock updated successfully!`);
      setShowRecordPurchase(false);
      setPurchaseForm(initialPurchaseForm);
      fetchRawMaterials();
      fetchProcureHistory();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert(err.response?.data?.error || 'Invoice number already in use. Please enter a different invoice number.');
      } else {
        alert(err.response?.data?.error || 'Failed to save purchase');
      }
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  // Safe cancellation / reversal
  const handleCancelPurchase = async (purchaseId: string) => {
    const reason = prompt('Please enter the reason for cancelling/reversing this purchase:');
    if (reason === null) return;
    try {
      await api.post(`/inventory/purchases/${purchaseId}/cancel`, { reason });
      alert('Purchase successfully cancelled and stock safely reversed!');
      setSelectedPurchaseDetails(null);
      fetchRawMaterials();
      fetchProcureHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel purchase');
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
      if (p && p.recipeMatrix && Array.isArray(p.recipeMatrix) && p.recipeMatrix.length > 0) {
        setRecipeItems(p.recipeMatrix.map((rm: any) => ({
          rawMaterialId: rm.rawMaterialId,
          quantity: rm.quantityRequired,
          unit: rm.unit
        })));
      } else if (p && p.recipe && Array.isArray(p.recipe) && p.recipe.length > 0) {
        setRecipeItems(p.recipe);
      } else {
        setRecipeItems([{ rawMaterialId: '', quantity: 0, unit: 'kg' }]);
      }
    }
  }, [selectedProductId, products]);

  const handleClearRecipe = async () => {
    if (!selectedProductId) return;
    if (!confirm('Are you sure you want to remove all ingredients from this product recipe?')) return;
    try {
      await api.delete(`/inventory/recipe-matrix/${selectedProductId}`);
      setRecipeItems([{ rawMaterialId: '', quantity: 0, unit: 'kg' }]);
      await fetchProducts();
      alert('Recipe cleared successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to clear recipe');
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedProductId) return;
    const validRecipe = recipeItems.filter(i => i.rawMaterialId && parseFloat(i.quantity) > 0);
    
    try {
      const res = await api.post('/inventory/recipe-matrix', {
        finishedProductId: selectedProductId,
        items: validRecipe.map(i => {
          const rm = rawMaterials.find(r => r.id === i.rawMaterialId);
          return {
            rawMaterialId: i.rawMaterialId,
            quantityRequired: parseFloat(i.quantity),
            unit: i.unit || rm?.unit || 'kg'
          };
        })
      });
      const saved = (res.data || []).map((rm: any) => ({
        rawMaterialId: rm.rawMaterialId,
        quantity: rm.quantityRequired,
        unit: rm.unit
      }));
      setRecipeItems(saved.length > 0 ? saved : [{ rawMaterialId: '', quantity: 0, unit: 'kg' }]);
      await fetchProducts();
      alert(validRecipe.length === 0 ? 'Recipe cleared successfully!' : 'Recipe Matrix saved successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to save recipe mapping');
    }
  };

  // Helper stats for Procurement
  const completedPurchases = procureHistory.filter(p => p.status !== 'CANCELLED');
  const totalProcurementSpend = completedPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
  const totalProcurementTax = completedPurchases.reduce((acc, p) => acc + (p.taxTotal || 0), 0);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-2">Recipe & Raw Materials</h1>
        <p className="text-slate-500 font-medium text-xs md:text-sm">Manage raw stocks, procurement invoices with tax attachments, wastage records, and recipe mappings.</p>
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
          onClick={() => { setActiveTab('PROCURE'); fetchProcureHistory(); }}
          className={`pb-4 px-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'PROCURE' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
          }`}
        >
          <span>Procurement & Invoices</span>
          {procureHistory.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
              {procureHistory.length}
            </span>
          )}
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

      {/* Content Container */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden min-h-[500px]">
        
        {/* --- TAB 1: RAW MATERIALS --- */}
        {activeTab === 'RAW' && (
          <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Ingredients Matrix</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Current warehouse & kitchen raw ingredients</p>
              </div>
              <div className="flex gap-2.5">
                <button 
                  onClick={() => {
                    fetchNextInvoice();
                    setShowRecordPurchase(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow flex items-center gap-1.5 transition-colors"
                >
                  <Receipt size={15} /> + Record Purchase
                </button>
                <button 
                  onClick={() => { setRawForm({ id: '', name: '', unit: 'kg', stockQuantity: 0, lowStockThreshold: 0 }); setShowAddRaw(true); }}
                  className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={15} /> Create Ingredient
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-y border-slate-100">
                    <th className="px-6 py-3.5 font-bold">Name</th>
                    <th className="px-6 py-3.5 font-bold">Standard Unit</th>
                    <th className="px-6 py-3.5 font-bold">Current Stock</th>
                    <th className="px-6 py-3.5 font-bold">Threshold Alert</th>
                    <th className="px-6 py-3.5 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {rawMaterials.map(raw => {
                    const isLow = raw.stockQuantity <= raw.lowStockThreshold;

                    return (
                      <tr key={raw.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{raw.name}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-500">{raw.unit}</td>
                        <td className="px-6 py-4 font-bold">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                            isLow ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {raw.stockQuantity.toFixed(3)} {raw.unit}
                            {isLow && <AlertTriangle size={12} />}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-500">{raw.lowStockThreshold} {raw.unit}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => { setRawForm(raw); setShowAddRaw(true); }}
                              className="text-slate-400 hover:text-brand-primary p-1 font-bold text-xs"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => deleteRawMaterial(raw.id)}
                              className="text-slate-400 hover:text-red-500 p-1 font-bold text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rawMaterials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                        No raw ingredients registered yet. Click "+ Create Ingredient" or "+ Record Purchase" to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB 2: PROCUREMENT & TAX INVOICES --- */}
        {activeTab === 'PROCURE' && (
          <div className="p-6 md:p-8 space-y-6">
            
            {/* Header & Stats Banner */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="text-brand-400" size={24} />
                  <h2 className="text-xl font-black tracking-tight">Stock Procurement & Tax Invoices</h2>
                </div>
                <p className="text-xs text-slate-400">Record multi-product supplier invoices, auto-update raw stock, and manage attached tax receipts.</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Total Spend</span>
                  <span className="text-base font-black text-white">₹{totalProcurementSpend.toFixed(2)}</span>
                </div>
                <div className="bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Total Tax</span>
                  <span className="text-base font-black text-emerald-400">₹{totalProcurementTax.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => {
                    fetchNextInvoice();
                    setShowRecordPurchase(true);
                  }}
                  className="px-6 py-3 bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/25 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus size={16} /> Record Purchase
                </button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search invoice #, supplier, product..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchProcureHistory()}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={historySupplierFilter}
                  onChange={e => setHistorySupplierFilter(e.target.value)}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <select
                  value={historyStatusFilter}
                  onChange={e => setHistoryStatusFilter(e.target.value)}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <input
                  type="date"
                  value={historyStartDate}
                  onChange={e => setHistoryStartDate(e.target.value)}
                  title="Start Date"
                  className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                />

                <input
                  type="date"
                  value={historyEndDate}
                  onChange={e => setHistoryEndDate(e.target.value)}
                  title="End Date"
                  className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                />

                <button
                  onClick={fetchProcureHistory}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Filter size={14} /> Filter
                </button>

                {(historySearch || historySupplierFilter || historyStartDate || historyEndDate || historyStatusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setHistorySearch('');
                      setHistorySupplierFilter('');
                      setHistoryStartDate('');
                      setHistoryEndDate('');
                      setHistoryStatusFilter('ALL');
                      setTimeout(fetchProcureHistory, 50);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-700 font-bold text-xs transition-colors"
                    title="Reset filters"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Purchases History Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-100">
                    <th className="px-5 py-3.5 font-bold">Date</th>
                    <th className="px-5 py-3.5 font-bold">Invoice #</th>
                    <th className="px-5 py-3.5 font-bold">Supplier</th>
                    <th className="px-5 py-3.5 font-bold">Products</th>
                    <th className="px-5 py-3.5 font-bold">Subtotal</th>
                    <th className="px-5 py-3.5 font-bold">Tax</th>
                    <th className="px-5 py-3.5 font-bold">Grand Total</th>
                    <th className="px-5 py-3.5 text-center font-bold">Invoice Attachment</th>
                    <th className="px-5 py-3.5 text-center font-bold">Status</th>
                    <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {procureHistory.map(purchase => {
                    const isCancelled = purchase.status === 'CANCELLED';
                    const items = purchase.items || [];
                    const hasAttachment = Boolean(purchase.attachmentUrl);

                    return (
                      <tr 
                        key={purchase.id} 
                        className={`hover:bg-slate-50/70 transition-colors ${isCancelled ? 'opacity-50 bg-slate-50/30' : ''}`}
                      >
                        <td className="px-5 py-4 font-medium text-slate-600 whitespace-nowrap">
                          {new Date(purchase.date).toLocaleDateString()}
                        </td>

                        <td className="px-5 py-4 font-black text-slate-800">
                          <button 
                            onClick={() => setSelectedPurchaseDetails(purchase)}
                            className="hover:text-brand-primary underline decoration-slate-300 underline-offset-2"
                          >
                            {purchase.invoiceNo}
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-800">{purchase.supplierName || 'General'}</div>
                          {purchase.supplierGstin && (
                            <span className="text-[10px] text-slate-400 font-mono">GST: {purchase.supplierGstin}</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {items.slice(0, 2).map((item: any, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                                {item.rawMaterialName} ({item.quantity} {item.unit || 'kg'})
                              </span>
                            ))}
                            {items.length > 2 && (
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">
                                +{items.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-600">
                          ₹{(purchase.subtotal || purchase.totalAmount).toFixed(2)}
                        </td>

                        <td className="px-5 py-4 font-bold text-emerald-600">
                          ₹{(purchase.taxTotal || 0).toFixed(2)}
                        </td>

                        <td className="px-5 py-4 font-black text-slate-900 text-sm whitespace-nowrap">
                          ₹{purchase.totalAmount.toFixed(2)}
                        </td>

                        <td className="px-5 py-4 text-center">
                          {hasAttachment ? (
                            <button
                              onClick={() => setViewAttachmentModal({
                                url: purchase.attachmentUrl,
                                name: purchase.attachmentName || `Invoice-${purchase.invoiceNo}`,
                                type: purchase.attachmentType || 'application/pdf'
                              })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-primary hover:bg-brand-100 rounded-lg font-bold text-[10px] uppercase transition-colors"
                              title="Click to view original tax invoice attachment"
                            >
                              <Paperclip size={12} />
                              <span>{purchase.attachmentName?.split('.').pop()?.toUpperCase() || 'ATTACHED'}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px] font-bold">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCancelled 
                              ? 'bg-rose-100 text-rose-700' 
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {purchase.status || 'COMPLETED'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setSelectedPurchaseDetails(purchase)}
                            className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-slate-100 transition-colors"
                            title="View full purchase breakdown"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {procureHistory.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                        {loading ? 'Loading procurement history...' : 'No purchases found matching criteria. Click "+ Record Purchase" to enter a tax invoice.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* --- TAB 3: WASTAGE RECORDS --- */}
        {activeTab === 'WASTAGE' && (
          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
            <form onSubmit={handleWastageSubmit} className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 h-max">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-4">Log Raw Material Wastage</h3>
              
              <div className="space-y-3">
                <select
                  required
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                  value={wastageId}
                  onChange={e => setWastageId(e.target.value)}
                >
                  <option value="">-- Choose Ingredient --</option>
                  {rawMaterials.map(r => (
                    <option key={r.id} value={r.id}>{r.name} (In Stock: {r.stockQuantity.toFixed(2)} {r.unit})</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input 
                    required
                    type="number"
                    step="0.001"
                    placeholder="Wasted Quantity"
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                    value={wastageQty}
                    onChange={e => setWastageQty(e.target.value)}
                  />
                  <div className="p-3 bg-slate-100 rounded-xl font-mono font-bold text-xs text-slate-500 flex items-center">
                    {rawMaterials.find(r => r.id === wastageId)?.unit || 'unit'}
                  </div>
                </div>

                <input 
                  placeholder="Reason (Spoilage, Expired, Spilled...)"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                  value={wastageReason}
                  onChange={e => setWastageReason(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow"
              >
                Log Wastage Entry
              </button>
            </form>

            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Wastage History</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {wastageHistory.map((w, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{w.rawMaterialName}</div>
                      <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                        {w.reason || 'No reason provided'} • {new Date(w.date).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-xs font-black">
                      -{w.quantity}
                    </span>
                  </div>
                ))}
                {wastageHistory.length === 0 && (
                  <div className="text-center py-10 text-slate-400 font-medium text-xs">No wastage logged yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 4: RECIPE MAPPING --- */}
        {activeTab === 'RECIPES' && (
          <div className="p-6 md:p-8">
            <div className="mb-6 max-w-md">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Select POS Menu Item to Map</label>
              <select
                className="w-full p-3.5 bg-slate-50 border-none rounded-2xl font-bold text-sm"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
              >
                <option value="">-- Choose Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>
                ))}
              </select>
            </div>

            {selectedProductId && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Recipe Bill of Materials</h3>
                  <button 
                    onClick={handleClearRecipe}
                    className="text-red-500 hover:text-red-600 font-bold text-xs uppercase tracking-wider"
                  >
                    Clear Recipe
                  </button>
                </div>

                <div className="space-y-3">
                  {recipeItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="flex-1 p-2.5 bg-slate-50 border-none rounded-xl font-bold text-xs"
                        value={item.rawMaterialId}
                        onChange={e => {
                          const updated = [...recipeItems];
                          updated[idx].rawMaterialId = e.target.value;
                          const raw = rawMaterials.find(r => r.id === e.target.value);
                          if (raw) updated[idx].unit = raw.unit;
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
                        step="0.001"
                        placeholder="Quantity"
                        className="w-28 p-2.5 bg-slate-50 border-none rounded-xl font-bold text-xs text-center"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={e => {
                          const updated = [...recipeItems];
                          updated[idx].quantity = parseFloat(e.target.value) || 0;
                          setRecipeItems(updated);
                        }}
                      />

                      <span className="w-16 p-2 bg-slate-100 rounded-xl text-center font-mono font-bold text-xs text-slate-500">
                        {item.unit || rawMaterials.find(r => r.id === item.rawMaterialId)?.unit || 'kg'}
                      </span>

                      <button 
                        type="button"
                        title="Remove ingredient row"
                        onClick={() => {
                          const updated = recipeItems.filter((_, i) => i !== idx);
                          setRecipeItems(updated.length > 0 ? updated : [{ rawMaterialId: '', quantity: 0, unit: 'kg' }]);
                        }}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={() => setRecipeItems([...recipeItems, { rawMaterialId: '', quantity: 0, unit: 'kg' }])}
                    className="text-brand-primary font-bold text-xs uppercase tracking-wider hover:underline pt-1 block"
                  >
                    + Add Ingredient Row
                  </button>
                </div>

                <button 
                  onClick={handleSaveRecipe}
                  className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow flex items-center justify-center gap-1.5 transition-all"
                >
                  <Save size={16} /> Save Recipe Mapping
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- MODAL 1: RECORD PURCHASE (MULTI-PRODUCT TAX INVOICE) --- */}
      {showRecordPurchase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <form 
            onSubmit={handleSavePurchase}
            className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-6 md:p-8 relative animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-primary flex items-center justify-center">
                  <Receipt size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Record Purchase Invoice</h2>
                  <p className="text-xs text-slate-400 font-medium">Multi-product stock replenishment & automated inventory update</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRecordPurchase(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
              
              {/* Header Information: Supplier, Date, Invoice No, GSTIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                
                {/* Supplier Field */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Supplier / Shop Name *
                  </label>
                  <input
                    required
                    list="suppliers-datalist"
                    placeholder="Select or enter shop..."
                    value={purchaseForm.supplierName}
                    onChange={e => handleSupplierSelect(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                  <datalist id="suppliers-datalist">
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>

                {/* Invoice Number */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">
                      Invoice Number *
                    </label>
                    <button
                      type="button"
                      onClick={fetchNextInvoice}
                      className="text-[9px] font-bold text-brand-primary hover:underline"
                    >
                      Auto PUR#
                    </button>
                  </div>
                  <input
                    required
                    placeholder="e.g. INV-98124 or PUR-1001"
                    value={purchaseForm.invoiceNo}
                    onChange={e => setPurchaseForm({ ...purchaseForm, invoiceNo: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Purchase Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={purchaseForm.date}
                    onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>

                {/* Supplier GSTIN */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Supplier GSTIN (Optional)
                  </label>
                  <input
                    placeholder="e.g. 32AAAAA0000A1Z5"
                    value={purchaseForm.supplierGstin}
                    onChange={e => setPurchaseForm({ ...purchaseForm, supplierGstin: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Payment Mode</label>
                  <select
                    value={purchaseForm.paymentMode}
                    onChange={e => setPurchaseForm({ ...purchaseForm, paymentMode: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="CARD">Card</option>
                    <option value="CREDIT">Credit (Pay Later)</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>

                {/* Payment Status */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Payment Status</label>
                  <select
                    value={purchaseForm.paymentStatus}
                    onChange={e => setPurchaseForm({ ...purchaseForm, paymentStatus: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none"
                  >
                    <option value="PAID">Paid in Full</option>
                    <option value="PENDING">Pending</option>
                    <option value="PARTIAL">Partial</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Notes / Bill Description</label>
                  <input
                    placeholder="Optional notes or vendor comments..."
                    value={purchaseForm.notes}
                    onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none"
                  />
                </div>
              </div>

              {/* Purchased Products Rows */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">
                    Purchased Products ({purchaseForm.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setPurchaseForm(prev => ({
                        ...prev,
                        items: [
                          ...prev.items,
                          {
                            rawMaterialId: '',
                            rawMaterialName: '',
                            isNewIngredient: false,
                            unit: 'kg',
                            quantity: 1,
                            price: 0,
                            taxPercent: 0
                          }
                        ]
                      }));
                    }}
                    className="px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-wider shadow flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} /> Add Another Product
                  </button>
                </div>

                <div className="space-y-2">
                  {purchaseForm.items.map((item, idx) => {
                    const qty = parseFloat(item.quantity as any) || 0;
                    const price = parseFloat(item.price as any) || 0;
                    const lineTotal = qty * price;

                    return (
                      <div 
                        key={idx} 
                        className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-wrap md:flex-nowrap gap-2.5 items-center animate-in fade-in"
                      >
                        {/* Ingredient Name / Dropdown */}
                        <div className="flex-1 min-w-[220px]">
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                            Product / Ingredient #{idx + 1}
                          </label>
                          {item.isNewIngredient ? (
                            <div className="flex gap-1.5">
                              <input
                                placeholder="Enter new ingredient name..."
                                value={item.rawMaterialName}
                                onChange={e => {
                                  const updated = [...purchaseForm.items];
                                  updated[idx].rawMaterialName = e.target.value;
                                  setPurchaseForm({ ...purchaseForm, items: updated });
                                }}
                                className="w-full p-2 bg-white border border-brand-primary rounded-xl font-bold text-xs outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...purchaseForm.items];
                                  updated[idx].isNewIngredient = false;
                                  updated[idx].rawMaterialId = '';
                                  setPurchaseForm({ ...purchaseForm, items: updated });
                                }}
                                className="text-[10px] text-slate-400 hover:text-slate-600 px-1 font-bold"
                                title="Back to existing list"
                              >
                                Select
                              </button>
                            </div>
                          ) : (
                            <select
                              value={item.rawMaterialId}
                              onChange={e => {
                                const val = e.target.value;
                                const updated = [...purchaseForm.items];
                                if (val === '__NEW__') {
                                  updated[idx].isNewIngredient = true;
                                  updated[idx].rawMaterialId = '';
                                  updated[idx].rawMaterialName = '';
                                } else {
                                  updated[idx].rawMaterialId = val;
                                  const selectedRaw = rawMaterials.find(r => r.id === val);
                                  if (selectedRaw) {
                                    updated[idx].rawMaterialName = selectedRaw.name;
                                    updated[idx].unit = selectedRaw.unit;
                                  }
                                }
                                setPurchaseForm({ ...purchaseForm, items: updated });
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none"
                            >
                              <option value="">-- Choose Ingredient --</option>
                              {rawMaterials.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                              ))}
                              <option value="__NEW__">+ Enter New Ingredient...</option>
                            </select>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="w-24 shrink-0">
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Qty</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={e => {
                              const updated = [...purchaseForm.items];
                              updated[idx].quantity = parseFloat(e.target.value) || 0;
                              setPurchaseForm({ ...purchaseForm, items: updated });
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-center outline-none"
                          />
                        </div>

                        {/* Unit */}
                        <div className="w-24 shrink-0">
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Unit</label>
                          <select
                            value={item.unit}
                            onChange={e => {
                              const updated = [...purchaseForm.items];
                              updated[idx].unit = e.target.value;
                              setPurchaseForm({ ...purchaseForm, items: updated });
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none"
                          >
                            <option value="kg">kg</option>
                            <option value="g">gram</option>
                            <option value="ltr">litre</option>
                            <option value="ml">ml</option>
                            <option value="pcs">pcs</option>
                          </select>
                        </div>

                        {/* Rate Per Unit */}
                        <div className="w-28 shrink-0">
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Rate (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Price"
                            value={item.price === 0 ? '' : item.price}
                            onChange={e => {
                              const updated = [...purchaseForm.items];
                              updated[idx].price = parseFloat(e.target.value) || 0;
                              setPurchaseForm({ ...purchaseForm, items: updated });
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-right outline-none"
                          />
                        </div>

                        {/* Calculated Line Total */}
                        <div className="w-28 shrink-0 text-right">
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Line Total</label>
                          <div className="p-2 font-black text-xs text-slate-800">
                            ₹{lineTotal.toFixed(2)}
                          </div>
                        </div>

                        {/* Remove Action */}
                        <div className="pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (purchaseForm.items.length <= 1) {
                                alert('At least one product row is required.');
                                return;
                              }
                              const updated = purchaseForm.items.filter((_, i) => i !== idx);
                              setPurchaseForm({ ...purchaseForm, items: updated });
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Summary Cards */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Purchase Subtotal</span>
                    <span className="text-xl font-black">₹{calculatePurchaseTotals().subtotal.toFixed(2)}</span>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 tracking-wider">Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={purchaseForm.discount === 0 ? '' : purchaseForm.discount}
                      onChange={e => setPurchaseForm({ ...purchaseForm, discount: parseFloat(e.target.value) || 0 })}
                      className="w-32 p-2 bg-slate-800 border border-slate-700 rounded-xl font-bold text-xs text-white outline-none focus:border-brand-primary"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[10px] font-black uppercase text-brand-300 block tracking-wider">Grand Total</span>
                    <span className="text-2xl font-black text-white tracking-tight">
                      ₹{calculatePurchaseTotals().grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowRecordPurchase(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                disabled={purchaseSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={purchaseSubmitting}
                className="px-7 py-3 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {purchaseSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving & Updating Stock...
                  </>
                ) : (
                  <>
                    <PackageCheck size={16} /> Save Purchase & Update Stock
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL 2: PURCHASE DETAILS & AUDIT BREAKDOWN --- */}
      {selectedPurchaseDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl p-6 md:p-8 relative animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-brand-50 text-brand-primary rounded-lg font-black text-xs font-mono">
                    {selectedPurchaseDetails.invoiceNo}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    selectedPurchaseDetails.status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {selectedPurchaseDetails.status || 'COMPLETED'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Supplier: {selectedPurchaseDetails.supplierName || 'General Vendor'}
                </h3>
                <p className="text-xs text-slate-400">
                  Purchased on {new Date(selectedPurchaseDetails.date).toLocaleString()}
                </p>
              </div>

              <button 
                onClick={() => setSelectedPurchaseDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
              
              {/* Info Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Payment Mode</span>
                  <span className="font-bold text-slate-800">{selectedPurchaseDetails.paymentMode || 'CASH'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Supplier GSTIN</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPurchaseDetails.supplierGstin || 'Not Specified'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Tax Paid</span>
                  <span className="font-bold text-emerald-600">₹{(selectedPurchaseDetails.taxTotal || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Grand Total</span>
                  <span className="font-black text-slate-900">₹{selectedPurchaseDetails.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-700 mb-2">Purchased Line Items</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="px-4 py-2.5">Item Name</th>
                        <th className="px-4 py-2.5">Quantity</th>
                        <th className="px-4 py-2.5">Rate</th>
                        <th className="px-4 py-2.5">Tax %</th>
                        <th className="px-4 py-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedPurchaseDetails.items || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-800">{item.rawMaterialName}</td>
                          <td className="px-4 py-3 font-medium text-slate-600">{item.quantity} {item.unit || 'kg'}</td>
                          <td className="px-4 py-3 font-medium text-slate-600">₹{item.price.toFixed(2)}</td>
                          <td className="px-4 py-3 font-medium text-emerald-600">{item.taxPercent || 0}%</td>
                          <td className="px-4 py-3 font-bold text-slate-900 text-right">₹{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recorded Stock Movements Audit */}
              {selectedPurchaseDetails.stockMovements && selectedPurchaseDetails.stockMovements.length > 0 && (
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <PackageCheck size={14} className="text-emerald-500" />
                    <span>Recorded Stock Movements</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedPurchaseDetails.stockMovements.map((sm: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{sm.notes || sm.type}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Previous Stock: {sm.previousStock} {sm.unit} → New Stock: {sm.newStock} {sm.unit}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                          sm.quantity >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {sm.quantity >= 0 ? `+${sm.quantity}` : sm.quantity} {sm.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Original Tax Invoice Attachment Section */}
              {selectedPurchaseDetails.attachmentUrl && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                      <Paperclip size={14} className="text-brand-primary" />
                      <span>Original Supplier Tax Invoice</span>
                    </span>
                    <button
                      onClick={() => setViewAttachmentModal({
                        url: selectedPurchaseDetails.attachmentUrl,
                        name: selectedPurchaseDetails.attachmentName || `Invoice-${selectedPurchaseDetails.invoiceNo}`,
                        type: selectedPurchaseDetails.attachmentType || 'application/pdf'
                      })}
                      className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                    >
                      <Eye size={12} /> Open Preview
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-xs">
                    <span className="font-bold text-slate-800 truncate">
                      {selectedPurchaseDetails.attachmentName || 'Original_Tax_Invoice.pdf'}
                    </span>
                    <a
                      href={selectedPurchaseDetails.attachmentUrl}
                      download={selectedPurchaseDetails.attachmentName || `Invoice-${selectedPurchaseDetails.invoiceNo}`}
                      className="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 hover:bg-black transition-colors"
                    >
                      <Download size={12} /> Download
                    </a>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 shrink-0">
              {selectedPurchaseDetails.status !== 'CANCELLED' ? (
                <button
                  onClick={() => handleCancelPurchase(selectedPurchaseDetails.id)}
                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                  title="Safely reverse stock and mark purchase cancelled"
                >
                  <Ban size={14} /> Cancel & Revert Stock
                </button>
              ) : (
                <span className="text-xs text-red-500 font-bold">This purchase has been reversed.</span>
              )}

              <button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 3: INVOICE ATTACHMENT PREVIEWER --- */}
      {viewAttachmentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-brand-primary" />
                <h3 className="font-bold text-sm text-slate-800 truncate">{viewAttachmentModal.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewAttachmentModal.url}
                  download={viewAttachmentModal.name}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Download size={14} /> Download
                </a>
                <button
                  onClick={() => setViewAttachmentModal(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-100 rounded-2xl p-2 min-h-[400px]">
              {viewAttachmentModal.url.startsWith('data:image') || viewAttachmentModal.type.startsWith('image/') ? (
                <img 
                  src={viewAttachmentModal.url} 
                  alt={viewAttachmentModal.name} 
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow"
                />
              ) : (
                <iframe
                  src={viewAttachmentModal.url}
                  title={viewAttachmentModal.name}
                  className="w-full h-[70vh] rounded-xl border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: RAW MATERIAL ADD / EDIT POPUP --- */}
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
