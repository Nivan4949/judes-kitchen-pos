import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, BarChart3, Key, Smartphone, Settings, LogOut, Menu, X, Plus, Users, TrendingDown, Truck, ShoppingCart, Clock, LayoutGrid, ChefHat, Coins } from 'lucide-react';
import useAuthStore from '../store/authStore';

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);

  const menuItems = [
    { icon: <ShoppingBag size={22} />, label: 'POS Billing', path: '/', roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'], permissionKey: 'POS' },
    { icon: <LayoutGrid size={22} />, label: 'Table Floor', path: '/tables', roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'], permissionKey: 'TABLES' },
    { icon: <ChefHat size={22} />, label: 'Kitchen KDS', path: '/kitchen', roles: ['ADMIN', 'MANAGER', 'KITCHEN'], permissionKey: 'KITCHEN' },
    { icon: <Coins size={22} />, label: 'Shift Drawer', path: '/shift-drawer', roles: ['ADMIN', 'MANAGER', 'CASHIER'], permissionKey: 'SHIFT' },
    { icon: <Package size={22} />, label: 'Recipe Matrix', path: '/recipes', roles: ['ADMIN', 'MANAGER'], permissionKey: 'RECIPES' },
    { icon: <LayoutDashboard size={22} />, label: 'Cloud Dashboard', path: '/admin/dashboard', roles: ['ADMIN'], permissionKey: 'DASHBOARD' },
    { icon: <Package size={22} />, label: 'Inventory Management', path: '/inventory', roles: ['ADMIN', 'MANAGER'], permissionKey: 'INVENTORY' },
    { icon: <Package size={22} />, label: 'Stock Procurement', path: '/stock-procurement', roles: ['ADMIN', 'MANAGER'], permissionKey: 'PROCUREMENT' },
    { icon: <BarChart3 size={22} />, label: 'Accounts Payable', path: '/accounts-payable', roles: ['ADMIN', 'MANAGER'], permissionKey: 'AP' },
    { icon: <TrendingDown size={22} />, label: 'Sales Return', path: '/sales-return', roles: ['ADMIN', 'MANAGER', 'CASHIER'], permissionKey: 'SALES_RETURN' },
    { icon: <Plus size={22} />, label: 'Purchase Return', path: '/purchase-return', roles: ['ADMIN', 'MANAGER'], permissionKey: 'PURCHASE_RETURN' },
    { icon: <Truck size={22} />, label: 'Supplier Registry', path: '/suppliers', roles: ['ADMIN', 'MANAGER'], permissionKey: 'SUPPLIERS' },
    { icon: <Users size={22} />, label: 'Customer Network', path: '/customers', roles: ['ADMIN', 'MANAGER', 'CASHIER'], permissionKey: 'CUSTOMERS' },
    { icon: <BarChart3 size={22} />, label: 'Financial Reports', path: '/reports', roles: ['ADMIN', 'MANAGER'], permissionKey: 'REPORTS' },
    { icon: <LayoutDashboard size={22} />, label: 'Daily Expenses', path: '/expenses', roles: ['ADMIN', 'MANAGER'], permissionKey: 'EXPENSES' },
    { icon: <Key size={22} />, label: 'License Desk', path: '/admin/licenses', roles: ['ADMIN'], permissionKey: 'LICENSES' },
    { icon: <Clock size={22} />, label: 'Staff Activity', path: '/admin/staff-activity', roles: ['ADMIN'], permissionKey: 'DEVICES' },
    { icon: <Settings size={22} />, label: 'Settings', path: '/settings', roles: ['ADMIN', 'MANAGER', 'CASHIER'], permissionKey: 'SETTINGS' },
  ];

  const filteredMenu = menuItems.filter(item => {
    // 1. Admins always see everything
    if (user?.role?.toUpperCase() === 'ADMIN') return true;
    
    // 2. If granular permissions exist (even if it's an empty object {}), 
    // it becomes the ABSOLUTE source of truth.
    if (user?.permissions !== undefined && user?.permissions !== null && typeof user.permissions === 'object') {
        return user.permissions[item.permissionKey] === true;
    }

    // 3. Fallback for Legacy Users (where permissions field is null in DB)
    // These users get standard access based on their Role (Cashier/Manager).
    return item.roles.map(r => r.toUpperCase()).includes(user?.role?.toUpperCase());
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-[100] w-[280px] sm:w-72 bg-brand-dark flex flex-col text-slate-300 select-none 
        transition-transform duration-300 ease-in-out transform md:relative md:translate-x-0 md:w-20 lg:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-brand-primary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/logo.png" alt="Jude's Kitchen" className="w-full h-full object-contain" />
            </div>
            <div className="block md:hidden lg:block overflow-hidden">
              <p className="font-bold text-lg text-white truncate text-nowrap">JUDE'S KITCHEN</p>
              <p className="text-[10px] font-black text-brand-300 uppercase tracking-widest">{user?.role || 'User'}</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar custom-scrollbar-dark">
          {filteredMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => { if(window.innerWidth < 1024) onClose(); }}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                  isActive ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <div className="flex-shrink-0">{item.icon}</div>
              <span className="block md:hidden lg:block font-medium truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-primary/30">
          <button 
            onClick={() => { logout(); onClose(); }}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all text-sm font-bold uppercase tracking-wider"
          >
            <LogOut size={22} className="flex-shrink-0" />
            <span className="block md:hidden lg:block">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
