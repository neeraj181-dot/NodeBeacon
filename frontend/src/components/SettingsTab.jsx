import React, { useState, useEffect } from 'react';
import { User, Shield, Eye, Bell, ToggleLeft, ToggleRight, Check, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { updateProfile, changePassword } from '../api/auth';
import { EyeOff, Lock, CheckCircle, ShieldCheck, HelpCircle, Laptop, Smartphone, Globe, Trash2, CheckCircle2, LockKeyhole, Activity, ShieldAlert } from 'lucide-react';

export default function SettingsTab() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Profile state
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Toggle & Threshold states
  const [emailNotifs, setEmailNotifs] = useState(user?.enable_email_notifications ?? true);
  const [desktopNotifs, setDesktopNotifs] = useState(user?.enable_desktop_notifications ?? true);
  const [recipientEmail, setRecipientEmail] = useState(user?.recipient_email || '');
  const [cpuThreshold, setCpuThreshold] = useState(user?.cpu_threshold || 90);
  const [memoryThreshold, setMemoryThreshold] = useState(user?.memory_threshold || 90);
  const [diskThreshold, setDiskThreshold] = useState(user?.disk_threshold || 95);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState(user?.heartbeat_timeout || 60);

  // Security View States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState({ type: '', message: '' });

  // Security toggles (UI State only)
  const [alertLogin, setAlertLogin] = useState(true);
  const [browserAlert, setBrowserAlert] = useState(true);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [autoLogout, setAutoLogout] = useState(false);
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setEmailNotifs(user.enable_email_notifications ?? true);
      setDesktopNotifs(user.enable_desktop_notifications ?? true);
      setRecipientEmail(user.recipient_email || '');
      setCpuThreshold(user.cpu_threshold || 90);
      setMemoryThreshold(user.memory_threshold || 90);
      setDiskThreshold(user.disk_threshold || 95);
      setHeartbeatTimeout(user.heartbeat_timeout || 60);
    }
  }, [user]);

  const sections = [
    { id: 'profile', name: 'Profile Settings', icon: User },
    { id: 'security', name: 'Security & Auth', icon: Shield },
    { id: 'notifications', name: 'Alarms & Alerting', icon: Bell },
  ];

  if (user?.role === 'ORGANIZATION_ADMIN' || user?.role === 'MEMBER') {
    sections.push({ id: 'organization', name: 'Organization Settings', icon: HelpCircle }); // Fallback icon or import Building
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        enable_email_notifications: emailNotifs,
        enable_desktop_notifications: desktopNotifs,
        recipient_email: recipientEmail || null,
        cpu_threshold: parseFloat(cpuThreshold),
        memory_threshold: parseFloat(memoryThreshold),
        disk_threshold: parseFloat(diskThreshold),
        heartbeat_timeout: parseInt(heartbeatTimeout),
      };
      await updateProfile(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update settings preferences', err);
      alert('Failed to save settings configurations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#050505] text-white">
      {/* Header */}
      <div className="border-b border-white/5 pb-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-mono uppercase text-white">
          System settings
        </h1>
        <p className="text-secondaryText text-xs font-medium mt-1">
          Customize profile variables, alerting configurations, and security credentials.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-[220px] flex flex-col gap-2 shrink-0">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-mono tracking-wider uppercase text-left transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-white/5 border border-white/5 text-accent font-bold shadow-[0_0_15px_rgba(87,227,137,0.05)]' 
                    : 'text-secondaryText font-medium hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-secondaryText'}`} />
                <span>{section.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content Form container */}
        <div className={activeSection === 'security' ? "flex-1 w-full relative" : "flex-1 w-full max-w-xl glass-panel p-8 rounded-2xl relative"}>
          
          {activeSection === 'profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3">
                Update account details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 bg-accent text-[#070707] font-bold rounded-xl text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] disabled:opacity-50"
              >
                {saving ? (
                  <span>Saving configurations...</span>
                ) : saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Settings Saved</span>
                  </>
                ) : (
                  <span>Save Configuration</span>
                )}
              </button>
            </form>
          )}

          {activeSection === 'security' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-8 text-white w-full"
            >
              {/* Floating top-right success toast */}
              <AnimatePresence>
                {securityFeedback.message && securityFeedback.type === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="fixed top-6 right-6 z-50 p-4 rounded-xl text-xs font-mono bg-[#0c2e1b] border border-[#57E389]/40 text-[#57E389] shadow-[0_0_30px_rgba(87,227,137,0.15)] flex items-center gap-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#57E389]" />
                    <span>{securityFeedback.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Top layout: Password Form + Security Score Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Password Security Card */}
                <div className="lg:col-span-2 bg-[#090909] border border-white/5 p-6 rounded-2xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                      <span>🔐</span> Password Security
                    </h3>
                    <p className="text-xs text-secondaryText mt-1">
                      Update your account password to keep your account secure.
                    </p>
                  </div>

                  {securityFeedback.message && securityFeedback.type === 'error' && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-mono">
                      {securityFeedback.message}
                    </div>
                  )}

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setUpdatingPassword(true);
                    setSecurityFeedback({ type: '', message: '' });
                    try {
                      const hasLength = newPassword.length >= 8;
                      const hasUpper = /[A-Z]/.test(newPassword);
                      const hasLower = /[a-z]/.test(newPassword);
                      const hasNumber = /[0-9]/.test(newPassword);
                      const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
                      if (!(hasLength && hasUpper && hasLower && hasNumber && hasSpecial)) {
                        setSecurityFeedback({ type: 'error', message: 'Password is too weak.' });
                        setUpdatingPassword(false);
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        setSecurityFeedback({ type: 'error', message: 'Passwords do not match.' });
                        setUpdatingPassword(false);
                        return;
                      }
                      await changePassword(currentPassword, newPassword);
                      setSecurityFeedback({ type: 'success', message: 'Password updated successfully.' });
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setTimeout(() => setSecurityFeedback({ type: '', message: '' }), 5000);
                    } catch (err) {
                      const errorMsg = err.response?.data?.error || 'Current password is incorrect.';
                      setSecurityFeedback({ type: 'error', message: errorMsg });
                    } finally {
                      setUpdatingPassword(false);
                    }
                  }} className="space-y-6">
                    
                    <div className="space-y-6">
                      {/* Current Password */}
                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrent ? "text" : "password"}
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-11 bg-[#101010]/80 border border-white/5 rounded-xl px-4 pr-10 text-xs text-white focus:outline-none focus:border-[#57E389] focus:ring-1 focus:ring-[#57E389]/10 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondaryText hover:text-white"
                          >
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">New Password</label>
                        <div className="relative">
                          <input
                            type={showNew ? "text" : "password"}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-11 bg-[#101010]/80 border border-white/5 rounded-xl px-4 pr-10 text-xs text-white focus:outline-none focus:border-[#57E389] focus:ring-1 focus:ring-[#57E389]/10 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondaryText hover:text-white"
                          >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Password Strength Meter */}
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-secondaryText">Password Strength:</span>
                            <span className={
                              newPassword.length === 0 ? 'text-secondaryText' :
                              newPassword.length < 6 ? 'text-rose-500 font-bold' :
                              newPassword.length < 8 ? 'text-orange-400 font-bold' :
                              (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) ? 'text-yellow-500 font-bold' :
                              (newPassword.length < 12) ? 'text-lime-400 font-bold' : 'text-[#57E389] font-bold'
                            }>
                              {newPassword.length === 0 ? 'Not Entered' :
                               newPassword.length < 6 ? 'Very Weak' :
                               newPassword.length < 8 ? 'Weak' :
                               (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) ? 'Medium' :
                               (newPassword.length < 12) ? 'Strong' : 'Excellent'}
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex gap-1">
                            <motion.div 
                              className="h-full rounded-full flex-1 transition-colors duration-300"
                              animate={{ 
                                backgroundColor: newPassword.length === 0 ? '#1f1f1f' :
                                                 newPassword.length < 6 ? '#EF4444' :
                                                 newPassword.length < 8 ? '#F43F5E' : '#EAB308'
                              }}
                            />
                            <motion.div 
                              className="h-full rounded-full flex-1 transition-colors duration-300"
                              animate={{ 
                                backgroundColor: newPassword.length < 8 ? '#1f1f1f' :
                                                 (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) ? '#EAB308' : '#84CC16'
                              }}
                            />
                            <motion.div 
                              className="h-full rounded-full flex-1 transition-colors duration-300"
                              animate={{ 
                                backgroundColor: (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) ? '#1f1f1f' :
                                                 (newPassword.length < 12) ? '#84CC16' : '#57E389'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirm ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-11 bg-[#101010]/80 border border-white/5 rounded-xl px-4 pr-10 text-xs text-white focus:outline-none focus:border-[#57E389] focus:ring-1 focus:ring-[#57E389]/10 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondaryText hover:text-white"
                          >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Requirements Chips */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Password Requirements</span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: '8 Characters', met: newPassword.length >= 8 },
                          { label: 'Uppercase', met: /[A-Z]/.test(newPassword) },
                          { label: 'Lowercase', met: /[a-z]/.test(newPassword) },
                          { label: 'Number', met: /[0-9]/.test(newPassword) },
                          { label: 'Symbol', met: /[^A-Za-z0-9]/.test(newPassword) },
                        ].map((req, i) => (
                          <motion.span 
                            key={i}
                            layout
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all ${
                              req.met 
                                ? 'bg-[#57E389]/10 text-[#57E389] border-[#57E389]/20 font-bold' 
                                : 'bg-white/5 text-secondaryText border-white/5'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${req.met ? 'bg-[#57E389] shadow-[0_0_8px_#57E389]' : 'bg-white/20'}`} />
                            {req.label}
                          </motion.span>
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={updatingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                      className="w-full h-[52px] rounded-[14px] bg-[#57E389] text-[#070707] font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] hover:shadow-[0_0_25px_rgba(87,227,137,0.25)] cursor-pointer disabled:bg-white/5 disabled:text-secondaryText disabled:border-white/5 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
                    >
                      {updatingPassword && (
                        <span className="w-3.5 h-3.5 border-2 border-[#070707]/30 border-t-[#070707] rounded-full animate-spin" />
                      )}
                      <span>{updatingPassword ? 'Updating Password...' : 'Change Password'}</span>
                    </button>
                  </form>
                </div>

                {/* Security Status Card */}
                <div className="bg-[#090909] border border-white/5 p-6 rounded-2xl space-y-6 lg:col-span-1">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                      🛡️ Security Status
                    </h3>
                    <p className="text-xs text-secondaryText mt-1">
                      Overview of account security configurations.
                    </p>
                  </div>

                  {/* Dynamic Security Score & Progress Circle */}
                  <div className="flex flex-col items-center justify-center py-4 bg-[#101010] border border-white/5 rounded-xl space-y-4">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      {/* SVG circle container */}
                      <svg className="w-full h-full -rotate-90">
                        <circle 
                          cx="56" cy="56" r="48" 
                          className="stroke-white/5 fill-transparent"
                          strokeWidth="8"
                        />
                        <motion.circle 
                          cx="56" cy="56" r="48" 
                          className="stroke-[#57E389] fill-transparent"
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 48}
                          initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                          animate={{ 
                            strokeDashoffset: 2 * Math.PI * 48 * (1 - (50 + (newPassword.length >= 8 ? 20 : 0) + (browserAlert ? 15 : 0) + (alertLogin ? 15 : 0)) / 100) 
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold font-mono text-white">
                          {50 + (newPassword.length >= 8 ? 20 : 0) + (browserAlert ? 15 : 0) + (alertLogin ? 15 : 0)}/100
                        </span>
                        <span className="text-[9px] text-[#57E389] font-bold uppercase tracking-wider font-mono">
                          {50 + (newPassword.length >= 8 ? 20 : 0) + (browserAlert ? 15 : 0) + (alertLogin ? 15 : 0) >= 90 ? 'Excellent' : 'Good'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* List of Security Elements */}
                  <div className="space-y-3 font-mono text-[10px] uppercase tracking-wider">
                    <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                      <span className="text-secondaryText">Password Strength</span>
                      <span className={newPassword.length >= 8 ? "text-[#57E389] font-bold" : "text-rose-400 font-bold"}>
                        {newPassword.length >= 8 ? "✓ STRONG" : "○ WEAK"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                      <span className="text-secondaryText">Email Verified</span>
                      <span className="text-[#57E389] font-bold">✓ VERIFIED</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                      <span className="text-secondaryText">Login Alerts</span>
                      <span className={alertLogin ? "text-[#57E389] font-bold" : "text-yellow-500 font-bold"}>
                        {alertLogin ? "✓ ENABLED" : "○ DISABLED"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                      <span className="text-secondaryText">2FA Status</span>
                      <span className="text-rose-500 font-bold">○ DISABLED</span>
                    </div>
                  </div>

                  {/* Metadata Fields */}
                  <div className="pt-4 border-t border-white/5 space-y-2 text-[10px] text-secondaryText font-mono">
                    <div className="flex justify-between">
                      <span>Last Password Change:</span>
                      <span className="text-white">Recent</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Login:</span>
                      <span className="text-white">Just now</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Session:</span>
                      <span className="text-white">Active</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Authentication Settings Panel */}
              <div className="bg-[#090909] border border-white/5 p-6 rounded-2xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                    ⚙️ Authentication Settings
                  </h3>
                  <p className="text-xs text-secondaryText mt-1">
                    Manage direct security alerts and session threshold behavior.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email Login Alerts Card */}
                  <div className="flex items-center justify-between p-4 bg-[#101010] border border-white/5 rounded-xl hover:border-white/10 transition-all hover:translate-y-[-2px] duration-200">
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono uppercase">Email Login Alerts</h4>
                      <p className="text-[10px] text-secondaryText mt-1">Receive immediate emails for new machine logins.</p>
                    </div>
                    <button type="button" onClick={() => setAlertLogin(!alertLogin)} className="cursor-pointer">
                      {alertLogin ? <ToggleRight className="w-8 h-8 text-[#57E389]" /> : <ToggleLeft className="w-8 h-8 text-secondaryText" />}
                    </button>
                  </div>

                  {/* Browser Notifications Card */}
                  <div className="flex items-center justify-between p-4 bg-[#101010] border border-white/5 rounded-xl hover:border-white/10 transition-all hover:translate-y-[-2px] duration-200">
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono uppercase">Browser Notifications</h4>
                      <p className="text-[10px] text-secondaryText mt-1">Display push alert warnings within active browser tabs.</p>
                    </div>
                    <button type="button" onClick={() => setBrowserAlert(!browserAlert)} className="cursor-pointer">
                      {browserAlert ? <ToggleRight className="w-8 h-8 text-[#57E389]" /> : <ToggleLeft className="w-8 h-8 text-secondaryText" />}
                    </button>
                  </div>

                  {/* Remember Device Card */}
                  <div className="flex items-center justify-between p-4 bg-[#101010] border border-white/5 rounded-xl hover:border-white/10 transition-all hover:translate-y-[-2px] duration-200">
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono uppercase">Remember Device</h4>
                      <p className="text-[10px] text-secondaryText mt-1">Maintain active 2FA credentials on this device for 30 days.</p>
                    </div>
                    <button type="button" onClick={() => setRememberDevice(!rememberDevice)} className="cursor-pointer">
                      {rememberDevice ? <ToggleRight className="w-8 h-8 text-[#57E389]" /> : <ToggleLeft className="w-8 h-8 text-secondaryText" />}
                    </button>
                  </div>

                  {/* Auto Logout Card */}
                  <div className="flex items-center justify-between p-4 bg-[#101010] border border-white/5 rounded-xl hover:border-white/10 transition-all hover:translate-y-[-2px] duration-200">
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono uppercase">Automatic Logout</h4>
                      <p className="text-[10px] text-secondaryText mt-1">Logout automatically after 30 minutes of user inactivity.</p>
                    </div>
                    <button type="button" onClick={() => setAutoLogout(!autoLogout)} className="cursor-pointer">
                      {autoLogout ? <ToggleRight className="w-8 h-8 text-[#57E389]" /> : <ToggleLeft className="w-8 h-8 text-secondaryText" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Sessions Panel */}
              <div className="bg-[#090909] border border-white/5 p-6 rounded-2xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase tracking-wider">
                    💻 Active Terminal Sessions
                  </h3>
                  <p className="text-xs text-secondaryText mt-1">
                    Devices currently logged in to your NodeBeacon account.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Session 1 */}
                  <div className="flex items-center justify-between p-4 bg-[#101010] border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#57E389]/10 border border-[#57E389]/20 flex items-center justify-center">
                        <Laptop className="w-4 h-4 text-[#57E389]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">Chrome &bull; Windows 11</span>
                          <span className="px-1.5 py-0.5 bg-[#57E389]/10 border border-[#57E389]/20 text-[8px] font-bold text-[#57E389] font-mono rounded">CURRENT</span>
                        </div>
                        <p className="text-[10px] text-secondaryText mt-0.5 font-mono">192.168.1.14 &bull; New York, US</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#57E389] font-bold font-mono tracking-wider">ACTIVE NOW</span>
                  </div>

                  {/* Session 2 */}
                  <div className="flex items-center justify-between p-4 bg-[#101010] border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-secondaryText" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">Firefox &bull; Android 14</span>
                        </div>
                        <p className="text-[10px] text-secondaryText mt-0.5 font-mono">172.56.21.99 &bull; California, US</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => alert("Session termination is configured for secondary devices.")}
                      className="h-8 px-3 rounded-lg border border-white/5 hover:border-rose-500/20 text-[10px] font-bold font-mono text-secondaryText hover:text-rose-400 hover:bg-rose-500/5 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Terminate
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {activeSection === 'notifications' && (
            <form onSubmit={handleSave} className="space-y-6">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3">
                Alarm Dispatcher channels
              </h3>

              <div className="space-y-4 pt-2">
                {/* Email alarms toggle */}
                <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Email Alarms</h4>
                    <p className="text-[10px] text-secondaryText mt-0.5">Send alerts directly to the configured recipient email.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setEmailNotifs(!emailNotifs)}
                    className="text-secondaryText hover:text-white cursor-pointer"
                  >
                    {emailNotifs ? (
                      <ToggleRight className="w-7 h-7 text-accent" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-secondaryText" />
                    )}
                  </button>
                </div>

                {/* Desktop notifications toggle */}
                <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Desktop Notifications</h4>
                    <p className="text-[10px] text-secondaryText mt-0.5">Deliver native browser-level popup warnings immediately.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setDesktopNotifs(!desktopNotifs)}
                    className="text-secondaryText hover:text-white cursor-pointer"
                  >
                    {desktopNotifs ? (
                      <ToggleRight className="w-7 h-7 text-accent" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-secondaryText" />
                    )}
                  </button>
                </div>
              </div>

              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3 pt-4">
                Threshold Configurations
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Recipient Email</label>
                  <input
                    type="email"
                    placeholder={email || "e.g. alerts@company.com"}
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">CPU Threshold (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={cpuThreshold}
                      onChange={(e) => setCpuThreshold(e.target.value)}
                      className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Memory Threshold (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={memoryThreshold}
                      onChange={(e) => setMemoryThreshold(e.target.value)}
                      className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Disk Threshold (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={diskThreshold}
                      onChange={(e) => setDiskThreshold(e.target.value)}
                      className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Heartbeat Timeout (s)</label>
                    <input
                      type="number"
                      required
                      min="10"
                      value={heartbeatTimeout}
                      onChange={(e) => setHeartbeatTimeout(e.target.value)}
                      className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 bg-accent text-[#070707] font-bold rounded-xl text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] disabled:opacity-50"
                >
                  {saving ? <span>Saving configurations...</span> : saved ? <span>Saved</span> : <span>Save Configurations</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailNotifs(true);
                    setDesktopNotifs(true);
                    setRecipientEmail('');
                    setCpuThreshold(90);
                    setMemoryThreshold(90);
                    setDiskThreshold(95);
                    setHeartbeatTimeout(60);
                  }}
                  className="px-5 h-10 bg-white/5 border border-white/5 hover:border-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </form>
          )}

          {activeSection === 'api' && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3">
                Developer API Credentials
              </h3>

              <div className="space-y-4">
                <p className="text-xs text-secondaryText leading-relaxed">
                  Use your user access credentials to query server statuses and collect historical metrics logs programmatically.
                </p>

                <div className="p-4 bg-[#101010] border border-white/5 rounded-xl flex items-center justify-between">
                  <div className="font-mono text-xs select-all text-white">
                    nb_usr_act_7c8d9e2b1a0f9e8d...
                  </div>
                  <button 
                    onClick={() => alert("User API key copied to clipboard")}
                    className="text-[10px] text-accent font-bold uppercase tracking-wider font-mono hover:underline cursor-pointer"
                  >
                    copy key
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'organization' && <OrgSettingsForm />}

        </div>
      </div>
    </div>
  );
}

