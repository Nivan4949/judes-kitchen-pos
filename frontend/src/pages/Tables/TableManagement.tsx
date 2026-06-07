import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, Edit3, Trash2, ArrowRightLeft, Merge, Split, Check, X, ShieldAlert } from 'lucide-react';
import useRestaurantStore from '../../store/restaurantStore';
import usePOSStore from '../../store/posStore';
import api from '../../api/api';

const TableManagement = () => {
  const navigate = useNavigate();
  const { 
    tables, sections, fetchTables, fetchSections, 
    updateTableStatus, transferTable, mergeTables, splitOrder 
  } = useRestaurantStore();

  const loadRunningOrder = usePOSStore(state => state.loadRunningOrder);
  const clearCart = usePOSStore(state => state.clearCart);
  const setTable = usePOSStore(state => state.setTable);

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  
  // Modals / Actions states
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [actionType, setActionType] = useState<'TRANSFER' | 'MERGE' | 'SPLIT' | 'RESERVE' | null>(null);
  const [targetTableId, setTargetTableId] = useState<string>('');
  
  // Split items state
  const [runningItems, setRunningItems] = useState<any[]>([]);
  const [splitQuantities, setSplitQuantities] = useState<{[key: string]: number}>({});

  // CRUD states (Admin/Manager only)
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNo, setNewTableNo] = useState('');
  const [newTableCap, setNewTableCap] = useState(4);
  const [newTableSec, setNewTableSec] = useState('');

  const [showAddSec, setShowAddSec] = useState(false);
  const [newSecName, setNewSecName] = useState('');

  // Elapsed time state
  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    fetchTables();
    fetchSections();
    const interval = setInterval(() => {
      setTimeTick(Date.now());
    }, 10000); // Update timers every 10s
    return () => clearInterval(interval);
  }, []);

  // Set default active section
  useEffect(() => {
    if (sections.length > 0 && !activeSectionId) {
      setActiveSectionId(sections[0].id);
    }
  }, [sections]);

  const getElapsedTime = (occupiedAtStr: string) => {
    if (!occupiedAtStr) return '';
    const diffMs = timeTick - new Date(occupiedAtStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const handleTableClick = async (table: any) => {
    if (table.status === 'FREE') {
      // Clear cart, assign table, and go to POS
      clearCart();
      setTable(table.id, table.number);
      navigate('/');
    } else if (table.status === 'OCCUPIED' && table.currentOrderId) {
      // Fetch details of this running order
      try {
        const res = await api.get(`/orders/${table.currentOrderId}`);
        loadRunningOrder(res.data, res.data.orderItems);
        navigate('/');
      } catch (err) {
        console.error('Failed to load running order:', err);
        alert('Failed to load order. Table might be out of sync.');
      }
    } else {
      setSelectedTable(table);
    }
  };

  const executeTransfer = async () => {
    if (!selectedTable || !targetTableId) return;
    try {
      await transferTable(selectedTable.id, targetTableId);
      setActionType(null);
      setSelectedTable(null);
      setTargetTableId('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const executeMerge = async () => {
    if (!selectedTable || !targetTableId) return;
    if (!confirm('Are you sure you want to MERGE these orders? This will combine all items into the destination table.')) return;
    try {
      await mergeTables(selectedTable.id, targetTableId);
      setActionType(null);
      setSelectedTable(null);
      setTargetTableId('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const loadSplitItems = async (table: any) => {
    try {
      const res = await api.get(`/orders/${table.currentOrderId}`);
      setRunningItems(res.data.orderItems);
      const initialQtys: {[key: string]: number} = {};
      res.data.orderItems.forEach((item: any) => {
        initialQtys[item.id] = 0;
      });
      setSplitQuantities(initialQtys);
    } catch (err) {
      console.error(err);
    }
  };

  const executeSplit = async () => {
    if (!selectedTable) return;
    const splitPayload = Object.entries(splitQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ orderItemId: itemId, quantity: qty }));

    if (splitPayload.length === 0) {
      alert('Please select items and quantities to split');
      return;
    }

    try {
      const targetId = targetTableId || null; // Null means split to Takeaway (no table)
      await splitOrder(selectedTable.id, targetId, splitPayload);
      setActionType(null);
      setSelectedTable(null);
      setTargetTableId('');
      setRunningItems([]);
      setSplitQuantities({});
      alert('Order split successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const createTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNo || !newTableCap || !newTableSec) return;
    try {
      await api.post('/tables', {
        number: newTableNo,
        capacity: newTableCap,
        sectionId: newTableSec
      });
      setNewTableNo('');
      setShowAddTable(false);
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create table');
    }
  };

  const createSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName) return;
    try {
      await api.post('/tables/sections', { name: newSecName });
      setNewSecName('');
      setShowAddSec(false);
      fetchSections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create section');
    }
  };

  const deleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      await api.delete(`/tables/${tableId}`);
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete table');
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section? All tables in this section will be unassigned.')) return;
    try {
      await api.delete(`/tables/sections/${sectionId}`);
      fetchSections();
      fetchTables();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete section');
    }
  };

  const filteredTables = tables.filter(t => t.sectionId === activeSectionId);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen text-slate-800 font-sans select-none">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Table Floor Map</h1>
          <p className="text-slate-500 font-medium text-xs md:text-sm">Manage dine-in layouts, active bills, and table transfers.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setShowAddSec(true)}
            className="flex-1 md:flex-initial px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
          >
            + New Section
          </button>
          <button 
            onClick={() => setShowAddTable(true)}
            className="flex-1 md:flex-initial px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
          >
            + Add Table
          </button>
        </div>
      </div>

      {/* Sections Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide border-b border-slate-200">
        {sections.map(sec => (
          <div key={sec.id} className="relative group shrink-0">
            <button
              onClick={() => setActiveSectionId(sec.id)}
              className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeSectionId === sec.id 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25' 
                  : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {sec.name}
            </button>
            <button 
              onClick={() => deleteSection(sec.id)}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="text-slate-400 font-bold italic py-2">No dining sections created yet.</p>
        )}
      </div>

      {/* Table Grid Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredTables.map(table => {
          const isOccupied = table.status === 'OCCUPIED';
          const isBilling = table.status === 'BILLING';
          const isReserved = table.status === 'RESERVED';

          return (
            <div 
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`
                aspect-square rounded-[2rem] border-2 bg-white p-5 flex flex-col justify-between cursor-pointer relative group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 select-none
                ${isOccupied ? 'border-amber-400 shadow-lg shadow-amber-500/5 ring-4 ring-amber-500/10' : ''}
                ${isBilling ? 'border-brand-secondary shadow-lg shadow-pink-500/5 ring-4 ring-pink-500/10' : ''}
                ${isReserved ? 'border-indigo-400 bg-indigo-50/10' : ''}
                ${table.status === 'FREE' ? 'border-slate-200 hover:border-brand-primary/50' : ''}
              `}
            >
              {/* Top Details */}
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Users size={12} /> {table.capacity} Pax
                </span>
                
                {/* Status Dot */}
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest ${
                  isOccupied ? 'bg-amber-100 text-amber-700' :
                  isBilling ? 'bg-pink-100 text-pink-700' :
                  isReserved ? 'bg-indigo-100 text-indigo-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isOccupied ? 'bg-amber-500 animate-pulse' :
                    isBilling ? 'bg-pink-500 animate-pulse' :
                    isReserved ? 'bg-indigo-500' :
                    'bg-emerald-500'
                  }`}></div>
                  {table.status}
                </div>
              </div>

              {/* Table Identity */}
              <div className="text-center my-2">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{table.number}</h3>
              </div>

              {/* Bottom running stats */}
              <div className="shrink-0">
                {isOccupied && (
                  <div className="flex justify-between items-center bg-amber-50/50 p-2 rounded-xl border border-amber-100/50">
                    <span className="text-xs font-black text-amber-700">₹{table.runningOrderAmount.toFixed(0)}</span>
                    <span className="text-[10px] font-mono font-bold text-amber-600 flex items-center gap-1 shrink-0">
                      <Clock size={10} /> {getElapsedTime(table.occupiedAt)}
                    </span>
                  </div>
                )}
                {!isOccupied && (
                  <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to Open
                  </div>
                )}
              </div>

              {/* Table Deletion */}
              <button 
                onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                className="absolute top-2 right-2 bg-red-50 text-red-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {filteredTables.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem]">
            <p className="font-bold text-lg mb-1">Floor layout is empty</p>
            <p className="text-xs">Click "Add Table" to put dining slots in this area.</p>
          </div>
        )}
      </div>

      {/* Table Action Dialog/Overlay */}
      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative">
            <button 
              onClick={() => { setSelectedTable(null); setActionType(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-1.5"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">Table {selectedTable.number} Options</h2>
            <p className="text-xs text-slate-500 mb-6 uppercase tracking-wider font-bold">Current Status: {selectedTable.status}</p>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => {
                  if (selectedTable.status !== 'OCCUPIED') return alert('Only occupied tables can be transferred.');
                  setActionType('TRANSFER');
                  loadSplitItems(selectedTable);
                }}
                className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-brand-50 border border-slate-100 rounded-2xl hover:border-brand-200 transition-all text-center"
              >
                <ArrowRightLeft className="text-brand-primary" size={24} />
                <span className="font-bold text-xs uppercase tracking-wide">Transfer Table</span>
              </button>

              <button 
                onClick={() => {
                  if (selectedTable.status !== 'OCCUPIED') return alert('Only occupied tables can be merged.');
                  setActionType('MERGE');
                }}
                className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-brand-50 border border-slate-100 rounded-2xl hover:border-brand-200 transition-all text-center"
              >
                <Merge className="text-brand-primary" size={24} />
                <span className="font-bold text-xs uppercase tracking-wide">Merge Tables</span>
              </button>

              <button 
                onClick={() => {
                  if (selectedTable.status !== 'OCCUPIED') return alert('Only occupied tables can be split.');
                  setActionType('SPLIT');
                  loadSplitItems(selectedTable);
                }}
                className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-brand-50 border border-slate-100 rounded-2xl hover:border-brand-200 transition-all text-center"
              >
                <Split className="text-brand-primary" size={24} />
                <span className="font-bold text-xs uppercase tracking-wide">Split Order/Bill</span>
              </button>

              <button 
                onClick={async () => {
                  const newStatus = selectedTable.status === 'RESERVED' ? 'FREE' : 'RESERVED';
                  await updateTableStatus(selectedTable.id, newStatus);
                  setSelectedTable(null);
                }}
                className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-brand-50 border border-slate-100 rounded-2xl hover:border-brand-200 transition-all text-center"
              >
                <Check className="text-brand-primary" size={24} />
                <span className="font-bold text-xs uppercase tracking-wide">
                  {selectedTable.status === 'RESERVED' ? 'Mark Free' : 'Reserve Table'}
                </span>
              </button>
            </div>

            {/* Sub-Actions (Transfer / Merge / Split layout forms) */}
            {actionType && (
              <div className="mt-6 border-t border-slate-100 pt-6 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-500 mb-3">{actionType} OPERATION</h3>
                
                {actionType === 'TRANSFER' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Select Destination FREE Table</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                      value={targetTableId}
                      onChange={e => setTargetTableId(e.target.value)}
                    >
                      <option value="">-- Choose Table --</option>
                      {tables.filter(t => t.status === 'FREE').map(t => (
                        <option key={t.id} value={t.id}>{t.number} ({t.capacity} Pax)</option>
                      ))}
                    </select>
                    <button 
                      onClick={executeTransfer}
                      disabled={!targetTableId}
                      className="w-full bg-brand-primary text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow hover:bg-brand-secondary disabled:opacity-50"
                    >
                      Confirm Transfer
                    </button>
                  </div>
                )}

                {actionType === 'MERGE' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Select Destination OCCUPIED Table to Merge Into</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                      value={targetTableId}
                      onChange={e => setTargetTableId(e.target.value)}
                    >
                      <option value="">-- Choose Table --</option>
                      {tables.filter(t => t.status === 'OCCUPIED' && t.id !== selectedTable.id).map(t => (
                        <option key={t.id} value={t.id}>{t.number} (Running Order)</option>
                      ))}
                    </select>
                    <button 
                      onClick={executeMerge}
                      disabled={!targetTableId}
                      className="w-full bg-brand-primary text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow hover:bg-brand-secondary disabled:opacity-50"
                    >
                      Confirm Merge
                    </button>
                  </div>
                )}

                {actionType === 'SPLIT' && (
                  <div className="space-y-4">
                    <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50/50 custom-scrollbar">
                      {runningItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-none">
                          <span className="text-xs font-bold text-slate-700">{item.product?.name || item.name} (Qty: {item.quantity})</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              min="0"
                              max={item.quantity}
                              className="w-16 bg-white border border-slate-200 rounded px-2 py-0.5 text-center font-bold text-xs"
                              value={splitQuantities[item.id] || 0}
                              onChange={e => {
                                const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                setSplitQuantities({...splitQuantities, [item.id]: val});
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <label className="text-[10px] font-black uppercase text-slate-400 block">Move to Dining Table (Leave blank for Takeaway)</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                      value={targetTableId}
                      onChange={e => setTargetTableId(e.target.value)}
                    >
                      <option value="">Split to Takeaway (Quick Bill)</option>
                      {tables.filter(t => t.status === 'FREE').map(t => (
                        <option key={t.id} value={t.id}>Dine-in: {t.number}</option>
                      ))}
                    </select>

                    <button 
                      onClick={executeSplit}
                      className="w-full bg-brand-primary text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow hover:bg-brand-secondary"
                    >
                      Execute Split Order
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CRUD Overlays */}
      {showAddTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={createTable} className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 relative">
            <h2 className="text-xl font-black text-slate-900 mb-6">Add Floor Table</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Table Number/Name</label>
                <input 
                  required
                  placeholder="e.g. Table 15"
                  className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  value={newTableNo}
                  onChange={e => setNewTableNo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Seating Capacity</label>
                <input 
                  required
                  type="number"
                  placeholder="4"
                  className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  value={newTableCap}
                  onChange={e => setNewTableCap(parseInt(e.target.value) || 2)}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Section/Area Area</label>
                <select 
                  required
                  className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  value={newTableSec}
                  onChange={e => setNewTableSec(e.target.value)}
                >
                  <option value="">Select Section</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowAddTable(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow"
              >
                Add Table
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddSec && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={createSection} className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 relative">
            <h2 className="text-xl font-black text-slate-900 mb-6">Create Floor Section</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Section Name</label>
                <input 
                  required
                  placeholder="e.g. AC Section, Rooftop, Family Room"
                  className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm"
                  value={newSecName}
                  onChange={e => setNewSecName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowAddSec(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow"
              >
                Save Section
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TableManagement;
