import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, UserCheck } from 'lucide-react';
import api from '../api/api';
import { offlineDB } from '../utils/offlineDB';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  creditBalance: number;
}

const CustomerSelectionModal = ({ onClose, onSelect }: { onClose: () => void, onSelect: (c: Customer) => void }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    try {
      // 1. Try Online first
      if (navigator.onLine) {
        const res = await api.get(`/customers?search=${search}&activeOnly=true`);
        setCustomers(res.data);
        
        // Cache full list for offline (only if not searching, to avoid partial caches)
        if (!search) {
          for (const c of res.data) {
            await offlineDB.put('customers', c);
          }
        }
      } else {
        // 2. Fallback to Offline
        const allLocal = await offlineDB.getAll('customers');
        let filtered = allLocal;
        if (search) {
          const s = search.toLowerCase();
          filtered = allLocal.filter(c => 
            c.name.toLowerCase().includes(s) || (c.phone && c.phone.includes(s))
          );
        }
        setCustomers(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch customers', error);
      // Last resort fallback
      const allLocal = await offlineDB.getAll('customers');
      setCustomers(allLocal);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/customers', newCustomer);
      onSelect(res.data);
    } catch (error) {
      alert('Error creating customer');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {isCreating ? 'Create New Customer' : 'Select Customer'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {isCreating ? (
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-slate-600 font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium shadow-md shadow-brand-500/20">Create & Select</button>
              </div>
            </form>
          ) : (
            <>
              <div className="relative mb-4 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search name or phone..."
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button onClick={() => setIsCreating(true)} className="p-2.5 bg-brand-100 text-brand-600 rounded-xl hover:bg-brand-200">
                  <UserPlus size={20} />
                </button>
              </div>

              <div className="space-y-2">
                {customers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c)}
                    className="w-full flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-brand-300 hover:bg-brand-50/50 transition-colors text-left group"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-sm text-slate-500">{c.phone || 'No phone'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full inline-block">
                        {c.loyaltyPoints} pts
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Cr: ₹{c.creditBalance.toFixed(2)}
                      </div>
                    </div>
                  </button>
                ))}
                {customers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">No customers found</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSelectionModal;
