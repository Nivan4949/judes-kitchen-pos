import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // 1. Android/Chrome beforeinstallprompt handling
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowAndroidPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler as any);

    // 2. iOS custom handling
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Detect if app is running in standalone mode (i.e. already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    // Check if dismissed before
    const isDismissed = localStorage.getItem('ios_install_prompt_dismissed') === 'true';

    if (isIOS && !isStandalone && !isDismissed) {
      setTimeout(() => setShowIOSPrompt(true), 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as any);
    };
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowAndroidPrompt(false);
    }
  };

  const dismissIOSPrompt = () => {
    localStorage.setItem('ios_install_prompt_dismissed', 'true');
    setShowIOSPrompt(false);
  };

  // Render Android/Chrome standard install prompt
  if (showAndroidPrompt) {
    return (
      <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-12 max-w-sm w-[90vw] md:w-auto">
        <div className="bg-slate-900 text-white p-5 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0">
              <Download size={24} />
            </div>
            <div>
              <p className="font-bold text-sm">Install POS Pro</p>
              <p className="text-[10px] text-slate-400">Run as a fast, standalone app</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleAndroidInstall}
              className="bg-brand-600 hover:bg-brand-500 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 text-white"
            >
              Install
            </button>
            <button 
              onClick={() => setShowAndroidPrompt(false)}
              className="p-2 hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render iOS custom install instructions
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92vw] max-w-md animate-in slide-in-from-bottom-12">
        <div className="bg-slate-900/95 text-white p-5 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0">
                <Download size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">Install Jude's Kitchen POS</p>
                <p className="text-[10px] text-slate-400">Add to Home Screen for the best experience</p>
              </div>
            </div>
            <button 
              onClick={dismissIOSPrompt}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 text-xs bg-white/5 p-3.5 rounded-2xl border border-white/5 font-sans leading-relaxed text-slate-200">
            <div className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-600/20 text-brand-400 font-bold text-[10px] shrink-0 mt-0.5">1</span>
              <p>
                Tap the <strong className="text-white">Share</strong> button in Safari browser menu below:
                <span className="inline-flex items-center justify-center p-1 bg-white/15 rounded-md ml-1.5 align-middle">
                  <svg className="w-3.5 h-3.5 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="10" width="14" height="12" rx="2" ry="2"></rect>
                    <line x1="12" y1="13" x2="12" y2="3"></line>
                    <polyline points="9 6 12 3 15 6"></polyline>
                  </svg>
                </span>
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-600/20 text-brand-400 font-bold text-[10px] shrink-0 mt-0.5">2</span>
              <p>
                Scroll down and select <strong className="text-white">Add to Home Screen</strong>:
                <span className="inline-flex items-center justify-center p-1 bg-white/15 rounded-md ml-1.5 align-middle">
                  <svg className="w-3.5 h-3.5 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                </span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={dismissIOSPrompt}
              className="w-full bg-brand-600 hover:bg-brand-500 py-2.5 rounded-xl text-xs font-black transition-all active:scale-[0.98] text-center"
            >
              GOT IT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;
