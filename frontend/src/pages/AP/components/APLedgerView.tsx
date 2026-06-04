import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Calendar, Wallet, ShoppingBag, ArrowDownLeft, ChevronDown, CheckCircle2, AlertCircle, Clock, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import { exportUtils } from '../../../utils/exportUtils';
import api from '../../../api/api';

const APLedgerView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        fetchLedger();
    }, [id]);

    const fetchLedger = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/ap/ledger/${id}`);
            setData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (format: 'PDF' | 'CSV') => {
        if (!data || !data.ledger.length) return;

        const filename = `Ledger_${data.supplierInfo.name}_${new Date().toISOString().split('T')[0]}`;
        const headers = ['Date', 'Reference', 'Type', 'Amount', 'Balance'];
        const rows = data.ledger.map((tx: any) => [
            new Date(tx.date).toLocaleDateString(),
            tx.reference,
            tx.type,
            `Rs.${tx.amount.toLocaleString()}`,
            `Rs.${tx.runningBalance.toLocaleString()}`
        ]);

        if (format === 'CSV') {
            const csvData = data.ledger.map((tx: any) => ({
                Date: new Date(tx.date).toLocaleDateString(),
                Reference: tx.reference,
                Type: tx.type,
                Amount: tx.amount,
                Balance: tx.runningBalance
            }));
            exportUtils.exportToCSV(csvData, filename);
        } else {
            exportUtils.exportToPDF({
                title: `Ledger Statement: ${data.supplierInfo.name}`,
                headers,
                data: rows,
                filename
            });
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin text-brand-500"><Clock size={48} /></div>
        </div>
    );

    if (!data) return <div className="p-20 text-center font-black text-slate-300">Ledger data not found.</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* 🏷️ Sticky Header */}
            <div className="bg-slate-900 sticky top-0 z-[60] shadow-2xl">
                <div className="max-w-4xl mx-auto p-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button onClick={() => navigate(-1)} className="p-3 bg-white/5 text-white/50 hover:text-white rounded-2xl transition-all">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-white leading-none mb-1">{data.supplierInfo.name}</h1>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Interactive Party Ledger</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10 hidden md:flex">
                            <button 
                                onClick={() => handleExport('CSV')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-white/70 rounded-lg font-black text-[10px] hover:bg-white/10 transition-all uppercase"
                            >
                                <FileSpreadsheet size={14} /> CSV
                            </button>
                            <button 
                                onClick={() => handleExport('PDF')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-white/70 rounded-lg font-black text-[10px] hover:bg-white/10 transition-all uppercase"
                            >
                                <FileText size={14} /> PDF
                            </button>
                        </div>
                        <div className="h-8 w-px bg-white/10 hidden md:block"></div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Net Balance</p>
                            <p className={`text-2xl font-black ${data.supplierInfo.currentBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                ₹{Math.abs(data.supplierInfo.currentBalance).toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 mt-8">
                {/* 🏁 Opening Balance Card */}
                <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 mb-12 flex items-center justify-between shadow-xl shadow-slate-900/5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Opening Balance</p>
                            <p className="text-sm font-bold text-slate-500 italic">Financial Carry-forward</p>
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-400">₹{data.supplierInfo.openingBalance.toLocaleString()}</p>
                </div>

                {/* 📜 Timeline Feed */}
                <div className="relative space-y-8">
                    {/* Vertical Line */}
                    <div className="absolute left-[27px] top-4 bottom-4 w-1 bg-slate-200/50 rounded-full"></div>

                    {data.ledger.map((tx: any, idx: number) => (
                        <div key={idx} className="relative pl-16 group">
                            {/* Dot */}
                            <div className={`absolute left-4 top-2 w-7 h-7 rounded-full border-4 border-slate-50 flex items-center justify-center z-10 transition-all group-hover:scale-125 ${
                                tx.type === 'PURCHASE' ? 'bg-slate-900' : 'bg-emerald-500'
                            }`}>
                                {tx.type === 'PURCHASE' ? <ShoppingBag size={12} className="text-white"/> : <ArrowDownLeft size={12} className="text-white"/>}
                            </div>

                            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 hover:border-brand-500 transition-all shadow-lg shadow-slate-900/5">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                tx.type === 'PURCHASE' ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                                {tx.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{tx.reference}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Calendar size={14} />
                                            <span className="text-xs font-bold">{new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="text-right">
                                            <p className={`text-2xl font-black ${tx.amount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {tx.amount > 0 ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Bal: ₹{tx.runningBalance.toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={async () => {
                                                if (!window.confirm(`Permanently delete this ${tx.type === 'PURCHASE' ? 'PURCHASE (and reverse stock)' : 'SETTLEMENT'}?`)) return;
                                                try {
                                                    const url = tx.type === 'PURCHASE' ? `/ap/purchase/${tx.id}` : `/ap/payment/${tx.id}`;
                                                    await api.delete(url);
                                                    fetchLedger();
                                                } catch (e) { alert('Delete failed'); }
                                            }}
                                            className="p-3 bg-red-50 text-red-300 hover:text-red-500 rounded-2xl transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {tx.items && (
                                    <div className="bg-slate-50/50 rounded-2xl p-4 space-y-2">
                                        {tx.items.map((i: any, kidx: number) => (
                                            <div key={kidx} className="flex justify-between text-[11px] font-bold text-slate-500">
                                                <span>{i.product.name} ({i.quantity} Nos)</span>
                                                <span>₹{i.total.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {tx.method && (
                                    <div className="flex items-center gap-2 text-[11px] font-black text-emerald-600 uppercase mt-4">
                                        <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                                        Settled via {tx.method}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 🏁 Final Balance Status */}
                <div className="mt-16 text-center">
                    <div className="w-16 h-16 bg-white border-2 border-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-slate-300">
                        {data.supplierInfo.currentBalance <= 0 ? <CheckCircle2 size={32} className="text-emerald-500" /> : <AlertCircle size={32} className="text-slate-200" />}
                    </div>
                    <h3 className="text-xl font-black text-slate-800">
                        {data.supplierInfo.currentBalance <= 0 ? 'Account Cleared' : 'Outstanding Obligation'}
                    </h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto mt-2">All transactions up to {new Date().toLocaleDateString()} have been reconciled.</p>
                </div>
            </div>
        </div>
    );
};

export default APLedgerView;
