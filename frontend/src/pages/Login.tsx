import React, { useState } from 'react';
import api from '../api/api';
import { LogIn, Lock, User, AlertCircle, Smartphone, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeviceReg, setShowDeviceReg] = useState(false);
  const [regData, setRegData] = useState({ licenseKey: '', deviceName: '' });
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const deviceId = localStorage.getItem('deviceId');

    try {
      const response = await api.post('/auth/login', { username, password, deviceId });
      login(response.data.user, response.data.token);
    } catch (err: any) {
      console.error('Login Error Object:', err);
      if (err.response?.data?.type === 'DEVICE_UNREGISTERED') {
        setShowDeviceReg(true);
      } else {
        let errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Connection failed.';
        if (typeof errorMsg === 'object') {
            errorMsg = errorMsg.message || JSON.stringify(errorMsg);
        }
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const deviceId = localStorage.getItem('deviceId');
      await api.post('/auth/register-device', { 
        deviceId, 
        name: regData.deviceName, 
        licenseKey: regData.licenseKey 
      });
      alert('Registration request sent! Please wait for admin approval.');
      setShowDeviceReg(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-900/20 via-slate-900 to-slate-950">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-12 duration-700">
        <div className="bg-white/5 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-brand-primary/20 rotate-12 hover:rotate-0 transition-transform duration-500 border border-white/10">
              <img src="/logo.png" alt="Jude's Kitchen" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Jude's Kitchen POS</h1>
            <p className="text-slate-400 font-medium">Log in to your POS terminal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-300 transition-colors" size={20} />
                <input
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white/10 transition-all placeholder:text-slate-600"
                  placeholder="admin / cashier"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-300 transition-colors" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white/10 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-sm font-medium animate-shake">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-brand-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>START SESSION</span>
                </>
              )}
            </button>
          </form>

          {showDeviceReg && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50">
                <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm">
                    <div className="text-center mb-6">
                        <Smartphone className="text-brand-500 mx-auto mb-4" size={48} />
                        <h2 className="text-2xl font-black text-white">Authorize Device</h2>
                        <p className="text-slate-400 text-sm">This terminal is not registered.</p>
                    </div>
                    <form onSubmit={handleRegisterDevice} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Terminal Unique Name (e.g. Counter-1)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white"
                            required
                            value={regData.deviceName}
                            onChange={e => setRegData({...regData, deviceName: e.target.value})}
                        />
                        <input
                            type="text"
                            placeholder="License Key"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white"
                            required
                            value={regData.licenseKey}
                            onChange={e => setRegData({...regData, licenseKey: e.target.value})}
                        />
                        <button className="w-full bg-white text-slate-900 font-black py-4 rounded-xl">
                            REQUEST ACCESS
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setShowDeviceReg(false)}
                            className="w-full text-slate-500 font-bold text-sm"
                        >
                            CANCEL
                        </button>
                    </form>
                </div>
            </div>
          )}

          <p className="mt-8 text-center text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
            Jude's Kitchen POS v1.0.4 • Cloud Sync Active
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
