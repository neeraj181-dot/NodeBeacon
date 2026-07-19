import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import WaveBackground from './WaveBackground';

export default function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#050505] text-white flex items-center justify-center p-6 overflow-hidden font-sans select-none">
      {/* Background with CSS SVG Waves, Cyber Grid, and Floating Particles */}
      <WaveBackground />

      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[440px] bg-[#0c0c0c]/90 backdrop-blur-[24px] border border-[#57E389]/25 p-10 rounded-[28px] space-y-6 shadow-[0_0_50px_rgba(87,227,137,0.08)]"
      >
        {/* Header */}
        <div className="flex flex-col items-center">
          <Logo size={54} showGlow={true} />
          <h3 className="font-bold text-white text-[20px] tracking-[0.5px] font-sans mt-3">
            Node<span className="text-accent">Beacon</span>
          </h3>
          <h2 className="text-sm font-semibold text-white tracking-wide mt-1.5">
            Recover Access
          </h2>
          <p className="text-[11px] text-secondaryText mt-1">
            Restore NodeBeacon connectivity
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6 text-center">
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-2">
              <div className="flex justify-center">
                <ShieldCheck className="w-8 h-8 text-accent animate-pulse" />
              </div>
              <p className="text-xs text-accent font-mono uppercase tracking-wider font-bold">Recovery link dispatched</p>
              <p className="text-[11px] text-secondaryText mt-1 leading-relaxed">Check your inbox at <strong>{email}</strong> for instructions to reset your password.</p>
            </div>
            <button 
              onClick={() => onNavigate('login')}
              className="w-full h-11 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase font-mono tracking-wider text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Login</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Account Email</label>
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${emailFocused ? 'text-accent' : 'text-secondaryText'}`} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@nodebeacon.net"
                  className="w-full h-11 bg-[#121212]/80 border border-white/5 rounded-xl pl-11 pr-4 text-xs text-white placeholder-secondaryText/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full h-11 bg-[#57E389] hover:bg-[#57E389]/95 text-black font-bold rounded-xl text-xs uppercase tracking-wider hover:shadow-[0_0_25px_rgba(87,227,137,0.35)] hover:-translate-y-0.5 transition-all mt-4 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(87,227,137,0.2)] font-sans"
            >
              <span>Recover Access</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => onNavigate('login')}
                className="text-xs text-secondaryText hover:text-white transition-colors cursor-pointer font-sans"
              >
                Go back to login
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
