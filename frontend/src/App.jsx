import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import POSInterface from './pages/POS/POSInterface';
import ProductManagement from './pages/Inventory/ProductManagement';
import CustomerManagement from './pages/Customers/CustomerManagement';
import Reports from './pages/Reports/Reports';
import ExpenseManagement from './pages/Expenses/ExpenseManagement';
import LoginPage from './pages/Login';
import AdminDashboard from './pages/Admin/AdminDashboard';
import LicenseManagement from './pages/Admin/LicenseManagement';
import StaffActivity from './pages/Admin/StaffActivity';
import Settings from './pages/Settings/Settings';
import PrivateRoute from './components/PrivateRoute';
import useAuthStore from './store/authStore';

import StockEntry from './pages/Inventory/StockEntry';
import SalesReturn from './pages/Inventory/SalesReturn';
import PurchaseReturn from './pages/Inventory/PurchaseReturn';
import SupplierManagement from './pages/Inventory/SupplierManagement';
import PurchaseOrders from './pages/Inventory/PurchaseOrders';
import AccountsPayable from './pages/AP/AccountsPayable';
import APLedgerView from './pages/AP/components/APLedgerView';

// New Restaurant Imports
import TableManagement from './pages/Tables/TableManagement';
import KitchenDisplay from './pages/Kitchen/KitchenDisplay';
import ShiftClosing from './pages/Shifts/ShiftClosing';
import RecipeManagement from './pages/Inventory/RecipeManagement';
import QRMenu from './pages/QRMenu/QRMenu';

function App() {
  const token = useAuthStore((state) => state.token);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full bg-brand-50 overflow-hidden relative">
      {/* Sidebar - Only show if authenticated and NOT on login page */}
      {token && (
        <>
          {/* Mobile Toggle */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="md:hidden fixed top-3 left-3 z-40 bg-brand-primary text-white p-3.5 rounded-2xl shadow-xl shadow-brand-primary/20 active:scale-90 transition-transform"
          >
            <Menu size={20} />
          </button>
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </>
      )}
      
      <div className={`flex-1 overflow-auto w-full ${token ? 'pt-14 md:pt-0' : ''}`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" replace />} />
          <Route path="/qr-menu" element={<QRMenu />} />
          
          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<POSInterface />} />
            <Route path="/tables" element={<TableManagement />} />
            <Route path="/kitchen" element={<KitchenDisplay />} />
            <Route path="/shift-drawer" element={<ShiftClosing />} />
            <Route path="/recipes" element={<RecipeManagement />} />
            <Route path="/inventory" element={<ProductManagement />} />
            <Route path="/stock-procurement" element={<StockEntry />} />
            <Route path="/sales-return" element={<SalesReturn />} />
            <Route path="/purchase-return" element={<PurchaseReturn />} />
            <Route path="/suppliers" element={<SupplierManagement />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/customers" element={<CustomerManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/expenses" element={<ExpenseManagement />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/licenses" element={<LicenseManagement />} />
            <Route path="/admin/staff-activity" element={<StaffActivity />} />
            <Route path="/accounts-payable" element={<AccountsPayable />} />
            <Route path="/accounts-payable/ledger/:id" element={<APLedgerView />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
