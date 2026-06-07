import React, { useEffect, useState } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import useRestaurantStore from '../../store/restaurantStore';
import { io } from 'socket.io-client';

const KitchenDisplay = () => {
  const { activeKots, fetchActiveKots, updateKotStatus, updateKotItemStatus } = useRestaurantStore();
  const [timeTick, setTimeTick] = useState(Date.now());
  const [audio] = useState(() => {
    // Simple synth beep if browser allows, otherwise empty object
    return typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;
  });

  const playNotificationSound = () => {
    if (!audio) return;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audio.currentTime); // D5
      gain.gain.setValueAtTime(0.1, audio.currentTime);
      osc.start();
      osc.stop(audio.currentTime + 0.15);
      
      setTimeout(() => {
        const osc2 = audio.createOscillator();
        osc2.connect(gain);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audio.currentTime); // A5
        osc2.start();
        osc2.stop(audio.currentTime + 0.25);
      }, 180);
    } catch (e) {
      console.warn('Audio context state issue:', e);
    }
  };

  useEffect(() => {
    fetchActiveKots();
    
    const tickInterval = setInterval(() => {
      setTimeTick(Date.now());
    }, 10000);

    // Socket.io Real-time KOT syncing
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';
    const socket = io(socketUrl);
    
    socket.on('NEW_KOT', (newKot) => {
      fetchActiveKots();
      playNotificationSound();
    });

    socket.on('CANCELLED_KOT', () => {
      fetchActiveKots();
      playNotificationSound();
    });

    socket.on('KOT_STATUS_UPDATED', () => {
      fetchActiveKots();
    });

    return () => {
      clearInterval(tickInterval);
      socket.disconnect();
    };
  }, []);

  const getKotAge = (createdAtStr: string) => {
    const diffMs = timeTick - new Date(createdAtStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    return mins;
  };

  const getAgeColor = (mins: number) => {
    if (mins >= 20) return 'text-red-500 bg-red-50 border-red-200 animate-pulse';
    if (mins >= 12) return 'text-amber-500 bg-amber-50 border-amber-200';
    return 'text-slate-500 bg-slate-50 border-slate-100';
  };

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-slate-100 font-sans select-none">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl border border-brand-primary/20">
            <ChefHat size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Kitchen Display Screen</h1>
            <p className="text-slate-400 font-medium text-xs md:text-sm">Real-time orders queue and preparation desk.</p>
          </div>
        </div>

        <button 
          onClick={fetchActiveKots}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
        >
          <RefreshCw size={16} /> Refresh ({activeKots.length})
        </button>
      </div>

      {/* KOT Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeKots.map(kot => {
          const ageMins = getKotAge(kot.createdAt);
          const isOverdue = ageMins >= 15;

          return (
            <div 
              key={kot.id} 
              className={`
                bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden flex flex-col justify-between shadow-2xl relative transition-all duration-300 hover:border-slate-600
                ${isOverdue ? 'ring-2 ring-red-500/20' : ''}
              `}
            >
              {/* KOT Card Header */}
              <div className="p-4 border-b border-slate-700/60 bg-slate-800/80 flex justify-between items-start shrink-0">
                <div>
                  <h3 className="font-mono font-black text-white text-base leading-none mb-1">{kot.kotNo}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] font-black uppercase bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-lg">
                      {kot.tableName ? `Table ${kot.tableName}` : kot.orderType}
                    </span>
                    {kot.waiterName && (
                      <span className="text-[9px] font-bold text-slate-400">
                        Waiter: {kot.waiterName}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${getAgeColor(ageMins)}`}>
                  {isOverdue && <AlertTriangle size={12} />}
                  <Clock size={12} /> {ageMins} min
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar custom-scrollbar-dark divide-y divide-slate-700/40">
                {kot.items.map((item: any) => {
                  const isItemReady = item.status === 'READY' || item.status === 'SERVED';
                  const isItemPreparing = item.status === 'PREPARING';

                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        const nextStatus = item.status === 'PENDING' ? 'PREPARING' : item.status === 'PREPARING' ? 'READY' : 'SERVED';
                        updateKotItemStatus(kot.id, item.id, nextStatus);
                      }}
                      className={`
                        py-3 flex justify-between items-start gap-4 cursor-pointer transition-all
                        ${isItemReady ? 'opacity-40 line-through' : ''}
                      `}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm ${isItemPreparing ? 'text-amber-400' : 'text-slate-200'}`}>
                            {item.quantity}x
                          </span>
                          <span className="font-bold text-sm text-slate-200 truncate">{item.name}</span>
                        </div>
                        
                        {/* Variant / Customizations details */}
                        {item.variant && (
                          <span className="text-[10px] font-black uppercase text-brand-primary block mt-0.5">
                            Size: {item.variant}
                          </span>
                        )}
                        {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.modifiers.map((m: any, idx: number) => (
                              <span key={idx} className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                + {m.name}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Chef instructions */}
                        {item.notes && (
                          <div className="text-[10px] font-bold text-amber-500 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 mt-1 italic">
                            * Note: {item.notes}
                          </div>
                        )}
                      </div>

                      {/* Status indicator on item */}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border ${
                        item.status === 'PENDING' ? 'bg-slate-700/50 text-slate-400 border-slate-600' :
                        item.status === 'PREPARING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-slate-800/40 border-t border-slate-700/50 flex gap-2 shrink-0">
                {kot.status === 'PENDING' && (
                  <button 
                    onClick={() => updateKotStatus(kot.id, 'PREPARING')}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Start Cooking
                  </button>
                )}
                {kot.status === 'PREPARING' && (
                  <button 
                    onClick={() => updateKotStatus(kot.id, 'READY')}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Ready for Pick
                  </button>
                )}
                {kot.status === 'READY' && (
                  <button 
                    onClick={() => updateKotStatus(kot.id, 'SERVED')}
                    className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-emerald-400 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                  >
                    <CheckCircle size={14} /> Served
                  </button>
                )}
                {kot.status === 'CANCELLED' && (
                  <div className="w-full py-2 bg-red-500/10 text-red-500 rounded-xl font-black text-xs text-center border border-red-500/20">
                    CANCELLED
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {activeKots.length === 0 && (
          <div className="col-span-full py-40 text-center text-slate-500 bg-slate-800/30 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
            <ChefHat className="mx-auto mb-4 opacity-30" size={64} strokeWidth={1} />
            <h3 className="font-bold text-xl text-slate-300">Kitchen is calm</h3>
            <p className="text-xs text-slate-500">No active KOTs pending. New table tickets will automatically stream here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenDisplay;
