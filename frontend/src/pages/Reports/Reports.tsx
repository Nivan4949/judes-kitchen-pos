import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { BarChart3, TrendingUp, ShoppingBag, Users, Clock, Calendar, FileText, IndianRupee, PieChart, Package, Receipt, X, ArrowUpRight, Plus, Download, FileSpreadsheet, Loader2, Printer, Trash2, Percent } from 'lucide-react';
import { exportUtils } from '../../utils/exportUtils';
import PartyDetailsModal from '../../components/PartyDetailsModal';
import BillDetailsModal from '../../components/BillDetailsModal';
import ReceiptPreview from '../../components/ReceiptPreview';
import CreditSettlementModal from '../../components/CreditSettlementModal';
import { Coins } from 'lucide-react';
import { offlineDB } from '../../utils/offlineDB';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { processSyncQueue } from '../../utils/syncQueue';
import { RefreshCw } from 'lucide-react';

const reportCategories = [
  {
    title: 'Main Reports',
    reports: [
      { id: 'sales', name: 'Sale Report', icon: <TrendingUp size={16} /> },
      { id: 'credit-sales', name: 'Outstanding Credits', icon: <IndianRupee className="text-orange-500" size={16} /> },
      { id: 'payment-summary', name: 'Payment Mode Summary', icon: <PieChart size={16} /> },
      { id: 'purchase', name: 'Purchase Report', icon: <ShoppingBag size={16} /> },
      { id: 'daybook', name: 'Day Book', icon: <FileText size={16} /> },
      { id: 'profit-loss', name: 'Profit & Loss', icon: <PieChart size={16} /> },
      { id: 'transactions', name: 'All Transactions', icon: <Receipt size={16} /> },
      { id: 'credit-notes', name: 'Credit Note Report', icon: <TrendingUp className="rotate-180" size={16} /> },
      { id: 'debit-notes', name: 'Debit Note Report', icon: <ShoppingBag className="rotate-180" size={16} /> },
      { id: 'cashflow', name: 'Cashflow', icon: <IndianRupee size={16} /> },
      { id: 'balance-sheet', name: 'Balance Sheet', icon: <BarChart3 size={16} /> },
    ]
  },
  {
    title: 'Party Reports (Customer)',
    reports: [
      { id: 'parties', name: 'All Customers', icon: <Users size={16} /> },
      { id: 'party-statement', name: 'Customer Statement', icon: <FileText size={16} /> },
    ]
  },
  {
    title: 'Supplier Reports (Parties)',
    reports: [
      { id: 'suppliers', name: 'All Suppliers', icon: <Users className="text-orange-500" size={16} /> },
      { id: 'supplier-ledger', name: 'Supplier Ledger', icon: <FileText className="text-orange-500" size={16} /> },
    ]
  },
  {
    title: 'Item / Stock Reports',
    reports: [
      { id: 'stock-summary', name: 'Stock Summary', icon: <Package size={16} /> },
      { id: 'item-profit', name: 'Item Sales & Profit', icon: <TrendingUp size={16} /> },
      { id: 'stock-detail', name: 'Stock Detail', icon: <FileText size={16} /> },
    ]
  },
  {
    title: 'Expense Reports',
    reports: [
      { id: 'expenses', name: 'Expense Report', icon: <Clock size={16} /> },
    ]
  },
  {
    title: 'Restaurant Reports',
    reports: [
      { id: 'waiter-sales', name: 'Waiter Sales Performance', icon: <Users className="text-orange-500" size={16} /> },
      { id: 'table-sales', name: 'Table Sales Report', icon: <BarChart3 className="text-brand-500" size={16} /> },
      { id: 'kot-reports', name: 'KOT History Log', icon: <FileText className="text-purple-500" size={16} /> },
      { id: 'cancelled-items', name: 'Cancelled Items Audit', icon: <X className="text-red-500" size={16} /> },
      { id: 'discounts-report', name: 'Discounts & Freebies Log', icon: <Percent className="text-yellow-500" size={16} /> }
    ]
  }
];

