import React from 'react';
import { 
  LayoutDashboard, 
  Server, 
  Activity, 
  ShieldAlert, 
  Terminal, 
  FileText, 
  Blocks, 
  Settings,
  User,
  LogOut,
  Wifi,
  Database
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { user, logout } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'servers', name: 'Servers', icon: Server },
    { id: 'metrics', name: 'Metrics', icon: Activity },
    { id: 'alerts', name: 'Alerts', icon: ShieldAlert },
    { id: 'logs', name: 'Logs', icon: Terminal },
    { id: 'reports', name: 'Reports', icon: FileText },
    { id: 'integrations', name: 'Integrations', icon: Blocks },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[280px] h-screen bg-[#101010] border-r border-white/5 flex flex-col justify-between shrink-0 select-none p-6 pb-4 z-10">
      {/* Branding & Navigation Group */}
      <div className="space-y-8">
        
        {/* Branding header */}
        <div className="flex items-center gap-4">
          <Logo size={42} showGlow={true} />
          <div className="flex flex-col justify-center">
            <span className="font-bold text-white tracking-[0.5px] text-[18px] leading-tight font-sans">
              Node<span className="text-accent">Beacon</span>
            </span>
            <span className="text-[10px] font-semibold text-accent/60 tracking-[0.5px] font-sans -mt-0.5">
              ENTERPRISE DEPLOY
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 relative">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition-all duration-200 group text-left cursor-pointer ${
                  isActive 
                    ? 'text-accent font-bold bg-white/5 border border-white/5 shadow-[0_0_15px_rgba(87,227,137,0.06)]' 
                    : 'text-secondaryText font-medium hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                {/* Active left indicator slide */}
                {isActive && (
                  <motion.div 
                    layoutId="sidebarActiveLine"
                    className="absolute left-0 top-[25%] w-[3px] h-[50%] bg-accent rounded-r-full"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                
                <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 shrink-0 ${isActive ? 'text-accent' : 'text-secondaryText group-hover:text-white'}`} />
                <span className="tracking-wider uppercase font-mono">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & User Card */}
      <div className="space-y-4">
        {/* Status badges */}
        <div className="border-t border-white/5 pt-4 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-secondaryText uppercase tracking-wider px-2">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span>Connected</span>
            </span>
            <span className="text-[10px] font-bold text-accent">v1.0.0</span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-secondaryText uppercase tracking-wider px-2">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-accent" />
              <span>API Gateway</span>
            </span>
            <span className="text-[10px] font-bold text-accent">Online</span>
          </div>
        </div>

        {/* User Card */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.02] transition-all duration-150 border border-transparent hover:border-white/5">
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold font-mono text-accent text-xs">
              {user?.username?.[0]?.toUpperCase() || <User className="w-4 h-4 text-secondaryText" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white block truncate">
                {user?.first_name || user?.last_name 
                  ? `${user.first_name} ${user.last_name}`.trim() 
                  : user?.username || 'Alex Rivera'}
              </span>
              <span className="text-[10px] text-secondaryText block truncate font-mono">
                {user?.email || 'alex@nodebeacon.net'}
              </span>
            </div>
            <button 
              onClick={logout}
              className="text-secondaryText hover:text-danger p-1.5 rounded-lg transition-colors duration-150 cursor-pointer hover:bg-danger/10"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
