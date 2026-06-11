import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, QrCode, CreditCard, Banknote, User, Gift, Plus, BadgePercent } from 'lucide-react';
import NumericKeypad from '../components/NumericKeypad';
import usePOSStore from '../store/posStore';
import useRestaurantStore from '../store/restaurantStore';
import CustomerSelectionModal from './CustomerSelectionModal';
import RedeemPointsModal from './RedeemPointsModal';

interface PaymentModalProps {
  onPaymentComplete: (method: string, amount: string, orderType: string) => Promise<void>;
  onClose: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ onPaymentComplete, onClose }) => {
  const { cart, customer, setCustomer, getTotals, loyaltyPointsRedeemed, appliedPoints, setLoyaltyDiscount, setManualDiscount } = usePOSStore();
  const { settings } = useRestaurantStore();
  const { subtotal, taxTotal, grandTotal, roundedTotal, loyaltyDiscount, manualDiscount } = getTotals();

  const maxDiscountPercent = settings?.maxDiscountPercent ?? 10;
  
  const [amountPaid, setAmountPaid] = useState(roundedTotal.toString());
  const [isAmountCustom, setIsAmountCustom] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [orderType, setOrderType] = useState('Walk-in'); // Order Type State
  const [loading, setLoading] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  // Smarter Sync: Auto-update if total changes (e.g. loyalty points applied)
  useEffect(() => {
    if (!isAmountCustom) {
      setAmountPaid(roundedTotal.toString());
    }
  }, [roundedTotal, isAmountCustom]);

  // Hardware Keyboard Support
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!loading) {
          submitPayment();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [amountPaid, loading]);

  const isCreditMode = paymentMethod === 'CREDIT';
  const numAmount = parseFloat(amountPaid) || 0;
  const change = numAmount - roundedTotal;
  const isAmountInsufficient = !isCreditMode && numAmount < roundedTotal;

  const submitPayment = async () => {
    if (loading) return;
    
    if (isAmountInsufficient) {
      alert("Amount does not match! For partial payments, please use 'Credit' mode.");
      return;
    }

    if (isCreditMode && !customer) {
      alert('Credit sales are only allowed for registered customers. Please select or add a customer first.');
      setIsCustomerModalOpen(true);
      return;
    }

    if (isCreditMode && numAmount < roundedTotal && !window.confirm(`You are processing a Credit Sale of ₹${Math.abs(change).toFixed(2)}. Proceed?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await onPaymentComplete(paymentMethod, amountPaid, orderType);
    } catch (err) {
      console.error('Payment Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadInput = (val: string) => {
    setAmountPaid((prev: string) => {
      // Clear on first edit or if zero
      if (!isAmountCustom || prev === '0') {
        setIsAmountCustom(true);
        return val;
      }
      return prev + val;
    });
  };

  const handleKeypadDelete = () => {
    setIsAmountCustom(true);
    setAmountPaid((prev: string) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleKeypadClear = () => {
    setIsAmountCustom(false); // Reset to auto-sync
    setAmountPaid(roundedTotal.toString());
  };



  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh] md:h-[700px] md:max-h-[95vh] animate-in zoom-in-95 duration-200">
        {/* Left Side: Summary & Options */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col gap-4 md:gap-5 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 md:overflow-y-auto md:custom-scrollbar">
          <div className="flex justify-between items-center shrink-0">
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Checkout</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X size={24} className="text-slate-500" />
            </button>
          </div>

          {/* Customer & Loyalty Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-1.5">
              <User size={12} className="text-brand-500" />
              Customer & Loyalty
            </h3>
            {customer ? (
              <div className="flex justify-between items-center bg-brand-50 p-3 rounded-xl border border-brand-100">
                <div>
                  <div className="font-bold text-slate-800">{customer.name}</div>
                  <div className="text-xs text-slate-500 font-medium">Available Pts: <span className="text-brand-600 font-bold">{customer.loyaltyPoints}</span></div>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => setIsRedeemModalOpen(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${appliedPoints > 0 ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-500/20'}`}
                   >
                     <Gift size={14} />
                     {appliedPoints > 0 ? `${appliedPoints} Pts Applied` : 'Redeem Points'}
                   </button>
                   <button onClick={() => { setCustomer(null); setLoyaltyDiscount(0, 0); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                    <X size={18} />
                   </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Select Customer for Loyalty
              </button>
            )}
          </div>

          <div className="bg-brand-600 p-6 rounded-3xl text-white shadow-xl shadow-brand-500/20 flex justify-between items-end">
            <div>
               <p className="text-brand-100 font-bold text-xs uppercase tracking-widest mb-1">Final Amount Due</p>
               <p className="text-5xl font-black tracking-tight">₹{roundedTotal.toFixed(2)}</p>
               {grandTotal !== roundedTotal && <p className="text-brand-200 text-[10px] font-bold italic mt-1">Unrounded: ₹{grandTotal.toFixed(2)}</p>}
            </div>
            <div className="text-right">
               <p className="text-brand-200 text-[10px] font-bold uppercase mb-1">Items: {cart.length}</p>
               {loyaltyDiscount > 0 && (
                 <p className="text-emerald-300 font-bold text-xs mb-0.5">Pts Discount: -₹{loyaltyDiscount.toFixed(2)}</p>
               )}
               {manualDiscount > 0 && (
                 <p className="text-orange-300 font-bold text-xs">Extra Disc: -₹{manualDiscount.toFixed(2)}</p>
               )}
            </div>
          </div>

          {/* Manual Discount Section */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                 <BadgePercent size={18} />
               </div>
               <div>
                  <span className="text-sm font-bold text-slate-800 block leading-tight">Apply Extra Disc.</span>
                  <span className="text-[10px] text-slate-400 font-bold block">Limit {maxDiscountPercent}% (₹{Math.floor((subtotal + taxTotal) * (maxDiscountPercent / 100))})</span>
               </div>
            </div>
            <div className="relative">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</div>
               <input 
                 type="number"
                 className="w-28 text-right bg-slate-50 border border-slate-200 rounded-xl py-2 pr-3 pl-8 font-black text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all shadow-inner"
                 value={manualDiscount || ''}
                 placeholder="0.00"
                 onChange={(e) => {
                   let val = parseFloat(e.target.value) || 0;
                   const absoluteMax = Math.floor((subtotal + taxTotal) * (maxDiscountPercent / 100));
                   if (val > absoluteMax) {
                     alert(`Max custom discount allowed is ${maxDiscountPercent}% of subtotal (₹${absoluteMax}).`);
                     val = absoluteMax;
                   } else if (val < 0) {
                     val = 0;
                   }
                   setManualDiscount(val);
                 }}
               />
            </div>
          </div>

          {/* Order Type Section */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Order Type</h3>
            <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <button
                onClick={() => setOrderType('Walk-in')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${orderType === 'Walk-in' ? 'bg-white text-brand-600 border border-brand-100' : 'bg-transparent text-slate-400 hover:text-slate-600 shadow-none border border-transparent'}`}
              >Walk-in</button>
              <button
                onClick={() => setOrderType('Delivery')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${orderType === 'Delivery' ? 'bg-white text-orange-600 border border-orange-100' : 'bg-transparent text-slate-400 hover:text-slate-600 shadow-none border border-transparent'}`}
              >Delivery</button>
            </div>
          </div>

          <div className="space-y-3">
             <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Payment Method</h3>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'CASH' ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'}`}
                >
                  <Banknote size={24} />
                  <span className="font-bold text-sm">Cash</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'UPI' ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'}`}
                >
                  <QrCode size={24} />
                  <span className="font-bold text-sm">UPI / QR</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'CARD' ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'}`}
                >
                  <CreditCard size={24} />
                  <span className="font-bold text-sm">Card</span>
                </button>
                <button 
                  onClick={() => {
                    setPaymentMethod('CREDIT');
                    setAmountPaid('0');
                    setIsAmountCustom(true);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'CREDIT' ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'}`}
                >
                  <User size={24} />
                  <span className="font-bold text-sm">Credit</span>
                </button>
             </div>
          </div>
        </div>

        {/* Right Side: Numeric Keypad & Footer */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col gap-6 md:gap-8 bg-white md:overflow-y-auto">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Amount Paid (₹)</label>
            <div className={`p-4 rounded-3xl border-2 flex items-center justify-between transition-all ${isAmountCustom ? 'border-orange-500 bg-orange-50/30' : 'border-slate-100 bg-slate-50'}`}>
               <span className="text-4xl md:text-5xl font-black text-slate-800">₹{amountPaid}</span>
               <div className="text-right">
                  <p className={`text-[10px] font-bold uppercase leading-none mb-1 ${change < 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                    {isAmountInsufficient ? 'Incomplete' : (change >= 0 ? 'Change' : 'Owed (Credit)')}
                  </p>
                  <p className={`text-xl md:text-2xl font-black ${isAmountInsufficient ? 'text-red-500' : (change >= 0 ? 'text-emerald-600' : 'text-orange-500')}`}>
                    {isAmountInsufficient ? 'Invalid' : `₹${Math.abs(change).toFixed(2)}`}
                  </p>
               </div>
            </div>
            {isAmountInsufficient && <p className="text-[10px] text-red-500 font-bold text-center mt-1 animate-pulse italic">Amount does not match!</p>}
            {!isAmountInsufficient && !isAmountCustom && <p className="text-[10px] text-brand-500 font-bold text-center mt-1 italic animate-pulse">Synced with Net Total</p>}
          </div>

          <div className="flex-1">
            <NumericKeypad 
              onInput={handleKeypadInput}
              onClear={handleKeypadClear}
              onDelete={handleKeypadDelete}
              onConfirm={submitPayment}
            />
          </div>

          <button 
            disabled={loading || isAmountInsufficient}
            onClick={submitPayment}
            className={`w-full h-16 md:h-20 rounded-3xl font-black text-xl flex flex-col items-center justify-center gap-1 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 ${isAmountInsufficient ? 'bg-slate-300' : 'bg-emerald-600 ring-4 ring-emerald-100 hover:bg-emerald-700 text-white'}`}
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <div className={`flex items-center gap-3 ${isAmountInsufficient ? 'text-slate-500' : 'text-white'}`}>
                  {isAmountInsufficient ? <X size={24} /> : <CheckCircle2 size={24} />}
                  <span>{isAmountInsufficient ? 'INSUFFICIENT AMOUNT' : 'PROCESS CHECKOUT'}</span>
                </div>
              </>
            )}
          </button>
        </div>
      </div>

      {isCustomerModalOpen && (
        <CustomerSelectionModal 
          onClose={() => setIsCustomerModalOpen(false)}
          onSelect={(c) => { setCustomer(c); setIsCustomerModalOpen(false); }}
        />
      )}

      {isRedeemModalOpen && (
        <RedeemPointsModal 
          onClose={() => setIsRedeemModalOpen(false)}
        />
      )}
    </div>
  );
};

export default PaymentModal;
