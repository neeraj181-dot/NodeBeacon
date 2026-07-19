import React, { useState, useEffect } from 'react';
import { Search, Bell, Plus, Terminal, User, Laptop } from 'lucide-react';
import Logo from './Logo';
import { useAlerts } from '../contexts/AlertContext';

export default function Navbar({ onAddServerClick }) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const { alerts } = useAlerts();

  const placeholders = [
    "Search resource metrics...",
    "Search server nodes...",
    "Search active warnings...",
    "Search incident alerts...",
  ];

  // Rotate search placeholder for modern animated feel
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const activeAlerts = alerts.filter(a => a.status === 'Active');
  const activeAlertsCount = activeAlerts.length;

  return (
    <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-[#050505] shrink-0 select-none z-20">
      {/* Search Input and Brand Emblem */}
      <div className="flex items-center gap-8 flex-1 max-w-xl">
        {/* Compact logo layout */}
        <div className="flex items-center gap-3">
          <Logo size={28} showGlow={true} />
          <span className="font-bold text-white tracking-[0.5px] text-[16px] font-sans">
            Node<span className="text-accent">Beacon</span>
          </span>
        </div>

        <div className={`relative flex items-center w-full transition-all duration-300 ${searchFocused ? 'max-w-md' : 'max-w-xs'}`}>
          <Search className={`absolute left-3.5 w-4 h-4 transition-colors duration-200 ${searchFocused ? 'text-accent' : 'text-secondaryText'} pointer-events-none`} />
          <input
            type="text"
            placeholder={placeholders[placeholderIndex]}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full h-10 bg-[#101010]/80 border border-white/5 rounded-xl pl-11 pr-4 text-xs text-white placeholder-secondaryText/70 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/10 focus:shadow-[0_0_15px_rgba(87,227,137,0.05)] transition-all duration-300 font-mono"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-4">
        {/* Platform Status */}
        {activeAlertsCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-danger/5 border border-danger/20 shadow-[0_0_10px_rgba(255,95,87,0.05)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger"></span>
            </span>
            <span className="text-[10px] font-bold text-danger uppercase tracking-wider font-mono">Outages Detected ({activeAlertsCount})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/5 border border-accent/20 shadow-[0_0_10px_rgba(87,227,137,0.05)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
            </span>
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider font-mono">Systems Normal</span>
          </div>
        )}

        {/* Quick Register Server */}
        <button 
          onClick={onAddServerClick}
          className="h-10 px-4 rounded-xl bg-accent text-[#070707] font-bold text-xs tracking-wider uppercase font-mono hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 transition-all duration-150 cursor-pointer shadow-[0_0_20px_rgba(87,227,137,0.15)]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Node</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button className="p-2.5 text-secondaryText hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all duration-150 cursor-pointer">
            <Bell className="w-4.5 h-4.5" />
          </button>
          {activeAlertsCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center border border-[#050505] animate-neon-pulse font-mono">
              {activeAlertsCount}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
