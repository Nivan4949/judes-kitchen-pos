import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, ShoppingBag, Users, Clock, AlertTriangle, ArrowUpRight, RefreshCcw, Smartphone } from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<{
        totalRevenue: number;
        totalOrders: number;
        recentOrders: any[];
        lowStockAlerts: number;
        activeTerminals: number;
        distribution: any[];
        lastSync: string;
    }>({
        totalRevenue: 0,
        totalOrders: 0,
        recentOrders: [],
        lowStockAlerts: 0,
        activeTerminals: 0,
        distribution: [],
        lastSync: new Date().toISOString()
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = async () => {
        try {
            setRefreshing(true);
            const response = await api.get('/reports/summary');
            setStats(prev => ({ ...prev, ...response.data }));
        } catch (error) {
            console.error('Dashboard Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();

        const socketUrl = `${window.location.protocol}//${window.location.host}`;
        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'],
            autoConnect: true
        });

        socket.on('ORDER_CREATED', (order: any) => {
            setStats(prev => ({
                ...prev,
                totalRevenue: prev.totalRevenue + order.grandTotal,
                totalOrders: prev.totalOrders + 1,
                recentOrders: [order, ...prev.recentOrders.slice(0, 9)],
                lastSync: new Date().toISOString()
            }));
        });

        socket.on('ORDER_SYNCED', () => fetchStats());

        return () => {
            socket.disconnect();
        };
    }, []);

    if (loading) return (
        <div className="p-4 md:p-8 bg-slate-900 min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <RefreshCcw className="text-brand-500 animate-spin" size={32} />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Initializing Command Center...</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 bg-slate-900 min-h-screen font-sans text-white">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-10">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight mb-2">Global Command Center</h1>
                        <p className="text-slate-400 font-medium text-xs md:text-base flex flex-wrap items-center gap-2">
                            Real-time enterprise monitoring. 
                            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded-md text-slate-500 font-mono">
                                LAST REFRESHED: {new Date(stats.lastSync).toLocaleTimeString()}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={fetchStats}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95 group"
                            title="Refresh Dashboard"
                        >
                            <RefreshCcw size={20} className={`text-slate-400 group-hover:text-white ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-500 text-[10px] font-black uppercase tracking-widest">Cloud Sync Live</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8 mb-8 md:mb-10">
                    <button 
                        onClick={() => navigate('/reports')}
                        className="text-left bg-white/5 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
                    >
                        <div className="absolute top-0 right-0 p-4 md:p-8 text-brand-500/10 group-hover:text-brand-500/20 transition-colors">
                            <TrendingUp size={40} className="md:w-20 md:h-20" />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-2 md:mb-4 flex items-center gap-2">
                            Revenue <ArrowUpRight size={10} className="md:w-3.5 md:h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <h2 className="text-xl md:text-4xl font-black truncate">₹{stats.totalRevenue.toLocaleString()}</h2>
                    </button>

                    <button 
                        onClick={() => navigate('/reports')}
                        className="text-left bg-white/5 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
                    >
                        <div className="absolute top-0 right-0 p-4 md:p-8 text-green-500/10 group-hover:text-green-500/20 transition-colors">
                            <ShoppingBag size={40} className="md:w-20 md:h-20" />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-2 md:mb-4 flex items-center gap-2">
                            Orders <ArrowUpRight size={10} className="md:w-3.5 md:h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <h2 className="text-xl md:text-4xl font-black">{stats.totalOrders}</h2>
                    </button>

                    <button 
                        onClick={() => navigate('/inventory')}
                        className="text-left bg-white/5 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
                    >
                        <div className="absolute top-0 right-0 p-4 md:p-8 text-orange-500/10 group-hover:text-orange-500/20 transition-colors">
                            <AlertTriangle size={40} className="md:w-20 md:h-20" />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-2 md:mb-4 flex items-center gap-2">
                            Alerts <ArrowUpRight size={10} className="md:w-3.5 md:h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <h2 className="text-xl md:text-4xl font-black text-orange-400">{stats.lowStockAlerts}</h2>
                    </button>

                    <button 
                        onClick={() => navigate('/admin/devices')}
                        className="text-left bg-white/5 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-all hover:-translate-y-1 active:scale-[0.98]"
                    >
                        <div className="absolute top-0 right-0 p-4 md:p-8 text-purple-500/10 group-hover:text-purple-500/20 transition-colors">
                            <Smartphone size={40} className="md:w-20 md:h-20" />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-2 md:mb-4 flex items-center gap-2">
                            Terminals <ArrowUpRight size={10} className="md:w-3.5 md:h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <h2 className="text-xl md:text-4xl font-black">{stats.activeTerminals}</h2>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-5 md:p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02]">
                            <h3 className="text-lg md:text-xl font-bold flex items-center gap-3">
                                <Clock className="text-brand-500" size={20} />
                                Transaction Stream
                            </h3>
                            <button 
                                onClick={() => navigate('/reports')}
                                className="text-brand-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-brand-300 transition-colors"
                            >
                                View Full Report <ArrowUpRight size={16} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/[0.03]">
                                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                                        <th className="px-8 py-4">Terminal</th>
                                        <th className="px-8 py-4">Invoice</th>
                                        <th className="px-8 py-4">Status</th>
                                        <th className="px-8 py-4 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {stats.recentOrders.map((order, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors group border-white/5">
                                            <td className="px-8 py-6 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400">T{idx+1}</div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">Station Alpha</p>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{order.paymentMode}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="font-black text-white text-sm">{order.invoiceNo}</p>
                                                <p className="text-[10px] font-medium text-slate-500">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">Synced</span>
                                            </td>
                                            <td className="px-8 py-6 text-right font-black text-white text-lg group-hover:text-green-400 transition-colors">
                                                ₹{order.grandTotal.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.recentOrders.length === 0 && (
                                        <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 font-bold uppercase tracking-widest">No recent transactions detected.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl md:rounded-[2.5rem] border border-white/10 p-6 md:p-8 shadow-2xl flex flex-col">
                        <h3 className="text-lg md:text-xl font-bold mb-6 md:mb-8 flex items-center gap-3">
                            <BarChart3 className="text-purple-500" size={20} />
                            Categories
                        </h3>
                        <div className="space-y-6 flex-1">
                            {stats.distribution.map((cat, idx) => {
                                const maxVal = stats.distribution[0]?.value || 1;
                                const percentage = (cat.value / maxVal) * 100;
                                return (
                                    <div key={idx} className="group">
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{cat.name}</p>
                                                <p className="font-bold text-white uppercase text-xs">₹{cat.value.toLocaleString()}</p>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400">{Math.round((cat.value / stats.totalRevenue) * 100)}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${
                                                    idx === 0 ? 'bg-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 
                                                    idx === 1 ? 'bg-purple-500' : 
                                                    idx === 2 ? 'bg-green-500' : 'bg-slate-500'
                                                }`} 
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {stats.distribution.length === 0 && (
                                <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">
                                    Awaiting sales data...
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => navigate('/inventory')}
                            className="mt-8 w-full py-4 rounded-2xl bg-white/5 hover:bg-brand-500 text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-white/5"
                        >
                            Analyze Inventory Matrix
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
