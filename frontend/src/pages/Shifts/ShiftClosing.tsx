import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Coins, TrendingUp, Printer, CheckCircle, RefreshCw } from 'lucide-react';
import useRestaurantStore from '../../store/restaurantStore';

const ShiftClosing = () => {
  const { activeShift, checkActiveShift, openShift, closeShift } = useRestaurantStore();
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkActiveShift();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cash = parseFloat(openingCashInput);
    if (isNaN(cash) || cash < 0) {
      setError('Please enter a valid starting drawer cash amount.');
      return;
    }

    setLoading(true);
    try {
      await openShift(cash);
      setOpeningCashInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cash = parseFloat(actualCashInput);
    if (isNaN(cash) || cash < 0) {
      setError('Please enter a valid actual drawer cash amount.');
      return;
    }

    setLoading(true);
    try {
      await closeShift(cash, closingNotes);
      setActualCashInput('');
      setClosingNotes('');
      alert('Shift closed successfully! Closing summary ready.');
      // Refresh shift status
      checkActiveShift();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSummary = () => {
    if (!activeShift) return;
    const printWindow = window.open('', '_blank');
    const expectedCash = activeShift.openingCash + activeShift.cashSales - activeShift.expenses - activeShift.refunds;
    
    printWindow?.document.write(`
      <html>
        <head>
          <title>Shift Report</title>
          <style>
            body { font-family: monospace; padding: 20px; font-size: 14px; width: 300px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .flex { display: flex; justify-content: space-between; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="center bold">JUDE'S KITCHEN</div>
          <div class="center">SHIFT DRAWER REPORT</div>
          <div class="divider"></div>
          <div class="flex"><span>Cashier:</span><span>${activeShift.cashierName}</span></div>
          <div class="flex"><span>Opened:</span><span>${new Date(activeShift.openingTime).toLocaleTimeString()}</span></div>
          <div class="divider"></div>
          <div class="flex"><span>Opening Cash:</span><span>Rs. ${activeShift.openingCash.toFixed(2)}</span></div>
          <div class="flex"><span>Cash Sales:</span><span>Rs. ${activeShift.cashSales.toFixed(2)}</span></div>
          <div class="flex"><span>UPI Sales:</span><span>Rs. ${activeShift.upiSales.toFixed(2)}</span></div>
          <div class="flex"><span>Card Sales:</span><span>Rs. ${activeShift.cardSales.toFixed(2)}</span></div>
          <div class="flex"><span>Credit/Dues:</span><span>Rs. ${activeShift.creditSales.toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="flex"><span>Expenses Paid:</span><span>Rs. ${activeShift.expenses.toFixed(2)}</span></div>
          <div class="flex"><span>Refunds Paid:</span><span>Rs. ${activeShift.refunds.toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="flex bold"><span>Expected Drawer Cash:</span><span>Rs. ${expectedCash.toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="center bold">THANK YOU</div>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `);
    printWindow?.document.close();
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      <div className="max-w-xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-2">Shift & Drawer Closing</h1>
          <p className="text-slate-500 font-medium text-xs md:text-sm">Manage cashier cycles, reconcile cash, and close registers.</p>
        </header>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl flex items-center gap-3 font-bold text-xs">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {activeShift ? (
          /* Shift is OPEN, show reconciliations */
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden animate-in fade-in duration-300">
            <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Active Register</p>
                <h2 className="text-xl font-bold">{activeShift.cashierName}</h2>
                <p className="text-[10px] text-brand-300 font-bold mt-1">
                  Opened: {new Date(activeShift.openingTime).toLocaleString()}
                </p>
              </div>

              <button 
                onClick={handlePrintSummary}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-white font-bold text-xs uppercase flex items-center gap-1.5 transition-all"
              >
                <Printer size={16} /> Print Status
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Sales breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Drawer Starting Cash</span>
                  <span className="text-xl font-black text-slate-800">₹{activeShift.openingCash.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">UPI Sales (Non-Cash)</span>
                  <span className="text-xl font-black text-slate-800">₹{activeShift.upiSales.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Cash Payments (Sales)</span>
                  <span className="text-xl font-black text-emerald-600">₹{activeShift.cashSales.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Expenses & Payouts</span>
                  <span className="text-xl font-black text-red-500">₹{(activeShift.expenses + activeShift.refunds).toFixed(2)}</span>
                </div>
              </div>

              {/* Total calculations */}
              <div className="border-t border-dashed border-slate-200 pt-6">
                <div className="flex justify-between items-center bg-brand-50 p-4 rounded-2xl border border-brand-100">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Expected Cash in Drawer</span>
                    <span className="text-[10px] text-slate-500">Opening + Cash Sales - Expenses</span>
                  </div>
                  <span className="text-2xl font-black text-brand-primary">
                    ₹{(activeShift.openingCash + activeShift.cashSales - activeShift.expenses - activeShift.refunds).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Drawer closing form */}
              <form onSubmit={handleCloseShift} className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Actual Drawer Cash Count *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">₹</span>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      placeholder="Count actual cash in drawer..."
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-primary font-bold text-slate-800 outline-none text-base"
                      value={actualCashInput}
                      onChange={e => setActualCashInput(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Shift Closing Notes / Discrepancy details</label>
                  <textarea 
                    placeholder="Describe any drawer differences, custom payouts, etc."
                    className="w-full p-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-primary font-bold text-slate-800 outline-none text-sm min-h-[80px]"
                    value={closingNotes}
                    onChange={e => setClosingNotes(e.target.value)}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle size={16} />}
                  <span>CLOSE REGISTER & SHIFT</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Shift is CLOSED, show opening cash entry drawer */
          <form onSubmit={handleOpenShift} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-50 text-brand-primary rounded-2xl border border-brand-100">
                <Coins size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 leading-tight">Start Cashier Session</h2>
                <p className="text-xs text-slate-500 font-medium">Open the cash drawer registry to start billing transactions.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 font-mono">Drawer Starting Cash *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">₹</span>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    placeholder="Enter starting cash (e.g. ₹2000)"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-primary font-bold text-slate-800 outline-none text-base"
                    value={openingCashInput}
                    onChange={e => setOpeningCashInput(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <TrendingUp size={16} />}
              <span>OPEN DRAWER & START</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ShiftClosing;
