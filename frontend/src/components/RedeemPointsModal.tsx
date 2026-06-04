import React, { useState } from 'react';
import { Gift, X } from 'lucide-react';
import usePOSStore from '../store/posStore';

const RedeemPointsModal = ({ onClose }: { onClose: () => void }) => {
  const { customer, getTotals, setLoyaltyDiscount } = usePOSStore();
  const { grandTotal: totalBeforeDiscount, loyaltyDiscount } = getTotals();
  const currentTotal = totalBeforeDiscount + loyaltyDiscount; // Get original total before discount
  
  const availablePoints = customer?.loyaltyPoints || 0;
  const maxRedeemablePoints = Math.min(availablePoints, Math.floor(currentTotal * 10)); // Rule: 100 pts = 10 rupees (1 pt = 0.1 rps). Max discount cannot exceed total.
  
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  const handleApply = () => {
    const pts = parseInt(pointsToRedeem) || 0;
    if (pts > 0 && pts <= maxRedeemablePoints) {
      const discountAmount = pts * 0.1; // 100 points = ₹10
      setLoyaltyDiscount(discountAmount, pts);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2 text-brand-600">
            <Gift size={20} />
            <h2 className="text-lg font-bold text-slate-800">Redeem Points</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 flex justify-between items-center">
            <div>
              <div className="text-xs font-semibold text-brand-400 uppercase tracking-wide">Available Points</div>
              <div className="text-2xl font-black text-brand-700">{availablePoints}</div>
            </div>
            <div className="text-right">
               <div className="text-xs text-brand-500 font-medium">= ₹{(availablePoints * 0.1).toFixed(2)} OFF</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Points to Redeem</label>
            <input
              type="number"
              max={maxRedeemablePoints}
              min={0}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 text-lg font-bold text-slate-800"
              value={pointsToRedeem}
              onChange={e => setPointsToRedeem(e.target.value)}
              placeholder={`Max: ${maxRedeemablePoints}`}
            />
            {parseInt(pointsToRedeem) > maxRedeemablePoints && (
              <p className="text-xs text-red-500 mt-1">Exceeds max redeemable points ({maxRedeemablePoints})</p>
            )}
            {parseInt(pointsToRedeem) > 0 && parseInt(pointsToRedeem) <= maxRedeemablePoints && (
              <p className="text-sm text-green-600 font-medium mt-1">
                Discount: ₹{(parseInt(pointsToRedeem) * 0.1).toFixed(2)}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleApply}
              disabled={!pointsToRedeem || parseInt(pointsToRedeem) <= 0 || parseInt(pointsToRedeem) > maxRedeemablePoints}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedeemPointsModal;
