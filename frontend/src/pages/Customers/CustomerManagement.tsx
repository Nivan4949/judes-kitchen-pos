import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { Users, UserPlus, Phone, Mail, Award, CreditCard, Search, X, Loader2, Edit3, Trash2, Filter, ChevronRight, ShoppingBag, Calendar, ArrowUpRight, MoreVertical, FileSpreadsheet, FileText, Coins } from 'lucide-react';
import { exportUtils } from '../../utils/exportUtils';
import CreditSettlementModal from '../../components/CreditSettlementModal';

interface Order {
  id: string;
  invoiceNo: string;
  grandTotal: number;
  paymentMode: string;
  createdAt: string;
  amountPaid: number;
  balance: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  creditBalance: number;
  is_active?: boolean;
  orders?: Order[];
}

const CustomerManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedSettleOrder, setSelectedSettleOrder] = useState<any>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ name: customer.name, phone: customer.phone || '', email: customer.email || '' });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '' });
    }
    setIsModalOpen(true);
  };

  const handleOpenHistory = async (customer: Customer) => {
      setSelectedCustomer(customer);
      setIsHistoryOpen(true);
      try {
          const res = await api.get(`/reports/party-statement/${customer.id}`);
          setSelectedCustomer(res.data);
      } catch (err) {
          console.error('Error fetching history');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error) {
       alert('Error saving customer');
    } finally {
       setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if(!confirm('Are you sure you want to delete this customer?')) return;
     try {
        await api.delete(`/customers/${id}`);
        fetchCustomers();
     } catch (err) {
        alert('Could not delete customer');
     }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.put(`/customers/inactive/${id}`, { is_active: !currentStatus });
      fetchCustomers();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleExportCustomers = (format: 'PDF' | 'CSV') => {
    if (!customers.length) return;
    const filename = `Customers_${new Date().toISOString().split('T')[0]}`;
    const headers = ['Name', 'Phone', 'Points', 'Spent', 'Credit'];
    const data = customers.map(c => [
      c.name, 
      c.phone || '-', 
      c.loyaltyPoints, 
      `Rs.${c.totalSpent.toFixed(0)}`, 
      `Rs.${c.creditBalance.toFixed(0)}`
    ]);

    if (format === 'CSV') {
      const csvData = customers.map(c => ({ Name: c.name, Phone: c.phone, Points: c.loyaltyPoints, Spent: c.totalSpent, Credit: c.creditBalance }));
      exportUtils.exportToCSV(csvData, filename);
    } else {
      exportUtils.exportToPDF({ title: 'Customer Registry', headers, data, filename });
    }
  };

  const handleExportHistory = (format: 'PDF' | 'CSV') => {
    if (!selectedCustomer || !selectedCustomer.orders) return;
    const filename = `History_${selectedCustomer.name}_${new Date().toISOString().split('T')[0]}`;
    const headers = ['Date', 'Invoice', 'Method', 'Amount'];
    const data = selectedCustomer.orders.map(o => [
      new Date(o.createdAt).toLocaleDateString(),
      o.invoiceNo,
      o.paymentMode,
      `Rs.${o.grandTotal.toFixed(0)}`
    ]);
    exportUtils.exportToPDF({ title: `Sale Statement: ${selectedCustomer.name}`, headers, data, filename });
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.is_active !== false).length,
    totalPoints: customers.reduce((acc, curr) => acc + curr.loyaltyPoints, 0),
    totalCredit: customers.reduce((acc, curr) => acc + curr.creditBalance, 0)
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Customer Network</h1>
            <p className="text-slate-500 font-medium text-lg">Manage relationships, loyalty points, and credit history.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                onClick={() => handleExportCustomers('CSV')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                <FileSpreadsheet size={16} /> CSV
                </button>
                <button 
                onClick={() => handleExportCustomers('PDF')}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-100 transition-all border border-red-100"
                >
                <FileText size={16} /> PDF
                </button>
            </div>
            <button 
                onClick={() => handleOpenModal()}
                className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 active:scale-95 group"
            >
                <UserPlus size={24} className="group-hover:rotate-12 transition-transform" />
                <span>Enroll Client</span>
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
                { label: 'Total Clients', value: stats.total, icon: <Users />, color: 'blue' },
                { label: 'Active Now', value: stats.active, icon: <div className="h-2 w-2 bg-green-500 rounded-full animate-ping"></div>, color: 'emerald' },
                { label: 'Network Points', value: stats.totalPoints, icon: <Award />, color: 'orange' },
                { label: 'Owed Credit', value: `₹${stats.totalCredit.toFixed(0)}`, icon: <CreditCard />, color: 'red' },
            ].map((stat, i) => (
                <div key={i} className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow`}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-600">
                            {stat.icon}
                        </div>
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{stat.label}</p>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{stat.value}</p>
                </div>
            ))}
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input 
                    type="text" 
                    placeholder="Search by name, phone number, or ID..."
                    className="w-full pl-16 pr-6 py-5 bg-white border border-slate-200 rounded-3xl focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 outline-none transition-all font-bold text-lg placeholder:text-slate-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button className="px-8 py-5 bg-white border border-slate-200 rounded-3xl text-slate-600 font-black flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs">
                <Filter size={20} />
                <span>Advanced Filters</span>
            </button>
        </div>

        {/* Customer Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading && !isHistoryOpen ? (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-400">
                <Loader2 size={48} className="animate-spin mb-4 text-brand-500" />
                <p className="font-black text-xl tracking-tight">Accessing Neural Database...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <div 
                key={customer.id} 
                className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:border-brand-200 transition-all group relative overflow-hidden cursor-default"
              >
                {/* Floating Action Menu */}
                <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <button 
                        onClick={() => handleOpenModal(customer)}
                        className="p-3 bg-brand-50 text-brand-600 rounded-2xl hover:bg-brand-600 hover:text-white transition-all shadow-lg shadow-brand-500/10"
                    >
                        <Edit3 size={18}/>
                    </button>
                    <button 
                        onClick={(e) => handleDelete(customer.id, e)}
                        className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-500/10"
                    >
                        <Trash2 size={18}/>
                    </button>
                </div>

                <div className="flex items-center gap-8 mb-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[1.75rem] flex items-center justify-center font-black text-3xl shadow-2xl group-hover:scale-110 transition-transform">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{customer.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`h-2 w-2 rounded-full ${customer.is_active !== false ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-slate-300'}`}></span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{customer.is_active !== false ? 'Verified Client' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <Award size={14} className="text-orange-500" />
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Points</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{customer.loyaltyPoints}</p>
                  </div>
                  <div className="bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <CreditCard size={14} className="text-brand-500" />
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Credit</span>
                    </div>
                    <p className={`text-2xl font-black ${customer.creditBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{customer.creditBalance.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-4 text-slate-500 group/item">
                    <div className="p-2 bg-slate-50 rounded-xl group-hover/item:bg-brand-50 group-hover/item:text-brand-600 transition-colors">
                        <Phone size={14} />
                    </div>
                    <span className="text-sm font-bold tracking-tight">{customer.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 group/item">
                    <div className="p-2 bg-slate-50 rounded-xl group-hover/item:bg-brand-50 group-hover/item:text-brand-600 transition-colors">
                        <Mail size={14} />
                    </div>
                    <span className="text-sm font-bold truncate pr-4">{customer.email || 'No email registered'}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => handleOpenHistory(customer)}
                        className="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] tracking-[0.2em] uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 active:scale-95"
                    >
                        Sales History <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button 
                        onClick={(e) => handleToggleActive(customer.id, customer.is_active ?? true, e)}
                        className={`p-5 rounded-[1.5rem] border font-black text-xs transition-all ${
                            customer.is_active !== false ? 'bg-white border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={customer.is_active !== false ? 'Deactivate Account' : 'Activate Account'}
                    >
                        <MoreVertical size={18} />
                    </button>
                </div>
                
                {/* Mobile Quick Settle Button */}
                {customer.creditBalance > 0 && (
                    <button 
                        onClick={() => handleOpenHistory(customer)}
                        className="mt-4 w-full py-4 bg-orange-50 text-orange-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-100 transition-all border border-orange-100"
                    >
                        <Coins size={14} /> Settle ₹{customer.creditBalance.toFixed(0)} Credit
                    </button>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full py-40 text-center bg-white rounded-[4rem] border-8 border-dotted border-slate-50 flex flex-col items-center justify-center">
               <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-10 relative">
                <Users size={64} className="text-slate-100" />
                <div className="absolute inset-0 bg-brand-500/5 rounded-full animate-ping"></div>
               </div>
               <p className="text-slate-900 font-black text-4xl mb-4 tracking-tighter">Database Silent</p>
               <p className="text-slate-400 font-medium text-xl max-w-md mx-auto leading-relaxed">We couldn't find any clients matching that profile. Try refining your search query.</p>
            </div>
          )}
        </div>
      </div>

      {/* Enroll/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 relative">
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full"></div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{editingCustomer ? 'Client Profile' : 'New Enrollment'}</h2>
                        <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">CRM Management Protocol</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white hover:bg-slate-100 rounded-[1.5rem] transition-all border border-slate-100 shadow-sm active:scale-95">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    <div className="space-y-6">
                        <div className="group">
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-3 group-focus-within:text-brand-600 transition-colors">Client Full Identity *</label>
                            <div className="relative">
                                <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    type="text" 
                                    required
                                    placeholder="e.g. Alexander Pierce"
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.75rem] focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 outline-none transition-all font-black text-slate-800 placeholder:text-slate-300"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="group">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-3 group-focus-within:text-brand-600 transition-colors">Contact Matrix</label>
                                <div className="relative">
                                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input 
                                        type="tel" 
                                        placeholder="+91 000 000 0000"
                                        className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.75rem] focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 outline-none transition-all font-black text-slate-800 placeholder:text-slate-300 text-sm"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="group">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-3 group-focus-within:text-brand-600 transition-colors">Digital Mail</label>
                                <div className="relative">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input 
                                        type="email" 
                                        placeholder="client@corporate.com"
                                        className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.75rem] focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 outline-none transition-all font-black text-slate-800 placeholder:text-slate-300 text-sm"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex gap-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 rounded-[1.75rem] transition-all">
                            Abandon
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="flex-[2] bg-slate-900 border-b-4 border-slate-950 hover:bg-slate-800 text-white font-black py-5 rounded-[1.75rem] shadow-2xl transition-all active:translate-y-1 active:border-b-0 flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-[10px]"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (editingCustomer ? 'Update Nexus' : 'Initialize Client')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Sales History Modal */}
      {isHistoryOpen && selectedCustomer && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-12 duration-500">
                  <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50/10 relative">
                     <div className="flex items-center gap-8">
                        <div className="w-24 h-24 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center font-black text-4xl shadow-2xl">
                            {selectedCustomer.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{selectedCustomer.name}</h2>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-2 px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-brand-100">
                                    Member ID: #{selectedCustomer.id.slice(0, 8)}
                                </span>
                                <span className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                    Active Account
                                </span>
                            </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <button 
                            onClick={() => handleExportHistory('PDF')}
                            className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 transition-all border border-red-100"
                        >
                            <FileText size={18} /> Export Statement
                        </button>
                        <button onClick={() => setIsHistoryOpen(false)} className="p-5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-[2rem] transition-all active:scale-90">
                            <X size={28} />
                        </button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                          <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform"><ShoppingBag size={80}/></div>
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Lifetime Revenue</p>
                              <p className="text-4xl font-black">₹{selectedCustomer.totalSpent.toFixed(0)}</p>
                          </div>
                          <div className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Point Equilibrium</p>
                              <div className="flex items-center gap-4">
                                <p className="text-4xl font-black text-slate-800">{selectedCustomer.loyaltyPoints}</p>
                                <Award className="text-orange-500" size={32} />
                              </div>
                          </div>
                          <div className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Transaction Count</p>
                              <p className="text-4xl font-black text-slate-800">{selectedCustomer.orders?.length || 0}</p>
                          </div>
                      </div>

                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-10 pl-2">Master Transaction Journal</h4>
                      
                      {selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                          <div className="space-y-4">
                              {selectedCustomer.orders.map((order, idx) => (
                                  <div key={order.id} className="flex items-center justify-between p-8 bg-white border border-slate-100 rounded-[2rem] hover:border-brand-500/20 hover:shadow-xl hover:shadow-brand-500/5 transition-all group">
                                      <div className="flex items-center gap-8">
                                          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center font-black text-lg group-hover:bg-brand-600 group-hover:text-white transition-all">
                                              {idx + 1}
                                          </div>
                                          <div>
                                              <p className="font-black text-slate-900 text-lg mb-1">{order.invoiceNo}</p>
                                              <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                                  <Calendar size={12}/> {new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                              </p>
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-12">
                                          <div className="text-right">
                                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Method</p>
                                              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{order.paymentMode}</span>
                                          </div>
                                          <div className="text-right min-w-[120px]">
                                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Settlement</p>
                                              <p className="text-xl font-black text-slate-900">₹{order.grandTotal.toFixed(0)}</p>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            {order.balance > 0 && (
                                              <button 
                                                  onClick={() => {
                                                      setSelectedSettleOrder({ ...order, customer: selectedCustomer });
                                                      setIsSettleModalOpen(true);
                                                  }}
                                                  className="p-4 bg-brand-50 text-brand-600 rounded-2xl hover:bg-brand-600 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-2 font-black text-[10px] uppercase"
                                              >
                                                  <Coins size={16}/> Settle
                                              </button>
                                            )}
                                            <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition-all shadow-md active:scale-95">
                                                <ArrowUpRight size={20}/>
                                            </button>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="py-24 text-center border-4 border-dashed border-slate-50 rounded-[3rem]">
                              <ShoppingBag size={64} className="mx-auto text-slate-100 mb-6" />
                              <p className="text-slate-400 font-black text-2xl tracking-tighter">No Recorded Commerce</p>
                              <p className="text-slate-300 mt-2 font-medium">This client has not yet initiated any transactions.</p>
                          </div>
                      )}
                  </div>
                  
                  <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex justify-center">
                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.5em]">FreshNaad • Global CRM Identity Layer • v4.0</p>
                  </div>
              </div>
          </div>
      )}

      {isSettleModalOpen && selectedSettleOrder && (
          <CreditSettlementModal 
              order={selectedSettleOrder}
              onClose={() => {
                  setIsSettleModalOpen(false);
                  setSelectedSettleOrder(null);
              }}
              onSuccess={() => {
                  fetchCustomers();
                  if (selectedCustomer) {
                      handleOpenHistory(selectedCustomer);
                  }
              }}
          />
      )}
    </div>
  );
};

export default CustomerManagement;