function OrgSettingsForm() {
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertRecipients, setAlertRecipients] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const { getOrgSettings } = await import('../api/auth');
        const data = await getOrgSettings();
        setOrgName(data.organization_name || '');
        setAlertEmail(data.alert_email || '');
        setAlertRecipients(data.alert_recipients || '');
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrg();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      const { updateOrgSettings } = await import('../api/auth');
      await updateOrgSettings({
        organization_name: orgName,
        alert_email: alertEmail,
        alert_recipients: alertRecipients,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Failed to update organization settings.");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'ORGANIZATION_ADMIN';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3">
        Organization Configuration
      </h3>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Organization Name</label>
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Alert Email</label>
          <input
            type="email"
            required
            disabled={!isAdmin}
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">
            Alert Recipients (Comma Separated)
          </label>
          <textarea
            disabled={!isAdmin}
            value={alertRecipients}
            onChange={(e) => setAlertRecipients(e.target.value)}
            placeholder="admin@company.com, tech@company.com"
            className="w-full h-20 bg-[#101010]/80 border border-white/5 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-accent/40 font-mono"
          />
        </div>
      </div>

      {isAdmin && (
        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-accent text-[#070707] font-bold rounded-xl text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)] disabled:opacity-50"
        >
          {loading ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      )}
    </form>
  );
}
