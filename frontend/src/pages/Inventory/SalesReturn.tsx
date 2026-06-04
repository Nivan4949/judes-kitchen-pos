import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  Calendar, 
  Hash,
  User,
  Package,
  X,
  PlusCircle,
  TrendingDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

interface Product {
  id: string;
  name: string;
  sellingPrice: number;
  gstRate: number;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface ReturnItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  taxAmount: number;
  total: number;
  unit: string;
}

const SalesReturn = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState('');

  // UI State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Totals
  const [subtotal, setSubtotal] = useState(0);
  const [taxTotal, setTaxTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [returnItems]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [custRes, prodRes] = await Promise.all([
        api.get('/customers'),
        api.get('/products')
      ]);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let sub = 0;
    let tax = 0;
    returnItems.forEach(item => {
      sub += item.price * item.quantity;
      tax += item.taxAmount;
    });
    setSubtotal(sub);
    setTaxTotal(tax);
    setGrandTotal(sub + tax);
  };

  const handleAddItem = (product: Product) => {
    const existing = returnItems.find(i => i.productId === product.id);
    if (existing) {
      setReturnItems(returnItems.map(i => 
        i.productId === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price + ((i.quantity + 1) * i.price * (product.gstRate / 100)), taxAmount: (i.quantity + 1) * i.price * (product.gstRate / 100) } : i
      ));
    } else {
      const tax = product.sellingPrice * (product.gstRate / 100);
      setReturnItems([...returnItems, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellingPrice,
        taxAmount: tax,
        total: product.sellingPrice + tax,
        unit: product.unit
      }]);
    }
    setIsItemModalOpen(false);
  };

  const updateItemQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setReturnItems(returnItems.map(i => {
      if (i.productId === id) {
        const itemTax = (i.price * (qty)) * (products.find(p => p.id === id)?.gstRate || 18) / 100;
        return { ...i, quantity: qty, taxAmount: itemTax, total: (i.price * qty) + itemTax };
      }
      return i;
    }));
  };

  const removeItem = (id: string) => {
    setReturnItems(returnItems.filter(i => i.productId !== id));
  };

  const handleSave = async (isNew = false) => {
    if (!selectedCustomerId && returnItems.length === 0) {
      alert('Please select a customer and add at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/sales-returns', {
        customerId: selectedCustomerId || null,
        returnItems,
        subtotal,
        taxTotal,
        totalAmount: grandTotal,
        reason
      });
      
      alert('Credit Note saved successfully!');
      if (isNew) {
        setReturnItems([]);
        setSelectedCustomerId('');
        setInvoiceNo('');
        setInvoiceDate('');
        setReason('');
      } else {
        navigate('/inventory');
      }
    } catch (error) {
      console.error('Error saving return:', error);
      alert('Failed to save credit note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Credit Note</h1>
            <p className="text-sm text-slate-500">Sales Return Feature</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
           <div className="px-3 py-1 bg-white rounded border border-slate-200">Return No: <span className="text-brand-600">Auto</span></div>
           <div className="px-3 py-1 bg-white rounded border border-slate-200">Date: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 gap-6">
        {/* Customer & Invoice Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Customer Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50/50"
                >
                  <option value="">Select Customer (Optional)</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Invoice Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50/50 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Inv No.</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="INV-XXX"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50/50 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Items Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 bg-brand-50/50 border-b border-brand-100 flex justify-between items-center">
             <div className="flex items-center gap-2 text-brand-700 font-bold">
                <Package size={20} />
                <span>Billed Items</span>
             </div>
             <button 
                onClick={() => setIsItemModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
             >
                <Plus size={18} />
                Add Items
             </button>
          </div>

          <div className="min-h-[200px]">
            {returnItems.length > 0 ? (
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4 text-center">Qty</th>
                    <th className="px-6 py-4 text-right">Rate</th>
                    <th className="px-6 py-4 text-right">Tax</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((item) => (
                    <tr key={item.productId} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700">{item.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Unit: {item.unit}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3 bg-slate-100 rounded-lg p-1 w-24 mx-auto">
                          <button 
                            onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-500 transition-all font-bold"
                          >
                             -
                          </button>
                          <span className="font-bold text-slate-800 text-sm">{item.quantity}</span>
                          <button 
                             onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                             className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-800 transition-all font-bold"
                          >
                             +
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">₹{item.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-medium text-brand-600">₹{item.taxAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">₹{item.total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => removeItem(item.productId)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 italic">
                 <Package size={48} className="mb-4 opacity-20" />
                 <p>No items added. Click "Add Items" to begin.</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
             <div className="w-full md:w-64 space-y-3">
                <div className="flex justify-between text-slate-500 font-bold text-sm uppercase tracking-wider">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-brand-600 font-bold text-sm uppercase tracking-wider">
                  <span>Tax Amount</span>
                  <span>₹{taxTotal.toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between text-slate-800 font-black text-xl">
                  <span>Total</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="w-full md:flex-1">
              <input 
                type="text"
                placeholder="Return reason (Optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50/50"
              />
           </div>
           <div className="flex gap-3 w-full md:w-auto">
              <button 
                onClick={() => handleSave(true)}
                disabled={submitting}
                className="flex-1 md:flex-none px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Save & New
              </button>
              <button 
                onClick={() => handleSave(false)}
                disabled={submitting}
                className="flex-1 md:flex-none px-12 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : (
                  <>
                    <Save size={20} />
                    SAVE
                  </>
                )}
              </button>
           </div>
        </div>
      </div>

      {/* Item Selection Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsItemModalOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <PlusCircle className="text-brand-600" />
                 Add Items to Credit Note
               </h2>
               <button onClick={() => setIsItemModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                 <X size={24} />
               </button>
            </div>
            <div className="p-6">
               <div className="relative mb-6">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                 <input 
                    type="text"
                    placeholder="Search by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50/50"
                    autoFocus
                 />
               </div>
               <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {products.filter(p => 
                    p.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map(p => (
                    <button 
                      key={p.id}
                      onClick={() => handleAddItem(p)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-brand-50 border border-slate-100 hover:border-brand-200 transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold shadow-sm group-hover:bg-brand-600 group-hover:text-white transition-colors">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-700">{p.name}</div>
                          <div className="text-xs text-slate-400">Unit: {p.unit}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-800 text-lg">₹{p.sellingPrice.toFixed(2)}</div>
                        <div className="text-[10px] text-brand-600 font-bold uppercase">Tax: {p.gstRate}%</div>
                      </div>
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesReturn;
