import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Building } from 'lucide-react';
import Logo from './Logo';
import WaveBackground from './WaveBackground';
import { useAuth } from '../contexts/AuthContext';

export default function Register({ onRegister, onNavigate }) {
  const [accountType, setAccountType] = useState(null); // 'INDIVIDUAL' or 'ORGANIZATION'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Org Specific fields
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [alertEmail, setAlertEmail] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    setSubmitting(true);

    let finalUsername = '';
    let finalEmail = '';
    let firstName = '';
    let lastName = '';
    let role = 'INDIVIDUAL';

    if (accountType === 'INDIVIDUAL') {
      finalEmail = email.trim();
      finalUsername = email.trim();
      const nameParts = name.trim().split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
      role = 'INDIVIDUAL';
    } else {
      finalEmail = adminEmail.trim();
      finalUsername = adminEmail.trim();
      const nameParts = adminName.trim().split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
      role = 'ORGANIZATION_ADMIN';
    }

    try {
      await register(
        finalUsername,
        finalEmail,
        password,
        firstName,
        lastName,
        role,
        accountType === 'ORGANIZATION' ? orgName.trim() : '',
        accountType === 'ORGANIZATION' ? alertEmail.trim() : ''
      );
      onRegister();
    } catch (err) {
      setLocalError(err.message || 'Registration failed. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-register text-white flex items-center justify-center p-6 overflow-hidden font-sans select-none">
      <WaveBackground />

      {!accountType ? (
        <div className="relative z-10 w-full max-w-[800px] flex flex-col items-center gap-8 animate-fade-in">
          <div className="flex flex-col items-center">
            <Logo size={64} showGlow={true} />
            <h3 className="font-bold text-white text-[24px] tracking-[0.5px] font-sans mt-3">
              Node<span className="text-accent">Beacon</span>
            </h3>
            <p className="text-xs text-secondaryText mt-1">Select your account setup configuration</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Individual Card */}
            <div 
              onClick={() => setAccountType('INDIVIDUAL')}
              className="glass-panel p-8 rounded-2xl flex flex-col justify-between h-72 border border-white/5 hover:border-accent/40 hover:shadow-[0_0_30px_rgba(87,227,137,0.06)] transition-all duration-300 cursor-pointer text-center group"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Individual</h3>
                  <p className="text-[11px] text-secondaryText leading-relaxed mt-2">
                    Perfect for students, developers, home labs and personal servers. Alerts are delivered to the owner's email.
                  </p>
                </div>
              </div>
              <div className="w-full py-2.5 bg-white/5 border border-white/5 hover:bg-accent hover:text-[#050505] rounded-xl text-xs font-mono font-bold uppercase transition-all mt-4 flex items-center justify-center">
                Continue as Individual
              </div>
            </div>

            {/* Organization Card */}
            <div 
              onClick={() => setAccountType('ORGANIZATION')}
              className="glass-panel p-8 rounded-2xl flex flex-col justify-between h-72 border border-white/5 hover:border-accent/40 hover:shadow-[0_0_30px_rgba(87,227,137,0.06)] transition-all duration-300 cursor-pointer text-center group"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Organization</h3>
                  <p className="text-[11px] text-secondaryText leading-relaxed mt-2">
                    Monitor multiple servers from one centralized dashboard. All alerts are sent to the organization's alert email.
                  </p>
                </div>
              </div>
              <div className="w-full py-2.5 bg-white/5 border border-white/5 hover:bg-accent hover:text-[#050505] rounded-xl text-xs font-mono font-bold uppercase transition-all mt-4 flex items-center justify-center">
                Continue as Organization
              </div>
            </div>
          </div>

          <button onClick={() => onNavigate('login')} className="text-xs text-secondaryText hover:text-white font-mono uppercase tracking-wider">
            Already have an account? Log in
          </button>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-[460px] bg-[#0c0c0c]/90 backdrop-blur-[24px] border border-[#57E389]/25 p-8 rounded-[28px] space-y-5 shadow-[0_0_50px_rgba(87,227,137,0.08)]"
        >
          {/* Back button */}
          <button 
            onClick={() => { setAccountType(null); setLocalError(''); }}
            className="text-[10px] font-bold text-secondaryText hover:text-white uppercase tracking-wider font-mono"
          >
            &larr; Back to account types
          </button>

          <div className="flex flex-col items-center">
            <Logo size={48} showGlow={true} />
            <h2 className="text-sm font-semibold text-white tracking-wide mt-2">
              Setup {accountType === 'INDIVIDUAL' ? 'Individual' : 'Organization'} Account
            </h2>
          </div>

          {localError && (
            <div className="p-3 bg-danger/5 border border-danger/20 text-danger rounded-xl text-[11px] font-medium font-sans">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {accountType === 'INDIVIDUAL' ? (
              <>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Full Name</label>
                  <input 
                    type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera"
                    className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Email Address</label>
                  <input 
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@nodebeacon.net"
                    className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Organization Name</label>
                  <input 
                    type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="ABC Technologies"
                    className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Administrator Name</label>
                    <input 
                      type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Alex Rivera"
                      className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Administrator Email</label>
                    <input 
                      type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@company.com"
                      className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Alert Email</label>
                  <input 
                    type="email" required value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="alerts@company.com"
                    className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Password</label>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Confirm Password</label>
                <input 
                  type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                  className="w-full h-10 bg-[#121212]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                />
              </div>
            </div>

            <button 
              type="submit" disabled={submitting}
              className="w-full h-10 bg-[#57E389] hover:bg-[#57E389]/95 text-black font-bold rounded-xl text-xs uppercase tracking-wider hover:shadow-[0_0_25px_rgba(87,227,137,0.35)] mt-4 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? 'Registering...' : 'Register'}</span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
