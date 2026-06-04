import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Clock, Calendar, LogIn, LogOut, ShoppingCart, IndianRupee, PieChart, ArrowRight } from 'lucide-react';
import api from '../../api/api';

interface Activity {
    id: string;
    type: 'LOGIN' | 'LOGOUT' | 'SALE';
    createdAt: string;
}

interface StaffStats {
    id: string;
    name: string;
    username: string;
    role: string;
    salesCount: number;
    revenue: number;
    recentActivities: Activity[];
}

const StaffActivity = () => {
    const [stats, setStats] = useState<StaffStats[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStaffActivity = async () => {
        try {
            const response = await api.get('/reports/staff-activity');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching staff activity:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffActivity();
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-brand-200 rounded-full"></div>
                    <div className="h-4 w-48 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 md:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight mb-1 md:mb-2 italic">Staff Activity</h1>
                        <p className="text-slate-500 font-medium text-sm md:text-base">Monitor individual performance and session activities across your team.</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Total Staff Members</span>
                            <span className="text-xl font-black text-brand-primary">{stats.length}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    {/* Staff List & Sales Stats */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center">
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <PieChart size={20} className="text-brand-500" />
                                    Performance Metrics
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <th className="px-8 py-4">User</th>
                                            <th className="px-8 py-4 text-center">Sales Count</th>
                                            <th className="px-8 py-4 text-right">Total Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {stats.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{user.name}</div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{user.role}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-sm border border-emerald-100">
                                                        <TrendingUp size={14} />
                                                        {user.salesCount} Bills
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right font-black text-slate-800 text-lg">
                                                    ₹{user.revenue.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity Timeline */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 h-full">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2">
                                <Clock size={20} className="text-brand-500" />
                                Recent Activity
                            </h2>
                            <div className="space-y-8 relative">
                                <div className="absolute left-[17px] top-6 bottom-6 w-0.5 bg-slate-100"></div>
                                {stats.flatMap(u => u.recentActivities.map(a => ({ ...a, user: u.name }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10).map((activity, idx) => (
                                    <div key={idx} className="flex gap-4 relative z-10">
                                        <div className={`w-9 h-9 flex items-center justify-center rounded-xl shadow-sm border ${activity.type === 'LOGIN' ? 'bg-green-50 text-green-600 border-green-100' : activity.type === 'SALE' ? 'bg-brand-50 text-brand-600 border-brand-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                            {activity.type === 'LOGIN' ? <LogIn size={16} /> : activity.type === 'SALE' ? <ShoppingCart size={16} /> : <LogOut size={16} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <span className="font-bold text-slate-800 text-sm">{activity.user}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                                {activity.type === 'LOGIN' ? 'Logged into Terminal' : activity.type === 'SALE' ? 'Processed a Sale' : 'Logged out of Session'}
                                            </p>
                                            <div className="text-[9px] text-slate-300 mt-1 flex items-center gap-1 font-bold">
                                                <Calendar size={10} />

                                                {new Date(activity.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {stats.every(u => u.recentActivities.length === 0) && (
                                    <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                        No recent activities recorded
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffActivity;
