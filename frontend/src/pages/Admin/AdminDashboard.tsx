import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, ShoppingBag, Users, Clock, AlertTriangle, 
  ArrowUpRight, RefreshCcw, Smartphone, ChefHat, LayoutGrid, 
  RotateCcw, ClipboardList, Wallet, Sparkles, PlusCircle
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<{
        todaySales: number;
        runningOrdersCount: number;
        occupiedTablesCount: number;
        pendingKotsCount: number;
        topSellingItems: any[];
        paymentSummary: { CASH: number; UPI: number; CARD: number };
        totalRevenue: number;
        totalOrders: number;
        recentOrders: any[];
        lowStockAlerts: number;
        activeTerminals: number;
        distribution: any[];
        lastSync: string;
    }>({
        todaySales: 0,
        runningOrdersCount: 0,
        occupiedTablesCount: 0,
        pendingKotsCount: 0,
        topSellingItems: [],
        paymentSummary: { CASH: 0, UPI: 0, CARD: 0 },
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
                todaySales: prev.todaySales + (order.roundedTotal || order.grandTotal),
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
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Initializing Restaurant Command Center...</p>
            </div>
        </div>
    );

    const quickActions = [
        {
            name: 'Open Billing POS',
            desc: 'Start checkout flow',
            path: '/',
            icon: <Wallet className="text-emerald-400" size={24} />,
            bg: 'from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20'
        },
        {
            name: 'Table Floor Map',
            desc: 'View & occupy tables',
            path: '/tables',
            icon: <LayoutGrid className="text-blue-400" size={24} />,
            bg: 'from-blue-500/10 to-blue-500/5 hover:from-blue-500/20'
        },
        {
            name: 'Kitchen Display (KDS)',
            desc: 'Process cooking tickets',
            path: '/kitchen',
            icon: <ChefHat className="text-purple-400" size={24} />,
            bg: 'from-purple-500/10 to-purple-500/5 hover:from-purple-500/20'
        },
        {
            name: 'Drawer & Shift closing',
            desc: 'Verify cashier counters',
            path: '/shift-drawer',
            icon: <Clock className="text-orange-400" size={24} />,
            bg: 'from-orange-500/10 to-orange-500/5 hover:from-orange-500/20'
        },
        {
            name: 'Configure Recipes',
            desc: 'Map stock deductions',
            path: '/recipes',
            icon: <ClipboardList className="text-yellow-400" size={24} />,
            bg: 'from-yellow-500/10 to-yellow-500/5 hover:from-yellow-500/20'
        },
        {
            name: 'Manage System Settings',
            desc: 'Floor plan / taxes',
            path: '/settings',
            icon: <Smartphone className="text-slate-400" size={24} />,
            bg: 'from-slate-500/10 to-slate-500/5 hover:from-slate-500/20'
        }
    ];

    const totalPayment = (stats.paymentSummary?.CASH || 0) + (stats.paymentSummary?.UPI || 0) + (stats.paymentSummary?.CARD || 0);

    return (
        <div className="p-4 md:p-8 bg-slate-900 min-h-screen font-sans text-white">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-10">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight mb-2">POS Operating Dashboard</h1>
                        <p className="text-slate-400 font-medium text-xs md:text-base flex flex-wrap items-center gap-2">
                            Real-time operation stats.
                            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded-md text-slate-500 font-mono">
                                LAST REFRESHED: {new Date(stats.lastSync).toLocaleTimeString()}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={fetchStats}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-95 group"
                            title="Refresh Stats"
                        >
                            <RefreshCcw size={20} className={`text-slate-400 group-hover:text-white ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Operation live</span>
                        </div>
                    </div>
                </div>

                {/* Operations Summary Widgets */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-10">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-4 md:p-6 rounded-[2rem] border border-emerald-500/20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-emerald-500/10">
                            <TrendingUp size={48} />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-1">
                            Today's Sales
                        </p>
                        <h2 className="text-2xl md:text-4xl font-black text-emerald-400">₹{stats.todaySales?.toFixed(2)}</h2>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">All completed orders today</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-transparent p-4 md:p-6 rounded-[2rem] border border-blue-500/20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-blue-500/10">
                            <ShoppingBag size={48} />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-1">
                            Running Orders
                        </p>
                        <h2 className="text-2xl md:text-4xl font-black text-blue-400">{stats.runningOrdersCount}</h2>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Active unpaid sessions</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-transparent p-4 md:p-6 rounded-[2rem] border border-purple-500/20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-purple-500/10">
                            <LayoutGrid size={48} />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-1">
                            Occupied Tables
                        </p>
                        <h2 className="text-2xl md:text-4xl font-black text-purple-400">{stats.occupiedTablesCount}</h2>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Active dining tables</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500/10 to-transparent p-4 md:p-6 rounded-[2rem] border border-orange-500/20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-orange-500/10">
                            <ChefHat size={48} />
                        </div>
                        <p className="text-slate-400 font-bold text-[8px] md:text-xs uppercase tracking-widest mb-1">
                            Pending KOTs
                        </p>
                        <h2 className="text-2xl md:text-4xl font-black text-orange-400">{stats.pendingKotsCount}</h2>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Cooking tickets in kitchen</p>
                    </div>
                </div>

                {/* Primary Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left & Middle Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Quick Actions Panel */}
                        <div className="bg-white/5 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl">
                            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-3">
                                <Sparkles className="text-yellow-400 animate-pulse" size={20} />
                                Quick Launch Actions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {quickActions.map((act, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => navigate(act.path)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${act.bg} border border-white/5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
                                    >
                                        <div className="p-3 bg-slate-900/50 rounded-xl">
                                            {act.icon}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{act.name}</p>
                                            <p className="text-xs text-slate-400 font-medium">{act.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recent Transactions Stream */}
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
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
                                            <th className="px-8 py-4">Type</th>
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
                                                    <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">{order.orderType || 'Dine-In'}</span>
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
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                        {/* Payment Method Summary Card */}
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 p-6 md:p-8 shadow-2xl">
                            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-3">
                                <Wallet className="text-emerald-500" size={20} />
                                Today's Payments
                            </h3>
                            <div className="space-y-4">
                                {['CASH', 'UPI', 'CARD'].map((method) => {
                                    const amount = stats.paymentSummary?.[method as keyof typeof stats.paymentSummary] || 0;
                                    const share = totalPayment > 0 ? (amount / totalPayment) * 100 : 0;
                                    return (
                                        <div key={method} className="flex justify-between items-center p-3 rounded-xl bg-slate-900/40 border border-white/5">
                                            <div>
                                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{method}</p>
                                                <p className="text-lg font-black text-white">₹{amount.toFixed(2)}</p>
                                            </div>
                                            <span className="text-[10px] font-black bg-white/5 px-2.5 py-1 rounded-md text-slate-400">
                                                {share.toFixed(0)}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Top Selling Items Card */}
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 p-6 md:p-8 shadow-2xl">
                            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-3">
                                <BarChart3 className="text-purple-500" size={20} />
                                Top Selling Dishes
                            </h3>
                            <div className="space-y-3">
                                {stats.topSellingItems?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-900/40 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center text-xs font-black">
                                                #{idx + 1}
                                            </div>
                                            <p className="font-bold text-white text-sm">{item.name}</p>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                            {item.qty} Sold
                                        </span>
                                    </div>
                                ))}
                                {(!stats.topSellingItems || stats.topSellingItems.length === 0) && (
                                    <div className="text-center text-slate-500 italic text-sm py-4">
                                        Awaiting sales details...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Categories Sales Bar */}
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 p-6 md:p-8 shadow-2xl flex flex-col">
                            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-3">
                                <Users className="text-purple-500" size={20} />
                                Categories Summary
                            </h3>
                            <div className="space-y-4">
                                {stats.distribution.map((cat, idx) => {
                                    const maxVal = stats.distribution[0]?.value || 1;
                                    const percentage = (cat.value / maxVal) * 100;
                                    return (
                                        <div key={idx} className="group">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{cat.name}</span>
                                                <span className="text-[10px] font-black text-slate-400">₹{cat.value.toLocaleString()}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${
                                                        idx === 0 ? 'bg-brand-500' : 
                                                        idx === 1 ? 'bg-purple-500' : 'bg-slate-500'
                                                    }`} 
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
