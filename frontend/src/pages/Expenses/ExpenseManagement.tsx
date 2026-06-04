import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { Wallet, Plus, Calendar, Tag, CreditCard, Edit, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import { exportUtils } from '../../utils/exportUtils';

const ExpenseManagement = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: 'GENERAL',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await api.get('/expenses');
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    const fetchCategories = async () => {
      try {
        const response = await api.get('/expense-categories');
        setCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleSaveExpense = async () => {
    if (!formData.amount || !formData.type) return alert('Please fill in amount and category');
    
    try {
      setLoading(true);
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString()
      };

      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
      } else {
        await api.post('/expenses', payload);
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        type: 'GENERAL',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchExpenses();
      alert(`Expense ${editingId ? 'updated' : 'recorded'} successfully!`);
    } catch (error: any) {
      alert('Error saving expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (expense: any) => {
    setEditingId(expense.id);
    setFormData({
      type: expense.type,
      amount: expense.amount.toString(),
      description: expense.description || '',
      date: new Date(expense.date).toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      setLoading(true);
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
      alert('Expense deleted successfully!');
    } catch (error: any) {
      alert('Error deleting expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'PDF' | 'CSV') => {
    if (!expenses.length) return;

    const filename = `Expenses_${new Date().toISOString().split('T')[0]}`;
    const headers = ['Date', 'Category', 'Description', 'Amount'];
    const data = expenses.map(exp => [
      new Date(exp.date).toLocaleDateString(),
      exp.type,
      exp.description || '-',
      `Rs.${exp.amount.toFixed(2)}`
    ]);

    if (format === 'CSV') {
      const csvData = expenses.map(exp => ({
        Date: new Date(exp.date).toLocaleDateString(),
        Category: exp.type,
        Description: exp.description || '-',
        Amount: exp.amount
      }));
      exportUtils.exportToCSV(csvData, filename);
    } else {
      exportUtils.exportToPDF({ 
        title: 'Expense Management Report', 
        headers, 
        data, 
        filename 
      });
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expense Tracker</h1>
            <p className="text-slate-500 font-medium">Monitor your shop's recurring and one-time expenses.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 mr-2 shadow-sm">
                <button 
                onClick={() => handleExport('CSV')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                <FileSpreadsheet size={16} /> CSV
                </button>
                <button 
                onClick={() => handleExport('PDF')}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-100 transition-all border border-red-100"
                >
                <FileText size={16} /> PDF
                </button>
            </div>
            <button 
                onClick={() => {
                setEditingId(null);
                setFormData({
                    type: 'GENERAL',
                    amount: '',
                    description: '',
                    date: new Date().toISOString().split('T')[0]
                });
                setIsModalOpen(true);
                }}
                className="bg-red-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-xl shadow-red-500/10 active:scale-95"
            >
                <Plus size={20} />
                <span>Add Expense</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Category</th>
                <th className="px-8 py-4">Description</th>
                <th className="px-8 py-4 text-right">Amount</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && expenses.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-20 animate-pulse text-slate-400">Loading expenses...</td></tr>
              ) : expenses.length > 0 ? (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-4 flex items-center gap-3 text-slate-600">
                      <Calendar size={16} className="text-slate-300" />
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-4">
                      <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-500">
                        {expense.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-slate-800 font-medium">{expense.description}</td>
                    <td className="px-8 py-4 text-right font-black text-red-500">₹{expense.amount.toFixed(2)}</td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditClick(expense)}
                          className="p-2 text-slate-400 hover:text-brand-600 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Wallet size={48} className="mx-auto text-slate-100 mb-4" />
                    <p className="text-slate-400 font-bold">No expenses recorded yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {editingId ? 'Edit Expense' : 'New Expense'}
              </h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                }} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                CANCEL
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">Category</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 appearance-none"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="GENERAL">General</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  {/* Ensure existing legacy categories still show up when editing */}
                  {formData.type && formData.type !== 'GENERAL' && !categories.some(c => c.name === formData.type) && (
                    <option value={formData.type}>{formData.type}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">Description</label>
                <input 
                  type="text" 
                  placeholder="What was this for?" 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">Amount (₹)</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">Date</label>
                  <input 
                    type="date" 
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={handleSaveExpense}
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-2xl font-black shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4 h-[64px]"
              >
                {loading ? 'SAVING...' : (editingId ? 'UPDATE EXPENSE' : 'RECORD EXPENSE')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagement;
