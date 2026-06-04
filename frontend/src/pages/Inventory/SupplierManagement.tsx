import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { Truck, Plus, Phone, Mail, FileText, Search, X, Loader2, Edit3, Trash2, Filter, ChevronRight, IndianRupee, MapPin, FileSpreadsheet, Download } from 'lucide-react';
import { exportUtils } from '../../utils/exportUtils';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstNo: string | null;
  address: string | null;
  openingBalance: number;
  is_active: boolean;
}

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    gstNo: '',
    address: '',
    openingBalance: 0
  });

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (id: string) => {
    setLoadingModal(true);
    setIsLedgerModalOpen(true);
    try {
      const response = await api.get(`/suppliers/${id}/ledger`);
      setLedgerData(response.data);
    } catch (error: any) {
      alert('Error fetching ledger: ' + (error.response?.data?.error || error.message));
      setIsLedgerModalOpen(false);
    } finally {
      setLoadingModal(false);
    }
  };

  const fetchHistory = async (id: string) => {
    setLoadingModal(true);
    setIsHistoryModalOpen(true);
    try {
      const response = await api.get(`/suppliers/${id}/history`);
      setHistoryData(response.data);
    } catch (error: any) {
      alert('Error fetching history: ' + (error.response?.data?.error || error.message));
      setIsHistoryModalOpen(false);
    } finally {
      setLoadingModal(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenModal = (supplier: Supplier | null = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || '',
        gstNo: supplier.gstNo || '',
        address: supplier.address || '',
        openingBalance: supplier.openingBalance
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        gstNo: '',
        address: '',
        openingBalance: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, {
            ...formData,
            openingBalance: Number(formData.openingBalance)
        });
      } else {
        await api.post('/suppliers', {
            ...formData,
            openingBalance: Number(formData.openingBalance)
        });
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error: any) {
       alert('Error saving supplier: ' + (error.response?.data?.error || error.message));
    } finally {
       setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
     if(!confirm('Are you sure you want to delete this supplier?')) return;
     try {
        await api.delete(`/suppliers/${id}`);
        fetchSuppliers();
     } catch (err: any) {
        alert(err.response?.data?.error || 'Could not delete supplier');
     }
  };

  const handleExportSuppliers = (format: 'PDF' | 'CSV') => {
    if (!suppliers.length) return;
    const filename = `Suppliers_${new Date().toISOString().split('T')[0]}`;
    const headers = ['Name', 'Phone', 'GST No', 'Balance'];
    const data = suppliers.map(s => [s.name, s.phone || '-', s.gstNo || '-', `Rs.${s.openingBalance.toLocaleString()}`]);

    if (format === 'CSV') {
      const csvData = suppliers.map(s => ({ Name: s.name, Phone: s.phone, GST: s.gstNo, Balance: s.openingBalance }));
      exportUtils.exportToCSV(csvData, filename);
    } else {
      exportUtils.exportToPDF({ title: 'Supplier Registry', headers, data, filename });
    }
  };

  const handleExportLedger = (format: 'PDF' | 'CSV') => {
    if (!ledgerData) return;
    const filename = `Ledger_${ledgerData.supplier.name}_${new Date().toISOString().split('T')[0]}`;
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    const data = ledgerData.ledger.map((t: any) => [
      new Date(t.date).toLocaleDateString(),
      t.description,
      t.debit > 0 ? `Rs.${t.debit}` : '-',
      t.credit > 0 ? `Rs.${t.credit}` : '-',
      `Rs.${t.balance}`
    ]);
    exportUtils.exportToPDF({ title: `Ledger: ${ledgerData.supplier.name}`, headers, data, filename });
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.phone && s.phone.includes(searchTerm)) ||
    (s.gstNo && s.gstNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-1">Supplier Network</h1>
            <p className="text-slate-500 font-medium">Manage your sourcing partners and vendor accounts.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                onClick={() => handleExportSuppliers('CSV')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                <FileSpreadsheet size={16} /> CSV
                </button>
                <button 
                onClick={() => handleExportSuppliers('PDF')}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-100 transition-all border border-red-100"
                >
                <FileText size={16} /> PDF
                </button>
            </div>
            <button 
                onClick={() => handleOpenModal()}
                className="bg-slate-900 text-white px-8 py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
            >
                <Plus size={24} strokeWidth={2.5}/>
                <span>Onboard Supplier</span>
            </button>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={20} />
                <input 
                    type="text" 
                    placeholder="Search by vendor name, phone, or GST number..."
                    className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 outline-none transition-all font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {loading && suppliers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="font-bold uppercase tracking-widest text-xs">Syncing Vendor Data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map(supplier => (
              <div key={supplier.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-xl transition-all group overflow-hidden relative">
                <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-slate-50">
                        {supplier.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-800 leading-tight truncate pr-16">{supplier.name}</h3>
                        <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mt-1">Verified Supplier</p>
                    </div>
                    <div className="absolute top-6 right-6 flex gap-2">
                        <button onClick={() => handleOpenModal(supplier)} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"><Edit3 size={18}/></button>
                        <button onClick={() => handleDelete(supplier.id)} className="p-2.5 bg-slate-50 hover:bg-red-50 text-red-500 rounded-xl transition-colors"><Trash2 size={18}/></button>
                    </div>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-4 text-slate-600 text-sm font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                            <Phone size={14} className="text-slate-400" />
                        </div>
                        <span>{supplier.phone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600 text-sm font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                            <MapPin size={14} className="text-slate-400" />
                        </div>
                        <span className="truncate">{supplier.address || 'Address not registered'}</span>
                    </div>
                    {supplier.gstNo && (
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <FileText size={14} className="text-brand-400" />
                        </div>
                        <div className="px-3 py-1 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-black uppercase">GST: {supplier.gstNo}</div>
                      </div>
                    )}
                </div>

                <div className="pt-6 border-t select-none border-slate-100 flex gap-3">
                    <button 
                        onClick={() => fetchLedger(supplier.id)}
                        className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                        Ledger
                    </button>
                    <button 
                        onClick={() => fetchHistory(supplier.id)}
                        className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                    >
                        History
                    </button>
                </div>
              </div>
            ))}
            
            {filteredSuppliers.length === 0 && (
                <div className="col-span-full py-20 text-center">
                    <p className="text-slate-400 font-bold">No suppliers found matching your search.</p>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Initialize / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">{editingSupplier ? 'Modify Vendor' : 'New Supplier'}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sourcing Registry Profile</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl shadow-sm transition-all">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="group">
                             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Supplier / Firm Name *</label>
                             <input 
                                required type="text" placeholder="e.g. FreshProduce Pvt Ltd"
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-brand-500 focus:bg-white outline-none transition-all font-bold text-slate-800"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                             />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="group">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Primary Contact</label>
                                <input 
                                    type="tel" placeholder="+91"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-brand-500 focus:bg-white outline-none transition-all font-bold text-slate-800"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Email Terminal</label>
                                <input 
                                    type="email" placeholder="vendor@info.com"
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-brand-500 focus:bg-white outline-none transition-all font-bold text-slate-800"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="group">
                             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">GST Identification No.</label>
                             <input 
                                type="text" placeholder="27XXXXX0000X1Z5"
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-brand-500 focus:bg-white transition-all font-black uppercase text-sm tracking-widest text-slate-800"
                                value={formData.gstNo}
                                onChange={(e) => setFormData({ ...formData, gstNo: e.target.value })}
                             />
                        </div>

                        <div className="group">
                             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Business Address</label>
                             <textarea 
                                rows={2} placeholder="Warehouse Location"
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-brand-500 focus:bg-white transition-all font-bold text-slate-800"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                             />
                        </div>

                        <div className="group bg-brand-50 p-6 rounded-[2rem] border-2 border-brand-100/50">
                             <label className="block text-[10px] font-black text-brand-500 uppercase tracking-widest mb-3">Opening Payable Balance (₹)</label>
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                    <IndianRupee size={20} className="text-brand-500" />
                                </div>
                                <input 
                                    type="number" placeholder="0.00"
                                    className="flex-1 bg-transparent border-none p-0 text-3xl font-black text-slate-900 placeholder:text-slate-300 focus:ring-0"
                                    value={formData.openingBalance}
                                    onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                                />
                             </div>
                             <p className="text-[10px] font-bold text-brand-400 mt-3 flex items-center gap-2">
                                <ChevronRight size={12} />
                                Positive value means amount you owe to the vendor
                             </p>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">Dismiss</button>
                        <button type="submit" disabled={loading} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-3">
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            <span>{loading ? 'Processing...' : (editingSupplier ? 'Commit Changes' : 'Initialize Partner')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Ledger Modal */}
      {isLedgerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Supplier Ledger</h2>
                        <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mt-1">{ledgerData?.supplier?.name || 'Financial Statement'}</p>
                    </div>
                    <button onClick={() => setIsLedgerModalOpen(false)} className="p-3 hover:bg-white rounded-2xl shadow-sm transition-all border border-slate-100">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {loadingModal ? (
                      <div className="py-20 flex flex-col items-center justify-center text-slate-400 italic">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p className="font-bold">Aggregating Financial Data...</p>
                      </div>
                    ) : ledgerData ? (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current Outstanding</p>
                                <h3 className="text-4xl font-black flex items-center gap-2">
                                    <IndianRupee size={28} className="text-slate-500" />
                                    {ledgerData.summary.currentBalance.toLocaleString('en-IN')}
                                </h3>
                            </div>
                            <div className="p-6 bg-brand-50 rounded-[2rem] border-2 border-brand-100/50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-2">Opening Balance</p>
                                <h3 className="text-4xl font-black text-brand-900 flex items-center gap-2">
                                    <IndianRupee size={28} className="text-brand-200" />
                                    {ledgerData.summary.openingBalance.toLocaleString('en-IN')}
                                </h3>
                            </div>
                        </div>

                        <div className="rounded-[2rem] border-2 border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b-2 border-slate-100">
                                    <tr>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Debit</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Credit</th>
                                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right bg-slate-100/50">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ledgerData.ledger.map((t: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-sm">{t.description}</div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">{t.type} {t.reference && `#${t.reference}`}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-red-500">{t.debit > 0 ? `₹${t.debit.toLocaleString('en-IN')}` : '-'}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-emerald-500">{t.credit > 0 ? `₹${t.credit.toLocaleString('en-IN')}` : '-'}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-slate-900 bg-slate-50/30">₹{t.balance.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 py-10 font-bold italic">No financial history available for this vendor.</p>
                    )}
                </div>
                
                <div className="p-8 bg-slate-50/50 border-t flex justify-end gap-4">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleExportLedger('PDF')}
                            className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100"
                        >
                            PDF Statement
                        </button>
                    </div>
                    <button onClick={() => window.print()} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Print Statement</button>
                    <button onClick={() => setIsLedgerModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all">Close</button>
                </div>
            </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Purchase Fulfillment</h2>
                        <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mt-1">Full Transactional History</p>
                    </div>
                    <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 hover:bg-white rounded-2xl shadow-sm transition-all border border-slate-100">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {loadingModal ? (
                      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p className="font-bold uppercase tracking-widest text-[10px]">Retrieving Order History...</p>
                      </div>
                    ) : historyData.length > 0 ? (
                      <div className="space-y-6">
                        {historyData.map((purchase) => (
                          <div key={purchase.id} className="p-6 border-2 border-slate-100 rounded-[2rem] hover:border-brand-100 transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="text-xl font-black text-slate-900">{purchase.invoiceNo}</h4>
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${purchase.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                            {purchase.paymentStatus}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400">{new Date(purchase.date).toLocaleDateString()} at {new Date(purchase.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">Grand Total</p>
                                    <p className="text-2xl font-black text-slate-900">₹{purchase.grandTotal.toLocaleString('en-IN')}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 rounded-2xl p-4 space-y-2">
                                {purchase.purchaseItems.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-600 tracking-tight flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                            {item.product.name}
                                        </span>
                                        <span className="font-black text-slate-400 bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-100">
                                            {item.quantity} {item.product.unit || 'PCS'} <span className="text-slate-300 ml-2">@ ₹{item.price}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center">
                        <Truck size={48} className="mx-auto text-slate-100 mb-6" />
                        <p className="text-slate-400 font-bold italic">No purchases have been finalized with this vendor yet.</p>
                      </div>
                    )}
                </div>
                
                <div className="p-8 bg-slate-50/50 border-t flex justify-end">
                    <button onClick={() => setIsHistoryModalOpen(false)} className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-slate-900/10">Done</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;
