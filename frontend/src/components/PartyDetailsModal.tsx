import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Award, CreditCard, ShoppingBag, Calendar, ArrowUpRight, Loader2, Edit3, Save, Receipt } from 'lucide-react';
import api from '../api/api';
import BillDetailsModal from './BillDetailsModal';

interface PartyDetailsModalProps {
  partyId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

const PartyDetailsModal: React.FC<PartyDetailsModalProps> = ({ partyId, onClose, onUpdate }) => {
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [selectedBill, setSelectedBill] = useState<{id: string, type: 'SALE' | 'PURCHASE'} | null>(null);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      // Fetch full statement inclusive of history
      const res = await api.get(`/reports/party-statement/${partyId}`);
      setCustomer(res.data);
      setFormData({
        name: res.data.name || '',
        phone: res.data.phone || '',
        email: res.data.email || ''
      });
    } catch (err) {
      console.error('Error fetching party details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [partyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/customers/${partyId}`, formData);
      setIsEditing(false);
      fetchCustomerDetails();
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Failed to update customer details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl flex flex-col items-center">
            <Loader2 className="animate-spin text-brand-600 mb-4" size={40} />
            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Loading Party Protocol...</p>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 md:p-6 overflow-hidden">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900 text-white rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center font-black text-2xl md:text-3xl shadow-xl">
               {customer.name?.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                 <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
                 <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400 hover:text-brand-600'}`}
                 >
                    <Edit3 size={18} />
                 </button>
              </div>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Party Ledger & CRM</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-[1.5rem] transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          {isEditing ? (
            <form onSubmit={handleSave} className="bg-brand-50/50 p-8 rounded-[2.5rem] border border-brand-100 mb-10 space-y-6">
              <h3 className="text-sm font-black text-brand-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Edit3 size={16} /> Edit Profile Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-brand-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Phone Matrix</label>
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-brand-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Digital Mail</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:border-brand-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                 <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 font-black text-xs text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Discard</button>
                 <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-brand-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-brand-700 shadow-lg shadow-brand-600/20"
                 >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Save Protocol
                 </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
               <div className="p-6 md:p-8 rounded-[2rem] bg-slate-900 text-white flex flex-col justify-between group">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Receivable Balance</p>
                    <CreditCard size={18} className="text-slate-600 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <h3 className="text-3xl font-black">₹{customer.creditBalance?.toFixed(0)}</h3>
               </div>
               <div className="p-6 md:p-8 rounded-[2rem] bg-brand-50 border border-brand-100 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Loyalty Points</p>
                    <Award size={18} className="text-brand-400" />
                  </div>
                  <h3 className="text-3xl font-black text-brand-900">{customer.loyaltyPoints}</h3>
               </div>
               <div className="p-6 md:p-8 rounded-[2rem] bg-emerald-50 border border-emerald-100 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Life Spending</p>
                    <ShoppingBag size={18} className="text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-black text-emerald-900">₹{customer.totalSpent?.toFixed(0)}</h3>
               </div>
            </div>
          )}

          <div className="space-y-6">
             <div className="flex items-center justify-between px-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Transaction Journal</h4>
                <div className="flex gap-4 text-[10px] font-black text-slate-400">
                   <div className="flex items-center gap-2"><Phone size={10} /> {customer.phone || 'N/A'}</div>
                   <div className="flex items-center gap-2"><Mail size={10} /> {customer.email || 'N/A'}</div>
                </div>
             </div>

             <div className="space-y-4">
                {customer.orders?.map((order: any, idx: number) => (
                  <div key={order.id} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-brand-500/30 transition-all group">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-brand-600 group-hover:text-white transition-all">
                          <Receipt size={16} />
                        </div>
                        <div>
                          <button 
                            onClick={() => setSelectedBill({ id: order.id, type: 'SALE' })}
                            className="font-black text-slate-800 text-base mb-0.5 hover:text-brand-600 hover:underline text-left block"
                          >
                            {order.invoiceNo}
                          </button>
                          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                            <Calendar size={10}/> {new Date(order.createdAt).toLocaleDateString()} | <span className="text-brand-400">{order.paymentMode}</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8">
                         <div className="text-right">
                            <p className="text-xl font-black text-slate-900">₹{order.grandTotal.toFixed(0)}</p>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">Success</span>
                         </div>
                         <button 
                          onClick={() => setSelectedBill({ id: order.id, type: 'SALE' })}
                          className="p-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-brand-50 hover:text-brand-600 transition-all"
                         >
                            <ArrowUpRight size={18} />
                         </button>
                      </div>
                  </div>
                ))}
                {(!customer.orders || customer.orders.length === 0) && (
                   <div className="py-20 text-center border-4 border-dashed border-slate-50 rounded-[3rem]">
                      <ShoppingBag size={48} className="mx-auto text-slate-100 mb-4" />
                      <p className="text-slate-400 font-black text-xl tracking-tight">No commerce logs detected</p>
                   </div>
                )}
             </div>
          </div>
        </div>

        <div className="p-10 bg-slate-900 text-white/30 text-[10px] font-black uppercase tracking-[0.5em] text-center">
            FreshNaad Global CRM identity layer 4.0 // Secured Ledger
        </div>

        {selectedBill && (
          <BillDetailsModal 
            billId={selectedBill.id}
            type={selectedBill.type}
            onClose={() => setSelectedBill(null)}
            onUpdate={fetchCustomerDetails}
          />
        )}
      </div>
    </div>
  );
};

export default PartyDetailsModal;
