import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-prompt disabled to prevent UI interruptions
      // setTimeout(() => setIsVisible(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handler as any);

    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-12">
      <div className="bg-slate-900 text-white p-5 rounded-[2rem] border border-white/10 shadow-2xl flex items-center gap-4 backdrop-blur-xl">
        <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Download size={24} />
        </div>
        <div>
          <p className="font-bold">Install POS Pro</p>
          <p className="text-xs text-slate-400">Run as a fast, standalone app</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleInstall}
            className="bg-brand-600 hover:bg-brand-500 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
          >
            Install
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
