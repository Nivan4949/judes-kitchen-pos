import React, { useState } from 'react';
import { X, CheckCircle2, QrCode, CreditCard, Banknote } from 'lucide-react';
import api from '../api/api';

interface CreditSettlementModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

const CreditSettlementModal: React.FC<CreditSettlementModalProps> = ({ order, onClose, onSuccess }) => {
  const [amount, setAmount] = useState(order.balance.toString());
  const [method, setMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);

  const handleSettle = async () => {
    const settleAmount = parseFloat(amount);
    if (isNaN(settleAmount) || settleAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (settleAmount > order.balance + 0.01) { // Small buffer for floating point
      alert(`Settlement amount cannot exceed the balance (₹${order.balance.toFixed(2)}).`);
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/orders/${order.id}/settle-credit`, {
        settleAmount,
        method
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to settle credit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Settle Credit</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="bg-orange-50 p-6 rounded-3xl mb-8 border border-orange-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Outstanding Balance</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.invoiceNo}</span>
            </div>
            <div className="text-4xl font-black text-orange-600">₹{order.balance.toFixed(2)}</div>
            <div className="text-xs text-orange-400 font-bold mt-1">{order.customer?.name}</div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Payment Amount</label>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setMethod('CASH')}
                  className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${method === 'CASH' ? 'border-brand-primary bg-brand-50 text-brand-primary' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                >
                  <Banknote size={20} />
                  <span className="font-bold text-xs">Cash</span>
                </button>
                <button 
                  onClick={() => setMethod('UPI')}
                  className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${method === 'UPI' ? 'border-brand-primary bg-brand-50 text-brand-primary' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                >
                  <QrCode size={20} />
                  <span className="font-bold text-xs">UPI / QR</span>
                </button>
              </div>
            </div>

            <button 
              onClick={handleSettle}
              disabled={loading}
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={24} />
                  <span>Update Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditSettlementModal;
