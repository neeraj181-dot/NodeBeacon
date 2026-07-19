import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Logo from './Logo';
import WaveBackground from './WaveBackground';
import { useAuth } from '../contexts/AuthContext';

export default function Register({ onRegister, onNavigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);
    
    // Parse first name and last name from full name input
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Use email as the username for unique identifier mapping
    const username = email.trim();

    try {
      await register(username, email.trim(), password, firstName, lastName);
      onRegister();
    } catch (err) {
      setLocalError(err.message || 'Registration failed. Please check inputs.');
    } finally {
      setSubmitting(false);
    }
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
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-1"
          >
            <Logo size={54} showGlow={true} />
          </motion.div>
          <h3 className="font-bold text-white text-[20px] tracking-[0.5px] font-sans mt-3">
            Node<span className="text-accent">Beacon</span>
          </h3>
          <h2 className="text-sm font-semibold text-white tracking-wide mt-1.5">
            Create account
          </h2>
          <p className="text-[11px] text-secondaryText mt-1">
            Start monitoring your nodes for free
          </p>
        </div>

        {/* Display validation errors from backend */}
        {localError && (
          <div className="p-3 bg-danger/5 border border-danger/20 text-danger rounded-xl text-[11px] font-medium font-sans">
            {localError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Full Name Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Full Name</label>
            <div className="relative">
              <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${nameFocused ? 'text-accent' : 'text-secondaryText'}`} />
              <input 
                type="text" 
                required
                disabled={submitting}
                value={name}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full h-11 bg-[#121212]/80 border border-white/5 rounded-xl pl-11 pr-4 text-xs text-white placeholder-secondaryText/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email Address Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Email Address</label>
            <div className="relative">
              <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${emailFocused ? 'text-accent' : 'text-secondaryText'}`} />
              <input 
                type="email" 
                required
                disabled={submitting}
                value={email}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@nodebeacon.net"
                className="w-full h-11 bg-[#121212]/80 border border-white/5 rounded-xl pl-11 pr-4 text-xs text-white placeholder-secondaryText/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block font-mono">Password</label>
            <div className="relative">
              <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${passwordFocused ? 'text-accent' : 'text-secondaryText'}`} />
              <input 
                type={showPassword ? 'text' : 'password'}
                required
                disabled={submitting}
                value={password}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 bg-[#121212]/80 border border-white/5 rounded-xl pl-11 pr-11 text-xs text-white placeholder-secondaryText/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondaryText hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full h-11 bg-[#57E389] hover:bg-[#57E389]/95 text-black font-bold rounded-xl text-xs uppercase tracking-wider hover:shadow-[0_0_25px_rgba(87,227,137,0.35)] hover:-translate-y-0.5 transition-all mt-6 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(87,227,137,0.2)] font-sans"
          >
            <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
            {!submitting && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center text-xs text-secondaryText pt-2">
          Already have an account?{' '}
          <button 
            onClick={() => onNavigate('login')}
            className="text-accent hover:underline font-bold font-sans cursor-pointer"
          >
            Log in
          </button>
        </div>
      </motion.div>
    </div>
  );
}
