import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx'
import './index.css'

import usePOSStore from './store/posStore';

// ONE-TIME SAFETY WIPE (Self-Cleaning for Data Reset)
if (localStorage.getItem('pos_reset_state') !== '2026-06-12') {
  console.log('New Deployment: Clearing local cache to sync with empty database...');
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('pos_reset_state', '2026-06-12');
  window.location.reload();
}

// Service Worker update check helper to force client PWA refresh
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    // Check for updates immediately on load
    registration.update().catch((err) => {
      console.warn('Service worker update check failed:', err);
    });

    // Check for updates periodically (every 5 minutes)
    setInterval(() => {
      registration.update().catch((err) => {
        console.warn('Service worker periodic update check failed:', err);
      });
    }, 5 * 60 * 1000);
  });
}

const MainApp = () => {
  const initSocket = usePOSStore(state => state.initSocket);
  
  React.useEffect(() => {
    // Only init socket if not on Vercel (socket.io doesn't work well on serverless)
    if (!window.location.hostname.includes('vercel.app')) {
      initSocket();
    }
  }, [initSocket]);

  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  </React.StrictMode>
);
