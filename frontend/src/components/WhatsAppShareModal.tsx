import React, { useState } from 'react';
import { X, Phone, User, Search, ArrowRight } from 'lucide-react';
import CustomerSelectionModal from './CustomerSelectionModal';

interface WhatsAppShareModalProps {
  onClose: () => void;
  onProceed: (phoneNumber: string) => void;
  isSending?: boolean;
}

const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({ onClose, onProceed, isSending }) => {
  const [method, setMethod] = useState<'direct' | 'search'>('direct');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  const handleProceed = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }
    onProceed(phoneNumber);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-black text-slate-800 uppercase tracking-tight">Share via WhatsApp</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
            <button 
              onClick={() => setMethod('direct')}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${method === 'direct' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Phone size={14} /> Direct
            </button>
            <button 
              onClick={() => setMethod('search')}
              className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${method === 'search' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <User size={14} /> Customer
            </button>
          </div>

          {method === 'direct' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest pl-1">WhatsApp Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+91</span>
                  <input 
                    type="tel" 
                    placeholder="Enter 10 digit number"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand-500 outline-none font-black text-lg tracking-widest placeholder:text-slate-300 placeholder:font-bold transition-all"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    autoFocus
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={() => setIsCustomerSearchOpen(true)}
                className="w-full p-4 bg-brand-50 border-2 border-brand-100 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 group hover:bg-brand-100 transition-all"
              >
                <div className="w-12 h-12 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-110 transition-transform">
                  <Search size={20} />
                </div>
                <span className="text-sm font-black text-brand-700 uppercase">Search Loyalty Program</span>
              </button>
              
              {phoneNumber && (
                <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase text-green-500 mb-0.5">Selected Customer</p>
                    <p className="font-black text-green-900 tracking-tight">+91 {phoneNumber}</p>
                  </div>
                  <User className="text-green-500" size={20} />
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleProceed}
            disabled={!phoneNumber || phoneNumber.length < 10 || isSending}
            className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
          >
            {isSending ? (
              <>Processing Delivery...</>
            ) : (
              <>Send Receipt <ArrowRight size={18} /></>
            )}
          </button>
        </div>

        {isCustomerSearchOpen && (
          <CustomerSelectionModal 
            onClose={() => setIsCustomerSearchOpen(false)}
            onSelect={(c) => {
              setPhoneNumber(c.phone.replace(/\D/g, '').slice(-10));
              setIsCustomerSearchOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WhatsAppShareModal;
