import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx'
import './index.css'

import usePOSStore from './store/posStore';

// ONE-TIME SAFETY WIPE (Self-Cleaning for Data Reset)
if (localStorage.getItem('pos_reset_state') !== '2026-04-12') {
  console.log('New Deployment: Clearing local cache to sync with empty database...');
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('pos_reset_state', '2026-04-12');
  window.location.reload();
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
