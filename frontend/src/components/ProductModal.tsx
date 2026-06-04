import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Printer, RefreshCcw, Camera, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import api from '../api/api';
import { Product } from '../types';
import JsBarcode from 'jsbarcode';

interface ProductModalProps {
  product?: Product | null;
  onClose: () => void;
  onSave: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>(
    product || {
      name: '',
      barcode: '',
      purchasePrice: 0,
      sellingPrice: 0,
      mrp: 0,
      gstRate: 0,
      stockQuantity: 0,
      unit: 'pcs',
      image: '',
    }
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large. Please select a photo under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };
  
  const barcodeRef = useRef<SVGSVGElement>(null);

  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (barcodeRef.current && formData.barcode) {
      JsBarcode(barcodeRef.current, formData.barcode, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: true,
        margin: 0,
        fontSize: 14
      });
    }
  }, [formData.barcode]);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Sanitise data: remove relations and read-only fields
      const { 
        id, category, inventoryLogs, orderItems, purchaseItems, 
        createdAt, updatedAt, ...cleanData 
      } = formData as any;

      // Ensure numeric fields are numbers
      const submitData = {
        ...cleanData,
        purchasePrice: Number(cleanData.purchasePrice) || 0,
        sellingPrice: Number(cleanData.sellingPrice) || 0,
        mrp: Number(cleanData.mrp) || 0,
        gstRate: Number(cleanData.gstRate) || 0,
        stockQuantity: Number(cleanData.stockQuantity) || 0,
        categoryId: cleanData.categoryId || null
      };

      if (product?.id) {
        await api.put(`/products/${product.id}`, submitData);
      } else {
        await api.post('/products', submitData);
      }
      onSave();
    } catch (error: any) {
      console.error('Error saving product:', error);
      const message = error.response?.data?.error || 'Failed to save product';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Image Upload Section */}
            <div className="md:col-span-1">
               <label className="block text-sm font-black uppercase text-slate-400 tracking-widest mb-2 font-mono">Product Image</label>
               <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group hover:border-brand-400 transition-all shadow-inner">
                  {formData.image ? (
                    <>
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
                         <label className="cursor-pointer bg-white text-slate-900 px-3 py-2 rounded-xl font-bold text-xs shadow-xl flex items-center gap-1 hover:scale-105 transition-transform">
                            <Plus size={14} />
                            <span>CHANGE</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                         </label>
                         <button type="button" onClick={() => setFormData({...formData, image: ''})} className="bg-red-500 text-white p-2 rounded-xl shadow-xl hover:bg-red-600 transition-colors hover:scale-105 transition-transform">
                            <Trash2 size={16} />
                         </button>
                      </div>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/50 transition-colors">
                      <div className="p-4 bg-white rounded-2xl shadow-sm mb-3 text-slate-300">
                        <Camera size={32} strokeWidth={1.5} />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-4">Upload Photo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
               </div>
            </div>

            {/* Basic Info Section */}
            <div className="md:col-span-2 space-y-4">
               <div>
                  <label className="block text-sm font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Product Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                    placeholder="e.g. Coca Cola 500ml"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Category</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none appearance-none cursor-pointer"
                      value={formData.categoryId || ''}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value || null })}
                    >
                      <option value="">General</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Unit</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none appearance-none cursor-pointer"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="ltr">Liters (ltr)</option>
                      <option value="box">Boxes (box)</option>
                      <option value="LOOSE">LOOSE</option>
                    </select>
                  </div>
               </div>

               <div>
                <label className="block text-sm font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Barcode / SKU</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none font-mono tracking-wider"
                    placeholder="Scan or Generate"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                  <button 
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.post('/products/generate-barcode');
                        setFormData(prev => ({ ...prev, barcode: res.data.barcode }));
                      } catch (error) {
                        console.error(error);
                      }
                    }}
                    className="px-4 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-colors uppercase tracking-widest"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Stock Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Purchase Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  className="w-full pl-7 pr-3 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Selling Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500 font-bold text-xs">₹</span>
                <input
                  required
                  type="number"
                  className="w-full pl-7 pr-3 py-3 bg-brand-50/50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Maximum Retail Price (MRP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xs">₹</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-3 bg-emerald-50/30 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 outline-none"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">GST Rate (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                value={formData.gstRate}
                onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">Opening Stock</label>
              <input
                type="number"
                step="0.001"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Barcode Preview & Print */}
          {formData.barcode && (
            <div className="mt-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center gap-6 shadow-inner">
               <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <svg ref={barcodeRef} className="max-w-[200px]"></svg>
               </div>
               <div className="flex-1 text-center md:text-left">
                  <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-2">Thermal Label Preview</h4>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">Print high-quality barcode labels directly from your browser. Perfect for thermal printers (2x1 inch).</p>
                  <button type="button" onClick={() => {
                        const printWindow = window.open('', '_blank');
                        const svgHtml = barcodeRef.current?.outerHTML || '';
                        printWindow?.document.write(`
                          <html>
                            <head><title>Print Barcode Label</title>
                            <style>
                              @page { margin: 0; size: 2in 1in; }
                              body { margin: 0; padding:0; display:flex; flex-direction:column; align-items:center; justify-content:center; width:2in; height:1in; font-family:sans-serif;}
                              .label { text-align:center; padding-top: 5px; width: 100%; box-sizing: border-box; }
                              .name { font-size: 11px; font-weight: bold; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 5px; }
                              .price { font-size: 11px; margin-top: 2px; font-weight: bold; }
                              svg { width: 90%; max-height: 40px; }
                            </style>
                            </head>
                            <body>
                              <div class="label">
                                <div class="name">${formData.name || 'Product'}</div>
                                ${svgHtml}
                                <div class="price">Rs. ${formData.sellingPrice || 0}</div>
                              </div>
                              <script>window.print(); setTimeout(() => window.close(), 500);</script>
                            </body>
                          </html>
                        `);
                        printWindow?.document.close();
                  }} className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-xs font-black transition-all shadow-xl active:scale-95"><Printer size={16}/> PRINT LABEL</button>
               </div>
            </div>
          )}

          <div className="mt-10 flex gap-3 justify-end border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-10 py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {saving ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{saving ? 'Saving...' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
