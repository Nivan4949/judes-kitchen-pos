import React, { useState, useEffect } from 'react';
import { Truck, ArrowUpRight, ArrowDownLeft, Search, Filter, Plus, ChevronRight, Wallet, History, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import api from '../../api/api';
import { useNavigate } from 'react-router-dom';
import APTransactionModal from './components/APTransactionModal';

interface APSummary {
    id: string;
    name: string;
    phone: string;
    balance: number;
    status: 'DUE' | 'ADVANCE' | 'CLEARED';
}

const AccountsPayable = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ summaries: APSummary[]; totalDebt: number }>({ summaries: [], totalDebt: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL, DUE, ADVANCE, CLEARED
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'PURCHASE' | 'PAYMENT_OUT'>('PURCHASE');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ap/summary');
      setSummary(res.data);
    } catch (error) {
      console.error('Error fetching AP summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = summary.summaries.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'ALL' || s.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Modal Integration */}
      <APTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialMode={modalMode}
        onFinish={fetchSummary}
      />

      {/* 💳 Header Section - Premium Glassmorphism */}
      <div className="bg-slate-900 border-b border-slate-800 p-8 pt-12 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
             <Wallet size={180} className="text-brand-400" />
         </div>
         
         <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                   <h1 className="text-3xl font-black text-white tracking-tight mb-2">Accounts Payable</h1>
                   <p className="text-slate-400 font-medium">Manage vendor settlements and credit health</p>
                </div>
                
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2.5rem] flex items-center gap-6 min-w-[320px]">
                   <div className="w-14 h-14 bg-brand-500/20 rounded-2xl flex items-center justify-center text-brand-400 shadow-xl shadow-brand-500/10">
                      <Wallet size={28} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Total Net Payable</p>
                      <p className="text-4xl font-black text-white">₹{summary.totalDebt.toLocaleString('en-IN')}</p>
                   </div>
                </div>
            </div>
         </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* 🔍 Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="relative flex-1 max-w-md group">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search by vendor name..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition-all outline-none"
                />
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border-2 border-slate-100 overflow-x-auto no-scrollbar">
                {['ALL', 'DUE', 'ADVANCE', 'CLEARED'].map(f => (
                    <button 
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>
        </div>

        {/* 📊 Party List - Vertical Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
                Array(6).fill(0).map((_, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 animate-pulse h-48" />
                ))
            ) : filteredSuppliers.map(party => (
                <div 
                    key={party.id} 
                    className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-500/5 transition-all group cursor-pointer relative overflow-hidden"
                    onClick={() => navigate(`/accounts-payable/ledger/${party.id}`)}
                >
                    {/* Status Badge */}
                    <div className="absolute top-0 right-0 mt-8 mr-8">
                        {party.status === 'DUE' && <div className="bg-red-50 text-red-500 p-2 rounded-xl"><AlertCircle size={20} /></div>}
                        {party.status === 'ADVANCE' && <div className="bg-brand-50 text-brand-500 p-2 rounded-xl"><Clock size={20} /></div>}
                        {party.status === 'CLEARED' && <div className="bg-emerald-50 text-emerald-500 p-2 rounded-xl"><CheckCircle2 size={20} /></div>}
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center font-black group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-brand-600 transition-colors text-nowrap truncate max-w-[180px]">{party.name}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{party.phone || 'No Contact Info'}</p>
                        </div>
                    </div>

                    <div className="flex items-end justify-between border-t border-slate-50 pt-6">
                        <div>
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Current Obligation</p>
                           <p className={`text-2xl font-black ${party.balance > 0 ? 'text-red-500' : (party.balance < 0 ? 'text-brand-500' : 'text-emerald-500')}`}>
                              ₹{Math.abs(party.balance).toLocaleString('en-IN')}
                              {party.balance < 0 && <span className="text-[10px] ml-1 uppercase">Cr</span>}
                           </p>
                        </div>
                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-brand-500 group-hover:text-white transition-all">
                            <ChevronRight size={20} />
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {!loading && filteredSuppliers.length === 0 && (
            <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6">
                    <Filter size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">No matching parties found</h3>
                <p className="text-slate-400 font-medium">Try adjusting your search or filters to see results.</p>
            </div>
        )}
      </div>

      {/* ➕ Quick Action FAB */}
      <div className="fixed bottom-10 right-10 flex gap-4">
          <button 
            onClick={() => { setModalMode('PAYMENT_OUT'); setIsModalOpen(true); }}
            className="w-16 h-16 bg-white text-slate-800 rounded-3xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-2 border-slate-100"
          >
              <ArrowDownLeft size={28} className="text-red-500" />
          </button>
          <button 
            onClick={() => { setModalMode('PURCHASE'); setIsModalOpen(true); }}
            className="px-8 py-5 bg-slate-900 text-white rounded-3xl shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all group"
          >
              <Plus size={24} strokeWidth={3} />
              <span className="font-black text-sm uppercase tracking-widest">New Entry</span>
          </button>
      </div>
    </div>
  );
};

export default AccountsPayable;