const Reports = () => {
  const isOnline = useNetworkStatus();
  const [activeReport, setActiveReport] = useState('sales');
  const [dateFilter, setDateFilter] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<'CSV' | 'PDF' | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState(''); // For specific party/item queries
  const [entities, setEntities] = useState<any[]>([]); // To populate dropdowns for statement/details
  const [selectedReturn, setSelectedReturn] = useState<any>(null); // For Credit Note Detailed View
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<{id: string, type: 'SALE' | 'PURCHASE'} | null>(null);
  
  // Payment recording state
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);
  
  // Credit settlement state
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedSettleOrder, setSelectedSettleOrder] = useState<any>(null);
  const [printPreviewOrder, setPrintPreviewOrder] = useState<any>(null);
  const [isFetchingPrint, setIsFetchingPrint] = useState<string | null>(null);

  // Initial load for specific entities
  useEffect(() => {
    if (activeReport === 'party-statement') {
      api.get('/customers').then(res => setEntities(res.data)).catch(console.error);
    } else if (activeReport === 'supplier-ledger') {
      api.get('/purchases/suppliers/suggestions').then(res => setEntities(res.data)).catch(console.error);
    } else if (activeReport === 'stock-detail') {
      api.get('/products').then(res => setEntities(res.data)).catch(console.error);
    }
  }, [activeReport]);

  const fetchReport = async () => {
    // Only block specific reports if ID is missing
    if ((activeReport === 'party-statement' || activeReport === 'stock-detail') && !selectedEntityId) {
      setReportData(null);
      return;
    }

    setLoading(true);
    const offset = new Date().getTimezoneOffset();
    let url = `/reports/${activeReport}?filter=${dateFilter}&timezoneOffset=${offset}`;
    if (dateFilter === 'Custom') url += `&startDate=${customStart}&endDate=${customEnd}`;
    
    // Adjust URL for parameterized routes
    if (activeReport === 'party-statement') url = `/reports/party-statement/${selectedEntityId}`;
    if (activeReport === 'supplier-ledger') url = `/reports/supplier-ledger?supplierName=${selectedEntityId}`;
    if (activeReport === 'suppliers') url = `/reports/suppliers`;
    if (activeReport === 'stock-detail') url = `/reports/stock-detail/${selectedEntityId}`;

    try {
      let data: any = { 
        summary: { 
          totalSales: 0, 
          totalPurchases: 0, 
          totalBilled: 0, 
          totalPaid: 0, 
          totalOutstanding: 0, 
          totalTax: 0,
          billCount: 0,
          grossProfit: 0,
          netProfit: 0
        }, 
        details: [],
        transactions: [] 
      };
      
      // 1. Fetch backend data if possible
      try {
        const response = await api.get(url);
        data = response.data;
      } catch (err) {
        console.warn('Backend reporting unavailable, falling back to local data');
      }

        // 2. Merge with Offline Orders if relevant (Only for reports that contain order lists)
        const relevantReports = ['sales', 'credit-sales', 'daybook', 'transactions', 'cashflow'];
        if (relevantReports.includes(activeReport)) {
          const offlineOrders = await offlineDB.getAll('orders');
          const detailsList = data.details || data.transactions || [];
          
          if (Array.isArray(detailsList)) {
            // 2.a Deduplicate using BOTH id and serverId (client UUID) to prevent "POS-" duplicates
            // OR contextually deduplicate if the amount and time are nearly identical (handles numbering jumps)
            let unsynced = offlineOrders.filter(o => {
              const isNotOnServer = detailsList.every((ex: any) => {
                const idMatch = ex.id === o.id || ex.serverId === o.id || ex.invoiceNo === o.invoiceNo;
                
                // Fuzzy match: same amount (+/- 1 Rupee) and same time (+/- 5 mins)
                const exTime = new Date(ex.createdAt || ex.date).getTime();
                const oTime = new Date(o.createdAt || o.date).getTime();
                const timeMatch = Math.abs(exTime - oTime) < 5 * 60 * 1000;
                const amountMatch = Math.abs((ex.grandTotal || ex.amount) - o.grandTotal) < 1;
                
                return !(idMatch || (timeMatch && amountMatch));
              });
              // Only include if NOT synced AND truly missing from the server list
              return !o.isSynced && isNotOnServer;
            });

            // 2.b Filter unsynced orders by dateFilter using shifted business day boundaries (6:00 PM start)
            const OUTLET_TZ_OFFSET = -330; // Fixed offset for India Standard Time (IST)
            const now = new Date();
            const outletTimeMs = now.getTime() - (OUTLET_TZ_OFFSET * 60000);
            const shifted = new Date(outletTimeMs - (18 * 60 * 60 * 1000));
            const D = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
            
            const bizTodayStartLocal = new Date(D.getTime() + (18 * 60 * 60 * 1000));
            const bizTodayEndLocal = new Date(D.getTime() + (42 * 60 * 60 * 1000) - 1);

            const bizTodayStart = new Date(bizTodayStartLocal.getTime() + (OUTLET_TZ_OFFSET * 60000));
            const bizTodayEnd = new Date(bizTodayEndLocal.getTime() + (OUTLET_TZ_OFFSET * 60000));

            if (dateFilter === 'Today') {
              unsynced = unsynced.filter(o => {
                const d = new Date(o.createdAt || o.date);
                return d >= bizTodayStart && d <= bizTodayEnd;
              });
            } else if (dateFilter === 'Yesterday') {
              const yesterdayStart = new Date(bizTodayStart.getTime() - (24 * 60 * 60 * 1000));
              const yesterdayEnd = new Date(bizTodayEnd.getTime() - (24 * 60 * 60 * 1000));
              unsynced = unsynced.filter(o => {
                const d = new Date(o.createdAt || o.date);
                return d >= yesterdayStart && d <= yesterdayEnd;
              });
            } else if (dateFilter === 'Week' || dateFilter === 'This Week') {
               const weekStart = new Date(bizTodayStart.getTime() - (6 * 24 * 60 * 60 * 1000));
               unsynced = unsynced.filter(o => {
                 const d = new Date(o.createdAt || o.date);
                 return d >= weekStart && d <= bizTodayEnd;
               });
            } else if (dateFilter === 'Month' || dateFilter === 'This Month') {
               const monthStart = new Date(bizTodayStart.getTime() - (29 * 24 * 60 * 60 * 1000));
               unsynced = unsynced.filter(o => {
                 const d = new Date(o.createdAt || o.date);
                 return d >= monthStart && d <= bizTodayEnd;
               });
            } else if (dateFilter === 'Custom' && customStart && customEnd) {
               const parseYYYYMMDD = (str: string) => {
                 const parts = str.split('-');
                 return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
               };
               const startD = parseYYYYMMDD(customStart);
               const bizCustomStartLocal = new Date(startD.getTime() + (18 * 60 * 60 * 1000));
               const bizCustomStart = new Date(bizCustomStartLocal.getTime() + (OUTLET_TZ_OFFSET * 60000));

               const endD = parseYYYYMMDD(customEnd);
               const bizCustomEndLocal = new Date(endD.getTime() + (42 * 60 * 60 * 1000) - 1);
               const bizCustomEnd = new Date(bizCustomEndLocal.getTime() + (OUTLET_TZ_OFFSET * 60000));

               unsynced = unsynced.filter(o => {
                 const d = new Date(o.createdAt || o.date);
                 return d >= bizCustomStart && d <= bizCustomEnd;
               });
            }

            if (unsynced.length > 0) {
              // Merge into the correct array
              if (activeReport === 'daybook' || activeReport === 'transactions' || activeReport === 'cashflow') {
                const formattedOffline = unsynced.map(s => ({ 
                   id: s.id, 
                   type: 'SALE', 
                   amount: s.grandTotal, 
                   date: s.createdAt, 
                   details: `Bill: ${s.invoiceNo} (Offline)`, 
                   customerId: s.customerId 
                }));
                data.transactions = [...formattedOffline, ...(data.transactions || [])];
                
                // Update totals if summary exists
                if (data.cashIn !== undefined) {
                  data.cashIn += formattedOffline.reduce((sum, s) => sum + s.amount, 0);
                  data.netBalance = data.cashIn - (data.cashOut || 0);
                }
              } else if (Array.isArray(data.details)) {
                data.details = [...unsynced, ...data.details];
                
                // Re-calculate summary totals safely
                if (data.summary) {
                  if (activeReport === 'credit-sales') {
                    data.summary.totalOutstanding = data.details.reduce((sum: number, o: any) => sum + (Number(o.balance) || 0), 0);
                    data.summary.totalBilled = data.details.reduce((sum: number, o: any) => sum + (Number(o.grandTotal) || 0), 0);
                    data.summary.totalPaid = data.details.reduce((sum: number, o: any) => sum + (Number(o.amountPaid) || 0), 0);
                    data.summary.billCount = data.details.length;
                  } else if (activeReport === 'sales') {
                    data.summary.totalSales = data.details.reduce((sum: number, o: any) => sum + (Number(o.grandTotal) || 0), 0);
                    data.summary.totalReceived = data.details.reduce((sum: number, o: any) => sum + (Number(o.amountPaid) || 0), 0);
                    data.summary.billCount = data.details.length;
                  }
                }
              }
            }
          }
        }

      // 3. FINAL FILTER: If Outstanding Credits, only show those with balance > 0
      if (activeReport === 'credit-sales' && Array.isArray(data.details)) {
        data.details = data.details.filter((o: any) => (Number(o.balance) || 0) > 0);
        
        // Final re-calculation of aggregate numbers
        if (data.summary) {
          data.summary.totalOutstanding = data.details.reduce((sum: number, o: any) => sum + (Number(o.balance) || 0), 0);
          data.summary.billCount = data.details.length;
          data.summary.totalBilled = data.details.reduce((sum: number, o: any) => sum + (Number(o.grandTotal) || 0), 0);
          data.summary.totalPaid = data.details.reduce((sum: number, o: any) => sum + (Number(o.amountPaid) || 0), 0);
        }
      }

      // 4. SORT BY DATE (Newest First)
      if (Array.isArray(data.details)) {
        data.details.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      } else if (Array.isArray(data.transactions)) {
        data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedPurchase || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return alert('Enter a valid amount');
    if (amount > selectedPurchase.balanceDue) return alert('Payment exceeds balance due');

    setIsPaying(true);
    try {
      await api.post(`/purchases/${selectedPurchase.id}/payments`, { amount });
      alert('Payment recorded successfully!');
      setSelectedPurchase(null);
      setPaymentAmount('');
      // Refresh current report
      fetchReport();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsPaying(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport, dateFilter, customStart, customEnd, selectedEntityId]);

  const handleExport = (format: 'PDF' | 'CSV') => {
    if (!reportData) return;
    setIsExporting(format);

    setTimeout(() => {
        try {
            let headers: string[] = [];
            let data: any[][] = [];
            let title = reportCategories.flatMap(c => c.reports).find(r => r.id === activeReport)?.name || 'Report';
            const filename = `${activeReport}_${new Date().toISOString().split('T')[0]}`;

            // 1. Format Data Based on Active Report
            switch (activeReport) {
              case 'sales':
              case 'purchase':
                headers = ['Date', 'Invoice', activeReport === 'sales' ? 'Customer' : 'Supplier', 'Amount'];
                data = reportData.details.map((item: any) => [
                  new Date(item.createdAt || item.date).toLocaleDateString(),
                  item.invoiceNo,
                  activeReport === 'sales' ? (item.customer?.name || 'Walk-in') : item.supplierName,
                  `Rs.${item.grandTotal.toFixed(2)}`
                ]);
                break;

              case 'credit-sales':
                headers = ['Date', 'Invoice', 'Customer', 'Billed', 'Paid', 'Balance'];
                data = reportData.details.map((item: any) => [
                  new Date(item.createdAt).toLocaleDateString(),
                  item.invoiceNo,
                  item.customer?.name || 'Walk-in',
                  `Rs.${item.grandTotal.toFixed(2)}`,
                  `Rs.${item.amountPaid.toFixed(2)}`,
                  `Rs.${item.balance.toFixed(2)}`
                ]);
                break;

              case 'stock-summary':
                headers = ['ID', 'Name', 'Category', 'Stock', 'Price'];
                data = reportData.map((item: any) => [
                  item.id.slice(0, 8),
                  item.name,
                  item.category?.name || 'N/A',
                  item.stockQuantity,
                  `Rs.${item.sellingPrice}`
                ]);
                break;

              case 'expenses':
                headers = ['Date', 'Category', 'Amount', 'Description'];
                data = reportData.details.map((item: any) => [
                  new Date(item.date).toLocaleDateString(),
                  item.category,
                  `Rs.${item.amount}`,
                  item.description || '-'
                ]);
                break;

              case 'supplier-ledger':
                headers = ['Date', 'Invoice', 'Status', 'Bill Amt', 'Balance'];
                data = (reportData.purchases || []).map((p: any) => [
                  new Date(p.date || p.createdAt).toLocaleDateString(),
                  p.invoiceNo,
                  p.paymentStatus,
                  `Rs.${p.grandTotal.toFixed(2)}`,
                  `Rs.${p.balanceDue.toFixed(2)}`
                ]);
                title = `Ledger: ${reportData.name}`;
                break;

              case 'waiter-sales':
                headers = ['Waiter Name', 'Order Count', 'Total Sales'];
                data = reportData.map((item: any) => [
                  item.name,
                  item.orderCount,
                  `Rs.${item.totalSales.toFixed(2)}`
                ]);
                break;

              case 'table-sales':
                headers = ['Table Name', 'Order Count', 'Total Sales'];
                data = reportData.map((item: any) => [
                  item.number,
                  item.orderCount,
                  `Rs.${item.totalSales.toFixed(2)}`
                ]);
                break;

              case 'kot-reports':
                headers = ['Date', 'KOT No', 'Table', 'Waiter', 'Status', 'Items Count'];
                data = reportData.map((kot: any) => [
                  new Date(kot.createdAt).toLocaleString(),
                  kot.kotNo,
                  kot.tableName || 'N/A',
                  kot.waiterName || 'N/A',
                  kot.status,
                  kot.items?.length || 0
                ]);
                break;

              case 'cancelled-items':
                headers = ['Date', 'Item Name', 'KOT No', 'Table/Waiter', 'Qty Cancelled', 'Reason'];
                data = reportData.map((item: any) => [
                  new Date(item.createdAt || item.kot?.createdAt).toLocaleString(),
                  item.name + (item.variant ? ` (${item.variant})` : ''),
                  item.kot?.kotNo || 'N/A',
                  (item.kot?.tableName || 'Takeaway') + (item.kot?.waiterName ? ` / ${item.kot.waiterName}` : ''),
                  item.quantity,
                  item.cancelReason || item.notes || 'No reason'
                ]);
                break;

              case 'discounts-report':
                headers = ['Date', 'Invoice', 'Discount Given', 'Bill Total', 'Authorized By'];
                data = reportData.map((order: any) => [
                  new Date(order.createdAt).toLocaleDateString(),
                  order.invoiceNo,
                  `Rs.${order.discount.toFixed(2)}`,
                  `Rs.${order.grandTotal.toFixed(2)}`,
                  order.creator?.name || 'Staff'
                ]);
                break;

              case 'balance-sheet':
                headers = ['Account Category', 'Line Item', 'Amount'];
                data = [
                  ['ASSETS', 'Cash & Bank Balance', `Rs.${(reportData.assets?.cashBalance || 0).toFixed(2)}`],
                  ['ASSETS', 'Inventory Cost Value', `Rs.${(reportData.assets?.inventoryValue || 0).toFixed(2)}`],
                  ['ASSETS', 'Customer Receivables', `Rs.${(reportData.assets?.receivables || 0).toFixed(2)}`],
                  ['ASSETS', 'TOTAL ASSETS', `Rs.${(reportData.assets?.totalAssets || 0).toFixed(2)}`],
                  ['LIABILITIES', 'Supplier Payables', `Rs.${(reportData.liabilities?.payables || 0).toFixed(2)}`],
                  ['LIABILITIES', 'TOTAL LIABILITIES', `Rs.${(reportData.liabilities?.totalLiabilities || 0).toFixed(2)}`],
                  ['EQUITY', 'Capital Net Worth', `Rs.${(reportData.equity?.netWorth || 0).toFixed(2)}`],
                  ['EQUITY', 'TOTAL LIABILITIES & EQUITY', `Rs.${(reportData.equity?.totalLiabilitiesAndEquity || 0).toFixed(2)}`]
                ];
                break;

              default:
                // Generic fallback for any other list of objects
                if (Array.isArray(reportData)) {
                  headers = Object.keys(reportData[0] || {});
                  data = reportData.map(row => Object.values(row));
                } else if (reportData.details && Array.isArray(reportData.details)) {
                  headers = Object.keys(reportData.details[0] || {});
                  data = reportData.details.map((row: any) => Object.values(row));
                }
            }

            // 2. Trigger Export
            if (format === 'CSV') {
                const csvData = data.map(row => {
                    const obj: any = {};
                    headers.forEach((h, i) => obj[h] = row[i]);
                    return obj;
                });
                exportUtils.exportToCSV(csvData.length > 0 ? csvData : reportData, filename);
            } else {
                exportUtils.exportToPDF({ title, headers, data, filename });
            }
        } catch (error) {
            console.error('Export Failed:', error);
            alert('Failed to generate export file. Please check console for details.');
        } finally {
            setIsExporting(null);
        }
    }, 100); // Small delay to let the UI update the button state
  };

  const renderReportContent = () => {
    if (loading) return <div className="p-20 text-center animate-pulse text-brand-400">Loading Report Data...</div>;
    
    if (!reportData) {
       if (activeReport === 'party-statement' || activeReport === 'stock-detail') {
         return <div className="p-20 text-center text-slate-400">Please select an entity from the dropdown above.</div>;
       }
       return <div className="p-20 text-center text-slate-400">No data available.</div>;
    }

    // Based on activeReport, format the rendering
    switch (activeReport) {
      case 'sales':
      case 'purchase': {
        if (Array.isArray(reportData) || !reportData.summary || !reportData.details) {
          return <div className="p-20 text-center animate-pulse text-brand-400">Preparing Transactions...</div>;
        }
        return (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total {activeReport}</p>
                <h3 className="text-2xl font-black text-slate-800">₹{(activeReport === 'sales' ? reportData.summary.totalSales : reportData.summary.totalPurchases)?.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bill Count</p>
                <h3 className="text-2xl font-black text-slate-800">{reportData.summary.billCount}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Tax</p>
                <h3 className="text-2xl font-black text-slate-800">₹{reportData.summary.totalTax?.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
              <table className="w-full text-left font-sans">
                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Invoice</th>
                    {activeReport === 'sales' && <th className="p-4 text-center">Print</th>}
                    {activeReport === 'sales' ? <th className="p-4">Customer</th> : <th className="p-4">Supplier</th>}
                    <th className="p-4 text-right">Amount</th>
                    {activeReport === 'sales' && <th className="p-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {reportData.details.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <button 
                          onClick={() => {
                            const type = activeReport === 'sales' || item.type === 'SALE' ? 'SALE' : 'PURCHASE';
                            setSelectedBill({ id: item.id, type });
                          }}
                          className="text-brand-600 hover:text-brand-800 font-bold hover:underline"
                        >
                          {item.invoiceNo}
                        </button>
                      </td>
                      {activeReport === 'sales' && (
                        <td className="p-4 text-center">
                          <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                setIsFetchingPrint(item.id);
                                try {
                                    const res = await api.get(`/orders/${item.id}`);
                                    setPrintPreviewOrder(res.data);
                                } catch (err) {
                                    alert('Failed to load bill details for printing');
                                } finally {
                                    setIsFetchingPrint(null);
                                }
                            }}
                            disabled={isFetchingPrint === item.id}
                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all disabled:opacity-50"
                            title="Print Bill"
                          >
                             {isFetchingPrint === item.id ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                          </button>
                        </td>
                      )}
                      <td className="p-4">
                        {activeReport === 'sales' ? (
                          (item.customerId || item.customer?.id) ? (
                            <button 
                              onClick={() => setSelectedPartyId(item.customerId || item.customer?.id)}
                              className="text-brand-600 hover:text-brand-800 font-black hover:underline text-left"
                            >
                              {item.customer?.name || 'Walk-in'}
                            </button>
                          ) : (
                            'Walk-in'
                          )
                        ) : (
                          item.supplierName || 'Internal'
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900">₹{item.grandTotal.toFixed(2)}</td>
                      {activeReport === 'sales' && (
                        <td className="p-4 text-center">
                          <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm('Are you sure you want to permanently delete this bill? This action cannot be undone and will reverse inventory and loyalty points.')) {
                                    try {
                                        await api.delete(`/orders/${item.id}`);
                                        // Also cleanup local offline DB
                                        try { await offlineDB.delete('orders', item.id); } catch(e) {}
                                        fetchReport(); // Refresh the list
                                    } catch (err: any) {
                                        const errorData = err.response?.data;
                                        const statusCode = err.response?.status;
                                        
                                        // If server says 404, it means it's already gone from server. 
                                        // We should just clean up locally and refresh.
                                        if (statusCode === 404) {
                                            try { await offlineDB.delete('orders', item.id); } catch(e) {}
                                            fetchReport();
                                            return;
                                        }

                                        const errorMessage = errorData?.error || err.message;
                                        const errorCode = errorData?.code ? ` [Code: ${errorData.code}]` : '';
                                        alert('Failed to delete bill: ' + errorMessage + errorCode);
                                    }
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Bill"
                          >
                             <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.details.length === 0 && <div className="p-8 text-center text-slate-400">No records found.</div>}
            </div>
          </div>
        );
      }

      case 'credit-sales': {
        if (!reportData || !reportData.summary || !reportData.details) {
          return <div className="p-20 text-center animate-pulse text-brand-400">Loading Credits...</div>;
        }
        return (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Outstanding Credits</h2>
                <p className="text-xs text-slate-400 font-medium">Tracking all unpaid and partially paid invoices</p>
              </div>
              <button 
                onClick={fetchReport}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                Refresh & Sync Data
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outstanding</p>
                <h3 className="text-2xl font-black text-orange-600">₹{(reportData.summary.totalOutstanding || 0).toFixed(2)}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit Bills</p>
                <h3 className="text-2xl font-black text-slate-800">{reportData.summary.billCount || 0}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billed Amt</p>
                <h3 className="text-2xl font-black text-slate-800">₹{(reportData.summary.totalBilled || 0).toFixed(2)}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Received Amt</p>
                <h3 className="text-2xl font-black text-emerald-600">₹{(reportData.summary.totalPaid || 0).toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <tr>
                    <th className="p-6">Date</th>
                    <th className="p-6">Invoice</th>
                    <th className="p-6">Customer</th>
                    <th className="p-6 text-right">Bill Amt</th>
                    <th className="p-6 text-right">Paid</th>
                    <th className="p-6 text-right">Balance</th>
                    <th className="p-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-600">
                  {reportData.details.map((item: any) => (
                    <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="p-6">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="p-6">
                        <button 
                          onClick={() => setSelectedBill({ id: item.id, type: 'SALE' })}
                          className="text-brand-600 font-bold hover:underline"
                        >
                          {item.invoiceNo}
                        </button>
                      </td>
                      <td className="p-6">
                        <button 
                          onClick={() => setSelectedPartyId(item.customerId)}
                          className="text-brand-600 font-black hover:underline"
                        >
                          {item.customer?.name || 'Walk-in'}
                        </button>
                      </td>
                      <td className="p-6 text-right font-bold text-slate-400">₹{(item.grandTotal || 0).toFixed(2)}</td>
                      <td className="p-6 text-right font-bold text-emerald-600">₹{(item.amountPaid || 0).toFixed(2)}</td>
                      <td className="p-6 text-right font-black text-orange-600">₹{(item.balance || 0).toFixed(2)}</td>
                      <td className="p-6 text-center">
                        <button 
                          onClick={() => {
                            setSelectedSettleOrder(item);
                            setIsSettleModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-black hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1 mx-auto"
                        >
                          <Coins size={14} />
                          Settle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.details.length === 0 && <div className="p-10 text-center text-slate-400">No outstanding credits for this period.</div>}
            </div>
            {isSettleModalOpen && selectedSettleOrder && (
              <CreditSettlementModal 
                order={selectedSettleOrder} 
                onClose={() => {
                  setIsSettleModalOpen(false);
                  setSelectedSettleOrder(null);
                }} 
                onSuccess={() => {
                  fetchReport();
                  // Also refresh summary if possible, or just re-fetch the whole thing
                }}
              />
            )}
          </div>
        );
      }

      case 'payment-summary': {
        if (!reportData || typeof reportData !== 'object') {
          return <div className="p-20 text-center animate-pulse text-brand-400">Aggregating Payment Data...</div>;
        }
        
        const cashTotal = reportData['CASH'] || 0;
        const upiTotal = reportData['UPI'] || 0;
        
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-brand-100 flex flex-col justify-between group hover:shadow-xl hover:shadow-brand-primary/5 transition-all">
                <div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <IndianRupee size={24} />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Cash Revenue</p>
                  <h3 className="text-4xl font-black text-slate-900">₹{cashTotal.toFixed(2)}</h3>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                   <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase">Physical Tender</span>
                   <ArrowUpRight size={16} className="text-slate-200" />
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-between group hover:scale-[1.02] transition-all">
                <div>
                   <div className="w-12 h-12 bg-brand-primary/20 text-brand-primary rounded-2xl flex items-center justify-center mb-4">
                    <PieChart size={24} />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">UPI / Digital Revenue</p>
                  <h3 className="text-4xl font-black text-white">₹{upiTotal.toFixed(2)}</h3>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                   <span className="text-[10px] font-black text-brand-primary bg-white/10 px-2 py-1 rounded-lg uppercase">Contactless Payment</span>
                   <ArrowUpRight size={16} className="text-white/20" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-x-auto">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Revenue Breakdown</h4>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <tr>
                    <th className="p-6">Payment Mode</th>
                    <th className="p-6 text-right">Total Amount</th>
                    <th className="p-6 text-right">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {Object.entries(reportData).map(([mode, amount]: any) => {
                    const total = Object.values(reportData).reduce((s: any, a: any) => s + a, 0);
                    const share = (amount / total) * 100;
                    return (
                      <tr key={mode} className="hover:bg-brand-50/30 transition-colors group">
                        <td className="p-6">
                           <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${mode === 'CASH' ? 'bg-emerald-500' : mode === 'UPI' ? 'bg-brand-primary' : 'bg-slate-300'}`} />
                              <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">{mode}</span>
                           </div>
                        </td>
                        <td className="p-6 text-right font-black text-slate-900">₹{amount.toFixed(2)}</td>
                        <td className="p-6 text-right">
                           <div className="flex items-center justify-end gap-3 text-xs font-black">
                              <span className="text-slate-400">{share.toFixed(1)}%</span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-x-auto">
                                <div 
                                  className={`h-full rounded-full ${mode === 'CASH' ? 'bg-emerald-500' : mode === 'UPI' ? 'bg-brand-primary' : 'bg-slate-300'}`}
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-black">
                   <tr>
                      <td className="p-6 uppercase tracking-widest text-xs">Total Combined Revenue</td>
                      <td className="p-6 text-right text-xl">
                        ₹{Object.values(reportData).reduce((s: any, a: any) => s + a, 0).toFixed(2)}
                      </td>
                      <td className="p-6 text-right text-xs text-slate-400">100%</td>
                   </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      }

      case 'credit-notes':
      case 'debit-notes': {
        const isCreditNote = activeReport === 'credit-notes';
        if (Array.isArray(reportData) || !reportData.summary || !reportData.details) {
          return <div className="p-20 text-center animate-pulse text-brand-400">Loading {isCreditNote ? 'Credit' : 'Debit'} Notes...</div>;
        }
        return (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total {isCreditNote ? 'Refunded' : 'Returned Amount'}</p>
                <h3 className={`text-2xl font-black ${isCreditNote ? 'text-red-600' : 'text-brand-600'}`}>₹{reportData.summary.totalReturns?.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Return Count</p>
                <h3 className="text-2xl font-black text-slate-800">{reportData.summary.count}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tax Reversed</p>
                <h3 className="text-2xl font-black text-slate-800">₹{reportData.summary.totalTax?.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
              <table className="w-full text-left font-sans">
                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Return No</th>
                    <th className="p-4">{isCreditNote ? 'Customer' : 'Supplier'}</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {reportData.details.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-brand-600 font-bold">{item.returnNo}</td>
                      <td className="p-4">
                        {isCreditNote ? (
                          item.customerId ? (
                            <button 
                              onClick={() => setSelectedPartyId(item.customerId)}
                              className="text-brand-600 hover:text-brand-800 font-black hover:underline text-left"
                            >
                              {item.customer?.name || 'Walk-in'}
                            </button>
                          ) : (
                            'Walk-in'
                          )
                        ) : (
                          item.supplierName || 'N/A'
                        )}
                      </td>
                      <td className="p-4 text-right font-black text-slate-900">₹{item.totalAmount.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setSelectedReturn(item)}
                          className="text-brand-600 hover:text-brand-900 font-bold text-xs uppercase underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.details.length === 0 && <div className="p-8 text-center text-slate-400">No {isCreditNote ? 'credit' : 'debit'} notes found for this period.</div>}
            </div>
          </div>
        );
      }
      
      case 'profit-loss': {
        if (Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Calculating...</div>;
        return (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-600">Total Sales</span>
              <span className="font-black text-xl text-slate-800">₹{reportData.salesAmount?.toFixed(2)}</span>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center text-red-500">
              <span className="font-bold">Cost of Goods Sold</span>
              <span className="font-black text-xl">- ₹{reportData.cogs?.toFixed(2)}</span>
            </div>
            <div className="h-px bg-slate-200"></div>
            <div className={`${reportData.grossProfit < 0 ? 'bg-red-50 border-red-100' : 'bg-brand-50 border-brand-100'} p-6 rounded-2xl border flex justify-between items-center transition-colors`}>
              <span className={`font-bold ${reportData.grossProfit < 0 ? 'text-red-600' : 'text-brand-600'}`}>{reportData.grossProfit < 0 ? 'Gross Loss' : 'Gross Profit'}</span>
              <span className={`font-black text-2xl ${reportData.grossProfit < 0 ? 'text-red-700' : 'text-brand-700'}`}>₹{Math.abs(reportData.grossProfit)?.toFixed(2)}</span>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center text-red-500">
              <span className="font-bold">Total Expenses</span>
              <span className="font-black text-xl">- ₹{reportData.expenses?.toFixed(2)}</span>
            </div>
            <div className="h-0.5 bg-slate-300"></div>
            <div className={`${(Number(reportData.netProfit) || 0) < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'} p-6 rounded-2xl border flex justify-between items-center transition-all duration-500 shadow-sm`}>
              <span className={`font-black text-lg ${(Number(reportData.netProfit) || 0) < 0 ? 'text-red-700' : 'text-emerald-700'} uppercase tracking-widest`}>
                {(Number(reportData.netProfit) || 0) < 0 ? 'Net Loss' : 'Net Profit'}
              </span>
              <span className={`font-black text-4xl ${(Number(reportData.netProfit) || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                ₹{Math.abs(Number(reportData.netProfit) || 0).toFixed(2)}
              </span>
            </div>
          </div>
        );
      }

      case 'daybook':
      case 'transactions':
      case 'cashflow': {
        if (Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Streamlining logs...</div>;
        return (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border-l-4 border-green-500 shadow-sm">
                <p className="text-xs font-bold text-slate-400">Cash In</p>
                <h3 className="text-xl font-black text-green-600">₹{reportData.cashIn?.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-red-500 shadow-sm">
                <p className="text-xs font-bold text-slate-400">Cash Out</p>
                <h3 className="text-xl font-black text-red-600">₹{reportData.cashOut?.toFixed(2)}</h3>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl shadow-sm text-white">
                <p className="text-xs font-bold text-slate-400">Net Flow</p>
                <h3 className="text-xl font-black">₹{reportData.netBalance?.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-center">Time</th>
                    <th className="p-4 text-center">Type</th>
                    <th className="p-4">Details</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {reportData.transactions?.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600 font-bold">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="p-4 text-slate-500 text-center">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-black ${t.type === 'SALE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-800">
                        {t.customerId ? (
                          <button 
                            onClick={() => setSelectedPartyId(t.customerId)}
                            className="text-brand-600 hover:text-brand-800 font-black hover:underline text-left mr-2"
                          >
                            {t.details.split(': ')[0]}:
                          </button>
                        ) : (
                          <span>{t.details.split(': ')[0]}: </span>
                        )}
                        <button 
                          onClick={() => {
                            const type = (t.type === 'SALE' || t.type === 'TRANSFER') ? 'SALE' : 'PURCHASE';
                            if (t.id) setSelectedBill({ id: t.id, type });
                          }}
                          className={`${t.id ? 'text-brand-600 hover:text-brand-800 font-bold hover:underline' : 'text-slate-600'}`}
                        >
                          {t.details}
                        </button>
                      </td>
                      <td className={`p-4 text-right font-black ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.amount > 0 ? '+' : ''}₹{Math.abs(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'stock-summary': {
        if (Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Counting Stock...</div>;
        return (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase">Inventory Cost Value</p>
                <h3 className="text-3xl font-black text-slate-800">₹{reportData.summary?.totalStockValue?.toFixed(2)}</h3>
              </div>
              <div className="bg-brand-50 border border-brand-100 p-6 rounded-2xl">
                <p className="text-xs font-bold text-brand-400 uppercase">Retail Potential Value</p>
                <h3 className="text-3xl font-black text-brand-700">₹{reportData.summary?.totalRetailValue?.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-4">Item</th>
                    <th className="p-4 text-center">In Stock</th>
                    <th className="p-4 text-right">Cost Price</th>
                    <th className="p-4 text-right">Retail Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.details?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="p-4 font-bold text-slate-800">{item.name}</td>
                      <td className="p-4 text-center font-black text-brand-600">{item.stockQuantity}</td>
                      <td className="p-4 text-right text-slate-500 font-medium">₹{item.purchasePrice?.toFixed(2)}</td>
                      <td className="p-4 text-right font-bold text-slate-900">₹{item.sellingPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'expenses': {
        if (Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Summing Expenses...</div>;
        return (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Total Expenses</p>
                <h3 className="text-3xl font-black text-red-600">₹{reportData.total?.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 font-medium">
                  {reportData.details?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="p-4 font-bold text-slate-900">{item.type}</td>
                      <td className="p-4 text-slate-500">{item.description || '-'}</td>
                      <td className="p-4 text-right font-black text-red-600">₹{item.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                  {reportData.details?.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No expenses found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'parties':
      case 'party-profit':
      case 'item-profit': {
        const isParty = activeReport === 'parties';
        const isItemProfit = activeReport === 'item-profit';
        
        if (!Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Switching Data Streams...</div>;

        const totals = reportData.reduce((acc: any, curr: any) => ({
          qty: acc.qty + (curr.qtySold || 0),
          revenue: acc.revenue + (curr.totalSales || curr.revenue || 0),
          cost: acc.cost + (curr.cogs || curr.cost || 0),
          profit: acc.profit + (curr.profit || 0)
        }), { qty: 0, revenue: 0, cost: 0, profit: 0 });

        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                <tr>
                  <th className="p-4">{isItemProfit ? 'Item Name' : 'Party Name'}</th>
                  {isParty ? (
                    <>
                      <th className="p-4 text-center">Phone</th>
                      <th className="p-4 text-center">Loyalty Pts</th>
                      <th className="p-4 text-right">Credit Bal</th>
                      <th className="p-4 text-right">Total Spent</th>
                    </>
                  ) : (
                    <>
                      {isItemProfit && <th className="p-4 text-center">Qty Sold</th>}
                      <th className="p-4 text-right">Sales Revenue</th>
                      <th className="p-4 text-right">COGS / Cost</th>
                      <th className="p-4 text-right">Net Profit</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 font-medium">
                {reportData.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900 border-r border-slate-50">
                      {isParty ? (
                        <button 
                          onClick={() => setSelectedPartyId(item.id)}
                          className="text-brand-600 hover:text-brand-800 font-black hover:underline text-left"
                        >
                          {item.name}
                        </button>
                      ) : (
                        item.name
                      )}
                    </td>
                    {isParty ? (
                      <>
                        <td className="p-4 text-center">{item.phone || '-'}</td>
                        <td className="p-4 text-center text-brand-600 font-bold">{item.loyaltyPoints}</td>
                        <td className="p-4 text-right font-bold text-slate-600">₹{item.creditBalance?.toFixed(2)}</td>
                        <td className="p-4 text-right font-black text-slate-800">₹{item.totalSpent?.toFixed(2)}</td>
                      </>
                    ) : (
                      <>
                        {isItemProfit && <td className="p-4 text-center font-black text-brand-600">{item.qtySold}</td>}
                        <td className="p-4 text-right font-bold text-green-600">₹{(item.totalSales || item.revenue)?.toFixed(2)}</td>
                        <td className="p-4 text-right text-red-500">₹{(item.cogs || item.cost)?.toFixed(2)}</td>
                        <td className="p-4 text-right font-black text-emerald-600">
                          {item.id ? (
                            <button 
                              onClick={() => setSelectedPartyId(item.id)}
                              className="hover:underline text-left"
                            >
                              ₹{item.profit?.toFixed(2)}
                            </button>
                          ) : (
                            `₹${item.profit?.toFixed(2)}`
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={isParty ? 5 : (isItemProfit ? 5 : 4)} className="p-12 text-center text-slate-400">
                      No matching records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              {!isParty && reportData.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-black text-sm">
                  <tr>
                    <td className="p-4 uppercase tracking-widest text-xs">Grand Totals</td>
                    {isItemProfit && <td className="p-4 text-center">{totals.qty}</td>}
                    <td className="p-4 text-right">₹{totals.revenue.toFixed(2)}</td>
                    <td className="p-4 text-right">₹{totals.cost.toFixed(2)}</td>
                    <td className="p-4 text-right">₹{totals.profit.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        );
      }

      case 'party-statement': {
        return (
          <div>
             <div className="bg-brand-50 p-6 rounded-2xl mb-6 flex justify-between items-center border border-brand-100">
               <div>
                 <button 
                    onClick={() => setSelectedPartyId(selectedEntityId)}
                    className="text-2xl font-black text-brand-900 hover:text-brand-600 hover:underline text-left block"
                  >
                    {reportData.name}
                  </button>
                 <p className="text-sm font-bold text-brand-500">{reportData.phone}</p>
               </div>
               <div className="text-right">
                 <p className="text-xs uppercase font-bold text-brand-400">Total Spent</p>
                 <h3 className="text-2xl font-black text-brand-700">₹{reportData.totalSpent?.toFixed(2)}</h3>
               </div>
             </div>
             <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Invoice</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 font-medium">
                  {reportData.orders?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-4">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 font-bold text-slate-800">{item.invoiceNo}</td>
                      <td className="p-4"><span className="bg-green-100 text-green-600 px-2 py-1 rounded-md text-[10px] uppercase font-black">{item.status}</span></td>
                      <td className="p-4 text-right font-black text-slate-900">₹{item.grandTotal?.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!reportData.orders || reportData.orders.length === 0) && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No orders found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'suppliers': {
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                <tr>
                  <th className="p-4">Supplier Name</th>
                  <th className="p-4 text-right">Total Purchases</th>
                  <th className="p-4 text-right text-red-500">Total Balance</th>
                  <th className="p-4 text-center">Last Interaction</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 font-medium">
                {reportData.map((s: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                        <button 
                           onClick={() => { setActiveReport('supplier-ledger'); setSelectedEntityId(s.name); }}
                           className="text-brand-600 hover:text-brand-800 font-black hover:underline text-left"
                        >
                            {s.name}
                        </button>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-700">₹{s.totalPurchases.toFixed(2)}</td>
                    <td className="p-4 text-right font-black text-red-600">₹{s.totalBalance.toFixed(2)}</td>
                    <td className="p-4 text-center text-slate-500">{new Date(s.lastPurchase).toLocaleDateString()}</td>
                  </tr>
                ))}
                {reportData.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No suppliers found.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      }

      case 'supplier-ledger': {
        return (
          <div>
             <div className="bg-orange-50 p-6 rounded-2xl mb-6 flex justify-between items-center border border-orange-100 shadow-sm">
                <div>
                   <h2 className="text-2xl font-black text-orange-900">{reportData.name}</h2>
                   <p className="text-sm font-bold text-orange-500 uppercase tracking-widest">Party Ledger</p>
                </div>
                <div className="text-right">
                   <p className="text-xs uppercase font-bold text-orange-400">Net Outstanding</p>
                   <h3 className="text-3xl font-black text-red-600">₹{reportData.totalBalance?.toFixed(2)}</h3>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Purchases</p>
                    <p className="text-xl font-black text-slate-800">₹{reportData.totalPurchases?.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Paid</p>
                    <p className="text-xl font-black text-green-600">₹{reportData.totalPaid?.toFixed(2)}</p>
                </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                    <tr>
                      <th className="p-4">Date</th>
                      <th className="p-4">Invoice</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Bill Amt</th>
                      <th className="p-4 text-right text-red-500">Balance</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 font-medium">
                    {reportData.purchases?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-4">{new Date(p.date || p.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 font-bold text-slate-800">{p.invoiceNo}</td>
                        <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                p.paymentStatus === 'PAID' ? 'bg-green-100 text-green-600' : 
                                p.paymentStatus === 'PARTIAL' ? 'bg-orange-100 text-orange-600' : 
                                'bg-red-100 text-red-600'
                            }`}>
                                {p.paymentStatus}
                            </span>
                        </td>
                        <td className="p-4 text-right font-bold">₹{p.grandTotal.toFixed(2)}</td>
                        <td className="p-4 text-right font-black text-red-600">₹{p.balanceDue.toFixed(2)}</td>
                        <td className="p-4 text-center">
                            {p.balanceDue > 0 && (
                                <button 
                                    onClick={() => setSelectedPurchase(p)}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all font-black text-xs flex items-center gap-1 mx-auto"
                                >
                                    <span className="text-[14px]">₹</span> Pay
                                </button>
                            )}
                        </td>
                      </tr>
                    ))}
                    {(!reportData.purchases || reportData.purchases.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transactions for this supplier.</td></tr>}
                  </tbody>
                </table>
             </div>
          </div>
        );
      }

      case 'balance-sheet': {
        return (
          <div className="max-w-xl mx-auto space-y-6">
             {/* Assets */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-lg font-black text-slate-800 border-b pb-4 mb-4 flex justify-between">
                  <span>Assets</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current & Fixed</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-1 text-slate-600 font-medium">
                    <span>Cash & Bank Balance</span>
                    <span className="font-bold text-slate-800">₹{reportData.assets?.cashBalance?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 text-slate-600 font-medium">
                    <span>Inventory Cost Value</span>
                    <span className="font-bold text-slate-800">₹{reportData.assets?.inventoryValue?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 text-slate-600 font-medium">
                    <span>Receivables (Customer Credits)</span>
                    <span className="font-bold text-slate-800">₹{reportData.assets?.receivables?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-4 mt-2 border-t border-dashed font-black text-lg text-brand-600">
                    <span>Total Assets</span>
                    <span>₹{reportData.assets?.totalAssets?.toFixed(2)}</span>
                  </div>
                </div>
             </div>

             {/* Liabilities */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
                <h3 className="text-lg font-black text-slate-800 border-b pb-4 mb-4 flex justify-between">
                  <span>Liabilities</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payables & Obligations</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-1 text-slate-600 font-medium">
                    <span>Supplier Payables (Unsettled Bills)</span>
                    <span className="font-bold text-slate-800">₹{reportData.liabilities?.payables?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-4 mt-2 border-t border-dashed font-black text-lg text-red-600">
                    <span>Total Liabilities</span>
                    <span>₹{reportData.liabilities?.totalLiabilities?.toFixed(2)}</span>
                  </div>
                </div>
             </div>

             {/* Equity */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 bg-brand-50/50 border-brand-100 animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
                <h3 className="text-lg font-black text-slate-800 border-b border-brand-100 pb-4 mb-4 flex justify-between">
                  <span>Equity & Capital</span>
                  <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Net Worth</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-1 text-slate-600 font-medium">
                    <span>Capital Net Worth (Assets - Liabilities)</span>
                    <span className={`font-black ${reportData.equity?.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{reportData.equity?.netWorth?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-4 mt-2 border-t border-brand-100 font-black text-lg text-slate-900">
                    <span>Total Liabilities & Equity</span>
                    <span>₹{reportData.equity?.totalLiabilitiesAndEquity?.toFixed(2)}</span>
                  </div>
                </div>
             </div>
          </div>
        );
      }

      case 'stock-detail': {
        return (
          <div>
            <div className="bg-white p-6 rounded-2xl mb-6 shadow-sm border flex justify-between items-center">
               <div>
                 <h2 className="text-2xl font-black text-slate-900">{reportData.name}</h2>
                 <p className="text-sm font-bold text-slate-500">Barcode: {reportData.barcode || 'N/A'} | Unit: {reportData.unit}</p>
               </div>
               <div className="flex gap-4 text-right">
                 <div>
                   <p className="text-[10px] uppercase font-bold text-slate-400">Current Stock</p>
                   <h3 className="text-2xl font-black text-brand-600">{reportData.stockQuantity}</h3>
                 </div>
               </div>
             </div>
             <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <div className="p-4 bg-slate-50 border-b font-bold text-slate-700">Inventory Logs</div>
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="p-4">Date</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Quantity</th>
                      <th className="p-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm font-medium">
                    {reportData.inventoryLogs?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="p-4 font-black">
                          <span className={`px-2 py-1 rounded text-[10px] uppercase ${log.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="p-4 font-black text-slate-800">{log.type === 'IN' ? '+' : '-'}{log.quantity}</td>
                        <td className="p-4 text-slate-500">{log.reason || '-'}</td>
                      </tr>
                    ))}
                    {(!reportData.inventoryLogs || reportData.inventoryLogs.length === 0) && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400">No inventory history found.</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        );
      }

      case 'waiter-sales': {
        if (!Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Loading Waiter Sales...</div>;
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                <tr>
                  <th className="p-4">Waiter Name</th>
                  <th className="p-4 text-center">Order Count</th>
                  <th className="p-4 text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 font-medium">
                {reportData.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{item.name}</td>
                    <td className="p-4 text-center font-bold text-brand-600">{item.orderCount}</td>
                    <td className="p-4 text-right font-black text-emerald-600">₹{item.totalSales.toFixed(2)}</td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400">No waiter sales recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case 'table-sales': {
        if (!Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Loading Table Sales...</div>;
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                <tr>
                  <th className="p-4">Table Name</th>
                  <th className="p-4 text-center">Order Count</th>
                  <th className="p-4 text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 font-medium">
                {reportData.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{item.number}</td>
                    <td className="p-4 text-center font-bold text-brand-600">{item.orderCount}</td>
                    <td className="p-4 text-right font-black text-emerald-600">₹{item.totalSales.toFixed(2)}</td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400">No table sales recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case 'kot-reports': {
        if (!Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Loading KOT History...</div>;
        return (
          <div className="space-y-4">
            {reportData.map((kot: any) => (
              <div key={kot.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start border-b pb-4 mb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">KOT #{kot.kotNo}</h3>
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      <span>Table: {kot.tableName || 'N/A'}</span>
                      <span>Waiter: {kot.waiterName || 'N/A'}</span>
                      <span>Mode: {kot.orderType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      kot.status === 'SERVED' ? 'bg-green-100 text-green-700' :
                      kot.status === 'READY' ? 'bg-blue-100 text-blue-700' :
                      kot.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
                      kot.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {kot.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(kot.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {kot.items?.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="flex justify-between items-center text-sm font-semibold text-slate-700">
                      <div className="flex-1">
                        <span>{item.name}</span>
                        {item.variant && <span className="text-xs text-slate-400 ml-2">({item.variant})</span>}
                        {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                          <span className="text-xs text-slate-400 block font-normal pl-4">
                            + {item.modifiers.map((m: any) => m.name).join(', ')}
                          </span>
                        )}
                        {item.notes && <span className="text-xs text-orange-500 block font-normal pl-4">* Note: {item.notes}</span>}
                      </div>
                      <span className="font-bold text-slate-900">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {reportData.length === 0 && (
              <div className="bg-white p-8 rounded-xl text-center text-slate-400 border shadow-sm">No KOT history found.</div>
            )}
          </div>
        );
      }

      case 'cancelled-items': {
        if (!Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Loading Cancelled Items...</div>;
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">Item Name</th>
                  <th className="p-4 text-center">KOT No</th>
                  <th className="p-4 text-center">Table / Waiter</th>
                  <th className="p-4 text-center">Qty</th>
                  <th className="p-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 font-medium">
                {reportData.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-xs text-slate-500">{new Date(item.createdAt || item.kot?.createdAt).toLocaleString()}</td>
                    <td className="p-4 font-bold text-slate-900">
                      {item.name}
                      {item.variant && <span className="text-xs text-slate-400 ml-2">({item.variant})</span>}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-500">KOT #{item.kot?.kotNo}</td>
                    <td className="p-4 text-center text-slate-600 text-xs">
                      {item.kot?.tableName || 'Takeaway'} {item.kot?.waiterName ? `/ ${item.kot.waiterName}` : ''}
                    </td>
                    <td className="p-4 text-center font-bold text-red-600">{item.quantity}</td>
                    <td className="p-4 text-slate-500 text-xs italic">{item.cancelReason || item.notes || 'No reason'}</td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">No cancelled items found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      case 'discounts-report': {
        if (!Array.isArray(reportData)) return <div className="p-20 text-center animate-pulse text-brand-400">Loading Discounts...</div>;
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase border-b">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Invoice</th>
                  <th className="p-4 text-right">Discount Given</th>
                  <th className="p-4 text-right">Bill Total</th>
                  <th className="p-4">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 font-medium">
                {reportData.map((order: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-slate-800">{order.invoiceNo}</td>
                    <td className="p-4 text-right font-bold text-red-600">₹{order.discount.toFixed(2)}</td>
                    <td className="p-4 text-right font-black text-slate-900">₹{order.grandTotal.toFixed(2)}</td>
                    <td className="p-4 text-slate-600">{order.creator?.name || 'Staff'}</td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">No discounts given in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return (
          <div className="bg-white p-8 rounded-2xl shadow-sm border">
            <pre className="text-xs text-slate-600 overflow-auto max-h-[600px] bg-slate-50 p-4 rounded-xl">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </div>
        );
    }
  };


  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-slate-100 font-sans">
      {/* Mobile Report Selector */}
      <div className="md:hidden p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 px-1">Select Report</label>
        <select 
          value={activeReport}
          onChange={(e) => { setReportData(null); setActiveReport(e.target.value); setSelectedEntityId(''); }}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
        >
          {reportCategories.map(cat => (
            <optgroup key={cat.title} label={cat.title}>
              {cat.reports.map(report => (
                <option key={report.id} value={report.id}>{report.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop Sidebar / Report Categories */}
      <div className="hidden md:block w-full md:w-64 bg-white border-r border-slate-200 p-4 overflow-y-auto flex-shrink-0 pb-20">
        <h2 className="font-black text-2xl text-slate-800 mb-6 px-2">Reports</h2>
        <div className="space-y-6">
          {reportCategories.map((cat, i) => (
             <div key={i}>
               <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 px-2">{cat.title}</h3>
               <div className="space-y-1">
                 {cat.reports.map(report => (
                   <button
                     key={report.id}
                     onClick={() => { setReportData(null); setActiveReport(report.id); setSelectedEntityId(''); }}
                     className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold ${
                       activeReport === report.id 
                         ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' 
                         : 'text-slate-600 hover:bg-slate-50 hover:text-brand-600'
                     }`}
                   >
                     {report.icon}
                     {report.name}
                   </button>
                 ))}
               </div>
             </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          {/* Report Content - Header with Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                {reportCategories.flatMap(c => c.reports).find(r => r.id === activeReport)?.name}
              </h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Data Analysis & Archival</p>
            </div>

            {reportData && (
              <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                  onClick={() => handleExport('CSV')}
                  disabled={isExporting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all border border-emerald-100 disabled:opacity-50"
                >
                  {isExporting === 'CSV' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} 
                  {isExporting === 'CSV' ? 'DOWNLOADING...' : 'EXPORT CSV'}
                </button>
                <button 
                  onClick={() => handleExport('PDF')}
                  disabled={isExporting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-100 transition-all border border-red-100 disabled:opacity-50"
                >
                  {isExporting === 'PDF' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} 
                  {isExporting === 'PDF' ? 'GENERATING...' : 'EXPORT PDF'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Entity Selectors (Only visible for certain reports) */}
            {(activeReport === 'party-statement') && (
              <select 
                value={selectedEntityId} 
                onChange={e => setSelectedEntityId(e.target.value)}
                className="w-full md:w-auto bg-white border rounded-xl px-4 py-2 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Customer...</option>
                {entities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>)}
              </select>
            )}

            {(activeReport === 'stock-detail') && (
              <select 
                value={selectedEntityId} 
                onChange={e => setSelectedEntityId(e.target.value)}
                className="w-full md:w-auto bg-white border rounded-xl px-4 py-2 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Product...</option>
                {entities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            {/* Date Filters (Hidden for some static reports like parties, stock-summary) */}
            {['parties', 'stock-summary', 'balance-sheet'].indexOf(activeReport) === -1 && (
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                <Calendar className="w-5 h-5 ml-2 text-slate-400" />
                <select 
                  className="bg-transparent border-none text-sm font-bold text-slate-700 focus:outline-none focus:ring-0 mr-2 py-1.5"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="Today">Today</option>
                  <option value="Week">This Week</option>
                  <option value="Month">This Month</option>
                  <option value="Custom">Custom Range</option>
                  <option value="All">All Time</option>
                </select>
              </div>
            )}

            <button
              onClick={async () => {
                if (!isOnline) {
                  alert('You are offline. Please connect to the internet to sync.');
                  return;
                }
                try {
                  setLoading(true);
                  await processSyncQueue();
                  await fetchReport();
                  alert('Sync process completed successfully!');
                } catch (e: any) {
                  alert('Sync failed: ' + e.message);
                } finally {
                  setLoading(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100/50 rounded-xl font-black text-xs transition-all shadow-sm font-sans"
              title="Force Sync Offline Bills to Database"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              SYNC OFFLINE BILLS
            </button>
          </div>
        </div>

        {/* Custom Date Inputs */}
        {dateFilter === 'Custom' && ['parties', 'stock-summary', 'balance-sheet'].indexOf(activeReport) === -1 && (
          <div className="flex gap-4 mb-6">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="p-2 border rounded-xl text-sm font-medium" />
            <span className="self-center font-bold text-slate-400">To</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="p-2 border rounded-xl text-sm font-medium" />
          </div>
        )}

        <div className="w-full">
          {renderReportContent()}
        </div>
      </div>

      {/* Credit Note Detailed View Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                 <h3 className="text-lg font-black uppercase tracking-tight">{activeReport === 'debit-notes' ? 'Debit' : 'Credit'} Note Details</h3>
                 <p className="text-[10px] font-bold text-slate-400">{selectedReturn.returnNo} | {new Date(selectedReturn.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedReturn(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
               <div className={`${activeReport === 'debit-notes' ? 'bg-red-50 border-red-100' : 'bg-brand-50 border-brand-100'} p-4 rounded-2xl border`}>
                 <p className={`text-[10px] font-black uppercase ${activeReport === 'debit-notes' ? 'text-red-400' : 'text-brand-400'} mb-1`}>
                   {activeReport === 'debit-notes' ? 'Supplier Name' : 'Customer Name'}
                 </p>
                 <p className={`text-lg font-black ${activeReport === 'debit-notes' ? 'text-red-900' : 'text-brand-900'}`}>
                   {activeReport === 'debit-notes' ? selectedReturn.supplierName : (selectedReturn.customer?.name || 'Walk-in')}
                 </p>
               </div>

               <div>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Returned Items</p>
                 <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                   {selectedReturn.returnItems?.map((item: any, i: number) => (
                     <div key={i} className="flex justify-between items-start py-3 border-b border-slate-100 last:border-none text-sm font-bold">
                       <div>
                         <p className="text-slate-800">{item.product?.name}</p>
                         <p className="text-xs text-slate-500">{item.quantity} {item.product?.unit || 'Nos'} x ₹{item.price}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-slate-900">₹{item.total.toFixed(2)}</p>
                         {item.taxAmount > 0 && <p className="text-[10px] text-emerald-500">Tax: ₹{item.taxAmount?.toFixed(2)}</p>}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="space-y-2 pt-2 border-t-2 border-dashed border-slate-100">
                 <div className="flex justify-between text-xs text-slate-500 font-bold">
                   <span>Subtotal</span>
                   <span>₹{selectedReturn.subtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-xs text-slate-500 font-bold">
                   <span>Tax Amount</span>
                   <span>₹{selectedReturn.taxTotal.toFixed(2)}</span>
                 </div>
                  <div className="flex justify-between py-3 mt-2 border-t font-black">
                    <span className="text-lg text-slate-800">Total {activeReport === 'debit-notes' ? 'Return' : 'Refund'}</span>
                    <span className={`text-2xl ${activeReport === 'debit-notes' ? 'text-brand-600' : 'text-red-600'}`}>₹{selectedReturn.totalAmount.toFixed(2)}</span>
                  </div>
               </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex justify-end">
               <button onClick={() => setSelectedReturn(null)} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-tight">
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Party Details & Edit Modal */}
      {selectedPartyId && (
        <PartyDetailsModal 
          partyId={selectedPartyId} 
          onClose={() => setSelectedPartyId(null)} 
          onUpdate={fetchReport}
        />
      )}
      {/* Bill Details & Edit Modal */}
      {selectedBill && (
        <BillDetailsModal 
          billId={selectedBill.id}
          type={selectedBill.type}
          onClose={() => setSelectedBill(null)}
          onUpdate={fetchReport}
        />
      )}
      {/* Record Payment Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 pb-4">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                       <h3 className="text-xl font-black text-slate-800">Record Payment</h3>
                       <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Bill: {selectedPurchase.invoiceNo}</p>
                    </div>
                    <button onClick={() => setSelectedPurchase(null)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all"><Plus className="rotate-45" size={24} /></button>
                 </div>
                 
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6">
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">Balance Due</p>
                    <h4 className="text-2xl font-black text-red-600">₹{selectedPurchase.balanceDue.toFixed(2)}</h4>
                 </div>

                 <div className="relative group">
                    <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">Amount Paid (₹)</label>
                    <input 
                       type="number"
                       autoFocus
                       value={paymentAmount}
                       onChange={(e) => setPaymentAmount(e.target.value)}
                       placeholder={selectedPurchase.balanceDue.toString()}
                       className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-brand-500 focus:ring-0 font-black text-lg text-slate-800 placeholder:text-slate-200"
                    />
                 </div>
              </div>

              <div className="p-8 pt-4 flex gap-3">
                 <button 
                    onClick={() => setSelectedPurchase(null)}
                    className="flex-1 p-4 bg-slate-50 text-slate-400 font-black rounded-2xl hover:bg-slate-100 transition-all text-sm uppercase"
                 >
                   Cancel
                 </button>
                 <button 
                    onClick={handleRecordPayment}
                    disabled={isPaying || !paymentAmount}
                    className="flex-[2] p-4 bg-brand-600 text-white font-black rounded-2xl shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all text-sm uppercase flex items-center justify-center gap-2"
                 >
                   {isPaying ? 'Processing...' : 'Confirm Payment'}
                 </button>
              </div>
           </div>
        </div>
      )}
      
      {/* Print Preview Modal */}
      {printPreviewOrder && (
        <ReceiptPreview
          order={printPreviewOrder}
          onClose={() => setPrintPreviewOrder(null)}
        />
      )}
    </div>
  );
};

export default Reports;
