import React, { useState } from 'react';
import { User, Shield, Eye, Bell, ToggleLeft, ToggleRight, Check, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

export default function SettingsTab() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Profile state
  const [firstName, setFirstName] = useState(user?.first_name || 'Alex');
  const [lastName, setLastName] = useState(user?.last_name || 'Rivera');
  const [email, setEmail] = useState(user?.email || 'alex@nodebeacon.net');

  // Toggle states
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const sections = [
    { id: 'profile', name: 'Profile Settings', icon: User },
    { id: 'security', name: 'Security & Auth', icon: Shield },
    { id: 'notifications', name: 'Alarms & Alerting', icon: Bell },
    { id: 'api', name: 'Developer APIs', icon: Key },
  ];

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
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
        <div className="flex-1 w-full max-w-xl glass-panel p-8 rounded-2xl relative">
          
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
            <form onSubmit={handleSave} className="space-y-6">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3">
                Security Configurations
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondaryText uppercase tracking-wider font-mono">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 bg-accent text-[#070707] font-bold rounded-xl text-xs uppercase tracking-wider font-mono hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)]"
              >
                Update Password
              </button>
            </form>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider border-b border-white/5 pb-3">
                Alarm Dispatcher channels
              </h3>

              <div className="space-y-4 pt-2">
                {/* Email alarms toggle */}
                <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Email Alarms</h4>
                    <p className="text-[10px] text-secondaryText mt-0.5">Send alerts directly to {email}.</p>
                  </div>
                  <button 
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

                {/* Slack alarms toggle */}
                <div className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Slack notifications</h4>
                    <p className="text-[10px] text-secondaryText mt-0.5">Dispatch payload to connected workspace channels.</p>
                  </div>
                  <button 
                    onClick={() => setSlackNotifs(!slackNotifs)}
                    className="text-secondaryText hover:text-white cursor-pointer"
                  >
                    {slackNotifs ? (
                      <ToggleRight className="w-7 h-7 text-accent" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-secondaryText" />
                    )}
                  </button>
                </div>
              </div>
            </div>
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

        </div>
      </div>
    </div>
  );
}
