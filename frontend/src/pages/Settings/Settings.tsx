import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import useAuthStore from '../../store/authStore';
import { Shield, Users, Key, AlertCircle, CheckCircle2, Loader2, Save, UserX, UserCheck, Tag, Plus, Edit2, Trash2, Image as ImageIcon, Search, Camera, X as CloseIcon, Printer, Bluetooth, BluetoothOff, Info, Eye, EyeOff } from 'lucide-react';
import { useBluetoothPrinter } from '../../hooks/useBluetoothPrinter';

const Settings = () => {
    const user = useAuthStore((state: any) => state.user);
    const [activeTab, setActiveTab] = useState<'SECURITY' | 'USERS' | 'CATEGORIES' | 'PHOTOS' | 'PRINTER'>(user?.role === 'ADMIN' ? 'USERS' : 'SECURITY');
    const { connect, disconnect, isConnected, isConnecting, device, error: bluetoothError, print } = useBluetoothPrinter();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
    const [categoryManagerType, setCategoryManagerType] = useState<'PRODUCT' | 'EXPENSE'>('PRODUCT');
    const [products, setProducts] = useState<any[]>([]);
    const [searchProduct, setSearchProduct] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<any>(null);
    
    // Permission Modules Definition
    const ACCESS_MODULES = [
        { key: 'POS', label: 'POS Billing' },
        { key: 'INVENTORY', label: 'Inventory' },
        { key: 'PROCUREMENT', label: 'Stock-In' },
        { key: 'AP', label: 'Accounts Payable' },
        { key: 'SALES_RETURN', label: 'Sales Return' },
        { key: 'PURCHASE_RETURN', label: 'Purchase Return' },
        { key: 'SUPPLIERS', label: 'Suppliers' },
        { key: 'CUSTOMERS', label: 'Customers' },
        { key: 'REPORTS', label: 'Reports' },
        { key: 'EXPENSES', label: 'Expenses' },
        { key: 'SETTINGS', label: 'Settings' },
    ];

    // Security states
    const [securityForm, setSecurityForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Admin Reset state
    const [selectedUserId, setSelectedUserId] = useState('');
    const [editUserName, setEditUserName] = useState('');
    const [editUserRole, setEditUserRole] = useState('');
    const [editPermissions, setEditPermissions] = useState<any>({});
    
    // Visibility states
    const [showSecurityPasswords, setShowSecurityPasswords] = useState(false);
    const [showNewUserPassword, setShowNewUserPassword] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [resetPassword, setResetPassword] = useState('');

    // New User state
    const [newUserForm, setNewUserForm] = useState({
        name: '',
        username: '',
        password: '',
        role: 'CASHIER',
        permissions: ACCESS_MODULES.reduce((acc, mod) => ({ ...acc, [mod.key]: true }), {})
    });

    const fetchUsers = async () => {
        if (user?.role !== 'ADMIN') return;
        try {
            const response = await api.get('/auth/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };
    
    const fetchCategories = async () => {
        try {
            const response = await api.get('/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchExpenseCategories = async () => {
        try {
            const response = await api.get('/expense-categories');
            setExpenseCategories(response.data);
        } catch (error) {
            console.error('Error fetching expense categories:', error);
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/products');
            setProducts(response.data);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'USERS') fetchUsers();
        if (activeTab === 'CATEGORIES') {
            fetchCategories();
            fetchExpenseCategories();
        }
        if (activeTab === 'PHOTOS') fetchProducts();
    }, [activeTab]);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (securityForm.newPassword !== securityForm.confirmPassword) {
            return alert("New passwords don't match");
        }

        setLoading(true);
        try {
            await api.post('/auth/change-password', {
                userId: user.id,
                currentPassword: securityForm.currentPassword,
                newPassword: securityForm.newPassword
            });
            alert('Password updated successfully!');
            setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error updating password');
        } finally {
            setLoading(false);
        }
    };

    const handleAdminReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId || !resetPassword) return alert('Please select a user and enter a new password');

        setLoading(true);
        try {
            await api.post('/auth/admin/reset-password', {
                adminId: user.id,
                targetUserId: selectedUserId,
                newPassword: resetPassword
            });
            alert('User password reset successfully!');
            setResetPassword('');
            setSelectedUserId('');
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error resetting password');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) return alert('Please select a user');

        setLoading(true);
        try {
            await api.put(`/auth/users/${selectedUserId}`, {
                adminId: user.id,
                name: editUserName,
                role: editUserRole,
                permissions: editPermissions
            });
            alert('User profile updated successfully!');
            fetchUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error updating user');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        const targetUser = users.find(u => u.id === id);
        if (!targetUser) return;
        
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete user "${targetUser.name}" (@${targetUser.username})? This cannot be undone.`)) {
            return;
        }

        setLoading(true);
        try {
            await api.delete(`/auth/users/${id}`, {
                data: { adminId: user.id }
            });
            alert('User deleted successfully');
            if (selectedUserId === id) setSelectedUserId('');
            fetchUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error deleting user');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName) return;
        setLoading(true);
        try {
            await api.post('/categories', { name: newCategoryName });
            setNewCategoryName('');
            fetchCategories();
        } catch (error) {
            alert('Error adding category');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory?.name) return;
        setLoading(true);
        try {
            await api.put(`/categories/${editingCategory.id}`, { name: editingCategory.name });
            setEditingCategory(null);
            fetchCategories();
        } catch (error) {
            alert('Error updating category');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Are you sure? This will set all products in this category to General.')) return;
        setLoading(true);
        try {
            await api.delete(`/categories/${id}`);
            fetchCategories();
        } catch (error) {
            alert('Error deleting category');
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpenseCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName) return;
        setLoading(true);
        try {
            await api.post('/expense-categories', { name: newCategoryName });
            setNewCategoryName('');
            fetchExpenseCategories();
        } catch (error) {
            alert('Error adding expense category');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateExpenseCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory?.name) return;
        setLoading(true);
        try {
            await api.put(`/expense-categories/${editingCategory.id}`, { name: editingCategory.name });
            setEditingCategory(null);
            fetchExpenseCategories();
        } catch (error) {
            alert('Error updating expense category');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteExpenseCategory = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense category?')) return;
        setLoading(true);
        try {
            await api.delete(`/expense-categories/${id}`);
            fetchExpenseCategories();
        } catch (error) {
            alert('Error deleting expense category');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple check for image size (limit to 2MB for Base64 efficiency)
        if (file.size > 2 * 1024 * 1024) {
            alert("Image too large. Please select a photo under 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            setLoading(true);
            try {
                // Get current product data to preserve other fields
                const product = products.find(p => p.id === productId);
                await api.put(`/products/${productId}`, { 
                    ...product, 
                    image: base64String 
                });
                fetchProducts();
            } catch (error) {
                alert('Error uploading image');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = async (productId: string) => {
        if (!confirm('Remove this product photo?')) return;
        setLoading(true);
        try {
            const product = products.find(p => p.id === productId);
            await api.put(`/products/${productId}`, { 
                ...product, 
                image: null 
            });
            fetchProducts();
        } catch (error) {
            alert('Error removing image');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserForm.name || !newUserForm.username || !newUserForm.password) return;
        setLoading(true);
        try {
            await api.post('/auth/users', {
                ...newUserForm,
                adminId: user.id
            });
            alert('User created successfully!');
            setNewUserForm({ 
                name: '', 
                username: '', 
                password: '', 
                role: 'CASHIER',
                permissions: ACCESS_MODULES.reduce((acc, mod) => ({ ...acc, [mod.key]: true }), {})
            });
            fetchUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error creating user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-slate-50 min-h-screen font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">Settings</h1>
                    <p className="text-slate-500 font-medium text-sm md:text-lg">Manage your account security, users, and product categories.</p>
                </header>

                <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                    <div className="flex flex-nowrap md:flex-wrap gap-2 md:gap-4 mb-4 md:mb-8 bg-white p-1.5 md:p-2 rounded-2xl shadow-sm border border-slate-100 w-max md:w-auto">
                    {user?.role === 'ADMIN' && (
                        <button 
                            onClick={() => setActiveTab('USERS')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Users size={18} />
                            <span>User Management</span>
                        </button>
                    )}
                    <button 
                        onClick={() => setActiveTab('CATEGORIES')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'CATEGORIES' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Tag size={18} />
                        <span>Categories</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('PHOTOS')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'PHOTOS' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <ImageIcon size={18} />
                        <span>Product Photos</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('SECURITY')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'SECURITY' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Shield size={18} />
                        <span>Security & Password</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('PRINTER')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'PRINTER' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Printer size={18} />
                        <span>Printer Setup</span>
                    </button>
                </div>
                </div>

                <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
                    {activeTab === 'SECURITY' ? (
                        <div className="p-6 md:p-10">
                            {/* Security Form ... */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                                    <Key size={24} />
                                </div>
                                <h2 className="text-xl md:text-2xl font-black text-slate-800">Change Your Password</h2>
                            </div>

                            <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">Current Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showSecurityPasswords ? "text" : "password"}
                                            required
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary font-bold text-slate-800 outline-none pr-12"
                                            value={securityForm.currentPassword}
                                            onChange={(e) => setSecurityForm({...securityForm, currentPassword: e.target.value})}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowSecurityPasswords(!showSecurityPasswords)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-primary transition-colors"
                                        >
                                            {showSecurityPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">New Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showSecurityPasswords ? "text" : "password"}
                                            required
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary font-bold text-slate-800 outline-none pr-12"
                                            value={securityForm.newPassword}
                                            onChange={(e) => setSecurityForm({...securityForm, newPassword: e.target.value})}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowSecurityPasswords(!showSecurityPasswords)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-primary transition-colors"
                                        >
                                            {showSecurityPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">Confirm New Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showSecurityPasswords ? "text" : "password"}
                                            required
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary font-bold text-slate-800 outline-none pr-12"
                                            value={securityForm.confirmPassword}
                                            onChange={(e) => setSecurityForm({...securityForm, confirmPassword: e.target.value})}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowSecurityPasswords(!showSecurityPasswords)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-primary transition-colors"
                                        >
                                            {showSecurityPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-5 rounded-2xl font-black shadow-xl shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                    <span>UPDATE PASSWORD</span>
                                </button>
                            </form>
                        </div>
                    ) : activeTab === 'USERS' ? (
                        <div className="p-6 md:p-10">
                            {/* User Management ... */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                                    <Users size={24} />
                                </div>
                                <h2 className="text-xl md:text-2xl font-black text-slate-800">Administrator Control Desk</h2>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                                <div className="space-y-8">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block font-mono italic">Add New Team Member</label>
                                        <form onSubmit={handleAddUser} className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                            <div className="grid grid-cols-2 gap-3">
                                                <input 
                                                    placeholder="Full Name"
                                                    className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                                                    value={newUserForm.name}
                                                    onChange={e => setNewUserForm({...newUserForm, name: e.target.value})}
                                                />
                                                <input 
                                                    placeholder="Username"
                                                    className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                                                    value={newUserForm.username}
                                                    onChange={e => setNewUserForm({...newUserForm, username: e.target.value})}
                                                />
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type={showNewUserPassword ? "text" : "password"}
                                                    placeholder="Password"
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs pr-10"
                                                    value={newUserForm.password}
                                                    onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-primary"
                                                >
                                                    {showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <select 
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                                                value={newUserForm.role}
                                                onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}
                                            >
                                                <option value="CASHIER">Cashier</option>
                                                <option value="MANAGER">Manager</option>
                                                <option value="ADMIN">Administrator</option>
                                            </select>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Module Permissions</label>
                                                <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-2 bg-white rounded-xl border border-slate-200 custom-scrollbar">
                                                    {ACCESS_MODULES.map(mod => (
                                                        <label key={mod.key} className="flex items-center gap-2 cursor-pointer group">
                                                            <input 
                                                                type="checkbox"
                                                                className="w-3 h-3 rounded text-brand-primary focus:ring-0"
                                                                checked={newUserForm.permissions[mod.key] || false}
                                                                onChange={e => setNewUserForm({
                                                                    ...newUserForm,
                                                                    permissions: {
                                                                        ...newUserForm.permissions,
                                                                        [mod.key]: e.target.checked
                                                                    }
                                                                })}
                                                            />
                                                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-brand-primary transition-colors">{mod.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                type="submit"
                                                disabled={loading}
                                                className="w-full bg-brand-600 text-white py-3 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus size={16} /> Create User
                                            </button>
                                        </form>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block font-mono">Select User to Manage</label>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {users.filter(u => u.id !== user.id).map((u) => (
                                                <div key={u.id} className="relative group/item">
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedUserId(u.id);
                                                            setEditUserName(u.name);
                                                            setEditUserRole(u.role);
                                                            setEditPermissions(u.permissions || {});
                                                        }}
                                                        className={`w-full p-4 h-[80px] rounded-2xl border-2 transition-all text-left flex items-center justify-between shrink-0 ${selectedUserId === u.id ? 'border-brand-primary bg-brand-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                                    >
                                                        <div className="flex-1 min-w-0 pr-12">
                                                            <p className="font-bold text-slate-800 truncate">{u.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">@{u.username}</span>
                                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                                                    {u.role} • {Object.values(u.permissions || {}).filter(v => v === true).length} Modules
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {selectedUserId === u.id && <UserCheck className="text-brand-primary shrink-0" size={20} />}
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/item:opacity-100"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))}
                                            {users.length <= 1 && <p className="text-center py-4 text-slate-400 text-xs font-bold italic">No other users found</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {selectedUserId && (
                                        <div className="bg-slate-900 rounded-[2rem] border border-white/5 p-6 animate-in fade-in zoom-in duration-300">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-brand-500/20 rounded-2xl flex items-center justify-center text-brand-400 font-black text-xl">
                                                        {editUserName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Managing User</p>
                                                        <p className="text-white font-bold text-lg truncate flex items-center gap-2">
                                                            {editUserName}
                                                            <span className="text-slate-500 text-sm font-medium">@{users.find(u => u.id === selectedUserId)?.username}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setSelectedUserId('')}
                                                    className="p-2 text-slate-500 hover:text-white transition-colors"
                                                >
                                                    <CloseIcon size={20} />
                                                </button>
                                            </div>

                                            <div className="space-y-4 pt-4 border-t border-white/5">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">Display Name</label>
                                                        <input 
                                                            type="text"
                                                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white text-sm focus:border-brand-primary outline-none"
                                                            value={editUserName}
                                                            onChange={(e) => setEditUserName(e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-2">System Role</label>
                                                        <select 
                                                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white text-sm focus:border-brand-primary outline-none"
                                                            value={editUserRole}
                                                            onChange={(e) => setEditUserRole(e.target.value)}
                                                        >
                                                            <option value="CASHIER" className="bg-slate-900">Cashier</option>
                                                            <option value="MANAGER" className="bg-slate-900">Manager</option>
                                                            <option value="ADMIN" className="bg-slate-900">Administrator</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <h3 className="font-black text-slate-800 mb-6 uppercase tracking-widest text-xs">Update Profile & Permissions</h3>
                                        <form onSubmit={handleUpdateUser} className="space-y-6">
                                            <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                                                {ACCESS_MODULES.map(mod => (
                                                    <label key={mod.key} className="flex items-center gap-3 cursor-pointer group p-1">
                                                        <input 
                                                            type="checkbox"
                                                            disabled={!selectedUserId}
                                                            className="w-4 h-4 rounded text-brand-primary focus:ring-0 disabled:opacity-50"
                                                            checked={editPermissions[mod.key] || false}
                                                            onChange={e => setEditPermissions({
                                                                ...editPermissions,
                                                                [mod.key]: e.target.checked
                                                            })}
                                                        />
                                                        <span className={`text-xs font-bold transition-colors ${selectedUserId ? 'text-slate-700 group-hover:text-brand-primary' : 'text-slate-300'}`}>
                                                            {mod.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            <button 
                                                type="submit"
                                                disabled={loading || !selectedUserId}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-xs tracking-widest uppercase transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                            >
                                                UPDATE USER PROFILE
                                            </button>
                                        </form>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <h3 className="font-black text-slate-800 mb-6 uppercase tracking-widest text-xs">Force Password Reset</h3>
                                        <form onSubmit={handleAdminReset} className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block font-mono">New Password for User</label>
                                                <div className="relative">
                                                    <input 
                                                        type={showResetPassword ? "text" : "password"}
                                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-brand-primary font-bold text-slate-800 outline-none pr-12"
                                                        placeholder="Enter new strong password"
                                                        value={resetPassword}
                                                        onChange={(e) => setResetPassword(e.target.value)}
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setShowResetPassword(!showResetPassword)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-primary"
                                                    >
                                                        {showResetPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button 
                                                type="submit"
                                                disabled={loading || !selectedUserId}
                                                className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {loading ? <Loader2 className="animate-spin" /> : <Shield size={20} />}
                                                <span>FORCE RESET USER</span>
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'CATEGORIES' ? (
                        <div className="p-6 md:p-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                        <Tag size={24} />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800">Manager</h2>
                                </div>
                                
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setCategoryManagerType('PRODUCT')}
                                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${categoryManagerType === 'PRODUCT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Product Categories
                                    </button>
                                    <button 
                                        onClick={() => setCategoryManagerType('EXPENSE')}
                                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${categoryManagerType === 'EXPENSE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Expense Categories
                                    </button>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-12">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block font-mono">
                                        Add New {categoryManagerType === 'PRODUCT' ? 'Category' : 'Expense Category'}
                                    </label>
                                    <form onSubmit={categoryManagerType === 'PRODUCT' ? handleAddCategory : handleAddExpenseCategory} className="flex gap-2">
                                        <input 
                                            type="text"
                                            className="flex-1 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 outline-none"
                                            placeholder={categoryManagerType === 'PRODUCT' ? "e.g. Beverages" : "e.g. Office Snacks"}
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                        />
                                        <button 
                                            type="submit"
                                            disabled={loading || !newCategoryName}
                                            className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <Plus size={24} />
                                        </button>
                                    </form>

                                    <div className="mt-12">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block font-mono">Existing Categories</label>
                                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {(categoryManagerType === 'PRODUCT' ? categories : expenseCategories).length > 0 ? (categoryManagerType === 'PRODUCT' ? categories : expenseCategories).map((cat) => (
                                                <div key={cat.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                                                    {editingCategory?.id === cat.id ? (
                                                        <input 
                                                            autoFocus
                                                            className="flex-1 bg-transparent border-none font-bold text-slate-800 outline-none"
                                                            value={editingCategory.name}
                                                            onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                                                            onBlur={categoryManagerType === 'PRODUCT' ? handleUpdateCategory : handleUpdateExpenseCategory}
                                                            onKeyDown={(e) => e.key === 'Enter' && (categoryManagerType === 'PRODUCT' ? handleUpdateCategory(e) : handleUpdateExpenseCategory(e))}
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-slate-700">{cat.name}</span>
                                                    )}
                                                    
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => setEditingCategory(cat)}
                                                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => categoryManagerType === 'PRODUCT' ? handleDeleteCategory(cat.id) : handleDeleteExpenseCategory(cat.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                                                    No categories yet
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50">
                                    <h3 className="font-black text-emerald-800 mb-4 uppercase tracking-widest text-xs">Pro Tip</h3>
                                    <p className="text-emerald-700/70 text-sm leading-relaxed font-medium">
                                        {categoryManagerType === 'PRODUCT' 
                                            ? 'Use categories to organize your POS terminal. This will create quick-access tabs in the billing interface for faster checkout. Keep names short and descriptive.'
                                            : 'Expense categories help you track your business outflows clearly in the Expense Tracker and reporting charts. Add all recurring cost areas here.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'PHOTOS' ? (
                        <div className="p-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                                        <Camera size={24} />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800">Product Photo Gallery</h2>
                                </div>
                                <div className="relative max-w-xs w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type="text"
                                        placeholder="Search products..."
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-primary"
                                        value={searchProduct}
                                        onChange={(e) => setSearchProduct(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase())).map((product) => (
                                    <div key={product.id} className="bg-white border border-slate-100 rounded-[2rem] p-4 group hover:shadow-xl transition-all relative overflow-hidden">
                                        <div className="aspect-square bg-slate-50 rounded-[1.5rem] mb-4 flex items-center justify-center relative overflow-hidden border-2 border-dashed border-slate-200 group-hover:border-brand-200 transition-colors">
                                            {product.image ? (
                                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-slate-300 flex flex-col items-center gap-2">
                                                    <ImageIcon size={48} strokeWidth={1} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">No Media</span>
                                                </div>
                                            )}
                                            
                                            <label className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer backdrop-blur-[2px]">
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="image/*" 
                                                    onChange={(e) => handleImageUpload(product.id, e)}
                                                />
                                                <div className="bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-xs shadow-xl flex items-center gap-2">
                                                    <Plus size={16} />
                                                    {product.image ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
                                                </div>
                                            </label>
                                        </div>

                                        <div className="px-2">
                                            <p className="font-bold text-slate-800 truncate mb-1">{product.name}</p>
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{product.category?.name || 'GEN'}</p>
                                                {product.image && (
                                                    <button 
                                                        onClick={() => handleRemoveImage(product.id)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Remove Photo"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-brand-600" /></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === 'PRINTER' ? (
                        <div className="p-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                                    <Printer size={24} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800">Thermal Printer Configuration</h2>
                            </div>

                            <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div className={`p-8 rounded-[2rem] border-2 transition-all ${isConnected ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                                                    {isConnected ? <Bluetooth size={20} /> : <BluetoothOff size={20} />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</p>
                                                    <p className={`font-black uppercase text-xs ${isConnected ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                        {isConnected ? 'Connected' : 'Disconnected'}
                                                    </p>
                                                </div>
                                            </div>
                                            {isConnected && (
                                                <button 
                                                    onClick={disconnect}
                                                    className="text-[10px] font-black uppercase bg-white border border-slate-200 px-3 py-1 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                            )}
                                        </div>

                                        {isConnected ? (
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Active Device</p>
                                                <p className="text-xl font-black text-slate-800">{device?.name || 'Generic Thermal Printer'}</p>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        await connect();
                                                    } catch (e) {}
                                                }}
                                                disabled={isConnecting}
                                                className="w-full py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-2xl font-black shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                                            >
                                                {isConnecting ? <Bluetooth size={20} className="animate-spin" /> : <Bluetooth size={20} />}
                                                {isConnecting ? 'RECONNECTING...' : 'PAIR NEW PRINTER'}
                                            </button>
                                        )}
                                        
                                        {bluetoothError && (
                                            <div className="mt-4 flex items-center gap-2 text-red-500 text-xs font-bold bg-white p-3 rounded-xl border border-red-500/20">
                                                <AlertCircle size={14} />
                                                <span>{bluetoothError}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-brand-50/50 p-6 rounded-2xl border border-brand-100 flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            <Info className="text-brand-500 shrink-0 mt-1" size={18} />
                                            <div className="text-xs text-brand-700 font-medium leading-relaxed">
                                                <p className="font-bold mb-1">Two-Phone Setup Guide:</p>
                                                <ol className="list-decimal ml-4 space-y-1">
                                                    <li>Click <b>Pair</b> on Phone 1.</li>
                                                    <li>Once connected, click the <b>Blue Bluetooth Icon</b> in the header to release it.</li>
                                                    <li>Now, immediately click <b>Pair</b> on Phone 2.</li>
                                                    <li>Both phones are now authorized! No more auto-disconnecting.</li>
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-brand-50/50 p-6 rounded-2xl border border-brand-100 flex gap-4 items-start">
                                        <Info className="text-brand-500 shrink-0 mt-1" size={18} />
                                        <div className="text-xs text-brand-700 font-medium leading-relaxed">
                                            Bluetooth printing is only supported on Google Chrome, Microsoft Edge, and newer Android devices via HTTPS. Ensure your printer is in pairing mode.
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Printer Maintenance</h3>
                                    <button 
                                        disabled={!isConnected || loading}
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                const encoder = new TextEncoder();
                                                const testData = new Uint8Array([
                                                    0x1B, 0x40, // Initialize
                                                    0x1B, 0x61, 0x01, // Center
                                                    ...encoder.encode("JUDE'S KITCHEN\n"),
                                                    ...encoder.encode("Printer Test Successful!\n"),
                                                    ...encoder.encode(new Date().toLocaleString() + "\n\n"),
                                                    0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00 // Cut
                                                ]);
                                                await print(testData);
                                                alert('Test page sent to printer!');
                                            } catch (e: any) {
                                                alert('Print failed: ' + e.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-brand-200 hover:bg-brand-50/30 transition-all disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-3 text-slate-700 font-bold text-sm">
                                            {loading ? <Loader2 className="w-[18px] h-[18px] animate-spin text-brand-600" /> : <CheckCircle2 size={18} className="text-emerald-500" />}
                                            Print Test Page
                                        </div>
                                        <Save size={16} className="text-slate-300" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default Settings;
