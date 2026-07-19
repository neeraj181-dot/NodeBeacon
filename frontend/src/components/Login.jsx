import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Activity, Bell, ShieldCheck, ArrowRight } from 'lucide-react';
import Logo from './Logo';
import WaveBackground from './WaveBackground';
import { useAuth } from '../contexts/AuthContext';

export default function Login({ onLogin, onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);
    try {
      // Since username = email, we pass email to the login method
      await login(email.trim(), password);
      onLogin();
    } catch (err) {
      setLocalError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="relative min-h-screen w-screen bg-register text-white flex overflow-hidden font-sans select-none">
      <div className="grid-overlay" />
      
      {/* Animated Canvas Wave Background */}
      <WaveBackground />

      {/* Split Screen Container */}
      <div className="relative z-10 w-full flex flex-col md:flex-row">
        
        {/* LEFT SIDE - Hero Section */}
        <div className="w-full md:w-1/2 flex flex-col justify-between p-8 md:p-16 lg:p-24">
          
          {/* Logo & Branding */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <Logo size={48} showGlow={true} />
            <div className="flex flex-col">
              <span className="font-semibold text-white tracking-[0.5px] text-[18px] block font-sans">
                Node<span className="text-accent">Beacon</span>
              </span>
              <span className="text-[12px] text-accent/60 tracking-[0.5px] font-medium block font-sans -mt-0.5">v1.0.0</span>
            </div>
          </motion.div>

          {/* Core Marketing Copy */}
          <div className="my-auto max-w-lg space-y-8 py-12 md:py-0">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-4"
            >
              <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] font-mono uppercase">
                Monitor your <span className="text-accent">infrastructure.</span>
              </h1>
              <p className="text-secondaryText text-sm lg:text-base leading-relaxed">
                Real-time monitoring, intelligent alerts and complete visibility across your servers.
              </p>
            </motion.div>

            {/* Three Feature Cards */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {/* Card 1 */}
              <div className="bg-card/40 border border-white/5 p-4 rounded-xl hover:border-white/10 transition-all duration-300">
                <Activity className="w-5 h-5 text-accent mb-2 stroke-[1.5]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Real-time</h4>
                <p className="text-[10px] text-secondaryText mt-1">Metrics compiled instantly.</p>
              </div>

              {/* Card 2 */}
              <div className="bg-card/40 border border-white/5 p-4 rounded-xl hover:border-white/10 transition-all duration-300">
                <Bell className="w-5 h-5 text-blue mb-2 stroke-[1.5]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Instant Alerts</h4>
                <p className="text-[10px] text-secondaryText mt-1">Intelligent outage logs.</p>
              </div>

              {/* Card 3 */}
              <div className="bg-card/40 border border-white/5 p-4 rounded-xl hover:border-white/10 transition-all duration-300">
                <ShieldCheck className="w-5 h-5 text-accent mb-2 stroke-[1.5]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Secure Infra</h4>
                <p className="text-[10px] text-secondaryText mt-1">Encrypted monitoring keys.</p>
              </div>
            </motion.div>
          </div>

          {/* Copyright */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8 }}
            className="text-[11px] font-mono text-secondaryText"
          >
            © {new Date().getFullYear()} NodeBeacon. All rights reserved.
          </motion.div>
        </div>

        {/* RIGHT SIDE - Authentication Card */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-24">
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-[460px] bg-[#0c0c0c]/90 backdrop-blur-[24px] border border-[#57E389]/25 p-8 rounded-[28px] space-y-5 shadow-[0_0_50px_rgba(87,227,137,0.08)] relative overflow-hidden group hover:border-[#57E389]/35 transition-all duration-300"
          >
            
            {/* Soft Ambient Glow effect in background of card */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none group-hover:bg-accent/15 transition-all duration-300"></div>

            {/* Logo Center (Icon -> Brand name -> Welcome back -> Subtitle) */}
            <div className="flex flex-col items-center relative">
              {/* Radial Highlight behind Logo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#57E389]/10 rounded-full blur-[64px] pointer-events-none"></div>

              {/* App Icon (64px) with Emerald Glow */}
              <div className="relative mb-3 flex items-center justify-center">
                <motion.div 
                  animate={{ opacity: [0.35, 0.5, 0.35], scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute w-20 h-20 bg-[#57E389]/30 rounded-full blur-2xl pointer-events-none"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="relative z-10"
                >
                  <Logo size={64} showGlow={true} />
                </motion.div>
              </div>

              {/* NodeBeacon Brand (Geist Bold) */}
              <h3 className="font-bold text-white text-[20px] tracking-[0.5px] font-sans">
                Node<span className="text-accent">Beacon</span>
              </h3>

              {/* Welcome back */}
              <h2 className="text-sm font-semibold text-white tracking-wide mt-2">
                Welcome back
              </h2>
              
              {/* Subtitle */}
              <p className="text-[11px] text-secondaryText mt-1">
                Sign in to your account to continue
              </p>
            </div>

            {/* Display validation errors from backend */}
            {localError && (
              <div className="p-3 bg-danger/5 border border-danger/25 text-danger rounded-xl text-xs font-medium font-sans">
                {localError}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">Email address</label>
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
                    placeholder="you@example.com"
                    className="w-full h-11 bg-[#111111]/80 border border-white/5 rounded-xl pl-11 pr-4 text-xs text-white placeholder-secondaryText focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-200 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">Password</label>
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
                    placeholder="Enter your password"
                    className="w-full h-11 bg-[#111111]/80 border border-white/5 rounded-xl pl-11 pr-11 text-xs text-white placeholder-secondaryText focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-200 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondaryText hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot Row */}
              <div className="flex items-center justify-between text-xs pt-1 select-none">
                <label className="flex items-center gap-2 text-secondaryText cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-[#111111]/80 accent-accent focus:ring-0 focus:ring-offset-0 text-accent"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-accent hover:underline font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-accent text-black font-semibold rounded-xl text-xs uppercase tracking-wider hover:shadow-[0_0_20px_rgba(87,227,137,0.3)] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <span className="relative bg-[#171717] px-3 text-[10px] text-secondaryText uppercase tracking-widest font-mono">or continue with</span>
            </div>

            {/* Social Oauth Buttons */}
            <div className="w-full">
              <button className="w-full h-10 bg-[#111111]/50 border border-white/5 hover:border-white/10 hover:bg-[#111111] text-xs font-semibold rounded-xl text-white flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Google</span>
              </button>
            </div>

            {/* Bottom Create Account Link */}
            <div className="text-center text-xs text-secondaryText pt-2">
              Don't have an account?{' '}
              <button
                onClick={() => onNavigate('register')}
                className="text-accent hover:underline font-semibold"
              >
                Create account
              </button>
            </div>

          </motion.div>
        </div>

      </div>

    </div>
  );
}
