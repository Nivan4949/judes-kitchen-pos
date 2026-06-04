import React, { useState, useEffect } from 'react';
import { X, Calendar, ShoppingBag, CreditCard, ChevronRight, Loader2, Edit3, Trash2, Save, Plus } from 'lucide-react';
import api from '../api/api';

interface BillDetailsModalProps {
  billId: string;
  type: 'SALE' | 'PURCHASE';
  onClose: () => void;
  onUpdate?: () => void;
}

const BillDetailsModal: React.FC<BillDetailsModalProps> = ({ billId, type, onClose, onUpdate }) => {
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchBill = async () => {
    setLoading(true);
    try {
      const endpoint = type === 'SALE' ? `/orders/${billId}` : `/purchases/${billId}`;
      const res = await api.get(endpoint);
      setBill(res.data);
      setItems(type === 'SALE' ? res.data.orderItems : res.data.purchaseItems);
    } catch (err) {
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBill();
  }, [billId]);

  useEffect(() => {
    if (isEditing && products.length === 0) {
      api.get('/products').then(res => setProducts(res.data)).catch(console.error);
    }
  }, [isEditing]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total for that item
    const price = newItems[index].price || newItems[index].sellingPrice || 0;
    const qty = newItems[index].quantity;
    const gst = newItems[index].product?.gstRate || 0;
    newItems[index].total = (price * qty) + (price * (gst / 100) * qty);
    
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const p = products.find(prod => prod.id === productId);
    if (!p) return;
    const newItems = [...items];
    const price = type === 'SALE' ? p.sellingPrice : (p.purchasePrice || p.sellingPrice || 0);
    newItems[index] = {
        ...newItems[index],
        productId: p.id,
        product: p,
        price,
    };
    
    const qty = newItems[index].quantity;
    const gst = p.gstRate || 0;
    newItems[index].total = (price * qty) + (price * (gst / 100) * qty);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
       alert("Cannot remove the last item. A bill must have at least one item.");
       return;
    }
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSave = async () => {
    // Validation: Check for empty item lines (no product selected)
    const invalidItems = items.filter(item => !item.productId);
    if (invalidItems.length > 0) {
        alert("Please select a product for all item lines, or remove the empty rows before saving.");
        return;
    }

    setSaving(true);
    try {
      const subtotal = items.reduce((sum, i) => sum + ( (i.price || i.sellingPrice) * i.quantity), 0);
      const taxTotal = items.reduce((sum, i) => sum + ( (i.price || i.sellingPrice) * ( (i.product?.gstRate || 0) / 100) * i.quantity), 0);
      const grandTotal = subtotal + taxTotal;

      const payload = {
        ...bill,
        orderItems: items,
        purchaseItems: items, // reuse for both
        subtotal,
        taxTotal,
        grandTotal
      };

      const endpoint = type === 'SALE' ? `/orders/${billId}` : `/purchases/${billId}`;
      await api.put(endpoint, payload);
      setIsEditing(false);
      fetchBill();
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Error updating bill: ' + (err as any).response?.data?.error || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl"><Loader2 className="animate-spin text-brand-primary" size={32} /></div>
    </div>
  );

  if (!bill) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-black text-slate-900">{bill.invoiceNo}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                    <Calendar size={12}/> {new Date(bill.createdAt || bill.date).toLocaleString()}
                </p>
            </div>
            <div className="flex gap-2">
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="p-3 bg-brand-50 text-brand-primary rounded-2xl hover:bg-brand-primary hover:text-white transition-all">
                        <Edit3 size={18} />
                    </button>
                )}
                <button onClick={onClose} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                    <X size={18} />
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="space-y-4">
                {items.map((item, idx) => (
                    <div key={idx} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs">
                                {idx + 1}
                            </div>
                            <div>
                                {isEditing && !item.productId ? (
                                    <select 
                                        className="w-full px-2 py-1 bg-white border border-brand-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary mb-2 truncate max-w-[200px]"
                                        value={item.productId || ''}
                                        onChange={e => handleProductSelect(idx, e.target.value)}
                                    >
                                        <option value="">Select a product...</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                ) : (
                                    <p className="font-bold text-slate-900">{item.product?.name || 'Product'}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={item.quantity}
                                                onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value))}
                                                className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black"
                                            />
                                            <span className="text-[10px] font-black text-slate-400">@ ₹</span>
                                            <input 
                                                type="number" 
                                                value={item.price}
                                                onChange={e => handleUpdateItem(idx, 'price', parseFloat(e.target.value))}
                                                className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black"
                                            />
                                            <button 
                                                onClick={() => handleRemoveItem(idx)}
                                                className="ml-2 w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {item.quantity} {item.product?.unit || 'pcs'} × ₹{item.price?.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="font-black text-slate-900">₹{item.total.toFixed(2)}</p>
                    </div>
                ))}
        </div>
        
        {isEditing && (
            <div className="px-8 pb-4">
                <button 
                    onClick={() => {
                        setItems([...items, { 
                            productId: '', 
                            product: null, 
                            quantity: 1, 
                            price: 0, 
                            discount: 0,
                            taxAmount: 0,
                            total: 0 
                        }]);
                    }}
                    className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors border border-emerald-100 border-dashed"
                >
                    <Plus size={16} /> Add New Item Line
                </button>
            </div>
        )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-3">
            <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest pl-2">
                <span>Subtotal</span>
                <span>₹{(isEditing ? items.reduce((sum, i) => sum + ((i.price || i.sellingPrice || 0) * i.quantity), 0) : bill.subtotal)?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest pl-2">
                <span>Tax Total</span>
                <span>₹{(isEditing ? items.reduce((sum, i) => sum + ((i.price || i.sellingPrice || 0) * ((i.product?.gstRate || 0) / 100) * i.quantity), 0) : bill.taxTotal)?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-brand-100">
                <span className="font-black text-brand-900 uppercase tracking-widest text-xs">Grand Total</span>
                <span className="text-2xl font-black text-brand-primary">
                    ₹{(isEditing ? items.reduce((sum, i) => sum + (((i.price || i.sellingPrice || 0) * i.quantity) + ((i.price || i.sellingPrice || 0) * ((i.product?.gstRate || 0) / 100) * i.quantity)), 0) : bill.grandTotal)?.toFixed(2)}
                </span>
            </div>
            {isEditing && (
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="w-full mt-4 py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20"
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Apply Reconciliation
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default BillDetailsModal;
