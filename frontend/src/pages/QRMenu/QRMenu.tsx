import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShoppingBag, Sparkles, ChefHat, Check, X, 
  ChevronRight, BadgePercent, AlertCircle, ShoppingCart
} from 'lucide-react';
import api from '../../api/api';
import { Product } from '../../types';

const QRMenu = () => {
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // Cart State
  const [cart, setCart] = useState<any[]>([]);
  const [orderType, setOrderType] = useState<'Dine-in' | 'Takeaway'>('Dine-in');
  const [tableName, setTableName] = useState<string>(tableParam);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notesInput, setNotesInput] = useState('');
  
  // Customization
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>([]);
  const [customizationQty, setCustomizationQty] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  // UI Flow
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const catRes = await api.get('/categories');
        const prodRes = await api.get('/products?activeOnly=true');
        setCategories(catRes.data);
        setProducts(prodRes.data);
        if (catRes.data.length > 0) {
          setSelectedCategoryId(catRes.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load menu data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const parseJsonField = (field: any) => {
    if (!field) return [];
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch (e) {
        return [];
      }
    }
    return field;
  };

  const handleProductSelect = (product: Product) => {
    const productVariants = parseJsonField(product.variants);
    const productAddons = parseJsonField(product.addons);
    
    if (productVariants.length > 0 || productAddons.length > 0) {
      setCustomizingProduct(product);
      setSelectedVariant(productVariants.length > 0 ? productVariants[0] : null);
      setSelectedModifiers([]);
      setCustomizationQty(1);
      setItemNotes('');
    } else {
      addToCartDirectly(product);
    }
  };

  const addToCartDirectly = (product: Product) => {
    const existingIndex = cart.findIndex(
      item => item.id === product.id && !item.selectedVariant && (!item.selectedModifiers || item.selectedModifiers.length === 0)
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        sellingPrice: product.sellingPrice,
        quantity: 1,
        foodType: product.foodType || 'VEG',
        notes: ''
      }]);
    }
  };

  const addCustomizedToCart = () => {
    if (!customizingProduct) return;
    
    const basePrice = selectedVariant ? selectedVariant.price : customizingProduct.sellingPrice;
    const modifiersPrice = selectedModifiers.reduce((sum, m) => sum + m.price, 0);
    const finalPrice = basePrice + modifiersPrice;

    // Check matching variant + modifiers in existing cart
    const existingIndex = cart.findIndex(item => {
      const sameId = item.id === customizingProduct.id;
      const sameVariant = item.selectedVariant?.name === selectedVariant?.name;
      const sameModifiers = JSON.stringify(item.selectedModifiers) === JSON.stringify(selectedModifiers);
      return sameId && sameVariant && sameModifiers;
    });

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += customizationQty;
      if (itemNotes) updated[existingIndex].notes = itemNotes;
      setCart(updated);
    } else {
      setCart([...cart, {
        id: customizingProduct.id,
        name: customizingProduct.name,
        sellingPrice: finalPrice,
        quantity: customizationQty,
        selectedVariant,
        selectedModifiers,
        notes: itemNotes,
        foodType: customizingProduct.foodType || 'VEG'
      }]);
    }
    setCustomizingProduct(null);
  };

  const updateCartQty = (idx: number, delta: number) => {
    const updated = [...cart];
    updated[idx].quantity += delta;
    if (updated[idx].quantity <= 0) {
      updated.splice(idx, 1);
    }
    setCart(updated);
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  };

  const submitOrderRequest = async () => {
    if (cart.length === 0) return;
    if (orderType === 'Dine-in' && !tableName) {
      alert('Please enter your Table Number/Name');
      return;
    }
    if (!customerName) {
      alert('Please enter your Name');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderItems: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.sellingPrice,
          total: item.sellingPrice * item.quantity,
          variant: item.selectedVariant?.name || null,
          modifiers: item.selectedModifiers || null,
          notes: item.notes || null
        })),
        subtotal: getSubtotal(),
        grandTotal: getSubtotal(),
        roundedTotal: Math.round(getSubtotal()),
        orderType,
        tableName: orderType === 'Dine-in' ? tableName : 'Takeaway Request',
        tableId: null, // Staff will link this on approval
        notes: notesInput,
        customerName,
        customerPhone
      };

      await api.post('/orders/qr-request', payload);
      setOrderSubmitted(true);
      setCart([]);
    } catch (err) {
      console.error(err);
      alert('Failed to submit order request. Please notify restaurant staff.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleModifier = (mod: any) => {
    if (selectedModifiers.some(m => m.name === mod.name)) {
      setSelectedModifiers(selectedModifiers.filter(m => m.name !== mod.name));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const filteredProducts = selectedCategoryId 
    ? products.filter(p => p.categoryId === selectedCategoryId)
    : products;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <ChefHat className="text-orange-500 animate-bounce" size={40} />
        <p className="text-slate-400 mt-4 font-bold text-sm uppercase tracking-widest">Loading Digital Menu...</p>
      </div>
    );
  }

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Check size={36} />
        </div>
        <h1 className="text-2xl font-black mb-3">Order Request Sent!</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-8">
          Your order has been sent to our kitchen team. Staff will verify and approve your request shortly. Sit back and relax!
        </p>
        <button 
          onClick={() => setOrderSubmitted(false)}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
        >
          View Menu Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24 relative select-none">
      {/* Top Brand Header */}
      <div className="p-6 bg-slate-900 border-b border-white/5 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-lg font-black tracking-wider uppercase text-orange-500">JUDE'S KITCHEN</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digital QR Menu</p>
        </div>
        <div className="flex items-center gap-3">
          {tableName && (
            <span className="px-3 py-1 bg-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-black rounded-lg uppercase">
              Table: {tableName}
            </span>
          )}
          <button 
            onClick={() => setIsCartOpen(true)}
            className="p-3 bg-white/5 border border-white/10 rounded-2xl relative"
          >
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Slider */}
      <div className="flex gap-2 overflow-x-auto p-4 scrollbar-hide border-b border-white/5 sticky top-[73px] bg-slate-950/80 backdrop-blur z-20">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              selectedCategoryId === cat.id 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu List */}
      <div className="p-4 space-y-4 max-w-xl mx-auto">
        {filteredProducts.map(prod => (
          <div 
            key={prod.id}
            onClick={() => handleProductSelect(prod)}
            className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl flex justify-between items-center cursor-pointer transition-all active:scale-[0.99] group"
          >
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${prod.foodType === 'NON-VEG' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">{prod.foodType || 'VEG'}</span>
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-orange-400 transition-colors">{prod.name}</h3>
              <p className="text-xs text-slate-400 mt-1">₹{prod.sellingPrice}</p>
            </div>
            
            <button className="px-4 py-2 bg-orange-600/10 hover:bg-orange-600 border border-orange-500/20 text-orange-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all">
              ADD
            </button>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="p-12 text-center text-slate-500 italic">No dishes in this category.</div>
        )}
      </div>

      {/* Touch-Friendly Customizer Modal */}
      {customizingProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center p-0">
          <div className="bg-slate-900 w-full max-w-md rounded-t-[2.5rem] border-t border-white/10 p-6 space-y-6 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Customize Dish</span>
                <h3 className="text-xl font-black text-white mt-1">{customizingProduct.name}</h3>
              </div>
              <button 
                onClick={() => setCustomizingProduct(null)}
                className="p-1.5 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Variants Option */}
            {parseJsonField(customizingProduct.variants).length > 0 && (
              <div>
                <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Choose portion variant</p>
                <div className="grid grid-cols-2 gap-2">
                  {parseJsonField(customizingProduct.variants).map((v: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedVariant(v)}
                      className={`p-3 rounded-xl font-bold text-xs uppercase tracking-wide border transition-all ${
                        selectedVariant?.name === v.name
                          ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {v.name} (+₹{v.price})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modifiers Option */}
            {parseJsonField(customizingProduct.addons).length > 0 && (
              <div>
                <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Select modifiers / add-ons</p>
                <div className="space-y-2">
                  {parseJsonField(customizingProduct.addons).map((addon: any, i: number) => {
                    const isSelected = selectedModifiers.some(m => m.name === addon.name);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleModifier(addon)}
                        className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wide">{addon.name}</span>
                        <span className="text-xs font-black">₹{addon.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Item Custom Instructions */}
            <div>
              <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Cooking Instructions</p>
              <input 
                placeholder="e.g. Make it extra spicy, no onions"
                className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors"
                value={itemNotes}
                onChange={e => setItemNotes(e.target.value)}
              />
            </div>

            {/* Quantity Selection and Checkout Action */}
            <div className="flex gap-4 items-center pt-4 border-t border-white/5">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <button onClick={() => setCustomizationQty(Math.max(1, customizationQty - 1))} className="text-slate-400 hover:text-white">-</button>
                <span className="font-bold text-sm w-4 text-center">{customizationQty}</span>
                <button onClick={() => setCustomizationQty(customizationQty + 1)} className="text-slate-400 hover:text-white">+</button>
              </div>
              <button 
                onClick={addCustomizedToCart}
                className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-orange-600/20"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating View Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-orange-600 hover:bg-orange-500 p-4 rounded-2xl flex justify-between items-center shadow-2xl transition-all hover:scale-[1.02] active:scale-95 text-white"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900/30 rounded-lg">
                <ShoppingCart size={18} />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-200">View Basket</p>
                <p className="font-bold text-sm">{cart.reduce((s, c) => s + c.quantity, 0)} Items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-widest text-orange-200">Total</p>
              <p className="font-black text-lg">₹{getSubtotal().toFixed(2)}</p>
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer / Place Order Request Panel */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center p-0">
          <div className="bg-slate-900 w-full max-w-md rounded-t-[2.5rem] border-t border-white/10 p-6 space-y-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white">Your Order Basket</h3>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-xl border border-white/5">
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-white text-sm">
                      {item.name}
                      {item.selectedVariant && <span className="text-[10px] text-orange-400 ml-2 uppercase">({item.selectedVariant.name})</span>}
                    </p>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        + {item.selectedModifiers.map((m: any) => m.name).join(', ')}
                      </p>
                    )}
                    {item.notes && <p className="text-[10px] text-orange-400 italic mt-0.5">* "{item.notes}"</p>}
                    <p className="text-xs text-slate-400 mt-1">₹{item.sellingPrice} each</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateCartQty(i, -1)} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 text-xs">-</button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartQty(i, 1)} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 text-xs">+</button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-slate-500 italic py-6">Your basket is empty. Add dishes from menu.</div>
              )}
            </div>

            {/* Order details configuration */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType('Dine-in')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                    orderType === 'Dine-in'
                      ? 'bg-orange-600 border-orange-500 text-white'
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                >
                  Dine-in / Table
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('Takeaway')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                    orderType === 'Takeaway'
                      ? 'bg-orange-600 border-orange-500 text-white'
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                >
                  Takeaway Request
                </button>
              </div>

              {orderType === 'Dine-in' && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Enter Table Number</label>
                  <input 
                    required
                    placeholder="e.g. T01, T05"
                    className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors"
                    value={tableName}
                    onChange={e => setTableName(e.target.value.toUpperCase())}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Your Name</label>
                <input 
                  required
                  placeholder="e.g. John Doe"
                  className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Mobile Number (Optional)</label>
                <input 
                  type="tel"
                  placeholder="e.g. 9876543210"
                  className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Special Order Instruction</label>
                <input 
                  placeholder="e.g. Bring water bottles"
                  className="w-full p-3 bg-white/5 border border-white/5 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors"
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                />
              </div>
            </div>

            {/* Total & Submit Button */}
            <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
              <div className="flex justify-between items-center font-black">
                <span className="text-slate-400 text-sm">TOTAL AMOUNT</span>
                <span className="text-xl text-orange-500">₹{getSubtotal().toFixed(2)}</span>
              </div>
              <button 
                onClick={submitOrderRequest}
                disabled={submitting || cart.length === 0}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Submitting request...' : 'Submit Order Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRMenu;
